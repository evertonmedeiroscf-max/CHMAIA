# Teste local (sempre)

Toda atualização do projeto deve ser testada em localhost **antes** do
`git push`. Suba o servidor com `preview_start` usando a configuração
`chmaia-dev` de `.claude/launch.json` (`npm run dev`, porta 3000 →
http://localhost:3000), confira a tela alterada no navegador e verifique
erros no console/logs. Só depois de validado localmente, publique via Git.

# Deploy — Vercel

**Projeto oficial (único a usar):** `chmaia-sistema`
**URL de produção:** https://chmaia-sistema.vercel.app

**Fluxo atual: Git, não deploy manual.** O projeto está conectado ao
repositório `https://github.com/evertonmedeiroscf-max/CHMAIA` (branch
`main`). Publicar = `git add`, `git commit`, `git push origin main` — o
Vercel builda e publica sozinho a cada push. Não use mais `deploy_to_vercel`
para atualizações; a seção abaixo sobre a limitação de redeploy é só
histórico de por que migramos para Git.

`git push` exige login interativo do GitHub (abre o navegador) — o agente
não consegue autenticar sozinho num terminal automatizado. Depois do
primeiro login bem-sucedido feito pelo usuário, as credenciais ficam
salvas no Git Credential Manager e os próximos `git push` funcionam direto.

## Limitação conhecida da integração MCP do Vercel

O token desta integração só tem permissão para o **primeiro** deploy de cada
projeto. Uma tentativa de redeploy para um projeto já existente falha com:

```
403 Forbidden: "You don't have permission to create a Production Deployment for this project."
```

Isso já aconteceu tentando atualizar `gestao-chm-buffet` e outros. Ferramentas
de leitura (`get_project`, `list_projects`, `get_deployment`,
`get_deployment_build_logs`) também retornam 404 para projetos criados nesta
sessão — não servem para verificar o status do build. Para confirmar que um
deploy funcionou, navegue até a URL pelo navegador (o deployment específico,
não só o alias) e confira se a página carrega.

**Se um redeploy para `chmaia-sistema` falhar com 403:** não crie outro
projeto novo por conta própria. Avise o usuário do bloqueio e pergunte se ele
prefere redeployar manualmente pelo dashboard do Vercel, ou conectar o
repositório Git ao projeto (isso remove essa limitação, já que deploys via
Git não passam por essa restrição de permissão).

## Projetos antigos (para excluir manualmente)

Estes projetos foram criados por engano durante troubleshooting e devem ser
excluídos pelo usuário no dashboard do Vercel (não há ferramenta MCP para
excluir projetos):

- `gestao-chm-buffet`
- `Chmaia` (chmaia.vercel.app)
- `aplicativo chmaia` (chmaia-app.vercel.app)
- `chef-hilana-maia`

## Supabase

Projeto: `chmaia` (`nybtoaizretmnezgivnf`, região `sa-east-1`).

Ao trocar o domínio de produção, atualizar em Supabase Dashboard →
Authentication → URL Configuration: Site URL e Redirect URLs
(`https://chmaia-sistema.vercel.app/auth/callback`).

Bucket de Storage `notas-compra` (privado) guarda os comprovantes enviados em
"Ler nota de compra" (Despesas). Chave do arquivo é sempre um uuid opaco —
nunca o nome do estabelecimento — e o acesso é só por signed URL temporária
gerada no servidor; não existe (e não precisa existir) uma service role
nesse projeto.

## Variáveis de ambiente necessárias no Vercel

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `NEXT_PUBLIC_SITE_URL` — já configuradas.
- `ANTHROPIC_API_KEY` — necessária para o botão "Importar despesa" (lê
  foto/print/PDF de comprovante via IA com visão e preenche data/descrição/
  valor) e também para "Ler nota de compra" em Despesas (lê nota fiscal/
  recibo/cupom de uma COMPRA e identifica estabelecimento, data e os itens
  comprados — ver `app/(protected)/despesas/notas-compra/actions.ts`). Sem
  essa chave, os dois botões aparecem normalmente mas mostram um erro claro
  ao tentar importar, em vez de quebrar a tela. Chave pessoal do usuário,
  gerada em console.anthropic.com — nunca colar a chave em texto no chat; o
  usuário mesmo adiciona em Project Settings → Environment Variables no
  Vercel (e em `.env.local` para testar em localhost).
- **Google Agenda de `chefhilanamaia@gmail.com`** — sincroniza Pedidos
  (data/hora do evento) com a agenda (ver `lib/google/calendar.ts`). Há DOIS
  jeitos de ligar, escolhidos pelas variáveis presentes (Apps Script tem
  prioridade se as duas dele existirem). Sem nenhum dos dois, o cadastro de
  pedidos funciona normalmente, só sem criar/atualizar/excluir o evento na
  agenda — nunca bloqueia o pedido. Pedidos novos/editados vão sozinhos; pra
  mandar os pedidos antigos (anteriores à integração), há o botão
  "Sincronizar com Google Agenda" na sub-aba Calendário de Pedidos
  (`prepararSincronizacaoGoogle` + `sincronizarLotePedidosGoogle` em
  `app/(protected)/pedidos/actions.ts`, enviados em lotes de 10 com progresso)
  — idempotente, quem já tem evento só é atualizado.

  **Jeito 1 — Apps Script** (`GOOGLE_APPS_SCRIPT_URL`,
  `GOOGLE_APPS_SCRIPT_TOKEN`). Não precisa de Google Cloud nem de chave —
  é o caminho quando a organização do Google Cloud bloqueia a criação de
  chaves de conta de serviço (política `iam.disableServiceAccountKeyCreation`,
  comum em contas de domínio/Workspace). Feito uma única vez pelo usuário:
  1. Entrar em script.google.com logado como `chefhilanamaia@gmail.com` →
     "Novo projeto" → apagar o código de exemplo e colar o conteúdo de
     `docs/google-agenda-apps-script.gs`.
  2. Inventar uma senha longa (30+ caracteres, só letras e números) e
     trocar `COLE_AQUI_A_SENHA` por ela, no topo do código. Salvar.
  3. Selecionar a função `autorizar` e clicar em "Executar" uma vez, só pra
     a Google pedir a permissão da agenda (aparece o aviso "app não
     verificado": Avançado → Acessar projeto → Permitir).
  4. "Implantar → Nova implantação" → tipo "App da Web" → Executar como:
     **Eu** → Quem tem acesso: **Qualquer pessoa** → Implantar. Copiar a URL
     (termina em `/exec`). Abrir essa URL no navegador deve mostrar
     `{"ok":true,"mensagem":"Ponte com a Google Agenda ativa."}`.
  5. `GOOGLE_APPS_SCRIPT_URL` = essa URL; `GOOGLE_APPS_SCRIPT_TOKEN` = a mesma
     senha do passo 2. Vercel (Project Settings → Environment Variables, e
     depois Redeploy) e `.env.local` (reiniciar o servidor). Nunca colar a
     senha em texto no chat.
  Se editar o script depois, é preciso "Implantar → Gerenciar implantações →
  editar → Nova versão" pra valer na mesma URL.

  **Jeito 2 — Conta de serviço do Google Cloud** (`GOOGLE_CALENDAR_ID`,
  `GOOGLE_CALENDAR_CLIENT_EMAIL`, `GOOGLE_CALENDAR_PRIVATE_KEY`). Passo a
  passo pra configurar (feito uma única vez, pelo usuário, no Google Cloud
  Console):
  1. Criar um projeto no Google Cloud Console e ativar a "Google Calendar
     API".
  2. Criar uma conta de serviço (Service Account) nesse projeto e gerar uma
     chave JSON pra ela.
  3. Na Google Agenda de `chefhilanamaia@gmail.com`, compartilhar o
     calendário com o e-mail da conta de serviço (campo `client_email` do
     JSON), com permissão "Fazer alterações em eventos".
  4. `GOOGLE_CALENDAR_ID` = `chefhilanamaia@gmail.com` (o id do calendário
     principal é o próprio e-mail); `GOOGLE_CALENDAR_CLIENT_EMAIL` = campo
     `client_email` do JSON; `GOOGLE_CALENDAR_PRIVATE_KEY` = campo
     `private_key` do JSON (colar inteiro, com os `\n` como estão — o código
     já desfaz o escape). Nunca colar essas credenciais em texto no chat; o
     usuário mesmo adiciona em Project Settings → Environment Variables no
     Vercel (e em `.env.local` para testar em localhost).
