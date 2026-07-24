@AGENTS.md

# Traffik — guia do projeto

Ferramenta de tracking de tráfego/vendas + Facebook Ads (estilo Utmify).
As **v1 (13 fases)** estão completas e reais. Agora estamos executando o
**roteiro v2 (13 blocos)**, um bloco por vez.

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
  usamos **Vercel Cron** no lugar (ver `vercel.json`)

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
      dashboard  ads  ads/status  ads/campaign  creatives  notifications  pixel/test
      sync/facebook  rules/run
      cron/{sync-facebook,run-rules,reports}   # Vercel Cron (CRON_SECRET)
      auth/[...nextauth]  auth/facebook  auth/facebook/callback
  components/dashboard/
    TraffikContext.tsx              # contexto + useTraffik() hook
    DashboardShell.tsx              # client: roda useTraffikState 1x e provê o contexto
    Header.tsx  Sidebar.tsx         # navegação por ROTA (usePathname + Link)
    EditDashboardDrawer.tsx  Icon.tsx  ImageSlot.tsx
    useTraffikState.ts              # HOOK GIGANTE: todo o estado/derivações do dashboard
    types.ts                        # só TabKey e MetricKey
    views/                          # DashboardView, AdsManagerView, CreativesView, RulesView,
                                    #   NotificationsView, FeesView, UtmView
    views/integracoes/              # AnunciosView, WebhooksView, PixelView, TestesView
  lib/
    prisma.ts appUrl.ts format.ts sx.ts
    actions/                        # server actions ("use server"), retornam DTOs
      webhooks pixels rules notifications expenses facebook dashboardPrefs session
    dashboard/metrics.ts            # computeDashboard (KPIs reais)
    ads/{overview,creatives}.ts     # dados do gerenciador e ranking de criativos
    facebook/{graph,sync,manage,capi}.ts
    webhook/{normalizeSale,matchClick,dispatchPixel,dispatchNotification}.ts
    rules/engine.ts  reports/generate.ts
  generated/prisma/                 # cliente Prisma gerado (GITIGNORED)
