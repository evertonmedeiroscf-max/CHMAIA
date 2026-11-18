'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { FichaTecnica, FichaTecnicaIngrediente, TipoFicha } from '@/lib/types/domain'
import { fichasComMesmoNome, montarCopiaFicha } from '@/lib/utils/duplicarFicha'
import { duplicarFichaSchema, fichaTecnicaSchema } from '@/lib/validations/fichaTecnica'

export type ResultadoFicha = { error: string } | { id: string }

export type FichaMesmoNome = { id: string; nome: string; tipo: TipoFicha }
// `duplicadas` preenchido = NADA foi gravado: já existe ficha com esse nome e tipo;
// a tela mostra o aviso e, se a pessoa confirmar, chama de novo com `confirmar_duplicada`.
export type ResultadoDuplicar = { error: string } | { duplicadas: FichaMesmoNome[] } | { id: string }

// Duplica uma ficha: cria uma ficha NOVA (nome e tipo escolhidos) com os mesmos
// ingredientes e o mesmo modo de preparo. A ficha de origem não é alterada.
export async function duplicarFichaTecnica(origemId: string, dados: unknown): Promise<ResultadoDuplicar> {
  const parsed = duplicarFichaSchema.safeParse(dados)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  const { nome, tipo, rendimento_kg, confirmar_duplicada } = parsed.data

  const supabase = await createClient()

  const { data: origem, error: erroOrigem } = await supabase.from('fichas_tecnicas').select('*').eq('id', origemId).maybeSingle()
  if (erroOrigem) return { error: erroOrigem.message }
  if (!origem) return { error: 'A ficha que você quer duplicar não existe mais (ela pode ter sido excluída).' }

  // Já existe uma ficha com esse nome e tipo? Avisa ANTES de gravar qualquer coisa.
  if (!confirmar_duplicada) {
    const mesmoTipo: FichaMesmoNome[] = []
    for (let inicio = 0; ; inicio += 1000) {
      const { data, error } = await supabase
        .from('fichas_tecnicas')
        .select('id, nome, tipo')
        .eq('tipo', tipo)
        .order('id')
        .range(inicio, inicio + 999)
      if (error) return { error: error.message }
      const pagina = (data ?? []) as FichaMesmoNome[]
      mesmoTipo.push(...pagina)
      if (pagina.length < 1000) break
    }
    const duplicadas = fichasComMesmoNome(mesmoTipo, nome, tipo)
    if (duplicadas.length > 0) return { duplicadas }
  }

  const { data: linhasOrigem, error: erroLinhas } = await supabase
    .from('fichas_tecnicas_ingredientes')
    .select('*')
    .eq('ficha_id', origemId)
    .order('ordem')
  if (erroLinhas) return { error: erroLinhas.message }

  const copia = montarCopiaFicha(origem as FichaTecnica, (linhasOrigem ?? []) as FichaTecnicaIngrediente[], { nome, tipo, rendimentoKg: rendimento_kg })

  const { data: nova, error: erroNova } = await supabase.from('fichas_tecnicas').insert(copia.cabecalho).select('id').single()
  if (erroNova || !nova) return { error: erroNova?.message ?? 'Não foi possível criar a nova ficha.' }

  if (copia.linhas.length > 0) {
    const { error } = await supabase.from('fichas_tecnicas_ingredientes').insert(copia.linhas.map((l) => ({ ...l, ficha_id: nova.id })))
    if (error) {
      // Sem as linhas a cópia ficaria pela metade: desfaz a criação.
      await supabase.from('fichas_tecnicas').delete().eq('id', nova.id)
      return { error: `Não foi possível copiar os ingredientes: ${error.message}` }
    }
  }

  revalidatePath('/fichas-tecnicas')
  return { id: nova.id }
}

