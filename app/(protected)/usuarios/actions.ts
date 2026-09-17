'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { PAGINAS_SISTEMA, TIPOS_USUARIO, type TipoUsuario } from '@/lib/types/domain'

export type ActionState = { error?: string; success?: boolean } | undefined

// A policy "usuarios_update_adm" já garante no banco que só um ADM
// consegue mudar `aprovado`/`tipo` de outro usuário — se quem chamar isso
// não for ADM, o update abaixo afeta 0 linhas.
export async function definirAprovacao(id: string, aprovado: boolean): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.from('usuarios').update({ aprovado }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/usuarios')
  return { success: true }
}

export async function definirTipo(id: string, tipo: TipoUsuario): Promise<ActionState> {
  if (!TIPOS_USUARIO.includes(tipo)) {
    return { error: 'Tipo inválido' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('usuarios').update({ tipo }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/usuarios')
  return { success: true }
}

export async function definirPaginas(id: string, paginas: string[]): Promise<ActionState> {
  const chavesValidas = new Set(PAGINAS_SISTEMA.map((p) => p.key))
  if (!paginas.every((p) => chavesValidas.has(p as (typeof PAGINAS_SISTEMA)[number]['key']))) {
    return { error: 'Página inválida' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('usuarios').update({ paginas }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/usuarios')
  return { success: true }
}
