'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { despesaSchema } from '@/lib/validations/despesas'
import type { SupabaseClient } from '@supabase/supabase-js'

export type ActionState = { error?: string; success?: boolean } | undefined
export type CriarNotaState = { error?: string; success?: boolean; notaId?: string } | undefined

const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
const EXTENSAO_POR_TIPO: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
}

// Envia o comprovante pro bucket privado (chave opaca, nunca o nome do
// estabelecimento — esse só existe como `nome_exibicao` depois que a IA lê o
// documento) e dispara a leitura. Cada arquivo vira uma linha em
// `notas_compra`; a aprovação da despesa (etapa seguinte, tela separada) é
// que decide se ela vira uma despesa de verdade.
export async function criarNotaCompra(_prevState: CriarNotaState, formData: FormData): Promise<CriarNotaState> {
  const arquivo = formData.get('arquivo')
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { error: 'Selecione um arquivo' }
  }

  const mediaType = arquivo.type || 'image/jpeg'
  if (!TIPOS_ACEITOS.includes(mediaType)) {
    return { error: 'Formato não suportado. Envie uma foto (JPG/PNG/WEBP) ou um PDF.' }
  }

  const supabase = await createClient()
  const notaId = randomUUID()
  const extensao = EXTENSAO_POR_TIPO[mediaType] ?? 'bin'
  const caminhoArquivo = `${notaId}/original.${extensao}`
  const bytes = await arquivo.arrayBuffer()

  const { error: erroUpload } = await supabase.storage
    .from('notas-compra')
    .upload(caminhoArquivo, bytes, { contentType: mediaType })
  if (erroUpload) return { error: `Falha ao salvar o arquivo: ${erroUpload.message}` }

  const { error: erroInsert } = await supabase
    .from('notas_compra')
    .insert({ id: notaId, arquivo_path: caminhoArquivo, mime_type: mediaType, status: 'processando' })
  if (erroInsert) return { error: erroInsert.message }

  await processarLeituraIA(supabase, notaId, bytes, mediaType)

  revalidatePath('/despesas/notas-compra')
  return { success: true, notaId }
}

// Só faz sentido antes de aprovar a despesa — depois disso os itens já
// entraram na etapa de Estoque e não são mais tocados pela IA (itens já
// confirmados nunca são apagados/recriados, mesmo reprocessando).
export async function reprocessarNotaCompra(notaId: string): Promise<ActionState> {
  const supabase = await createClient()
  const { data: nota, error: erroLeitura } = await supabase.from('notas_compra').select('*').eq('id', notaId).single()
  if (erroLeitura || !nota) return { error: 'Nota não encontrada' }
  if (nota.status === 'aprovada' || nota.status === 'concluida') {
    return { error: 'Essa nota já foi aprovada e não pode mais ser reprocessada' }
  }

  await supabase.from('notas_compra_itens').delete().eq('nota_id', notaId).eq('validado', false)
  await supabase.from('notas_compra').update({ status: 'processando', erro_processamento: null }).eq('id', notaId)

  const { data: arquivoBaixado, error: erroDownload } = await supabase.storage
    .from('notas-compra')
    .download(nota.arquivo_path)
  if (erroDownload || !arquivoBaixado) {
    await supabase
      .from('notas_compra')
      .update({ status: 'falha_leitura', erro_processamento: 'Não consegui reabrir o arquivo salvo' })
      .eq('id', notaId)
    return { error: 'Não consegui reabrir o arquivo salvo' }
  }

  await processarLeituraIA(supabase, notaId, await arquivoBaixado.arrayBuffer(), nota.mime_type)

  revalidatePath('/despesas/notas-compra')
  revalidatePath(`/despesas/notas-compra/${notaId}`)
  return { success: true }
}

