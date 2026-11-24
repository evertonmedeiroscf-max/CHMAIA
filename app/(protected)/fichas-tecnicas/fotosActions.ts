'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { ehJpeg, MAX_FOTOS, MAX_LEGENDA, POSICAO_FOTO_TITULO, posicaoValida, reordenarFotos } from '@/lib/utils/fichaFotos'

// Fotos da ficha técnica (produto finalizado no topo, passo a passo depois do modo de preparo).
// O arquivo vai para o bucket PRIVADO `fichas-fotos` com nome opaco (uuid.jpg, nunca o nome do prato);
// quem vê a foto recebe um link temporário gerado no servidor. A tela reduz a foto para JPEG antes de
// enviar; aqui o conteúdo é conferido de novo (não dá para confiar só no que a tela diz).

export type ResultadoFoto = { error: string } | { success: true }

const BUCKET = 'fichas-fotos'
// Mesmo teto do bucket. A foto já chega reduzida (centenas de KB), isto é só uma trava.
const TAMANHO_MAXIMO = 4 * 1024 * 1024
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function mensagemDoBanco(error: { code?: string; message: string }): string {
  if (error.code === '42501') return 'Você não tem acesso à aba Fichas técnicas.'
  if (error.code === '23503') return 'A ficha não existe mais (ela pode ter sido excluída).'
  // O trigger do limite já devolve um texto em português ("Limite de 2 foto(s) ...").
  return error.message
}

export async function enviarFotoFicha(formData: FormData): Promise<ResultadoFoto> {
  const fichaId = String(formData.get('ficha_id') ?? '')
  const posicao = formData.get('posicao')
  const arquivo = formData.get('arquivo')
  const legendaBruta = String(formData.get('legenda') ?? '').trim()

  if (!UUID.test(fichaId)) return { error: 'Ficha inválida.' }
  if (!posicaoValida(posicao)) return { error: 'Posição da foto inválida.' }
  if (!(arquivo instanceof File) || arquivo.size === 0) return { error: 'Selecione uma foto.' }
  if (arquivo.size > TAMANHO_MAXIMO) return { error: 'A foto ficou grande demais (acima de 4 MB). Tente outra foto.' }
  if (legendaBruta.length > MAX_LEGENDA) return { error: `A legenda pode ter no máximo ${MAX_LEGENDA} caracteres.` }
  // Foto do produto não tem legenda (só as do passo a passo).
  const legenda = posicao === 'passo' && legendaBruta ? legendaBruta : null

  const bytes = new Uint8Array(await arquivo.arrayBuffer())
  if (!ehJpeg(bytes)) return { error: 'O arquivo enviado não é uma foto válida.' }

  const supabase = await createClient()

  // Confere o limite antes de gastar um envio (o banco também barra, por segurança).
  const { count, error: erroContagem } = await supabase
    .from('fichas_fotos')
    .select('id', { count: 'exact', head: true })
    .eq('ficha_id', fichaId)
    .eq('posicao', posicao)
  if (erroContagem) return { error: mensagemDoBanco(erroContagem) }
  if ((count ?? 0) >= MAX_FOTOS[posicao]) {
    return { error: `Esta ficha já tem o máximo de ${MAX_FOTOS[posicao]} foto(s): ${POSICAO_FOTO_TITULO[posicao].toLowerCase()}.` }
  }

  const { data: ultima } = await supabase
    .from('fichas_fotos')
    .select('ordem')
    .eq('ficha_id', fichaId)
    .eq('posicao', posicao)
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()

  const caminho = `${randomUUID()}.jpg`
  const { error: erroUpload } = await supabase.storage.from(BUCKET).upload(caminho, bytes, { contentType: 'image/jpeg' })
  if (erroUpload) return { error: `Falha ao salvar a foto: ${erroUpload.message}` }

  const { error: erroInsert } = await supabase
    .from('fichas_fotos')
    .insert({ ficha_id: fichaId, posicao, ordem: (ultima?.ordem ?? 0) + 1, arquivo_path: caminho, legenda })
  if (erroInsert) {
    // Não deixa arquivo órfão no Storage.
    await supabase.storage.from(BUCKET).remove([caminho])
    return { error: mensagemDoBanco(erroInsert) }
  }

  revalidatePath(`/fichas-tecnicas/${fichaId}`)
  return { success: true }
}

