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

## Variáveis de ambiente necessárias no Vercel

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `NEXT_PUBLIC_SITE_URL` — já configuradas.
- `ANTHROPIC_API_KEY` — necessária para o botão "Importar despesa" (lê
  foto/print/PDF de comprovante via IA com visão e preenche data/descrição/
  valor). Sem essa chave, o botão aparece normalmente mas mostra um erro
  claro ao tentar importar, em vez de quebrar a tela. Chave pessoal do
  usuário, gerada em console.anthropic.com — nunca colar a chave em texto
  no chat; o usuário mesmo adiciona em Project Settings → Environment
  Variables no Vercel (e em `.env.local` para testar em localhost).
