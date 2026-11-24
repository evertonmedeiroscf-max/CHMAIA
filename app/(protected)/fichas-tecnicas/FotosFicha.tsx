'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Modal from '@/components/Modal'
import { MAX_FOTOS, MAX_LEGENDA, POSICAO_FOTO_TITULO, separarFotos, type FotoFicha, type PosicaoFoto } from '@/lib/utils/fichaFotos'
import { reduzirImagem } from '@/lib/utils/reduzirImagem'
import { atualizarLegendaFoto, enviarFotoFicha, excluirFotoFicha, moverFotoFicha, type ResultadoFoto } from './fotosActions'

// As ações ficam separadas só para a tela poder ser testada sem login e sem gravar de verdade; no
// sistema são sempre as reais (que conferem tudo de novo no servidor e no banco).
export type AcoesFotos = {
  enviar: (formData: FormData) => Promise<ResultadoFoto>
  legenda: (id: string, legenda: string) => Promise<ResultadoFoto>
  mover: (id: string, direcao: 'antes' | 'depois') => Promise<ResultadoFoto>
  excluir: (id: string) => Promise<ResultadoFoto>
}
const ACOES_REAIS: AcoesFotos = { enviar: enviarFotoFicha, legenda: atualizarLegendaFoto, mover: moverFotoFicha, excluir: excluirFotoFicha }

// Botão "Inserir foto" da ficha: abre a janela para colocar, nas duas posições fixas, as fotos do
// produto finalizado (até 2, parte superior) e do passo a passo (até 12, depois do modo de preparo).
export default function FotosFicha({
  fichaId,
  nome,
  fotos,
  acoes = ACOES_REAIS,
}: {
  fichaId: string
  nome: string
  fotos: FotoFicha[]
  acoes?: AcoesFotos
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const entradaProduto = useRef<HTMLInputElement>(null)
  const entradaPasso = useRef<HTMLInputElement>(null)
  const porPosicao = separarFotos(fotos)

  async function executar(mensagem: string, tarefa: () => Promise<ResultadoFoto>) {
    setErro('')
    setOcupado(mensagem)
    try {
      const resultado = await tarefa()
      if ('error' in resultado) setErro(resultado.error)
      router.refresh()
    } catch {
      setErro('Não foi possível concluir. Confira a conexão e tente novamente.')
    } finally {
      setOcupado(null)
    }
  }

  async function adicionar(posicao: PosicaoFoto, arquivos: FileList | null) {
    if (!arquivos || arquivos.length === 0) return
    const vagas = MAX_FOTOS[posicao] - porPosicao[posicao].length
    const escolhidas = Array.from(arquivos).slice(0, Math.max(0, vagas))
    const aviso = arquivos.length > escolhidas.length ? `Só cabem mais ${vagas} foto(s) aqui; as demais não foram enviadas.` : ''

    setErro('')
    let falha = ''
    for (let i = 0; i < escolhidas.length; i++) {
      setOcupado(`Enviando foto ${i + 1} de ${escolhidas.length}…`)
      try {
        const reduzida = await reduzirImagem(escolhidas[i])
        const dados = new FormData()
        dados.set('ficha_id', fichaId)
        dados.set('posicao', posicao)
        dados.set('arquivo', new File([reduzida], 'foto.jpg', { type: 'image/jpeg' }))
        const resultado = await acoes.enviar(dados)
        if ('error' in resultado) {
          falha = resultado.error
          break
        }
      } catch (e) {
        falha = e instanceof Error ? e.message : 'Não foi possível enviar a foto.'
        break
      }
    }
    setOcupado(null)
    setErro(falha || aviso)
    router.refresh()
  }

  function excluir(foto: FotoFicha) {
    if (!window.confirm('Excluir esta foto da ficha?\n\nEla some da ficha e da impressão, e não dá para desfazer.')) return
    void executar('Excluindo…', () => acoes.excluir(foto.id))
  }

  function secao(posicao: PosicaoFoto, entrada: React.RefObject<HTMLInputElement>) {
    const lista = porPosicao[posicao]
    const cheio = lista.length >= MAX_FOTOS[posicao]
    return (
      <section className="fotos-secao">
        <h3 className="fotos-secao-titulo">
          {POSICAO_FOTO_TITULO[posicao]} <span className="text-muted">— {lista.length} de {MAX_FOTOS[posicao]}</span>
        </h3>

        {lista.length === 0 ? (
          <p className="fotos-vazio">Nenhuma foto ainda.</p>
        ) : (
          <div className="fotos-lista">
            {lista.map((f, i) => (
              <div key={f.id} className="fotos-item">
                <div className="fotos-miniatura">
                  {f.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.url} alt={f.legenda ?? `Foto ${i + 1}`} />
                  ) : (
                    <span className="fotos-indisponivel">Foto indisponível — recarregue a página</span>
                  )}
                </div>
                {posicao === 'passo' && (
                  <input
                    type="text"
                    className="fotos-legenda"
                    placeholder="Legenda (opcional)"
                    maxLength={MAX_LEGENDA}
                    defaultValue={f.legenda ?? ''}
                    disabled={!!ocupado}
                    aria-label={`Legenda da foto ${i + 1}`}
                    onBlur={(e) => {
                      if (e.target.value.trim() !== (f.legenda ?? '')) void executar('Salvando legenda…', () => acoes.legenda(f.id, e.target.value))
                    }}
                  />
                )}
                <div className="fotos-botoes">
                  <button type="button" className="btn-secondary" disabled={!!ocupado || i === 0} onClick={() => void executar('Movendo…', () => acoes.mover(f.id, 'antes'))} title="Mover para antes" aria-label="Mover para antes">
                    ‹
                  </button>
                  <button type="button" className="btn-secondary" disabled={!!ocupado || i === lista.length - 1} onClick={() => void executar('Movendo…', () => acoes.mover(f.id, 'depois'))} title="Mover para depois" aria-label="Mover para depois">
                    ›
                  </button>
                  <button type="button" className="btn-danger" disabled={!!ocupado} onClick={() => excluir(f)}>
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <input
          ref={entrada}
          type="file"
          accept="image/*"
          multiple={posicao === 'passo'}
          hidden
          onChange={(e) => {
            const arquivos = e.target.files
            void adicionar(posicao, arquivos).finally(() => {
              e.target.value = ''
            })
          }}
        />
        <button type="button" className="btn-secondary" disabled={!!ocupado || cheio} onClick={() => entrada.current?.click()}>
          {cheio ? 'Limite de fotos atingido' : posicao === 'produto' ? '+ Adicionar foto' : '+ Adicionar fotos'}
        </button>
      </section>
    )
  }

  return (
    <>
      <button type="button" className="btn-secondary" onClick={() => setAberto(true)}>
        Inserir foto
      </button>

      {aberto && (
        <Modal title={`Fotos da ficha — ${nome}`} onClose={() => !ocupado && setAberto(false)} wide closeOnBackdropClick={false}>
          <p className="fotos-ajuda">
            As fotos aparecem na ficha e na impressão de uma folha. A foto é reduzida automaticamente antes de enviar.
          </p>
          {secao('produto', entradaProduto)}
          {secao('passo', entradaPasso)}

          {ocupado && <p className="fotos-status">{ocupado}</p>}
          {erro && <p className="form-error">{erro}</p>}

          <div className="modal-footer">
            <span />
            <div className="modal-footer-right">
              <button type="button" className="btn-primary" disabled={!!ocupado} onClick={() => setAberto(false)}>
                Fechar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
