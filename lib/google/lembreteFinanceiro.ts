import type { createClient } from '@/lib/supabase/server'
import { carregarEventosDosDias } from '@/lib/supabase/eventosAmanha'
import { dataHojeBR } from '@/lib/utils/eventosAmanha'
import { diaDoLembrete, montarLembreteAgenda } from '@/lib/utils/lembreteAgenda'
import { googleAgendaConfigurada, sincronizarEventosEmLote, type EventoAgenda } from './calendar'

// Lembrete diário na Google Agenda com a situação financeira dos eventos do DIA SEGUINTE.
//
// Para cada dia X que tem evento (pedidos.data_evento), existe UM evento na agenda no dia X - 1,
// às 10:00, listando os eventos de X e se estão pagos, pela metade ou pendentes. O sistema não tem
// como rodar sozinho todo dia (não há chave de serviço no banco, só o login de quem está usando),
// então o lembrete é refeito sempre que um pedido muda — quando alguém cria, edita ou exclui um
// pedido, ou aprova um orçamento — e pelo botão "Sincronizar com Google Agenda". Como o pagamento só
// muda por dentro do sistema, a agenda fica sempre em dia.
//
// Sem a integração configurada, tudo aqui vira um no-op silencioso. Nunca lança: falha na agenda
// não pode derrubar o cadastro do pedido.

export type ResumoLembretes = {
  criados: number
  atualizados: number
  removidos: number
  falhas: number
  primeiroErro?: string
}

type Supabase = Awaited<ReturnType<typeof createClient>>

function resumoVazio(): ResumoLembretes {
  return { criados: 0, atualizados: 0, removidos: 0, falhas: 0 }
}

// `datas` = dias de EVENTO que podem ter mudado (aceita repetidas, vazias e nulas). Para cada um,
// cria/atualiza o lembrete se ainda há evento, ou apaga se não há mais. Lembrete de dia que já
// passou não é mexido.
export async function atualizarLembretesFinanceiros(
  supabase: Supabase,
  datas: Array<string | null | undefined>,
  agora: Date = new Date()
): Promise<ResumoLembretes> {
  const resumo = resumoVazio()
  if (!googleAgendaConfigurada()) return resumo

  const registrarFalha = (mensagem: string) => {
    resumo.falhas++
    resumo.primeiroErro ??= mensagem
  }

  try {
    const hoje = dataHojeBR(agora)
    const dias = [...new Set(datas.filter((d): d is string => !!d))].filter((d) => diaDoLembrete(d) >= hoje).sort()
    if (dias.length === 0) return resumo

    const lidos = await carregarEventosDosDias(supabase, dias)
    if (!lidos.ok) {
      registrarFalha(`não consegui ler os pedidos (${lidos.erro})`)
      return resumo
    }
    const { data: linhas, error: erroLinhas } = await supabase
      .from('agenda_lembretes_financeiros')
      .select('data_evento, google_event_id')
      .in('data_evento', dias)
    if (erroLinhas) {
      registrarFalha(`não consegui ler o controle dos lembretes (${erroLinhas.message})`)
      return resumo
    }
    const idPorDia = new Map((linhas ?? []).map((l) => [l.data_evento, l.google_event_id]))

    type Trabalho = { dia: string; existente: string | null; excluir: boolean; evento: EventoAgenda }
    const trabalhos: Trabalho[] = []
    for (const dia of dias) {
      const eventos = lidos.porDia.get(dia) ?? []
      const existente = idPorDia.get(dia) ?? null
      if (eventos.length === 0) {
        if (existente) trabalhos.push({ dia, existente, excluir: true, evento: { eventoId: existente, excluir: true } })
        continue
      }
      const lembrete = montarLembreteAgenda(dia, eventos)
      trabalhos.push({
        dia,
        existente,
        excluir: false,
        evento: { eventoId: existente, excluir: false, titulo: lembrete.titulo, descricao: lembrete.descricao, inicio: lembrete.inicio, fim: lembrete.fim },
      })
    }
    if (trabalhos.length === 0) return resumo

    const respostas = await sincronizarEventosEmLote(trabalhos.map((t) => t.evento))
    for (let i = 0; i < trabalhos.length; i++) {
      const { dia, existente, excluir } = trabalhos[i]
      const resposta = respostas[i]
      if (!resposta.ok) {
        registrarFalha(`${dia}: ${resposta.erro}`)
        continue
      }
      if (excluir) {
        const { error } = await supabase.from('agenda_lembretes_financeiros').delete().eq('data_evento', dia)
        if (error) registrarFalha(`${dia}: lembrete apagado na agenda, mas não consegui limpar o controle (${error.message})`)
        else resumo.removidos++
        continue
      }
      const eventoId = resposta.eventoId
      if (!eventoId) {
        registrarFalha(`${dia}: a agenda não devolveu o id do evento`)
        continue
      }
      if (eventoId !== existente) {
        const { error } = await supabase.from('agenda_lembretes_financeiros').upsert({ data_evento: dia, google_event_id: eventoId }, { onConflict: 'data_evento' })
        if (error) {
          registrarFalha(`${dia}: evento enviado, mas não consegui gravar o vínculo (${error.message})`)
          continue
        }
        resumo.criados++
      } else {
        resumo.atualizados++
      }
    }
  } catch (erro) {
    console.error('[lembrete-financeiro] falha inesperada', erro)
    registrarFalha(erro instanceof Error ? erro.message : String(erro))
  }
  return resumo
}
