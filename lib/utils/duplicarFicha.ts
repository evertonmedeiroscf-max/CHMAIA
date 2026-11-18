import type { FichaTecnica, FichaTecnicaIngrediente, TipoFicha } from '@/lib/types/domain'

// Nome comparável: sem acento, sem diferença de maiúsculas/minúsculas e sem
// espaços sobrando ("Bolo  da Moça " = "BOLO DA MOCA").
export function normalizarNomeFicha(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

// Fichas que já têm esse nome NO MESMO TIPO. Mesmo nome em tipos diferentes é
// normal (ex.: a Base "ARRUMADINHO" e a Finalização "ARRUMADINHO"), por isso não conta.
export function fichasComMesmoNome<T extends { nome: string; tipo: string }>(fichas: T[], nome: string, tipo: TipoFicha): T[] {
  const alvo = normalizarNomeFicha(nome)
  return fichas.filter((f) => f.tipo === tipo && normalizarNomeFicha(f.nome) === alvo)
}

export type CopiaFicha = {
  cabecalho: {
    tipo: TipoFicha
    nome: string
    rendimento_kg: number | null
    markup: number | null
    serve: number | null
    data_atualizacao: null
    modo_preparo: string | null
  }
  // Linhas sem `ficha_id`: quem grava coloca o id da ficha nova.
  linhas: Omit<FichaTecnicaIngrediente, 'id' | 'ficha_id'>[]
}

// Monta a cópia de uma ficha: TODOS os ingredientes (do jeito que estão, inclusive
// as pendências "sem origem") e o modo de preparo. Do cabeçalho só vai o que
// pertence ao tipo da cópia, e só quando o tipo não mudou:
//  - rendimento: a Base exige um valor (vem da tela, nunca é assumido);
//  - markup e "serve": copiados só de Finalização para Finalização;
//  - data de atualização: fica em branco (é uma ficha nova, o sistema não inventa data).
export function montarCopiaFicha(
  origem: Pick<FichaTecnica, 'tipo' | 'markup' | 'serve' | 'modo_preparo'>,
  linhas: FichaTecnicaIngrediente[],
  nova: { nome: string; tipo: TipoFicha; rendimentoKg: number | null }
): CopiaFicha {
  const mesmoTipo = origem.tipo === nova.tipo
  return {
    cabecalho: {
      tipo: nova.tipo,
      nome: nova.nome.trim(),
      rendimento_kg: nova.tipo === 'bases' ? nova.rendimentoKg : null,
      markup: nova.tipo === 'finalizacao' && mesmoTipo ? origem.markup : null,
      serve: nova.tipo === 'finalizacao' && mesmoTipo ? origem.serve : null,
      data_atualizacao: null,
      modo_preparo: origem.modo_preparo,
    },
    linhas: [...linhas]
      .sort((a, b) => a.ordem - b.ordem)
      .map((l) => ({
        ordem: l.ordem,
        estoque_item_id: l.estoque_item_id,
        ficha_ingrediente_id: l.ficha_ingrediente_id,
        ingrediente_origem: l.ingrediente_origem,
        sem_origem: l.sem_origem,
        sem_origem_motivo: l.sem_origem_motivo,
        observacao: l.observacao,
        peso_liquido: l.peso_liquido,
        fc: l.fc,
        medida_caseira: l.medida_caseira,
      })),
  }
}