// Grava a despesa geral da nota e marca como aprovada. A partir daqui, a
// aba Despesas não mexe mais nela — os itens (se houver) ficam disponíveis
// pra confirmação na aba Estoque, a qualquer momento, sem prazo.
export async function aprovarDespesaNotaCompra(
  notaId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = despesaSchema.safeParse({
    data: formData.get('data'),
    categoria: formData.get('categoria'),
    descricao: formData.get('descricao'),
    valor: formData.get('valor'),
    forma_pagamento: formData.get('forma_pagamento') || null,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }

  const supabase = await createClient()

  const { data: nota, error: erroLeitura } = await supabase
    .from('notas_compra')
    .select('despesa_id')
    .eq('id', notaId)
    .single()
  if (erroLeitura || !nota) return { error: 'Nota não encontrada' }
  if (nota.despesa_id) return { error: 'Essa nota já foi aprovada' }

  const { data: despesa, error: erroDespesa } = await supabase.from('despesas').insert(parsed.data).select().single()
  if (erroDespesa) return { error: erroDespesa.message }

  const { error: erroNota } = await supabase
    .from('notas_compra')
    .update({ despesa_id: despesa.id, status: 'aprovada' })
    .eq('id', notaId)
  if (erroNota) return { error: erroNota.message }

  revalidatePath('/despesas/notas-compra')
  revalidatePath(`/despesas/notas-compra/${notaId}`)
  revalidatePath('/despesas')
  revalidatePath('/dashboard')
  revalidatePath('/estoque/notas-compra')
  return { success: true }
}

// Exclui a nota por inteiro: a despesa que ela gerou (se já foi aprovada), os
// itens lidos e o arquivo do comprovante. Se algum item já foi confirmado no
// Estoque, recusa — apagar a nota deixaria entradas de estoque sem origem; o
// caminho é excluir antes esses movimentos no histórico do item (o que
// também devolve o item da nota pra pendente, ver deleteMovimento).
// Ordem: despesa → nota → arquivo. Se falhar no meio, o que sobra continua
// consistente e dá pra tentar de novo (nota sem despesa_id é tratada normal).
export async function excluirNotaCompra(notaId: string): Promise<ActionState> {
  const supabase = await createClient()

  const { data: nota, error: erroLeitura } = await supabase
    .from('notas_compra')
    .select('arquivo_path, despesa_id')
    .eq('id', notaId)
    .single()
  if (erroLeitura || !nota) return { error: 'Nota não encontrada' }

  const { count: itensNoEstoque } = await supabase
    .from('notas_compra_itens')
    .select('id', { count: 'exact', head: true })
    .eq('nota_id', notaId)
    .eq('validado', true)
  if (itensNoEstoque) {
    return {
      error:
        'Essa nota já teve itens confirmados no estoque. Para excluí-la, primeiro exclua as entradas dela no histórico do item (aba Estoque) — isso devolve os itens para pendente — e depois exclua a nota.',
    }
  }

  if (nota.despesa_id) {
    const { data: despesaExcluida, error: erroDespesa } = await supabase
      .from('despesas')
      .delete()
      .eq('id', nota.despesa_id)
      .select('id')
    if (erroDespesa) return { error: erroDespesa.message }
    if (!despesaExcluida?.length) return { error: 'Não foi possível excluir a despesa dessa nota' }
  }

  const { data: notaExcluida, error: erroNota } = await supabase
    .from('notas_compra')
    .delete()
    .eq('id', notaId)
    .select('id')
  if (erroNota) return { error: erroNota.message }
  if (!notaExcluida?.length) return { error: 'Não foi possível excluir a nota' }

  const { error: erroArquivo } = await supabase.storage.from('notas-compra').remove([nota.arquivo_path])
  if (erroArquivo) console.error('[notas-compra] falha ao apagar o arquivo do comprovante', erroArquivo)

  revalidatePath('/despesas/notas-compra')
  revalidatePath('/despesas')
  revalidatePath('/dashboard')
  revalidatePath('/resumo-anual')
  revalidatePath('/estoque/notas-compra')
  return { success: true }
}

// Lê o documento com a mesma chamada crua (sem SDK) já usada em
// despesas/actions.ts:extrairDespesaDeImagem — só que pedindo os itens da
// compra em vez de uma despesa única. Nunca lança: qualquer falha grava
// `falha_leitura` + `erro_processamento` na própria nota, pra aparecer na
// lista em vez de travar o upload dos outros arquivos do lote.
async function processarLeituraIA(
  supabase: SupabaseClient,
  notaId: string,
  bytes: ArrayBuffer,
  mediaType: string
): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    await marcarFalha(supabase, notaId, 'Importação por IA não configurada: falta a variável ANTHROPIC_API_KEY no servidor.')
    return
  }

  const base64 = Buffer.from(bytes).toString('base64')
  const hoje = new Date().toISOString().slice(0, 10)

  let resposta: Response
  try {
    resposta = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1500,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: mediaType === 'application/pdf' ? 'document' : 'image',
                source: { type: 'base64', media_type: mediaType, data: base64 },
              },
              {
                type: 'text',
                text: `Esta imagem é uma nota fiscal, recibo, cupom fiscal ou print de uma COMPRA feita por um buffet a um fornecedor. Leia e responda SOMENTE com um JSON, sem markdown e sem texto antes ou depois, no formato exato:
{"estabelecimento": "nome do estabelecimento/fornecedor", "data_compra": "AAAA-MM-DD", "valor_total": 0.00, "itens": [{"texto_original": "texto exato da linha do item, como está impresso", "quantidade": 0, "valor_total": 0.00, "confianca": 0.0}]}

"confianca" vai de 0 a 1 e indica o quanto você tem certeza da leitura daquela linha. Se não achar a data, use "${hoje}". Se não conseguir identificar nenhum item nem o valor total com confiança, responda {"error": "motivo em poucas palavras"} em vez do formato acima.`,
              },
            ],
          },
        ],
      }),
    })
  } catch {
    await marcarFalha(supabase, notaId, 'Falha ao conectar com o serviço de IA')
    return
  }

  if (!resposta.ok) {
    const mensagem = resposta.status === 401 ? 'Chave da API de IA inválida' : `Erro ao ler o documento (status ${resposta.status})`
    await marcarFalha(supabase, notaId, mensagem)
    return
  }

  const json = await resposta.json()
  const texto: string = json.content?.[0]?.text ?? ''

  let extraido: {
    estabelecimento?: string
    data_compra?: string
    valor_total?: number
    itens?: { texto_original?: string; quantidade?: number; valor_total?: number; confianca?: number }[]
    error?: string
  }
  try {
    const match = texto.match(/\{[\s\S]*\}/)
    extraido = JSON.parse(match ? match[0] : texto)
  } catch {
    await marcarFalha(supabase, notaId, 'Não consegui interpretar a resposta da IA')
    return
  }

  if (extraido.error) {
    await marcarFalha(supabase, notaId, extraido.error)
    return
  }

  const itensValidos = (extraido.itens ?? []).filter(
    (item): item is { texto_original: string; quantidade: number; valor_total: number; confianca?: number } =>
      !!item.texto_original && typeof item.quantidade === 'number' && item.quantidade > 0 && typeof item.valor_total === 'number' && item.valor_total >= 0
  )
  if (!itensValidos.length) {
    await marcarFalha(supabase, notaId, 'Não consegui identificar itens com quantidade e valor válidos nesse documento')
    return
  }

  const dataCompra = extraido.data_compra || hoje
  const estabelecimento = extraido.estabelecimento || null

  await supabase
    .from('notas_compra')
    .update({
      estabelecimento,
      data_compra: dataCompra,
      valor_total_lido: typeof extraido.valor_total === 'number' ? extraido.valor_total : null,
      nome_exibicao: `${estabelecimento ?? 'Nota de compra'} - ${dataCompra}`,
      status: 'aguardando_aprovacao',
      erro_processamento: null,
    })
    .eq('id', notaId)

  await supabase.from('notas_compra_itens').insert(
    itensValidos.map((item) => ({
      nota_id: notaId,
      texto_original: item.texto_original,
      quantidade: item.quantidade,
      valor_total: item.valor_total,
      confianca: item.confianca ?? null,
    }))
  )
}

async function marcarFalha(supabase: SupabaseClient, notaId: string, mensagem: string) {
  await supabase.from('notas_compra').update({ status: 'falha_leitura', erro_processamento: mensagem }).eq('id', notaId)
}
