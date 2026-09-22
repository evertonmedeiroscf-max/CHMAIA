/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Padrão é 1mb — fotos de celular do extrato/recibo passam disso fácil.
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
}

export default nextConfig
