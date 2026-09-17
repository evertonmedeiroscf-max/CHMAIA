'use client'

import { useFormState, useFormStatus } from 'react-dom'
import Link from 'next/link'
import { signUp } from '@/app/auth/actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Criando conta...' : 'Criar conta'}
    </button>
  )
}

export default function SignupPage() {
  const [state, formAction] = useFormState(signUp, undefined)

  return (
    <main className="auth-page">
      <form action={formAction} className="auth-form">
        <h1>CHEF HILANA MAIA</h1>
        <p className="subtitle">Sistema de gestão</p>
        <label>
          E-mail
          <input type="email" name="email" required autoComplete="email" />
        </label>
        <label>
          Senha
          <input type="password" name="password" required autoComplete="new-password" minLength={6} />
        </label>
        <label>
          Confirmar senha
          <input type="password" name="confirmPassword" required autoComplete="new-password" minLength={6} />
        </label>
        {state?.error && <p className="form-error">{state.error}</p>}
        <SubmitButton />
        <p className="auth-switch">
          Já tem conta? <Link href="/login">Entrar</Link>
        </p>
      </form>
    </main>
  )
}
