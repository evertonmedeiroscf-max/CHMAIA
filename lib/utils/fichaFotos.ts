// Fotos da ficha técnica. Duas posições fixas, iguais na tela e na impressão de uma folha A4:
//  - 'produto' = produto finalizado, na parte SUPERIOR da ficha (1 ou 2 fotos);
//  - 'passo'   = passo a passo, na parte INFERIOR, depois do modo de preparo (com legenda opcional).
// Só regras e contas (sem banco nem tela), para poderem ser testadas.

export const POSICOES_FOTO = ['produto', 'passo'] as const
export type PosicaoFoto = (typeof POSICOES_FOTO)[number]

// Os mesmos limites estão no banco (trigger fichas_fotos_limite, migração 0032).
export const MAX_FOTOS: Record<PosicaoFoto, number> = { produto: 2, passo: 12 }
export const MAX_LEGENDA = 80

export const POSICAO_FOTO_TITULO: Record<PosicaoFoto, string> = {
  produto: 'Produto finalizado (parte superior da ficha)',
  passo: 'Passo a passo (depois do modo de preparo)',
}

// Foto já pronta para mostrar: `url` é um link temporário gerado no servidor (null = não foi possível gerar).
export type FotoFicha = {
  id: string
  posicao: PosicaoFoto
  ordem: number
  legenda: string | null
  url: string | null
}

// Nome do arquivo no Storage: sempre um uuid opaco + .jpg (nunca o nome do prato). A mesma regra vale
// na policy do bucket.
export const CAMINHO_FOTO_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/

export function posicaoValida(valor: unknown): valor is PosicaoFoto {
  return typeof valor === 'string' && (POSICOES_FOTO as readonly string[]).includes(valor)
}

// A foto sempre é enviada já reduzida, como JPEG (começa com FF D8 FF). Confere o conteúdo, não só o nome.
export function ehJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
}

// Separa por posição, cada uma na ordem em que foi organizada.
export function separarFotos(fotos: FotoFicha[]): Record<PosicaoFoto, FotoFicha[]> {
  const ordenar = (a: FotoFicha, b: FotoFicha) => a.ordem - b.ordem
  return {
    produto: fotos.filter((f) => f.posicao === 'produto').sort(ordenar),
    passo: fotos.filter((f) => f.posicao === 'passo').sort(ordenar),
  }
}

// Colunas da grade de fotos do passo a passo na folha: até 4 fotos numa linha; de 5 a 8, 4 por linha;
// acima disso, 5 por linha (12 fotos = 3 linhas).
export function colunasGradeFotos(quantidade: number): number {
  if (quantidade <= 0) return 1
  if (quantidade <= 4) return quantidade
  if (quantidade <= 8) return 4
  return 5
}

export function linhasGradeFotos(quantidade: number): number {
  return quantidade <= 0 ? 0 : Math.ceil(quantidade / colunasGradeFotos(quantidade))
}

// Troca a foto de lugar com a vizinha (para a esquerda/antes ou direita/depois) e devolve a nova ordem
// 1..n de TODAS as fotos da posição — o que também arruma ordens repetidas ou com buracos.
// `null` = não há como mover (já está na ponta, ou a foto não existe).
export function reordenarFotos(
  fotos: Array<{ id: string; ordem: number }>,
  id: string,
  direcao: 'antes' | 'depois'
): Array<{ id: string; ordem: number }> | null {
  const lista = [...fotos].sort((a, b) => a.ordem - b.ordem)
  const i = lista.findIndex((f) => f.id === id)
  const j = direcao === 'antes' ? i - 1 : i + 1
  if (i < 0 || j < 0 || j >= lista.length) return null
  ;[lista[i], lista[j]] = [lista[j], lista[i]]
  return lista.map((f, k) => ({ id: f.id, ordem: k + 1 }))
}
