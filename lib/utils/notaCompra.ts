import type { StatusNotaCompra } from '@/lib/types/domain'

export const STATUS_NOTA_COMPRA_LABEL: Record<StatusNotaCompra, string> = {
  processando: 'Processando...',
  aguardando_aprovacao: 'Aguardando aprovação',
  aprovada: 'Aprovada',
  concluida: 'Concluída no estoque',
  falha_leitura: 'Falha na leitura',
}

export const STATUS_NOTA_COMPRA_BADGE: Record<StatusNotaCompra, string> = {
  processando: 'badge-50pago',
  aguardando_aprovacao: 'badge-50pago',
  aprovada: 'badge-pago',
  concluida: 'badge-pago',
  falha_leitura: 'badge-pendente',
}

// Normaliza o texto de uma linha de nota pra comparar/aprender apelidos
// (estoque_apelidos.texto_normalizado) sem se importar com acento, caixa ou
// pontuação — "2 Un. Farinha 1Kg" e "2 UN FARINHA 1KG" viram a mesma chave.
export function normalizarTextoNota(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
