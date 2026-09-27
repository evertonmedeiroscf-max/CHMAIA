// Faturamento mensal (valor vendido) anterior ao sistema, transcrito da
// planilha "Faturamento_ChefHilanaMaia_2024-2026.xlsx" (fonte: caderno de
// anotações). Índice 0 = janeiro. `null` = mês sem lançamento na planilha —
// nesses meses o Resumo anual usa os pedidos cadastrados no sistema.
// Para corrigir um valor antigo, edite aqui; meses novos entram sozinhos
// pelo sistema, não precisam ser adicionados.
export const FATURAMENTO_HISTORICO: Record<number, { valores: (number | null)[]; pedidos?: (number | null)[] }> = {
  2024: {
    valores: [38643, 28272, 39133, 79873, 55359, 53927, 50848, 86608, 36252, 47980, 43503, 153389],
  },
  2025: {
    valores: [28672, 34989, 37690, 32258, 50387, 54504, 64846, 52361, 55472, 49283, 65759, 159375],
  },
  2026: {
    valores: [32799, 98407.3, 125675.4, 123744, 125583, 50451, 73039.5, 117812.5, 58000, null, null, null],
    pedidos: [29, 32, 52, 37, 50, 68, 65, 60, 60, null, null, null],
  },
}
