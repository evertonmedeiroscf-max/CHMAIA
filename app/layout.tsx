import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Chef Hilana Maia',
  description: 'Gestão financeira e de estoque para buffet',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
