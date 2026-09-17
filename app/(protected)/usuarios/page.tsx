import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import UsuariosClient from './UsuariosClient'
import type { Usuario } from '@/lib/types/domain'

export default async function UsuariosPage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login')

  const { data: meuUsuario } = await supabase
    .from('usuarios')
    .select('tipo')
    .eq('id', userData.user.id)
    .single()

  // Defesa em profundidade: além de o link sumir do menu para quem não é
  // ADM, a rota em si barra o acesso direto pela URL.
  if (meuUsuario?.tipo !== 'adm') redirect('/dashboard')

  const { data: usuarios, error } = await supabase.from('usuarios').select('*').order('created_at', { ascending: false })

  if (error) {
    return <p className="form-error">Erro ao carregar usuários: {error.message}</p>
  }

  return <UsuariosClient usuarios={(usuarios ?? []) as Usuario[]} currentUserId={userData.user.id} />
}
