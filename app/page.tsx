import { redirect } from 'next/navigation'

// O middleware já garante que só usuários autenticados chegam aqui
// (não autenticados são redirecionados para /login antes da renderização).
export default function Home() {
  redirect('/dashboard')
}
