# ChMaia

Sistema de gestão para empresa de buffet (eventos + refeições corporativas).
Fase atual: **financeiro (pedidos e despesas) + estoque**, com autenticação.

Stack: Next.js 15 (App Router) + Supabase (Postgres, Auth, RLS) via `supabase-js` / `@supabase/ssr`.
Telas construídas a partir de um protótipo de referência (`.dc.html`) fornecido pelo cliente.

## ⚠️ Sobre esta entrega

`npm install` e `npm run build` já foram rodados e passam limpos (ver
[Setup](#setup)). O que **não** foi verificado visualmente: as telas
protegidas (Pedidos, Despesas, Estoque, Resumo financeiro) exigem login
real via Supabase Auth, e o projeto ainda está com credenciais placeholder
em `.env.local` — sem um projeto Supabase real não é possível autenticar
para vê-las renderizadas. Login e cadastro foram conferidos visualmente no
navegador. Assim que as credenciais reais forem configuradas (passo 2-3
abaixo), vale conferir cada tela pelo menos uma vez.

## Pré-requisitos

- [Node.js](https://nodejs.org) 18.18+ (recomendado 20 LTS)
- Uma conta e projeto no [Supabase](https://supabase.com)

## Setup

1. **Instalar dependências**

   ```bash
   npm install
   ```

2. **Criar o projeto no Supabase** (se ainda não tiver um) e copiar a URL e a
   chave anônima em *Project Settings > API*.

3. **Configurar variáveis de ambiente**

   ```bash
   cp .env.local.example .env.local
   ```

   Preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

4. **Aplicar o schema do banco** — abra o SQL Editor do seu projeto Supabase
   e execute o conteúdo de [supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql).
   (Se preferir usar o Supabase CLI: `supabase db push` depois de linkar o projeto.)

5. **Rodar em desenvolvimento**

   ```bash
   npm run dev
   ```

   Acesse `http://localhost:3000`, clique em "Cadastre-se" e crie o usuário
   da empresa. Por padrão o Supabase exige confirmação por e-mail — se quiser
   pular isso em desenvolvimento, desative em *Authentication > Providers >
   Email > Confirm email*.

6. **Antes de considerar pronto**, rode o build para pegar erros de tipo:

   ```bash
   npm run build
   ```

## Arquitetura

```
app/
  auth/                 # actions (signIn/signUp/signOut) + callback de confirmação de e-mail
  login/, signup/        # páginas públicas de autenticação
  (protected)/           # route group com layout que exige sessão (redireciona p/ /login)
    dashboard/            # resumo financeiro (fetch server-side, filtro de mês client-side)
    pedidos/              # lista + calendário + modal de criar/editar (Client + Form + actions)
    despesas/             # lista + modal de criar/editar
    estoque/              # lista + modal de item + modal de movimento; estoque/[id] = histórico
lib/
  supabase/              # clients (browser/server) e middleware de sessão
  types/
    database.types.ts     # tipos no formato `supabase gen types` (ver nota abaixo)
    domain.ts              # enums/uniões e interfaces de domínio (fonte única da verdade)
  validations/            # schemas Zod usados nas server actions
  utils/                  # formatação de moeda/data/mês
components/               # NavBar, Modal, ColumnFilter, ConfirmSubmitButton (genéricos)
supabase/migrations/       # schema SQL (tabelas, RLS, triggers)
middleware.ts              # protege rotas não públicas
```

Criar/editar em Pedidos, Despesas e Estoque acontece em um **modal** (sem
navegação de página), igual ao protótipo de referência. As server actions
de criar/editar não fazem `redirect()`: retornam `{ success: true }` e o
próprio formulário fecha o modal via `useEffect`; o Next re-renderiza a
página automaticamente depois que a Server Action retorna.

Autenticação: qualquer usuário autenticado tem acesso total às tabelas
(RLS libera para a role `authenticated`), já que nesta fase não há
diferenciação de papéis nem múltiplas empresas.

### Tipos gerados pelo Supabase

`lib/types/database.types.ts` foi escrito manualmente no mesmo formato que o
comando abaixo gera. Quando o Supabase CLI estiver disponível, rode-o para
manter os tipos sincronizados com o schema real sem tocar em nenhum outro
arquivo:

```bash
npx supabase gen types typescript --project-id <seu-project-id> > lib/types/database.types.ts
```

## Decisões de negócio importantes

- **Número do pedido**: sequencial, gerado pelo banco (`sequence` +
  `default nextval`), nunca enviado pelo cliente.
- **Falta pagar**: coluna gerada (`generated always as`) — não pode divergir
  de `valor_total - valor_pago`.
- **Status do pedido**: campo editável, mas o formulário sugere
  automaticamente `pendente` / `50% pago` / `pago` conforme os valores
  digitados, até o usuário alterá-lo manualmente.
- **Estoque**: `quantidade_atual` só é editável na criação do item (estoque
  inicial); depois disso só muda por meio de movimentos de entrada/saída,
  aplicados por trigger no banco (fonte única da verdade, evita
  divergência entre o app e o banco). Excluir um movimento reverte seu
  efeito. Uma saída maior que o disponível é bloqueada por constraint
  (`quantidade_atual >= 0`).
- **Resumo financeiro**: "entradas" = soma de `valor_pago` dos pedidos cuja
  **data da venda** cai no mês filtrado (não a data de pagamento); "saídas" =
  despesas cuja `data` cai no mês. Segue o mesmo critério do protótipo de
  referência — o mês é o da venda, independente de quando o pagamento
  efetivamente ocorreu.
- **Filtro "Data da venda" em Pedidos**: filtra por **mês** da venda (ex.:
  "set/2026"), não pela data exata — como no protótipo de referência. Os
  demais filtros de coluna (cliente, nota, entidade, pagamento, status) são
  por valor exato.

## Extensões futuras (não implementadas nesta fase)

O projeto já está estruturado para receber, sem refatoração:

- **Orçamentos**: criar `app/(protected)/orcamentos/` espelhando a estrutura
  de `pedidos/` (page.tsx, Client.tsx, Form.tsx, actions.ts) + uma tabela
  `orcamentos` seguindo o mesmo padrão de RLS do
  [migration](supabase/migrations/0001_init.sql).
- **Páginas públicas** (ex.: orçamento compartilhável por link): criar um
  route group `app/(public)/` com seu próprio layout (sem `NavBar`/sessão) e
  adicionar o prefixo da rota em `PUBLIC_PATHS`
  ([lib/supabase/middleware.ts](lib/supabase/middleware.ts)) — nenhuma outra
  rota protegida precisa mudar.
- **Múltiplas empresas / papéis**: hoje todo usuário autenticado tem acesso
  total. Para multi-tenant, adicione `empresa_id` nas tabelas e troque as
  policies de `using (true)` para `using (empresa_id = ...)`.
