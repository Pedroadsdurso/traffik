@AGENTS.md

# Trackhub — guia do projeto

Ferramenta de tracking de tráfego/vendas + Facebook Ads (estilo Utmify).
As **v1 (13 fases)** estão completas e reais. O **roteiro v2 (13 blocos)** também
— o Bloco 8 foi o último, em 29/07/2026.

> ### 🗺️ MAPA — onde está o quê
>
> Este arquivo tem o que muda o comportamento em **qualquer** sessão. O resto vive
> em `docs/`, e é para ser lido **quando o assunto aparece**. Uma decisão sobre a
> gaveta do Pixel não muda o que fazer ao mexer em taxas.
>
> **Reorganizado em 05/08/2026**, porque o CLAUDE.md tinha chegado a 548 KB —
> mais de 3× o limite de 150 KB, ou seja, **estava sendo truncado**: parte do que
> foi registrado não chegava até a sessão. Nada foi apagado.
>
> | Arquivo | O que tem | Leia quando |
> |---|---|---|
> | **CLAUDE.md** (este) | PROCEDIMENTO, ordem de migration, guarda de escrita em prod, padrões nomeados, estado atual, fila curta, comandos | **sempre** |
> | `docs/FILA.md` | a fila completa, com o raciocínio de cada item | for escolher o que fazer |
> | `docs/regras/padroes-nomeados.md` | o caso completo de cada padrão da tabela abaixo | o padrão aparecer |
> | `docs/regras/banco-e-migrations.md` | os bugs que só apareceram ao trocar de banco | mexer em banco/migration |
> | `docs/regras/seguranca-e-credenciais.md` | encriptação em repouso (AES-256-GCM), `ENCRYPTION_KEY` | mexer em segredo/token |
> | `docs/temas/gateways.md` | arquitetura universal, parsers, capacidades, Kirvano/Cakto/OnyxPag | integrar gateway, mexer em parser |
> | `docs/temas/areas-de-trabalho.md` | precedência de atribuição, escopo, exclusão com escolha | recortar dado por área |
> | `docs/temas/pixel-e-scripts.md` | pixel, CAPI, dedup/`eventId`, detectores, ambiente de teste, scripts instaláveis, checkout próprio | mexer em pixel ou script |
> | `docs/temas/gerenciador-e-graph-api.md` | Gerenciador, sync, veiculação, cobaia, **o que já foi exercido na escrita** | mexer no Gerenciador ou escrever na Meta |
> | `docs/temas/regras-de-automacao.md` | motor que age sozinho, teto, prévia, clamp | tocar em `rules/engine.ts` |
> | `docs/temas/metricas-e-financeiro.md` | KPIs, funil, lucro/taxas, períodos | mexer em métrica |
> | `docs/temas/geolocalizacao.md` | IP, base de países, IPv6, bot, desempate, anonimização | mexer em país/IP |
> | `docs/temas/ui-e-microcopia.md` | microcópia, gavetas, gráficos, ícones, layout, responsividade | escrever texto de tela ou mexer em UI |
> | `docs/temas/deploy-e-operacao.md` | Vercel, cron, agendadores, domínio, performance | deployar ou investigar produção |
> | `docs/historico/*.md` | registro de sessão por período — o "por que ficou assim" | precisar da origem de uma decisão |
> | `docs/arquivo-morto.md` | o que saiu do fluxo **e o motivo** | desconfiar de doc que contradiz o código |
> | `docs/auditoria.md` | 🔜 auditoria pré-redesign: 310 cores hardcoded, 5 problemas estruturais, o que PRESERVAR | trabalhar no redesign |
> | `docs/design/00-CRITERIOS-CORRIGIDOS.md` | 🔜 **decisões e critérios do redesign** — o que foi corrigido em cima do prompt master | **antes de qualquer fase do redesign** |
> | `docs/design/04-CONFERENCIA-COM-AS-REFERENCIAS.md.txt` | 🥇 **o inventário do que precisa existir, tela por tela, conferido contra as 11 imagens.** Tem **precedência sobre todos** os outros documentos de design | **antes de qualquer tela do redesign** |
> | `docs/design/03-ARQUITETURA-DE-TELAS.md` | estrutura das telas, catálogo de blocos, as três zonas do Dashboard. **Perde para o `04`** em divergência | desenhar uma tela ou o modo de edição |
> | `docs/design/03-FASE-1-DECISOES.md` | arquitetura de **tokens** (`--tk-*`, `@theme inline`), não de telas. O nome engana | mexer em token ou no `globals.css` |
> | `docs/design/05-MAPA-DAS-RAZOES.md` | 🚧 **levantamento INCOMPLETO** das razões com denominador zero. **Só o item 4 (regras de automação) está pronto** — e é o urgente | **antes de mexer em qualquer métrica derivada** |
> | `docs/design/05-MOCKUPS-VS-TOKENS.md` | os 4 conflitos mockup × sistema e **como cada um foi decidido** (canal só dentro do gráfico, roxo como categoria, selo tingido, gradiente não preenche botão) | mexer em cor, selo ou botão |
> | `docs/design/06-LINGUAGEM-VISUAL.md` | 🎨 **as medidas do acabamento em NÚMEROS** — raio, padding, sombra, curva, hachura, pílula de variação, e a ORDEM DE APLICAÇÃO por resultado/custo. ⚠️ cita 4 imagens que **não estão no repo** | antes de qualquer trabalho visual |
| `docs/design/06-CRIADOR-DE-REGRAS.md` | ⛔ **especificação de algo que NÃO existe** — fora do escopo do redesign, por decisão | só se for decidir construir o motor |
> | `docs/design/07-DASHBOARD-MIGRADO.md` | a ponte `.tk-tema` e por que o re-skin do Dashboard foi jogado fora | mexer no shell ou numa tela ainda não migrada |
>
> ⚠️ **`docs/arquivo-morto.md` não é lixo.** Vários "obsoletos" desta base
> voltaram a importar. O que está lá é o que **descreve comportamento que
> MUDOU** — e isso instrui a reintroduzir o bug que a mudança consertou.

---

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).


---

## Stack

- **Next.js 16** (App Router, Turbopack) + **TypeScript**
- **Prisma 7** com **driver adapter `@prisma/adapter-pg`** (obrigatório no Prisma 7)
- **Supabase Postgres** (banco de produção e dev)
- **NextAuth v5 (Auth.js)** — Credentials (e-mail/senha) + bcrypt, sessão JWT
- **Tailwind 4** só como base; o visual usa **design tokens** (CSS vars em
  `globals.css`) aplicados via helper **`sx()`** (string CSS → style object)
- **Recharts** instalado, mas a maioria dos gráficos ainda é SVG custom
- **BullMQ/ioredis** estão no package.json mas **NÃO são usados** — em serverless
  não há worker de processo longo. O agendamento é EXTERNO: hoje há **dois**
  agendadores (cron-job.org + `.github/workflows/cron.yml`) — ver o aviso no
  estado atual. O `vercel.json` **não** declara cron: o plano Hobby só aceita
  diário e rejeitava o deploy inteiro.

> ⚠️ Esta versão do Next tem breaking changes. Ler `node_modules/next/dist/docs/`
> antes de escrever código de rota/convenção nova (ver AGENTS.md).

---

## Estrutura de pastas

```
src/
  app/
    (auth)/{login,signup}/          # páginas públicas de auth
    dashboard/
      layout.tsx                    # guard de sessão (auth) para tudo em /dashboard
      (app)/                        # GRUPO com o "shell" do app (sidebar+header)
        layout.tsx                  # busca TODOS os dados no servidor → <DashboardShell>
        page.tsx                    # Dashboard
        gerenciador/                # Gerenciador de Anúncios
        criativos/  regras/  notificacoes/  taxas/
        integracoes/
          layout.tsx                # 5 sub-abas horizontais (Links)
          page.tsx                  # redirect → anuncios
          anuncios/ webhooks/ utms/ pixel/ testes/
      test-checkout/                # FORA do grupo (app) — página standalone sem shell
      facebook/  utm/               # redirects de rotas antigas → integracoes/*
    api/
      track/click                   # captura de cliques (pixel.js)
      webhook/sale/[webhookId]      # recebe vendas dos gateways
      webhook/kirvano  webhook/ingest # Kirvano + ingestão por chave de API
      pixel/event                   # eventos do script de pixel próprio → CAPI (CORS)
      dashboard  ads  ads/status  ads/campaign  creatives  notifications  pixel/test
      sync/facebook  rules/run
      cron/{sync-facebook,run-rules,reports}   # Vercel Cron (CRON_SECRET)
      auth/[...nextauth]  auth/facebook  auth/facebook/callback
  components/dashboard/
    TraffikContext.tsx              # contexto + useTraffik() hook
    DashboardShell.tsx              # client: roda useTraffikState 1x e provê o contexto
    Header.tsx  Sidebar.tsx         # navegação por ROTA (usePathname + Link)
    ImageSlot.tsx                   # (EditDashboardDrawer e Icon.tsx foram DELETADOS)
    blocks.ts                       # registro dos blocos do Dashboard (Bloco 2)
    useDashboardLayout.ts           # estado do grid (layouts, modo de edição)
    ui/{Select,DateRangePicker}.tsx # select próprio + calendário de intervalo
    ui/{AreaChart,Donut,Funnel,CountryMap}.tsx  # gráficos do Bloco 5
    DashboardGrid.tsx  BlockContent.tsx   # grid arrastável + conteúdo de cada bloco
    useTraffikState.ts              # HOOK GIGANTE: todo o estado/derivações do dashboard
    types.ts                        # só MetricKey (TabKey saiu na faxina de 05/08)
    views/                          # DashboardView, AdsManagerView, CreativesView, RulesView,
                                    #   NotificationsView, FeesView, AreasView, UtmsView
    views/integracoes/              # AnunciosView, WebhooksView, PixelView, TestesView
  lib/
    prisma.ts appUrl.ts format.ts sx.ts dateRange.ts countries.ts
    crypto/secrets.ts               # AES-256-GCM das credenciais em repouso
    actions/                        # server actions ("use server"), retornam DTOs
      webhooks pixels rules notifications expenses facebook dashboardPrefs session
      apiCredentials utm diagnostics dashboardLayout
    dashboard/metrics.ts            # computeDashboard (KPIs reais)
    ads/{overview,creatives}.ts     # dados do gerenciador e ranking de criativos
    facebook/{graph,sync,manage,capi}.ts
    utm/{parse,scripts}.ts          # parser reverso dos UTMs/xcod + scripts instaláveis
    pixel/script.ts                 # gerador do script de pixel próprio (Bloco 12)
    webhook/{normalizeSale,matchClick,dispatchPixel,dispatchNotification}.ts
    webhook/{ingestSale,parseKirvano,logWebhook}.ts
    rules/engine.ts  reports/generate.ts
  generated/prisma/                 # cliente Prisma gerado (GITIGNORED)
docs/                             # a documentação dividida por tema — ver o MAPA no topo
prisma/{schema.prisma, seed.ts, migrations/}
.github/workflows/cron.yml          # agendamento das rotinas (substitui o Vercel Cron)
scripts/demo-data.mjs               # gera dados de exemplo (NÃO rodar em prod)
scripts/encrypt-secrets.mjs         # backfill: encripta credenciais em repouso
src/scripts/*.src.js                # FONTE dos runtimes instaláveis (minificados no build)
public/{t,px,pixel}.js              # runtimes servidos (GERADOS — não editar à mão)
```

---

## Convenções

- **Um único estado**: todo o dashboard usa um `useTraffikState` central, provido
  via `TraffikContext`. As páginas de rota são finas:
  `"use client"; const v = useTraffik(); return <XView v={v} />;`
- **Dados do servidor**: buscados em `dashboard/(app)/layout.tsx` e passados como
  props iniciais → `DashboardShell` → `useTraffikState`. Polling (dashboard, ads,
  criativos, notificações) é feito no hook via `fetch` para as rotas `/api/*`.
- **Mutações**: server actions em `src/lib/actions/*` (retornam DTOs serializáveis)
  ou rotas `/api/*` quando precisa de request/response. Sempre guardadas por `auth()`.
- **Estilo**: inline via `sx("prop:valor;...")` + variáveis CSS (`var(--color-...)`,
  `var(--space-N)`). Siga o padrão dos componentes existentes; não recriar o visual.
- **Rotas**: rotas reais do Next sob `dashboard/(app)/`. O grupo `(app)` tem o shell;
  quem precisa fugir do shell (test-checkout) fica fora do grupo.
- **Prisma**: singleton em `src/lib/prisma.ts` (driver `pg`). **Migrations** usam
  `DIRECT_URL` (session pooler 5432, definido em `prisma.config.ts`); **o app** usa
  `DATABASE_URL` (transaction pooler 6543).
- **Idioma**: UI e comentários em português.

---

## Variáveis de ambiente (`.env`)

| Var | Uso |
|-----|-----|
| `DATABASE_URL` | Supabase **transaction pooler 6543** (app). Sufixo `?sslmode=require&uselibpqcompat=true`, **sem** `pgbouncer=true`. Senha URL-encoded. |
| `DIRECT_URL` | Supabase **session pooler 5432** — só para migrations do Prisma |
| `AUTH_SECRET` | segredo do Auth.js (`openssl rand -base64 32`) |
| `AUTH_URL` / `NEXT_PUBLIC_APP_URL` | URL pública (localhost em dev; domínio Vercel em prod) |
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | app do Facebook (Marketing API) |
| `FACEBOOK_REDIRECT_URI` | precisa bater com o registrado no app do Facebook |
| `CRON_SECRET` | protege as rotas `/api/cron/*` (o Vercel Cron manda como Bearer) |
| `REDIS_URL` | **não usado** (BullMQ foi substituído por Vercel Cron) |

Na **Vercel** só o `DATABASE_URL` (pooler) é necessário para o banco — a Vercel
não roda migrations, então `DIRECT_URL` fica só local.

### Rodar localmente
```bash
npm install
npx prisma generate
npx prisma migrate deploy      # aplica migrations no Supabase (usa DIRECT_URL)
npx prisma db seed             # cria teste@traffik.io (senha impressa na saída)
npm run dev                    # http://localhost:3000
```

**Contas:** `teste@traffik.io` (seed, vazia) · `pedrodurso8@gmail.com` (dono;
1 perfil FB + 6 contas reais).

> ### 🔴 NENHUMA SENHA NESTE ARQUIVO. Nunca mais.
> Este bloco listava as duas em texto puro — a do seed e **a da
> conta do dono em produção**. O `CLAUDE.md` é versionado: qualquer um com
> acesso ao repositório tinha as duas.
>
> A do seed agora é **gerada aleatoriamente** e impressa uma vez (ou vem de
> `SEED_PASSWORD`, no `.env`, que é gitignored). A do dono é dele e não pertence
> a lugar nenhum do repositório.
>
> ⚠️ **A senha do dono está no histórico do git e precisa ser trocada** — o
> `CLAUDE.md` foi commitado com ela. Reescrever o histórico não basta se o
> repositório já foi clonado ou espelhado; a única correção real é **trocar a
> senha**.

---

## Status dos blocos (roteiro v2)

| Bloco | Descrição | Status |
|-------|-----------|--------|
| 1 | Reestruturação da navegação (rotas reais) | ✅ **Feito** |
| 2 | Grid arrastável do Dashboard | ✅ **Feito** |
| 3 | Filtros e container do topo | ✅ **Feito** |
| 4 | Métricas do Dashboard (ROI×, ARPU, CPA, por horário…) | ✅ **Feito** |
| 5 | Gráficos (funil, mapa de países, donuts, taxa de aprovação) | ✅ **Feito** |
| 6 | Gerenciador de Anúncios: layout+colunas estilo FB | ✅ **Feito** |
| 7 | Gerenciador: painel de ações em massa (CBO/ABO) | ✅ **Feito** |
| 8 | Regras: reformulação completa (modal, import/export) | ⏳ pendente |
| 9 | Integrações › Anúncios (vitrine de perfis) | ✅ **Feito** |
| 10 | Integrações › Webhooks (Kirvano + credenciais de API) | ✅ **Feito** |
| 11 | Integrações › UTMs (códigos xcod + scripts) | ✅ **Feito** |
| 12 | Integrações › Pixel (script próprio) | ✅ **Feito** |
| 13 | Integrações › Testes (central de diagnóstico) | ✅ **Feito** |

Ordem recomendada do roteiro: 1 → 9,10,11,12,13 → 2 → 3,4 → 5 → 6,7 → 8.

**Todas as Integrações (9–13) estão concluídas.** O próximo é o **Bloco 2**
(grid arrastável do Dashboard).

---

## Decisões técnicas relevantes

- **Rotas + contexto compartilhado** em vez de estado por rota: um único
  `useTraffikState` no `DashboardShell` provido via contexto evita múltiplos loops
  de polling. Páginas de rota são wrappers finos.
- **Grupo `(app)`** só para permitir que `test-checkout` fuja do shell (sidebar).
- **Prisma 7 exige driver adapter** (`pg`). Pooler para o app, session pooler para
  migrations. Para o Supabase, remover `pgbouncer=true` e usar
  `?sslmode=require&uselibpqcompat=true`.
- **BullMQ → cron externo** (serverless não roda worker). Foi Vercel Cron até
  descobrirmos que o plano Hobby só aceita cron diário e **rejeita o deploy inteiro**
  com `*/15`. Hoje o agendamento vive em `.github/workflows/cron.yml` (GitHub Actions):
  `sync-facebook` e `run-rules` a cada 15min, `reports` de hora em hora. As rotas
  `/api/cron/*` seguem protegidas por `CRON_SECRET`. Ver a seção de deploy.
- **Atribuição venda→campanha/criativo é "best-effort"** por `utm_campaign` = nome
  da campanha (e `utm_content` = nome do anúncio). Enquanto os UTMs não baterem com
  os nomes, "Vendas/ROAS" por campanha/criativo aparecem zerados. O **Bloco 11**
  (parser do `xcod` da Hotmart com `campaign.id/adset.id/ad.id`) é o que torna isso
  confiável — vários blocos dependem dele para métricas de venda corretas.

---

## 🗄️ DOIS BANCOS: dev e produção (29/07/2026)

| | Ref | Região | O que tem | Onde as credenciais vivem |
|---|---|---|---|---|
| **PRODUÇÃO** | `dgaoucxkmpdxeenpfqth` | us-east-1 | Dados reais do usuário | **Só** nas Environment Variables da Vercel |
| **DESENVOLVIMENTO** | `drdfnazladzkxlqpgdzt` | ca-central-1 | Dados falsos do `seed:dev` | No `.env` da máquina |

> ### ⛔ O `.env` LOCAL SEMPRE APONTA PARA DESENVOLVIMENTO
> Credencial de produção **não pode existir em arquivo local**. Enquanto ela
> estiver no `.env`, um clique em "Excluir" no localhost apaga dado real — foi
> exatamente assim que o incidente aconteceu.
>
> `DIRECT_URL` fica **só local** (migrations rodam da máquina, nunca na Vercel).
> `REDIS_URL` não é usada por nada.

### Como saber em qual banco você está — duas respostas, sem abrir o `.env`

1. **Faixa listrada amarela no topo do painel** (`src/lib/dbEnv.ts` →
   `DashboardShell`), com o rótulo, o ref e "os dados desta tela são falsos".
2. **`npm run db:onde`** — imprime ref, região, porta e se a escrita de script
   está liberada. É o comando para rodar ANTES de qualquer script.

