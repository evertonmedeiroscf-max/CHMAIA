'use client'

import { useEffect, useRef } from 'react'

// Regras de página das listas paginadas (15 por página), em um lugar só:
//
// 1. Volta para a página 1 SÓ quando o usuário muda um filtro (`filtros`).
//    Antes, o reset dependia da lista filtrada — que é uma lista nova toda vez
//    que os dados recarregam —, então salvar a edição de um item jogava o
//    usuário de volta para a página 1. Agora, depois de editar, a lista
//    continua na mesma página.
// 2. Se a lista encolher e a página atual deixar de existir (ex.: excluiu o
//    último item da última página), vai para a última página que existe.
// 3. `chaveArmazenamento` (opcional): lembra a página na sessão do navegador.
//    Serve para listas em que editar ABRE OUTRA TELA (ex.: Fichas técnicas) —
//    ao voltar, a lista remonta e retoma a página em que estava.
//
// Chame depois de calcular `totalPaginas`. `filtros` deve ter sempre o mesmo
// tamanho (os valores dos estados de filtro, na mesma ordem).
export function useAjustarPagina({
  paginaAtual,
  setPaginaAtual,
  totalPaginas,
  filtros,
  chaveArmazenamento,
}: {
  paginaAtual: number
  setPaginaAtual: (pagina: number) => void
  totalPaginas: number
  filtros: unknown[]
  chaveArmazenamento?: string
}) {
  // Compara com os filtros do render anterior (e não "pula a primeira vez"),
  // porque o modo estrito do React roda os efeitos duas vezes ao montar.
  // As regras 1 e 2 ficam NO MESMO efeito e nesta ordem: se um filtro mudou,
  // vale a página 1 — separadas, a correção da regra 2 (feita com a página
  // antiga, ainda maior que o novo total) desfazia o reset e a lista parava
  // na última página em vez da primeira.
  const filtrosAnteriores = useRef(filtros)
  useEffect(() => {
    const mudou = filtros.some((valor, i) => !Object.is(valor, filtrosAnteriores.current[i]))
    filtrosAnteriores.current = filtros
    if (mudou) {
      setPaginaAtual(1)
      return
    }
    if (paginaAtual > totalPaginas) setPaginaAtual(totalPaginas)
  })

  // Retoma a página guardada (só ao montar).
  useEffect(() => {
    if (!chaveArmazenamento) return
    try {
      const salva = Number(window.sessionStorage.getItem(chaveArmazenamento))
      if (Number.isInteger(salva) && salva > 1) setPaginaAtual(salva)
    } catch {
      // sessionStorage indisponível (modo privado): a lista só começa na página 1
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveArmazenamento])

  useEffect(() => {
    if (!chaveArmazenamento) return
    try {
      window.sessionStorage.setItem(chaveArmazenamento, String(paginaAtual))
    } catch {
      // a página simplesmente não é lembrada
    }
  }, [chaveArmazenamento, paginaAtual])
}
