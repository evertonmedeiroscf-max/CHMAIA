// Reduz uma foto no NAVEGADOR antes de enviar: lado maior de até 1600 px, JPEG. Foto de celular com
// 5-10 MB vira algumas centenas de KB (envio rápido, folha de impressão leve). Também endireita fotos
// giradas pelo celular (orientação EXIF) e põe fundo branco em PNG com transparência.
// Só roda no navegador (usa canvas).

const LADO_MAXIMO = 1600
// Se mesmo reduzida a foto passar disto (muito raro), tenta de novo menor/mais comprimida.
const TAMANHO_ALVO = 3 * 1024 * 1024

export async function reduzirImagem(arquivo: File): Promise<Blob> {
  if (!arquivo.type.startsWith('image/')) throw new Error('O arquivo escolhido não é uma imagem.')

  let imagem: ImageBitmap
  try {
    imagem = await createImageBitmap(arquivo, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('Não consegui abrir esta imagem. Use uma foto em JPG ou PNG.')
  }

  try {
    for (const [lado, qualidade] of [
      [LADO_MAXIMO, 0.85],
      [1200, 0.75],
      [900, 0.7],
    ] as const) {
      const escala = Math.min(1, lado / Math.max(imagem.width, imagem.height))
      const largura = Math.max(1, Math.round(imagem.width * escala))
      const altura = Math.max(1, Math.round(imagem.height * escala))

      const canvas = document.createElement('canvas')
      canvas.width = largura
      canvas.height = altura
      const contexto = canvas.getContext('2d')
      if (!contexto) throw new Error('Seu navegador não conseguiu preparar a foto.')
      contexto.fillStyle = '#fff'
      contexto.fillRect(0, 0, largura, altura)
      contexto.drawImage(imagem, 0, 0, largura, altura)

      const blob = await new Promise<Blob | null>((resolver) => canvas.toBlob(resolver, 'image/jpeg', qualidade))
      if (!blob) throw new Error('Seu navegador não conseguiu preparar a foto.')
      if (blob.size <= TAMANHO_ALVO) return blob
    }
    throw new Error('A foto ficou grande demais mesmo reduzida. Tente outra foto.')
  } finally {
    imagem.close()
  }
}