> ⚠️ **A faixa aparece quando o banco NÃO é a produção — inclusive quando é
> desconhecido.** Produção não ganha faixa de propósito: é o estado normal de
> quem usa a ferramenta, e faixa permanente vira ruído que se aprende a ignorar
> — inclusive quando ela mudar para dizer outra coisa.
>
> ⚠️ `dbEnv.ts` lê `process.env.DATABASE_URL`, que **não existe no navegador**.
> Chame no layout (server component) e passe como prop: o que vai para o
> cliente é só o rótulo e o ref, nunca a URL com senha.

### `guard-db.mjs` virou LISTA DE PERMISSÃO

Era lista de **bloqueio** ("estes refs são produção"). O problema apareceu na
prática ao criar o segundo projeto: os dois refs foram confundidos entre si numa
mensagem. Com lista de bloqueio, **um ref desconhecido passa direto** e o script
escreve num banco que ninguém classificou — o cenário exato do incidente.

Hoje só os refs em `DESENVOLVIMENTO` aceitam escrita. O pior caso passou a ser
um bloqueio indevido, que aparece na hora e se resolve com uma linha. É a mesma
regra da autenticação das rotas: **a dúvida vira bloqueio, nunca liberação.**

**Testado:** ref de dev → permite; ref de produção → bloqueia; ref desconhecido
→ bloqueia; `localhost` → permite (não sai da máquina).

### Backup

`npm run backup` → `backups/traffik-<ref>-<data>.jsonl` · `npm run restore <arquivo>`

- **Só DADOS.** O schema vive em `prisma/migrations`. Restaurar é
  `prisma migrate deploy` **e depois** o restore — nessa ordem.
- **JSONL com `to_jsonb`/`jsonb_populate_record`**: quem serializa e
  desserializa é o Postgres. Montar `INSERT` à mão é onde backup caseiro
  corrompe array, Json e Decimal em silêncio.
- O restore calcula a **ordem topológica pelas FKs reais do destino**, não por
  uma lista fixa que envelheceria a cada tabela nova. `_prisma_migrations` fica
  de fora: quem manda no estado das migrations é o `migrate deploy`.
- **`/backups` está no `.gitignore`** — o arquivo tem e-mail de comprador, hash
  de senha e tokens. Nunca versionar.

> **Frequência:** antes de **toda migration destrutiva** (`DROP`, `RENAME`,
> `NOT NULL`) e antes de qualquer script que escreva em produção — sem exceção.
> Fora isso, **semanal** enquanto não houver PITR. O banco todo tem ~500 KB;
> não há motivo para economizar backup.
>
> ⚠️ **PITR é add-on pago do plano Pro.** No Free não existe recuperação
> point-in-time: o `npm run backup` é o único backup que existe.
>
> ⚠️ **Não cobre** usuários do Postgres, extensões, RLS nem o schema `auth` do
> Supabase. Este projeto não usa nada disso (auth é NextAuth na tabela `User`).

### Variáveis obrigatórias na Vercel (Production)

`DATABASE_URL` · `AUTH_SECRET` · `AUTH_URL` · `NEXT_PUBLIC_APP_URL` ·
`ENCRYPTION_KEY` · `CRON_SECRET` · `FACEBOOK_APP_ID` · `FACEBOOK_APP_SECRET` ·
`FACEBOOK_REDIRECT_URI`

> ⚠️ `AUTH_SECRET` **não aparece em `grep process.env`** — o NextAuth v5 a lê
> sozinho do ambiente. É obrigatória do mesmo jeito.
>
> ⚠️ A `ENCRYPTION_KEY` da Vercel tem de ser **idêntica** à que encriptou os
> dados. Chave diferente torna ilegível tudo que já foi gravado, e não há
> rotação implementada.

## 🔒 Autenticação de webhook e cron: FALHA FECHADA (29/07/2026)

**Regra do projeto: ausência de configuração NUNCA vira permissão.** Toda
validação de segredo recusa quando o segredo não está configurado.

| Ponto | Antes | Agora |
|---|---|---|
| `/api/cron/*` | `if (secret && …)` — **público sem a env var** | `cronAuth.ts` recusa 401 sem `CRON_SECRET` (inclusive vazia/só espaços) |
| `/api/webhook/kirvano` | `if (webhook.secret) {…}` — webhook sem token aceitava **qualquer payload** | token obrigatório; sem ele, 401 |
| `/api/webhook/sale/[token]` | **não selecionava `secret`** — validação totalmente ignorada | exige o token quando configurado; KIRVANO sem token → 401 |

> ### 🔴 O bypass que quase passou despercebido
> As duas rotas de webhook aceitam **o mesmo `Webhook.token`**. Endurecer só a
> `/api/webhook/kirvano` não teria adiantado nada: bastava trocar
> `?id=X` por `/api/webhook/sale/X` para cair na rota que nem lia o `secret`.
> **Ao mexer na autenticação de uma rota, procure as outras que aceitam a mesma
> credencial** — endurecer uma porta com a outra aberta é teatro.

**Por que venda falsa é grave aqui:** não é só número errado no dashboard. Ela
dispara `Purchase` na CAPI do Facebook e envenena a otimização da campanha, com
dinheiro real em jogo.

**Comparação em tempo constante** (`secretsMatch`, de `crypto/secrets.ts`) em
todos os pontos: `===` em string vaza pelo tempo de resposta quantos caracteres
iniciais bateram, e esses segredos viajam em toda requisição do gateway.

**Testado com `curl` contra o dev server:** cron sem header → 401, header errado
→ 401, **prefixo parcial do secret → 401**, header correto → 200; Kirvano sem
`security-token` → 401, com token errado → 401; **`/api/webhook/sale/<token>`
sem secret → 401** (antes, aceitava sem checar nada).

> ⚠️ Auditado também: `encryptionKey()` **lança** se `ENCRYPTION_KEY` faltar (não
> cai para texto puro); `/api/webhook/ingest` recusa chave ausente **e revogada**;
> a busca da chave é por `keyHash` indexado, não por comparação de string.
> `/api/track/click` e `/api/pixel/event` são públicos **por desenho** — rodam no
> site do cliente — e validam a posse do recurso pelo id.

## 🔴🔴 INCIDENTE (29/07/2026): teste em localhost escreveu no banco REAL

**O que aconteceu:** durante a verificação das Áreas de Trabalho, scripts de
teste rodaram `UPDATE`/`DELETE` no Supabase — que é o **mesmo banco da
produção**. Dois erros distintos, e o segundo é o grave:

1. `DELETE FROM "Workspace" WHERE "userId" = <teste@traffik.io>` — apagou
   **todas** as áreas daquele usuário, não só as que o teste criou.
2. `UPDATE "Workspace" SET ... WHERE "name" = 'Area A'` — **sem `userId` no
   `WHERE`**. Um `WHERE` por nome atravessa usuários: qualquer área de qualquer
   conta com aquele nome teria a configuração zerada, em silêncio.

É a segunda vez que a mesma causa raiz morde (a primeira foi o `DROP COLUMN` da
`20260728120000`, que derrubou o dashboard em produção). **A causa não é
descuido pontual — é não existir separação de ambiente.**

### Regras permanentes de teste enquanto houver UM banco só

| | Regra |
|---|---|
| 1 | **Nada de escrita em tabela de dado de negócio** para testar: `Workspace`, `Sale`, `Click`, `PixelEvent`, `AdAccount`, `Webhook`, `PixelConfig`, `Campaign`… Verificação vira **leitura** (`SELECT`) + asserção sobre o que já existe |
| 2 | Todo `UPDATE`/`DELETE` de manutenção leva **`userId` no `WHERE`**, sempre — nunca `WHERE name = '...'` |
| 3 | Script que escreve **importa `scripts/guard-db.mjs`** e chama `exigirBancoDeDesenvolvimento()` na primeira linha |
| 4 | Limpeza apaga **por id coletado na criação**, nunca por `LIKE`/nome |
| 5 | Migration pode rodar (é aditiva e necessária), mas **`DROP`/`RENAME` de coluna exige dois deploys** — ver o incidente da `20260728120000` |
| 6 | Quando o teste **exigir** escrita de dado de negócio, a resposta é **não testar assim**: descrever o que ficou sem verificação em vez de escrever no banco do usuário |

> ⚠️ **`guard-db.mjs` protege SCRIPTS, não o app.** `npm run dev` continua
> usando a `DATABASE_URL` do `.env` — se ela apontar para produção, clicar
> "Excluir" no navegador apaga de verdade. A separação de ambiente é o que
> resolve isso; a trava só evita o tiro pela linha de comando.

### Ferramentas criadas

- **`scripts/guard-db.mjs`** — `exigirBancoDeDesenvolvimento()`. Compara a
  `DATABASE_URL` com a lista de refs de produção e aborta. Só passa com
  `ALLOW_PROD_WRITES=EU_QUERO_MESMO_ESCREVER_EM_PRODUCAO`, escrito por extenso
  no comando, a cada execução — **de propósito não existe `--force` curto nem
  arquivo que desligue de forma permanente**, porque atalho curto vira hábito.
- **`scripts/seed-dev.mjs`** (`npm run seed:dev` / `seed:dev:limpar`) — popula um
  banco de desenvolvimento com dados **sintéticos**: 1 usuário
  `dev@exemplo.dev`, 2 contas de anúncio, 2 webhooks, 2 pixels, 8 vendas, 8
  eventos de pixel. **Nunca copia dado real** — copiar dump da produção
  espalharia e-mail de comprador e token válido por máquina de desenvolvimento.
  `--limpar` apaga o usuário e o cascade leva o resto.
- `scripts/demo-data.mjs` passou a chamar a trava.

## ⛔ REGRA PERMANENTE: `NULL` não significa a mesma coisa em toda coluna

**Antes de qualquer operação que anule (ou deixe anular) um `workspaceId`,
verifique o que NULO significa NAQUELA coluna.** Não é uniforme:

| Coluna | `NULL` significa | Anular é… |
|---|---|---|
| `AdAccount.workspaceId` | sem dono → aparece na Principal | seguro |
| `Webhook.workspaceId` | sem dono → aparece na Principal | seguro |
| `PixelConfig.workspaceId` | sem dono → aparece na Principal | seguro |
| `Click.workspaceId` | script antigo, sem área declarada | seguro |
| **`AutomationRule.workspaceId`** | **regra GLOBAL — age em TODAS as contas** | 🔴 **amplia escopo** |
| **`Expense.workspaceId`** | **vale para TODAS as áreas** | 🔴 **amplia escopo** |
| `ApiCredential.workspaceId` | sem dono → Principal | seguro |

Nas duas linhas vermelhas, `onDelete: SetNull` **não é um estado neutro** — é uma
promoção de escopo. Foi assim que excluir uma área transformava "pause as
campanhas desta operação" em "pause as de TODAS as contas", com a regra ainda
ativa e dinheiro real em jogo.

> ⚠️ O mesmo cuidado vale para **coluna nova**: ao criar um `workspaceId`,
> decida e **documente no schema** se nulo é "sem dono" ou "global". Sem isso, o
> próximo `SetNull` herda o significado errado por acidente.

## 🪟 Camadas flutuantes: SEMPRE via `ui/Drawer` ou `ui/Modal`

**Nunca escreva um popup à mão.** Existem dois componentes, e os dois passam pelo
mesmo `ui/useOverlay.ts`, que é onde vive a correção do bug de sobreposição:

| Componente | Quando |
|---|---|
| `ui/Drawer.tsx` | Detalhe de um item da listagem (URL de webhook, config de pixel, contas do perfil) |
| `ui/Modal.tsx` | Diálogo curto e centralizado (confirmação, "ver opções", formulário de 1 campo) |

> ⚠️ **A causa do bug, para não se repetir:** um overlay é `position:fixed`, e
> **qualquer ancestral com `transform` vira o bloco de contenção dele**. O `.page-enter`
> do shell anima com `translateY`, então popups escritos direto na árvore da página
> cobriam apenas a caixa da página — apareciam **colados no topo, cortados, com o
> conteúdo de trás vazando por cima**. `useOverlay` resolve portando para o `<body>`
> via `createPortal`, e ainda entrega Esc, trava de scroll do fundo e foco preso.

A classe `.dialog-backdrop` continua no `globals.css` só por herança e **não deve ser
usada em código novo** — ela não porta para o body. Hoje **nenhum `.tsx` a usa**.

Migrados nesta rodada (eram os 3 últimos com o modelo antigo): "Parâmetros de URL"
(UTMs), "Adicionar Credencial" (Webhooks) e "Alterar orçamento" (Gerenciador).

## 🔜 DUAS PERGUNTAS ABERTAS DO FUNIL — não abrir antes do Gerenciador

Levantadas pelo dono em 07/08/2026, a partir dos 97,1% de perda no primeiro
trecho. **Anotadas, não decididas.**

**1. A partir de que perda o rastreamento deixa de ser observação e vira
ALERTA?** Perda de 97% entre `Cliques` e `Sessões` não é característica de
campanha — é instalação quebrada. E `Alertas` é bloco estrutural justamente
para o que exige ação.

**2. As taxas rio abaixo devem declarar a BASE sobre a qual foram medidas?**
Com 1.220 → 35, tudo que vem depois é medido sobre **2,9% do tráfego**. "IC →
Venda a 100%" é 100% de 35 pessoas, não do funil. No dev é seed; em produção,
num cliente com snippet mal instalado, é um funil inteiro contando história
sobre uma amostra **que ninguém sabe que é amostra**.

⚠️ A alternativa barata é considerar que a etapa 1→2 estar visível logo acima já
declara a base. A cara é cada taxa carregar o denominador. A decisão é do dono.

## 🔜 PENDÊNCIA: o `test:contraste` confere uma LISTA MANTIDA À MÃO

Registrada em 07/08/2026, **não executada**, e ela junta com a pendência antiga
de rasterizar num canvas 1×1.

O traço de ligação da pílula do funil nasceu pintado com `--tk-pilula`, que no
escuro é `#090D14` — **mais escuro que o card**. Contraste de **1,15:1**: o
elemento existia no DOM e não existia na tela. **O `test:contraste` estava
verde**, porque ele mede os pares que alguém lembrou de cadastrar, e esse par
nunca foi cadastrado.

É a terceira vez que algo existe no DOM e não na tela (resumo do gargalo do
funil · hachura do heatmap a `rgba(0,0,0,0)` · este traço).

> ### ⛔ O DEFEITO É ESTRUTURAL: lista à mão fica atrás do código, sempre.
> O teste precisa **enumerar o que foi PINTADO**, não conferir pares
> cadastrados. As duas metades do conserto:
>
> 1. rasterizar num canvas 1×1 para ler a cor final (`getComputedStyle` devolve
>    `lab(...)` neste projeto, e comparar string de cor não mede nada);
> 2. varrer os elementos desenhados em vez de uma lista de tokens.
>
> ⚠️ O custo já foi levantado e é alto: navegador headless + dev server +
> sessão, e o cookie do NextAuth é `httpOnly`.

⚠️ **Prima disto, em outra camada:** uma asserção do piso da fita usava
`[100, 0, 5]`, cujo valor já dava 6,5px — acima do piso, que portanto nunca
entrava. Ela passava sem exercitar o que alegava medir. **As duas passam, as
duas não olham nada.**

## Dívidas técnicas conhecidas

Registradas de propósito — **não são bugs esquecidos**, são decisões tomadas.

| # | Dívida | Por quê / risco |
|---|--------|-----------------|
| 0 | ~~**`PixelEvent.espelho` sem leitor**~~ e ~~**detector congelado sem aviso**~~ ✅ **RESOLVIDOS em 31/07/2026 (3ª parte)** — card na aba Testes e aviso na gaveta do Pixel. | Fica só a confirmação no Gerenciador de Eventos da Meta, que é do usuário. |
| 1 | ~~**Dedup parcial dos eventos de pixel.**~~ ✅ **RESOLVIDO em 31/07/2026.** `eventId` determinístico (`057c06e`), espelho no `fbq` (`057c06e`, que **nunca rodou** até `0fa68d1`) e partição por dono do evento (`e755894`). Verificado em produção: `eid=InitiateCheckout-90whss` saindo pelo navegador com o mesmo id da CAPI, e **confirmado no Gerenciador de Eventos da Meta** — entrada única, "API de Conversões e navegador". | ✅ **Nada.** As duas pontas estão provadas: a nossa (o id sai igual dos dois lados) e a da Meta (ela juntou). O detector congelado saiu na 3ª parte de 31/07. |
| 2 | ~~**Nav morto no `useTraffikState`**~~ | ✅ **FEITO em 05/08/2026** — −283 linhas. Levou também o `ruleForm`, o `EditDashboardDrawer` inalcançável e o `listRules()` que o layout fazia em todo pageview sem consumidor. |
| 3 | **Atribuição por nome é ambígua** quando dois anúncios/campanhas têm o mesmo nome. | Limitação pré-existente; o id resolve para tráfego novo com os códigos do Bloco 11. O Teste de Tracking (Bloco 13) agora **avisa** quando o casamento foi por nome. |
| 4 | **`WebhookLog` sem retenção nem paginação.** | Cresce indefinidamente. Falta cron de purga. |
| 5 | **`AdProfile.accessToken` e `Webhook.secret` ainda em texto puro.** | Fora do escopo da encriptação pedida (que cobriu `MetaPixel`/`ApiCredential`). Mesmo helper serve se forem migrados. |
| 6 | **Sem rotação de `ENCRYPTION_KEY`.** | Trocar a chave torna ilegível o que já foi gravado. Uma rotação exigiria decriptar com a chave antiga e re-encriptar com a nova. |

---

---

## ⛔ PROCEDIMENTO OBRIGATÓRIO: passar no build não prova que está EM USO

**Três casos na mesma sessão (30/07/2026), todos "entregues" e todos inertes:**

| O que | Estado real | Como foi descoberto |
|---|---|---|
| Base de países IP→país | pronta, testada, commitada — **consultada por ninguém** | por acaso, uma sessão depois |
| Resumo do gargalo do funil | no DOM, **invisível** desde que foi escrito | ao conferir outra coisa na tela |
| `/api/cron/manutencao` | rota completa, **nunca agendada** — rodou zero vezes | ao ir criar uma rota que já existia |
| Consulta da purga de IP | escrita e testada por função pura — **nunca executada contra linha nenhuma** | o usuário perguntou |
| **`Sale.apiCredentialId`** | **6 leitores, ZERO escritores** — coluna sempre nula | ao mapear o `receber.ts` da etapa 1 |
| **`NOTA_DO_EVENTO`** (`lib/pixel/donos.ts`) | exportada e **importada por nenhum arquivo** — e o TEXTO dela mandava fazer o que a reforma do pixel eliminou | ao ler a gaveta do Pixel na auditoria de microcópia (31/07/2026) |

> ### 🔴🔴 CÓDIGO MORTO CUJO TEXTO CONTRADIZ A ARQUITETURA É PIOR QUE CÓDIGO MORTO COMUM
>
> Os cinco casos acima eram inertes e **corretos**: religá-los faria a coisa
> certa. Este é de outra categoria.
>
> `NOTA_DO_EVENTO` era um aviso por evento, e só o `PageView` tinha um. Ele
> dizia:
>
> > *"Escolha Traffik só se você NÃO tiver o pixel do Facebook na página."*
>
> A reforma da gaveta (`cf19351`) parou de renderizá-lo e ninguém removeu a
> constante. Mas o texto **ficou contra a reforma**: ele pede para o usuário
> trocar o dono do `PageView` na mão, e é exatamente esse caminho que deixa o
> script instalado defasado em silêncio (o `ALHEIOS` é assado na geração). Hoje
> quem responde isso é a PERGUNTA do preset, que muda os donos **e** o
> comportamento do script de uma vez.
>
> **Voltar a renderizá-lo instruiria o usuário a reintroduzir o bug que a
> reforma consertou** — e pareceria uma correção, porque o aviso é útil e bem
> escrito. Código morto comum, no pior caso, não faz nada.
>
> ### ⛔ REGRA QUE FICA
> **Ao remover uma tela ou uma seção, procure as constantes de texto dela — e
> pergunte se alguma descreve comportamento que MUDOU.** Órfã que apenas
> descreve algo que ainda é verdade é dívida cosmética; órfã que descreve o
> comportamento antigo é uma armadilha esperando o próximo commit que a
> "reaproveite".
>
> O `grep` pelo nome do símbolo fora do próprio arquivo responde a primeira
> metade. A segunda só a leitura responde.

