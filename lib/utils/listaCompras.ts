import * as XLSX from 'xlsx'
import type { EstoqueItem } from '@/lib/types/domain'
import { formatCurrency } from '@/lib/utils/format'

export type ItemParaComprar = EstoqueItem & { qtdComprar: number }

// Quantidade a comprar (mínimo - atual) com 2 casas decimais. O estoque guarda
// até 3 casas, então a conta é feita em MILÉSIMOS (números inteiros): subtrair
// decimais direto dá resíduo de ponto flutuante (1 - 0,95 = 0,05000000000000004)
// e arredondar com Math.round(x * 100) erra casos como 2,675 (vira 2,67). Em
// inteiros o arredondamento é exato (2675 milésimos -> 268 centésimos).
export function quantidadeAComprar(minima: number, atual: number): number {
  const milesimos = Math.round(minima * 1000) - Math.round(atual * 1000)
  return Math.round(milesimos / 10) / 100
}

// "1,25 KG", "0,05 L", "10,00 UND" — sempre 2 casas, vírgula decimal.
export function formatarQuantidade(quantidade: number, unidade: string): string {
  const numero = quantidade.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${numero} ${unidade}`
}

// Mesmo critério de "estoque baixo" da tabela principal (flag ESTOQUE BAIXO em
// EstoqueClient): abaixo do mínimo, não igual a ele.
export function itensParaComprar(itens: EstoqueItem[]): ItemParaComprar[] {
  return itens
    .filter((item) => item.quantidade_atual < item.quantidade_minima)
    .map((item) => ({ ...item, qtdComprar: quantidadeAComprar(item.quantidade_minima, item.quantidade_atual) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

// Gera o mesmo conteúdo da tabela em tela como um arquivo .xlsx de verdade
// (não um .csv disfarçado) — usa a biblioteca SheetJS instalada a partir do
// tarball oficial deles (cdn.sheetjs.com), não do pacote "xlsx" do registro
// do npm: a versão do registro está travada numa release antiga com duas
// vulnerabilidades altas sem correção (prototype pollution e ReDoS); o
// próprio SheetJS recomenda instalar direto do CDN deles por causa disso.
export function gerarArquivoExcel(itens: ItemParaComprar[]): Blob {
  const linhas = itens.map((item) => ({
    'Qtd.': formatarQuantidade(item.qtdComprar, item.unidade_medida),
    'Nome do produto': item.nome,
    'Marca/Fornecedor': item.marca_fornecedor ?? '-',
    'Preço corrente': item.preco_corrente != null ? formatCurrency(item.preco_corrente) : '-',
  }))
  const planilha = XLSX.utils.json_to_sheet(linhas)
  planilha['!cols'] = [{ wch: 14 }, { wch: 32 }, { wch: 22 }, { wch: 16 }]
  const livro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(livro, planilha, 'Lista de compras')
  const arrayBuffer = XLSX.write(livro, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
