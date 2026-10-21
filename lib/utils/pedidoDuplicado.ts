import type { createClient } from '@/lib/supabase/server'

type Supabase = Awaited<ReturnType<typeof createClient>>

// Regra de "possível pedido duplicado" (aviso com confirmação, nunca bloqueio —
// pode haver dois pedidos legítimos pro mesmo cliente):
//   • com data do evento: mesmo cliente + mesma data do evento + mesma hora;
//   • sem data do evento (ainda sem previsão): mesmo cliente + mesma data da
//     venda + mesmo valor — sem data de evento, "dia e hora" não identificam o
//     pedido, então o valor entra pra não alarmar à toa.
// O nome do cliente é comparado sem diferenciar maiúsculas, acentos nem
// espaços repetidos ("João  Silva" = "joao silva").

export type DadosParaDuplicidade = {
  cliente: string
  data_venda: string
  data_evento?: string | null
  hora_evento?: string | null
  valor_total: number
}

export type PedidoDuplicado = {
  numero: number
  cliente: string
  data_venda: string
  data_evento: string | null
  hora_evento: string | null
  valor_total: number
  status: string
}

export function normalizarCliente(nome: string) {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

// Dois pedidos são "o mesmo" quando têm a mesma chave.
export function chaveDuplicidade(d: DadosParaDuplicidade): string {
  const cliente = normalizarCliente(d.cliente)
  const hora = d.hora_evento ? d.hora_evento.slice(0, 5) : ''
  if (d.data_evento) return [cliente, 'evento', d.data_evento, hora].join('|')
  return [cliente, 'venda', d.data_venda, hora, Math.round(Number(d.valor_total) * 100)].join('|')
}

// Procura, no banco, pedidos que batem com `dados`. `ignorarId` tira da busca o
// próprio pedido quando está sendo editado. Se a consulta falhar, devolve vazio:
// a checagem é um aviso e não pode impedir o salvamento.
export async function buscarPedidosDuplicados(
  supabase: Supabase,
  dados: DadosParaDuplicidade,
  ignorarId?: string
): Promise<PedidoDuplicado[]> {
  let consulta = supabase
    .from('pedidos')
    .select('id, numero, cliente, data_venda, data_evento, hora_evento, valor_total, status')
  // Só traz os pedidos do mesmo dia (barato); o nome/hora a gente compara aqui,
  // porque o banco não ignora acento/maiúscula do jeito que precisamos.
  consulta = dados.data_evento
    ? consulta.eq('data_evento', dados.data_evento)
    : consulta.is('data_evento', null).eq('data_venda', dados.data_venda)
  if (ignorarId) consulta = consulta.neq('id', ignorarId)

  const { data, error } = await consulta
  if (error || !data) return []

  const chave = chaveDuplicidade(dados)
  return data
    .filter((pedido) => chaveDuplicidade(pedido) === chave)
    .map(({ numero, cliente, data_venda, data_evento, hora_evento, valor_total, status }) => ({
      numero,
      cliente,
      data_venda,
      data_evento,
      hora_evento,
      valor_total,
      status,
    }))
}
