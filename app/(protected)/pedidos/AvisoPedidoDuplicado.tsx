import type { PedidoDuplicado } from '@/lib/utils/pedidoDuplicado'
import { formatCurrency, formatDateBR } from '@/lib/utils/format'

const STATUS_PEDIDO_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  '50% pago': '50% pago',
  pago: 'Pago',
}

// Aviso mostrado no formulário de pedido quando já existe pedido do mesmo
// cliente, no mesmo dia e hora (ver lib/utils/pedidoDuplicado.ts). Quem decide
// é o usuário: "Salvar mesmo assim" ou cancelar/corrigir.
export default function AvisoPedidoDuplicado({ duplicados }: { duplicados: PedidoDuplicado[] }) {
  const varios = duplicados.length > 1
  return (
    <div className="alerta-duplicado" role="alert">
      <strong>⚠ Possível pedido duplicado</strong>
      <p>
        {varios ? 'Já existem pedidos' : 'Já existe um pedido'} do mesmo cliente no mesmo dia e hora:
      </p>
      <ul>
        {duplicados.map((p) => {
          const dia = p.data_evento ?? p.data_venda
          const hora = p.hora_evento ? ` às ${p.hora_evento.slice(0, 5)}` : ''
          return (
            <li key={p.numero}>
              <strong>Pedido nº {p.numero}</strong> — {p.cliente} — {p.data_evento ? 'evento' : 'venda'} em{' '}
              {formatDateBR(dia)}
              {hora} — {formatCurrency(p.valor_total)} — {STATUS_PEDIDO_LABEL[p.status] ?? p.status}
            </li>
          )
        })}
      </ul>
      <p>
        Se for outro pedido mesmo, clique em <strong>Salvar mesmo assim</strong>. Se foi engano, clique em{' '}
        <strong>Cancelar</strong> ou corrija os dados acima.
      </p>
    </div>
  )
}