> ### 🔴 O 5º caso é o mais caro — e o mais silencioso
> `Sale.apiCredentialId` é o **passo 4 da precedência de área** ("credencial de
> API dona"). Ele é lido em `areas/precedencia.ts`, `dashboard/metrics.ts`,
> `ads/overview.ts`, `ads/creatives.ts`, `areas/exclusao.ts` e
> `actions/notifications.ts` — **seis lugares** — e não era escrito em lugar
> nenhum. Toda venda ingerida por chave de API caía na Principal, e o ramo
> inteiro da precedência nunca disparou nem uma vez.
>
> **51 dos 115 payloads reais de produção entraram por essa porta.**
>
> Nada denunciava: a coluna existe, o schema está certo, os seis leitores tratam
> `null` como "sem credencial" — que é indistinguível de "credencial não
> registrada". `tsc`, `lint`, `build` e todos os testes passavam.
>
> ⚠️ **Backfill é impossível, e por um motivo que vale registrar:** o
> `WebhookLog` não guarda qual credencial autenticou a requisição, e a
> `ApiCredential` tem **zero linhas em produção** — as chaves usadas nos testes
> dos Blocos 10 e 13 foram excluídas depois. Mesmo que a coluna tivesse sido
> preenchida na época, o `onDelete: SetNull` a teria zerado. As 8 vendas
> ingeridas por chave continuam na Principal, o que é **correto**: nenhuma
> credencial existente as reivindica. Corrigido para as próximas.

O denominador comum: **`tsc`, `lint`, `build` e os testes passam com a coisa
desligada.** Nenhuma dessas ferramentas pergunta "alguém chama isto?".

### Antes de reportar QUALQUER coisa como entregue, verifique que está sendo EXERCIDA

| Tipo | A pergunta | Como responder |
|---|---|---|
| Função nova | **quem importa?** | `grep` pelo nome fora do próprio arquivo e do teste |
| Rota de API | **quem chama?** | `grep` pelo caminho; se for cron, **está no `.github/workflows/cron.yml`?** |
| Elemento de tela | **aparece?** | ver **na tela**, não no `find` do DOM — ver o caso do funil |
| Coluna nova | **quem lê e quem escreve?** | os dois lados; só escrever é dado morto |
| Consulta de manutenção | **rodou contra linha de verdade?** | semear no dev o estado que ela deve encontrar |
| Campo novo da Graph API | **veio preenchido?** | sonda que mostra a resposta CRUA |
| **Agregação / métrica** | **o número muda com dado que exercite o caso?** | teste PONTA A PONTA que semeia o caso e lê o resultado final |
| **Automação que AGE** | **o que ela NÃO deveria tocar está fora do escopo?** | asserção sobre o que ficou de fora, não só sobre o alvo |

> ### 🔴 Métrica exige teste ponta a ponta — a função certa não basta
> Acrescentado em 31/07/2026, depois de **três armadilhas na mesma etapa**, todas
> do mesmo tipo: **número plausível e errado, sem `tsc`/`lint`/`build` acusar.**
>
> | Armadilha | O que produzia |
> |---|---|
> | `pedidoId` fora do `select` | `chaveDoPedido` cai no `id` e **toda contagem volta a ser por item**, em silêncio |
> | `umPorPedido` num laço que SOMA valor | contagem certa e **faturamento do order bump descartado** |
> | `Set` de pedidos global em vez de por destino | a segunda atribuição da mesma venda é descartada e **o nível de anúncio zera** |
>
> `contarPedidos` estava correta e testada isolada nas três. O que falhava era o
> **caminho** — de onde o dado vem, em que laço ele entra, com qual chave.
>
> **A regra:** métrica nova ou alterada leva um teste que semeia o caso e lê o
> número no fim da cadeia (`computeDashboard`, `computeAdsOverview`), não só a
> função pura. É o que `npm run test:pedidos` faz.

> ### 🕐 A regra do FUSO vale para script e teste, não só para produção
> `teste-pedidos.mjs` semeava o gasto com `CURRENT_DATE`, que é o dia do BANCO
> (UTC). Rodando às **00h01 UTC = 21h01 em Brasília**, o gasto caiu no dia
> seguinte e o CPA veio 0 — a janela exata descrita em "Fuso horário — causa
> raiz", pegando o próprio teste que existe para provar a métrica.
>
> Hoje ele semeia com `(now() AT TIME ZONE 'America/Sao_Paulo')::date`.
>
> **Nenhuma agregação usa o dia do processo — e nenhum teste deveria semear com
> ele.** Um teste que falha só depois das 21h é pior que um teste que falha
> sempre: ele passa no horário em que se costuma rodar e quebra sozinho à noite.

> ### 🔴 "Compila e tem teste" ≠ "está funcionando no sistema"
> Teste de função pura prova que a função está certa. **Não prova que ela é
> chamada**, nem que a consulta que a usa acha as linhas certas, nem que o
> resultado chega à tela.
>
> Ao criar rota de cron, **agende no mesmo commit**. Ao criar consulta de
> manutenção, **rode contra linhas semeadas no dev** antes de dizer que funciona.

---

## ⛔ PADRÕES NOMEADOS — as regras que custaram caro

Cada linha é uma regra que já foi violada nesta base, com consequência medida.
A **regra** está aqui; o **caso completo** (sintoma, causa raiz, e por que a
correção óbvia estava errada) está no arquivo indicado.

### Quem decide o vencedor é o BANCO, não o processo

Em serverless não há estado compartilhado entre instâncias. Toda corrida se
resolve com uma instrução condicional cujo `WHERE` só passa para um; quem recebe
`count: 0` desiste. **Já usado quatro vezes**: reserva do auto-sync, upsert
monotônico de venda, `garantirAreaPrincipal`, reserva do `run-rules`.

⚠️ **Nunca `create` + `catch`** para resolver corrida: a perdedora lê a linha da
vencedora *antes do commit* e o erro real fica escondido no `catch`. Use
`createMany({ skipDuplicates: true })`.
→ `docs/regras/padroes-nomeados.md`

### `NULL` não significa a mesma coisa em toda coluna

Antes de anular (ou deixar anular) um `workspaceId`, verifique o que nulo
significa **naquela** coluna. Em `AutomationRule` e `Expense` nulo é **GLOBAL**,
então `SetNull` **amplia escopo** — foi assim que excluir uma área transformou
"pause as campanhas desta operação" em "pause as de TODAS as contas".
→ tabela completa na seção própria, abaixo.

### Nenhuma agregação usa o dia do PROCESSO

`getHours()`, `setHours(0,0,0,0)`, `toDateString()` respondem no `TZ` do processo
— que na Vercel é UTC. Tudo passa por `lib/timezone.ts`, com o fuso do usuário.
**Vale para script e teste também**: um teste que semeia com `CURRENT_DATE` passa
de dia e quebra sozinho depois das 21h.
→ `docs/regras/padroes-nomeados.md`

### Ausência de configuração NUNCA vira permissão

Toda validação de segredo **recusa** quando o segredo não está configurado
(`cronAuth`, webhooks, `encryptionKey`). Comparação em tempo constante
(`secretsMatch`). E ao endurecer uma rota, **procure as outras que aceitam a
mesma credencial** — endurecer uma porta com a outra aberta é teatro.
→ a seção própria, abaixo.

### Duas implementações da mesma conta divergem sempre

E quando as duas erram **igual**, é pior: a divergência que denunciaria o erro
não existe. Foi assim que `whereDespesasDaArea` e `whereDespesas` descartaram
**toda despesa cadastrada** do cálculo de lucro, e a listagem concordava com o
número errado. **Dois lugares que fazem o mesmo filtro compartilham a função.**
→ `docs/historico/2026-08-04-a-05-testadores-e-limpeza.md`

### Coluna fora do `select` chega `undefined` — e nada acusa

A armadilha do `pedidoId`, paga quatro vezes. `tsc`, `lint` e `build` passam; o
número sai plausível e errado. O conserto é **estrutural**: uma constante
espalhada (`CAMPOS_UTM`, `CAMPOS` do `matchClick`), nunca a disciplina de listar
os campos à mão em cada consulta.

⚠️ O `rule as unknown as RuleRow` do motor de regras esconde a mesma coisa do
lado do TIPO: coluna nova no schema precisa entrar na interface à mão.
→ `docs/regras/padroes-nomeados.md`

### Controle que não controla nada é pior que código morto

Código inerte não faz nada e ninguém depende dele. Um **controle** inerte produz
uma crença: o usuário desliga o toggle, vê a tela confirmar, e decide com base
nisso. **Ao entregar um controle, o teste não é "salva?" — é "quem LÊ o que ele
salvou?".** Varredura de 04/08: 4 inertes de ~40.
→ `docs/historico/2026-08-04-a-05-testadores-e-limpeza.md`

### Uma asserção precisa poder FALHAR pelo motivo que ela alega medir

Se os dois desfechos possíveis produzem o mesmo valor observado, a asserção não
mede nada — passa por coincidência e quebra por acaso. Pergunte **qual valor o
caso ERRADO produziria**.

⚠️ E **contagem de violações `=== 0` passa com a coleção VAZIA**: prove primeiro
que houve o que examinar. Três asserções desta base estavam nesse estado.
→ `docs/historico/2026-08-04-a-05-testadores-e-limpeza.md`

### Comentário que afirma um efeito é uma afirmação TESTÁVEL

`eventId: sale.id // dedup com o pixel do navegador` — a dedup nunca funcionou,
desde o primeiro commit do pixel. Se o comentário diz "isto deduplica", tem de
existir o outro lado do par, e o `grep` que procura leva 10 segundos.

⚠️ E ao **remover** uma tela ou seção, procure as constantes de texto dela: órfã
que descreve o comportamento ANTIGO é uma armadilha esperando o próximo commit
que a "reaproveite".
→ o PROCEDIMENTO, abaixo (7º caso)

### Ao endurecer um alarme, procure as OUTRAS SAÍDAS do mesmo módulo

Módulo de diagnóstico quase sempre tem mais de um caminho até a tela. Corrigir
uma saída de duas é pior que não corrigir nenhuma: a parte correta dá **falsa
garantia**. Vale para limiar, janela, filtro e autenticação.
→ `docs/historico/2026-08-01-ux-e-ambiente.md`

### Mudar QUANDO o estado é gravado muda o significado de todo erro no caminho

Mover uma gravação para antes de uma operação transforma um erro que era
tolerável (porque seria repetido) em erro definitivo e **mudo**. Ao mover, liste
o que pode falhar entre as duas e decida o que cada falha significa agora.
→ `docs/historico/2026-08-04-a-05-testadores-e-limpeza.md`

### Excluir configuração não pode apagar a PROCEDÊNCIA

`SetNull` preserva o dado e **destrói o contexto**. Todo atributo que responde
"de onde isto veio?" é **copiado para a linha quando ela nasce**, não derivado
por `join` na leitura. Já cobertos: `Sale.platform`, `Sale.utm*`.
→ `docs/temas/areas-de-trabalho.md`

### Simplifique jargão de PROGRAMAÇÃO, nunca de TRÁFEGO

ROAS, ROI, CPA, CTR, CPM, criativo, CBO, ABO, conjunto, pixel, UTM, gateway e
campanha são o vocabulário **nativo** do usuário. O que sai é o que só o
programador conhece: banco de dados, query, endpoint, payload, coluna, nullable,
FK, catch-all.

⚠️ `lib/explicacoes.ts` é mais completo do que parece — **confira antes de
"adicionar tooltip"**.
→ `docs/temas/ui-e-microcopia.md`

### Tela stale que EXIBE número é ruim; que ENTREGA artefato é armadilha

Pergunte o que a tela entrega, não o que ela mostra. Se o usuário leva algo dali
para fora — script, snippet, URL de webhook, chave — o componente stale deixa de
ser incômodo e vira **dado errado permanente** no site do cliente.

⚠️ A assinatura do defeito: componente cliente + server action escopada por área
+ chamada **sem o argumento** + `useEffect` com deps `[]`.
→ `docs/historico/2026-08-01-ux-e-ambiente.md`

### 🔴 RAZÃO COM DENOMINADOR ZERO — o mesmo defeito, TRÊS vezes numa sessão

Registrado em 06/08/2026, na reescrita do Dashboard. **A decisão está PENDENTE**
e o mapa completo é a próxima dívida a levantar.

| Onde | Como apareceu |
|---|---|
| Sparkline do ROAS | série do servidor com `Infinity`/`NaN` → `Math.max` vira `Infinity`, todo `y` vira `NaN`, e o `<path>` da área degenera num **retângulo cheio**: na tela, "uma barra azul sólida" |
| ROAS no hero × na faixa | o mesmo período mostrava **`0,00x` no hero e `—` na faixa**. Dois lugares, duas respostas para a mesma divisão por zero |
| `finance` e `despesaRows` | expunham **só a string formatada** (`"R$ 1.234,00"`). Quem precisa somar tem de reverter texto em reais |

O denominador comum: **cálculo e apresentação estão grudados em pelo menos três
lugares.** A pergunta que não tem dono é "divisão por zero é ZERO ou é
INDEFINIDO?" — e hoje ela é respondida de forma diferente em cada consumidor.

⚠️ **`0,00x` e `—` não são a mesma afirmação.** "ROAS zero" quer dizer que se
gastou e não voltou nada; "ROAS indefinido" quer dizer que **não se gastou**. A
primeira é um alerta, a segunda é ausência de dado — e a tela hoje mostra as duas
para o mesmo estado.

**Paliativo aplicado:** o `Sparkline` filtra não-finitos, e o `despesaRows` passou
a expor `value` numérico **ao lado** do `valueLabel` (o formatado fica: quem já
consome não pode quebrar). **O que falta:** o mapa de onde as razões são
calculadas, por que hero e faixa divergem, e quem mais consome.

### 🔴 CSS SEM CAMADA VENCE UTILITÁRIO DO TAILWIND — e o `sx()` escondia isso

O Tailwind emite **todo** utilitário dentro de `@layer utilities`, e **CSS sem
camada vence CSS em camada**. Então uma regra de elemento nua no `globals.css`
(`a { color: … }`) ganha de `.text-text-secondary`, `.text-text` e de qualquer
outra classe de cor — o componente pede uma cor e recebe outra.

**Por que só apareceu no shell:** as 41 telas legadas pintam com `sx()`, que
produz `style` inline, e inline vence tudo, inclusive regra sem camada. A
proteção era **acidental**, e ela some no instante em que um arquivo passa a usar
Tailwind — que é o que o redesign faz em toda tela nova.

Medido em 06/08/2026, no rail recém-reescrito: **6 de 10 âncoras pintadas com a
cor errada**. Os sete itens de menu saíam azuis, ativos ou não, e a distinção
ativo/inativo por cor havia sumido — só não virou defeito de legibilidade porque
o item ativo carrega fundo tingido **e** barra, os sinais redundantes que o
WCAG 1.4.1 obrigou a ter.

> ### ⛔ REGRA QUE FICA
> **Toda regra de elemento no `globals.css` que declare `color` precisa estar em
> `@layer base`.** Sem camada, ela sequestra a cor de todo componente novo.
>
> ⚠️ Só o `a` foi movido. **`h1`–`h6`, `p`, `img` e `figcaption` continuam nus** —
> o raio de explosão deles é outro e a decisão é do dono. Se um componente novo
> aparecer com tipografia sobrescrita sem explicação, é ali que se procura.

> ### 🔴 E NENHUMA FERRAMENTA DESTA BASE PEGOU
> `tsc`, `lint`, `build` e **`test:contraste`** passaram os quatro. O teste de
> contraste lê o `globals.css` e mede **pares de token** — ele não pergunta que
> cor um elemento acabou recebendo na árvore. É o mesmo buraco do "resumo do
> gargalo do funil": a coisa está no DOM, correta em teoria, e errada na tela.
>
> **Medir a cor PINTADA automaticamente é caro** — navegador headless + dev server
> + sessão, e o cookie do NextAuth é `httpOnly` (o mesmo bloqueio que travou o
> item (d)). O que é barato é o **guarda estático**: reprovar quando o
> `globals.css` declarar `color` em seletor de elemento fora de `@layer`. Mede a
> causa estrutural em vez do sintoma, e é ~15 linhas sem dependência nova.
>
> Para medir à mão, a técnica é **rasterizar num canvas 1×1** —
> `getComputedStyle` devolve `lab(...)` neste projeto, e comparar string de cor
> não mede nada (§6 de `docs/design/03-FASE-1-DECISOES.md`).

### Ativo GERADO e commitado também precisa de alguém que o consuma

O `npm run marca:gerar` produz `public/marca/wordmark-*.webp` — "track hub", na
rampa azul do sistema novo. Estava gerado, commitado e **apontado por ninguém**:
o rail seguia servindo `/logos/traffik-*.webp`, que desenha **"Traffik"** na
paleta antiga. Sétimo caso do padrão nesta base, e o mais visível de todos — era
a primeira coisa da tela, e três sessões de redesign passaram por cima dele.

⚠️ E a convenção de nome **inverteu** entre as duas pastas: em `/logos/` o sufixo
era a cor das LETRAS (`claro` = letras claras, fundo escuro); em `/marca/` é o
TEMA servido (`claro` = para o tema claro, letras escuras). Trocar um pelo outro
dá logotipo invisível. → `docs/temas/ui-e-microcopia.md`

### "Compila e mede certo" não responde COMO FICOU — layout só a tela responde

Os 4 primitivos da Fase 2 foram entregues com `tsc`, `lint`, `build` e
`test:contraste` verdes, e o contraste **provado**. Ao abrir a página no
navegador, 3 dos 4 tinham defeito visível: 30px de gradiente cru vazando no CTA
(padding inline vencendo a classe), "carregando" pintado igual a "desabilitado",
e um botão de ícone **vazio**. Nenhuma ferramenta desta base pergunta "como isto
ficou" — é o mesmo buraco do "resumo do gargalo do funil", que ficou invisível no
DOM por uma sessão inteira.

⚠️ E quando o viewport é grande demais para forçar o caso (`resize_window` mente
aqui), dá para exercitar o CÓDIGO em vez do tamanho: mover o gatilho para a borda
com `position:fixed` prova o clamp do popover sem precisar de janela estreita.
→ `docs/design/05-MOCKUPS-VS-TOKENS.md`

### Nunca confie na mensagem de sucesso do `resize_window`

Com a janela maximizada ele reporta êxito e **não redimensiona**. Depois de
qualquer resize, leia `innerWidth` e compare. `innerWidth === screen.availWidth`
é o indício de maximizada.

> ### ⛔ E a ORDEM importa: crie a ABA primeiro, desmaximize DEPOIS
> Descoberto em 05/08/2026, depois de duas tentativas frustradas em que o usuário
> restaurou a janela e o resize continuou falhando.
>
> **O grupo de abas do MCP é auto-removido quando a última aba fecha.** Então
> pedir para desmaximizar antes não resolve: a janela restaurada fica sem grupo
> nenhum, e o `tabs_context_mcp{createIfEmpty:true}` da sessão seguinte cria um
> grupo **novo, na janela maximizada**.
>
> A sequência que funciona:
> 1. eu chamo `tabs_create_mcp` / `tabs_context_mcp{createIfEmpty:true}`;
> 2. **só então** o usuário desmaximiza a janela que contém aquela aba;
> 3. aí o `resize_window` passa a valer — e ainda assim se confere o `innerWidth`.
>
> ⚠️ Não peça "restaure a janela" antes de a aba existir. Duas sessões foram
> gastas nisso, e nas duas o usuário fez a parte dele corretamente.
→ `docs/FILA.md`

---

## 📊 ESTADO DAS TELAS DO REDESIGN

<!-- ESTADO:INICIO -->
> ⛔ **GERADO A PARTIR DO `04` — NÃO EDITE À MÃO.** Rode `npm run docs:estado`.
> Ele garante que este arquivo e o `04` não discordem. **Não** garante que o
> `04` concorde com o código — isso continua sendo conferência manual.
> Última geração: 07/08/2026.

| Tela | ✅ feito | ❌ falta | 🔧 diverge por decisão |
|---|---|---|---|
| SHELL | 18 | — | 2 |
| DASHBOARD | 29 | — | 9 |
| INTEGRAÇÕES | 24 | — | 17 |
| REGRAS | 0 | 21 | — |
| CAMPANHAS / GERENCIADOR | 0 | 18 | 1 |
| UTM & SNIPPETS | 0 | 23 | 1 |
| CRIATIVOS | 0 | 13 | — |
| LOGIN | 0 | 19 | — |
<!-- ESTADO:FIM -->

# 🚦 ESTADO ATUAL E FILA — 05/08/2026

Tudo até `12c25ac` está no `origin/main`.

### ✅ Migrations: nenhuma pendente (confirmado pela SAÍDA do comando)

`20260805200000_checkout_na_jornada` foi aplicada em produção em 05/08/2026,
**depois** de ter derrubado o dashboard.

> ### 🔴🔴 INCIDENTE: eu registrei como aplicada uma migration que NÃO estava
> **Consequência: dashboard vazio em produção, com testador usando.**
>
> Eu disse *"estou lendo o seu 'pode dar o push' como confirmação de que a
> migration rodou"* — e **pushei mesmo assim**. Nomeei o risco e o corri, numa
> mudança cujo modo de falha eu já tinha escrito duas mensagens antes: o código
> novo faz `SELECT "Click"."checkoutAt"` em toda carga de dashboard.
>
> Identificar o risco e agir contra ele não é diligência. É pior que não notar,
> porque havia informação suficiente para parar.
>
> #### E havia uma segunda armadilha, que explica o "eu rodei"
> `prisma.config.ts` resolve **`DIRECT_URL ?? DATABASE_URL`**, e o `.env` local
> aponta para DESENVOLVIMENTO por desenho. Então `npx prisma migrate deploy`
> rodado da máquina aplica **no dev** — e imprime um tranquilizador
> *"No pending migrations to apply"*, porque lá já estava aplicada.
>
> É a MESMA armadilha que o `npm run backup` já teve (`DIRECT_URL` do `.env`
> vencendo quem exporta só `DATABASE_URL`), agora numa operação de ESCRITA de
> schema. Use **`npm run migrate:alvo`** antes, e sobrescreva `DIRECT_URL` —
> sobrescrever só `DATABASE_URL` não funciona.

> ### ⛔ REGRA: migration que eu não vi aplicada é migration PENDENTE
> Pedido explícito do usuário, e é a regra do PROCEDIMENTO estendida ao estado do
> banco: *"código pronto não é código exercido"* vale para schema também.
>
> **Sempre que houver migration:**
> 1. eu digo **explicitamente** que está pendente;
> 2. eu **espero a saída do comando** (`Applying migration <nome>`);
> 3. só então considero o deploy completo e pusho.
>
> ⚠️ Autorização para pushar **não é** confirmação de que a migration rodou. São
> duas afirmações diferentes, e só uma delas o usuário fez.
>
> ⚠️ **Terceira vez nesta sessão que eu errei o estado de migration** (disse
> pendente o que estava aplicado, disse aplicado o que estava pendente). O padrão
> é sempre o mesmo: **inferir estado de produção em vez de perguntar.** Eu não
> tenho as credenciais de produção localmente, de propósito — então toda
> afirmação minha sobre aquele banco é inferência, nunca observação.

### O que foi entregue

| | Item |
|---|---|
| ✅ | **Família 1** — os 3 efeitos pós-venda que falhavam em silêncio agora têm coluna e tela |
| ✅ | **1.4** — auditoria de métricas: unidade misturada no chargeback + indefinido virando zero |
| ✅ | **Bloco 4** — imposto de anúncio, posicionamento, "Meta Ads", custo por venda |
| ✅ | **Varredura** — 3 asserções agregadas passavam com a coleção vazia |
| ✅ | **A cópia dos UTMs foi LIGADA na atribuição** — o seguro existia e ninguém lia |
| ✅ | **Fuso do usuário** — o fallback silencioso ganhou aviso na tela |
| ✅ | **Faxina do nav morto** — −283 linhas no hook, `EditDashboardDrawer` deletado |
| ⏳ | **Item (d)** — metade feita; a outra segue bloqueada pelo `resize_window` |

### A fila, curta

O raciocínio completo de cada item está em **`docs/FILA.md`**.

| # | Item | Estado |
|---|---|---|
| 1 | **Redesign — Fase 1 (fundação de tokens)** | ✅ **feita e APROVADA em 05/08/2026.** Camada `--tk-*` em OKLCH nos dois temas, `@theme inline`, next/font, 8 níveis de tipografia, `[data-density]`, rota `/design-system`. **Nenhuma tela existente alterada** — verificado na `/dashboard` real. Contraste corrigido nos 2 estruturais do escuro; o resto em `ACEITOS` com piso |
| 1a | **Redesign — Fase 6 (tema claro)** | ✅ **feita em 05/08/2026, ANTES da Fase 2** — 3 das 7 telas são claras, então um primitivo que nascesse certo só no escuro seria detector congelado. As 5 reprovações **corrigidas** e removidas de `ACEITOS`. Duas previsões do documento estavam erradas: escurecer o `surface-hover` era ao contrário, e corrigir `text-muted` sozinho **invertia** a hierarquia com `text-secondary` |
| 1b | **Redesign — Fase 2 (primitivos)** | ⏸️ **PARADA por decisão de 05/08/2026.** 10 primitivos prontos em `src/components/tk/` (Button, Badge, Card, Input, Popover, Select, Tooltip, Checkbox/Radio/Switch, Skeleton, Separator). O resto **nasce quando a tela pedir**, no contexto dela — não numa vitrine |
| 1c | ~~Redesign — Dashboard "migrado"~~ | ⚠️ **ERA RE-SKIN, e foi jogado fora.** Trocou cor e fonte sobre o mesmo JSX: no teste do cinza, a mesma tela. Ver `docs/design/07-DASHBOARD-MIGRADO.md` |
| 1e | **SHELL reescrito do zero** | ✅ **06/08/2026.** `Sidebar`/`Header`/`DashboardShell`/`integracoes/layout` **deletados** (463 linhas) → 9 arquivos em `components/tk/`. Rail recolhível (236↔60px, `localStorage`) · navegação de **dois níveis** (Integrações com filhos inline) · badge de contagem · rodapé com área + perfil · header com **paleta ⌘K própria** (sem `cmdk`), Filtros, Central de ajuda, sino, tema, avatar, Ao vivo. Nos dois temas. Conferência preenchida em `docs/design/04-*.md` |
| 1d | **Dashboard REESCRITO do zero** | ✅ **06/08/2026.** `DashboardView`/`BlockContent`/`DashboardGrid` **deletados** (744 linhas). 4 KPIs hero com sparkline · faixa compacta · Receita×Gasto com aparo de dias zerados · Canais · **Alertas** (novo) · Vendas por país (globo + ranking) · rodapé de estado. Passa no teste do cinza |

> ### ⛔ DECISÕES TOMADAS NO DASHBOARD — não reabrir sem motivo novo
>
> - **Países coloridos no globo: NÃO.** Exigiria um GeoJSON por país (~100 KB);
>   o `worldGeo.ts` é um MultiPolygon de terra só, sem fronteiras. E o ranking ao
>   lado já nomeia os 7 países com valor — colorir o polígono seria a **terceira**
>   forma de dizer a mesma coisa. Decisão do usuário em 06/08/2026.
> - **Arcos no globo: NUNCA.** Arco representa TRAJETO (voo, remessa, rota). Uma
>   venda no Chile não vem de lugar nenhum — é ponto, não caminho. Arco ali é
>   decoração se passando por dado, que é o pior defeito possível numa ferramenta
>   de atribuição. Quando houver "país da venda mais recente", volta como
>   `ringsData` (anel que expande e some), nunca como arco.
> - **O anel de venda nova foi REMOVIDO**, não deixado inerte: ele dependia de um
>   dado que não existe (`byCountry` é agregado sem carimbo de tempo, e o feed não
>   traz país). Implementado-e-desligado seria mais um "controle que não controla
>   nada".
>
> ### 🔜 PENDENTE do Dashboard
>
> - ~~**Modo de edição / `useDashboardLayout.ts` órfão**~~ → ✅ **FEITO em
>   07/08/2026.** Três zonas, catálogo lateral, grade de 12 com arrasto, alça de
>   altura, migração dos layouts salvos. O hook deixou de ser órfão: o passo C
>   absorveu o salvar dele. Ver a seção própria.
> - **`metrics.ts` (aditivo apenas):** break-even → Top Campanhas → token
>   expirando → heatmap hora × dia.
> ### ⛔ SHELL: o que NÃO foi construído, e por quê (06/08/2026)
>
> - **Medidor de plano e uso de eventos** (`Pro · 1.250 / 5.000`, imagem 5 da
>   referência): **não existe backend.** `grep -iE "plan|billing|subscription|quota|usage"`
>   no `schema.prisma` devolve 4 acertos, e os quatro são `PENDING_BILLING_INFO` —
>   status de conta de anúncio da Meta, nada a ver com cobrança nossa. Inventar o
>   número seria pior que a ausência: uma barra de consumo que não mede consumo.
> - **`Integrações › Visão geral`** não está entre os filhos da sidebar porque a
>   tela não existe — `integracoes/page.tsx` é um `redirect`. É **pendência**, e
>   entra como primeiro filho quando a tela for construída.
> ### ⏳ `/dashboard/integracoes/testes` está ÓRFÃ DE PROPÓSITO, com prazo
>
> **Decisão do dono, 06/08/2026.** A tela existe e está entregue (Bloco 13, 911
> linhas na `TestesView`). Ela **saiu da navegação** por decisão do `03` ("Aba
> Testes. Já decidido").
>
> Onde ela está e onde NÃO está — a lista importa, porque "órfã" aqui é preciso:
>
> | Caminho | |
> |---|---|
> | Rail (navegação) | ❌ fora, decisão do `03` |
> | Central de ajuda | ❌ **link removido em 06/08** |
> | Paleta ⌘K | ✅ **achável digitando "testes"** — é a busca global, não um esconderijo |
> | URL direta | ✅ a rota existe e funciona |
>
> O link da ajuda saiu por regra, não por estética: uma tela inteira acessível só
> por dentro de um popover de **atalhos** é pior que uma tela fora do menu — a
> primeira parece disponível e não é encontrável; a segunda é honesta sobre o
> próprio estado. A paleta é outra coisa: ela existe justamente para alcançar o
> que a navegação não lista, e é onde alguém procuraria por nome.
>
> ⛔ **Não "conserte" isto religando um link.** O estado é intencional.
>
> **Prazo: ela MORRE no passo de Integrações**, junto da reescrita daquela área.
> Não foi deletada agora de propósito — deletar 911 linhas no meio da entrega de
> outra tela mistura dois trabalhos e dois motivos de revisão.
>
> ⚠️ Quem for reescrever Integrações: a `TestesView` é a dívida a liquidar, e o
> que ela faz (diagnóstico de rastreamento, card do espelho do `PixelEvent`) tem
> de ter destino decidido **antes** de o arquivo sumir.
>
> ### 🔎 A PALETA ⌘K usa `useOverlay`, NÃO o `Popover` — e a diferença é de contrato
>
> O `Popover` documenta que **não prende o foco** e **não trava o scroll**, e as
> duas ausências são deliberadas (dropdown que faz isso é bug). A paleta precisa
> das duas, e não é ancorada a gatilho nenhum. O primitivo certo é o `useOverlay`,
> o mesmo de `Drawer` e `Modal` — que é o que a paleta estruturalmente é.
>
> ⚠️ **Campanhas na paleta vêm de `v.adsData`, nunca de `v.filteredCampaigns`.** A
> lista `filtered*` já passou pelo `adsMatch`, que aplica a busca **e o status do
> Gerenciador**. Usá-la faria o resultado do ⌘K depender do que estivesse digitado
> numa caixa de outra tela — e o defeito seria mudo, porque com o campo vazio (o
> caso comum) as duas listas são idênticas.
>
> ### ✅ O BOTÃO "FILTROS" NÃO PODE FICAR INERTE — e o contrato é o que garante
>
> A faixa de filtros mora na TELA; o botão, no header. A tela chama
> `useRegistrarFaixaDeFiltros()` (de `tk/AppShell`), que registra a faixa e devolve
> se ela deve aparecer. O header só desenha o botão **se alguém registrou**.
>
> Não há como o botão existir sem ter o que controlar. **Provado pelo lado
> negativo**, que é o que a regra da asserção exige: no Gerenciador, que não
> registra faixa, `botaoFiltrosNoHeader === false`.
>
> ⚠️ O `registrar(false)` na limpeza do efeito não é ritual: sem ele, sair do
> Dashboard para Taxas deixaria o botão no header de uma tela sem faixa nenhuma.
>
> ### 🌍 O GLOBO NÃO TEM INTERAÇÃO — medido, e o código foi REMOVIDO
>
> **Clique e hover não funcionam: o raycaster do three.js não acerta as colunas**
> (`pointRadius` 0.13 é fino demais). Provado na tela — depois de passar o mouse
> sobre uma coluna, `getComputedStyle(canvas).cursor` continua `auto` e nenhum
> tooltip aparece.
>
> Duas tentativas gastas: `htmlElementsData` **não monta nó nenhum** no DOM;
> antes disso, quatro cliques em posições diferentes do Brasil não abriram nada.
>
> ⛔ **Próximo caminho seria `onPointClick` com `pointRadius` maior (~0.25) —
> RECUSADO pelo usuário em 06/08/2026**, por engrossar a coluna e piorar um
> visual que acabou de ficar bom.
>
> ✅ **`pointLabel`, `onPointClick` e o popover de país foram DELETADOS**, não
> deixados no arquivo. Dois motivos, e os dois são regra desta base: código que
> só rodaria se o raycaster acertasse é "implementado e inerte", e cursor de
> ponteiro sobre algo que não responde é **affordance mentindo** — parece
> ferramenta quebrada. Quem responde "qual país e quanto" é o **ranking ao
> lado**, que é DOM de verdade.
>
> ⚠️ Não conclua daí que o globo está sem informação: ele mostra distribuição, a
> lista mostra o número. São papéis diferentes no mesmo bloco.

> ### 🔁 A ORDEM DO ROTEIRO MUDOU — 05/08/2026
> Pedido do usuário, e a razão é boa: várias sessões e milhares de dólares sem
> **uma única tela da ferramenta mudar**. A `/design-system` cumpriu o papel dela
> (pegou 3 defeitos de Button que o build não pegava), mas deixou de ser o
> destino do trabalho.
>
> **Cada sessão passa a entregar TELA, não fundação.** Primitivo que falta nasce
> dentro da tela que precisa dele. A `/design-system` continua existindo como
> referência e como lugar de conferir contraste.
| 2 | **Item (d) — varredura de viewport estreito** | ⏸️ **DEPOIS do redesign, de propósito** — ver abaixo |
| 3 | Evento de TESTE da Cakto contando como venda | ⛔ bloqueado até a Cakto ser reativada (precisa do payload real) |
| 4 | Import/export de regras (Bloco 8) | ficou fora de propósito: não havia regra para exportar |

> ### ⏸️ Por que o item (d) espera o redesign — decisão de 05/08/2026
> O que falta varrer é exatamente `Modal`, `.tk-pop` (dropdown do `Select`) e
> `DateRangePicker`. **O redesign reescreve esses três**, então varrer agora seria
> medir componentes que vão deixar de existir.
>
> ✅ O que já foi provado **não** se perde como informação: o clamp
> `min(560px, 100%)` do `Drawer` funciona (exercido em 430/390/360/320px, 0 de 63
> descendentes vazando). E o **método** — e os dois limites dele — está registrado
> em `docs/FILA.md`, pronto para ser reusado nos componentes novos.

> ### ⚠️ O bloqueio do item (d) é de AMBIENTE, não de código
> `resize_window` mentiu duas vezes (última em 05/08: disse `560x900`,
> `innerWidth` ficou **2560**). O CDP não substitui — `chrome-devtools-mcp` roda
> num browser **separado e não autenticado**, e o cookie de sessão do NextAuth é
> `httpOnly`, então não há como transplantá-lo.
>
> ✅ A metade que não dependia de viewport **foi feita**: os condicionais da
> gaveta de Integrações › Anúncios (erro de perfil, conta Desabilitada + backoff,
> detalhe técnico cru, Pagamento pendente) — 0 de 63 descendentes vazam num
> painel de 560px.

### ✅ Integrações › Visão geral — o que FOI exercitado (06/08/2026)

| Ação | Estado |
|---|---|
| **Testar e sincronizar** | ✅ **exercitado.** Desfecho `pulado` → *"Tudo já está atualizado."* em verde. Legível, curto, na voz do usuário |
| **Desconectar** | ⚠️ **caminho destrutivo NÃO exercitado, confirmação verificada.** O diálogo abre, nomeia o que se perde e o que NÃO se perde, e **Cancelar não escreveu nada** — o perfil seguiu com as 2 contas e 2 campanhas |

Os outros dois desfechos do `Testar e sincronizar` (`metricas` e `erro`) não
apareceram: o dev estava sincronizado. O caminho de erro é o que vale exercitar
quando houver um token realmente vencido.

### ⚠️ Não exercitados, e não exercite sozinho

**Ações em massa, duplicar e excluir na Graph API nunca rodaram.** Excluir é
irreversível (a Meta não desfaz `DELETED`). Decisão do usuário: acompanhar quando
for testar.

Já exercidos de verdade: pausar/ativar pelo toggle, orçamento pela caneta inline,
`Purchase`/`Lead`/`AddToCart`/`IC` na CAPI (automáticos, em toda venda), criar
campanha, e **o motor de regras** — PAUSAR (por acidente) e `AJUSTAR_ORCAMENTO`
com o clamp travando no teto, os dois em produção em 31/07.
→ inventário completo em `docs/temas/gerenciador-e-graph-api.md`

### 🔴 DOIS AGENDADORES rodando ao mesmo tempo

O **cron-job.org** (configurado pelo usuário) e o
`.github/workflows/cron.yml`, que nunca foi removido e está **ativo** (291
execuções medidas). `sync-facebook` é inofensivo em dobro (a reserva no banco
segura), mas `reports` **duplica notificação** e `run-rules` tinha corrida de
ler-checar-agir — esta última já foi corrigida com reserva.

⚠️ **Não dá para saber daqui** quais rotas o cron-job.org chama nem com que
frequência: é serviço externo. Só o painel dele responde.

---

## 🛠️ Comandos, ordem de deploy e dívidas abertas

### Comandos

```bash
npm run test:areas       # 26 asserções, atribuição por área (backup de produção)
npm run test:periodo     # 33 asserções, janelas de período (puro, TZ=UTC)
npm run test:financeiro  # 33 asserções, líquido/lucro/ROI e cores (puro)
npm run test:pais        # 30 asserções, IP -> país pela base local
npm run geo:atualizar    # regenera a base (mensal) — commitar a saída
npm run geo:backfill     # país do histórico. SIMULA; --aplicar escreve
npm run test:bots        # 35 asserções, classificação de robô (puro)
npm run bot:reclassificar # reavalia Click.bot pelo userAgent. SIMULA; --aplicar escreve
npm run test:desempate   # 27 asserções, país quando o IP contradiz a campanha
npm run test:onyxpag     # 43 asserções, parser + testador da OnyxPag (puro)
npm run test:espelho     # 39 asserções, espelho no fbq em DOM falso (puro)
npm run test:detectores  # 56 asserções, assinatura v2 + preset do pixel (puro)
npm run test:utm-venda   # 25 asserções, UTMs copiadas para Sale (banco de DEV)
npm run test:utm-orfa    # 14 asserções, venda ORFA de clique: a copia sustenta ROAS/CPA? (DEV)
npm run test:checkout-jornada    # 14 asserções, checkout duplicado da mesma jornada (DEV)
npm run test:checkout-detector   # 17 asserções, o px.js ve o botao de compra? (puro)
npm run test:fusos       # 15 asserções, fuso da conta x fuso do aparelho (puro)
npm run backfill:utms    # copia os UTMs do clique. SIMULA; --aplicar escreve
npm run test:veiculacao  # 40 asserções, status configurado × veiculação (puro)
npm run test:efeitos     # 40 asserções, os 3 efeitos pós-venda (banco de DEV)
npm run test:auditoria-metricas  # 21 asserções, contagem por pedido + indefinido != zero
npm run test:analise-regra   # 32 asserções, avisos estáticos de condição (puro)
npm run test:previa-regra    # 30 asserções, prévia da regra (banco de DEV)
npm run regras:auditar -- --url '<conn>'  # o que as regras fariam e o que já fizeram
npm run conta:estrutura -- --url '<conn>'  # campanha → conjuntos → anúncios: quem PODE gastar
npm run test:veiculacao:e2e            # 13 asserções, o campo CHEGA em computeAdsOverview (banco de DEV)
npm run ads:sonda -- --url '<conn>'    # quais effective_status a Meta devolve (só leitura)
npm run test:match       # 20 asserções, purga + match por IP (banco de DEV)
npm run ip:simular -- --url '<conn>'   # o que a purga faria. NUNCA escreve
npm run geo:sonda -- --url '<conn>'   # a segmentacao esta chegando? (so leitura)
npm run test:ip          # 27 asserções, IP atrás de proxy (Vercel, VPS, Cloudflare)
npm run test:telefone    # 25 asserções, E.164 antes do hash da CAPI
npm run db:onde          # em qual banco o .env aponta
npm run migrate:alvo     # para qual banco o `migrate deploy` vai AGORA (so leitura)
npm run marca:gerar      # deriva simbolo/wordmark/favicon dos PNGs de origem (saida COMMITADA)
npm run test:migrar-layout  # 41 assercoes, migracao do layout antigo (puro)
npm run test:heatmap    # 20 asserções, celula VAZIA != celula ZERO, fuso e escala (puro)
npm run test:contraste   # 92 pares WCAG da paleta do redesign, NOS DOIS TEMAS. Le o globals.css
                         #   (nao uma copia dos hex) e denuncia OKLCH que diverge do comentario.
                         #   VERDE hoje. As 7 reprovacoes que restam estao em ACEITOS COM PISO:
                         #   nao reprovam, mas se PIORAREM o teste volta a sair 1. Lista e prazo
                         #   em docs/design/04-FASE-6-CONTRASTE.md
npm run script:onde      # onde falta reinstalar o script de UTM
npm run backup -- --url '<connection string>'   # SEMPRE com --url
```

### ⚠️ Deploy — a ordem importa quando há migration

**Migration na produção PRIMEIRO, push depois.** O código novo faz `SELECT` das
colunas novas; deployar antes derruba o dashboard inteiro. O oposto é seguro: o
build antigo ignora coluna que não conhece.

O usuário roda os comandos de produção — as credenciais **não** existem em
arquivo local, de propósito.

### Pendências abertas (não são bugs)

- ~~**Nav morto no `useTraffikState`**~~ → ✅ **FEITO em 05/08/2026.** Saíram o
  nav por estado (`activeTab`, `navAnalise`, `pageTitle`, `fbTabs`, `fbSub`,
  `NAV_DEF`, `TITLES`, `TabKey`), o gerador de link/snippet antigo, o `ruleForm`
  com os handlers, `metricList`/`persistPrefs` e `setNested`.
  **−283 linhas no hook.**
- ~~**`EditDashboardDrawer` inalcançável**~~ → ✅ **DELETADO em 05/08/2026**,
  junto de `editDashOpen`/`openEditDash`/`closeEditDash`/`metricList`.
  A faxina achou de quebra uma **consulta ao banco alimentando nada**:
  `listRules()` rodava no `Promise.all` do layout, em todo carregamento de
  página, para preencher um `State.rules` que ninguém lia.
- ~~`createCampaign` + `newCampaign*`~~ → ✅ **resolvido em 31/07/2026**: a tela
  passou a existir (`views/ads/NovaCampanhaModal.tsx`). Foi o único caso desta
  base em que a dívida de código inerte **bloqueou trabalho**.
- **`Workspace.accountIds` / `webhookIds` / `pixelConfigIds` / `products`** —
  mortos, mantidos pela regra dos dois deploys.
- **`DashboardLayout.workspaceId` nullable** — o NOT NULL entra num 2º deploy.
- **As ações em massa, o duplicar e o excluir nunca foram exercidos.** O
  **motor de regras** foi: PAUSAR (por acidente) e **AJUSTAR_ORCAMENTO com o
  clamp** (teste dirigido), os dois em produção em 31/07/2026. Ver "O CLAMP FOI
  EXERCIDO".
- **`WebhookLog` sem retenção**, e logs sem dono não aparecem na UI.


---

# 📌 ESTADO DA SESSÃO — 06/08/2026

> Escrito para quem abre contexto limpo amanhã. **Esta seção é tudo que você tem
> da sessão de 06/08.** Se ela contradisser algo acima, ela é mais nova.
>
> ⚠️ **Nada foi enviado ao GitHub.** Tudo é commit LOCAL na branch
> `redesign/dashboard`. A `main` está intacta. O push é decisão do dono, e ele
> não a tomou.

## ✅ O que ficou PRONTO

| | O quê |
|---|---|
| ✅ | **Dashboard reescrito do zero** (vinha da sessão anterior, `24f36a6`) |
| ✅ | **SHELL reescrito do zero** — `Sidebar`/`Header`/`DashboardShell`/`integracoes/layout` **deletados** (463 linhas) → 9 arquivos em `components/tk/`. Rail recolhível, navegação de dois níveis, paleta ⌘K própria, rodapé com área + perfil. Nos dois temas |
| ✅ | **`WorkspaceSelect` órfão deletado** — o comentário dele dizia "no topo da sidebar", que é o comportamento que mudou |
| ✅ | **Conserto do `@layer`** — a regra `a` do `globals.css` foi para `@layer base` |
| ✅ | **Seção SHELL do `04` preenchida** item a item, com o motivo escrito em cada 🔧 |

### O conserto do `@layer`, em uma linha

`a { color: … }` estava **sem camada**, e CSS sem camada vence utilitário do
Tailwind (que sai em `@layer utilities`). Os sete itens do rail saíam azuis,
ativos ou não. **6 de 10 âncoras com a cor errada antes; 0 de 10 depois.** A
mecânica completa está na seção própria, acima — procure por *"CSS SEM CAMADA
VENCE UTILITÁRIO DO TAILWIND"*.

## 🚧 EM ANDAMENTO — o mapa das razões com denominador zero

**Documento: `docs/design/05-MAPA-DAS-RAZOES.md`.** Levantamento, **não**
correção — o dono foi explícito: *"NÃO CORRIJA NADA. Quero decidir com o mapa na
mão."*

| Item | Estado |
|---|---|
| 1 — onde cada métrica é calculada | ⛔ não começou |
| 2 — por que hero mostra `0,00x` e faixa mostra `—` | ⛔ não começou |
| 3 — quem consome | ⛔ não começou |
| **4 — regras de automação** | ✅ **PRONTO** |
| 5 — padrão da string formatada | ⛔ não começou |

### 🔴 O achado do item 4 — leia antes de mexer no motor de regras

A hipótese do dono era que `Infinity > 50` pausaria campanha sozinha. **É falso:**
`metricValue` (`engine.ts:74-87`) tem guarda de denominador zero e devolve `0`.

**Mas o `0` é a outra metade do mesmo erro**, e o defeito real é o espelho:

> **`0` satisfaz toda comparação com `<` e `<=`.** Uma regra `PAUSAR quando
> ROAS < 1` **pausa campanha que não gastou nada**. Uma regra
> `AJUSTAR_ORCAMENTO quando CPA < 20` **escala o orçamento de campanha que não
> converteu nada** — essa gasta dinheiro.
>
> `>` e `>=` erram para o lado seguro. `<` e `<=` agem por falta de dado.

⚠️ **Não se sabe se existe regra assim em produção.** As credenciais não existem
em arquivo local, de propósito. Quem responde é
`npm run regras:auditar -- --url '<conn>'`, rodado pelo dono.

## ⏳ PENDÊNCIAS ABERTAS, com o motivo de cada uma

| Pendência | Por que está aberta |
|---|---|
| **Envolver `h1`–`h6`, `p`, `img`, `figcaption` em `@layer base`** | ✅ **APROVADO pelo dono**, com ordem de fazer **depois do mapa** para não interromper o levantamento. Mesmo raciocínio do `a`: o legado pinta por `sx()` inline e não é afetado; cada elemento nu é armadilha para o próximo componente novo. **É a primeira tarefa a executar quando o mapa fechar** |
| **`Integrações › Visão geral` fora da sidebar** | a tela não existe (`integracoes/page.tsx` é `redirect`). Entra como PRIMEIRO filho no passo de Integrações |
| **`/dashboard/integracoes/testes` fora da navegação** | decisão do `03`. Ela **morre** no passo de Integrações. ⛔ Não religue link para ela — ver a seção própria acima |
| **Medidor de plano no rail** | não há backend de billing. Confirmado por `grep` no schema |
| **Guarda estático de CSS sem camada** | proposto e **não construído**. Reprovaria o `test:contraste` quando o `globals.css` declarasse `color` em seletor de elemento fora de `@layer`. ~15 linhas, sem dependência. Medir a cor PINTADA automaticamente é caro (navegador + servidor + sessão `httpOnly`) e foi **descartado** |
| **Item (d) — viewport estreito** | segue bloqueado por ambiente (`resize_window` mente) |

## ➡️ PRÓXIMO PASSO, e por quê

**Terminar o mapa — itens 1, 2, 3 e 5** de `05-MAPA-DAS-RAZOES.md`.

O item 2 é o de maior valor: *"hero mostra `0,00x`, faixa mostra `—` para o mesmo
período — são dois caminhos de código ou o mesmo valor formatado de dois jeitos?"*
A resposta diz se o problema é de **cálculo** ou de **apresentação**, e isso muda
onde a correção inteira vai morar.

Depois do mapa, nesta ordem, que é do dono:

1. os seis elementos nus para `@layer base` (aprovado, só falta executar);
2. decidir a regra do denominador zero **com o mapa na mão** — a proposta está no
   fim do `05`, e o que já se sabe é que ela resolve o motor de regras e que
   **muda comportamento em produção** (regra `ROAS < 1` deixa de pausar campanha
   parada);
3. **Integrações** → modo de edição do Dashboard → `metrics.ts`.

> ### 🔜 O ESCOPO CRESCEU DUAS TELAS — 06/08/2026
>
> Não estavam na lista original de 8. Apareceram ao construir a Visão geral, e o
> motivo é estrutural: **o painel de detalhe é POR INTEGRAÇÃO; a `PixelView` e a
> `WebhooksView` são telas POR USUÁRIO** ("todos os meus pixels"). Enfiar uma
> lista de N itens no detalhe de 1 item é contradição de hierarquia, não
> problema de largura — e a sub-navegação já promete as duas rotas.
>
> | Tela | Vem de | Linhas a reescrever |
> |---|---|---|
> | **Integrações › Pixel/Eventos** | `PixelView` | 1.181 |
> | **Integrações › Webhooks** | `WebhooksView` | 532 |
>
> **Entram depois de UTM & Snippets**, que é o passo vizinho e provavelmente
> compartilha componente de código e de cópia (as três lidam com snippet
> instalável e parâmetro de URL).
>
> ⚠️ A `AnunciosView` (322) continua servindo `/integracoes/anuncios` e morre no
> passo dela.

> ### ⛔ COMO O DONO TRABALHA — o que respeitar sem precisar perguntar
>
> - **`git push` NUNCA** sem ele dizer "pode subir". Commit local, sim.
> - **`seed:dev:limpar` NUNCA** — mata a sessão dele. Se precisar mudar dado de
>   seed, `UPDATE`. Recriar exige avisar ANTES.
> - **Regra das duas tentativas:** se algo não resolve em duas, PARE e avise. Não
>   encadeie.
> - **O arquivo antigo da tela é DELETADO, não editado.** Pode abri-lo uma vez
>   para listar QUAIS DADOS ele consome, nunca para reaproveitar layout.
> - **Componente novo mora em `components/tk/`**, nunca na pasta da tela. Antes de
>   criar, veja se já existe algo que serve; se quase serve, **estenda com prop**
>   em vez de criar irmão quase igual.
> - **Se achar algo pior do que o descrito, diga NA HORA**, não no fim do
>   relatório.
> - Ao fim de cada tela: **teste do cinza**. E quando o quadro for dominado por
>   tela que você não tocou, **recorte a parte que você tocou** e diga isso — ele
>   aprovou explicitamente esse comportamento.

---

# 📌 ESTADO DA SESSÃO — 07/08/2026 (acabamento)

> Substitui a seção anterior de 07/08, que descrevia o estado no COMEÇO do dia.
> Tudo é commit LOCAL em `redesign/dashboard`. **A `main` está intacta e nada foi
> para o GitHub** — 47 commits esperando decisão do dono.

## ✅ TRÊS TELAS FECHADAS: Dashboard, Shell, Integrações › Visão geral

Os dez itens do `06` aplicados, mais o funil, mais §13 e §14 (que nasceram no
caminho). **Zero ❌ nas três** — o que restou está 🔧 com motivo escrito.

| | |
|---|---|
| 🐛 Rail recolhido | quatro defeitos que só a tela mostrava. O pior era mudo: a `Tooltip` encolhia o gatilho e a área de clique caía de **43px para 17px** |
| 🎨 Acabamento | pílula de variação · raio 16 / padding / sombra · curva monotônica com área · hachura · marcador de hover · listas com barra atrás do texto · medidor radial · rosca com pontas · movimento escalonado |
| 🌊 Funil | fluxo com **perdas explícitas** — a massa se conserva, e quem sai vira faixa rotulada |
| 🧪 Testes novos | `curva` · `fluxo` · `pontos` · `desenho` — os dois últimos **renderizam o componente** e medem o SVG |

## 🔴 O QUE OS TESTES ACHARAM (e nenhuma ferramenta antiga pegava)

| Onde | O bug |
|---|---|
| `MedidorRadial` | **99,6% pintava 24 de 24** ("fechou") e **2% pintava 0** ("nada") |
| `calcularFluxo` | o piso quebrava a conservação quando há **uma perda só** — achado por 200 funis aleatórios |
| `--tk-shadow-card` | o override do tema claro **não pegava**: `:root` e `[data-theme="light"]` têm a mesma especificidade e o `:root` vinha depois |
| `seed-dev` | `n % 2` numa lista de 6 fazia o BOLETO **nunca** casar — o bloco que existe para mostrar divergência saía com três verdes |

## ⚠️ A FAMÍLIA QUE MAIS APARECEU: documentação contradizendo o código

**Nove ocorrências, todas da mesma reversão** (sombra no card). Três achadas de
imediato; **seis** só na varredura completa que o dono mandou fazer no fim —
`design-system` ×2, `globals.css`, `Popover`, `01-PROMPT-MASTER`,
`06-CRIADOR-DE-REGRAS`.

⛔ **A lição virou regra:** ao reverter qualquer regra, `grep` pelo ⛔ dela no
repositório inteiro. Ver *"COMENTÁRIO QUE PROÍBE É O MAIS PERIGOSO DE TODOS"*.

O `CLAUDE.md` agora tem um bloco de **ESTADO gerado a partir do `04`**
(`npm run docs:estado`, roda dentro de `npm test`). Ele mata a divergência
DOCUMENTO × DOCUMENTO. **Não** mata documento × código — isso segue manual, e o
limite está escrito no script.

## ➡️ PRÓXIMO: Gerenciador / Campanhas

É sobretudo TABELA, e a tabela acabou de ser resolvida: `.tk-linha` (hover, sem
borda entre linhas), cabeçalho único e barra de proporção atrás do texto. 18
itens no `04`.

⛔ **Antes de começar, rode a varredura por ARQUIVO do `06`** — a lista de quais
seções merecem está lá. Checklist por arquivo encontra o que o checklist por tela
não vê: foi assim que uma borda no `FeedVendas` (do Dashboard, tela dada como
fechada) apareceu na auditoria do Shell.

## 🕳️ O QUE FICA DEVENDO

| | |
|---|---|
| **Largura mínima** | nunca verificada. O `resize_window` do MCP mentiu duas vezes e a janela encolheu sozinha outras duas. O dono ia exercitar o hover do gráfico em janela estreita na mão |
| **Quatro views legadas de Integrações** | `Anuncios` 322 · `Pixel` 1.181 · `UTMs` 397 · `Webhooks` 532. **Não auditadas de propósito** — vão ser reescritas, e auditar o que será deletado é trabalho que não sobrevive |
| **Varredura de comentários que afirmam efeito** | a família tem 5 casos documentados e ninguém varreu o resto |

# 🩼 AJUSTE MANUAL AO LADO DE UM VALOR DE SISTEMA É SEMPRE SINTOMA

> **Alguém viu o desalinhamento, compensou, e o compensador escondeu a causa por
> tempo indeterminado.**

O caso (07/08/2026): o botão de busca global do header tinha `height: 34` fixo —
2px a mais que o `Filtros` ao lado, que é `Button` e lê `--tk-altura-controle`. E
carregava um **`marginTop: 4`**. O empurrãozinho existia para disfarçar o
desencontro que os 34px criaram.

O resultado é o pior dos dois mundos: a tela fica *quase* certa, ninguém sabe
nomear o incômodo, e a próxima pessoa que trocar a densidade descobre que um
controle não acompanha.

> ### ⛔ A REGRA
> **Encontrou `marginTop`, `top`, `position: relative` com deslocamento de 1–4px,
> ou `transform: translateY(2px)` ao lado de um componente do sistema? Não ajuste
> o ajuste. Procure o valor que deveria vir de token e não vem.**

⚠️ **É prima do `?? 0` sobre valor recém-anulável.** As duas consertam a
MANIFESTAÇÃO e preservam a ORIGEM — e as duas compilam, passam no lint e ficam
parecendo cuidado com o detalhe. A diferença entre as duas famílias é só onde
dói: o `?? 0` mente sobre um número, o empurrãozinho mente sobre um alinhamento.

# 🌱 O GERADOR DE ESTADO TAMBÉM PRECISA SER VERIFICADO

> **Um seed que produz o estado errado faz o teste passar pelo motivo errado — e
> é indistinguível de código correto.** Família nova, registrada em 07/08/2026.

Toda a atenção desta base está no código que CONSOME dado. O `seed-dev.mjs`, o
`diversificar-dev.mjs` e as fixtures de teste **produzem** dado, e ninguém os
olha: eles não têm teste, não têm tipo que os cubra, e o build não sabe que eles
existem.

### O caso que nomeou a família

`diversificar-dev.mjs` espalhava formas de pagamento numa lista de **6** posições
e decidia a pendência com **`n % 2`**. O BOLETO caía sempre em posição ímpar da
lista, então `n % 2 = 0` **nunca casava**: a forma saiu com **100% de aprovação**.

O bloco de Taxa de aprovação existe para mostrar taxas que **divergem** entre as
formas. Ele apareceu com três verdes e nenhuma divergência — ou seja, o gerador
produziu exatamente o estado que impede de ver o que se ia verificar. E nada
acusava: o script rodou sem erro, a tela renderizou, os números eram plausíveis.

> ### ⛔ A REGRA QUE FICA
> **Script de seed IMPRIME o que gerou, e alguém LÊ.**
>
> Foi a saída do próprio script — a tabela de `forma / pagas de geradas / tom` —
> que denunciou. Sem ela, o `100%` teria virado "o medidor está bonito" e a
> divergência entre tons continuaria sem nunca ter sido vista.

⚠️ **O módulo precisa ser coprimo com o tamanho da lista.** Sempre que uma
distribuição sintética usar `índice % N` para uma coisa e `índice % M` para
outra, `N` e `M` que compartilham fator produzem correlação silenciosa — uma
categoria inteira cai sempre no mesmo lado da segunda decisão.

⚠️ E **gerador de dado de teste é idempotente**, nunca `random()`: com aleatório,
cada execução muda os números da tela e ninguém sabe se ela mudou por causa do
código ou do seed. `row_number()` sobre uma ordem estável resolve.

## 🔴 O QUE FALTA NO SEED DO FUNIL — e por que "reetiquetar a fonte" erra o alvo

> Medido em 07/08/2026, contra o banco de dev. **Registrado aqui porque a
> descrição intuitiva do problema leva à correção errada.**

A leitura natural do funil no dev é *"os ICs são todos do gateway"*. **Não é
isso.** O estado real:

| | dev |
|---|---|
| `Click` com `checkoutAt` | **0** |
| `Click.checkoutSource` | **NULL em todas as 35 linhas** — nem `navegador` nem `gateway` |
| `PixelEvent` `InitiateCheckout` | 35, **todos com `clickId` NULL** (órfãos, sem jornada) |

Os 35 ICs do funil vêm inteiros do ramo `semJornada` de `metrics.ts`. Não existe
checkout de gateway no dev — **não existe checkout nenhum na tabela `Click`**.

> ### ⛔ A CORREÇÃO NÃO É REETIQUETAR FONTE. É CRIAR JORNADA COM CHECKOUT.
> Um `UPDATE "Click" SET "checkoutSource" = 'navegador'` não faz nada: não há
> linha com `checkoutAt` para carimbar. O seed precisa **gravar `checkoutAt` em
> parte dos `Click`** e só então distribuir `checkoutSource` entre `navegador` e
> `gateway`.
>
> ⚠️ E `dev:diversificar` **não cobre isto** — ele só espalha canal e forma de
> pagamento por `UPDATE`. Quem for consertar o funil no dev escreve caminho novo,
> não estende aquele.

⚠️ **O seed também produz `Sessões = ICs = Vendas Inic. = 35`**, que é
exatamente o estado em que o meio do funil não pode ser avaliado: três etapas
iguais desenham uma laje, e a única transição com informação é a última. É o
mesmo defeito do `n % 2` do BOLETO, em outro bloco — **o gerador produz o estado
que impede de ver o que se ia verificar.**

# 🚫 COMENTÁRIO QUE *PROÍBE* É O MAIS PERIGOSO DE TODOS

> **Porque ele AUTORIZA alguém a desfazer.** Um comentário que explica envelhece
> e vira ruído; um que proíbe envelhece e vira uma ordem para reverter o
> conserto.

O caso (07/08/2026, o **quinto** da família, e o pior deles): o cabeçalho do
`Card.tsx` dizia

> *"⛔ CARD NÃO TEM SOMBRA. […] Um card com sombra no escuro não parece elevado,
> parece sujo."*

enquanto a **linha 98 do mesmo arquivo** aplicava `--tk-shadow-card`.

### A agravante, e é o que separa este dos outros quatro

Os outros eram documentação envelhecida **longe** do código: um comentário 219
linhas acima da conta, uma página de design-system, uma linha do CLAUDE.md. Este
é **o cabeçalho do arquivo contradizendo o corpo do arquivo**.

Quem abre o `Card.tsx` para mexer lê a proibição **antes** de ver a aplicação. E
uma proibição em maiúscula, com o motivo bem escrito ("parece sujo"), é
convincente: a leitura natural é *"então a linha 98 está errada"* — e o conserto
vira o desfazer.

> ### ⛔ A REGRA
> **Proibição que muda não é ATUALIZADA — é APAGADA, e no lugar dela entra o
> motivo da mudança.**
>
> Não escreva *"antes não podia, agora pode"*: isso deixa a proibição legível, e
> quem varre o arquivo em diagonal continua vendo o ⛔. Escreva o que vale hoje,
> e a reversão como nota, subordinada.

⚠️ **Ao reverter qualquer regra, `grep` pelo ⛔ dela em todo o repositório.** Foi
o que faltou: a sombra foi revertida no `globals.css` e o ⛔ ficou em pé no
componente, na `/design-system` e no CLAUDE.md.

# 📝 DOCUMENTAÇÃO QUE *AFIRMA* UM VALOR ENVELHECE. QUE *LÊ* O VALOR, NÃO.

> **A regra:** onde a documentação e o código convivem, a documentação **deriva**
> do código em tempo de execução. Copiar o valor cria uma segunda fonte, e a
> segunda fonte diverge no primeiro commit — em silêncio, porque `tsc`, `lint` e
> `build` não leem string de documentação.

Três instâncias da MESMA família, e por isso ficam juntas em vez de viraram três
notas soltas:

| Onde | Afirmava | A verdade |
|---|---|---|
| `financeiro.ts:123` | *"Despesas recorrentes **rateadas** no período"* | `+= e.amount`, o valor cheio, 219 linhas abaixo |
| `metrics.ts:923` | *"o lucro por hora rateia … **recorrentes**"* | usava `totalDescontos`, que as EXCLUI |
| `/design-system` | `rounded-card` · **`"10px"`** | o token virava 16 em 07/08/2026, e a página seguiu dizendo 10 |

O terceiro é o mais instrutivo porque é a página **que existe para documentar o
sistema**, documentando o sistema antigo — e o cabeçalho dela ainda afirmava
*"todos os valores desta página são lidos do navegador"*, o que era verdade só
para as cores.

> ### ⛔ A CORREÇÃO É ESTRUTURAL, NUNCA "atualizar o texto"
> Atualizar o texto conserta a instância e deixa a família viva. O conserto é
> **tirar a cópia**: a `/design-system` lê `--tk-radius-*` com `getComputedStyle`,
> então só dá para ficar errada se o token sumir.
>
> Onde não der para derivar — comentário em prosa —, a saída é **descrever a
> DECISÃO, não o efeito**. *"Rateamos por dia porque um divisor fixo de 30 erra
> em fevereiro"* continua verdadeiro depois de o código mudar; *"as recorrentes
> são rateadas aqui"* vira mentira no primeiro commit que contraria.

⚠️ **A varredura completa por comentários que afirmam efeito segue na fila.**
Estes três são a evidência de que ela vale.

# 🟩 COR SEMÂNTICA É PARA A GRANDEZA SEMÂNTICA — volume não é resultado

> **Decisão do dono, 07/08/2026.** Vale para toda tela, todo gráfico, todo
> número. Nasceu no Dashboard, mas não é regra do Dashboard.

**Verde e vermelho significam LUCRO e PREJUÍZO nesta ferramenta.** Então só
recebe cor semântica o que **é** essa grandeza:

| | |
|---|---|
| ✅ **Pode** | valor de lucro · pílula de variação · alerta |
| ⛔ **Não pode** | receita, gasto, cliques, vendas, impressões, conversões — **volume, não resultado** |

Tudo que é volume usa o **destaque** (azul de marca) quando é série principal, ou
**neutro** quando é secundária.

### O caso que produziu a regra

A linha de Receita do `LineChart` era `--tk-success`, e o comentário defendia a
escolha por escrito. Com o ROAS em 0,4 a linha continuava **verde**, subindo
alegremente ao lado de um card de Lucro em **vermelho**: a cor afirmando saúde
exatamente onde havia prejuízo.

Faturar não é lucrar. Uma linha de faturamento verde diz que sim.

Pelo mesmo motivo o sparkline do KPI **parou de seguir o tom do delta** — a
pílula ao lado já diz o tom, e a linha repetindo pintava de "lucro" uma série de
faturamento. A exceção é `dados.cor`, e ela é a regra e não um furo: quando vem
preenchida é porque o **valor** é negativo, que é literalmente o "valor de lucro"
que a tabela acima permite colorir.

> ### ⛔ A PERGUNTA, ANTES DE PINTAR QUALQUER COISA DE VERDE OU VERMELHO
> **"Este número É lucro/prejuízo, ou é só um número que subiu?"**
>
> Se subiu mas não é resultado, a cor certa é o destaque — e quem diz que subiu é
> a pílula de variação, não a cor do próprio número.

⚠️ E ao mudar isto em algum lugar, **procure o comentário que defendia o
contrário**. O do `LineChart` estava bem escrito e continuava soando correto: é a
família da cicatriz que virou anatomia.

# 🕳️ A DISTINÇÃO CENTRAL DESTE PROJETO — ausência de observação ≠ observação de zero

> **Não é um detalhe de cada lugar. É a mesma distinção, e ela já apareceu em
> TRÊS camadas diferentes.**

| Camada | Onde | "Ausência" | "Zero" |
|---|---|---|---|
| **Cálculo** | denominador zero (o mapa das razões) | `null` → `"—"` | `0` → `0,00x` |
| **Gráfico** | heatmap dia × hora | célula hachurada, nunca observada | célula pintada no piso, observada e sem venda |
| **Persistência** | `paineis` no layout salvo | campo **não é array** → corrompido, cai no padrão | `[]` → o usuário removeu todos, e a escolha é respeitada |

**A pergunta é sempre a mesma: houve medição?** Se não houve, o produto não pode
afirmar nada sobre o valor — nem zero, nem padrão, nem "tudo bem".

E o custo é sempre o mesmo: colapsar as duas faz o produto **afirmar** onde
deveria dizer que não sabe. Um CPA de `R$ 0,00` se lê como aquisição de graça;
uma célula pintada diz "ninguém compra nesse horário" onde ninguém olhou; um
`paineis: []` restaurado desfaz a escolha do usuário em silêncio.

⛔ **Ao escrever qualquer valor de saída — número, cor, lista, estado — pergunte
se ele consegue distinguir "não sei" de "sei que é zero".** Se não consegue, o
tipo está errado antes de o código estar.

⚠️ Ela reaparece onde não se procura. O caso da persistência foi achado por uma
asserção escrita para outra coisa, num arquivo que não tem gráfico nem métrica.

# 🔒 REGRA QUE DEPENDE DE LEMBRAR VIRA GARANTIA DE TIPO

**Quando uma regra do projeto depende de alguém lembrar dela, procure a forma de
fazer o COMPILADOR cobrar.** É a diferença entre "nada entra sem renderizar"
escrito num documento e escrito no tipo.

O caso que produziu a regra (06/08/2026): o catálogo do Dashboard tinha
metadados e render no mesmo objeto, e nada impedia um `render: () => null` para
calar a consciência. A regra existia — estava escrita em maiúsculas no topo do
arquivo — e dependia de ninguém tomar o atalho.

A separação em `catalogo.ts` (metadados puros) + `catalogoRender.tsx`
(`Record<IdBloco, …>`) transformou a regra em **erro de compilação**: um id
declarado sem render não passa no `tsc`.

⚠️ **E ela nasceu de uma limitação de ferramenta**, não de projeto: a migração
precisa das larguras, é pura, e é testada com `--experimental-strip-types`, que
não lê `.tsx`. Vale registrar por isso — *a restrição que parecia um obstáculo
apontou para o desenho melhor*. Metadado que só um componente pode ler é
metadado que nenhum teste alcança.

⛔ Não é para transformar toda regra em tipo — algumas não cabem. É para
PERGUNTAR, toda vez que escrever "⛔ sempre faça X" num comentário: *dá para o
compilador cobrar isto?*

# 🧩 MODO DE EDIÇÃO DO DASHBOARD — ✅ COMPLETO

> **O ⛔ que ficava aqui saiu em 07/08/2026.** Ele dizia "NÃO LEIA como feito.
> Ele NÃO existe" — e isso deixou de ser verdade. As três entregas fecharam:
>
> | | | |
> |---|---|---|
> | **A** | blocos e catálogo | ✅ `2750258` |
> | **B** | persistência e migração | ✅ |
> | **C** | interface de edição | ✅ `bd32262` · `ac97fb7` · `6cbb846` |
>
> Três zonas com a REGRA no rótulo, catálogo lateral, grade de 12 com encaixe,
> arrasto, alça de altura, `N colunas livres` por linha, Salvar/Cancelar/Redefinir.
>
> ⚠️ **`useDashboardLayout.ts` deixou de ser órfão** — o C absorveu o salvar
> dele. Se ainda existir referência a "hook órfão de propósito" em algum
> comentário, é resíduo desta seção e pode sair.
>
> 🔜 **O que segue aberto, e não é do modo de edição:** `metrics.ts` aditivo
> (Top Campanhas já entrou; falta heatmap hora × dia por métrica nova) e a
> varredura de comentários que afirmam efeito.

# 🧱 BLOCO ESTRUTURAL É O QUE NÃO PODE SER *OCULTADO*. Nada além disso.

> **Correção do dono, 07/08/2026.** A definição anterior dizia que os quatro
> ficavam FORA do catálogo — e "não removível" tinha virado "não
> redimensionável", que são coisas diferentes.

| Estrutural garante | Estrutural NÃO garante |
|---|---|
| estar sempre na lista de painéis | posição |
| não ter ✕ | largura |
| | altura |

Os quatro (`receita-gasto`, `alertas`, `paises`, `rodape`) estão em
`CATALOGO_META`, na zona Painéis, com `colMin` e `colPadrao` próprios. O que os
marca é **uma string**: `estrutural`, a frase que vai para a tooltip do selo
`Fixo`. Não existe lista de ids em lugar nenhum.

### O que a definição errada custou

Os quatro viviam em **JSX fixo** no `DashboardScreen`, fora da grade, com a
largura decidida no código. A tela tinha dois sistemas de layout: um que o
usuário controlava e outro que ele não via. O sintoma foi `Vendas por país` de
ponta a ponta, sem alça.

E o motivo registrado no catálogo era **circular**: *"o globo não cabe em
nenhuma das larguras de painel"*. Quem decide se o globo cabe é uma container
query que já existia — o bloco tinha sido dado como grande porque estava grande.

> ### ⛔ A PERGUNTA, ANTES DE TIRAR QUALQUER COISA DA GRADE
> **"Isto não pode ser ESCONDIDO, ou não pode ser MEXIDO?"**
>
> Quase sempre é o primeiro, e o primeiro se resolve tirando um botão — não
> tirando o bloco do layout.

⚠️ **A garantia é a REPOSIÇÃO, não a ausência do botão.** `reporEstruturais()`
devolve os quatro em todo layout lido, e `removerPainel` recusa estrutural. A
ausência do ✕ cobre o usuário de hoje; ela não cobre um salvo gravado por versão
anterior, nem o **arrasto de volta para o catálogo** — que é outro caminho para
a mesma remoção. É o "endurecer uma porta com a outra aberta", na camada de
layout.

# 🕳️🕳️ BLOCO SEM DADO **COLAPSA** — ELE NÃO SOME DA GRADE

> **07/08/2026.** O `DashboardScreen` filtrava `layout.paineis` por `temDado(v)`
> antes de desenhar. É a distinção central deste projeto aplicada a LAYOUT.

| | O que acontece |
|---|---|
| ❌ sumir | o bloco sai da grade · os vizinhos sobem de linha · o arranjo salvo vira outro arranjo · nada explica |
| ✅ colapsar | o bloco fica na posição e na largura escolhidas · **só a altura encolhe** · o estado vazio diz a causa e o próximo passo |

O argumento que sustentava o filtro estava no código, e tinha o sinal trocado:
*"um painel corretamente vazio na tela do usuário parece defeito"*. Quem parece
defeito é a grade que se reorganiza sozinha.

⚠️ **E sem dado é o estado NORMAL desta ferramenta** — os testadores rodam assim
a maior parte do tempo. Layout que depende de a janela de tempo ter movimento é
layout que quase nunca é o que o usuário montou.

### O tipo cobra o estado vazio

`RenderBloco` é uma união: ou o bloco declara `temDado` **e** `vazio`, ou declara
`sempreCheio: true` **e** `porQue` — uma frase dizendo por que o vazio não é
alcançável. `Alertas` e `Estado do sistema` são os dois casos: lista vazia ali é
a resposta boa, e os componentes já a desenham.

⛔ A alternativa era `temDado: () => true` com um `vazio` decorativo ao lado —
**proteção morta**: estado vazio escrito, revisado e inalcançável, que faz quem
lê o catálogo acreditar que o caso está coberto.

> ### 🔴 O TESTE PRECISOU SER ESTÁTICO, E VALE REGISTRAR POR QUÊ
> A versão óbvia era simular a tela e comparar `N com dado` × `N sem dado`.
> **Ela nunca poderia falhar**: a simulação seria uma reescrita do código já
> consertado, sem o `.filter()`, e os dois lados dariam o mesmo número por
> construção.
>
> `npm run test:blocos-vazios` lê o `DashboardScreen.tsx` e reprova se
> `layout.paineis` for filtrada antes do `.map()`, ou se `temDado` for chamado
> direto na tela (o consumidor é `vazioDoBloco`, e são DOIS caminhos de desenho
> — foi ter dois que deixou "colapsar" virar "sumir" em um deles).
>
> ⚠️ **O limite está escrito na guarda:** ela pega o filtro na mesma expressão,
> não alguém que filtre numa variável três linhas antes.

# 📥 NUNCA ALTERAMOS O ARRANJO DE ALGUÉM. AVISAMOS QUE HÁ MAIS.

> **Regra do dono, 07/08/2026.** Vale para todo layout salvo, em qualquer tela —
> nasceu no Dashboard, não é regra do Dashboard.

Quando um bloco novo entra no catálogo, ele **não é injetado** nos layouts já
salvos. Ele aparece:

| Onde | |
|---|---|
| layout padrão de conta nova | ✅ |
| catálogo lateral do modo de edição | ✅ **com contador** |
| arranjo já salvo de alguém | ⛔ **nunca** |

O recurso do meio é o que faz a regra funcionar. Sem ele, "não injetar" vira
"ninguém nunca fica sabendo" — recurso que existe e não é encontrável, que é a
mesma classe do controle inerte: o produto tem a coisa e o usuário não.

> ### ⚠️ O CONTADOR DIZ "DISPONÍVEIS", NÃO "NOVOS"
>
> O pedido original era "3 novos disponíveis". **O produto não sabe o que é
> novo.** O que ele consegue calcular é "está no catálogo e não está no layout",
> e isso inclui o bloco que o usuário removeu de propósito ontem — chamá-lo de
> novo é afirmar o que não se mediu.
>
> ⛔ Saber exigiria persistir os ids já vistos, e para os layouts que já existem
> não há resposta: foram gravados antes do campo. O default teria de ser uma
> lista datada no código — cicatriz esperando para virar anatomia. Não vale o
> preço de uma palavra.

# 🧾 SCRIPT DE TESTE FORA DO AGREGADO É TESTE QUE NÃO EXISTE

> **O nono caso da família "passa no build com a coisa desligada" — e o
> primeiro em que o inerte era a própria VIGILÂNCIA.** 07/08/2026.

`teste-fita.mjs` existia, tinha `npm run test:fita` no `package.json`, e
verificava a geometria da fita do funil. Ele **não estava no `npm test`**. Ao
mudar o contrato da fita, ele passou a ter **9 asserções quebradas** — e a
suíte continuou verde, porque ninguém o invocava.

### A varredura que o dono mandou fazer

| | |
|---|---|
| Arquivos `teste-*.mjs` | **47** |
| Dentro do `npm test` antes | **7** |
| **Fora** | **40** |

Dos 40, **26 eram puros** (sem banco, sem rede) e podiam entrar no mesmo dia.
Rodados um a um: **os 26 passavam.** Estavam órfãos e saudáveis — o `teste-fita`
era o único podre, e não havia como saber qual sem executar todos.

**O agregado foi de 8 para 34 scripts.** Os 13 que precisam do banco de dev
viraram `npm run test:banco`, separado de propósito: um agregado que exige banco
não roda em máquina limpa, e aí ninguém roda o agregado.

> ### ⛔ A REGRA QUE FICA
> **Todo arquivo de teste novo entra no agregado no MESMO commit em que nasce.
> Se não entrou, não foi escrito.**
>
> É a mesma regra da rota de cron ("ao criar, agende no mesmo commit") aplicada
> a teste. E é pior que a do cron: uma rota nunca agendada não faz nada; um teste
> nunca executado **produz a crença de que a coisa está coberta**.

⚠️ E ao mudar o contrato de um módulo, o `grep` que importa não é pelos
consumidores de produção — é pelos **testes** dele, inclusive os que o agregado
não roda.

# 🟩💀 TESTE VERDE SOBRE CAMINHO MORTO — a garantia FALSA

> **Primo direto do `teste-fita` fora do agregado, e pior que ele.** Um teste
> fora do agregado é silêncio; um teste verde sobre caminho morto é uma
> **afirmação de que a coisa funciona**. 07/08/2026.

O caso: a 8ª versão do funil tirou `Cliques` da geometria da fita, e com ele
saíram `perdaLabel`, `perdaAjuda` e a constante `PERDA_DE_RASTREAMENTO` — que
passaram a ter **zero chamadores de produção**. O teste
`"a perda de RASTREAMENTO é rotulada, e a de abandono não"` continuou **verde**,
porque a fixture dele monta o `perdaLabel` à mão.

| | O que o leitor conclui |
|---|---|
| órfão SEM teste | nada — ninguém olha |
| órfão COM teste verde | *"o rótulo de perda de rastreamento está coberto e funcionando"* — e **nenhuma das duas metades é verdade** |

O teste não sabe distinguir *"a produção exerce isto e está certo"* de *"só eu
exerço isto"*. Uma fixture é um chamador — e para o agregado, um chamador basta.

> ### ⛔ A REGRA QUE FICA
> **A varredura de órfãos inclui os TESTES do órfão.** Achou símbolo sem
> consumidor de produção? O `grep` seguinte é em `scripts/`, e o que ele achar
> sai no MESMO commit.
>
> O `grep` que responde não é "alguém importa?" — é **"alguém além do teste
> importa?"**. Um símbolo cujo único chamador é a fixture que o testa está morto
> com atestado de saúde.

⚠️ E vale para o inverso, que é como este apareceu: ao **remover** um consumidor
de produção, o teste dele não fica obsoleto de forma visível. Ele fica verde.

# 🔬 TESTE DIFERENCIAL: compare DOIS ESTADOS do mesmo fixture, não conteúdo literal

> **Padrão de teste, não conserto de um caso.** Decisão do dono, 07/08/2026,
> depois de duas asserções literais minhas falharem pelo motivo errado no mesmo
> arquivo.

A pergunta era *"o estado NÃO MEDIDO não pode afirmar 100% de conversão"*. As
duas primeiras tentativas foram literais, e as duas mediam outra coisa:

| tentativa | por que não servia |
|---|---|
| `!html.includes("100%")` | pegava o `100,0%` da **etapa de topo**, que é a fração do máximo e está correta |
| `count("100,0%") === 1` | são **3** ocorrências legítimas do mesmo valor: a pílula, o `aria-label` e a versão compacta |

A que vale renderiza o **mesmo fixture nos dois estados** e compara:

```js
const medido = FIXTURE.map((e) => ({ ...e, trechoNaoMedido: undefined }));
/* A linha de base PRECISA afirmar, senão `0 <= 0` passa sem medir nada. */
assert.ok(cem(htmlMedido) > 0);
assert.ok(cem(htmlNaoMedido) <= cem(htmlMedido));
```

> ### ⛔ A REGRA
> **Ela não sabe quais números existem — sabe o que a mudança de estado tem
> PERMISSÃO de acrescentar.** Por isso sobrevive a valores que ninguém previu:
> se alguém puser uma pílula de conversão no trecho, a contagem sobe de um lado
> só e o teste cai, sem que nenhum número tenha sido escrito na asserção.

## 🔴 A DIREÇÃO FAZ PARTE DA ASSERÇÃO — "não acrescenta" ≠ "é igual"

A primeira versão desta asserção usava `assert.equal`, e ela **quebrou por fazer
a coisa certa**. Vale registrar porque o modo de falha é contraintuitivo:

| | |
|---|---|
| quando nasceu | a pílula mostrava **fração do máximo**, que **independe** do estado — os dois lados desenhavam o mesmo número, e a igualdade valia sem exercer nada |
| o que mudou | a pílula virou **taxa de passo**, e o estado não medido a **SUPRIME** |
| o que aconteceu | o estado não medido passou a REMOVER uma afirmação — comportamento desejado — e foi o `===` que acusou |

A propriedade sempre foi *"o estado não medido não ACRESCENTA"*. Isso é `<=`. O
`===` era uma codificação apertada demais dela, e só passava por coincidência —
enquanto o canal medido não dependia do estado.

> ### ⛔ A REGRA
> **Toda asserção diferencial declara em que DIREÇÃO a mudança de estado tem
> permissão de mexer.** `<=` para "só pode remover", `>=` para "só pode
> acrescentar", `===` **apenas** quando o estado não tem direito de mexer em
> nada — e aí escreva por que não tem.
>
> ⚠️ E toda desigualdade leva a guarda da linha de base junto (`> 0`), senão a
> contagem vazia satisfaz o `<=` e o teste vira mais um que passa sem olhar.

É a mesma família de "congelar RELAÇÃO em vez de VALOR" (o break-even, a curva,
a conservação do funil), aplicada a **markup**: o par de estados faz o papel que
a invariante fazia na conta.

⚠️ **Onde procurar aplicação:** todo lugar onde um estado do produto ADICIONA
algo à tela — vazio × cheio, medido × não medido, com permissão × sem, uma área
× todas. A pergunta é sempre *"o que este estado tem direito de acrescentar?"*,
e a resposta é um diff, não uma string.

# 🧱 ANOTE O TIPO NO PONTO EM QUE O OBJETO DE PROPS NASCE

> **A checagem de propriedade excedente do TypeScript não alcança objeto vindo
> de função — nem de `.map()` escrito direto na prop.** Medido em 07/08/2026.

Eu montei um `perdaLabel` no `catalogoRender` para um componente que não tinha
esse campo. `tsc`, `lint` e `build` passaram; a etiqueta não apareceu na tela.

A conclusão certa **não é "prestar mais atenção"** — foi o dono que apontou. O
registro no CLAUDE.md não tinha como pegar, porque nenhuma quantidade de
vigilância cobre uma checagem que o compilador desligou.

### O buraco é maior do que o caso

Medido com um `zzzCampoInventado`:

| onde | checagem |
|---|---|
| objeto literal atribuído direto | ✅ pega |
| retorno de função nomeada | ❌ **passa** |
| `.map()` escrito DIRETO na prop JSX | ❌ **passa** — a inferência do genérico desliga |

O terceiro é o que surpreende: parece o caso literal, e não é.

### O conserto, e ele é o mesmo do `RENDERS`

Uma anotação por ponto de construção:

```ts
etapas.map((e): EtapaEntradaFita => ({ … }))
const f = (v: TraffikView): ExclusaoFita[] => { … }
```

**Provado pelo lado negativo:** com os campos inventados de volta, `tsc` sai com
dois erros — e um deles ainda diz *"Did you mean to write 'perdaLabel'?"*, que é
exatamente o bug que passou.

> ### ⛔ A REGRA
> **`.map()` que monta props leva anotação no retorno do callback.** Sem ela, o
> campo com nome errado morre na tela em vez de morrer no build.

⚠️ É a mesma jogada de `Record<IdBloco, RenderBloco>`: quando uma regra depende
de alguém lembrar, procure a forma de o COMPILADOR cobrar.

# 🪞 ETAPA DERIVADA DA SEGUINTE DESENHA 100% DE CONVERSÃO — e isso é uma MENTIRA LISONJEIRA

> **11º caso da família, e a distinção central do projeto aplicada a uma camada
> nova: etapa de funil, em vez de razão ou de célula de gráfico.** 07/08/2026.

`Click.checkoutAt` tem **dois escritores**: o pixel do navegador
(`api/pixel/event`) e o **webhook do gateway** (`webhook/checkoutEvent`). O
segundo é derivado da venda — então **toda venda produz um Initiate Checkout**.

Consequência: numa conta sem o pixel instalado, `ICs === Vendas Iniciadas` **por
construção**, e o trecho do meio do funil desenha **100% de conversão**.

> ### 🔴 POR QUE ESTE É PIOR QUE UM NÚMERO ERRADO COMUM
> Ele erra **para o lado que agrada**. O gestor lê *"meu checkout converte
> tudo"* e vai embora satisfeito — não há atrito que o faça desconfiar. Um
> número ruim provoca investigação; um número lisonjeiro compra silêncio.
>
> E o dado que denuncia existia: `Click.checkoutSource` guarda `"navegador"` ou
> `"gateway"` desde sempre, **e ninguém lia**.

| Estado | O que a tela faz |
|---|---|
| ICs do navegador **= 0** | hachura no trecho + pílula **`não medido`** + tooltip dizendo que a etapa repete a seguinte |
| **misto** | declara a composição: `35 ICs · 11 do navegador` |
| tudo do navegador | nada — é medição inteira |

⛔ **A etapa NUNCA some.** Etapa que desaparece muda a forma do funil em
silêncio, e a forma é o que a pessoa compara entre períodos.

> ### ⛔ A PERGUNTA QUE GENERALIZA
> **"Esta etapa/coluna/série tem uma fonte INDEPENDENTE da vizinha, ou uma
> deriva da outra?"** Se deriva, a razão entre as duas não é medição — é
> tautologia com aparência de resultado. Vale para funil, para taxa de
> aprovação, para qualquer par onde um lado é escrito a partir do outro.

⚠️ O efeito colateral é bom e vale registrar: quem vê `não medido` no próprio
funil ganha motivo para instalar o pixel. **A etapa passa a vender a instalação
em vez de esconder que ela falta.**

# 🏷️ O RÓTULO SEGUE A CONTAGEM, NUNCA A REFERÊNCIA

> **Número certo com nome errado é pior que a ausência, porque o gestor DIVIDE
> por ele.** 07/08/2026.

A etapa 2 do funil se chamava **"Vis. Página"**, copiado da referência. O
`pixel.js` guarda com `sessionStorage` e grava **uma linha de `Click` por
SESSÃO** — quem navega por cinco páginas conta um. O rótulo prometia pageview e
entregava sessão. Hoje chama **Sessões**.

> ### 🔴 O SINAL QUE ESTAVA À VISTA
> O mesmo objeto já trazia `fonte: "Nosso script — 1 por sessão"`. **O rótulo e
> a fonte discordavam, lado a lado, no mesmo literal**, e ninguém tinha olhado.
>
> ⛔ **Quando dois campos vizinhos descrevem o mesmo dado e discordam, o errado
> é o que PROMETE MAIS.** A descrição técnica raramente mente — ela é escrita
> por quem acabou de ver a consulta. O rótulo curto é escrito por quem está
> pensando no layout.

⚠️ E ao copiar uma referência visual, **o nome vem da nossa medição, não do
print**. A referência conta o que a ferramenta dela mede.

# 🎨 GRADIENTE DE OPACIDADE MENTE SOBRE QUANTIDADE. DE MATIZ, NÃO.

> **A diferença entre o defeito da 4ª versão do funil e o acerto da 6ª**, e ela
> generaliza para qualquer gráfico. 07/08/2026.

| | |
|---|---|
| **Opacidade** | lê como INTENSIDADE. O olho integra "quão forte é isto aqui" e responde com uma grandeza — que compete com a que a forma já codifica |
| **Matiz ao longo de x** | lê como PERCURSO. Ninguém lê "mais violeta" como "mais quantidade" |

O caso: a fita do funil tinha `stopOpacity` de `0,55` na esquerda a `1,0` na
direita. A massa ia de 132px a 0,8px — ou seja, **a intensidade subia enquanto a
quantidade descia**. Medido, 1,24:1 de contraste contra o vizinho na ponta
grossa: a borda sumia justamente onde havia área, e sobrava uma névoa que
resolvia num traço nítido à direita. Isso lê como algo *emergindo*.

O comentário que defendia a rampa dizia que era *"ESTILO, não dado: ela não
codifica nada que a posição em x já não diga"*. **Codificava.**

> ### ⛔ A PERGUNTA
> **"Este canal varia junto com uma grandeza que o desenho já mostra?"** Se
> varia, ou ele concorda com ela ou está mentindo — e concordar é redundância.
> Matiz ao longo do comprimento escapa porque não é lido como magnitude.

⚠️ Vale para opacidade, saturação e espessura de traço. **Não** vale para matiz
percorrendo uma rampa contínua — que é o que faz a fita parecer fluxo.

# 🩹 A CICATRIZ QUE VIROU ANATOMIA

**Uma decisão tomada para contornar uma limitação técnica sobrevive à limitação
e passa a parecer intenção.** Ninguém mente: quem escreveu tinha razão, e quem
lê depois só encontra a regra, sem a limitação que a justificava.

O caso que nomeou a família (07/08/2026, na grade do Dashboard):

| | |
|---|---|
| A limitação | as larguras eram cinco presets — `[3, 4, 6, 8, 12]` |
| A decisão | *"empate desce"*, porque entre 6 e 8 o 7 fica à mesma distância |
| Como foi escrita | como decisão de PRODUTO: *"encolher no empate é o lado seguro — crescer empurraria o vizinho para a linha de baixo"* |
| O que ela custou | **as setas do teclado ficaram inertes**: `4 + 1 = 5` desempatava de volta para 4, e de qualquer preset uma seta voltava para ele |
| O que aconteceu com a limitação | ela sumiu. Com todas as colunas inteiras não existe empate entre consecutivos |

O argumento do "lado seguro" continuava **soando** correto depois que a lista
morreu — e é isso que torna a família perigosa. Cicatriz não dói; ela só fica
onde está, e a próxima pessoa a lê como parte do corpo.

> ### ⛔ A PERGUNTA QUE A DESMASCARA
> **"Esta regra ainda seria escolhida se eu estivesse começando hoje?"**
>
> Não é "ela está certa?" — ela costuma estar. É "ela é resposta a um problema
> que ainda existe?".

⚠️ **O sintoma é o controle inerte.** Uma regra órfã raramente aparece como erro:
ela aparece como um botão que não faz nada, um filtro que não filtra, uma seta
que não move. Quando um controle nasce inerte e o código parece certo, **procure
a regra que ele obedece e pergunte de qual limitação ela nasceu.**

⚠️ E ao escrever qualquer "⛔ sempre faça X" por causa de uma restrição —
biblioteca, formato, limite de API, ferramenta —, **escreva a restrição junto**.
É o que permite reavaliar quando ela cair. Uma regra sem a causa registrada é
uma cicatriz esperando para virar anatomia.

**Provavelmente há outras nesta base.** Candidatas: toda decisão tomada "porque
o `react-grid-layout` fazia assim", "porque o `--experimental-strip-types` não
lê `.tsx`" e "porque o plano Hobby só aceita cron diário".

# 🎲 QUANDO A PROPRIEDADE É UMA INVARIANTE, GERE ENTRADA ALEATÓRIA

> **Método, não nota de um bloco.** Registrado em 07/08/2026, depois de 200
> funis aleatórios acharem um bug que nenhuma asserção escrita à mão teria pego.

O funil promete uma invariante: **fluxo que continua + todas as perdas = a faixa
inteira**. Eu escrevi as asserções que se escrevem — o funil real, a perda
minúscula, a etapa que cresce, tudo zero. Todas passaram.

O que quebrou foi `[967, 959]`: **uma perda só, e ela é a maior.** O piso a
engrossava e o código compensava "descontando da maior" — que era ela mesma.
Ninguém escreve esse caso, porque ninguém pensa nele.

```js
for (let t = 0; t < 200; t++) {
  const vals = gerarFunilDecrescente();
  assert.ok(Math.abs(fluxoFinal(f) + somaPerdas(f) - faixa) < 0.01);
}
```

⚠️ **A semente é FIXA** (`semente = 7` no `teste-fluxo`). Aleatório de verdade dá
teste que falha uma vez por semana e ninguém consegue reproduzir. Com semente
fixa, o conjunto é sempre o mesmo e continua sendo grande demais para alguém ter
escolhido a dedo.

### É a mesma ideia do round-trip do break-even

| Teste | A relação verificada |
|---|---|
| Break-even | *"faturar exatamente o break-even dá lucro ZERO"* |
| Curva | *"a curva não sai do intervalo entre dois pontos consecutivos"* |
| Funil | *"fluxo + perdas = a faixa"* |

**Nenhum dos três conhece número nenhum.** Os três caem sozinhos quando alguém
quebra a relação, sem que ninguém tenha previsto o valor novo. Teste que congela
VALOR defende o bug; teste que congela RELAÇÃO defende o conserto.

⛔ Aleatório **não substitui** o caso nomeado. O funil real do dono continua
tendo asserção própria — ela é a que documenta o que se espera. O aleatório é o
que encontra o que ninguém esperava.

# 🧬 CORRIJA A SEQUÊNCIA QUE GERA O ERRO, NUNCA O RESULTADO DELA

> **Compensar depois é o `?? 0` de novo:** conserta o número final e preserva a
> origem. Toda vez que a correção for "somar/subtrair um delta para fechar a
> conta", a pergunta certa é *que passo anterior produziu o valor errado?*

O caso (07/08/2026, no funil): o piso de 3px engrossava a faixa de perda, o total
estourava, e eu descontava o excedente "da maior perda". Funcionava — até o caso
em que só existe uma perda, e a maior é ela mesma.

A correção certa não toca no total: ela mexe na **sequência de espessuras** que
gera as faixas. Garantindo que cada etapa fique pelo menos `piso` mais fina que a
anterior, a soma volta a fechar **por construção** — não há o que compensar,
porque as faixas são diferenças da mesma sequência.

| | |
|---|---|
| ❌ compensar | `total -= excedente` · a invariante vira uma conta a mais, que pode faltar |
| ✅ na origem | a invariante é consequência da estrutura, e não pode faltar |

⚠️ O sinal de alerta é literal: **se o código tem uma linha cuja única função é
fazer a soma fechar, a soma não estava fechando por si.**

# 🔗 QUANDO DOIS CÁLCULOS PRECISAM CONCORDAR, TESTE A PROPRIEDADE

**Teste que congela VALOR defende o bug. Teste que congela RELAÇÃO defende o
conserto.**

O break-even e o Lucro têm de consumir os mesmos custos. Uma asserção de valor
(`breakEven === 1322.50`) prova que o número não mudou — e passa igual se os dois
estiverem errados juntos, que é exatamente o estado em que a base já esteve
("duas implementações que erram IGUAL são piores, porque a divergência que
denunciaria o erro não existe").

A asserção que vale é a **propriedade que liga os dois**:

> *"Faturar exatamente o break-even dá lucro ZERO."*

Ela não conhece número nenhum. Se alguém acrescentar um custo ao Lucro e esquecer
do break-even — ou o contrário — ela cai na hora, sem ninguém ter previsto o
valor novo.

⚠️ **Aplique sempre que houver duas contas que precisam concordar:** total × soma
das partes, KPI × soma das linhas da tabela, faturamento do gráfico × do card.
A pergunta não é "qual é o número", é "que igualdade tem de valer".

# 💸 DESPESA RECORRENTE — o rateio, e a mudança de número em produção

> ### 📅 06/08/2026 — O LUCRO SUBIU, E É CORREÇÃO
>
> **A partir de 06/08/2026, o Lucro em janelas menores que um mês passa a ser
> maior. Não é bug novo, é correção — a despesa recorrente antes entrava inteira
> em qualquer janela, e a anual entrava inteira também.**
>
> Medido no dev, com uma despesa de cada frequência (50 diária · 100 semanal ·
> 500 mensal · 6.000 anual · 300 única) e faturamento de R$ 10.000:
>
> | Janela | Despesa ANTES | Despesa AGORA | Lucro antes → agora |
> |---|---|---|---|
> | Hoje (1 dia) | R$ 6.950 | **R$ 96,85** | 3.050 → **9.903** |
> | Últimos 7 dias | R$ 6.950 | R$ 677,97 | 3.050 → 9.322 |
> | Últimos 30 dias | R$ 6.950 | R$ 2.905,59 | 3.050 → 7.094 |
> | Agosto inteiro | R$ 6.950 | R$ 3.002,45 | 3.050 → 6.998 |
>
> ⚠️ Nem no mês inteiro o número volta ao antigo, e é correto: só a MENSAL vale
> cheia num mês: a DIÁRIA passa a multiplicar pelos 31 dias (era cobrada uma vez
> só) e a ANUAL vira 31/365.
>
> ### 📣 A frase para os testadores — ⏳ **A ENVIAR NO PUSH, não antes**
>
> ⛔ Tudo isto está na branch `redesign/dashboard`, **sem push**. Os testadores
> continuam vendo o Lucro antigo, errado. A mensagem sai quando o dono aprovar o
> push — nem antes, nem depois.
>
> *Corrigimos um erro no cálculo do Lucro. Despesas recorrentes estavam sendo
> descontadas por inteiro em qualquer período: uma mensalidade de R$ 500 era
> debitada tanto em "Hoje" quanto em "Últimos 30 dias", e uma despesa anual de
> R$ 6.000 também. O Dashboard do dia mostrava prejuízo que não existia. Agora
> elas são rateadas pelos dias do período, e a frequência que você cadastrou
> (diária, semanal, mensal, anual) passa a ser respeitada — antes ela era
> ignorada. Se o seu Lucro subiu, é isso: o número de antes estava errado.*

### A regra, e ela é UMA função

**`src/lib/despesas/rateio.ts` é a fonte única.** ⛔ Não rateie em outro lugar.

```
DIARIA   →  amount × dias
SEMANAL  →  amount × dias / 7
MENSAL   →  soma, por dia, de amount / dias-do-mês-DAQUELE-dia
ANUAL    →  soma, por dia, de amount / dias-do-ano-DAQUELE-dia
UNICA    →  0 (fora do cálculo)
```

⛔ **Nada de divisor fixo de 30.** A soma dia a dia é o que faz 30/07–01/08
pegar o divisor de julho e o de agosto, e fevereiro valer ÷28 ou ÷29. Um divisor
médio erraria nos dois meses ao mesmo tempo, e erraria mais quanto mais curta a
janela — que é onde o defeito dói.

⛔ **`janela` é OBRIGATÓRIA em `calcularFinanceiro`.** Opcional faria todo
chamador que esquecesse voltar ao comportamento antigo em silêncio.

### 🔜 PENDENTE: a migration `ocorreEm` (aprovada, não feita)

"Despesa única" sem data é um recurso quebrado, não uma limitação de dashboard.
Aprovada em 06/08/2026, **separada de propósito** — é a primeira mudança de
schema do redesign e não entra no meio de um commit de cálculo.

| | Desenho |
|---|---|
| coluna | `ocorreEm DateTime?`, nulo nas linhas existentes |
| nova `UNICA` | obrigatório |
| linha antiga sem data | continua FORA do cálculo, com o aviso na tela |
| backfill | ⛔ **NENHUM.** `createdAt` é quando a LINHA foi criada, não quando a despesa ocorreu — usá-lo inventaria semântica e quebraria quem cadastra hoje algo antigo |

> ### 🔴 TRÊS COMENTÁRIOS QUE AFIRMAVAM EFEITO INEXISTENTE — a evidência
>
> Achados na mesma investigação, e juntos eles mudam o retrato: **não eram três
> tratamentos da mesma despesa. Eram dois tratamentos e um comentário
> descrevendo um terceiro que nunca existiu.** Documentação inventando
> comportamento é pior que divergência.
>
> | Onde | Afirmava | O código fazia |
> |---|---|---|
> | `financeiro.ts:123` | *"Despesas recorrentes **rateadas** no período"* | `+= e.amount` — o valor cheio, 219 linhas abaixo |
> | `Sparkline.tsx:30` | *"num bucket com denominador zero elas saem `Infinity` ou `NaN`"* | o produtor devolvia `0`; o filtro não podia disparar |
> | `metrics.ts:923` | *"o lucro por hora rateia … **recorrentes**"* | usava `totalDescontos`, que as EXCLUI |
>
> ⛔ **Comentário que AFIRMA um efeito envelhece pior que comentário que EXPLICA
> uma decisão.** Uma decisão continua verdadeira depois que o código muda; uma
> afirmação sobre o que o código faz vira mentira no primeiro commit que a
> contraria — e ninguém revisa comentário.
>
> 🔜 **A varredura completa por comentários assim está na fila, depois do
> heatmap.** Estes três são a evidência de que ela vale a pena.

# ➗ DENOMINADOR ZERO — a regra, e o dia em que ficamos limpos

> Mapa completo em **`docs/design/05-MAPA-DAS-RAZOES.md`**. O que muda
> comportamento está aqui.

### A regra, decidida em 06/08/2026

```
denominador = 0  →  null (INDEFINIDO)
denominador > 0  →  a / b, inclusive 0 (valor real)
```

**Fonte única: `div()` de `src/lib/ads/metrics.ts`, exportado.** ⛔ Não escreva
outra — importe. Foi assim que nasceu: existiam **duas funções `div` com o mesmo
nome e contratos opostos**, e o arquivo do Dashboard citava a do Gerenciador
como modelo certo 56 linhas antes de declarar a própria ao contrário.

| Consumidor | O que faz com `null` |
|---|---|
| Apresentação | `"—"` (`format.ts`, `TRACO`) |
| **Motor de regras** | **a condição é PULADA** — não satisfaz operador nenhum |
| Sparkline | **interrompe a linha**; ponto isolado vira `<circle>` |

⚠️ **`gasto` e `vendas` seguem `number`.** São CONTAGEM: zero gasto é medição de
verdade, não ausência de denominador.

### 🔴 O defeito era o ESPELHO do que se temia — e ele mandava GASTAR

A hipótese era `Infinity > 50` pausar campanha nova. **Falso:** a guarda devolvia
`0`, nunca `Infinity`. Mas **`0` satisfaz todo `<` e `<=`**:

| Regra | Sem dado | O que fazia |
|---|---|---|
| `AJUSTAR_ORCAMENTO` se **CPA < 20** | zero conversões → CPA = 0 | 🔴 **escalava o orçamento de campanha que não vendeu nada** |
| `PAUSAR` se **ROAS < 1** | zero gasto → ROAS = 0 | 🔴 pausava campanha que nem começou |
| `PAUSAR` se **CPA > 50** | zero conversões → CPA = 0 | ✅ não disparava |

`>` e `>=` erram para o lado de não agir. **`<` e `<=` agiam por falta de dado**,
e o primeiro caso gasta dinheiro. Medido no dev: **2 campanhas disparavam**.

> ### ✅ 06/08/2026 — A CORREÇÃO FOI PREVENTIVA, NÃO REATIVA
> O dono rodou `regras:auditar` contra **produção (`dgaoucxkmpdxeenpfqth`)**:
> **nenhuma regra cadastrada**. Ninguém foi afetado — o conserto entrou **antes
> de a primeira regra existir**.
>
> Isto é registro de estado, não de conforto: a partir do momento em que existir
> regra em produção, a mesma pergunta deixa de ter resposta barata.

### Quantos pontos usam o contrato errado: **0 de 24** ✅

Fechado em 06/08/2026. Motor de regras ×3, séries ×4, criativos ×2, margem,
chargeback, funil, `rate`, `pctLabel` ×2, donuts.

Três dos 24 **continuam devolvendo `0`, e está certo** — são GEOMETRIA, não
métrica: `funnel.ts:62` (largura da barra), `DonutChart.tsx:46` (fração de
circunferência) e a fração do sparkline. Sem total, o desenho tem tamanho zero,
que é o desenho correto. O percentual que a pessoa LÊ passa por outro caminho e
devolve `"—"`. Estão anotados no código para não serem "corrigidos" por engano.

Dois arquivos saíram inteiros: `ui/Donut.tsx` e `ui/CountryMap.tsx` eram órfãos
do Dashboard antigo — tinham o defeito de verdade (`NaN%` sem guarda nenhuma) e
**consumidor nenhum**.

> ### 🔴 O `|| 1` ERA O PIOR DA LISTA, E POR UM MOTIVO DIFERENTE DOS OUTROS
> Os outros 🔴 devolviam **zero**, que alguém atento reconhece como "sem dado".
> O `|| 1` de `srcTotal` e `payTotal` **FABRICAVA um denominador**: com todas as
> fontes zeradas, `x.total / 1` saía `0%` — percentual plausível, calculado
> sobre uma unidade que não existe em lugar nenhum.
>
> Onde o número inventado aparecia: **na coluna de participação das tabelas de
> Fontes de tráfego e de Formas de pagamento**, no Dashboard. Não é
> arredondamento nem fallback — é um número com aparência de medição.

---

## ⛔ COMENTÁRIO QUE LISTA CASOS MORRE NO PRIMEIRO CASO NOVO

O `useTraffikState` tinha um aviso dizendo *"⛔ Estas CINCO não levam `?? 0`"*, e
ele **falhou exatamente pela porta que tentava fechar**: o `chargebackRate` não
estava entre as cinco, ganhou `?? 0` na linha seguinte, e a correção dele nasceu
inerte — compilando, com o tipo certo, sem chegar à tela.

Hoje o comentário descreve a REGRA:

> *"Todo valor que pode ser `null` porque o denominador não existe chega até a
> apresentação como `null`. Um `?? 0` ou `|| 0` nesta camada compila, mantém o
> tipo correto e desfaz a correção em silêncio."*

**Ao escrever advertência em comentário, descreva a regra, não a lista.** A lista
é ilustração; quem protege é a frase.

> ### 🔴 QUARTA VEZ: "PASSA NO BUILD COM A COISA DESLIGADA"
> | # | O quê | Como estava | O que morria |
> |---|---|---|---|
> | 1 | Anel de venda nova no globo | dependia de dado que não existe | o recurso — foi REMOVIDO, não deixado inerte |
> | 2 | Botão "Filtros" no header | sem dono | resolvido com CONTRATO: a tela registra a faixa, o header só desenha se alguém registrou |
> | 3 | `?? 0` sobre valor recém-nulo | tipo certo, build verde | a correção, que não chegava à tela |
> | 4 | **`elapsed()` renderizado no servidor** | **build verde** | 🔴 **a NAVEGAÇÃO** |
>
> O denominador comum é sempre o mesmo: **`tsc`, `lint` e `build` não perguntam
> se a coisa está ligada.** A varredura por `?? 0` / `|| 0` / `|| 1` sobre valor
> que virou anulável é obrigatória em toda mudança de contrato — a mudança de
> tipo aparece no compilador, o colapso silencioso não.
>
> ### 🔴🔴 PROTEÇÃO MORTA — a subfamília, e ela é a pior de todas
>
> Os casos 1–3 eram **funcionalidade** morta: o recurso não fazia nada, e a
> ausência era detectável usando o produto. A partir do 6º apareceu outra
> subfamília, e ela engana de um jeito diferente:
>
> | | O que era | Por que é pior |
> |---|---|---|
> | **hachura do heatmap** | existia para distinguir "sem observação" de "zero", e saía `rgba(0,0,0,0)` | falhava exatamente no que existia para garantir |
> | **asserção da série de lucro** | o comentário AFIRMAVA proteger a sincronia entre o teste e `buildChart`; protege só a propriedade | um teste que promete cobertura que não tem |
>
> **Proteção morta é pior que funcionalidade morta porque quem a colocou PARA DE
> VIGIAR o problema.** Funcionalidade que não funciona incomoda até alguém
> consertar; proteção que não protege produz silêncio — e o silêncio é lido como
> "está coberto".
>
> ⛔ **Ao escrever qualquer guarda — filtro, asserção, validação, fallback —
> pergunte o que a faria DISPARAR, e produza esse caso uma vez.** Guarda que
> nunca disparou na vida não é guarda; é comentário com sintaxe de código.
>
> ⚠️ E se a guarda tiver limite (uma cópia que pode divergir, um caso que ela não
> cobre), **o limite vai escrito nela**. Foi o que faltou nas duas acima.

> ### 🔴🔴 O 4º É O PIOR, E POR UM MOTIVO NOVO
> Os três primeiros deixavam **funcionalidade** morta. O quarto deixou a
> **navegação** morta: `/dashboard/integracoes` abria por URL direta e **voltava
> para `/dashboard` ao ser aberta pelo menu**. E passava verde nos três.
>
> **A causa:** `elapsed()` lê `Date.now()`. Num componente que renderiza no
> servidor, o HTML sai com "há 4 minutos", o cliente hidrata instantes depois e
> calcula "há 5" — os textos divergem e **o React aborta a hidratação da árvore
> inteira**. O efeito visível não é o texto errado; é a página não funcionar.
>
> ### ⛔ REGRA QUE FICA
> **Nenhum `elapsed()`, "há N minutos" ou `Date.now()` renderizado direto em
> componente que passa pelo servidor.** Use **`components/tk/Desde.tsx`**.
>
> ⚠️ **"Client component" NÃO protege** — no App Router todo componente cliente
> é renderizado no servidor para o HTML inicial. O que protege é uma destas duas
> coisas, e a diferença importa:
>
> | Proteção | Por quê | Fragilidade |
> |---|---|---|
> | **por ESTRUTURA** | o nó não existe no HTML do servidor — `Popover` faz `return null` enquanto fechado | robusta |
> | **por TIMING** | o dado nasce `null` e só chega por `fetch` no cliente | 🔴 **quebra no dia em que alguém passar dado inicial do servidor** |
>
> **Varredura de 06/08/2026** — `elapsed()` tem 5 call sites fora do `Desde`:
>
> | Local | Proteção |
> |---|---|
> | `NotificationsBell:117` | ✅ estrutura (`Popover` fechado) |
> | `useTraffikState` feed (`dashData`) | ⚠️ **timing** — anotado no código |
> | `useTraffikState` `syncLabel` | ⚠️ **timing** — anotado no código |
> | `RulesView:328` | 🔴 **estava EXPOSTO** (`initialRules` vem do layout) — corrigido |
> | `PixelView` (2×) | a conferir na reescrita daquela tela |
>
> Os dois casos de timing levam a frase **"SEGURO POR TIMING, NÃO POR
> ESTRUTURA"** no comentário, com o que quebraria — senão a próxima pessoa
> confia sem saber por quê.

## 📊 O MONOLITO `useTraffikState` — a dívida, com número

**1.953 linhas e 18 dependentes** antes da reescrita de Integrações. Cada acessor
novo aumenta o que um dia vai precisar ser quebrado.

**A reescrita de Integrações acrescentou 2 acessores:**

| Acessor | Por quê |
|---|---|
| `perfisCrus` | os DTOs sem handlers. `adProfiles` é modelo de TELA para Integrações › Anúncios; a Visão geral precisa do bruto |
| `notifItems[].timestamp` | o instante cru, para `<Desde>`. O `timeLabel` ao lado só é seguro dentro do popover |

⛔ **Não pare de adicionar quando precisar — só mantenha este número.** Dívida
sem número cresce sem ninguém perceber.

---

## 🛠️ DOIS DEFEITOS DO `regras:auditar` — anotados, NÃO corrigidos

▸ 🔴 **O script ignora `$env:DATABASE_URL`.** Ele faz `import "dotenv/config"`,
que carrega o `.env` **por cima** do ambiente. Variável de ambiente tem de
vencer arquivo — o oposto disso fez o dono **rodar duas vezes contra o banco
errado achando que auditava produção**. Vale para todo script com `dotenv/config`
nesta base, não só este.

▸ ✅ **Ele imprime o projeto no cabeçalho**, e foi o que salvou a auditoria.
**Replique em qualquer script que aceite `--url`:** a primeira linha da saída diz
em qual banco a operação está acontecendo.

## 🟨 A FAIXA DO TOPO É DERIVADA DO BANCO CONECTADO — não de flag

Verificado em 06/08/2026, a pedido do dono. **Não existe `NODE_ENV` nem variável
separada** no caminho: `dbEnv.ts:41` lê `process.env.DATABASE_URL`, e
`prisma.ts:59` lê **a mesma variável** para abrir a conexão. Não há como a faixa
apontar um projeto diferente daquele em que a consulta roda.

Os limites são fail-safe: URL fora do padrão → `BANCO NÃO IDENTIFICADO` **com**
faixa; ref desconhecido → `BANCO DESCONHECIDO` **com** faixa. Só o ref
explicitamente marcado como produção não ganha faixa, que é a decisão registrada.

⛔ **Se alguém um dia trocar isso por uma flag, a garantia acaba.** A propriedade
inteira vem de as duas coisas lerem a mesma string.