prisma/{schema.prisma, seed.ts, migrations/}
scripts/demo-data.mjs               # gera dados de exemplo (NÃO rodar em prod)
public/pixel.js                     # script de tracking instalável
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
npx prisma db seed             # cria teste@traffik.io / traffik123
npm run dev                    # http://localhost:3000
```
Logins: `teste@traffik.io` / `traffik123` (vazio) · `pedrodurso8@gmail.com` /
`24032005p` (dono; tem 1 perfil FB + 6 contas reais).

---

## Status dos blocos (roteiro v2)

| Bloco | Descrição | Status |
|-------|-----------|--------|
| 1 | Reestruturação da navegação (rotas reais) | ✅ **Feito** |
| 2 | Grid arrastável do Dashboard | ⏳ pendente |
| 3 | Filtros e container do topo | ⏳ pendente |
| 4 | Métricas do Dashboard (ROI×, ARPU, CPA, por horário…) | ⏳ pendente |
| 5 | Gráficos (funil, mapa de países, donuts, taxa de aprovação) | ⏳ pendente |
| 6 | Gerenciador de Anúncios: layout+colunas estilo FB | ⏳ pendente |
| 7 | Gerenciador: painel de ações em massa (CBO/ABO) | ⏳ pendente |
| 8 | Regras: reformulação completa (modal, import/export) | ⏳ pendente |
| 9 | Integrações › Anúncios (vitrine de perfis) | ✅ **Feito** |
| 10 | Integrações › Webhooks (Kirvano + credenciais de API) | ⏳ pendente (**próximo**) |
| 11 | Integrações › UTMs (códigos xcod + scripts) | ⏳ pendente |
| 12 | Integrações › Pixel (script próprio) | ⏳ pendente |
| 13 | Integrações › Testes (central de diagnóstico) | ⏳ pendente |

Ordem recomendada do roteiro: 1 → 9,10,11,12,13 → 2 → 3,4 → 5 → 6,7 → 8.

---

## O que foi feito nos Blocos 1 e 9 (honesto)

### Bloco 1 — navegação (commit `2138e4b`)
Feito:
- SPA de abas em estado → **rotas reais** do Next. Grupo `(app)` com layout que
  busca os dados e renderiza `DashboardShell` (provider de contexto, 1 único
  `useTraffikState`, sem duplicar polling).
- `Sidebar`/`Header` por rota (`usePathname` + `Link`). Sino de notificações no Header.
- "Facebook Ads" → **Integrações** com 5 sub-abas full-width = rotas próprias
  (`/dashboard/integracoes/{anuncios,webhooks,utms,pixel,testes}`).
- "Rastreamento UTM" saiu da sidebar → virou sub-aba **UTMs** (conteúdo só movido).
- Redirects: `/dashboard/facebook` e `/dashboard/utm` → novas rotas; callback do
  OAuth agora cai em `integracoes/anuncios`.
- `FacebookView` desmembrada em `views/integracoes/{Anuncios,Webhooks,Pixel,Testes}View`;
  `TraffikApp` e `FacebookView` deletados.

**Incompleto / TODO no Bloco 1:**
- `useTraffikState` **ainda retorna código de navegação MORTO** (`navAnalise`,
  `navAuto`, `navConfig`, `pageTitle`, `pageSubtitle`, `activeTab`, `fbTabs`,
  `fbSub` e os handlers `.go`/`set({activeTab})`). Nada disso é renderizado
  (Sidebar/Header usam rota), mas não foi removido. **Limpar num próximo passo.**
- As **abas internas do Gerenciador de Anúncios** (Contas/Campanhas/Conjuntos/
  Anúncios) **continuam sendo estado de componente** (`adsTabs`/`adsSub`), NÃO
  rotas. O Bloco 1 só roteou a navegação principal + Integrações. O Bloco 6 vai
  refazer essa parte.

### Bloco 9 — Integrações › Anúncios (commit `b82b28b`)
Feito:
- Vitrine: tiles de perfil (foto, nome, nº de contas, quantas rastreando). Clicar
  expande num **painel full-width** (`grid-column:1/-1`) com a lista de contas.
- Por conta: nome, `act_id`, status (Ativa/Desabilitada), **toggle de rastreamento**,
  **botão "Sincronizar" individual** (busy + resultado). **Toggle "Ativar todas"**
  no topo do perfil. Tile **"+ Adicionar perfil"**.
- Backend: `syncSingleAccount` + `POST /api/sync/facebook` aceita `{accountId}`;
  server action `setProfileTracking(profileId, enabled)`.

**Incompleto / TODO no Bloco 9:**
- **Não houve confirmação visual por screenshot** na conta conectada — a sessão do
  navegador estava no `teste@traffik.io` (sem Facebook). Foi verificado via **SSR**
  (renderiza as 6 contas reais do `pedrodurso8`) + teste do endpoint de sync por
  conta. Recomendo abrir logado como `pedrodurso8` e conferir o expand/sync visualmente.
- Sync por conta usa janela fixa de **30 dias**. Sem paginação para muitos perfis.

---

## Decisões técnicas relevantes

- **Rotas + contexto compartilhado** em vez de estado por rota: um único
  `useTraffikState` no `DashboardShell` provido via contexto evita múltiplos loops
  de polling. Páginas de rota são wrappers finos.
- **Grupo `(app)`** só para permitir que `test-checkout` fuja do shell (sidebar).
- **Prisma 7 exige driver adapter** (`pg`). Pooler para o app, session pooler para
  migrations. Para o Supabase, remover `pgbouncer=true` e usar
  `?sslmode=require&uselibpqcompat=true`.
- **BullMQ → Vercel Cron** (serverless não roda worker). 3 crons no `vercel.json`:
  `sync-facebook` e `run-rules` a cada 15min, `reports` de hora em hora. Protegidos
  por `CRON_SECRET`.
- **Atribuição venda→campanha/criativo é "best-effort"** por `utm_campaign` = nome
  da campanha (e `utm_content` = nome do anúncio). Enquanto os UTMs não baterem com
  os nomes, "Vendas/ROAS" por campanha/criativo aparecem zerados. O **Bloco 11**
  (parser do `xcod` da Hotmart com `campaign.id/adset.id/ad.id`) é o que torna isso
  confiável — vários blocos dependem dele para métricas de venda corretas.

---

## ⚠️ Pendência crítica — DEPLOY NA VERCEL

**A produção (`342dd-virid.vercel.app`) está servindo um build ANTIGO (pré-Fase-7).**
Todas as rotas `/api/*` novas dão **404** lá. O **GitHub está 100% atualizado** —
o problema é que o **auto-deploy da Vercel parou de disparar** (10+ pushes, 0 deploys
novos). Um empty commit não resolveu.

- **Causa provável:** integração GitHub→Vercel desconectada, OU a produção está
  "pinada" num commit antigo.
- **Fix pendente:** na Vercel → Settings → Git, reconectar o repo `Pedroadsdurso/
  traffik` (branch `main`) e forçar um deploy do commit mais novo. Redeploy de um
  deployment antigo **não** resolve (ele rebuilda o mesmo commit).
- **Consequência:** NADA da v1 pós-Fase-6 nem da v2 está no ar ainda. Só o localhost
  reflete o estado atual. O usuário optou por resolver o deploy **depois** dos blocos.

## Banco de dados
Supabase (ref `dgaoucxkmpdxeenpfqth`, us-east-1). Usuários: `teste@traffik.io`
(vazio) e `pedrodurso8@gmail.com` (dono, 1 perfil FB + 6 contas reais, 0 campanhas
sincronizadas). O Prisma Postgres temporário antigo foi abandonado (auto-expira).

---

## Próximo passo recomendado

1. **Resolver o deploy da Vercel** (fix acima) para que Bloco 1 e 9 fiquem de fato
   no ar — senão seguimos construindo às cegas em produção.
2. Depois, **Bloco 10** (Integrações › Webhooks): bloco esquerdo com Kirvano (token
   do usuário → gera URL única + parser dos eventos gerada/paga/reembolso/chargeback,
   o que também habilita a "Taxa de Aprovação" do Bloco 5); bloco direito com
   credenciais de API genéricas.
