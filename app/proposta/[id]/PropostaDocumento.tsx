import { Allura, Barlow_Condensed, Montserrat } from 'next/font/google'
import type { Orcamento, SecaoOrcamento } from '@/lib/types/domain'
import { formatCurrency, formatDateBR } from '@/lib/utils/format'
import { secaoOpcional, valorOpcionalPorPessoa } from '@/lib/utils/orcamento'
import BotaoImprimir from './BotaoImprimir'

// Fontes do modelo "Mesa Fixa 50 pessoas.pdf": Allura (letra cursiva),
// Montserrat (texto corrido) e uma condensada no lugar da ArchTH Cond.
const cursiva = Allura({ subsets: ['latin'], weight: '400', variable: '--fonte-cursiva' })
const texto = Montserrat({ subsets: ['latin'], weight: ['400', '500'], variable: '--fonte-texto' })
const condensada = Barlow_Condensed({ subsets: ['latin'], weight: ['300', '400', '500', '600'], variable: '--fonte-condensada' })

const CONTATO = ['@CHEFHILANAMAIA', '(84) 99637-3428', 'EMAIL: CHEFHILANAMAIA@GMAIL.COM', 'RUA JUAREZ TÁVORA, 3457 - CANDELÁRIA']
const SLOGAN = 'Elegância, sabor e sofisticação em cada detalhe'

const PAGAMENTO = [
  'Valores para pagamento por pix ou transferência.',
  '50% antecipado para fechar o contrato e o restante até 2 dias antes do evento.',
  'Para pagamento em cartão de crédito, terá o acréscimo de 5% da taxa da operadora.',
]

const INFORMACOES = [
  'Valores para até 4 horas de serviço. Hora extra R$300,00',
  'Se a festa continuar após o horário acordado, sem hora extra, pedimos que providenciem travessas para as comidas que restarem. Ao término do serviço todo o material estará limpo e guardado.',
  'O cliente é responsável pela reposição ou pagamento do material extraviado ou danificado durante o evento.',
  'Eventos fora de Natal, terão acréscimo de deslocamento.',
  'Crianças até 5 anos não pagam',
  'De 6 a 11 anos paga 50%',
  'A partir de 12 anos paga integral',
  'Equipe de staff (banda, fotógrafo, cerimonial, segurança…) pagam 50% do valor. Essa quantidade de pessoas deve ser informada com antecedência.',
  'Não está incluso: mesa para montagem do buffet, copos e taças para bebidas alcoólicas, gelo, decoração de outros espaços que não seja a mesa do buffet, toalha para mesa de convidados.',
]

const QUALIDADE =
  'Trabalhamos com ingredientes naturais, sem aditivos ou conservantes. Nossa produção é diária e seguimos rigorosamente todos os processos da vigilância sanitária, garantindo que cada etapa da produção de alimentos seja realizada dentro dos mais altos padrões de higiene e segurança. Possuímos também o alvará sanitário atualizado, que comprova nossa conformidade com as normas regulamentadoras. Assim, você pode desfrutar das nossas deliciosas opções com total confiança.'

function Cabecalho() {
  return (
    <>
      <header className="pp-cabecalho">
        <div className="pp-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/marca/logo.png" alt="Chef Hilana Maia Gastronomia" />
        </div>
        <div className="pp-contato">
          {CONTATO.map((linha) => (
            <div key={linha}>{linha}</div>
          ))}
        </div>
      </header>
      <p className="pp-slogan">{SLOGAN}</p>
    </>
  )
}

function Rodape({ comIM = false }: { comIM?: boolean }) {
  return (
    <footer className="pp-rodape">
      <span>CNPJ: 30.278.809/0001-40</span>
      <span>IE: 20.491.827-8</span>
      {comIM && <span>IM: 217.302-1</span>}
    </footer>
  )
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="pp-secao">
      <h3 className="pp-faixa">{titulo.toUpperCase()}</h3>
      {children}
    </section>
  )
}

function ListaItens({ secao, marcadores = false }: { secao: SecaoOrcamento; marcadores?: boolean }) {
  return (
    <ul className={`pp-itens${marcadores ? ' pp-itens-marcador' : ''}`}>
      {secao.itens.map((item, i) => (
        <li key={i}>
          {item.nome}
          {item.observacao && <small>{item.observacao}</small>}
        </li>
      ))}
    </ul>
  )
}

