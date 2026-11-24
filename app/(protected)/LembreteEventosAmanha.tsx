'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Modal from '@/components/Modal'
import { formatCurrency, formatDateBR } from '@/lib/utils/format'
import {
  nomeDiaSemana,
  pedidoPedeAtencao,
  resumirEventos,
  STATUS_EVENTO_BADGE,
  STATUS_EVENTO_LABEL,
  type EventoAmanha,
} from '@/lib/utils/eventosAmanha'

// Lembrete em pop-up da situação financeira dos eventos do DIA SEGUINTE (ex.: no dia 12/11 mostra os
// eventos do dia 13/11 e se estão pagos, com pagamento parcial ou pendentes).
//  - Só abre quando há evento amanhã; sem evento, nada aparece.
//  - Abre uma vez por dia em cada aba/sessão: depois de fechado não volta até o usuário entrar de
//    novo (ou abrir o sistema em outra aba). A lista completa continua no calendário de Pedidos.
//  - Quem decide se a pessoa pode ver (acesso a Pedidos) é o layout, no servidor.
export default function LembreteEventosAmanha({
  usuarioId,
  dataAmanha,
  eventos,
}: {
  usuarioId: string
  dataAmanha: string
  eventos: EventoAmanha[]
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const chave = `chmaia:lembrete-eventos-amanha:${usuarioId}:${dataAmanha}`

  // Decide no navegador (nunca na renderização do servidor) para não dar diferença de hidratação.
  useEffect(() => {
    if (eventos.length === 0) return
    let jaMostrado = false
    try {
      jaMostrado = window.sessionStorage.getItem(chave) === '1'
    } catch {
      // Sem acesso ao armazenamento do navegador: mostra mesmo assim (uma vez por carregamento).
    }
    if (!jaMostrado) setAberto(true)
  }, [chave, eventos.length])

  function fechar() {
    setAberto(false)
    try {
      window.sessionStorage.setItem(chave, '1')
    } catch {
      // ignora: no máximo o aviso reaparece ao recarregar a página
    }
  }

  useEffect(() => {
    if (!aberto) return
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') fechar()
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto])

  if (!aberto || eventos.length === 0) return null

  const resumo = resumirEventos(eventos)
  const tudoPago = resumo.faltaReceber === 0 && resumo.pagos === resumo.total
  const diaSemana = nomeDiaSemana(dataAmanha)

  return (
    <Modal title={`Eventos de amanhã — ${formatDateBR(dataAmanha)}`} onClose={fechar}>
      <p className="lembrete-amanha-resumo">
        {diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1)} ·{' '}
        {resumo.total === 1 ? '1 evento' : `${resumo.total} eventos`} ·{' '}
        {tudoPago ? (
          <strong className="lembrete-amanha-ok">tudo pago</strong>
        ) : (
          <>
            falta receber <strong className="lembrete-amanha-falta">{formatCurrency(resumo.faltaReceber)}</strong>
          </>
        )}
      </p>

      <div className="lembrete-amanha-lista">
        {eventos.map((e) => {
          // Pessoa física que ainda não pagou tudo: cartão em destaque (vermelho, borda grossa, etiqueta).
          const destaque = pedidoPedeAtencao(e)
          return (
            <div key={e.id} className={`lembrete-amanha-card${destaque ? ' lembrete-amanha-card-destaque' : ''}`}>
              <div>
                <div className="text-strong">
                  {e.cliente}
                  {destaque && <span className="lembrete-amanha-tag-pf">PESSOA FÍSICA</span>}
                </div>
                <div className="text-muted lembrete-amanha-detalhe">
                  {e.hora_evento ? `Evento às ${e.hora_evento.slice(0, 5)} — ` : 'Evento sem horário — '}
                  {formatCurrency(e.valor_total)}
                  {e.valor_pago > 0 && e.falta_pagar > 0 && <> · falta {formatCurrency(e.falta_pagar)}</>}
                </div>
              </div>
              <span className={`badge ${STATUS_EVENTO_BADGE[e.status]}`}>{STATUS_EVENTO_LABEL[e.status]}</span>
            </div>
          )
        })}
      </div>

      <div className="modal-footer">
        <span />
        <div className="modal-footer-right">
          <button type="button" className="btn-secondary" onClick={fechar}>
            Fechar
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              fechar()
              router.push('/pedidos')
            }}
          >
            Ver pedidos
          </button>
        </div>
      </div>
    </Modal>
  )
}
