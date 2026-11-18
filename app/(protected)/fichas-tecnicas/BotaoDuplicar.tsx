'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Modal from '@/components/Modal'
import { TIPOS_FICHA, TIPO_FICHA_LABEL, type FichaTecnica, type TipoFicha } from '@/lib/types/domain'
import { duplicarFichaTecnica, type FichaMesmoNome, type ResultadoDuplicar } from './actions'

type Acao = (origemId: string, dados: unknown) => Promise<ResultadoDuplicar>

// Botão "Duplicar" da ficha: abre uma janela para escolher o NOME e o TIPO (Base ou
// Finalização) da nova ficha. Se já existir uma ficha com esse nome e tipo, avisa
// numa segunda janela ANTES de gravar; só cria se a pessoa confirmar. A nova ficha
// recebe os ingredientes e o modo de preparo da original (a original não muda).
// `acao` só existe para a tela poder ser testada sem login; no sistema é sempre a real.
export default function BotaoDuplicar({
  ficha,
  acao = duplicarFichaTecnica,
}: {
  ficha: Pick<FichaTecnica, 'id' | 'nome' | 'tipo' | 'rendimento_kg'>
  acao?: Acao
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<TipoFicha>(ficha.tipo)
  const [rendimento, setRendimento] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [duplicadas, setDuplicadas] = useState<FichaMesmoNome[] | null>(null)
  const enviandoRef = useRef(false)

  function abrir() {
    setNome(`${ficha.nome} (cópia)`)
    setTipo(ficha.tipo)
    setRendimento(ficha.tipo === 'bases' && ficha.rendimento_kg !== null ? String(ficha.rendimento_kg) : '')
    setErro('')
    setDuplicadas(null)
    setAberto(true)
  }

  function fechar() {
    if (enviandoRef.current) return
    setAberto(false)
    setDuplicadas(null)
  }

  function mudarTipo(novo: TipoFicha) {
    setTipo(novo)
    // Voltando para o tipo da original, devolve o rendimento dela; em outro tipo, a pessoa informa.
    setRendimento(novo === 'bases' && ficha.tipo === 'bases' && ficha.rendimento_kg !== null ? String(ficha.rendimento_kg) : '')
  }

  async function enviar(confirmarDuplicada: boolean) {
    if (enviandoRef.current) return
    setErro('')
    enviandoRef.current = true
    setSalvando(true)
    try {
      const resultado = await acao(ficha.id, {
        nome,
        tipo,
        rendimento_kg: tipo === 'bases' ? rendimento : null,
        confirmar_duplicada: confirmarDuplicada,
      })
      if ('error' in resultado) {
        setDuplicadas(null)
        setErro(resultado.error)
        return
      }
      if ('duplicadas' in resultado) {
        setDuplicadas(resultado.duplicadas)
        return
      }
      setAberto(false)
      setDuplicadas(null)
      // Abre a ficha nova (a cópia), já pronta para conferir ou editar.
      router.push(`/fichas-tecnicas/${resultado.id}`)
      router.refresh()
    } catch {
      setDuplicadas(null)
      setErro('Não foi possível duplicar a ficha. Confira a conexão e tente novamente.')
    } finally {
      enviandoRef.current = false
      setSalvando(false)
    }
  }

  function aoEnviar(e: React.FormEvent) {
    e.preventDefault()
    void enviar(false)
  }

  const mudouDeTipo = tipo !== ficha.tipo

  return (
    <>
      <button type="button" className="btn-secondary" onClick={abrir}>
        Duplicar
      </button>

      {aberto && (
        <Modal title="Duplicar ficha técnica" onClose={fechar} closeOnBackdropClick={false}>
          <form onSubmit={aoEnviar}>
            <p className="modal-item-label" style={{ marginTop: 0 }}>
              Cria uma ficha nova com os <strong>ingredientes</strong> e o <strong>modo de preparo</strong> de <strong>{ficha.nome}</strong>. A ficha
              original não é alterada.
            </p>
            <div className="modal-fields" style={{ marginTop: 16 }}>
              <label>
                Nome da nova ficha
                <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus />
              </label>
              <label>
                Tipo da nova ficha
                <select value={tipo} onChange={(e) => mudarTipo(e.target.value as TipoFicha)}>
                  {TIPOS_FICHA.map((t) => (
                    <option key={t} value={t}>
                      {TIPO_FICHA_LABEL[t]}
                    </option>
                  ))}
                </select>
              </label>
              {tipo === 'bases' && (
                <label>
                  Rendimento total da receita (kg)
                  <input type="number" step="any" min="0" value={rendimento} onChange={(e) => setRendimento(e.target.value)} required />
                </label>
              )}
              {mudouDeTipo && (
                <p className="form-info">
                  {tipo === 'bases'
                    ? 'O rendimento não vem da ficha original (ela é de Finalização): informe o da nova Base.'
                    : 'O markup e o "serve" ficam em branco: preencha depois em "Editar ficha".'}
                </p>
              )}
              {erro && (
                <p className="form-error" role="alert">
                  {erro}
                </p>
              )}
            </div>
            <div className="modal-footer">
              <div />
              <div className="modal-footer-right">
                <button type="button" className="btn-secondary" onClick={fechar} disabled={salvando}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={salvando}>
                  {salvando ? 'Duplicando…' : 'Duplicar'}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {aberto && duplicadas && (
        <Modal title="Já existe uma ficha com esse nome" onClose={() => setDuplicadas(null)} closeOnBackdropClick={false}>
          <div className="alerta-duplicado" role="alert" style={{ marginTop: 0 }}>
            <strong>⚠ Nada foi gravado ainda</strong>
            <p>
              Já existe {duplicadas.length > 1 ? 'mais de uma ficha' : 'uma ficha'} do tipo <strong>{TIPO_FICHA_LABEL[tipo]}</strong> com o nome
              "{nome.trim()}":
            </p>
            <ul>
              {duplicadas.map((d) => (
                <li key={d.id}>{d.nome}</li>
              ))}
            </ul>
          </div>
          <p className="modal-item-label">Deseja criar a nova ficha mesmo assim?</p>
          <div className="modal-footer">
            <div />
            <div className="modal-footer-right">
              <button type="button" className="btn-secondary" onClick={() => setDuplicadas(null)} disabled={salvando}>
                Voltar e mudar o nome
              </button>
              <button type="button" className="btn-primary" onClick={() => void enviar(true)} disabled={salvando}>
                {salvando ? 'Duplicando…' : 'Criar mesmo assim'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