// Proposta no layout do modelo do usuário (página 1: cardápio, serviços,
// pagamento e total; página 2: informações importantes). Os itens aparecem
// só pelo nome — preço unitário, peso e % de extras são custo interno.
export default function PropostaDocumento({ orcamento }: { orcamento: Orcamento }) {
  const pessoas = orcamento.numero_pessoas
  const comItens = orcamento.itens.filter((s) => s.itens.length > 0)
  const opcionais = comItens.filter(secaoOpcional)
  const cardapio = comItens.filter((s) => s.tipo === 'comida' && !secaoOpcional(s))
  const servicos = comItens.filter((s) => s.tipo === 'servico' && !secaoOpcional(s))
  const titulo = orcamento.descricao?.trim() || orcamento.cliente

  return (
    <div className={`pp-pagina ${cursiva.variable} ${texto.variable} ${condensada.variable}`}>
      <div className="pp-acoes">
        <BotaoImprimir />
      </div>

      <article className="pp-folha">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="pp-marca-dagua" src="/marca/marca-dagua.png" alt="" aria-hidden />
        <Cabecalho />

        <div className="pp-titulo">
          <div className="pp-titulo-linha">
            <h1>{titulo.toUpperCase()}</h1>
            <span className="pp-titulo-pessoas">{pessoas ? `PARA ${pessoas} PESSOAS` : 'Nº DE PESSOAS A DEFINIR'}</span>
          </div>
          <div className="pp-titulo-sub">{orcamento.descricao?.trim() ? orcamento.cliente : `Proposta nº ${orcamento.numero}`}</div>
        </div>
        <p className="pp-referencia">
          Proposta nº {orcamento.numero} · emitida em {formatDateBR(orcamento.data_orcamento)}
          {orcamento.validade && ` · válida até ${formatDateBR(orcamento.validade)}`}
          {orcamento.data_evento && ` · evento em ${formatDateBR(orcamento.data_evento)}`}
          {orcamento.hora_evento && ` às ${orcamento.hora_evento.slice(0, 5)}`}
        </p>

        <div className="pp-colunas">
          <div className="pp-coluna">
            {cardapio.length === 0 && (
              <Secao titulo="Cardápio">
                <p className="pp-vazio">Cardápio a definir.</p>
              </Secao>
            )}
            {cardapio.map((secao, i) => (
              <Secao key={i} titulo={secao.nome || 'Cardápio'}>
                <ListaItens secao={secao} />
              </Secao>
            ))}

            <div className="pp-total">
              <div>TOTAL {formatCurrency(orcamento.valor_total)}</div>
              {!!pessoas && orcamento.valor_total > 0 && (
                <div>{formatCurrency(orcamento.valor_total / pessoas)} POR PESSOA</div>
              )}
            </div>
          </div>

          <div className="pp-coluna">
            {opcionais.map((secao, i) => {
              const porPessoa = valorOpcionalPorPessoa(secao, orcamento.percentual_extras, pessoas)
              return (
                <Secao key={i} titulo={secao.nome}>
                  <ListaItens secao={secao} marcadores />
                  {porPessoa > 0 && (
                    <div className="pp-adicional">
                      <span>
                        *Caso queira adicionar um item acima, acrescentará {porPessoa.toFixed(2).replace('.', ',')} por
                        pessoa ao valor do cardápio.
                      </span>
                      <strong>{formatCurrency(porPessoa)} POR PESSOA</strong>
                    </div>
                  )}
                </Secao>
              )
            })}

            {servicos.map((secao, i) => (
              <Secao key={i} titulo={secao.nome || 'Serviços'}>
                <ListaItens secao={secao} />
              </Secao>
            ))}

            <Secao titulo="Pagamento">
              <div className="pp-pagamento">
                {PAGAMENTO.map((linha) => (
                  <p key={linha}>{linha}</p>
                ))}
              </div>
            </Secao>
          </div>
        </div>

        <Rodape />
      </article>

      <article className="pp-folha pp-folha-info">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="pp-marca-canto" src="/marca/marca-dagua.png" alt="" aria-hidden />
        <Cabecalho />
        <h2 className="pp-info-titulo">Informações importantes</h2>
        <div className="pp-info">
          {INFORMACOES.map((linha) => (
            <p key={linha}>{linha}</p>
          ))}
        </div>
        <div className="pp-qualidade">
          <svg viewBox="0 0 48 48" aria-hidden className="pp-qualidade-icone">
            <path d="M10 4h20l8 8v14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
            <path d="M10 4v40h16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
            <path d="M16 14h12M16 20h14M16 26h8M16 32h6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="34" cy="34" r="7" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <path d="M39 39l6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <p>{QUALIDADE}</p>
        </div>
        <Rodape comIM />
      </article>
    </div>
  )
}
