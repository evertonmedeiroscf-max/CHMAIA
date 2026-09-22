'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { despesaSchema } from '@/lib/validations/despesas'

export type ActionState = { error?: string; success?: boolean } | undefined

function parseFormData(formData: FormData) {
  return {
    data: formData.get('data'),
    categoria: formData.get('categoria'),
    descricao: formData.get('descricao'),
    valor: formData.get('valor'),
    forma_pagamento: formData.get('forma_pagamento') || null,
  }
}

export async function createDespesa(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = despesaSchema.safeParse(parseFormData(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('despesas').insert(parsed.data)

  if (error) return { error: error.message }

  revalidatePath('/despesas')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateDespesa(
  id: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = despesaSchema.safeParse(parseFormData(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('despesas').update(parsed.data).eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/despesas')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteDespesa(_id: string, _prevState: ActionState): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.from('despesas').delete().eq('id', _id)
  if (error) return { error: error.message }
  revalidatePath('/despesas')
  revalidatePath('/dashboard')
  return { success: true }
}

// Grava de uma vez todas as despesas conferidas na tela de importação em
// lote (um documento da pasta escolhida = uma linha). Só é chamada depois
// que o usuário revisou/corrigiu cada linha e clicou em salvar.
export async function createDespesasEmLote(
  despesas: Array<{ data: string; categoria: string; descricao: string; valor: number; forma_pagamento: string | null }>
): Promise<ActionState> {
  if (!despesas.length) return { error: 'Nenhuma despesa para salvar' }

  const parsedList = []
  for (const despesa of despesas) {
    const parsed = despesaSchema.safeParse(despesa)
    if (!parsed.success) {
      return { error: `"${despesa.descricao || 'sem descrição'}": ${parsed.error.issues[0]?.message ?? 'dados inválidos'}` }
    }
    parsedList.push(parsed.data)
  }

  const supabase = await createClient()
  const { error } = await supabase.from('despesas').insert(parsedList)

  if (error) return { error: error.message }

  revalidatePath('/despesas')
  revalidatePath('/dashboard')
  return { success: true }
}

export type ExtracaoState = { error?: string; data?: string; descricao?: string; valor?: number } | undefined

// Lê uma foto/print/PDF de um comprovante único (não um extrato com várias
// linhas — ver decisão do usuário) e devolve data/descrição/valor prontos
// para conferência em ImportarDespesa.tsx. Nunca grava nada sozinha: quem
// insere é createDespesa, depois que o usuário confirma os valores lidos.
export async function extrairDespesaDeImagem(_prevState: ExtracaoState, formData: FormData): Promise<ExtracaoState> {
  const arquivo = formData.get('arquivo')
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { error: 'Selecione um arquivo' }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { error: 'Importação por IA não configurada: falta a variável ANTHROPIC_API_KEY no servidor.' }
  }

  const mediaType = arquivo.type || 'image/jpeg'
  const tiposAceitos = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
  if (!tiposAceitos.includes(mediaType)) {
    return { error: 'Formato não suportado. Envie uma foto (JPG/PNG/WEBP) ou um PDF.' }
  }

  const bytes = await arquivo.arrayBuffer()
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
        max_tokens: 500,
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
                text: `Esta imagem é um comprovante, recibo, nota fiscal ou print de pagamento de UMA despesa de um buffet. Leia e responda SOMENTE com um JSON, sem markdown e sem texto antes ou depois, no formato exato:
{"data": "AAAA-MM-DD", "descricao": "descrição curta do que foi comprado/pago", "valor": 0.00}

Se não achar a data no documento, use "${hoje}". Se não conseguir identificar o valor pago com confiança, responda {"error": "motivo em poucas palavras"} em vez do formato acima.`,
              },
            ],
          },
        ],
      }),
    })
  } catch {
    return { error: 'Falha ao conectar com o serviço de IA' }
  }

  if (!resposta.ok) {
    if (resposta.status === 401) return { error: 'Chave da API de IA inválida' }
    return { error: `Erro ao ler o documento (status ${resposta.status})` }
  }

  const json = await resposta.json()
  const texto: string = json.content?.[0]?.text ?? ''

  let extraido: { data?: string; descricao?: string; valor?: number; error?: string }
  try {
    const match = texto.match(/\{[\s\S]*\}/)
    extraido = JSON.parse(match ? match[0] : texto)
  } catch {
    return { error: 'Não consegui interpretar a resposta da IA' }
  }

  if (extraido.error) return { error: extraido.error }
  if (typeof extraido.valor !== 'number' || !extraido.descricao) {
    return { error: 'Não consegui identificar o valor e a descrição no documento' }
  }

  return { data: extraido.data || hoje, descricao: extraido.descricao, valor: extraido.valor }
}