export async function atualizarLegendaFoto(id: string, legenda: string): Promise<ResultadoFoto> {
  if (!UUID.test(id)) return { error: 'Foto inválida.' }
  const texto = legenda.trim()
  if (texto.length > MAX_LEGENDA) return { error: `A legenda pode ter no máximo ${MAX_LEGENDA} caracteres.` }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fichas_fotos')
    .update({ legenda: texto || null })
    .eq('id', id)
    .select('ficha_id')
  if (error) return { error: mensagemDoBanco(error) }
  if (!data || data.length === 0) return { error: 'Essa foto não existe mais.' }

  revalidatePath(`/fichas-tecnicas/${data[0].ficha_id}`)
  return { success: true }
}

// Troca a foto de lugar com a vizinha (antes/depois) dentro da mesma posição da ficha.
export async function moverFotoFicha(id: string, direcao: 'antes' | 'depois'): Promise<ResultadoFoto> {
  if (!UUID.test(id) || (direcao !== 'antes' && direcao !== 'depois')) return { error: 'Pedido inválido.' }

  const supabase = await createClient()
  const { data: foto, error } = await supabase.from('fichas_fotos').select('id, ficha_id, posicao').eq('id', id).maybeSingle()
  if (error) return { error: mensagemDoBanco(error) }
  if (!foto) return { error: 'Essa foto não existe mais.' }

  const { data: irmas, error: erroIrmas } = await supabase
    .from('fichas_fotos')
    .select('id, ordem')
    .eq('ficha_id', foto.ficha_id)
    .eq('posicao', foto.posicao)
    .order('ordem', { ascending: true })
    .order('created_at', { ascending: true })
  if (erroIrmas) return { error: mensagemDoBanco(erroIrmas) }

  const nova = reordenarFotos(irmas ?? [], id, direcao)
  if (!nova) return { success: true } // já está na ponta: nada a mexer
  const antiga = new Map((irmas ?? []).map((f) => [f.id, f.ordem]))
  for (const item of nova) {
    if (antiga.get(item.id) === item.ordem) continue
    const { error: erroUpdate } = await supabase.from('fichas_fotos').update({ ordem: item.ordem }).eq('id', item.id)
    if (erroUpdate) return { error: mensagemDoBanco(erroUpdate) }
  }

  revalidatePath(`/fichas-tecnicas/${foto.ficha_id}`)
  return { success: true }
}

export async function excluirFotoFicha(id: string): Promise<ResultadoFoto> {
  if (!UUID.test(id)) return { error: 'Foto inválida.' }

  const supabase = await createClient()
  const { data: foto, error } = await supabase.from('fichas_fotos').select('ficha_id, arquivo_path').eq('id', id).maybeSingle()
  if (error) return { error: mensagemDoBanco(error) }
  if (!foto) return { error: 'Essa foto não existe mais.' }

  const { data: apagadas, error: erroDelete } = await supabase.from('fichas_fotos').delete().eq('id', id).select('id')
  if (erroDelete) return { error: mensagemDoBanco(erroDelete) }
  if (!apagadas || apagadas.length === 0) return { error: 'Essa foto não existe mais.' }

  // O arquivo só some do Storage depois de a linha sair do banco. Se esta parte falhar, sobra um arquivo
  // sem uso (não aparece em lugar nenhum), nunca uma ficha apontando para foto inexistente.
  const { error: erroArquivo } = await supabase.storage.from(BUCKET).remove([foto.arquivo_path])
  if (erroArquivo) console.error('[fichas-fotos] foto removida do banco, mas o arquivo ficou no Storage:', erroArquivo.message)

  revalidatePath(`/fichas-tecnicas/${foto.ficha_id}`)
  return { success: true }
}