// Cria (id = null) ou atualiza uma ficha técnica de preparo e todas as linhas de
// ingredientes dela. O supabase-js não tem transação, então a ordem das
// gravações é pensada para nunca perder dados: grava/atualiza as linhas novas
// ANTES de apagar as que saíram da ficha.
export async function salvarFichaTecnica(id: string | null, dados: unknown): Promise<ResultadoFicha> {
  const parsed = fichaTecnicaSchema.safeParse(dados)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }

  const { ingredientes, tipo, ...resto } = parsed.data
  const supabase = await createClient()

  // O tipo (Base/Finalização) nunca muda depois de criada; na edição vale o do banco.
  let tipoFicha = tipo
  if (id) {
    const { data: atual, error: erroLeitura } = await supabase.from('fichas_tecnicas').select('tipo').eq('id', id).maybeSingle()
    if (erroLeitura) return { error: erroLeitura.message }
    if (!atual) return { error: 'Ficha não encontrada (ela pode ter sido excluída).' }
    tipoFicha = atual.tipo as typeof tipo
  }

  // Cada tipo guarda só os campos dele (Base: rendimento; Finalização: markup e serve).
  const cabecalho = {
    nome: resto.nome,
    data_atualizacao: resto.data_atualizacao,
    modo_preparo: resto.modo_preparo,
    rendimento_kg: tipoFicha === 'bases' ? resto.rendimento_kg : null,
    markup: tipoFicha === 'finalizacao' ? resto.markup : null,
    serve: tipoFicha === 'finalizacao' ? resto.serve : null,
  }

  // Ingrediente que é outra ficha: só Base, e nunca formando ciclo (A usa B e B usa A).
  const alvosFicha = [...new Set(ingredientes.flatMap((l) => (l.ficha_ingrediente_id ? [l.ficha_ingrediente_id] : [])))]
  if (alvosFicha.length > 0) {
    if (id && alvosFicha.includes(id)) return { error: 'Uma ficha não pode usar ela mesma como ingrediente.' }
    const { data: alvos } = await supabase.from('fichas_tecnicas').select('id, nome, tipo').in('id', alvosFicha)
    if ((alvos ?? []).length !== alvosFicha.length) return { error: 'Uma das fichas escolhidas como ingrediente não existe mais.' }
    const naoBase = (alvos ?? []).find((a) => a.tipo !== 'bases')
    if (naoBase) return { error: `"${naoBase.nome}" não é uma ficha de Base — só Bases podem ser ingrediente.` }

    if (id) {
      const { data: arestas } = await supabase
        .from('fichas_tecnicas_ingredientes')
        .select('ficha_id, ficha_ingrediente_id')
        .not('ficha_ingrediente_id', 'is', null)
      const proximos = new Map<string, string[]>()
      for (const a of arestas ?? []) {
        if (a.ficha_id === id || !a.ficha_ingrediente_id) continue // as linhas desta ficha estão sendo substituídas
        proximos.set(a.ficha_id, [...(proximos.get(a.ficha_id) ?? []), a.ficha_ingrediente_id])
      }
      const visitados = new Set<string>()
      const alcanca = (de: string): boolean => {
        if (de === id) return true
        if (visitados.has(de)) return false
        visitados.add(de)
        return (proximos.get(de) ?? []).some(alcanca)
      }
      const ciclo = (alvos ?? []).find((a) => alcanca(a.id))
      if (ciclo) return { error: `A ficha "${ciclo.nome}" já usa esta ficha como ingrediente — isso criaria um ciclo.` }
    }
  }

  let fichaId = id
  if (id) {
    const { data, error } = await supabase.from('fichas_tecnicas').update(cabecalho).eq('id', id).select('id').maybeSingle()
    if (error) return { error: error.message }
    if (!data) return { error: 'Ficha não encontrada (ela pode ter sido excluída).' }
  } else {
    const { data, error } = await supabase.from('fichas_tecnicas').insert({ ...cabecalho, tipo: tipoFicha }).select('id').single()
    if (error || !data) return { error: error?.message ?? 'Não foi possível salvar a ficha.' }
    fichaId = data.id
  }
  if (!fichaId) return { error: 'Não foi possível salvar a ficha.' }

  // Só aceita ids de linha que realmente pertencem a ESTA ficha (um id de outra
  // ficha viraria "mover linha" por engano); qualquer outro vira linha nova.
  const { data: atuais } = await supabase.from('fichas_tecnicas_ingredientes').select('id').eq('ficha_id', fichaId)
  const idsAtuais = new Set((atuais ?? []).map((l) => l.id))

  const linhas = ingredientes.map((linha, i) => ({
    id: linha.id && idsAtuais.has(linha.id) ? linha.id : undefined,
    ficha_id: fichaId,
    ordem: i + 1,
    estoque_item_id: linha.estoque_item_id,
    ficha_ingrediente_id: linha.ficha_ingrediente_id,
    ingrediente_origem: linha.ingrediente_origem,
    sem_origem: linha.sem_origem,
    sem_origem_motivo: linha.sem_origem_motivo,
    observacao: linha.observacao,
    peso_liquido: linha.peso_liquido,
    fc: linha.fc,
    medida_caseira: linha.medida_caseira,
  }))
  const existentes = linhas.flatMap(({ id: linhaId, ...resto }) => (linhaId ? [{ id: linhaId, ...resto }] : []))
  const novas = linhas.flatMap(({ id: linhaId, ...resto }) => (linhaId ? [] : [resto]))

  const desfazerCriacao = async () => {
    if (!id) await supabase.from('fichas_tecnicas').delete().eq('id', fichaId)
  }

  if (existentes.length > 0) {
    const { error } = await supabase.from('fichas_tecnicas_ingredientes').upsert(existentes)
    if (error) {
      await desfazerCriacao()
      return { error: error.message }
    }
  }
  if (novas.length > 0) {
    const { error } = await supabase.from('fichas_tecnicas_ingredientes').insert(novas)
    if (error) {
      await desfazerCriacao()
      return { error: error.message }
    }
  }

  // Por último, tira as linhas que o usuário removeu da ficha.
  const idsMantidos = new Set(existentes.map((l) => l.id))
  const idsRemovidos = [...idsAtuais].filter((linhaId) => !idsMantidos.has(linhaId))
  if (idsRemovidos.length > 0) {
    const { error } = await supabase.from('fichas_tecnicas_ingredientes').delete().in('id', idsRemovidos)
    if (error) return { error: `Ficha salva, mas não consegui remover linhas antigas: ${error.message}` }
  }

  revalidatePath('/fichas-tecnicas')
  revalidatePath(`/fichas-tecnicas/${fichaId}`)
  return { id: fichaId }
}

export async function excluirFichaTecnica(id: string): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('fichas_tecnicas').delete().eq('id', id).select('id')
  if (error) {
    // A ficha é ingrediente de outra (vínculo Base -> Finalização, "restrict").
    if (error.message.includes('fichas_tecnicas_ingredientes')) {
      return { error: 'Esta ficha é usada como ingrediente em outras fichas e não pode ser excluída. Tire-a das outras fichas antes.' }
    }
    return { error: error.message }
  }
  if (!data || data.length === 0) return { error: 'Ficha não encontrada ou sem permissão para excluir.' }

  revalidatePath('/fichas-tecnicas')
  return { success: true }
}
