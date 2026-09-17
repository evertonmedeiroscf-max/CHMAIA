import LoginForm from './LoginForm'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ cadastro?: string; erro?: string }>
}) {
  const { cadastro, erro } = await searchParams
  return <LoginForm cadastro={cadastro} erro={erro} />
}
