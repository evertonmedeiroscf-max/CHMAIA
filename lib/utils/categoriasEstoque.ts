import { CATEGORIAS_ESTOQUE } from '@/lib/types/domain'

// Categorias do Estoque: as 7 de sempre (CATEGORIAS_ESTOQUE) + qualquer categoria nova
// que alguém já tenha digitado ao cadastrar um item. A lista não é guardada à parte: ela
// é calculada a partir dos itens, então uma categoria some sozinha quando o último item
// que a usava muda de categoria (a não ser as 7 de sempre, que ficam sempre disponíveis).

// Texto limpo: sem espaços nas pontas e sem espaços duplos no meio.
export function limparNomeCategoria(nome: string): string {
  return nome.replace(/\s+/g, ' ').trim()
}

// Chave de comparação: "Bebidas", "bebidas" e "BEBÍDAS" são a mesma categoria.
export function chaveCategoria(nome: string): string {
  return limparNomeCategoria(nome)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

// Categorias disponíveis, em ordem alfabética, sem repetir. Quando a mesma categoria
// aparece com grafias diferentes, vale a das 7 de sempre; senão, a primeira que aparecer.
export function listarCategoriasEstoque(usadas: string[]): string[] {
  const porChave = new Map<string, string>()
  for (const nome of [...CATEGORIAS_ESTOQUE, ...usadas]) {
    const limpo = limparNomeCategoria(nome)
    if (!limpo) continue
    const chave = chaveCategoria(limpo)
    if (!porChave.has(chave)) porChave.set(chave, limpo)
  }
  return [...porChave.values()].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
}

// Se já existe uma categoria igual (ignorando acento e maiúsculas), devolve a grafia que
// já existe; senão, o nome digitado (limpo). Evita criar "bebidas" ao lado de "Bebidas".
export function resolverCategoria(digitado: string, existentes: string[]): string {
  const limpo = limparNomeCategoria(digitado)
  const chave = chaveCategoria(limpo)
  return existentes.find((e) => chaveCategoria(e) === chave) ?? limpo
}
