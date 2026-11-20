// Ordem dos ingredientes de uma ficha técnica: do MAIOR para o MENOR peso líquido; se
// dois ingredientes têm o mesmo peso, vale a ordem alfabética do nome. Linha sem peso
// (não informado) vai para o fim, também em ordem alfabética. Se até o nome empatar,
// mantém a ordem em que as linhas já estavam.
export type ChaveIngrediente = { peso: number | null; nome: string }

// Compara em 6 casas (o banco guarda o peso com 6) para que 0,1 e 0,1000001 não "desempatem" por ruído de ponto flutuante.
const emMilionesimos = (peso: number) => Math.round(peso * 1e6)

export function compararIngredientes(a: ChaveIngrediente, b: ChaveIngrediente): number {
  if (a.peso === null || b.peso === null) {
    if (a.peso !== null) return -1
    if (b.peso !== null) return 1
  } else {
    const diferenca = emMilionesimos(b.peso) - emMilionesimos(a.peso)
    if (diferenca !== 0) return diferenca
  }
  return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base', numeric: true })
}

export function ordenarIngredientes<T>(linhas: T[], chave: (linha: T) => ChaveIngrediente): T[] {
  return linhas
    .map((linha, posicao) => ({ linha, posicao, chave: chave(linha) }))
    .sort((a, b) => compararIngredientes(a.chave, b.chave) || a.posicao - b.posicao)
    .map((x) => x.linha)
}
