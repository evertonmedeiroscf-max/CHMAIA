'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { TIPOS_FICHA, TIPO_FICHA_LABEL, type TipoFicha } from '@/lib/types/domain'
import type { FichaListada } from './listagem'

function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

// Letra do agrupamento: primeira letra do nome sem acento ("Ágata" -> A); o que
// não for letra (número, símbolo) cai em "#".
function letraDe(nome: string) {
  const primeira = normalizar(nome.trim()).charAt(0).toUpperCase()
  return /[A-Z]/.test(primeira) ? primeira : '#'
}

type Grupo = { letra: string; fichas: FichaListada[] }

function agrupar(fichas: FichaListada[]): Grupo[] {
  const ordenadas = [...fichas].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base', numeric: true }))
  const grupos: Grupo[] = []
  for (const ficha of ordenadas) {
    const letra = letraDe(ficha.nome)
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.letra === letra) ultimo.fichas.push(ficha)
    else grupos.push({ letra, fichas: [ficha] })
  }
  return grupos
}

// Índice em ordem alfabética de todas as fichas técnicas, separado em Base e
// Finalização; clicar no nome abre a ficha para leitura.
export default function IndiceFichas({ fichas }: { fichas: FichaListada[] }) {
  const [busca, setBusca] = useState('')

  const secoes = useMemo(() => {
    const q = normalizar(busca.trim())
    const filtradas = q ? fichas.filter((f) => normalizar(f.nome).includes(q)) : fichas
    return TIPOS_FICHA.map((tipo: TipoFicha) => {
      const doTipo = filtradas.filter((f) => f.tipo === tipo)
      return { tipo, total: doTipo.length, grupos: agrupar(doTipo) }
    })
  }, [fichas, busca])

  return (
    <div>
      <div className="toolbar" style={{ justifyContent: 'flex-start' }}>
        <input
          type="search"
          className="indice-busca"
          placeholder="Buscar ficha pelo nome…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          aria-label="Buscar ficha pelo nome"
        />
      </div>

      <div className="indice-fichas">
        {secoes.map(({ tipo, total, grupos }) => (
          <section key={tipo} className="indice-secao" aria-label={TIPO_FICHA_LABEL[tipo]}>
            <h2 className="indice-titulo">
              {TIPO_FICHA_LABEL[tipo]} <span>({total})</span>
            </h2>
            {grupos.length === 0 && <p className="empty-state">{busca ? 'Nenhuma ficha encontrada.' : 'Nenhuma ficha cadastrada.'}</p>}
            {grupos.map((grupo) => (
              <div key={grupo.letra} className="indice-grupo">
                <h3 className="indice-letra">{grupo.letra}</h3>
                <ul className="indice-lista">
                  {grupo.fichas.map((f) => (
                    <li key={f.id}>
                      <Link href={`/fichas-tecnicas/${f.id}`} className="ficha-link-nome">
                        {f.nome}
                      </Link>
                      {(f.sem_origem > 0 || f.incompletas > 0) && (
                        <span
                          className="ficha-aviso-preco"
                          title={
                            f.sem_origem > 0
                              ? `${f.sem_origem} linha(s) com NÃO CONSEGUIU OBTER INFORMAÇÃO DO ARQUIVO`
                              : `${f.incompletas} linha(s) fora do custo (custo parcial)`
                          }
                        >
                          {' '}
                          ⚠
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}
