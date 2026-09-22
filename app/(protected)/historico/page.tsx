import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import HistoricoClient from './HistoricoClient'
import type { HistoricoAlteracao } from '@/lib/types/domain'

const LIMITE = 1000

export default async function HistoricoPage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login')

  const { data: meuUsuario } = await supabase.from('usuarios').select('tipo').eq('id', userData.user.id).single()

  // Defesa em profundidade: além de o link sumir do menu para quem não é
  // ADM, a rota em si barra o acesso direto pela URL (a RLS da tabela já
  // bloqueia a leitura, mas isso evita renderizar uma tela vazia confusa).
  if (meuUsuario?.tipo !== 'adm') redirect('/dashboard')

  const { data, error } = await supabase
    .from('historico_alteracoes')
    .select('*')
    .order('criado_em', { ascending: false })
    .limit(LIMITE)

  if (error) {
    return <p className="form-error">Erro ao carregar histórico: {error.message}</p>
  }

  return <HistoricoClient historico={(data ?? []) as unknown as HistoricoAlteracao[]} />
}
