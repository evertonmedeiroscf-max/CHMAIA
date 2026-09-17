'use client'

import { useFormState, useFormStatus } from 'react-dom'
import Link from 'next/link'
import { signIn } from '@/app/auth/actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Entrando...' : 'Entrar'}
    </button>
  )
}

export default function LoginForm({ cadastro, erro }: { cadastro?: string; erro?: string }) {
  const [state, formAction] = useFormState(signIn, undefined)

  return (
    <main className="auth-page">
      <form action={formAction} className="auth-form">
        <h1>CHEF HILANA MAIA</h1>
        <p className="subtitle">Sistema de gestão</p>

        {cadastro === 'confirmar' && (
          <p className="form-info">Verifique seu e-mail para confirmar o cadastro antes de entrar.</p>
        )}
        {erro === 'callback' && <p className="form-error">Não foi possível confirmar o cadastro. Tente novamente.</p>}

        <label>
          E-mail
          <input type="email" name="email" required autoComplete="email" />
        </label>
        <label>
          Senha
          <input type="password" name="password" required autoComplete="current-password" />
        </label>
        {state?.error && <p className="form-error">{state.error}</p>}
        <SubmitButton />
        <p className="auth-switch">
          Não tem conta? <Link href="/signup">Cadastre-se</Link>
        </p>
      </form>
    </main>
  )
}
