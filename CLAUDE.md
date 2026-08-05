@AGENTS.md

# Traffik — guia do projeto

Ferramenta de tracking de tráfego/vendas + Facebook Ads (estilo Utmify).
As **v1 (13 fases)** estão completas e reais. Agora estamos executando o
**roteiro v2 (13 blocos)**, um bloco por vez.

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
    EditDashboardDrawer.tsx  Icon.tsx  ImageSlot.tsx
    blocks.ts                       # registro dos blocos do Dashboard (Bloco 2)
    useDashboardLayout.ts           # estado do grid (layouts, modo de edição)
    ui/{Select,DateRangePicker}.tsx # select próprio + calendário de intervalo
    ui/{AreaChart,Donut,Funnel,CountryMap}.tsx  # gráficos do Bloco 5
    DashboardGrid.tsx  BlockContent.tsx   # grid arrastável + conteúdo de cada bloco
    useTraffikState.ts              # HOOK GIGANTE: todo o estado/derivações do dashboard
    types.ts                        # só TabKey e MetricKey
    views/                          # DashboardView, AdsManagerView, CreativesView, RulesView,
                                    #   NotificationsView, FeesView, UtmView
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

## 🔐 Segurança: credenciais encriptadas em repouso

`src/lib/crypto/secrets.ts` — **AES-256-GCM**, chave em `ENCRYPTION_KEY`
(`openssl rand -base64 32`). Envelope `trkenc.v1.<iv>.<tag>.<ct>` em base64url.

- **Encripta na escrita, decripta só no momento de usar** o segredo para chamar a
  API externa. O prefixo do envelope permite distinguir ciphertext de texto puro
  legado, o que torna a migração **idempotente** (`decryptSecret` devolve texto
  puro intacto; `encryptSecret` não re-encripta).
- **Colunas cobertas:** `MetaPixel.accessToken`, `PixelConfig.accessToken`
  (legado da Fase 10) e `ApiCredential.key`.
- **`ApiCredential` precisou de `keyHash`** (migration `20260724190000`): a chave
  chega na request e precisa virar um `where`, mas o ciphertext tem IV aleatório e
  não serve para busca. O `keyHash` é `sha256(ENCRYPTION_KEY || chave)` — com sal
  da própria chave, então não cai em rainbow table. **O login da API usa o
  `keyHash`; a coluna `key` só é decriptada no botão "revelar".**
- **Backfill:** `node scripts/encrypt-secrets.mjs` (`--dry` para simular). Importa
  o **mesmo** módulo `secrets.ts` da aplicação (Node faz type-stripping do `.ts`) —
  duplicar a lógica de cripto poderia divergir e corromper dados.

> ⚠️ **Trocar a `ENCRYPTION_KEY` torna ilegível tudo que já foi gravado.** Não há
> rotação de chave implementada. Se precisar trocar, decripte antes com a chave
> antiga.

**Ainda em texto puro (fora do escopo pedido, decidir depois):**
`AdProfile.accessToken` (token OAuth do Facebook) e `Webhook.secret` (token de
segurança da Kirvano). Ambos usam o mesmo helper se um dia forem migrados — o
`Webhook.secret` é só comparado por igualdade, então poderia virar hash.

---

## 🌐 URL pública nos scripts gerados

Os scripts que o usuário instala **rodam no site dele**, então `window.location.origin`
ali é o domínio do cliente, não o nosso. Ambos os geradores (pixel e UTM) usam
**`getPublicAppUrl()`** (`src/lib/appUrl.ts`), que lê `NEXT_PUBLIC_APP_URL`.

- `NEXT_PUBLIC_APP_URL` precisa ser lida como **literal** (`process.env.NEXT_PUBLIC_APP_URL`)
  — o Next substitui a expressão inteira em build; desestruturar `process.env` quebra.
- Sem a env var, cai em `window.location.origin` para não travar o dev — por isso a
  UI **mostra a URL resolvida** nas abas Pixel e UTMs e **avisa em amarelo** quando é
  `localhost`, deixando o erro visível antes de instalar no site.

> Desde a mudança para loader (abaixo), a URL entra no `src` da tag `<script>` e o
> runtime **deriva a API do próprio `src`** — regenerar o snippet continua necessário
> se o domínio mudar, mas o `apiBase` nunca fica dessincronizado do arquivo servido.

---

## 📦 Scripts instaláveis: INLINE, e por que voltamos atrás

> ### ⛔ NÃO transformar os scripts em loader de novo (decisão de 28/07/2026)
> Durante um dia inteiro os scripts viraram um **loader** de uma linha + runtime
> hospedado (`public/t.js`, `public/px.js`, minificados com terser). O snippet caiu
> de 5.800 para 743 bytes, mas a mudança **quebrou instalações em produção** e o
> usuário mandou reverter. Tudo isso foi desfeito: `src/scripts/`, `public/t.js`,
> `public/px.js`, `scripts/build-scripts.mjs`, o terser, os headers de cache do
> `next.config.ts` e o componente de dois formatos.
>
> **O que ficou:** `utmScript()` e `pixelScript()` devolvem o **código completo,
> autocontido**, para colar no `<head>`. Uma opção, um botão "Copiar script", sem
> loader e sem arquivo hospedado. `public/pixel.js` voltou a ser a fonte original
> da v1 (instalações antigas continuam funcionando).
>
> **Por que o ganho de tamanho não compensou:** o snippet é copiado uma vez e vive
> no HTML do cliente; os ~3 KB não são o gargalo. O custo real foi a dependência de
> rede (o arquivo pode não carregar, ficar em cache velho, ou o campo onde o
> snippet é colado tratar as tags `<script>` de forma diferente). Autocontido não
> tem nenhuma dessas falhas — cola e funciona.
>
> ⚠️ O `Cache-Control` de 5 min chegou a esconder um bug real durante o diagnóstico:
> o navegador servia o `px.js` antigo (`stale-while-revalidate`) enquanto o servidor
> já tinha o novo. Com script inline esse problema deixa de existir.

### O que o script de pixel inline dispara

| Evento | Quando | Configurável? |
|---|---|---|
| `PageView` | todo carregamento de página | **sempre ativo** — não é regra |
| `Lead` | submit de qualquer formulário | toggle |
| `AddToCart` | clique em elemento com cara de carrinho | toggle |
| `InitiateCheckout` | ver modos abaixo | toggle + modo |

> **`PageView` não passa por `PixelEventRule`** e por isso **não exigiu migration**:
> o enum `PixelEventType` continua com LEAD/ADD_TO_CART/INITIATE_CHECKOUT/PURCHASE.
> Em `/api/pixel/event` ele é aceito sem consulta de regra (`isPageView`), e
> `CapiEventName` ganhou `"PageView"`. Se um dia virar configurável, aí sim precisa
> de enum novo + migration.
>
> ⚠️ **PageView dispara a cada pageview**, então o feed enche mais rápido que antes.
> É diferente do "Clique" do `t.js`, que é **uma vez por sessão**.

## 📦 (histórico) Loader + runtime hospedado — REVERTIDO

**O que o cliente cola no site é um loader de 3–5 linhas**, não a lógica. A lógica é
servida por nós, minificada com **terser** no build.

| Camada | Arquivo |
|---|---|
| Fonte (legível, ES5, comentada) | `src/scripts/traffik-utm.src.js` · `src/scripts/traffik-pixel.src.js` |
| Build (terser) | `scripts/build-scripts.mjs` — roda no `npm run build`; `--check` falha se o commitado estiver defasado |
| Servido | `public/t.js` (UTMs) · `public/px.js` (pixel) · `public/pixel.js` (**alias legado** do `t.js`) |
| Gerador do snippet | `utmLoaderSnippet()` em `src/lib/utm/scripts.ts` · `pixelLoaderSnippet()` em `src/lib/pixel/script.ts` (um por pixel cadastrado) |
| Tela | `ui/SnippetBox.tsx` — um bloco, um botão, **sem alternativa** |

> ### 🎯 InitiateCheckout: por que NÃO dá para detectar por URL do checkout
> **O checkout da Kirvano é hospedado pelo gateway (`pay.kirvano.com`) e o cliente
> não tem acesso ao código daquela página.** A regra `contem_url` compara a URL da
> página onde o script está rodando — se o script não roda lá, o evento nunca
> dispara. Foi exatamente essa a configuração que ficou sem gerar eventos.
> Existem duas vias, e as duas funcionam **sem script no checkout**:
>
> 1. **Clique no link de checkout** (`clique_checkout`, o padrão): o `px.js` na
>    página de vendas escuta cliques e sobe do alvo até o `<a>` — o clique quase
>    sempre cai num `<span>`/`<img>` dentro do link. Se o `href` casa com um
>    domínio de gateway (lista padrão: `pay.kirvano.com`, `hotmart`, `cartpanda`,
>    `kiwify`, `monetizze`, `pay.`, `checkout`, ou a lista do usuário), dispara.
> 2. **Webhook do gateway** (`src/lib/webhook/checkoutEvent.ts`): toda venda que
>    chega **PENDENTE** vira um InitiateCheckout — cobre `PIX_GENERATED`,
>    `BANK_SLIP_GENERATED`, `SALE_PENDING` e `ABANDONED_CART`. Venda que já chega
>    APROVADA **não** gera checkout (ela já conta como venda no funil).
>
> **Dedup em duas camadas:** `eventId = "gw:<externalId>"` mata a reentrega do
> gateway (a Kirvano reenvia o mesmo `PIX_GENERATED` — visto em produção), e o
> `fbclid` do clique casado mata a contagem dupla clique+webhook dentro de 6h.
>
> ⚠️ Os modos `contem_texto`/`contem_css`/`contem_url` continuam disponíveis, mas
> `contem_url` só serve para checkout **no seu próprio domínio**. A UI avisa isso.

> ### 🐛 Regressão: Lead e AddToCart nunca apareciam no feed (corrigido)
> `computeDashboard` filtrava `where: { event: "InitiateCheckout" }` ao buscar os
> `PixelEvent` do feed de Atividade Recente. Os eventos eram gravados normalmente,
> mas **só o InitiateCheckout chegava à tela** — Lead e AddToCart existiam no banco
> e sumiam na consulta. Agora a consulta traz todos, e o feed tem badge próprio
> para `lead` e `add_to_cart`. O funil continua contando só InitiateCheckout, mas
> por um `count()` separado: antes usava o tamanho da lista, que é truncada em 200
> e agora inclui outros eventos — usar o mesmo dado subcontaria o funil.
>
> ⚠️ **PageView nunca existiu** neste projeto: não está no script antigo, não é
> enviado, não é gravado e não é um tipo do feed. Se for pedido, é feature nova —
> e vale lembrar que o "Clique" do `t.js` já registra a visita uma vez por sessão.

> ### ⚠️ UMA opção de instalação, sem ramificação — decisão do usuário (28/07/2026)
> **A tela mostra UM snippet e UM botão "Copiar script". Não existe formato
> alternativo, nem "colei e não funcionou?", nem seletor.** Os dois já existiram
> aqui e foram removidos: transformavam um detalhe de bastidor em decisão de quem
> só quer copiar, colar e rastrear.
>
> O snippet é um **IIFE em JavaScript puro** (`utmLoaderSnippet` / `pixelLoaderSnippet`),
> sem tags `<script>` próprias, porque é o formato que funciona nos dois campos
> onde ele é colado: o de "código do cabeçalho" do site e o de script de
> gateway/checkout, que aceita só JavaScript. Um snippet que trouxesse as próprias
> tags viraria `<script><script>…</script></script>` num campo que embrulha, e não
> executaria — foi assim que a instalação no checkout quebrou em silêncio.
>
> ⚠️ **Limite conhecido e aceito:** JavaScript puro **não executa** se for colado
> num campo que insere o texto como HTML cru sem embrulhar em `<script>`. Na
> prática os campos de "cabeçalho" embrulham, e o ganho de ter uma opção só
> compensa. Se um caso desses aparecer, a saída **não** é reintroduzir escolha na
> tela — é ajustar o texto de instrução ou detectar o caso, nunca devolver a
> decisão ao cliente.
>
> Pelo mesmo motivo o loader **não tem mais JavaScript inline**: além do problema
> acima, CSP com `script-src` restrito bloqueia inline no site do cliente. A config
> viaja em `data-cfg` / `data-lead` / `data-atc` / `data-ic-t` / `data-ic-v`, e o
> runtime registra **todas** as tags do `px.js` na página (um pixel por tag).
>
> **Regra de IC por URL (`contem_url`) exige o script NO CHECKOUT**, não no site de
> vendas — é a URL do checkout que precisa casar. A gaveta do Pixel agora avisa
> isso em amarelo quando detecta esse tipo de regra, porque é um erro de instalação
> invisível: tudo parece configurado e nenhum evento chega.

**Tamanho no `<head>` do cliente: 5.800 → 743 bytes (−87%).** UTM 3.145 → 275 B; pixel
2.655 → 468 B. Os runtimes servidos ficam em 3.471 B e 3.011 B (1,77 e 1,56 KB gzip),
baixados **uma vez** e cacheados.

Pontos que não são óbvios:

- **A saída é COMMITADA** (mesma escolha do `gen-world-paths.mjs`): `npm run dev` serve
  os arquivos sem passo extra e nenhum deploy sobe sem eles.
- **`public/pixel.js` deixou de ser fonte** — hoje é gerado, byte a byte igual ao
  `t.js`. O runtime aceita **os dois formatos de configuração** (`data-account` do
  script antigo e o loader novo) e ainda expõe `window.getTrackingData`, então quem
  instalou a versão da v1 continua funcionando sem reinstalar. `test-checkout` usa
  exatamente esse caminho.
- **O loader não bloqueia**: cria a tag com `async=1` e injeta no `<head>`. Medido no
  teste — DOM interativo em 46 ms, os dois scripts só terminaram em 51 ms.
- **`next.config.ts` define `Cache-Control: max-age=3600, stale-while-revalidate`** para
  os três arquivos. O padrão do Next para `public/` é `max-age=0`, o que faria cada
  pageview do site do cliente revalidar antes de rastrear.
- **O loader do pixel deixa um stub com fila** (`window.traffikPixel.track` enfileira em
  `q`), drenada quando o runtime chega — um `track()` manual no HTML do cliente não se
  perde mais por corrida.
- **Configuração de vários pixels na mesma página**: o loader empurra para `window._tkpx`
  e o runtime **troca o array por um objeto com `push`** que inicializa na hora. Assim
  um loader que rode depois do runtime também é atendido, e instalar o mesmo snippet
  duas vezes não duplica evento (guardas `__tkpxL` / `registrados`).
- **`jsonInline()` escapa `<`** na config embutida: um valor de regra contendo
  `</script>` fecharia a tag e quebraria a página do cliente.
- O **back redirect continua inline** (~460 B): o destino muda por instalação e um
  loader para ele seria maior que o próprio código.

**Testado ponta a ponta** com um site falso em `localhost:4321` (origem diferente,
snippets gerados pelos geradores reais): runtime e pixel carregados, UTMs + fbclid no
cookie, `click_id` devolvido pelo `/api/track/click` (CORS ok), link de checkout
decorado e link comum intacto, `Lead`/`AddToCart`/`InitiateCheckout` gravados em
`PixelEvent`, fila drenada, clique registrado **uma vez por sessão** mesmo após reload.
`tsc --noEmit` e `next build` limpos. Dados de teste removidos depois.

> ⚠️ **Ao mexer nos `.src.js`, rode `npm run scripts:build` e commite a saída.** O
> `npm run build` regenera, mas um commit sem isso deixa `public/*.js` divergente da
> fonte — `npm run scripts:check` existe para pegar isso.

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

### Bloco 10 — Integrações › Webhooks (commit `9f9dfa9`)
Feito:
- Aba em **dois blocos lado a lado** (`grid auto-fit minmax(360px,1fr)`).
- **Esquerda (Webhooks):** estado vazio + modal "Adicionar Webhook" com **busca de
  gateway**; só **Kirvano** habilitada (Hotmart/Kiwify "em breve" — array `GATEWAYS`
  extensível). Fluxo Kirvano: usuário cola o **token de segurança** (guardado em
  `Webhook.secret`) → gera URL única **`/api/webhook/kirvano?id={token}`**. Lista com
  monograma/nome/status/toggle/URL+copiar/editar/remover.
- **Endpoint `/api/webhook/kirvano`**: valida o token (header `security-token`/
  `x-security-token` ou `token`/`security_token` no corpo → 401 se não bater) e usa
  **`parseKirvano`** (eventos oficiais → status: PIX/boleto/carrinho=PENDENTE,
  SALE_APPROVED=APROVADA, REFUNDED=REEMBOLSADA, CHARGEBACK, REFUSED=CANCELADA).
  O upsert por `externalId` faz a transição **gerada→paga** numa única linha — é o que
  habilita a **Taxa de Aprovação** do Bloco 5 (não precisou de schema novo pra isso).
- **Direita (Credenciais de API):** nova tabela **`ApiCredential`** (migration
  `20260724164141`). Gera chave `trk_live_*` (crypto), exibida **uma vez** (copiar),
  depois **mascarada** com revelar/revogar/excluir. **Endpoint `/api/webhook/ingest`**
  autentica por `Authorization: Bearer {key}` e ingere venda genérica. Seção
  **"Como usar"** (`<details>`) documenta o payload.
- **Refactor:** pipeline de ingestão extraída para **`src/lib/webhook/ingestSale.ts`**
  (compartilhada por Kirvano, ingest genérico e webhook por token). Helpers de
  `normalizeSale` exportados (`pick`/`toNumber`/`toStr`/`mapPayment`/`isObj`/`Json`).
  Rota antiga `/api/webhook/sale/[token]` agora escolhe parser pela `platform`.

**Testado ponta a ponta (dev server + DB):** parser Kirvano (`R$ 197,00`→197, PIX,
nome/produto), gerada→paga por upsert, token errado→401, ingest com key→200 / sem ou
inválida→401, `lastUsedAt` atualizado. `tsc --noEmit` e `next build` limpos.
**Verificado visualmente** (logado como `teste@traffik.io`): dois blocos + modal do
seletor de gateway (Kirvano habilitada, Hotmart/Kiwify "em breve").

**Incompleto / TODO no Bloco 10:**
- Só a **Kirvano** tem parser dedicado (o roteiro pediu só ela por ora).
- A URL do webhook usa **`getAppUrl()`** (localhost em dev). Em prod dependerá do
  deploy da Vercel (pendência crítica abaixo).
- `ApiCredential.key` é guardada **em texto puro** (necessário para o "revelar" do
  roteiro). Se um dia optar por hash, o botão "revelar" deixa de ser possível.

### Bloco 11 — Integrações › UTMs (commit `e4bee7f`)
Feito:
- Aba reformulada em 2 blocos (`UtmsView` **autocontida** — busca dados via server
  action, estado local; a `UtmView` antiga foi **removida**). A rota `utms/page.tsx`
  agora renderiza `<UtmsView />` sem `v`.
- **Códigos:** botão "Ver opções" → popup com **Hotmart/Cartpanda/Outros**, cada um
  com o código de parâmetros + Copiar. `getUtmCodes()` (`src/lib/actions/utm.ts`)
  gera e persiste um **separador único por usuário** (`User.xcodSeparator`, migration
  `20260724171328`) para o `xcod` da Hotmart; Cartpanda usa `cid={userId}`; todos os
  UTMs no formato `{{campaign.name}}|{{campaign.id}}`.
- **Parser reverso (`src/lib/utm/parse.ts`) — o coração:** `splitPipe` divide
  `"Nome|id"` no ÚLTIMO `|` (ignora placeholders `{{...}}` e ids não-numéricos),
  `parseUtms`/`parseXcod`/`parseTrackingCodes`. **`creatives.ts` e `overview.ts`**
  agora atribuem a venda ao anúncio/campanha pelo **id do Facebook** extraído do
  `utm_content`/`utm_campaign` (`fbAdId`/`fbCampaignId`), **somando** o fallback por
  nome (cliques antigos). Cada venda cai em só um mapa → sem dupla contagem.
- **Scripts (`src/lib/utm/scripts.ts`):** "Baixar traffik-utm.js" (script próprio,
  account embutido: lê UTMs+fbclid, cookie 30d, propaga p/ links de checkout, envia
  ao `/api/track/click`, expõe `window.traffik.getData()`); "Baixar
  traffik-back-redirect.js" (intercepta voltar → redireciona p/ URL da UI preservando
  UTMs). Download via Blob no cliente.

**Testado:** parser (unit: nome com `|`, placeholder, xcod inválido); atribuição por
id **ponta a ponta** (id casa mesmo com nome errado; soma fallback → sales=2/rev=400/
roas=4); scripts passam em `node --check`; UI no navegador (popup Hotmart com
separador `_dbca9cc2b39f_`, Cartpanda com `cid=<userId>`). Build + tsc limpos.

**Incompleto / TODO no Bloco 11:**
- A atribuição por **nome** ainda é ambígua se dois anúncios/campanhas tiverem o mesmo
  nome (limitação pré-existente; o id resolve para tráfego novo com os códigos novos).
- `useTraffikState` ainda expõe o **gerador de link/snippet antigo** (`utmUrl`,
  `snippetText`, etc.) — agora **código morto** (a `UtmView` que consumia foi
  removida). Limpar junto do resto do nav morto.
- O nível **conjunto (AdSet)** não recebeu atribuição por id (só campanha e anúncio);
  não foi pedido, mas o parser já extrai `adsetId` se precisar.

### Bloco 12 — Integrações › Pixel
Feito:
- **Schema:** nova tabela **`MetaPixel`** (`pixelId`, `accessToken`, `nickname`,
  FK `pixelConfigId` com `onDelete: Cascade`) — migration `20260724174646`. Um
  "Pixel" da Traffik (`PixelConfig`) agora dispara para **vários pixels da Meta**.
  `PixelConfig.pixelId`/`accessToken` viraram **opcionais** (legado da Fase 10;
  todo o código faz fallback para eles quando `metaPixels` está vazio).
- **`PixelView` autocontida** (mesmo padrão da `UtmsView` do Bloco 11): busca por
  server action, estado local, **sem `v`**. Popup "Adicionar Pixel" com nome, tipo
  (Meta, único), bloco "Pixels da Meta" (Adicionar → ID/Token/Apelido → Confirmar/
  Fechar, múltiplos), toggles de **Lead** e **Add To Cart**, **Initiate Checkout**
  com regra de detecção (contém texto / CSS / URL) e **Purchase** (envio: apenas
  aprovadas ou aprovadas+pendentes; valor: valor da venda ou comissão fixa; produto:
  lista vinda de `listTrackedProducts()` = `Sale.product` distinct). Lista com nome,
  nº de pixels Meta, status, toggle, **Ver script**, editar e remover.
- **Script próprio (`src/lib/pixel/script.ts`)**: gerador que embute `configId`,
  `apiBase` e as regras. Lê o `fbclid` (via `window.traffik.getData()` do script do
  Bloco 11, cookie `traffik_track` ou querystring), dispara **Lead** no `submit`,
  **AddToCart** em clique com cara de carrinho e **InitiateCheckout** conforme a
  regra escolhida; expõe `window.traffikPixel.track()`. Exibido em bloco de código
  com **Copiar** logo após salvar.
- **`POST /api/pixel/event`** (novo, **CORS liberado** — roda em site de terceiro):
  valida config + regra habilitada e repassa para a **CAPI de cada `MetaPixel`** com
  token. Purchase **não** passa aqui (é server-side, no webhook).
- **`capi.ts` generalizado:** `sendPurchaseEvent` virou wrapper de **`sendServerEvent`**
  (aceita `event_name` Purchase/Lead/AddToCart/InitiateCheckout; `value`/`currency`
  opcionais). `dispatchPixel.ts` e `/api/pixel/test` agora **iteram os `metaPixels`**.
- **Limpeza:** todo o CRUD de pixel saiu do `useTraffikState` (~113 linhas mortas da
  Fase 10); o hook só mantém `s.pixels` para o seletor da aba Testes.

**Testado ponta a ponta (dev server + DB + navegador):** criação do pixel pela UI
(1 pixel Meta + Lead + IC "contém texto: COMPRAR AGORA" + Purchase) → linhas corretas
em `PixelConfig`/`MetaPixel`/`PixelEventRule` (detection = `{"tipo":"contem_texto",
"valor":"COMPRAR AGORA"}`); `/api/pixel/event` → Lead e InitiateCheckout chegam na
**CAPI real do Facebook** (rejeitada só pelo token falso: *"Malformed access token"*),
AddToCart retorna `skipped: regra desabilitada`, evento inválido → 400, preflight
OPTIONS → 204 com `access-control-allow-origin: *`; **Purchase** disparado por venda
aprovada em `/api/webhook/ingest` também chega na CAPI; delete do `PixelConfig`
**cascateia** o `MetaPixel`. `tsc --noEmit` e `next build` limpos.

**Corrigido durante a verificação:**
- `pixel/page.tsx` ainda passava `v={useTraffik()}` para a `PixelView` (que virou
  autocontida) → **erro de tipo**; agora é `<PixelView />`.
- **Editar um pixel apagava os tokens da CAPI.** O token nunca volta ao cliente, então
  o form reenviava vazio e o `updatePixel` (que faz delete+recreate dos `MetaPixel`)
  gravava `null`. Renomear o pixel zerava o token. Agora `updatePixel` **preserva o
  token existente** casando por `pixelId` quando o form não traz um novo, e a UI
  mostra **"token salvo"** em vez de "sem token".

**Incompleto / TODO no Bloco 12:**
- **Só Meta.** O select de tipo existe mas tem uma opção só (o roteiro pediu assim).
- **AddToCart usa heurística fixa** (regex de "carrinho/comprar" no texto/classe) —
  o roteiro só pediu Ativado/Desativado, sem regra de detecção configurável.
- **`MetaPixel.accessToken` fica em texto puro** (mesmo trade-off do `ApiCredential`
  do Bloco 10) — é necessário para o envio server-side.
- **Sem dedup com o pixel do navegador para Lead/AddToCart/IC** — ver "Dívidas
  técnicas conhecidas" no fim do arquivo. **Aceito conscientemente pelo usuário.**
- ~~O `apiBase` do script é `window.location.origin`~~ → **resolvido**: agora vem de
  `NEXT_PUBLIC_APP_URL` (ver seção "URL pública nos scripts gerados"). Quem já gerou
  um script antes disso **precisa regerá-lo**.
- ~~`MetaPixel.accessToken` em texto puro~~ → **resolvido** (AES-256-GCM).
- ~~A aba Testes ainda usa `v.pixels`~~ → **resolvido** no Bloco 13.

### Bloco 13 — Integrações › Testes
Feito:
- **`TestesView` autocontida** (sem `v`), com 4 blocos, na ordem: Checklist → Teste de
  Pixel → Teste de Webhook → Teste de Tracking. Actions em `src/lib/actions/diagnostics.ts`.
- **Nova tabela `WebhookLog`** (migration `20260724200000`): `gateway`, `payloadRaw`
  (Json), `status` (enum `WebhookLogStatus`: RECEBIDO/PROCESSADO/REJEITADO/ERRO),
  `message`, `httpStatus`, `saleId`, `userId?`, `webhookId?`, `createdAt`.
- **Os 3 endpoints receptores** (`/api/webhook/kirvano`, `/api/webhook/ingest`,
  `/api/webhook/sale/[webhookId]`) foram reescritos para **ler o corpo ANTES das
  validações** e gravar o log já com status `RECEBIDO`, fechando depois com
  PROCESSADO/REJEITADO/ERRO. Assim os payloads **recusados** — os que mais importam
  para depurar — também aparecem. Um JSON quebrado é guardado como `{"raw": "..."}`
  em vez de se perder. Todo processamento ficou dentro de `try/catch` (antes uma
  exceção no `ingestSale` estourava 500 sem rastro).
- **`logWebhook.ts`** (`startWebhookLog`/`finishWebhookLog`) **nunca lança** — falha ao
  logar não pode derrubar a ingestão da venda.
- **Teste de Pixel:** select dos pixels que têm token, `test_event_code` opcional,
  chama `/api/pixel/test` e mostra a resposta **real** do Facebook (✓ ou ✗ com o erro).
- **Teste de Tracking:** aceita URL completa **ou só a querystring**; roda o
  `parseTrackingCodes` do Bloco 11, lista os 7 campos extraídos e resolve o **vínculo
  no banco** (campanha/anúncio), dizendo se casou **por id ou por nome** — e alertando
  que casar por nome é frágil. Notas acionáveis (ex.: "rode a sincronização").
- **Checklist:** perfil FB, conta de anúncio com `trackingEnabled`, webhook ativo,
  script de UTM (infere de `Click.count > 0`) e pixel com token da CAPI. Cada item
  falho tem botão "Resolver" que leva à aba certa.
- **Limpeza:** o CRUD do teste de pixel saiu do `useTraffikState`.

**Testado ponta a ponta (dev server + DB + navegador):** payloads válidos gravam
PROCESSADO+`saleId`, chave inválida → REJEITADO 401, JSON quebrado → REJEITADO 400 com
`{"raw":...}`, token Kirvano desconhecido → REJEITADO 404; a UI lista os logs por
gateway com timestamp e expande o corpo cru; Teste de Pixel devolveu o erro real do
Facebook (*"Malformed access token …"*, com o token **decriptado** — prova o round-trip
da cripto); Teste de Tracking extraiu os 6 ids/nomes + placement de uma URL do Bloco 11
e reportou corretamente "não vinculada" (nada sincronizado nesse usuário); checklist
saiu de 0/5 para 1/5 ao cadastrar um pixel. `tsc --noEmit` e `next build` limpos.

**Incompleto / TODO no Bloco 13:**
- **Logs sem dono não aparecem na UI.** Quando a chave de API é inválida ou o token
  Kirvano é desconhecido, não dá para saber de quem é o payload → `userId` fica nulo e
  a aba (que filtra por usuário) não o mostra. O registro **existe** no banco. Depurar
  "meu gateway manda e não chega" exige olhar a tabela direto.
- **Sem retenção/limpeza:** a `WebhookLog` cresce para sempre. Falta um cron de purga.
- **Sem paginação:** a UI busca os últimos 20 (limite máximo de 100 na action).
- **"Script de UTM detectado" é inferência**, não detecção: olha se existe algum
  `Click`. Um site com o script instalado mas sem tráfego aparece como ✗.
- O nível **AdSet** não é resolvido no Teste de Tracking (só campanha e anúncio),
  espelhando a limitação de atribuição do Bloco 11.

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

## ⚠️ Pendência crítica — DEPLOY NA VERCEL

**Diagnóstico refeito em 24/07/2026. A versão anterior deste documento estava errada:
afirmava "o GitHub está 100% atualizado / 10+ pushes". Não havia pushes.** São
**dois problemas independentes**:

### Problema 1 — os commits nunca subiram (RESOLVIDO)
`git rev-list --left-right --count origin/main...HEAD` dava **`0 8`**: o `origin/main`
estava parado em `76a747e` (24/07 00:49) e os **8 commits seguintes — Blocos 10, 11 e
12 — só existiam na máquina local**. A Vercel não estava deixando de fazer deploy:
não havia nada novo para ela buildar. Corrigido com `git push origin main`.

### Problema 2 — CRON DE 15 MIN NO PLANO HOBBY (CAUSA RAIZ, RESOLVIDO)

**O `vercel.json` declarava 3 crons, dois deles `*/15 * * * *`. O plano Hobby só
aceita cron DIÁRIO — e isso não degrada, faz o DEPLOY INTEIRO FALHAR na validação:**

> *Hobby accounts are limited to daily cron jobs. This cron expression (\*/15 \* \* \* \*)
> would run more than once per day.*

É a explicação completa do sintoma: desde o commit que introduziu os crons (Fase 7),
**todo deploy falhava**, e a produção ficou congelada no último build bem-sucedido —
exatamente o "build pré-Fase-7" observado. Não era integração desconectada; era o
`vercel.json` sendo rejeitado. Sondagem que confirmava o congelamento:

| Rota | Status | Leitura |
|------|--------|---------|
| `/login` | 200 | o app está no ar |
| `/api/track/click` | 405 | rota **existe** — build antigo, v1 |
| `/dashboard/integracoes/anuncios` | **404** | Bloco 1 no GitHub desde `2138e4b`, mas nunca buildado |

**Solução adotada (sem custo):** os crons saíram do `vercel.json` (que agora só declara
o framework) e o agendamento foi para o **GitHub Actions** —
`.github/workflows/cron.yml`. As rotas `/api/cron/*` **não mudaram**: continuam
protegidas por `CRON_SECRET` e recebendo `Authorization: Bearer`. O workflow tem dois
schedules (`*/15` para sync + regras, `0 * * * *` para relatórios), `workflow_dispatch`
para disparo manual e um `concurrency` group para não sobrepor execuções.

**Configurar no GitHub** → Settings › Secrets and variables › Actions:
- **Secret** `CRON_SECRET` — mesmo valor da env var na Vercel
- **Variable** `APP_URL` — `https://342dd-virid.vercel.app` (sem barra no fim)

> ⚠️ **`CRON_SECRET` é obrigatória em produção — a rota FALHA FECHADA sem ela.**
> `src/lib/cronAuth.ts` recusa (401) quando a env var está ausente ou vazia:
> ausência de configuração nunca vira permissão. Sem o secret o cron para de
> rodar, o que é um problema **visível**; uma rota que pausa campanha e altera
> orçamento aberta na internet não seria.

**Limitações do GitHub Actions** (aceitas conscientemente): o agendamento é
*best-effort* e costuma atrasar 5–20 min em horário de pico; workflows agendados são
**desativados automaticamente após 60 dias sem commits** no repositório. Se isso
incomodar, as alternativas são cron-job.org / Upstash QStash (grátis, mais pontuais)
ou o Vercel Pro (~US$20/mês, que devolve o cron nativo).

**Passos restantes para o usuário:**
1. Vercel → **Settings › Environment Variables** (Production): `DATABASE_URL`,
   `AUTH_SECRET`, `AUTH_URL`, `NEXT_PUBLIC_APP_URL` (**domínio real**),
   `ENCRYPTION_KEY`, `CRON_SECRET`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`,
   `FACEBOOK_REDIRECT_URI`.
   ⚠️ **A `ENCRYPTION_KEY` tem de ser a MESMA do `.env` local** — o banco é o mesmo
   Supabase, e chave diferente torna ilegíveis os segredos já gravados.
   `DIRECT_URL` e `REDIS_URL` **não** são necessárias.
2. Registrar `https://342dd-virid.vercel.app/api/auth/facebook/callback` nos "URIs de
   redirecionamento do OAuth válidos" do app do Facebook.
3. Configurar `CRON_SECRET` + `APP_URL` no GitHub (acima) e rodar o workflow uma vez
   pelo `workflow_dispatch` para validar.
4. **Regerar os scripts** de pixel e UTM na UI — a URL da API fica embutida no arquivo.

> Se apagar e recriar o projeto na Vercel: o domínio `*.vercel.app` deriva do **nome do
> projeto**. Para manter `342dd-virid.vercel.app`, recriar com o mesmo nome ou fixar o
> domínio em Settings › Domains.

**Verificado daqui:** `npm run build` passa limpo, `package.json` roda `prisma generate`
no `build` e no `postinstall`, nenhuma rota precisa de banco em build (todas `ƒ`
dinâmicas), e as 3 rotas de cron respondem **200 com o Bearer certo e 401 sem ele**.

> As **migrations não rodam na Vercel**. Depois de subir código com schema novo, rode
> `npx prisma migrate deploy` localmente (usa `DIRECT_URL`). As 6 migrations atuais já
> estão aplicadas no Supabase.

## Banco de dados
Supabase (ref `dgaoucxkmpdxeenpfqth`, us-east-1). Usuários: `teste@traffik.io`
(tem 1 webhook Custom de teste) e `pedrodurso8@gmail.com` (dono, 1 perfil FB + 6
contas reais, 0 campanhas sincronizadas). O Prisma Postgres temporário antigo foi
abandonado (auto-expira).

> **Sessões auto-curam (commit `a08d0e9`):** o callback `session` em `src/auth.ts`
> re-resolve o `userId` pelo e-mail a cada sessão. Antes, um JWT emitido pelo banco
> antigo carregava um `userId` inexistente no Supabase → **FK error** em qualquer
> insert (webhook, credencial, etc.) e "não acontecia nada" na UI. Agora não exige
> mais relogin. Se um dia trocar de banco de novo, isso continua cobrindo.

---

### Bloco 5 — Gráficos do Dashboard

Feito (os 6 itens do roteiro):
1. **Faturamento vs. gasto** → `ui/AreaChart.tsx`: eixo Y com escala arredondada
   (1/2/2.5/5 × 10ⁿ), eixo X ralo conforme a quantidade de pontos, grade, duas áreas
   sobrepostas, legenda e **tooltip seguindo o mouse**.
2. **Funil** → `ui/Funnel.tsx`: trapézios empilhados de verdade (o topo de cada um é a
   base do anterior), 5 etapas, taxa de conversão vs. etapa anterior e transição animada.
3. **Vendas por país** → `ui/CountryMap.tsx`, com toggle **Ranking | Mapa**, pontos
   luminosos proporcionais, pan/zoom e tooltip.
4. **Produto e Fonte** → `ui/Donut.tsx` com legenda lateral (valor + %) e destaque no hover.
5. **Método de pagamento** → mesmo Donut.
6. **Taxa de aprovação** → barras por método com `pagas/geradas`.

**Dois gaps de dados que o bloco precisou fechar:**
- **Eventos de pixel não eram persistidos** — o `/api/pixel/event` só repassava à CAPI e
  descartava. Sem isso o estágio "Initiate Checkout" do funil não tinha fonte. Nova
  tabela **`PixelEvent`** (migration `20260724220000`); a gravação é best-effort e nunca
  bloqueia o envio à CAPI.
- **`Sale.country` existia mas nunca era agregado.** Agora `byCountry` usa o país da
  venda e cai no país do clique quando o gateway não manda.

> **Mapa: contornos reais, zero dependência.** `react-simple-maps` está descartado —
> só suporta **até React 18** (aqui é 19). Em vez disso, `scripts/gen-world-paths.mjs`
> converte o `world-atlas` em paths SVG equirretangulares **uma vez, em build**, e o
> resultado (`src/lib/worldPaths.ts`, ~53 KB) é commitado. O navegador não baixa
> TopoJSON, não há CDN em runtime, e `world-atlas`/`topojson-client` **não ficam no
> package.json**. Para regerar, o cabeçalho do script tem as 3 linhas de comando.

**Bug pré-existente corrigido:** o `buildChart` gerava `round((end-start)/dia)` buckets
a partir de `start`, então em "últimos 7 dias" o último bucket parava **ontem** —
as vendas de hoje caíam fora de todos os buckets e o gráfico ficava achatado em zero
(com o eixo Y indo até R$ 1). Agora são `days + 1` buckets. Verificado: a soma da série
do gráfico passou a bater exatamente com o KPI de faturamento.

**Decisão no funil:** a base do trapézio é o **maior** estágio, não o primeiro. Com o
Facebook ainda não sincronizado, "cliques no anúncio" é 0 e o funil ficaria invisível
mesmo havendo checkouts e vendas.

**Testado com dados semeados** (7 vendas em 4 países, 3 métodos, misturando aprovadas e
pendentes + 9 eventos de IC): taxa de aprovação saiu **Pix 4/5 = 80%, Cartão 1/3 = 33,3%,
Boleto 1/1 = 100%**; países BR/PT/AR com os valores certos; funil com os 5 estágios;
donuts com percentuais somando 100%. Dados de teste removidos depois.

### Coluna GASTO no Gerenciador (29/07/2026)

A tabela pulava de **Orçamento** direto para **Vendas** — o gasto já alimentava
CPA, CPM, CPC, ROAS, ROI e Lucro, mas só aparecia dentro do tooltip de fórmula.
Agora é coluna própria, entre as duas, nos 4 níveis (Contas, Campanhas,
Conjuntos, Anúncios). A ordem é a da leitura natural: **quanto posso gastar →
quanto gastei → quanto vendi**.

Não precisou de nada no backend: `spend` já estava em `LinhaBase` e em
`somar()`, que é o mesmo agregador de onde saem o ROAS e o Lucro — então a
coluna, a linha de Total e as métricas derivadas **não podem divergir por
construção**. Marcada como fonte **Meta** (ponto azul), igual a CPM e CPC.

> ⚠️ **A linha de Total mostra "—" em Orçamento, e isso é proposital.** Somar
> tetos diários de campanhas diferentes produz um número que não significa nada.
> O Total do Gasto, esse sim, é a soma real do período.

**Verificado por SQL de leitura** contra o banco real (`pedrodurso8`, últimos 7
dias): `CA 1 MARIA` R$ 103,41 + `CA 2 MARIA` R$ 0,00 = **R$ 103,41**, que é o
valor que a linha Total do Gerenciador tem de exibir no período de 7 dias.

### Gerenciador ao vivo, orçamento inline e poda (pós-Blocos 6/7)

- **Orçamento editável inline**, com caneta, na coluna à esquerda de "Vendas". A caneta
  só aparece **no nível que a Meta aceita**: campanha CBO edita na campanha, ABO edita
  no conjunto. A detecção reusa a mesma regra do modal (`dailyBudget != null` na
  campanha). No nível errado a célula mostra o valor sem caneta, em vez de oferecer uma
  edição que seria recusada.
- **Polling do gerenciador** a cada 8s (`ADS_POLL_MS`), pausando em aba escondida como o
  do Dashboard. Campanha nova, métrica nova e mudança de status entram sozinhas; o botão
  "Sincronizar métricas" vira atalho, não obrigação.
- **Botão "Atualizar" no Dashboard** (`refreshDashboard`), com ícone girando enquanto
  busca — recarrega os dados sem recarregar a página.
- **Duplicar campanha** agora pergunta se a cópia nasce **Ativada ou Desativada**
  (padrão desativada) e repassa `status_option` para o `/copies` da Meta.
- **Botão "Editar" duplicado** no card de webhook: eu tinha deixado um em botão e outro
  dentro do `OptionsMenu`. Ficou só o de botão + "Remover"; o `OptionsMenu` foi removido.
  Auditoria não encontrou duplicata em nenhum outro card.

> ### 🐛 Exclusão não propagava — corrigido
> O sync só fazia `upsert` do que a Graph API devolvia e **nunca removia o que deixou de
> vir**. Campanha excluída no Facebook continuava na ferramenta para sempre. Agora, ao
> fim de cada conta, `podar()` apaga o que não veio na resposta (anúncios → conjuntos →
> campanhas, nessa ordem, por causa das FKs).
>
> **Por que é seguro:** a poda roda **por conta** e só depois de a Graph responder — o
> `graphAll` lança em falha, então chegar ali significa resposta confiável. Se a resposta
> viesse vazia por erro de rede, apagaríamos tudo daquela conta; é justamente por isso
> que a poda depende de a chamada ter tido sucesso, e não de um `try/catch` silencioso.
>
> A exclusão feita **pela própria ferramenta** também passou a apagar o registro local
> (`removerLocal`) em vez de só marcar `DELETED` e deixar a linha na tela.
>
> Testado no banco: campanha ausente da resposta é removida; **lista vazia apaga tudo
> daquela conta** (caso de borda de conta sem campanhas); a poda não vaza para outras
> contas; e os conjuntos das campanhas removidas somem por cascade.

### Blocos 6 e 7 — Gerenciador de Anúncios

**Bloco 6.** As abas viraram **cards lado a lado** (`.ads-abas`) com ícone, contagem e
indicador de aba ativa. A tabela (`views/ads/AdsTable.tsx`) tem as 14 colunas pedidas,
rolagem horizontal e **as 3 primeiras colunas presas** (checkbox, status, nome) via
`position:sticky` com `left` acumulado — a `.fixa-3` ainda projeta uma sombra para
marcar onde termina a área fixa. Cabeçalho e rodapé de totais também são sticky.
O controle de pausar/ativar é o **toggle deslizante** (`.sw`), não play/pause, e chama
`/api/ads/status` (Marketing API real). Checkbox por linha + "selecionar todas".

As métricas derivadas ficam em **`lib/ads/metrics.ts`** (ROAS, ROI, CPA, lucro, CPC,
CTR, CPM) — fora da view porque as mesmas fórmulas valem para os 4 níveis, e porque
divisão por zero é a fonte clássica de `NaN` na tela: o helper `div` devolve `null` e a
célula mostra "—".

**Bloco 7.** `views/ads/AdsActionBar.tsx` + `POST /api/ads/bulk`. Menu de ações em massa
(duplicar, ativar, desativar, alterar orçamento, alterar bid cap, fixar, copiar ID,
excluir), ordenação por gasto, "Abrir no Facebook" e "Sincronizar métricas".
**Toda ação que muda algo no Facebook exige confirmação**, e a de excluir avisa que a
Meta não oferece desfazer.

> **Detecção CBO/ABO** — não precisou de campo novo: **campanha com `dailyBudget`
> próprio é CBO**; sem ele é ABO e o orçamento vive nos conjuntos. Ao alterar orçamento
> de uma campanha ABO, o modal **bloqueia o Confirmar** e manda o usuário para a aba
> Conjuntos, em vez de deixar a Meta recusar a chamada.

Novos campos sincronizados: `Campaign.bidStrategy` e `AdSet.bidAmount` (bid cap),
migration `20260725150000`.

**Testado no navegador** com 1 conta, 2 campanhas (1 CBO / 1 ABO), 2 conjuntos e 2
anúncios semeados: as 4 abas mostram as contagens certas; a tabela renderiza as 14
colunas com métricas derivadas reais (CPC R$ 0,55 · CTR 3,1% · CPM R$ 16,74 ·
12.900 impressões) e linha de totais; o toggle reflete o status; o menu de ações lista
as 7 opções válidas para campanha; e ao pedir "Alterar orçamento" numa campanha ABO o
modal avisou e **desabilitou o Confirmar**. Dados de demonstração removidos depois.

**Incompleto / TODO nos Blocos 6 e 7:**
- **IC e CPI ficam "—".** Os `PixelEvent` não têm atribuição a campanha/anúncio — o
  script de pixel não envia os UTMs junto do evento. Para preencher essas colunas é
  preciso carimbar o evento com os códigos do Bloco 11 na hora do disparo.
- **O lucro da tabela é bruto** (faturamento − gasto). Taxas, impostos e despesas só
  existem no nível da conta e não há como ratear com honestidade por campanha; o
  Dashboard, que é no nível da conta, usa o lucro líquido.
- **"Fixar" é só de sessão** — não persiste ao recarregar.
- **Duplicar** depende do sync seguinte para a cópia aparecer na lista.
- **Nenhuma ação de escrita foi exercida NESTA SESSÃO** (a conta de teste não tem
  token). ✅ **Corrigido em 31/07/2026:** o usuário confirmou que **pausou campanha
  e alterou orçamento pela ferramenta, em produção, e os dois funcionaram no
  Facebook.** Ver "Escrita na Graph API: o que já foi exercido".
- O **botão "Sincronizar métricas" continua existindo**; a sincronização oportunista
  (disparar sozinho quando o dado está velho) ficou para depois.

---

## 🔴 Perda de dados em webhooks concorrentes (corrigido)

**Sintoma relatado:** o gateway envia a venda, o evento chega (aparece até nas
notificações), mas o dashboard não reflete; com vários pagamentos em sequência rápida,
"processa só 1 ou nenhum".

**A causa NÃO era perda de linha nem falta de fila.** Um teste com 5 webhooks
simultâneos de `externalId` distintos gravou 5/5. O que se perdia era o **status**:

```
race-1  → evento "approved" respondeu 200 dizendo APROVADA
race-1  → linha no banco ficou PENDENTE
```

`prisma.sale.upsert` é **last-write-wins**. Com "gerada" e "paga" do mesmo
`externalId` chegando em paralelo (o gateway não garante ordem, e ainda reentrega),
a "gerada" que terminasse por último **rebaixava a venda de APROVADA para PENDENTE**.
A venda sumia do faturamento mesmo tendo respondido 200 e gerado notificação — daí a
impressão de "chegou mas não apareceu".

**Correção (`ingestSale.ts`):** o upsert virou **monotônico e independente de ordem**:
1. `createMany({ skipDuplicates: true })` garante a linha sem estourar P2002 quando
   duas requisições criam ao mesmo tempo.
2. `updateMany` com `where: { status: { in: podeSobrescrever(novo) } }` — o `WHERE`
   só deixa passar quando o status novo é **igual ou mais forte** que o gravado
   (PENDENTE 0 < APROVADA 1 < REEMBOLSADA/CHARGEBACK/CANCELADA 2). Quem decide é o
   banco, então writes concorrentes **convergem** para o mesmo resultado.

**Também:** `dispatchPurchaseEvents` (HTTP para a CAPI do Facebook) e a notificação
eram **aguardados dentro do request**, segurando conexão do pool e alongando a janela
de disputa. Passaram para o `after()` do Next 16 — o gateway recebe o 200 assim que a
venda está gravada. O polling do dashboard caiu de 15s para 5s.

**Teste (`node` contra o dev server, 6 casos, todos passando):**
| Caso | Resultado |
|---|---|
| 5 vendas simultâneas | 5/5 persistidas, todas APROVADA, 1812ms |
| gerada+paga concorrentes, **nas duas ordens** | ambas convergem para APROVADA |
| reembolso + reentrega de eventos anteriores | permanece REEMBOLSADA |
| rajada de 15 vendas | 15/15 persistidas |
| 6 reentregas do mesmo evento | 1 única linha (idempotente) |

> **Sobre a fila BullMQ:** não foi usada, de propósito. Ela está no `package.json` mas
> exige Redis + um worker de processo longo, que **não existe em serverless** (foi
> justamente por isso que a v1 trocou BullMQ por Vercel Cron). O enfileiramento que
> importava — "gravar o payload antes de processar" — já existe desde o Bloco 13 via
> `WebhookLog`, e a idempotência agora é garantida pelo banco, que é mais robusto que
> serializar numa fila.

## ⚠️ Gasto das campanhas vindo zerado (corrigido)

O sync usava `date_preset: last_7d/last_30d` nos insights. Os presets da Meta são
ancorados no fuso da conta e **não trazem o dia corrente de forma confiável** — um
gasto feito hoje aparecia como R$ 0,00. Trocado por `time_range` explícito
(`since`/`until` até hoje) + `action_report_time: "impression"`.

> **Não confirmado contra a API real:** a conta de teste não tem token do Facebook
> válido nesta sessão. A correção é a explicação mais provável (havia 1 campanha, 1
> anúncio e 1 linha de métrica gravados, com `spend = 0`), mas **precisa ser validada
> com uma sincronização real**. Note também que **só 1 das contas de anúncio está com
> `trackingEnabled = true`** — se o gasto foi em outra, é preciso ligar o rastreamento
> dela na aba Anúncios.

## 🕐 Fuso horário — causa raiz do bug de dia/hora (28/07/2026)

**Causa raiz: o código agregava por dia e hora usando o fuso do PROCESSO Node,
não o do usuário.** `getHours()`, `setHours(0,0,0,0)`, `getFullYear/getMonth/
getDate` e `toDateString()` respondem no `TZ` do processo. Em desenvolvimento
(Windows, Brasil) esse fuso é `America/Sao_Paulo` e tudo parecia certo — **na
Vercel o processo roda em UTC**, e os 3 primeiros sintomas caem todos daí:

| Sintoma relatado | Mecanismo |
|---|---|
| Dados do dia 25 no 24 e vice-versa | "Hoje" começava à meia-noite **UTC** = 21h do dia anterior em Brasília. As vendas das 21h–24h caíam no dia seguinte. |
| O ciclo de 24h encerrava cedo | Mesma coisa vista de outro ângulo: o dia virava às 21h, 3h antes. |
| Venda das 17h marcada entre 20h e 21h | `new Date(s.timestamp).getHours()` devolvia a hora **UTC** — 17h BRT = 20h UTC. O deslocamento de +3 é a assinatura do bug. |

O 4º sintoma é independente e trivial: `elapsed()` parava nos minutos
(`return Math.round(sec/60) + "min atrás"`), daí o "842min atrás".

**Solução central: `src/lib/timezone.ts`.** Regra do projeto daqui em diante —
**nenhum código de agregação chama método local de `Date`**. Tudo passa por ali.

- **Fuso por usuário:** coluna `User.timezone` (migration `20260728120000`),
  padrão `America/Sao_Paulo`, editável na aba **Taxas e Despesas** (card "Fuso
  horário", que mostra a hora atual no fuso escolhido para conferência).
  `NotificationSettings.timezone` **existe desde a migration inicial e nunca foi
  lida por código nenhum**. Continua lá, sem uso — ver o aviso abaixo.

> ### 🔴 Não remova coluna de um banco COMPARTILHADO com a produção
> A migration `20260728120000` chegou a **dropar** a `NotificationSettings.timezone`
> por ser código morto. Estava tecnicamente certo e operacionalmente errado: o
> Supabase é o **mesmo banco** do dev e da produção, e a produção roda um build
> antigo cujo cliente Prisma ainda seleciona aquela coluna. No instante em que
> ela sumiu, **todo carregamento do dashboard passou a dar 500** — o
> `getNotificationSettings()` roda no layout de `/dashboard`. Restaurada pela
> `20260728130000`.
>
> Remover coluna aqui só é seguro **depois** que todos os ambientes estiverem
> rodando o código que deixou de usá-la — ou seja, em dois deploys, nunca em um.
- **A leitura fica em `src/lib/userTimezone.ts`, NÃO em `actions/profile.ts`.**
  Aquele módulo é `"use server"` (todo export vira endpoint de server action) e
  importa o `@/auth` — arrastaria o NextAuth para dentro de `metrics.ts`,
  `sync.ts` e do motor de regras, que rodam em **cron, sem request nenhum**.
- **Chave de dia (`"2026-07-25"`) é STRING de propósito.** Comparar strings
  elimina a classe inteira de bugs de "instante que representa um dia".
- **`zonedToUtc` faz duas passadas** por causa do horário de verão: o offset é
  estimado no instante chutado e pode não ser o do instante resultante na
  virada. O Brasil não tem mais DST, mas Nova York e Lisboa têm (testado: o dia
  da virada em NY dura 23h).

> ### ⚠️ `DailyAdMetric.date` é `@db.Date` — compare por CHAVE, nunca por instante
> É um dia de **calendário**, gravado como meia-noite UTC (a Meta manda
> `"2026-07-25"` e o Prisma trunca a hora). A meia-noite UTC do dia 25 é
> **anterior** à meia-noite de Brasília do dia 25, então comparar com
> `m.date.getTime() >= bucket.start` joga a linha no bucket do dia anterior.
> Use `dateColumnKey()` para ler e `keyToDateColumn()` para o `where`.

**Onde foi corrigido:** `dashboard/metrics.ts` (janela, `byHour`, `byDay`,
buckets do gráfico, consulta de métrica), `ads/overview.ts`, `ads/creatives.ts`,
`rules/engine.ts` (inclusive o **limite diário de execuções**, que reiniciava às
21h e dava execuções extras a uma regra que pausa campanha de verdade),
`facebook/sync.ts` (o `time_range` da Meta andava um dia), `api/cron/reports`
(a hora do relatório agora é a de **cada** usuário) e `dateRange.ts` +
`DateRangePicker` (o "hoje" do calendário era o do **navegador**).

**Três bugs achados de quebra, no mesmo caminho:**
1. **Período custom de um dia só vinha vazio.** `new Date("2026-07-25")` é
   meia-noite UTC, então `from === to` dava uma janela de **duração zero**. Hoje
   o `to` vai até 23:59:59.999 do fuso do usuário.
2. **A janela de comparação dos deltas era torta.** Era `start - (end - start)`;
   em "Hoje" isso comparava contra um pedaço de ontem+anteontem. Agora "Hoje"
   compara contra **ontem até o mesmo horário**, e as janelas de N dias contra
   os N dias de calendário imediatamente anteriores.
3. **`"Últimos 7 dias"` não eram 7 dias.** Era `now - 7×86400000`, que cai no
   meio de um dia e gerava um bucket parcial a mais — a origem do `+ 1` que o
   `buildChart` precisava ter. Agora são 7 dias de calendário terminando hoje.

> ⚠️ **Gasto é métrica DIÁRIA — não existe gasto por hora.** Na série horária o
> total do dia é lançado no bucket das 00h, para o gráfico continuar somando o
> mesmo que o KPI em vez de zerar a linha. Comportamento igual ao anterior, só
> que agora explícito.

**Testado:** 37 asserções puras com `TZ=UTC` (reproduzindo a Vercel), incluindo
os 3 sintomas exatos, a virada de DST em Nova York, viradas de mês/ano/bissexto
e os 13 degraus do `elapsed`. Mais 17 asserções **ponta a ponta contra o
Supabase**: vendas semeadas às 09h e 17h BRT de hoje e às 22h30 BRT de ontem
caíram na hora e no dia certos, e o total de "hoje" excluiu a de ontem.
A prova final é o teste que **troca o fuso do usuário para `UTC` e reproduz o
bug antigo** (17h vira 20h, a venda de ontem vaza para hoje) — é o que mostra
que o fuso realmente comanda a agregação agora. `tsc --noEmit` e `next build`
limpos; dados de teste removidos.

## 📐 Precisão das métricas e coerência do funil (28/07/2026)

### ⚠️ ROI travado em −1,00x NÃO é bug — é o piso matemático

Não existe clamp no código. A conta é `roi = (faturamento − custo) / custo`, que
é o mesmo que `faturamento/custo − 1`. **Com faturamento 0 o resultado é −1 para
qualquer custo**, porque não dá para perder mais do que 100% do que se investiu.
Um ROI "cada vez mais negativo" exigiria faturamento NEGATIVO, e reembolso aqui
muda o status da venda (sai do faturamento) em vez de subtrair.

Quem varia com o tamanho do prejuízo é o **Lucro, em reais** — já é um card.
Se o ROI está −1,00x em tudo, a pergunta certa é *"por que o faturamento é 0?"*,
e a resposta costuma ser atribuição: sem os UTMs do Bloco 11 casando, a venda não
cola na campanha e o Gerenciador mostra faturamento 0 por linha.

**O que era bug de verdade e foi corrigido:** `totalCost === 0` devolvia `0`, e a
tela mostrava "0,00x" — que se lê como empate — para uma conta que faturou sem
gastar nada. Agora é `null` → "—". `DashboardData.kpis.roi` virou `number | null`.

### Arredondamento: 2 casas em tudo

`roasFmt` tinha **1 casa** e `multFmt` **2**, então o mesmo número aparecia
diferente conforme o card (ROAS 3,73 → "3,7x"; ROI 3,73 → "3,73x"). `toFixed`
arredonda para a casa pedida (3,75 → "3,8" com 1 casa) — era daí que vinha a
sensação de "número fechado". Hoje **`roasFmt` é alias de `multFmt`** e `pct`
passou de 1 para 2 casas (CTR, margem). CPA/CPC/CPM usam `brl`, que já tinha 2.

### Funil: de onde vem cada etapa

As 5 etapas **não saem da mesma fonte**, e é isso que explica uma passar de 100%
da anterior:

| Etapa | Fonte |
|---|---|
| Cliques no anúncio | Meta Ads (`DailyAdMetric`) |
| Visita na página | Nosso script (`Click`) — 1 por sessão |
| Initiate Checkout | `PixelEvent` + webhook — **visitantes distintos** |
| Vendas iniciadas | Gateway (`Sale`, todos os status) |
| Vendas aprovadas | Gateway (`Sale`, status APROVADA) |

Só **aprovadas ⊆ iniciadas** é garantido por construção. As demais podem cruzar
legitimamente: tráfego orgânico gera visita sem clique no anúncio, e o Meta
subnotifica cliques.

**Dois bugs de contagem corrigidos:**
1. **IC contava EVENTOS, não visitantes.** O `px.js` dispara um IC a cada clique
   no link de checkout, então quem clicava duas vezes contava duas. Medido no
   banco: **31 eventos para 25 visitantes**. Agora deduplica por
   `fbclid → eventId → id da linha`.
2. **Etapa anterior zerada mostrava "0,0%"** em vez de "—". Com o Facebook não
   sincronizado ("cliques" = 0), "Visitas" exibia 0,0% tendo 220 visitas.
   Conversão sobre zero é **indefinida**, não zero.

> ⚠️ **Passar de 100% não é escondido nem clampado.** A etapa aparece em âmbar
> com "⚠" e o tooltip diz de qual fonte cada número veio. Clampar em 100%
> esconderia justamente o sinal de que as fontes não estão casando — que é
> informação de diagnóstico, não ruído. O tooltip mostra as duas taxas (vs.
> etapa anterior e vs. topo).

### IC e CPI no Gerenciador — agora preenchidos

O `PixelEvent` não guarda campanha, mas guarda **`fbclid`** — e é por ele que se
chega ao `Click`, que tem os UTMs. `overview.ts` faz o mesmo caminho de
atribuição das vendas: `fbclid → Click.utmCampaign/utmContent → splitPipe` (id do
Facebook, com fallback por nome). **Não precisou de migration.**

- **Campanha:** por `utm_campaign`; se nada casar, cai na soma dos anúncios.
- **Anúncio:** por `utm_content`. **Conjunto:** soma dos anúncios (não tem UTM próprio).
- **CPI** = gasto ÷ IC, em `ads/metrics.ts`, `null` quando IC é 0.

> ⚠️ **IC só é atribuído quando o evento tem `fbclid`.** Visitante que chegou sem
> `fbclid` (orgânico, ou o script de UTM não instalado) entra no funil do
> Dashboard mas **não** na coluna IC do Gerenciador — lá o total pode ser menor.

**Testado:** 11 asserções de formatação/ROI e 6 ponta a ponta com conta semeada
(3 eventos de IC de 2 visitantes → IC = 2 em campanha/conjunto/anúncio, CPI
120÷2 = 60, ROI −1,00x sem faturamento). No funil real do dono: IC 31→25 e as
taxas saíram 11,36% → 56,00% → 14,29%, nenhuma acima de 100%. Dados de teste
removidos.

### Filtro do Dashboard abre em HOJE

`dashPeriod` inicial era `"7d"`. O período **não é persistido de propósito** — é
filtro de sessão, não preferência —, então mudar o padrão bastou.

## 🔄 Sincronização automática do Facebook (28/07/2026)

**O polling da UI sempre existiu** (5s no Dashboard, 8s no Gerenciador) — mas ele
lê o NOSSO banco. Quem trazia dado novo do Facebook era o `syncUser`, e ele só
rodava no botão "Sincronizar métricas" e no cron do GitHub Actions a cada 15 min
— que é *best-effort*, atrasa 5–20 min em pico e **é desativado sozinho após 60
dias sem commits**. Daí a impressão de que era preciso clicar e recarregar.

Agora **toda requisição do painel dispara a sincronização quando o dado está
velho** (`src/lib/facebook/autoSync.ts`), via `after()` do Next 16 — a resposta
sai primeiro, a Graph API é chamada depois. Ciclo: polling → dado velho →
sincroniza → o polling seguinte já mostra o número novo. O botão manual continua
existindo para forçar.

### Dois ritmos, porque as chamadas não custam a mesma coisa

O ciclo COMPLETO lê campanhas + conjuntos + anúncios + insights: **4 chamadas por
conta**. As métricas sozinhas são **1** (`syncAccountMetrics`, que tira o mapa
`fbAdId → id` do banco em vez da Graph). Estrutura muda raramente — criar
campanha é ato humano; o gasto muda o tempo todo.

| Ciclo | Intervalo | Custo (5 contas) | O que traz |
|---|---|---|---|
| Métricas | **20s** | 5 chamadas | gasto, impressões, cliques, CTR/CPC/CPM |
| Completo | **3 min** | ~20 + 1 por perfil | campanhas/conjuntos/anúncios novos, **contas novas da BM** |

Carga média ~15 chamadas/min — parecida com a do ciclo único de 90s que existia
antes, mas com o gasto **4,5× mais fresco**.

> ⚠️ **`lastSyncedAt` NÃO avança no ciclo de métricas.** São dois relógios
> (`lastSyncedAt` = estrutura, `lastMetricsAt` = gasto): marcar o barato como
> completo adiaria indefinidamente a descoberta de contas novas. A UI mostra a
> idade das MÉTRICAS, que é o número que o usuário fica olhando subir.
>
> ⚠️ **Anúncio criado depois do último ciclo completo não recebe métrica ainda** —
> entra no ciclo seguinte (≤3 min). É o trade-off do mapa vir do banco.

| Constante | Valor | Por quê |
|---|---|---|
| `METRICAS_MS` | 20s | Teto de defasagem do gasto |
| `COMPLETO_MS` | 3 min | Estrutura + contas novas da BM |
| `DIAS_AUTO` | 2 | Auto-sync só precisa de hoje + ontem; os 30 dias ficam no cron e no botão |
| `LOCK_EXPIRA_MS` | 10 min | Libera reserva órfã de instância que morreu no meio |
| `PROFILES_POLL_MS` | 30s | Vitrine de Integrações › Anúncios |

> ### ⛔ Por que NÃO dá para ser instantâneo
> **A Meta não empurra gasto para nós.** Não existe webhook de insights na
> Marketing API — o dado só chega se formos buscar. E os próprios números da Meta
> têm atraso de consolidação de alguns minutos: o gasto de agora não está pronto
> nem do lado deles. Baixar o intervalo além disto queima rate limit sem trazer
> número mais novo. WebSocket/SSE também não ajudaria: eles acelerariam o trecho
> banco → tela, que já leva 5–8s, e não o trecho Meta → banco, que é o gargalo.

> ### 🔒 A trava é do BANCO, não do processo
> Em serverless não há estado compartilhado entre instâncias, e o polling bate a
> cada poucos segundos — de várias abas e às vezes vários dispositivos. Uma trava
> em memória deixaria N sincronizações concorrentes batendo na Graph API e
> estourando rate limit.
>
> A reserva é um **`updateMany` condicional**: o `WHERE` só passa se o lock ainda
> estiver livre. Quem atualiza a linha ganhou a vez; quem recebe `count: 0`
> desiste em silêncio. É o mesmo padrão do upsert monotônico de vendas — quem
> decide o vencedor é o banco. **Testado com 5 reservas concorrentes: 1 vencedor.**
>
> `lastSyncedAt` só avança quando a sincronização **conclui com sucesso**;
> `syncLockedAt` marca a tentativa. Separar os dois é o que impede a UI de dizer
> "atualizado agora" depois de uma sincronização que falhou.

### Contas novas na BM aparecem sozinhas

`syncUser` só iterava as `AdAccount` **já existentes**, e a única coisa que
chamava `/me/adaccounts` era o callback do OAuth. Uma conta criada na BM depois
da conexão nunca aparecia — a saída era desconectar e reconectar o perfil.

`descobrirContas()` roda no início de toda sincronização e reconsulta
`/me/adaccounts` por perfil. O upsert também corrige **nome, moeda e status** de
contas existentes, então renomear na BM passa a refletir aqui.

> ⚠️ **Conta que some da resposta NÃO é apagada.** Perda de permissão costuma ser
> temporária, e apagar levaria junto o histórico de métricas por cascade. Isso é
> deliberadamente diferente da `podar()` de campanhas/anúncios, que só roda
> depois de uma resposta bem-sucedida daquela conta específica.
>
> ⚠️ Token de UM perfil expirado **não derruba os outros**: a descoberta é por
> perfil, dentro de `try/catch`, e o erro entra em `summary.errors`.

**Testado contra a Graph API real** (token do dono, 5 contas na BM): um usuário
descartável sem conta nenhuma descobriu as 5 sozinho, todas rastreando e ligadas
ao perfil; a 2ª passada não duplicou nem contou como nova (idempotente); e um
nome adulterado no banco foi corrigido pela descoberta seguinte. Usuário de teste
removido depois. Mais 5 asserções da trava. `tsc` e `next build` limpos.

**O cron continua**, e ainda importa: ele cobre a janela de 30 dias e mantém o
motor de regras rodando **com ninguém olhando a tela** — o auto-sync só dispara
quando há requisição do painel.

> ⚠️ **Hoje há DOIS agendadores**: o cron-job.org (configurado pelo usuário) e o
> `.github/workflows/cron.yml`, que nunca foi removido e está ativo. Ver
> "DOIS AGENDADORES RODANDO AO MESMO TEMPO".

## 📋 Rotas de cron: como ler os retornos

### ⛔ A Graph API esconde ARQUIVADOS — foi o bug do "metrics: 0"

**`/campaigns`, `/adsets` e `/ads` excluem objetos ARQUIVADOS por padrão.** Uma
conta com 7 campanhas arquivadas devolvia `0` nas três arestas, enquanto
`/insights` seguia reportando **R$ 114,34** de gasto daquelas mesmas campanhas.

A cadeia da falha:
1. `/campaigns` → 0 ⇒ nenhuma `Campaign` local
2. `/ads` → 0 ⇒ nenhum `Ad` ⇒ `adIdMap` vazio
3. `/insights` → 16 linhas com `ad_id`
4. `adIdMap.get(ad_id)` → `undefined` ⇒ **`continue` silencioso em toda linha**
5. `metrics: 0`, `errors: 0`, gerenciador zerado

Corrigido com `effective_status` explícito (`STATUS_SINCRONIZADOS` em `sync.ts`).
Resultado real: 0 → **12 campanhas, 12 anúncios, R$ 103,41, 2.756 impressões**.

> ⚠️ **`DELETED` não é recuperável.** A Meta não devolve objetos excluídos nessas
> arestas de jeito nenhum, mas os insights deles continuam vindo. Esse gasto vira
> **`metricasOrfas`** no retorno em vez de sumir — era exatamente ele que fazia
> `errors: 0` mascarar perda de dado. No teste: 2 linhas órfãs = os R$ 10,93 de
> diferença entre o total da Meta e o atribuído.

### Funil: percentual sobre a MAIOR etapa (método Utmify) + análise de gargalo

O percentual era **sobre a etapa anterior**, e por isso passava de 100% sempre
que uma etapa era maior que a precedente — "Visita na página" (220, do nosso
script) sobre "Cliques no anúncio" (98, do Meta) dava **224,49%**. Não era erro
de conta: as duas contagens vêm de fontes independentes e se cruzam de verdade.

Hoje cada etapa mostra **% da maior etapa** (`src/lib/funnel.ts`): a maior fica
em 100% e nada a ultrapassa por construção. A espessura do segmento usa esse
mesmo percentual, então desenho e número contam a mesma história. O ⚠️ de
"acima de 100%" saiu — deixou de existir o caso.

Dados reais: `98, 220, 25, 14, 2` → `44,5% · 100% · 11,4% · 6,4% · 0,9%`.

> ⚠️ **A taxa vs. etapa anterior não sumiu** — é a informação analítica de
> verdade e continua no tooltip (visitas vs. cliques segue mostrando 224,5%). Só
> deixou de ser o número em destaque.

**O funil aponta o gargalo.** Por transição calcula perda absoluta, perda %, e
o faturamento estimado na mesa; elege a transição com a maior QUEDA e a marca
com divisória âmbar + resumo no rodapé. Entre as etapas aparece "−195 · 88,6%"
sem precisar de hover.

> ⚠️ **Valor financeiro só a partir do Initiate Checkout** (`INDICE_MIN_FINANCEIRO`).
> Quem chegou ao checkout e não comprou é receita que estava ao alcance, e o
> ticket médio é estimativa defensável. Multiplicar *visitante* perdido por
> ticket médio produziria um número enorme e fictício — a maioria dos visitantes
> nunca compraria.
>
> ⚠️ **Etapa que CRESCE não é gargalo.** Só quedas reais concorrem; sem esse
> filtro o "maior" cairia numa transição saudável quando o funil inteiro
> estivesse crescendo.

> ### ⚠️ "Excluir" no Facebook = ARQUIVAR
> Trazer arquivados resolveu o gasto sumido e **criou outro problema**: a
> listagem encheu de campanha que o usuário já tinha apagado — no Gerenciador do
> Facebook, "excluir" apenas arquiva.
>
> A separação que resolve os dois: o **dado** fica no banco (o gasto do Dashboard
> segue completo, porque soma `DailyAdMetric` direto) e a **listagem** esconde
> arquivados. `lib/ads/status.ts` é a fonte única — "Todos os status" exclui
> ARCHIVED/DELETED, e existe a opção "Arquivados" para vê-los.
>
> ⚠️ **O filtro de status é do CLIENTE.** O painel manda só `period` e `account`
> na querystring — status e busca são aplicados no navegador para trocar de
> filtro não custar um round-trip. Logo, `filters.status` chega ao servidor
> SEMPRE como `"todos"`.
>
> Enquanto "todos" significava "tudo", filtrar no servidor era inofensivo.
> Quando "todos" passou a excluir arquivados, o filtro do servidor virou uma
> peneira que **descartava as arquivadas antes de saírem da API** — e a opção
> "Arquivados" da tela ficou filtrando uma lista vazia (abas em "0 item(ns)"
> logo após um sync que reportou "12 campanhas"). O servidor não filtra mais por
> status; quem decide é `lib/ads/status.ts` no cliente. **Se um dia voltar a
> filtrar lá, o status PRECISA ir na querystring junto.**
>
> ⚠️ A contagem das abas usava `array.length` cru e mostrava "12" com a tabela
> vazia. Passou a aplicar o mesmo filtro das linhas.
>
> ⚠️ `pausado` significava `status !== "ACTIVE"`, que varria arquivados junto.
> Hoje é `PAUSED` estrito.

### Botão "Atualizar" — ponto ÚNICO de sincronização manual

Os botões "Sincronizar métricas" (Gerenciador) e "Sincronizar tudo" (Integrações)
foram removidos. O **"Atualizar" do Dashboard** é o único gatilho manual — ele
chama `POST /api/sync/manual`, que delega ao **mesmo `autoSyncSeNecessario`** dos
crons e do polling. Ou seja: o botão respeita os mesmos intervalos e **não
sincroniza cegamente**.

> O botão "Sincronizar" **por conta** em Integrações continua: é ação dirigida
> ("só esta conta agora"), não um segundo botão global.

**Custo medido** (1 perfil, 2 contas elegíveis), interceptando o `fetch`:

| Cenário do clique | Modo | Chamadas à Graph |
|---|---|---|
| Tudo em dia (< 20s) | `pulado` | **0** |
| Métricas vencidas | `metricas` | **2** (1 `/insights` por conta) |
| Estrutura vencida (**pior caso**) | `completo` | **9** |
| 5 cliques seguidos após um sync | `pulado` ×5 | **0** |

O pior caso se decompõe em `1 × /me/adaccounts` + `2 × (/campaigns + /adsets +
/ads + /insights)`. A fórmula é **`perfis + contas_elegíveis × 4`** — com N
contas rastreadas, `1 + 4N`.

**Trava contra clique repetido, em duas camadas:**
1. **Cliente** — botão desabilitado com spinner. O `syncManualBusy` é lido de
   dentro do `setS` (não num `if` antes), porque entre um `if` e o `setS` cabe
   outro clique e dois cliques rápidos disparariam duas requisições.
2. **Banco** — a reserva do `autoSync`. É a única que protege de verdade: duas
   abas, dois dispositivos ou um F5 no meio passariam pela primeira sem esbarrar
   em nada.

O botão também **recarrega o painel só DEPOIS** de sincronizar. Antes ele apenas
recarregava a tela, relendo o mesmo dado do banco — daí a impressão de que não
fazia nada.

### Fonte de verdade por métrica (Gerenciador)

> ### ✅ Dupla contagem é IMPOSSÍVEL por construção — não é disciplina, é estrutura
> Pedimos ao `/insights` **apenas** `spend,impressions,clicks,ctr,cpc,cpm,reach,frequency`.
> **Nenhum evento de conversão** — nada de `actions`, `conversions` ou
> `purchase_roas` — e `DailyAdMetric` não tem coluna para guardá-los. Quando a
> Meta enfim consolida as conversões dela, o dado **não entra no nosso banco**.
> Não existe caminho no código onde uma venda da Meta e uma venda nossa se somem.

| Métrica | Fonte | Por quê |
|---|---|---|
| Gasto, Impressões, CPM, Alcance, **Cliques** | **Meta** | Só o Facebook sabe quanto cobrou e quanto entregou |
| CPC, CTR | **Meta** | Denominador precisa bater com o painel da Meta |
| **Cliq. atr.** | **Nosso** | Chegou ao site com UTM. Coluna SEPARADA — nunca somada aos cliques da Meta |
| IC | **Nosso** | A Meta nem enxerga: o checkout é do gateway |
| **Vend. inic.** | **Nosso** | Vendas em qualquer status |
| Vendas, Faturamento | **Nosso** | Cruzamos com o gateway — sabemos o que foi APROVADO |
| CPA, ROAS, ROI, Lucro, CPI | **Derivada** | Custo da Meta ÷ conversão nossa |

**As conversões já eram tempo real** e isso não precisou ser construído: venda
(webhook → `Sale`), IC (`px.js` → `PixelEvent`) e clique (`t.js` → `Click`)
entram no nosso banco no instante do evento, e `computeAdsOverview` lê essas
tabelas **direto**, sem tocar na Graph API. Com o polling de 8s, aparecem em
segundos. Só gasto e impressões esperam a Meta.

> ⚠️ **Cliques da Meta ≠ cliques nossos, e as duas colunas coexistem.** O da
> Meta é métrica de mídia e é o denominador de CTR/CPC — trocá-lo faria o CTR
> divergir do painel deles sem motivo. A diferença entre as duas colunas é
> informação útil: clique da Meta sem clique nosso = quem clicou e não carregou
> a página (ou está sem o script de UTM).
>
> **Por que nosso número difere do Gerenciador da Meta:** (1) atraso de
> consolidação deles; (2) janela de atribuição — a Meta credita venda em até 7
> dias após clique e 1 após visualização, nós casamos por UTM/`fbclid` direto;
> (3) a Meta deduplica por pessoa entre dispositivos, nós por sessão. A UI traz
> ponto colorido por coluna (azul Meta / roxo nosso / cinza derivada) e legenda
> com essa explicação — sem isso o usuário compara, vê divergência e conclui que
> um dos dois está errado.

### Glossário dos contadores

| Campo | Significa |
|---|---|
| `users` | Usuários processados. **No `sync-facebook`**: com perfil do Facebook conectado. **No `run-rules`**: com ao menos uma regra ATIVA — `0` aqui significa "nenhuma regra cadastrada", não falha de query |
| `accounts` | Contas de anúncio efetivamente sincronizadas |
| `contasElegiveis` | Contas que passam no filtro `trackingEnabled: true` **e** têm perfil vinculado |
| `contasTotais` | Todas as contas do usuário, elegíveis ou não |
| `campaigns` / `adSets` / `ads` | Entidades criadas ou atualizadas |
| `metrics` | Linhas de `DailyAdMetric` gravadas (uma por anúncio × dia) |
| `metricasOrfas` | Insights descartados por não achar o anúncio local (anúncio excluído na Meta) |
| `totalMetrics` | Soma de `metrics` de todos os usuários |
| `errors` | Quantidade de falhas; `detalheErros` traz as mensagens |
| `contasNovas` | Contas detectadas agora na BM que ainda não existiam |
| `removidos` | Entidades apagadas localmente por não virem mais da Meta |
| `evaluated` / `acted` | (`run-rules`) regras avaliadas / que dispararam ação |

**Modos do `sync-facebook`:**

| `modo` | O que houve |
|---|---|
| `pulado` + `motivo: "intervalo"` | **Normal e esperado.** Não venceu o intervalo (20s métricas / 3 min completo). É a proteção de rate limit — a maioria das chamadas de um cron de 1 min cai aqui |
| `metricas` | Rodou o ciclo barato: 1 chamada por conta, só gasto/impressões/cliques |
| `completo` | Rodou o ciclo caro: estrutura + contas novas da BM |
| `completo-30d` | `?full=1` — janela de 30 dias, ignora intervalos |
| `erro` | Falhou; o campo `erro` traz a mensagem |

> **`accounts: 0` com `modo: "pulado"` é correto** — nada rodou, então não há o
> que contar. Só investigue `accounts: 0` quando o modo for `metricas`,
> `completo` ou `completo-30d`.

## 🐛 Quatro bugs que só apareceram ao trocar de banco (29/07/2026)

Rodar contra um banco **vazio** e com **sessão de outro banco** expôs coisas que
o ambiente único escondia. Ficam registrados porque todos voltam a morder quem
trocar a `DATABASE_URL` de novo.

### 1. `garantirAreaPrincipal` estourava FK em corrida

O layout dispara ~12 leituras em `Promise.all` e várias passam por
`filtrosDaArea` → `garantirAreaPrincipal`. Com `create` dentro de `try/catch`, a
perdedora batia no índice parcial único, caía no `catch` e lia a linha da
vencedora — que **ainda não tinha commitado**. O erro real era o
`findFirstOrThrow` do catch, e o `catch` vazio escondia a causa.

Hoje é **`createMany({ skipDuplicates: true })`**: o `ON CONFLICT DO NOTHING`
resolve a corrida no banco (a perdedora **espera** o commit da vencedora e
segue). Sem `try/catch`, então nenhum erro de verdade fica escondido.

> ⚠️ **Não troque de volta para `create` + `catch`.** O padrão certo aqui é o
> mesmo do upsert monotônico de vendas e da trava do auto-sync: **quem decide o
> vencedor é o banco.**

### 2. Sessão órfã derrubava o app inteiro com 500

O callback `session` resolvia o id pelo e-mail e, **quando o e-mail não existia
neste banco**, caía no `token.sub` — um id fantasma do banco anterior. O guard
deixava passar e a primeira escrita estourava
`Foreign key constraint violated`, com a tela em 500 e nenhuma pista.

Agora e-mail sem usuário correspondente **remove o id da sessão**, e o guard
(`session?.user?.id`) manda para o login. Sessão sem usuário real se comporta
como "não logado" — que é a leitura correta depois de trocar de banco.

### 3. `ERR_TOO_MANY_REDIRECTS` entre `/dashboard` e `/login`

Consequência do #2: o guard passou a exigir `user.id`, mas `login/page.tsx` e
`signup/page.tsx` ainda faziam `if (await auth())`. A sessão órfã tem `user` sem
`id` — dashboard mandava para o login, login mandava de volta, em loop.

> ⚠️ **As duas pontas precisam do MESMO critério de "está logado".** Ao mudar o
> guard, mude também quem redireciona no sentido contrário.

### 4. `<script>` cru no `RootLayout`

O anti-FOUC do tema era uma tag `<script>` escrita como elemento React, e o
console avisava: *"Scripts inside React components are never executed when
rendering on the client"* — literal, numa navegação pelo cliente a tag entra via
`innerHTML` e o navegador não a executa. Virou **`next/script` com
`strategy="beforeInteractive"`**, que é o que a documentação local do Next manda
(`node_modules/next/dist/docs/01-app/03-api-reference/02-components/script.md`) e
que exige estar no layout raiz.

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

## 🔴 REGRESSÃO EM PRODUÇÃO: dashboard zerado pela área Principal (29/07/2026)

**Sintoma:** depois do deploy, produção mostrou R$ 0,00 em tudo e "Nenhum evento
no período", mesmo com 69 cliques e 3 vendas nas últimas 48h.

**Causa: a área Principal nascia com todas as contas de anúncio numa lista de
INCLUSÃO.** Isso liga `carregarEscopoContas`, que descarta tudo que não casa com
uma campanha daquelas contas. Medido no backup de produção:

| | No banco | Sobreviviam ao filtro |
|---|---|---|
| Cliques | 221 | **132** (89 com `utm_campaign` NULO — direto/orgânico) |
| Vendas | 14 | **2** (12 sem clique associado) |

Antes das Áreas de Trabalho, o padrão era "todas as contas" = **sem filtro
nenhum**. Ao pré-preencher a Principal, troquei "sem filtro" por "inclusão de
tudo" — que **não é a mesma coisa**, porque inclusão descarta o não atribuível.

> ### ⛔ A PRINCIPAL FILTRA POR EXCLUSÃO. Nunca por inclusão.
> `filtrosDaArea` devolve, para a área `isDefault`, listas `excluir*` montadas a
> partir do que as **outras** áreas reivindicam — e **ignora as listas gravadas
> nela**. Escopo derivado não fica desatualizado quando uma área nova aparece.
>
> - **Inclusão** (área secundária): mostra só o que casa. Clique sem UTM e venda
>   sem clique **saem**, porque não dá para afirmar que são daquela conta.
> - **Exclusão** (principal, catch-all): mostra tudo menos o que casa com outra
>   área. O não atribuível **fica** — ele não pertence a ninguém e precisa
>   aparecer em algum lugar.
>
> ⚠️ **`notIn` sozinho não serve.** Em SQL, `NULL NOT IN (...)` é NULL, não TRUE:
> a venda sem `webhookId` e o evento sem `pixelConfigId` seriam descartados
> justamente no catch-all. Por isso o padrão é
> `OR: [{ campo: null }, { campo: { notIn } }]`.
>
> ⚠️ No escopo por fbclid a regra **se inverte**: na inclusão, evento sem fbclid
> sai; na exclusão, ele fica.

**Teste de regressão sobre os dados REAIS do backup:**

| Cenário | Cliques | Vendas |
|---|---|---|
| Total no banco | 221 | 14 |
| Antes (principal por inclusão) | 132 | **2** |
| Depois (principal catch-all) | **221** | **14** |
| Depois, com uma área secundária | B + Principal = **221** | **14** |

Nada se perde e nada é contado duas vezes: as áreas particionam o total.

> **Lição:** ao introduzir um filtro onde antes não havia nenhum, "incluir tudo"
> **não** é equivalente a "não filtrar". A diferença aparece exatamente nas
> linhas que não casam com critério nenhum — que costumam ser as mais
> silenciosas e as mais importantes.

## ✅ Estado ao fim da sessão de 29/07/2026 — e o que NÃO foi verificado

### Entregue e verificado

| | O quê | Como foi verificado |
|---|---|---|
| ✅ | Dois bancos separados; `.env` local no dev | `npm run db:onde` · consulta mostrando só dado `[DEV]` |
| ✅ | Backup da produção (486,6 KB · 594 linhas) | Arquivo lido de volta, 100% parseável |
| ✅ | Áreas de Trabalho isoladas, sem visão consolidada | `?ws=` ausente/vazio/inválido devolvem a Principal |
| ✅ | Área Principal automática e protegida | Criada sozinha; sem botão de excluir/arquivar |
| ✅ | Coluna Gasto no Gerenciador | Ordem das colunas conferida no DOM |
| ✅ | Autenticação falha FECHADA (cron + webhooks) | `curl`: 401 sem/errado, 200 com o secret |
| ✅ | 4 bugs de troca de banco | Ver a seção acima |

### ⚠️ NÃO verificado — não trate como pronto

| | Item | Por quê ficou assim |
|---|---|---|
| ⚠️ | **Produção na Vercel após o deploy** | Não tenho as credenciais dela localmente (de propósito). Abrir a URL e conferir login + dashboard é passo manual |
| ⚠️ | **Gasto total = R$ 103,41 (7 dias)** | Previsto por SQL de leitura na produção; não conferido na tela, porque a sessão local é do banco de dev |
| ⚠️ | **"Mover para cá"** (conta entre áreas) | Compila e tem caminho de servidor, mas o clique nunca foi exercido — exigiria semear conta de anúncio |
| ⚠️ | **PITR do Supabase** | Nunca foi respondido se o plano tem. Se for Free, **não existe PITR** e `npm run backup` é o único backup |
| ⚠️ | **Senha do banco de dev** | Passou pelo chat. Trocar em Supabase › Settings › Database › Reset database password |
| ⚠️ | **`ENCRYPTION_KEY` na Vercel** | Tem de ser byte a byte igual à que encriptou os dados. Chave diferente = tokens ilegíveis, sem rotação implementada |

### Dívidas que continuam abertas

- **Nav morto no `useTraffikState`** (`navAnalise`, `pageTitle`, `activeTab`, `fbTabs`…) e o gerador de link/snippet antigo (`utmUrl`, `snippetText`). Nada é renderizado. Faxina pendente desde o Bloco 1.
- **Bloco 8 (Regras)** — único bloco do roteiro v2 ainda não feito.
- **`DashboardLayout.workspaceId` continua nullable.** O NOT NULL só entra depois que a produção estiver rodando este código — ver a lição da `20260728120000`.
- **Colunas do Gerenciador que a Meta tem e nós não** — lista levantada e aguardando escolha: Alcance, Frequência, Objetivo, Estratégia de lance, Início/Término (todas já no banco), mais Cliques no link e Entrega detalhada (exigem sync novo).

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

## 🗂️ Áreas de Trabalho (28/07/2026) — parcial, retomar aqui

Área de Trabalho = **um conjunto de filtros salvo com um nome**, aplicado em
toda a ferramenta. Serve para operar duas ofertas sem ver os dados misturados.

> ### ⛔ NÃO é multi-tenant, e isso foi decisão explícita
> Um plano anterior previa `projectId` em 18 tabelas com isolamento no banco.
> Foi **cancelado pelo usuário** depois da análise: exigia migração
> irreversível, regeneração de scripts e webhooks, e não resolvia nada a mais
> para o caso de uso real. Os dados continuam todos do usuário, na mesma
> tabela, sem isolamento — a área só decide **o que a tela mostra**.
>
> Se a ideia de "projetos com isolamento" voltar, releia isto antes: o custo já
> foi levantado e a conclusão foi que não compensa.

### O que está ENTREGUE e testado (itens 1, 3 e 6)

- **Seletor na sidebar** (`ui/WorkspaceSelect.tsx`), sempre visível abaixo da
  marca. "Todas as áreas" é a primeira opção e o padrão; busca aparece a partir
  de 6 áreas; rodapé com atalho "Gerenciar áreas".
- **Filtro aplicado no Dashboard**, com refetch ao trocar de área.
- **Última área lembrada** em `User.lastWorkspaceId`, persistida sem bloquear a
  troca (a mudança de contexto tem que ser imediata).
- **Correção crítica junto:** o filtro "Conta de anúncio" só alcançava
  `DailyAdMetric` — ou seja, **só o gasto**. Vendas, cliques e ICs passavam sem
  filtro, então o ROAS era *(faturamento de TODAS) ÷ (gasto de UMA)*. Novo
  `lib/ads/escopo.ts` liga venda→conta pela cadeia de atribuição do Gerenciador.
  Medido: `CA 1 MARIA` saiu de ROAS 0,24x para **0,19x** (era 1,3× inflado).

> ### 🔐 PADRÃO A MANTER: a área viaja como ID, nunca como filtros
> A querystring leva `?ws=<id>` e **jamais** as listas de conta/produto/fonte.
> O servidor carrega os filtros em `filtrosDaArea()`, validando posse pelo
> `userId`. Mandar as listas pela URL deixaria o cliente **forjar o escopo** —
> qualquer rota nova que aceite área tem de seguir isto.

> ⚠️ **Caso de borda tratado:** área arquivada ou excluída não continua ativa —
> cai para "Todas as áreas". Sem isso a tela filtraria por algo inexistente.

### Decisões desta sessão (não reabrir sem motivo novo)

1. **`Workspace.webhookIds` APROVADO** como 4ª dimensão de filtro.
   `Sale.webhookId` já existe. É **mais confiável que o filtro por produto**,
   que depende de texto livre e quebra em silêncio se o nome mudar no gateway.
2. **`Workspace.pixelConfigIds`** também entra, mesma mecânica
   (`PixelEvent.pixelConfigId` já existe).
3. **O script do PIXEL já é único por pixel** — `pixelScript()` embute o
   `PixelConfig.id` e `/api/pixel/event` resolve por ele. **Nada a mudar**, o
   requisito de "um script por pixel" já está atendido.
4. **O script de UTM é único POR CONTA, por desenho** — embute o `userId`.
   **NÃO deve virar por área.**
   > 🔒 **Regra permanente: nenhum identificador já emitido muda de
   > significado.** É o que garante que script e webhook instalados nunca param
   > de reportar. Quem separa as áreas nos UTMs é o `utm_campaign` no formato
   > `nome|id`, que vem da campanha na Meta — não do script.
5. **Uma conta de anúncio pertence a apenas UMA área.** ✅ **Validado desde
   28/07/2026** por `contasOcupadas()`, na tela e no servidor. `accountIds`
   continua sendo array simples — quem garante a regra é a checagem, não o
   schema, então **duplicata legada gravada antes disto ainda pode existir**: a
   tela mostra a área mais antiga como dona e o save seguinte recusa.
6. **Passo 5 do futuro assistente:** a parte do **pixel vincula de verdade**; a
   parte dos **UTMs é apenas informativa** (o script é o mesmo para todas).
   *(Assistente cancelado — ver o fim desta seção.)*

### Pendente, na ordem acordada

| | O quê |
|---|---|
| ~~**(a)**~~ | ✅ Colunas `description`/`webhookIds`/`pixelConfigIds` + filtro em `metrics.ts` + validação de conta única |
| ~~**(b)**~~ | ✅ **Tela `/dashboard/areas`** — o 404 do seletor acabou |
| **(c)** | Aplicar `?ws=` em `/api/ads`, Criativos e Atividade Recente |
| **(d)** | `useDashboardLayout` passar o `workspaceId` (as actions já aceitam) |
| **(e)** | `returnTo` no callback do OAuth — hoje o destino é fixo em `/dashboard/integracoes/anuncios?fb=connected` |
| ~~**(f)**~~ | ❌ **Assistente de 6 passos CANCELADO** — ver abaixo |

**Testado (1ª rodada):** Área A 400÷200 = 2,00x, Área B 120÷100 = 1,20x, nenhuma
vê a outra, consolidado soma os gastos, área de outro usuário não aplica filtro,
layout de "Todas" convive com o da área, e **excluir área não apaga venda**.
21 asserções nas duas rodadas.

### (a) e (b) — entregues em 28/07/2026

**Migration `20260728210000_workspace_extras`** — `description`, `webhookIds`,
`pixelConfigIds`. Tudo **aditivo e com default**, então nenhuma área existente
precisou de backfill e o build antigo que ainda roda em produção sobre o mesmo
Supabase continua funcionando (é exatamente o oposto do incidente da
`20260728120000`, que dropou coluna ainda selecionada em prod).

**As duas dimensões novas não têm filtro na barra do topo**, então não passam
por `filtroEfetivo` — vão direto ao `where` de `metrics.ts`:

| Dimensão | Coluna | Nota |
|---|---|---|
| `webhookIds` | `Sale.webhookId` | **O recorte de venda mais confiável.** É FK, não texto livre: não quebra em silêncio quando o produto é renomeado no gateway |
| `pixelConfigIds` | `PixelEvent.pixelConfigId` | Recorta o funil (IC/Lead/AddToCart) e o feed de Atividade |

> ⚠️ **Venda sem `webhookId` fica de fora** quando o filtro de webhook está
> ligado — é o caso da ingestão pela chave de API. E o **Initiate Checkout
> gerado pelo webhook do gateway** (`webhook/checkoutEvent.ts`) nasce **sem**
> `pixelConfigId`, então some quando há filtro de pixel. Nos dois casos não há
> como afirmar a origem, e inventá-la seria pior que excluir.
>
> ⚠️ **Cliques não são recortados por webhook nem por pixel** — um `Click` não
> tem nenhum dos dois. A etapa "Visita na página" do funil ignora essas duas
> dimensões.

**Validação "uma conta pertence a uma única área": `contasOcupadas(ids, exceto?)`**
devolve *quais* contas estão ocupadas e *por qual área* — não um booleano, porque
a tela precisa nomear a área ocupante, senão o bloqueio vira um "não" sem saída.
Roda **no servidor dentro de `create`/`updateWorkspace`** mesmo com a tela já
bloqueando a seleção: server action é endpoint público, e o bloqueio da tela é
conveniência.

> ⚠️ **Duplicar NÃO copia as contas de anúncio.** Copiar produziria um conflito
> garantido no ato da duplicação. A cópia nasce com produtos/webhooks/pixels e
> sem contas — e o card explica isso na pendência.

**Tela `/dashboard/areas`** (`views/AreasView.tsx`, autocontida, mesmo padrão de
`UtmsView`/`PixelView`). Cards com nome, cor, descrição, os vínculos das 5
dimensões e **as pendências ditas em consequência**, não em jargão — "Sem conta
de anúncio — o gasto exibido é o de todas as contas, então ROAS e ROI ficam
distorcidos" em vez de "accountIds vazio". Produto com **0 vendas em 30 dias**
(via `checarProdutosDasAreas`) ganha chip âmbar com ⚠.

- **`checarProdutosDaArea` virou atalho sobre `checarProdutosDasAreas`**, que faz
  **um `groupBy` para todas as áreas**. Uma consulta por área custaria N × ~99ms
  de ida e volta ao Supabase numa tela que lista N áreas de uma vez.
- **`ui/ListaSelecionavel.tsx`** — seleção múltipla com busca. Item bloqueado
  **aparece desabilitado, não some**: uma conta que sumiu da lista sem
  explicação manda o usuário procurar o que não existe.
  > ⚠️ Um id **selecionado que não está mais nas opções** (produto renomeado no
  > gateway, webhook excluído) é renderizado como órfão marcável. Sem isso ele
  > seguiria filtrando de verdade sem aparecer na tela nem poder ser desmarcado.
- O card mostra id truncado + "(removido)" para webhook/pixel que não existe
  mais, pela mesma razão.
- **Excluir** abre modal dizendo em letras que **nenhum dado é apagado** e o que
  de fato se perde (configuração + layout da área).

**Testado ponta a ponta** (dev server + Supabase + navegador, usuário
`teste@traffik.io` com 2 contas / 2 webhooks / 2 pixels / 3 vendas semeados):

| Caso | Resultado |
|---|---|
| Área A (conta+webhook+produto+pixel A) | rev 200 · gasto 100 · **ROAS 2,00x** · 2 vendas · 2 IC |
| Área B (conta+webhook+produto+pixel B) | rev 500 · gasto 300 · **1,67x** · 1 venda · 1 IC |
| Área B tinha "Curso" nos produtos | não entrou: a venda do Curso não é do webhook B — **prova a interseção** |
| Só `webhookIds=[B]` | rev **500**, gasto 400 (sem filtro de conta), IC 3 (sem filtro de pixel) |
| Só `pixelConfigIds=[B]` | IC **1** e 1 checkout no feed; rev/vendas intactos |
| `?ws=` com id inexistente | sem filtro nenhum (não vaza dado de outra área) |
| Conta já vinculada | checkbox desabilitado com *"Já vinculada à área “Area A”"* |
| Save forçando conflito | recusado no servidor: *"Conta de anúncio já vinculada a outra área (Area B)"* |
| Duplicar | cópia sem contas, com produtos/webhooks/pixels |
| Excluir Área B | vendas **13 → 13**, faturamento **2051,70 → 2051,70** |
| Arquivar | sai do seletor da sidebar, fica na aba "Arquivadas (1)" |
| Selecionar a área na sidebar | Dashboard mostrou R$ 200,00 / R$ 100,00 / 2,00x / 2 vendas |

`tsc --noEmit` e `next build` limpos; dados de teste removidos.

### ⛔ A visão "Todas as áreas" foi REMOVIDA (29/07/2026)

**Não existe mais visão consolidada em lugar nenhum do produto.** As áreas são
isoladas e as métricas são sempre de UMA operação. O usuário está sempre dentro
de uma área — não há estado "sem área".

> ### 🔐 A garantia mora no SERVIDOR, numa linha só
> `filtrosDaArea()` antes devolvia `{}` quando o `ws` faltava ou era inválido —
> e `{}` significa "não filtra nada", ou seja, o consolidado. **Era o buraco por
> onde qualquer rota que esquecesse o `?ws=` somava as áreas em silêncio.**
>
> Hoje o fallback é a **área principal**. Requisição sem `ws`, com `ws` vazio ou
> com id de outro usuário mostra a operação padrão — nunca o total. Vale mesmo
> com o cliente adulterado, porque quem resolve é o servidor.
>
> ⚠️ **Toda rota nova que sirva métrica PRECISA chamar `filtrosDaArea`.** É o
> único ponto que garante o isolamento; uma consulta que vá direto ao Prisma
> sem passar por ali volta a ver tudo.

**Migration `20260729120000_sem_visao_consolidada`:**
1. Cria a principal para todo usuário que ainda não tinha (com todas as contas,
   webhooks e pixels da conta) — inclusive quem nunca abriu o painel.
2. **Layout salvo em `workspaceId NULL` vira layout da principal.** Antes disso
   resolve a colisão do `@@unique(userId, workspaceId, viewport)`: NULL não
   colide no Postgres, então ao preencher o NULL duas linhas viravam a mesma
   chave. Vence a mais recente.
3. `User.lastWorkspaceId` nulo passa a apontar para a principal.

> ⚠️ **`DashboardLayout.workspaceId` continua NULLABLE de propósito.** O banco é
> compartilhado com um build antigo em produção que ainda insere NULL ali;
> marcar NOT NULL agora quebraria o "Salvar layout" dele — o mesmo erro da
> `20260728120000`. O NOT NULL entra num segundo deploy.

**O que saiu do código:** `todasEscolhida`, `vendoTodasAsAreas`, `totalDeAreas`,
a faixa âmbar do Header, a opção Σ do seletor e o ramo `workspaceId ?? null` do
`dashboardLayout.ts`. `trocarWorkspace` agora recebe `string`, não `string | null`.

**O seletor ficou:** lista das áreas + "Gerenciar áreas" no rodapé. Sem opção
consolidada e sem contador de "números somados".

> ⚠️ **O isolamento depende de a área estar CONFIGURADA.** Lista vazia continua
> significando "não filtra": uma área secundária sem conta de anúncio vê o gasto
> de todas as contas. Não é vazamento do modo consolidado — é configuração
> incompleta —, e é por isso que o card da área avisa em âmbar. A única área em
> que "ver tudo" é legítimo é a principal enquanto for a única.
>
> ⚠️ **Venda sem `webhookId` (ingestão por chave de API) some de toda área** que
> filtre por webhook, porque não há como afirmar de qual operação ela é. Mesmo
> raciocínio do IC sem `pixelConfigId`.

**Verificado:** seletor sem "Todas"/Σ; `/api/dashboard` sem `ws`, com `ws=` e
com `ws` inválido devolvem os MESMOS números da principal; as 4 rotas de métrica
passam por `filtrosDaArea`; no banco, os 2 usuários têm principal
(`pedrodurso8` com 5 contas, 1 webhook, 2 pixels) e **nenhum `DashboardLayout`
ficou com `workspaceId` nulo**.

### 🏠 Área PRINCIPAL e o padrão de entrada (29/07/2026)

**Migration `20260729060000_workspace_principal`** — `Workspace.isDefault` +
**índice único PARCIAL** `Workspace_userId_default_key` (`ON ("userId") WHERE
"isDefault"`).

> ⚠️ Tem de ser **parcial**. Um `UNIQUE(userId, isDefault)` comum proibiria duas
> áreas secundárias, porque as duas teriam `false`. A garantia mora no banco
> porque `garantirAreaPrincipal()` roda em todo carregamento de página e várias
> abas podem chamá-la ao mesmo tempo — mesmo padrão do upsert monotônico de
> vendas: quem decide o vencedor é o banco, e o perdedor lê o que o vencedor
> gravou.

**`garantirAreaPrincipal()`** (chamada por `listWorkspaces()`, que o layout já
executa): se não há principal, **promove a área mais antiga**; se não há área
nenhuma, cria a "Principal" **já preenchida com todas as contas de anúncio,
webhooks e pixels da conta**.

> ⚠️ **`products` e `sources` nascem VAZIOS de propósito.** São texto livre: uma
> lista explícita congelaria o passado e um produto novo do gateway ficaria de
> fora da principal **em silêncio**. Vazio = "todos", que é o comportamento
> certo para a operação padrão. Contas/webhooks/pixels são conjuntos finitos e
> gerenciados, então listá-los é seguro — e é o que torna a principal
> **isolada** quando surge a segunda área.

**A principal não pode ser excluída nem arquivada.** A checagem vive na server
action (`deleteWorkspace` filtra `isDefault: false`; `updateWorkspace` recusa
`archived: true`), não só no botão escondido — server action é endpoint público,
e sem principal o seletor fica sem fallback.

#### O padrão de entrada deixou de ser "Todas as áreas"

| | Antes | Agora |
|---|---|---|
| Sem preferência salva | "Todas as áreas" (soma) | **Principal**, isolada |
| Área lembrada arquivada/excluída | caía em "Todas" | cai na **Principal** |
| Usuário escolhe "Todas" | persistia | **não persiste** |

> ⚠️ **"Todas as áreas" NÃO é lembrada entre sessões, de propósito.**
> `setLastWorkspaceId(null)` é um no-op. Ela é uma consulta pontual ("quanto o
> negócio inteiro fez?"), não um lugar para morar — persisti-la reabriria a
> ferramenta na visão somada, que é o comportamento que estamos eliminando. A
> escolha vale enquanto a aba estiver aberta.
>
> ⚠️ O estado `todasEscolhida` no `useTraffikState` existe porque "Todas" é
> `workspaceAtiva === null`, **indistinguível de "ainda não escolheu"**. Sem a
> flag, o efeito de semeadura jogaria o usuário de volta para a principal a cada
> re-render do layout, e seria impossível ficar no consolidado.

#### Consolidado tem tratamento visual próprio

- **Seletor da sidebar**: duas linhas ("ÁREA PRINCIPAL" / nome), fundo tingido
  com a cor da área e faixa lateral da mesma cor. No consolidado vira **âmbar
  com Σ** e o rótulo "Visão consolidada".
- **Header**: selo ao lado do título — `● Área X · dados isolados`, ou, no
  consolidado, âmbar dizendo *"os números abaixo são a soma de N área(s), não de
  uma operação só"*.
- As áreas vêm **primeiro** no dropdown; "Todas as áreas" foi para o rodapé,
  com a legenda "Números somados de N área(s)".

#### Conta de anúncio: bloqueio COM saída

Com a principal nascendo dona de todas as contas, o bloqueio de conta duplicada
viraria um beco: criar a primeira secundária esbarraria nele sempre. O item
bloqueado agora traz **"Mover para cá"**, que registra a conta em
`moverContas` — e só então o servidor (`liberarContas`) a tira da área anterior.
**Nada troca de área em silêncio**: sem o clique, o save continua sendo recusado.

#### Onde a área ativa é aplicada

| Tela | Como |
|---|---|
| Dashboard + Atividade Recente | `?ws=` → `computeDashboard` |
| **Gerenciador de Anúncios** | `?ws=` → `computeAdsOverview` (contas, vendas, cliques, IC) |
| **Criativos** | `?ws=` → `computeCreatives` |
| **Notificações** | `?ws=` → `listNotifications` |
| **Regras** | filtro no cliente, pelas contas de anúncio que a regra mira |

> ⚠️ **Notificação SEM venda aparece em TODA área.** Relatório diário, alerta de
> regra e aviso de sistema não pertencem a operação nenhuma; escondê-los faria o
> usuário perder aviso por estar na aba errada. Só o que tem `saleId` é
> recortado, e pela mesma regra do Dashboard (webhook + produto da venda).
>
> ⚠️ **Regra sem conta escolhida vale para todas e aparece em toda área.** Ela
> realmente age sobre as campanhas desta área também — escondê-la faria o
> usuário achar que ninguém está pausando as campanhas dele enquanto uma regra
> global as pausa.
>
> ⚠️ **Integrações e Taxas continuam globais**, de propósito: são cadastro
> (webhook, pixel, conta, despesa), não métrica. É lá que se cria o que as áreas
> depois separam.

### ❌ O assistente de 6 passos foi CANCELADO

Criar área **numa tela só** ficou suficiente: nome, cor, descrição e as 5
dimensões cabem numa gaveta, e cada campo já explica a consequência de ficar em
branco. Paginar isso em 6 passos esconderia de quem sabe o que quer exatamente
os campos que veio preencher, e obrigaria a navegar para trás para corrigir.

O que o assistente prometia e a tela já entrega: as pendências por área (nos
cards), o aviso de produto que parou de casar, e o bloqueio de conta duplicada
com o nome da área ocupante. **A pendência (e) — `returnTo` no OAuth — existia
só para o assistente não perder o estado ao conectar um perfil; sem assistente,
ela vira melhoria menor, não bloqueio.**

> Se um dia voltar a ideia de onboarding guiado, o lugar dele é o **primeiro
> acesso** (usuário sem nenhuma área), não a criação da segunda em diante.

## 🔴 INCIDENTE (29/07/2026): produção fora do ar por 40 min — DOIS projetos na Vercel

Durante o deploy da Sessão 1, a produção parou de logar. Três causas empilhadas,
e a terceira é a que ninguém teria adivinhado.

### 1. `?pgbouncer=true` — o painel do Supabase entrega a string ERRADA para este projeto

O botão **Copy** do Supabase dá `...?pgbouncer=true`. Este app usa **Prisma 7 com
`@prisma/adapter-pg`**, que não reconhece esse parâmetro. O par correto é
`?sslmode=require&uselibpqcompat=true`.

> ⚠️ **Não copie a connection string do painel sem editar.** O conselho genérico
> ("use o botão Copy, não monte à mão") está errado aqui.

### 2. `Invalid URL` ≠ `P1000` — são diagnósticos diferentes

| Erro no log | Significa |
|---|---|
| `P1000 Authentication failed` | usuário ou senha (ou senha sem URL-encoding) |
| `Can't reach database server` | host ou porta |
| **`Invalid URL`** | **a string não é parseável** — quase sempre **aspas coladas no valor** |

O `Invalid URL` veio de aspas: no `.env` escreve-se `DATABASE_URL="postgresql://..."`,
mas no campo da Vercel **as aspas não vão**. Valor começando em `"` não é URL.

Senha com caractere especial precisa de URL-encoding (`#`→`%23`, `@`→`%40`); a
saída mais barata é **senha só alfanumérica**, que elimina a classe inteira.

### ⛔ 3. EXISTIAM DOIS PROJETOS NA VERCEL apontando para o MESMO Supabase

`342dd-virid` (produção, a documentada) e `342dd-virif` — mesmo código, mesmo
banco. A correção da variável foi feita no **`virif`**, e o usuário testava o
**`virid`**: consertou um e olhou o outro, por quase meia hora.

**Como foi descoberto:** sondando as duas URLs no mesmo endpoint que toca o banco.

```
POST /api/webhook/kirvano?id=invalido
  342dd-virid → 500   (banco inacessível)
  342dd-virif → 404   (banco OK — token não existe, resposta correta)
```

> ### 🔎 A sonda de saúde do banco, sem precisar de login
> `POST /api/webhook/kirvano?id=<token-invalido>` é **público** e a **primeira
> coisa que ele faz é tocar o banco**. Resposta esperada: **404**
> `{"error":"Webhook não encontrado."}`. Se vier **500**, o banco está
> inacessível — não é preciso sessão nem painel para saber.
>
> `/login` responder 200 **não prova nada**: página anônima não consulta o banco.
> Foi o que sustentou a impressão de "o app está no ar, só o login sumiu".

**Dois projetos no mesmo banco é perigoso** — webhook chegando em dois lugares,
duas sincronizações contra a Graph API. O `virif` foi removido. **Antes de
depurar produção, confirme que existe UM projeto só.**

### Ordem obrigatória em deploy com migration ADITIVA

**Migration primeiro, deploy depois.** O código novo faz `SELECT` das colunas
novas — `listNotifications()` roda no `Promise.all` do layout, ou seja, em todo
carregamento de página. Deployar antes derrubaria o dashboard inteiro, que é o
espelho do incidente da `20260728120000`. A ordem inversa é segura: o build
antigo não conhece as colunas novas e as ignora.

> ⚠️ **Variável de ambiente na Vercel só vale em build novo.** Salvar não
> reinicia nada — é preciso **Redeploy**. E ela precisa estar marcada para o
> environment **Production**.
>
> ⚠️ Logo após um deploy há uma janela de transição em que rotas podem devolver
> 500. Confirme com 2–3 sondas espaçadas antes de concluir que houve regressão.

### 🔑 Credenciais que passaram pelo chat — TROCAR

As senhas do banco de **dev** e de **produção** foram digitadas na conversa e
estão no histórico. Ambas precisam ser rotacionadas em Supabase › Settings ›
Database › Reset database password (e a de produção atualizada na Vercel, com
**Redeploy**). Eu nunca preciso da senha — só do formato da string.

## ✍️ Microcópia: benefício em vez de mecanismo (grupos 1 e 2)

**~30 textos reescritos.** A interface explicava COMO foi construída em vez de
O QUE faz.

> ### ⛔ Simplifique jargão de PROGRAMAÇÃO, nunca de TRÁFEGO
> **ROAS, ROI, CPA, CTR, CPM, criativo, CBO, ABO, conjunto, pixel, UTM, gateway,
> campanha** são o vocabulário NATIVO do usuário (gestor de tráfego /
> infoprodutor) — ele entende "ROAS" melhor que "retorno sobre investimento em
> anúncios". Trocar isso por linguagem "acessível" **piora** o produto.
>
> O que sai é o que só o programador conhece: **banco de dados, filtro (como
> definição), query, token, coluna, nullable, FK, catch-all, derivada**.

### `plural()` e `palavra()` em `lib/format.ts`

`43 evento(s) recebido(s)` → `43 vendas recebidas`. O parêntese é gambiarra de
código vazando na tela. O helper aceita a forma plural **completa**, porque
português não pluraliza só com "s" (`mês` → `meses`), e um terceiro argumento
opcional para o zero (`"nenhuma venda ainda"`).

Aplicado em 12 arquivos — Webhooks, Pixel, Anúncios, Testes, Áreas, Regras,
Gerenciador, AdsActionBar, AdsTable, ListaSelecionavel, CountryMap, Dashboard.

### Trocas de vocabulário

| Antes | Depois |
|---|---|
| "Um conjunto de filtros, salvo com um nome… não separa os dados **no banco**" | "Separe suas operações sem misturar os números" |
| "Área padrão: mostra tudo. Ao criar outras áreas, o que elas levarem sai daqui" | "Sua operação principal. O que você mover para outras áreas deixa de aparecer aqui." |
| "Só para você lembrar. **Não filtra nada.**" | "Uma nota para você. Não muda nada nos números." |
| "**Nada selecionado — este campo não filtra.**" | "Nada escolhido — vale para todos." |
| "Todo campo em branco significa '**não filtra por isto**'" | "Campo em branco vale para todos." |
| "**token protegido**" / "**token salvo**" | "conectado" |
| "**sem token**" | "falta conectar" |
| "Nenhum pixel com **token da CAPI**" | "Nenhum pixel conectado — os eventos não chegam ao Facebook." |
| "**Vínculo no banco**" (aba Testes) | "Onde este link foi reconhecido" |
| "Nada aqui. Sincronize as métricas ou ajuste os filtros." | "Nenhuma campanha neste período. Tente outro intervalo ou outro status." |
| Legenda: "Meta Ads · **Nosso rastreamento** · **Derivada**" | "Vem do Facebook · Medido pela Traffik · Calculado" |

> ⚠️ **"Filtro" sobreviveu onde é AÇÃO DE TELA** ("ajuste os filtros") e saiu onde
> era DEFINIÇÃO ("um conjunto de filtros"). Filtrar relatório é vocabulário de
> tráfego; explicar um produto como "conjunto de filtros" é falar de implementação.

> ⚠️ **"Token" ficou onde é o nome do que o usuário cola**: "Cole aqui o token
> gerado no painel da Kirvano" é instrução correta — é assim que a Kirvano chama.
> Saiu só onde era ESTADO interno ("token salvo", "· token").

### Grupos 3 e 4 — explicação virou tooltip

> ⚠️ **Meu levantamento estava errado: o grupo 4 já estava feito.**
> `lib/explicacoes.ts` já tinha as 12 métricas (`ROAS · ROI · CPA · CPM · CPC ·
> CTR · CPI · ARPU · Ticket · Margem · Lucro · Cliq. atr.`), as 5 etapas do funil
> e vários campos de configuração. **Confira `explicacoes.ts` antes de "adicionar
> tooltips"** — o catálogo é mais completo do que parece de fora.

A lacuna real eram os campos criados nas sessões recentes, onde eu mesmo pus
explicação em **texto corrido**. Seis entradas novas em `explicacoes.ts`:
`regraTeto`, `regraJanela`, `regraContas`, `despesaArea`, `contaUnicaPorArea`,
`utmPorArea`.

> ⚠️ **A explicação de métrica é da CONTA, não do termo.** O usuário sabe o que é
> ROAS; o que ele não sabe é **qual gasto a Traffik usou**. Por isso as entradas
> têm `formula` e `fonte` (Vem do Facebook / Medido pela Traffik / Calculado).

**O `Campo` de `RuleDrawer` e de `AreasView` ganhou `info`**, e o `dica` ficou
para a linha curta que muda com a escolha (ex.: a unidade selecionada).
Parágrafo de ajuda embaixo de cada campo empilha ruído numa gaveta de 10 campos.

Saiu daí o pior exemplo do projeto: `"Só nesta Área de Trabalho (desmarcado:
vale para todas as áreas)"` — um rótulo carregando o comportamento do próprio
checkbox entre parênteses. Virou rótulo limpo + ⓘ.

### ⚠️ Falta da padronização visual (Frente 2)

- **~22 `<select>` nativos em 8 arquivos** — o `ui/Select` (Bloco 3) já existe;
  é adoção, não construção. As telas novas (RuleDrawer, RulesView) já nasceram
  sem nenhum.
- **7 checkboxes nativos em 4 arquivos** — `ui/Checkbox` já existe (Bloco 8) e
  já foi adotado em Taxas e no diálogo de exclusão.
- **Ícones em dois sistemas**: `0 0 24 24` (14×) e `0 0 256 256` (11×).
  Unificar em 24×24.
- Preservar as exceções: selects de mês/ano do `DateRangePicker` (nativos de
  propósito) e a página `test-checkout`.

## 🐛 Campo perdia o foco a cada tecla — causa raiz em `useOverlay`

**Sintoma:** digitar no nome ou na descrição de uma Área de Trabalho perdia o
foco a cada caractere; o resto do texto ia para outro campo ou para nenhum.

**Causa:** o efeito de `ui/useOverlay.ts` dependia de `[aberta, onClose]`, e
`onClose` chega como **arrow inline do pai** (`onClose={() => setRascunho(null)}`),
recriada a cada render. Cada tecla → pai re-renderiza → `onClose` muda de
identidade → o efeito roda o **cleanup**, que faz
`focoAnterior.current?.focus?.()` (devolve o foco a quem abriu), e reagenda foco
no PRIMEIRO campo do painel.

**Atingia TODA gaveta e modal da ferramenta**, porque todas passam por ali.

**Correção:** `onClose` vive numa ref; as dependências ficaram só `[aberta]`.

> ⚠️ **Não devolva `onClose` (nem nenhuma callback do pai) ao array de
> dependências deste efeito.** Se precisar de outra função do pai aqui, use o
> mesmo padrão de ref. Uma callback inline é sempre nova a cada render, e neste
> efeito "re-executar" significa **mexer no foco do usuário**.
>
> ⚠️ `DateRangePicker.tsx` tem o mesmo padrão (`}, [onCancel]`), mas ali o efeito
> só registra um listener de Esc — re-registrar é desperdício, não bug. Deixado
> como está de propósito.

**Verificado no navegador** (banco de dev): nome da área **39 caracteres**,
descrição **58**, nome da regra **54**, valor de condição **6 dígitos**, busca do
Gerenciador **33** — todos com o texto íntegro e o foco no próprio campo.

### ⚠️ Taxas e Despesas: formulário saiu do estado global (sem defeito provado)

Os campos de "nova taxa/despesa" moravam no `useTraffikState`, provido por
contexto ao dashboard inteiro — cada tecla re-renderizava a árvore toda. Passaram
a ter **estado local na `FeesView`**, e os `add*` do hook agora **recebem os
valores** em vez de lê-los do estado global.

> ⚠️ **Honestidade sobre esta mudança:** ela é a arquitetura certa (campo de
> formulário não deve morar naquele hook — as views novas já fazem assim), mas
> **não houve defeito de aplicação comprovado**. 12 mudanças de valor sem pausa
> nenhuma produziram o valor correto antes e depois. A digitação em nível de
> sistema falhou ali duas vezes no harness de teste e não em outros campos, sem
> explicação — possivelmente artefato do teste. **Confirme digitando.**

> **Regra que fica:** campo de formulário mora na view. O `useTraffikState` é
> para dado do servidor e estado compartilhado entre telas, não para digitação —
> cada tecla ali re-renderiza o dashboard inteiro, gráficos incluídos.

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

## 🗑️ Exclusão de área COM ESCOLHA (29/07/2026)

Antes, tudo que pertencia à área ia automaticamente para a Principal. Protegia
integração instalada, mas poluía a Principal com coisas que o usuário não
reconhecia. Agora o diálogo (`views/areas/ExcluirAreaDialog.tsx`) oferece escolha
por grupo, e o núcleo vive em **`lib/areas/exclusao.ts`** — sem `"use server"`,
para ser testável fora de um request (mesma razão de `precedencia.ts`).

### 🔴 O risco que ninguém tinha visto: excluir área AMPLIAVA escopo

Todas as FKs são `onDelete: SetNull`, e para conta/webhook/pixel nulo significa
"sem dono, aparece na Principal". Mas em **duas** colunas o nulo tem o
significado **invertido**:

| Coluna | `NULL` significa | Consequência de excluir a área (antes) |
|---|---|---|
| `AutomationRule.workspaceId` | **regra GLOBAL** | "pause as campanhas desta operação" virava **"pause as de TODAS as contas"** — e a regra continuava ATIVA, agindo com dinheiro real |
| `Expense.workspaceId` | **vale para todas as áreas** | a despesa da área excluída passava a inflar o custo de todas as outras |

Por isso o padrão destes dois é **mover para a Principal** (e a regra vai
**desligada**). Nenhum dos dois amplia escopo sozinho.

> ⚠️ Só desativar a regra **não bastava**: ela ficaria com `workspaceId` nulo, e
> bastaria alguém religá-la para agir em todas as contas. Move **e** desliga.

### Padrões — sempre a opção mais segura

| Grupo | Padrão | Alternativa |
|---|---|---|
| Contas de anúncio | **desvincular** | mover para a Principal |
| Gateways (webhooks) | **mover** | excluir |
| Pixels | **mover** | excluir |
| Automações | **mover + desligar** | mover ligada · excluir |
| Taxas e custos | **mover** | excluir |
| Vendas, visitas, eventos | **manter** | apagar (atrás de duas travas) |

> ### ⛔ Conta de anúncio NUNCA tem a linha apagada
> `Campaign`, `AdSet`, `Ad` e `DailyAdMetric` pendem de `AdAccount` com
> **`Cascade`**. Apagar a conta destruiria **todo o histórico de gasto** — o
> número que alimenta ROAS, ROI e CPA de todos os períodos. "Desvincular" é o
> mais destrutivo que faz sentido, e é seguro exatamente por isso.

> ### 🔴 Apagar dados: download OBRIGATÓRIO e nome digitado
> O Supabase Free **não tem PITR**; `npm run backup` é o único backup. Então o
> campo de confirmação só destrava **depois** de o arquivo ser baixado, e o botão
> só habilita quando o nome digitado bate exatamente. Irreversibilidade tem de
> ser honesta, não teórica.
>
> ⚠️ **O GASTO nunca é apagado**, nem quando o usuário pede. `DailyAdMetric`
> pende do anúncio, não da área: apagar venda e manter gasto deixaria custo sem
> faturamento (ROI travado em −1,00x) e mudaria os totais históricos. É o
> registro do que a Meta cobrou, não um dado nosso. O resumo diz isso em
> linguagem simples: *"o investimento já feito continua no histórico"*.

> ### ⚠️ A ORDEM da exclusão importa
> Os dados são apagados **antes** de mexer na configuração. A área de uma venda é
> calculada pela precedência, e mover um webhook para a Principal **muda a
> resposta** de "esta venda é de quem?" — com a ordem invertida, o conjunto
> apagado não seria o que o usuário viu na prévia.

### Avisos em linguagem de consequência, nunca de mecanismo

- **Webhook:** "o endereço configurado no painel do seu gateway vai parar de
  funcionar… as vendas que já entraram continuam no histórico, mas deixam de
  aparecer ligadas a esse gateway" — nada de `SetNull`.
- **Pixel:** "o código instalado na sua página vai parar de registrar eventos…
  os eventos já registrados continuam" — nada de "órfão".
- **Conta:** "apenas desvincular; nada muda no Facebook".

**Testado no banco de dev — 15 asserções, 0 falhas** (áreas montadas com um de
cada grupo e removidas por id): prévia enxerga os 5 grupos e o nº de vendas do
webhook; padrões preservam tudo; **regra não vira global** (Principal + desligada);
**custo não vira global**; escolha "excluir" remove; **nome errado recusa sem
apagar nada** e a área continua lá; gasto intacto.

### Texto da tela ajustado

A promessa *"excluir uma área nunca apaga venda, clique ou evento"* deixou de ser
garantia absoluta — continua sendo o **padrão**. O card de abertura passou a
falar do benefício ("Separe suas operações sem misturar os números") em vez do
mecanismo ("um conjunto de filtros… não separa os dados no banco").

## ⚙️ Bloco 8 — Regras: fundação de SEGURANÇA (29/07/2026, parcial)

Escopo decidido pelo usuário: **o essencial funcionando, sem import/export.**

> ### ⛔ IMPORT/EXPORT DE REGRAS FICOU FORA, de propósito
> O roteiro v2 pedia, mas não havia **nenhuma regra cadastrada** — exportar não
> tinha o que exportar. Pode ser retomado depois: o formato natural é o próprio
> `RuleDTO` em JSON, e a validação crítica na importação é **conta de anúncio
> que não existe nesta conta** (ids são por usuário e não viajam entre contas).

### 🔴 O motor podia escalar orçamento SEM LIMITE

`AJUSTAR_ORCAMENTO` com `{tipo:"percentual", valor:20}` multiplicava o orçamento
a cada execução — 100 → 120 → 144 → 173… — com dinheiro real, e **nada no código
impedia**. Migration `20260729230000` acrescenta `maxBudget`, e o motor agora:

| Situação | Comportamento |
|---|---|
| Aumento **sem** `maxBudget` | **RECUSA** e registra no log |
| `dailyBudget >= maxBudget` | **pula**, sem chamar a Meta |
| Novo valor passaria do teto | **trava no teto** |

**Fail-closed**, igual à autenticação de cron e webhook: ausência de
configuração nunca vira permissão. Recusar aparece no log; aumentar sem limite
só aparece na fatura.

### 🐛 `>=` e `<=` eram tratados como `=` — falha silenciosa

`conditionsMet` cobria só `>` e `<`; o `return` final assumia igualdade. Uma
regra gravada com "maior ou igual" virava "exatamente igual" e **praticamente
nunca disparava**, sem erro em lugar nenhum. Os quatro operadores agora existem
no tipo e no avaliador, e **operador desconhecido não dispara** — numa regra que
pausa campanha, errar para o lado de não agir é o único lado seguro.

### 🐛 O log mostrava `null` nas métricas mais usadas

O `details.avaliado` que eu escrevi lia `e.metrics[metrica]` direto, mas `cpa`,
`roas` e `ctr` são **derivadas** e não existem como chave em `EntityMetrics`.
Agora passa por `metricValue`. Verificado: `{"gasto":380}` em vez de `{"cpa":null}`.

### Janela de execução

`windowStartHour`/`windowEndHour` na **hora local do usuário** (`hourInTz`, nunca
`getHours()` — na Vercel o processo é UTC e "8h–18h" viraria 5h–15h em Brasília).
`start > end` atravessa a meia-noite.

### Log auditável

`AutomationRuleLog.details` passou a ser `{ condicoes, avaliado, aplicado }`:
a expressão avaliada, cada entidade com os **valores reais** das métricas e se
bateu, e o resultado por entidade — incluindo recusas. `listRules` traz 20 logs
(era 5). É o que permite responder "por que a regra não disparou?".

### Testado no banco de DEV (regras criadas e removidas por id)

**16 asserções, 0 falhas.** Condição impossível → `SEM_ACAO` sem pausar nada;
`>=` casa de verdade (2 entidades); log com valor derivado; fora da janela não
avalia; **aumento sem teto recusado antes de chamar a Meta**; **já no teto pula**;
orçamento intacto no banco; limite diário 0 bloqueia; `runUserRules` avalia e
grava log.

> ⚠️ **O motor rodou em produção pela primeira vez em 31/07/2026** — por
> acidente, com o operador da condição invertido. Ele avaliou, selecionou a
> entidade certa (escopo correto, arquivadas fora) e chegou ao caminho de
> PAUSAR. **Se a requisição HTTP chegou a sair depende do ramo "já pausada"**;
> ver "O ENSAIO A SECO DISPAROU". As duas guardas do teto agem ANTES da chamada,
> então seguem provadas. ✅ **O clamp NO teto também foi exercido** em
> 31/07/2026 — ver "O CLAMP FOI EXERCIDO".
>
> ⚠️ Não confunda com `updateDailyBudget`, que **já foi exercido** — pela caneta
> inline, por uso real do usuário. O que falta é o caminho da REGRA: avaliar
> condição e agir sozinha, de madrugada, sem ninguém olhando. É outro caminho de
> código. Ver "Escrita na Graph API: o que já foi exercido".

### ✅ Tela refeita (2ª parte do Bloco 8)

`views/RulesView.tsx` reescrita (autocontida, só recebe a área ativa) +
`views/rules/RuleDrawer.tsx`.

- **Estado vazio** com "Criar regra" centralizado; depois, cards um por regra
  com toggle, produtos, contas, frequência, janela, limite diário, teto,
  resultado da última execução e ações (histórico / editar / duplicar / excluir).
- **Construtor de condições** com "+", `E` explícito entre elas, e remoção
  individual. Os **5 operadores** (`>`, `>=`, `<`, `<=`, `=`).
- **Seleção múltipla** de produtos e contas via `ui/ListaSelecionavel`. Vazio =
  todos. As contas ofertadas são só as da **área ativa**.
- **5 ações**, mapeadas para 3 valores do enum + `actionParams` — sem migration
  de enum. "Definir orçamento" aceita valor absoluto ou **% do gasto**
  (`tipo: "pct_gasto"`, novo no motor, com guarda para valor ≤ 0).
- **Teto obrigatório** na ação de aumentar: o botão Salvar fica desabilitado e o
  campo fica vermelho sem ele — o motor recusaria de qualquer forma, mas
  bloquear na tela evita criar uma regra que nunca agiria.
- **Confirmação em dois passos** para pausar ou mexer em orçamento, em vermelho,
  dizendo que a regra age sozinha pelo cron e que a Meta não desfaz. "Ativar"
  não pede: religar não gasta além do orçamento já configurado.
- **Gaveta de histórico** com a condição avaliada, cada entidade e os **valores
  que a regra viu** (✓/·), mais o resultado por entidade, incluindo recusas.

> ⚠️ **Card avisa quando a regra é inerte.** Regra de aumento sem teto (criada
> pelo formulário antigo) ganha aviso âmbar: sem ele pareceria ligada e
> funcionando, e nunca agiria.
>
> ⚠️ **Duplicar nasce DESATIVADA**, sempre. Duplicar uma regra que pausa
> campanha e já sair rodando dobraria a ação sem ninguém pedir.
>
> ⚠️ **"Sem limite" grava 9999, não 0.** O motor bloqueia quando
> `runsToday >= dailyRunLimit`, então `0` significaria "nunca roda".

**Zero `<select>` nativo nas duas telas novas** — usam `ui/Select` (Bloco 3) e o
novo **`ui/Checkbox`**, para a padronização visual não precisar refazê-las.
`globals.css` ganhou a variante **`.btn-danger`** (ação destrutiva sempre em
vermelho).

**Mais 6 asserções** (múltiplas condições): E com duas verdadeiras bate; **uma
falsa derruba o E**; log mostra as duas métricas (`{"gasto":380,"vendas":0}`);
**lista de condições vazia não dispara**; `<=` funciona. Total do Bloco 8: **22
asserções, 0 falhas**.

### ⚠️ Dívida criada: form de regra morto no `useTraffikState`

O `ruleForm` e os ~37 handlers dele (`onRuleName`, `addRule`, `runRules`…)
ficaram **sem consumidor** — a `RulesView` não recebe mais `v`. Some junto da
faxina do nav morto (dívida #2).

## 🎯 Sessão 4 — banner de pendências e FONTE ÚNICA (29/07/2026)

O assistente de 5 passos foi **descartado**: com o modal simplificado da Sessão 3
e a configuração acontecendo dentro da área, 4 dos 5 passos ficaram redundantes
e o `returnTo` do OAuth já havia sido entregue na Sessão 2. Sobrou um item de
valor real — o **banner de pendências** —, e o onboarding de primeiro acesso foi
cortado (`garantirAreaPrincipal` já impede estado quebrado, então era orientação,
não correção).

### 🎯 `getPendenciasDaArea` é a fonte ÚNICA

Três telas fazem a mesma pergunta — "o que falta configurar aqui?":

| Tela | Antes | Agora |
|---|---|---|
| Banner do Dashboard | não existia | `getPendenciasDaArea` |
| Cards de `/dashboard/areas` | função local lendo `Workspace.accountIds` | idem |
| Integrações › Testes | `getInstallChecklist` | idem (é a base) |

> ### 🐛 A divergência já estava PRODUZINDO card errado
> A função local da tela de Áreas lia `a.accountIds` / `a.webhookIds` — os arrays
> que a Sessão 1 substituiu por FK. Um webhook criado **dentro** da área grava a
> FK e não o array, então o card dizia **"Sem webhook"** para uma área com
> webhook vinculado. Duas fontes para a mesma pergunta divergem sempre; agora há
> uma, e as telas só a apresentam de formas diferentes.

> ⚠️ **A Principal nunca mostra banner.** Ela é o catch-all e é o estado normal
> de quem tem uma operação só — aviso permanente vira ruído que se aprende a
> ignorar, inclusive quando muda de texto. Quem decide isso é o **servidor**
> (`faltando: []` para a principal), não o componente.

A dispensa fica em `localStorage`, **por id de área**: dispensar em B não esconde
o aviso de C. Não vai para o banco de propósito — é preferência de tela.

### 🐛 A aba UTMs se contradizia por um deploy

A Sessão 2 pôs um aviso dizendo *"este script é o mesmo em todas as áreas"*; a
Sessão 3 reverteu a decisão e adicionou o aviso oposto no bloco de Scripts —
**sem remover o primeiro**. A tela afirmava as duas coisas ao mesmo tempo.
O da Sessão 2 saiu.

> ⚠️ Se o script voltar a ser global, o aviso volta ao topo da view **e sai do
> `ScriptsBlock`** — nunca os dois.

### 🐛 O teste de regressão passou a dar FALSO VERDE

`teste-atribuicao-areas.mjs` escolhia o backup com `.sort().pop()` sobre os
nomes. No dia em que apareceu um backup de **dev**, o ref `drdf…` passou a
ordenar depois de `dgao…` e o teste rodou contra 8 registros sintéticos,
reportando *"0 de 8 vendas perdidas"* — como se o bug que ele existe para
detectar nunca tivesse existido.

Agora ele filtra os refs de dev **perguntando ao `guard-db.mjs`** (fonte única
do que é dev), ordena pela data no nome, **imprime o projeto no cabeçalho** e
**aborta** se não houver backup de produção.

> ⚠️ **Teste que escolhe o próprio dado sozinho precisa dizer qual escolheu.**
> Silencioso, ele troca de significado quando a pasta muda — e falso verde é
> pior que vermelho.

### 🐛 `npm run backup` fez backup do banco ERRADO

`backup-db.mjs` resolve `DIRECT_URL || DATABASE_URL`. Exportar só
`DATABASE_URL=<produção>` no shell deixava o `DIRECT_URL` do `.env` (dev)
vencendo — e o backup saiu do banco falso, com a saída imprimindo o ref certo
que ninguém leu. Hoje a divergência **aborta** e sugere `--url`.

```powershell
npm run backup -- --url '<connection string de producao>'
```

**Verificação:** `npm run test:areas` → **26 asserções, 0 falhas** contra o
backup real. `tsc --noEmit` e `next build` limpos.

> ⚠️ **Não verificado visualmente:** o banner não foi conferido em navegador —
> a produção só tem a área Principal, que por desenho não mostra banner. Ele
> aparece ao criar a primeira área secundária.

## 🧭 Sessão 3 — criar área ficou vazio, produto virou descoberta, script por área (29/07/2026)

### 1. Criar área NÃO pede vínculo nenhum

O modal pede **nome, cor e descrição**. Nada mais. A área nasce **zerada**.

> ### ⛔ Não devolva os seletores para a criação
> A tela antiga mandava escolher contas, webhooks, produtos e pixels de uma
> lista do que já existia — isso é um **seletor de filtros**, não a criação de
> uma operação. E era um beco: numa oferta nova **não há o que selecionar**, e o
> texto mandava o usuário para fora ("conecte um perfil em Integrações").
>
> A configuração acontece **DENTRO da área**, pela própria sidebar, como na
> Principal — e desde a Sessão 2 o que se cria lá já nasce vinculado a ela.
>
> Na **edição** sobra só a conta de anúncio, porque é a única dimensão em que
> "mover entre áreas" é operação real (uma conta pertence a exatamente uma área).

### 2. Produto virou DESCOBERTA — nunca configuração

`produtosDescobertos()` agrega as vendas **já atribuídas** por área e devolve
produto, nº de vendas e faturamento. O card mostra os 5 maiores.

- A ferramenta **só conhece um produto depois que ele vende** — pedir para
  escolher numa oferta nova era um campo sem opção.
- O nome é texto livre do gateway: renomear lá fazia o filtro parar de casar
  **em silêncio**. Agora **aparece como produto novo na lista**, sem quebrar
  nada — o vínculo real nunca foi o texto.
- `Workspace.products`/`sources` saíram da UI, do DTO de opções e de todo filtro.
  Continuam no schema só pela regra dos dois deploys.
- Só o faturamento de venda **APROVADA** entra, para não divergir do KPI.

### 3. 🔗 Script de UTM POR ÁREA — decisão revertida, e é ADITIVA

Antes o script era global. Agora ele embute `WS` e manda `ws` no payload;
`/api/track/click` **valida a posse** e grava `Click.workspaceId`
(migration `20260729210000`, nullable).

> ### ⛔ O script NÃO vence a conta de anúncio
> Precedência do clique: **conta → área do script → Principal**.
>
> Se o script vencesse, um anúncio da conta da Área A levando tráfego para a
> página da Área B faria o clique contar em B **enquanto o gasto fica em A** —
> A com gasto sem visita, B com visita sem gasto. **As duas erradas**, mesmo
> motivo pelo qual a conta vence o webhook.
>
> ⚠️ **Alcance real:** para tráfego PAGO o script não muda nada — já era
> separado pela campanha. O ganho é no tráfego **não atribuível** (orgânico,
> direto, outros canais), que antes caía todo na Principal independentemente da
> página visitada.

**Por que é aditivo — os cinco vetores, checados:**

| Vetor | Resultado |
|---|---|
| Script antigo → rota nova | não manda `ws` → coluna NULA → `Click` idêntico ✅ |
| Script novo → rota antiga | a rota lê **só chaves conhecidas**; `ws` é ignorado ✅ |
| Campo obrigatório novo | nenhum — `account` segue sendo o único ✅ |
| Identificador mudando de sentido | nenhum — `ACCOUNT` e o `click_id` são os mesmos ✅ |
| Dado histórico | nenhum clique muda de área (todos NULOS) ✅ |

O vetor 2 dá folga real: **script e rota podem subir em qualquer ordem**. A
única disciplina é a de sempre: **migration antes do deploy**.

**Na venda**, `Click.workspaceId` entra logo depois da conta e **antes do
webhook**: é evidência daquela compra específica, e o webhook é regra do
gateway inteiro.

**Consequências operacionais aceitas:** só vale depois de reinstalar o script;
uma página = uma área; o `Workspace.id` aparece no HTML do cliente (sem risco
novo — o endpoint já é público por desenho e a posse é validada no servidor).

**`npm run script:onde`** lista, por área, se o script já foi reinstalado
(cliques carimbados) e por quais páginas o tráfego dela entrou.

A aba UTMs mostra o script **da área ativa**, com o nome dela no título, e uma
**faixa âmbar** quando a área secundária ainda não tem clique carimbado.

### Testes

`npm run test:areas` — **26 asserções, 0 falhas** contra o backup real. As 6
novas cobrem: clique sem campanha + script → área do script; o mesmo clique sem
script → Principal (comportamento antigo); clique com campanha → a **conta
vence**; `ws` inválido descartado; e a partição continua exata com metade dos
cliques carimbados.

## 🗂️ Sessão 2 — telas de configuração escopadas por área (29/07/2026)

`src/lib/areas/escopoConfig.ts` — **separado da precedência de propósito**, são
perguntas diferentes: "de quem é esta VENDA?" exige a cadeia de precedência
(a venda chega por atribuição); "de quem é este WEBHOOK?" é uma FK e pronto.
Por isso aqui é uma consulta leve, não o mapa de 6 consultas.

| Tela | Escopo |
|---|---|
| Integrações › **Anúncios** | contas da área; perfil sem conta na área não aparece |
| Integrações › **Webhooks** | os da área; criar nasce vinculado |
| Integrações › **Pixel** | os da área; criar nasce vinculado |
| Integrações › **Testes** | checklist da área |
| **Regras** | feito na Sessão 1 (tela + motor juntos) |
| **Taxas e Despesas** | globais + as da área |
| Integrações › **UTMs** | ⚠️ **global, de propósito** |

> ### ⚠️ A Principal é catch-all TAMBÉM na configuração
> `workspaceId` NULO = "sem dono". Se a Principal filtrasse por
> `workspaceId = principal.id`, todo webhook e pixel existente (que a migration
> deixou NULO de propósito) ficaria **invisível na tela enquanto continuaria
> funcionando no servidor** — o pior tipo de bug. Mesma lógica do dashboard.
>
> ⚠️ **Despesa é a exceção**: NULO = "vale para todas as áreas", não "sem dono".
> A lista SEMPRE inclui as nulas, inclusive numa área secundária.

> ### 🔄 Trocar de área precisa de `router.refresh()`
> `trocarWorkspace` só invalidava dashboard/gerenciador/criativos (rotas
> `/api/*`). As listas de configuração vêm do **layout no servidor**, então
> Integrações e Taxas continuariam mostrando a área ANTERIOR.
>
> A troca acontece em dois tempos: estado local imediato (contexto não espera
> rede) e, **depois de o `setLastWorkspaceId` resolver**, `router.refresh()`.
> ⚠️ Os dois em paralelo recarregariam o servidor com a área velha.

> ### 🔐 OAuth do Facebook carrega a área em COOKIE, não no `state`
> `/api/auth/facebook?ws=<id>` grava `fb_oauth_ws` httpOnly. O `state` volta do
> Facebook e é atacável — e já tem a função de anti-CSRF. O callback ainda
> **valida a posse** da área pelo `userId` antes de vincular qualquer conta.
>
> ⚠️ **Só as contas CRIADAS agora nascem na área.** Reconectar um perfil não
> pode arrastar em silêncio uma conta que já pertence a outra área — as
> existentes ficam onde estão.

> ### ⚠️ UTMs continua GLOBAL — e o aviso é redigido pela consequência
> O script embute o `userId` e é único por conta, por desenho: torná-lo por área
> quebraria todo script já instalado (regra permanente — nenhum identificador
> emitido muda de significado). A aba avisa *"este script é o mesmo em todas as
> áreas; quem separa é o `utm_campaign` (`nome|id`), que vem da campanha na
> Meta"* — o que a pessoa precisa saber, não por que a arquitetura é assim.

**Só a despesa RECORRENTE oferece "só nesta área".** Taxa de gateway e imposto
não têm a caixa: são globais por natureza, e oferecer a escolha convidaria a
prender justamente o que, se prendido, some da conta de lucro das outras áreas
em silêncio. Padrão de tudo: global.

**Testado contra o banco de dev — 10 asserções, 0 falhas** (área secundária real
criada e removida por id): webhook e pixel da B só aparecem na B; a Principal
traz os de `workspaceId` NULO; imposto global aparece nas duas áreas; despesa da
B só na B; `ws` forjado, ausente e de área arquivada caem na Principal. Mais as
19 da Sessão 1, que seguem passando.

### ⚠️ Não feito na Sessão 2

- **Mover webhook/pixel entre áreas pela tela** — só contas de anúncio têm
  "Mover para cá" (na tela de Áreas). Para os demais, a FK existe e é editável
  no banco, mas não há UI.
- **`listTrackedProducts`** (produtos do seletor de Purchase do pixel) continua
  global — vira descoberta por área na Sessão 3.
- **Logs de webhook** (aba Testes) continuam globais.

## ⛔ ATRIBUIÇÃO POR ÁREA — precedência (Sessão 1 de 5, 29/07/2026)

**A área deixou de ser um conjunto de filtros e passou a ser uma pergunta:
"de quem é esta linha?"** — que sempre tem exatamente uma resposta.

### Por que o modelo de filtros foi abandonado

As dimensões eram aplicadas em **AND** no `where` do Prisma. Isso tem duas
falhas que nenhuma escolha de dimensão conserta:

- uma linha podia **não casar com área nenhuma** e sumir do produto inteiro;
- uma linha podia **casar com duas** e ser contada em dobro.

Medido contra o backup real de produção: com a conta e o webhook numa área
secundária, **12 de 14 vendas ficavam invisíveis nas duas áreas** — faturamento
real, respondido com 200, fora de toda tela. É o mesmo `12 de 14` do incidente
de 29/07, agora reproduzido por teste automatizado.

### A ordem (`src/lib/areas/precedencia.ts`)

| # | Critério | Vale para |
|---|---|---|
| 1 | **Conta de anúncio** (`Click.utmCampaign → Campaign → AdAccount`) | venda, clique, evento |
| 2 | **Desempate por produto** (`Workspace.produtosDesempate`) | venda |
| 3 | **Webhook** dono | venda |
| 4 | **Credencial de API** dona | venda |
| 5 | **Pixel** dono | evento |
| 6 | **Principal** (catch-all) | tudo |

> ### 🔴 A CONTA DE ANÚNCIO VENCE O WEBHOOK. Não inverta.
> Venda que chega por um webhook da Área A mas foi atribuída a um clique de
> conta da Área B **entra na B**.
>
> 1. **O custo não é negociável.** O gasto da conta vai para a área dela por FK.
>    Separar receita de custo quebraria **as duas** áreas ao mesmo tempo: uma com
>    faturamento sem custo, a outra com custo sem faturamento (ROI em −1,00x).
> 2. O webhook é explícito sobre o **gateway**, não sobre a venda. Um gateway é
>    compartilhável; uma campanha não.
> 3. O erro fica **visível**: a venda aparece na área da campanha e o usuário
>    corrige. Com o webhook vencendo, nasce um ROAS fantasma que nada denuncia.

> ### ⚠️ O desempate por produto vem ANTES do webhook — e por quê
> O plano o colocava depois, como desempate de "webhook ambíguo". Trocar
> `Workspace.webhookIds` (array) por `Webhook.workspaceId` (FK) tornou a
> ambiguidade **estruturalmente impossível** — uma coluna não comporta dois
> donos —, então um desempate que só agisse na ambiguidade nunca dispararia.
>
> O caso de borda real continua: **gateway com URL única vendendo duas ofertas**.
> Regra mais específica vence a mais geral, como em qualquer roteamento.
>
> ⚠️ **Produto renomeado no gateway** faz o desempate parar de casar, e a venda
> cai no **dono do webhook** — não na Principal. Mandar para a Principal levaria
> junto todas as vendas legítimas daquele webhook e esvaziaria uma área que
> funcionava. Quem impede o erro silencioso é o **aviso** na tela de áreas.

> ### 🔐 `mapa.areaValida()` é o ÚNICO ponto de validação de posse
> Recebe o `?ws=` cru e devolve sempre uma área que existe, é deste usuário e
> não está arquivada — caindo na Principal quando não é. **Nunca devolve "sem
> área"**, que era o `{}` do modelo antigo e significava "não filtra nada".
> Verificado em runtime: `ws` ausente, vazio e forjado devolvem os mesmos
> números da Principal.

### Configuração PERTENCE à área (migration `20260729180000`)

`workspaceId` **nullable** em `AdAccount`, `Webhook`, `PixelConfig`,
`AutomationRule`, `Expense` e `ApiCredential`; mais `Sale.apiCredentialId`,
`Workspace.produtosDesempate` e `User.onboardingCompletedAt`.

- **Tudo aditivo.** Nenhum `DROP`, `NOT NULL` ou `RENAME` — o build antigo em
  produção continua funcionando (lição da `20260728120000`).
- **Todas as FKs `ON DELETE SET NULL`, nunca `Cascade`.** Excluir uma área não
  pode apagar webhook nem pixel: a URL já está no painel do gateway e o script
  já está no site do cliente. Eles voltam para a Principal.
- **O backfill preenche SÓ as áreas secundárias.** A Principal fica **NULL** e
  segue catch-all. Preenchê-la com uma lista de inclusão foi exatamente o que
  zerou o dashboard em produção.
- **`AdAccount.workspaceId` é FK, não array**: "uma conta, uma área" virou
  garantia **estrutural** em vez de checagem em código.

> ### 🔴 `Expense.workspaceId` NULO = vale para TODAS as áreas
> Taxa de gateway e imposto são globais por natureza. Migrá-los "para a
> Principal" faria toda área secundária calcular lucro **sem imposto nenhum** —
> e o número continuaria parecendo plausível. O backfill mantém NULO.

> ### 🔴 REGRAS: escopar o motor e esconder da tela andam JUNTOS
> `AutomationRule.workspaceId` nulo = regra global, e ela **aparece em toda
> área** de propósito (ela realmente age sobre as campanhas de todas). Regra de
> uma área só aparece nela — e `rules/engine.ts` **intersecta as contas-alvo com
> as contas da área antes de agir**.
>
> Esconder da tela sem escopar o motor seria o pior dos dois mundos: uma regra
> da Área A pausando campanha da Área B, invisível de B, mexendo em orçamento
> real. **Se um dia só um dos dois couber, deixe a regra aparecendo em todas as
> áreas — nunca deixe o motor desescopado.**

### Testes

`npm run test:areas` — **19 asserções, 0 falhas**, contra o backup REAL de
produção (221 cliques, 24 vendas, 42 eventos). Só leitura, sem conexão de banco:
`scripts/alias-loader.mjs` resolve o alias `@/` para o Node rodar o código do
`src/` sem duplicá-lo.

| Cenário | Resultado |
|---|---|
| Pós-migração, nada configurado | 221/221 · 14/14 · 42/42, tudo na Principal — **nenhum número muda** |
| Com área secundária | 221/221 · 14/14 · 42/42 (108 cliques + 2 vendas na secundária) |
| Modelo ANTIGO, mesma config | **12 de 14 vendas invisíveis** |
| Precedência conta > webhook | ✓ |
| Desempate por produto / produto renomeado | ✓ / degrada para o webhook |
| Área arquivada | devolve as linhas para a Principal |

Mais a verificação ponta a ponta contra o banco de **desenvolvimento**, com uma
área secundária real: `B (fat 985,00 · gasto 420,00) + Principal (1.994,00 ·
380,00) = TOTAL (2.979,00 · 800,00)` — **partição exata em faturamento, gasto,
vendas e cliques**. Área de teste removida por id.

### O que saiu

`filtrosDaArea`, `FiltrosDaArea` e todo o `lib/ads/escopo.ts` (`filtroEfetivo`,
`escopoExcluindo`, `carregarEscopoContas`). O arquivo continua existindo só com
o aviso de não reintroduzir. O selo *"Área X · dados isolados"* saiu do Header —
o seletor da sidebar já mostra a área ativa em toda tela.

### ⚠️ Ainda NÃO feito (Sessões 2 a 5)

- **Sessão 2** — Integrações, Regras e Taxas escopadas na tela; criação já
  nascendo vinculada à área; aviso na aba UTMs.
- **Sessão 3** — produto vira DESCOBERTA: remover `Workspace.products` da
  criação, listar produtos descobertos com vendas e faturamento.
- **Sessão 4** — assistente de 5 passos + `returnTo` no OAuth + rascunho.
- **Sessão 5** — onboarding de primeiro acesso + banner de pendências.
- `Workspace.accountIds`/`webhookIds`/`pixelConfigIds`/`products` **continuam no
  schema sem uso** — só saem depois que a produção rodar este código (dois
  deploys).

## 🔌 ARQUITETURA UNIVERSAL DE GATEWAYS (30/07/2026 — etapa 1 de 8)

`src/lib/gateways/` é a camada por onde passa **toda** venda que entra na
ferramenta, venha de qual gateway vier.

```
lib/gateways/
  contrato.ts        VendaNormalizada, Capacidades, GatewayDef  ← LEIA PRIMEIRO
  campos.ts          pick/toStr/toNumber/comoLista/fbclidDoFbc
  registro.ts        REGISTRO — um gateway = uma entrada
  autenticar.ts      estratégias plugáveis (segredo, HMAC)
  receber.ts         receptor único: log → auth → parse → ingestão
  parsers/{kirvano,generico}.ts
```

### ⛔ Como adicionar um gateway novo — o roteiro completo

1. **`parsers/<nome>.ts`** — uma função `parse(payload) → { vendas: [] }`.
2. **Uma entrada em `REGISTRO`** — auth, capacidades, URL, campos, instalação.
3. **`public/logos/<nome>.webp`** (e a chave em `ui/LogoGateway`).
4. **Um payload de exemplo** em `exemplos`, para o testador.
5. **Rodar o payload real no testador** (Integrações › Testes) e conferir que
   **não sobrou nada em âmbar**.

> ### 🔴 O passo 5 não é opcional — é onde o parser errado se denuncia
> O testador tem três estados por campo, e o terceiro é a razão de ele existir:
>
> | Estado | Significa |
> |---|---|
> | **lido** (verde) | o parser extraiu o valor |
> | **o gateway não enviou** (cinza) | não há nada parecido no payload |
> | 🔴 **está no payload e não foi lido** (âmbar) | o dado VEIO, com outro nome, e o parser o descartou |
>
> Campo vazio parece igual nos dois últimos casos. Sem o âmbar, um gateway que
> manda o IP como `buyer_ip_address` (em vez de `customer.ip`) passaria como
> "não envia IP" — e a geolocalização de todas as vendas dele viraria estimativa
> sem ninguém saber por quê.
>
> **Âmbar sobrando = parser incompleto.** Corrija antes de conectar em produção.
>
> ⚠️ Confira também o bloco "O que este gateway entrega": *"veio, mas não estava
> previsto"* é sempre erro do **registro** — a capacidade declarada está mentindo
> para o usuário na tela.

**Nada mais.** Nem rota, nem `ingestSale`, nem métrica, nem tela. Se um gateway
novo exigir mexer em qualquer um desses, a arquitetura regrediu — o critério não
é "o código está bonito", é **quantos arquivos eu toco**.

> ⚠️ **NÃO crie rota para gateway novo.** `/api/webhook/sale/{token}` é o
> receptor universal: o token identifica o webhook, o webhook diz a plataforma, o
> registro diz o resto. A rota `/api/webhook/kirvano?id=` existe **só** porque
> aquela URL já está colada no painel do usuário — é alias de 3 linhas, e é a
> única exceção que jamais deve ganhar companhia.

### As 3 regras do contrato — as três já custaram caro em outro lugar

| | Regra | O que ela evita |
|---|---|---|
| 1 | **Ausência é `null`, nunca `0`** | `taxaGateway: 0` afirma "não cobrou"; `null` diz "não sabemos" e cai na taxa cadastrada. Colapsar as duas faz o líquido aparecer maior que a realidade, plausível e falso |
| 2 | **Reprocessar nunca degrada dado derivado** | `country`/`countrySource` e `clickId`/`matchMethod` só podem ser sobrescritos por fonte **igual ou mais forte**. Reprocessar com o IP já purgado pioraria o país já resolvido |
| 3 | **`parse` devolve sempre uma LISTA** | order bump e upsell existem em quase todo gateway; quem assume "1 payload = 1 venda" quebra em silêncio, com faturamento certo e contagem inflada |

> ⚠️ A **regra 2 está declarada no contrato mas ainda não implementada** — é a
> etapa 2. Hoje o `ingestSale` tem uma versão parcial (`...(country ? {} : {})`)
> que protege contra apagar com `null`, e **não** contra sobrescrever com fonte
> mais fraca.

### 🎛️ Capacidades são DADO, não `if`

Gateways diferem no que entregam, e a diferença é declarada ao lado do parser:
`ipDoComprador`, `fbc`, `fbp`, `utms`, `taxasCalculadas`, `comissoes`,
`telefone`, `agrupaItens`, `reentregaEventos`.

É o que permite a tela avisar **antes** — "este gateway não informa o endereço do
comprador, então o país destas vendas é estimado" — em vez de o usuário descobrir
olhando um mapa errado. Um `if (plataforma === "CAKTO")` na ingestão é exatamente
o que faz o décimo gateway custar caro.

> ⚠️ **As capacidades da Kirvano foram medidas nos 64 payloads REAIS**, não lidas
> na documentação — e duas contrariaram a suposição: ela **manda `fee` e o bloco
> `fiscal`** (36 de 46 eventos) e **manda `cookies.fbp`** (45 de 46). Os dois
> estavam sendo descartados pelo parser. Ela **não** manda `fbc`.

### Prova de paridade — `npm run test:gateways`

`scripts/fixtures/parsers-esperado.json` congela a saída do código ANTIGO sobre
**167 payloads reais de produção** (115 `WebhookLog` + 26 `Sale.rawPayload`). O
teste compara a camada nova contra ele: 31 asserções, 0 falhas.

> ⛔ **Nunca regenere o snapshot para "fazer o teste passar".** Ele existe para
> recusar isso. `snapshot-parsers.mjs` exige `--aceitar` escrito no comando, pela
> mesma razão do `ALLOW_PROD_WRITES`: atalho curto vira hábito.

E `npm run test:receptor` prova que a camada está **sendo exercida**, não só
compilando: 13 asserções em HTTP real contra o dev server (banco de DEV, limpeza
por id no fim). Ver o PROCEDIMENTO OBRIGATÓRIO — `tsc`, `lint` e `build` passam
com a coisa desligada.

### ⏱️ Orçamento de 5 segundos

A Cakto considera **falha de entrega** acima de 5 s. Medido: **~318 ms** aquecido
no caminho de recusa (2 idas ao banco), ~700 ms no caminho completo.

> ⚠️ A folga existe porque a CAPI do Facebook e as notificações rodam no
> `after()` do Next 16. **Chamada HTTP nova no caminho síncrono** devolve dois
> problemas de uma vez: estoura o orçamento do gateway e segura conexão do pool,
> alongando a janela de disputa entre eventos concorrentes.

### Etapa 2 — precedência de fonte e dois bugs de status

**A REGRA 2 saiu do papel** (`lib/gateways/fontes.ts`): a força da procedência
entra no `WHERE` do `UPDATE`, em instrução separada da do status. São perguntas
diferentes — "este evento é mais novo?" × "esta inferência é melhor?" — e um
evento pode responder sim a uma e não à outra.

> 🐛 **Bug que já existia:** o upsert fazia `...(match.clickId ? {...} : {})`,
> que protege contra apagar com `null` e **não** contra sobrescrever com fonte
> mais fraca. Um segundo evento casando por `ip` num clique DIFERENTE substituía
> um match `direct`. A venda passava a apontar para outro visitante — e daí saem
> país, campanha e atribuição.

**Fonte desconhecida vale 0**, o mínimo. Esquecer de cadastrar nunca amplia
permissão de escrita — mesma regra da autenticação: a dúvida vira bloqueio.

#### 🔴 PIX vencido e carrinho abandonado inflavam "Vendas pendentes" em 67%

Medido na produção: **13 das 14 vendas pendentes estavam erradas.**

| | Vendas | Valor |
|---|---|---|
| Exibido | 14 | R$ 512,35 |
| PIX vencido (`PIX_EXPIRED`) | 12 | R$ 317,65 |
| Carrinho abandonado | 1 | R$ 24,90 |
| **Pendente de verdade** | **1** | **R$ 169,80** |

`PIX_EXPIRED` não estava no mapa e caía num fallback que só reconhecia
`"APPROVED"` — virava PENDENTE apesar de o payload dizer `status: "CANCELED"`.

> ### ⚠️ A correção que importa NÃO foi acrescentar o evento ao mapa
> Foi trocar o fallback pelo `statusPeloTexto()`. Tentar adivinhar a lista
> completa de eventos de um gateway é uma corrida que se perde sempre; ler o
> campo de situação, que o gateway preenche de qualquer jeito, faz o **próximo**
> evento desconhecido cair no lugar certo em vez de virar "pendente" por omissão.

**Migration `20260730220000`** acrescenta `EXPIRADA` e `ABANDONADA`.

> ### ⛔ Por que NÃO reusar CANCELADA para o PIX vencido
> Ela é **terminal** (força 4), e o dado real traz a sequência
> `PIX_GENERATED → PIX_EXPIRED → PIX_GENERATED` no MESMO pedido: o cliente volta
> a tentar. Com status terminal, o `SALE_APPROVED` seguinte não conseguiria
> sobrescrever e **a venda paga sumiria do faturamento**. Perder receita para
> consertar um KPI seria péssimo negócio.
>
> A escala virou `ABANDONADA 0 < PENDENTE 1 < EXPIRADA 2 < APROVADA 3 < terminais 4`.
> EXPIRADA acima de PENDENTE impede que a reentrega do `PIX_GENERATED` antigo
> ressuscite o PIX vencido; abaixo de APROVADA garante que pagar corrige tudo.
>
> ⚠️ **Custo consciente:** quem gera um PIX NOVO depois do vencimento fica
> exibido como EXPIRADA até pagar. Erra para o lado de *subnotificar* pendente —
> o oposto do bug — e o faturamento sai certo nos dois casos.

> ### ⚠️ `gerouCheckout` existe porque separar os status quase apagou o funil
> `checkoutEvent.ts` decidia por `status === "PENDENTE"`. Com o carrinho
> abandonado virando ABANDONADA, ele deixaria de gerar `InitiateCheckout` — o
> funil encolheria como efeito colateral **invisível** de uma correção de KPI.
> Hoje quem decide é o EVENTO, declarado pelo parser no contrato.

#### `npm run backfill:status` — simula por padrão

> ### ⚠️ A guarda óbvia estava ERRADA, e só rodar contra linhas reais mostrou
> A primeira versão recusava qualquer rebaixamento (`FORCA[novo] <= FORCA[atual]`)
> — e `PENDENTE → ABANDONADA` **é** um rebaixamento, ou seja, ela vetava
> exatamente a correção que existe para fazer.
>
> A guarda certa é outra: no upsert em tempo real dois EVENTOS disputam a linha
> e o mais avançado vence; no backfill é o MESMO evento relido por um parser
> corrigido. O que sobra a proteger é o que custaria caro perder — venda
> **APROVADA** e os terminais, cujo status veio de mapeamento explícito e nunca
> do fallback quebrado.
>
> Provado no dev com os 4 casos semeados: PIX vencido → EXPIRADA, carrinho →
> ABANDONADA, PIX gerado **fica** PENDENTE, e a venda APROVADA **não é tocada**.

### Etapa 3 — CONVERSÃO ≠ ITEM VENDIDO

**Migration `20260730230000`**: `Sale.pedidoId` (nullable) + `Sale.itemTipo`
(default `"principal"`) + índice `(userId, pedidoId)`.

`lib/pedidos.ts` é a fonte única. As duas contagens existem e respondem a
perguntas diferentes:

| Pergunta | Conta |
|---|---|
| Quanto faturei? | **linhas** — 90 + 27 = 117 |
| Quantas conversões tive? | **pedidos** — 1 |
| CPA, taxa de aprovação, funil | **pedidos** |
| Ticket médio | faturamento ÷ **pedidos** (é o valor do carrinho) |
| Vendas por produto | **linhas** — ali o item é o assunto |

Medido com 1 checkout com order bump + 1 simples (3 linhas, 2 compradores):

| | contando ITENS | contando PEDIDOS |
|---|---|---|
| Vendas | 3 | **2** |
| CPA | R$ 100,00 | **R$ 150,00** |
| Ticket médio | R$ 72,33 | **R$ 108,50** |
| Faturamento | R$ 217,00 | R$ 217,00 |

**O CPA aparecia 33% mais barato que a realidade** — e o número parecia
plausível, que é o que torna esse erro caro.

> ### ⛔ Contagem e soma no MESMO laço, nunca `umPorPedido` onde há valor
> A primeira versão trocou `for (const s of approved)` por
> `for (const s of umPorPedido(approved))` nos laços de país, hora e dia. Isso
> corrige a contagem e **descarta o faturamento do order bump** — o gráfico
> deixaria de bater com o KPI de faturamento.
>
> Onde o laço soma valor, ele percorre TODAS as linhas e incrementa a contagem
> só no primeiro item de cada pedido. `umPorPedido` só serve onde não há soma
> (taxa de aprovação).

> ### ⚠️ `pedidoId` NULO é o que preserva o histórico
> `chaveDoPedido()` cai no próprio `id`: venda anterior à migration é o próprio
> pedido, exatamente como antes. Sem esse fallback, todas colapsariam num balde
> `null` e o CPA histórico explodiria.

> ### 🐛 Faltou o `pedidoId` no `select` — e a contagem voltou a ser por item
> Com a coluna fora do `select`, `chaveDoPedido` cai no `id` e **tudo volta ao
> comportamento antigo, em silêncio**, com o número parecendo plausível. Foi
> pego pelo teste ponta a ponta; nenhum `tsc`/`lint`/`build` acusaria.
>
> Vale para os três consumidores: `dashboard/metrics.ts`, `ads/overview.ts` e
> `ads/creatives.ts`.

> ### ⚠️ O `Set` de pedidos é POR DESTINO, não global
> No Gerenciador a mesma venda é atribuída a uma campanha **e** a um anúncio. Um
> conjunto único faria a segunda atribuição ser descartada, zerando a coluna de
> vendas no nível de anúncio.

**`checkoutEvent` deduplica por `gw:<pedidoId>`.** Com a chave por item, um
checkout com bump geraria N `InitiateCheckout` para o mesmo carrinho, inflando o
topo do funil e derrubando a taxa de conversão.

> ⚠️ **A Kirvano continua sendo 1 linha por venda**, e é o correto: o order bump
> dela vem dentro de `products[]` (com `is_order_bump: true`), na MESMA venda.
> Separar em linhas exigiria mudar o `externalId` para `<sale_id>:<offer_id>` — e
> mudar identificador já emitido faria o upsert criar linhas NOVAS ao lado das
> existentes. O custo aceito: os produtos de bump da Kirvano não aparecem em
> "Vendas por produto". Quem gera N linhas é a Cakto, cujos itens já vêm com id
> próprio.

> ### 🕐 O teste tropeçou no bug de fuso que o projeto documenta
> Ele semeava o gasto com `CURRENT_DATE`, que é o dia do BANCO (UTC). Rodando às
> **00h01 UTC = 21h01 em Brasília**, o gasto caiu no dia seguinte e o CPA veio 0.
> É a janela exata descrita em "Fuso horário — causa raiz". Hoje semeia com
> `(now() AT TIME ZONE 'America/Sao_Paulo')::date`.
>
> **Nenhuma agregação usa o dia do processo — e nenhum teste deveria semear com ele.**

### Etapa 4 — taxa REAL do gateway vence a cadastrada

**Migration `20260731000000`**: `Sale.taxaGateway` e `Sale.coproducao`, ambas
`Decimal?`. A Kirvano manda `fee` e o bloco `fiscal` em 36 de 46 eventos reais;
a Cakto manda `fees` e `commissions[]`. Tudo isso era descartado, e o desconto
saía de uma taxa **média** cadastrada à mão.

> ### 🔴 PERÍODO MISTO É O CASO NORMAL — e a tela é obrigada a dizer
> Basta ter dois gateways, ou um que só informe a taxa em parte dos eventos.
> Um Faturamento Líquido que soma **medida com estimativa sem dizer qual é
> qual** é pior que não ter o dado: parece exato e não é. Exigência explícita do
> usuário em 31/07/2026.
>
> Por isso a procedência vive no **rótulo do card**, não só no tooltip:
>
> | Situação | Rótulo |
> |---|---|
> | Todas as vendas informaram | "taxa informada pelo gateway" |
> | **Misto** | **"taxa real em 12 de 30 vendas"** |
> | Nenhuma informou | "após taxas e impostos" (como antes) |
>
> `Composicao.fontes` devolve `{ real, estimado, vendasComValorReal,
> vendasSemValorReal }` por desconto. **Não remova esse campo** — sem ele a tela
> volta a exibir um número de fonte mista sem procedência.

> ### ⛔ A base da taxa cadastrada ENCOLHE, senão desconta duas vezes
> Com 2 vendas de R$ 100, uma informando R$ 7,50 e a outra não, o desconto é
> `7,50 + 5% de 100 = 12,50`. Se a base continuasse sendo o faturamento inteiro
> daria `7,50 + 10,00 = 17,50` — cobrando taxa duas vezes da venda que já
> informou a própria.

> ### ⚠️ NULO ≠ ZERO, e é aqui que custa dinheiro
> `NULL` = o gateway não informou → usa a taxa cadastrada.
> `0` = ele informou que não cobrou → desconta nada.
> Colapsar os dois faz o líquido aparecer MAIOR que a realidade. É a REGRA 1 do
> contrato de gateways, agora no schema.

> ### ⚠️ A comissão do PRODUTOR fica de fora da coprodução
> Ela é o que sobra para o dono da conta, não um custo. Somá-la zeraria o lucro
> de toda venda. Só entram as entradas cujo tipo não é produtor.

> ### ⚠️ `faltando` para de cobrar cadastro do que já é medido
> Se TODAS as vendas do período informaram a taxa, o aviso âmbar some — cobrar
> cadastro de um número já medido treina o usuário a ignorar o aviso. Com
> mistura, ele **continua** aparecendo: metade das vendas depende do cadastro.

`npm run test:financeiro` — **54 asserções**, 12 delas cobrindo esta etapa,
inclusive o chamador antigo (sem lista de vendas) mantendo o comportamento
anterior.

### 💳 Dívida conhecida: order bump da Kirvano não aparece em "Vendas por produto"

O order bump dela vem dentro de `products[]` (com `is_order_bump: true`), na
MESMA venda — então a Traffik grava 1 linha com o nome do produto principal e o
`total_price` somado. O faturamento está certo; o **produto do bump é invisível**
no ranking de produtos e nos produtos descobertos por área.

**A saída é migração de DADOS, não mudança de parser.** Separar em linhas exige
que o `externalId` vire `<sale_id>:<offer_id>` — e mudar identificador já emitido
faz o upsert criar linhas NOVAS ao lado das existentes, duplicando as 26 vendas
de produção. Seria preciso: migrar as linhas antigas para a chave nova, e só
então trocar o parser, num único passo transacional.

**Decisão do usuário em 31/07/2026: não vale o risco agora.** Fica registrado
para ser reavaliado quando houver volume que justifique.

> ⚠️ A Cakto **não** tem esse problema: os itens dela já chegam como entradas
> separadas, com id próprio e `parent_order`.

### Etapa 5 — correspondência da CAPI e o backfill das taxas

**Migration `20260731010000`**: `Sale.fbc` e `Sale.fbp`.

#### Dois sinais perdidos em silêncio

| Sinal | O que acontecia | Agora |
|---|---|---|
| **`_fbp`** | **nunca era enviado** — o campo não existia no `user_data`, e a Kirvano manda em 45 de 46 eventos | vai para a CAPI |
| **`_fbc`** | fabricado com `Date.now()` | usa o cookie REAL do gateway; sem ele, reconstrói com o **instante do CLIQUE** |

> ### ⚠️ O terceiro segmento do `_fbc` é QUANDO O COOKIE FOI CRIADO
> `fb.<sub>.<criado_em>.<fbclid>` — é o momento do clique no anúncio. Havia
> `Date.now()`, que é o instante em que a VENDA foi processada. Num Pix pago
> dois dias depois, a string não batia com a do navegador do comprador.
>
> Nenhum dos dois fazia a chamada falhar. Degradam a correspondência, que
> alimenta a otimização das campanhas — dinheiro real, sem erro e sem log.

**Medido: apenas 1 venda foi afetada até hoje**, e com defasagem de 0,00 dia (a
venda foi processada no mesmo instante do clique). O estrago acumulado é
praticamente nulo; o que importa é daqui para frente, com PIX pago com atraso.

#### Match por `fbc` — a via principal da Cakto

| # | Via | O que prova |
|---|---|---|
| 1 | `click_id` público | o NOSSO script propagou o id. Identifica a SESSÃO, sem janela |
| 2 | **`fbc` → `fbclid`** | identifica o CLIQUE no anúncio |
| 3 | IP do payload | inferência frouxa, 12 h |

> ⚠️ O `click_id` continua vencendo: os dois identificam a mesma pessoa, mas o
> nosso id sobrevive a um visitante que voltou pelo anúncio duas vezes (mesmo
> `fbclid`, sessões diferentes). A força já estava em `fontes.ts`.
>
> 🔴 **Para a Cakto o `fbc` é a via PRINCIPAL** — ela não manda o IP do
> comprador, então sem esta via a venda dependeria só do `click_id`.

#### 🔒 `npm run backfill:taxas` — o primeiro teste REAL da restrição

Relê o `rawPayload` com o parser atual e grava **só** `taxaGateway`/`coproducao`.

Medido nas 26 vendas reais de produção (semeadas no dev):

| | |
|---|---|
| Ganham taxa real | **14** (R$ 46,61 recuperados) |
| Payload não traz o dado | 12 |
| Faturamento líquido | R$ 1.307,77 → **R$ 1.305,15** |
| Procedência | 2 vendas com taxa real, 10 pela cadastrada → **período MISTO** |

> ### 🔴 A restrição, MEDIDA em vez de prometida
> A simulação reporta o que aconteceria **se** o reprocessamento recalculasse o
> país com o payload já purgado (Fase A): **15 das 26 vendas PERDERIAM o país.**
>
> É exatamente isso que a regra impede — e agora está exercitado, não suposto.
> Depois do `--aplicar`, o script compara `country`/`countrySource` **linha a
> linha** e falha se qualquer um mudou. Saiu idêntico; a 2ª passada não mexe em
> nada.
>
> ⚠️ O `SET` toca só as duas colunas de taxa. País, fonte, clique, método de
> match e status ficam de fora — a restrição é **estrutural**, não uma promessa
> no comentário.

`npm run test:correspondencia` — 8 asserções, interceptando o `fetch` para ler o
`user_data` que iria à Meta. Sem rede e sem banco.

### Etapas 6 e 7 — Cakto e a tela montada do registro

**A Cakto custou exatamente:** um parser, uma entrada no registro, uma logo e um
arquivo de exemplos. Zero rota, zero mudança em `ingestSale`, métricas ou lógica
de venda. É o critério de aceite, verificado na prática.

| | Kirvano | Cakto |
|---|---|---|
| Order bump | dentro de `products[]`, uma venda só | **entradas separadas**, id próprio |
| `data` | objeto | **objeto OU array** (individual × agrupado) |
| IP do comprador | manda | 🔴 **não manda** |
| `fbc`/`fbp` | só `fbp` | **os dois** |
| Segredo | usuário cria lá e cola aqui | **nós geramos**, ele cola lá |
| Nomes de evento | inglês | **mistura idiomas** (`pix_gerado` × `purchase_approved`) |

A mistura de idiomas é a prova de que o mapa tem de ser **por plataforma**: não
existe regra geral que traduza `pix_gerado` e `purchase_approved` ao mesmo tempo.

> ### ⚠️ `initiate_checkout` e `checkout_abandonment` caem os dois em ABANDONADA
> A diferença entre "começou" e "desistiu" não muda o que a venda **é**: um
> carrinho sem pagamento. O que eles precisam fazer — alimentar o funil — vem de
> `gerouCheckout`, não do status. Distinguir os dois na tela depois é **estado
> novo**, não remendo.

> ### ⚠️ `subscription_created` lê o campo `status`, e isso é deliberado
> A documentação não diz se criar a assinatura implica cobrança aprovada. Mapear
> para APROVADA **inventaria faturamento**; para PENDENTE **esconderia venda
> paga**. Ele está numa lista de "conhecidos porém ambíguos" — o que evita o
> falso alarme de "evento desconhecido" sem fingir que sabemos a resposta.

> ### ⛔ `commissions[]`: só `producer` conhecido → `coproducao` fica NULL
> `0` afirmaria "não há coprodução" e o líquido apareceria MAIOR que a realidade.
> Um tipo diferente entra na lista **e vira aviso** — é assim que a estrutura
> real vai ser descoberta quando aparecer.

**A tela é montada do registro** (etapa 7): rótulos, campos, passos de instalação
e o subtítulo da gaveta. A `WebhooksView` tinha uma lista local que **já
divergia** — a Cakto existia no backend com parser e capacidades, e não aparecia
na tela porque ninguém lembrou de acrescentá-la em dois lugares.

> ### 🔑 Gateway cuja chave NÓS geramos precisa MOSTRÁ-LA
> `campos[].gerado: true` faz a gaveta gerar um uuid na hora e exibi-lo num campo
> copiável. Sem isso a chave era gerada, salva e nunca mostrada — e o webhook
> ficava **impossível de configurar do outro lado**, porque a Cakto exige o
> `secret` no corpo.

**Verificado na tela** (dev, `dev@exemplo.dev`): a gaveta abre com a Cakto
primeiro, chave gerada com botão Copiar, os 4 passos de instalação e os dois
passos de atenção em âmbar (disparo AGRUPADO e localização estimada). O testador
foi exercitado com os 4 exemplos, incluindo o evento desconhecido — o aviso
aparece — e com um payload adulterado, onde o âmbar pegou `buyer_ip_address` e
`cliente_fbc`.

## 🟩 OnyxPag — o terceiro gateway (31/07/2026)

Custou o que o critério de aceite exige: **um parser, uma entrada no registro,
uma logo e um arquivo de exemplos.** Zero rota, zero mudança em `ingestSale`,
métricas ou lógica de venda. (A única linha fora disso foi um texto da gaveta —
ver o fim desta seção.)

Documentação: https://doc.onyxpag.com

| | Kirvano | Cakto | **OnyxPag** |
|---|---|---|---|
| Segredo no webhook | header | corpo | 🔴 **nenhum** |
| IP do comprador | manda | não | não |
| `fbc`/`fbp` | só `fbp` | os dois | 🔴 **nenhum** |
| UTMs de volta | sim | sim | 🔴 não documentado |
| Taxa calculada | `fee` | `fees` | ✅ `fee_amount` |
| Valor | `"R$ 197,00"` | número | `"25.90"` (**ponto** decimal) |
| Order bump | em `products[]` | linhas separadas | `items[]` de 1 transação |

### 🔴 O primeiro gateway SEM segredo — e por que `exigir: false` aqui é certo

A doc é explícita: *"No additional HTTP headers (signatures, tokens, or secrets)
are specified for webhook validation"*. O webhook nem é cadastrado em painel —
o endereço vai no campo `postbackUrl` de **cada cobrança criada**.

Exigir segredo recusaria **100% das entregas dela**. Isso não é falhar fechado,
é não integrar. É o **segundo** caso de `exigir: false` (o primeiro é `CUSTOM`),
e a mitigação é a mesma: **a URL é a credencial**, então ela só aparece na
gaveta com botão de copiar, nunca na listagem — e um passo de instalação em
âmbar manda tratá-la como senha.

`onde` continua listando header e corpo: se a OnyxPag passar a assinar, ou se o
usuário puser um segredo, ele passa a ser **exigido**.

### 🔴 Primeiro gateway sem NENHUMA via de atribuição

Sem `click_id`, sem `fbc` e sem IP, não há o que casar com o clique: a venda
entra sem campanha, sem criativo e sem país. O `tracking` que a API aceita na
**criação** da cobrança (`utm_*`, `sck`, `client_reference_id`) **não aparece no
payload do webhook documentado**.

O parser procura esses campos **defensivamente** em `data.tracking` e
`data.metadata` — se a doc estiver incompleta, a atribuição funciona sozinha. As
capacidades foram declaradas conforme a documentação (`utms: false`), e quem
decide é um payload REAL no testador.

> ⚠️ **`transaction.expired` → `EXPIRADA`, não `CANCELADA`.** Terminal impediria
> o `transaction.paid` de um PIX gerado de novo de sobrescrever, e a venda paga
> sumiria do faturamento. Mesma razão do PIX vencido da Kirvano.

> ⚠️ **`"25.90"` tem PONTO decimal**, ao contrário do `"R$ 197,00"` da Kirvano.
> `toNumber` lê os dois; a armadilha seria um parser de vírgula caseiro, que
> leria isso como **2590**.

> ⚠️ **UMA venda por transação — não dividimos `items[]`.** Dividir seria
> possível (há `unit_price` e `quantity`), e não fazemos por duas razões: não há
> id por item, então o `externalId` viria do índice e uma reentrega em ordem
> diferente **duplicaria faturamento em silêncio**; e `amount` é o total
> autoritativo, que a soma dos itens pode não fechar. Mesma escolha da Kirvano,
> mesmo custo aceito: **order bump aparece no valor, não em "Vendas por
> produto"**.

**Testado:** `npm run test:onyxpag` — 38 asserções, **zero campos em âmbar** nos
5 exemplos. `npm run test:gateways` (45 asserções de paridade dos parsers
antigos) continua passando. **Conferido na tela**: a OnyxPag aparece na grade com
a logo, os 4 passos de instalação e o campo de chave como opcional.

> ⚠️ **Os exemplos são da DOCUMENTAÇÃO, e só o primeiro é literal** — a doc mostra
> um payload só. Passar no teste não substitui rodar um payload REAL no testador,
> e aqui há suspeita concreta de doc incompleta (o `tracking`).

### A logo precisou virar quadrada

`onyx-logo-light.png` é um wordmark **3,24:1 com fundo branco opaco**. O
`LogoGateway` renderiza num quadrado de 34px com `objectFit: contain` — contida,
ela viraria uma tarja de 10px de altura com o texto ilegível. Foi recomposta
numa tela **256×256 com o mesmo fundo branco** que a arte já traz, que é o que o
`overflow:hidden` arredonda (igual à da Kirvano).

> Regra para a próxima: **wordmark largo tem de ser quadrado antes de virar
> `.webp`**. Só logo já quadrada pode ir direto.

### 🐛 E um bug antigo que a OnyxPag revelou

O botão "Adicionar" da gaveta checava `!gatewaySecret.trim()`
**incondicionalmente** — escrito quando Kirvano e Cakto eram os únicos gateways
e os dois exigiam chave. Resultado: o campo dizia **"(opcional)"** e o botão
ficava desabilitado do mesmo jeito.

Atingia a OnyxPag e, **desde sempre e sem ninguém notar, o "Sistema próprio"**
(`CUSTOM`) — que também tem a chave como opcional. Ou seja: nunca foi possível
cadastrar um checkout próprio sem inventar uma chave.

Agora a trava sai do **registro** (`campos[].obrigatorio`), que é a mesma fonte
de onde vem o rótulo "(opcional)". Tirar os dois do mesmo lugar é o que impede
a tela de dizer uma coisa e o botão exigir outra.

> ⚠️ **Padrão que fica:** toda regra de formulário que dependa do gateway sai do
> `REGISTRO`. Se aparecer uma condição escrita à mão na `WebhooksView`, ela vai
> divergir do registro no gateway seguinte — foi exatamente o que aconteceu aqui.

### O único arquivo fora do roteiro

O subtítulo da gaveta tinha **dois** fluxos (`geradoPorNos` ou não) e a OnyxPag é
um **terceiro**: sem chave nenhuma. Ela caía no texto *"informe a chave de
segurança gerada no painel dele"* — mandando o usuário procurar uma chave que
não existe. Agora são três ramos, derivados de `auth.geradoPorNos` e
`auth.exigir`.

> Não é falha da arquitetura: é o registro ganhando uma combinação que a tela
> ainda não sabia descrever. Mas conta como arquivo tocado, e por isso está aqui.

### O que a etapa 1 **não** fez

Etapas 2 a 8, na ordem acordada: precedência de fonte (2) · `pedidoId`+`itemTipo`
e contagem por pedido (3) · `taxaGateway`+`coproducao` (4) · match por `fbc` e
DDI só com país medido (5) · parser da Cakto + testador (6) · tela montada do
registro (7) · esta documentação (8, feita agora).

A `WebhooksView` ainda tem o array `GATEWAYS` local, duplicando o registro — sai
na etapa 7. Enquanto isso, **o registro é a fonte de verdade do servidor** e o
array só decide o que aparece no modal.

## ✅ CAKTO VALIDADA EM PRODUÇÃO COM VENDA REAL (31/07/2026)

Não é mais "passa nos exemplos da documentação". O usuário configurou o webhook
na Cakto, ela disparou eventos de teste, e ele **gerou e PAGOU um PIX real** —
tudo contabilizado na ferramenta.

**A arquitetura universal de gateways está validada com um segundo gateway de
verdade**, ponta a ponta: receptor universal → estratégia de auth da plataforma →
parser dedicado → formato interno → ingestão → métricas.

E ela custou o que o critério de aceite exigia: **um parser, uma entrada no
registro, uma logo e um arquivo de exemplos.** Zero rota, zero mudança em
`ingestSale`, nas métricas ou na interface.

### 🔎 `npm run venda:inspecionar` — "a venda entrou COMPLETA?"

Faturamento certo **não** responde essa pergunta: um parser pode acertar o valor
e descartar a taxa, o país, o agrupador do pedido ou o casamento com o clique, e
a tela continua parecendo correta.

O inspetor mostra campo a campo **e o que significa cada vazio** — a mesma
distinção do testador de payload ("o gateway não manda" × "o parser não leu"),
aplicada ao que ficou GRAVADO. Ele lê as capacidades do registro para decidir se
um vazio é esperado ou é bug:

```bash
npm run venda:inspecionar -- --url '<conn>' --gateway CAKTO --n 2
```

**Somente leitura** — pode rodar em produção.

Exercitado contra linhas reais (exemplo agrupado enviado ao webhook de dev):
2 linhas · **1 pedido** (`cakto:12345`) · R$ 90 + R$ 27 · `principal`/`orderbump`
· taxas R$ 4,50 e R$ 1,35 · `fbc`/`fbp` gravados · log dizendo "2 itens no mesmo
pedido". Dados de teste removidos depois.

> ⚠️ **Vazios ESPERADOS numa venda da Cakto:** `country` e `countrySource` ficam
> nulos quando não há clique casado — ela **não manda o IP do comprador**, e essa
> é a capacidade declarada. `coproducao` fica nulo porque só conhecemos o tipo
> `producer`. Nenhum dos dois é bug.
>
> 🔴 **Vazio que É bug:** `taxaGateway` nulo (o registro diz que ela manda
> `fees`), ou `fbc`/`fbp` nulos num payload que os trouxe.

## 🔴 O MOTOR DE REGRAS ENXERGAVA O QUE JÁ TINHA SIDO APAGADO (31/07/2026)

As três consultas de entidade em `rules/engine.ts` **não filtravam status**:

```js
where: { adAccount: { userId, ...accountFilter }, ...nameFilterWhere }
```

Toda campanha, conjunto e anúncio da conta entrava no escopo — inclusive
`ARCHIVED` e `DELETED`.

| Ação | O que acontecia |
|---|---|
| **Pausar** | inofensivo: o laço pula quem não está `ACTIVE` ("já pausada") |
| **Ativar** | 🔴 arquivada **não é** `ACTIVE`, então **não era pulada** — o motor chamava `setEntityStatus(ARCHIVED, "ACTIVE")` e tentava **ressuscitar o que o usuário já tinha apagado** |

**O que impediu o estrago foi sorte, não desenho.** As duas regras que existiam
em produção **naquele dia** eram `ATIVAR`, com escopo **"todas as contas"** e
condição `cpa > 50` — e estavam **desativadas**. Zero execuções no
`AutomationRuleLog`. Ligar qualquer uma delas teria alcançado as 12 campanhas
arquivadas da CA 1 MARIA, mais as das outras 5 contas.

> ⚠️ **Aquelas duas regras não existem mais.** Eram as dos testes de automação
> de 31/07 e foram apagadas depois. Medido em 04/08/2026 com o
> `diag:testadores`: **zero regras cadastradas**, nos dois usuários.
>
> Isto é registro histórico do incidente, não o estado atual — e a diferença
> importou: foi por não haver regra nenhuma que ligar o filtro de produto pôde
> ser feito sem migração e sem aviso.

### ⛔ A variação NOVA do padrão: código ATIVO com escopo largo demais

Os cinco casos anteriores do PROCEDIMENTO eram **código inerte** — pronto e não
chamado. Este é o oposto: **chamado, funcionando, e alcançando mais do que
deveria.**

E passou em tudo. As 22 asserções do Bloco 8 provam que a regra **pausa a
campanha certa**; nenhuma pergunta se ela **deixa de tocar no que não deveria**.

> ### 🔴 REGRA QUE FICA
> **Ao testar automação que age sobre entidades externas, teste também o que ela
> NÃO deve tocar.** "Agiu no alvo certo" e "não agiu em mais nada" são duas
> asserções, e a segunda é a que protege dinheiro.

### A correção

`semApagados = { status: { notIn: ["ARCHIVED", "DELETED"] } }` nas três consultas.

> ⚠️ **`UNKNOWN` continua no escopo, de propósito.** Significa "não conseguimos
> determinar o status", não "foi apagado". Excluí-lo faria uma regra de pausar
> deixar de agir justamente onde há incerteza.

> ### ⚠️ Este filtro é do MOTOR. NÃO o copie para as listagens.
> `ads/overview.ts` e `facebook/sync.ts` trazem arquivados **de propósito** — o
> gasto histórico deles é real e some do Dashboard se forem excluídos. A
> diferença é que aqueles **LEEM** e este **AGE**.

### Auditoria das outras 13 consultas de entidade — só o motor era perigoso

| Onde | Traz arquivados? | Veredito |
|---|---|---|
| `rules/engine.ts` | trazia | 🔴 **corrigido** — é o único que AGE |
| `ads/overview.ts` | sim | ✅ por desenho; a tela filtra no cliente |
| `facebook/sync.ts` | sim | ✅ obrigatório: sem o `Ad` local, o insight do arquivado não tem onde encostar |
| `areas/atribuicao.ts` | sim | ✅ correto: campanha arquivada ainda é dona das vendas históricas dela |
| `api/ads/bulk` | resolve por id | ✅ o usuário selecionou explicitamente |
| `api/track/click` | sim | ✅ leitura de segmentação, não age |
| `ads/creatives.ts` | sim | ⚠️ listagem, não age — vale revisar se arquivado deveria aparecer no ranking de criativos |

### ▶️ Botão "Rodar agora" na tela de Regras

O único gatilho era o cron do GitHub Actions (15 min, *best-effort*, atrasa 5–20
min em pico) ou `curl` com o `CRON_SECRET`. Nenhum serve para conferir uma regra
recém-criada, que é justamente quando se quer ver o que ela faz.

> ⚠️ **Chama o MESMO `runUserRules` do cron.** Um segundo caminho de execução
> divergiria, e a regra passaria a agir diferente conforme quem a disparou.
>
> ⚠️ **Ele AGE.** Limite diário e janela de execução continuam valendo — o botão
> não os contorna.

**Verificado na tela** (dev, uma campanha PAUSED e outra ARCHIVED): o histórico
mostrou **"Nenhuma entidade satisfez as condições (1 avaliadas)"**, listando só a
pausada. Antes da correção seriam 2.

## 🧪 O ENSAIO A SECO DISPAROU — operador invertido (31/07/2026)

O usuário criou a regra do Passo 0 com **`gasto ≤ 999999`** em vez de `≥`. A
condição, que deveria ser impossível, ficou **sempre verdadeira**. A regra
executou.

**Consequência real: nenhuma.** A ação escolhida era **PAUSAR** e a campanha
alcançada já estava pausada. A recomendação de usar Pausar em vez de Ativar
funcionou exatamente como defesa em profundidade — com `ATIVAR`, a mesma
condição sempre-verdadeira teria ligado o que estivesse parado.

> ### 🔴 A LIÇÃO NÃO É "o usuário errou o operador"
> É que **a única barreira que segurou foi a ação escolhida**, e não a condição.
> A condição era o mecanismo de segurança do ensaio, e ela falhou em silêncio:
> nada na tela, no motor ou no log distingue `≤ 999999` (pega tudo) de
> `≥ 999999` (não pega nada). As duas parecem idênticas até rodar.
>
> Um ensaio a seco cuja segurança depende de digitar o operador certo não é um
> ensaio a seco — é uma execução com um passo a mais. Ver "Prévia da regra" na
> fila.

### ✅ A REQUISIÇÃO SAIU — escrita do motor EXERCIDA em produção

O log fechou a questão:

```
✓ EXECUTOU  PAUSAR → Nova campanha de Engajamento
```

**Sem `"já pausada"`.** Ou seja: o motor não pegou o desvio, chamou
`setEntityStatus`, e a Meta aceitou (o `graphPost` lança em qualquer resposta
com `error` ou fora de 2xx — se tivesse falhado, a mensagem estaria no log).

**Isto encerra a pendência mais antiga do projeto.** O caminho da REGRA —
avaliar condição, escolher entidade, agir sozinha e registrar — está exercido
**por execução real em produção**, não por leitura de código. Foi por acidente,
com consequência nula, e mesmo assim é a prova que faltava.

> ⚠️ Naquele momento a prova era só do caminho de PAUSAR. `AJUSTAR_ORCAMENTO`
> e o clamp foram exercidos horas depois, em teste dirigido — ver a seção
> seguinte.

### ⚠️ Mas `affected: 1` sozinho NÃO provaria isso

O laço de PAUSAR tem uma saída antecipada:

```js
if (e.status !== "ACTIVE") {
  applied.push({ name: e.name, action: "PAUSAR", ok: true, error: "já pausada" });
  continue;   // ← NÃO chama setEntityStatus. Nenhuma requisição sai.
}
await setEntityStatus(e.fbId, "PAUSED", e.token);
```

E `affected = applied.filter(a => a.ok).length` — o desvio empurra **`ok: true`**.
Então uma entidade "afetada" pode ser uma entidade em que **nada foi feito**.

**Como saber qual dos dois aconteceu**, no `details.aplicado` do log:

| No log | Significa |
|---|---|
| `{ ok: true, error: "já pausada" }` | 🟡 **nenhuma requisição saiu.** O motor parou uma linha antes do `fetch` |
| `{ ok: true }`, sem `error` | ✅ **a requisição SAIU e a Meta aceitou** |
| `{ ok: false, error: "<mensagem>" }` | ❌ a Meta recusou; a mensagem é a dela |

`npm run regras:auditar` já separa os dois: imprime `✓ EXECUTOU` só no segundo
caso, e `· já pausada` no primeiro.

> ⚠️ **O ramo depende do status LOCAL**, não do status real no Facebook. Se o
> nosso banco dissesse `ACTIVE` e a campanha estivesse pausada lá, a requisição
> teria saído mesmo assim (e a Meta a aceitaria, por ser idempotente).

> ⚠️ **Não guardamos a resposta da Meta.** `graphPost` **lança** quando
> `!res.ok` ou quando vem `error`, e o `catch` do motor põe a mensagem no log —
> então erro fica registrado, mas o corpo de uma resposta de SUCESSO é
> descartado. "Sucesso" aqui quer dizer "HTTP 2xx sem objeto `error`", nada mais
> específico que isso.

### ✅ ESCOPO CONFIRMADO EM PRODUÇÃO — com execução real

O log trouxe **1 entidade avaliada**, não 13. A conta CA 1 MARIA tem 12
campanhas arquivadas, e **nenhuma delas entrou**. É a confirmação de que o
`semApagados` do commit `cc8fdec` está valendo no build que a produção roda —
agora por execução real, não por leitura de código.

> Vale registrar como a evidência apareceu: **a regra que provou o escopo é a
> mesma que disparou por engano.** Um ensaio que se comportasse exatamente como
> planejado teria provado a mesma coisa; foi o acidente que deu peso à prova,
> porque exercitou o caminho inteiro em vez de parar na avaliação.

## ✅ O CLAMP FOI EXERCIDO — Passo 2 fechado (31/07/2026)

Teste dirigido, em produção, com cobaia **medida** antes de usar.

| | |
|---|---|
| Cobaia | `COBAIA — não usar` — criada pela ferramenta, **crua** (0 conjuntos), PAUSADA, `dailyBudget` R$ 20 |
| Regra | nível Campanha · só a conta da cobaia · **aumentar 50%** · **teto R$ 25** · `Gasto ≥ 0` |
| Previsto pela prévia | "bate em 2 · a ação alteraria 1" |
| Log | `1 de 2 entidade(s) afetada(s)` · `✓ COBAIA` · `✗ Nova campanha de Engajamento (sem orçamento diário (CBO?))` |
| **No Facebook** | **R$ 25,00** |

**O que isso prova, e não é pouco:**

1. **O clamp trava no teto.** 20 × 1,5 = 30, e o que chegou à Meta foi 25.
2. **A cadeia de unidades do caminho da REGRA está correta.** R$ 25 → 2500
   centavos → R$ 25,00 na tela do Facebook. Não há divisão nem multiplicação
   sobrando — era a hipótese mais cara de errar, e a mais difícil de notar.
3. **A prévia é honesta.** Ela disse "bate em 2 · alteraria 1" **antes de
   salvar**, e o log registrou exatamente isso. É a primeira vez que a promessa
   e a execução foram comparadas com dado real.
4. **O pulo por ABO funciona:** a campanha sem orçamento no nível da campanha
   foi recusada com o motivo, em vez de alterada.

> ### ⚠️ O log NÃO teria bastado
> `✓ EXECUTOU AJUSTAR_ORCAMENTO` é idêntico para R$ 25 e para R$ 30 — o
> `applied` registra que a chamada teve sucesso, nunca o valor enviado. **Quem
> testa o clamp é o número no Gerenciador do Facebook.** Mesma lição do
> `affected: 1`: o log prova que agiu, não prova o quê.
>
> **Melhoria natural:** `planejarAcao` já calcula `novoOrcamento` — gravá-lo no
> `applied` tornaria o log auto-suficiente para esta classe de verificação.

> ### 🔒 Por que o risco era zero, e não "baixo"
> Orçamento é **teto de gasto, não gasto**. Numa campanha sem conjunto a Meta
> não entrega, então nem o pior erro de unidade (R$ 2.500) custaria um centavo.
> A propriedade "crua" protege exatamente contra o erro que o teste procura — e
> por isso ela foi **medida** com `conta:estrutura` antes, nunca assumida.

### ✅ A 2ª guarda também — `já no teto` (02:31 do mesmo dia)

Segunda execução da mesma regra, 16 minutos depois:

```
✓ COBAIA — não usar — AJUSTAR_ORCAMENTO (já no teto (R$ 25.00))
✗ Nova campanha de Engajamento — AJUSTAR_ORCAMENTO (sem orçamento diário (CBO?))
```

**Nenhuma requisição saiu.** É a guarda que impede a regra de bater na Meta a
cada 15 minutos, para sempre, depois que o orçamento já chegou no limite —
`planejarAcao` devolve `{ agir: false, ok: true }` e o laço nem tenta.

Com isso, **as três decisões do teto estão exercidas em produção**: recusar
aumento sem teto (por asserção), travar NO teto (R$ 25 no Facebook) e pular
quando já está lá.

> ### ⚠️ E a ambiguidade do `affected` reapareceu — 2ª vez
> A tela mostrou **"1 campanha afetada"** numa execução em que **nada foi
> feito**. É o mesmo `ok: true` do pulo esperado alimentando o contador, igual
> ao `já pausada` da madrugada.
>
> Não é bug de cálculo — é a palavra. "Afetada" descreve um pulo. **Melhoria
> registrada:** separar no resumo o que foi ALTERADO do que foi PULADO, e
> gravar o `novoOrcamento` no `applied` (`planejarAcao` já o calcula), para o
> log responder sozinho o que hoje só o Gerenciador do Facebook responde.

**Ainda NÃO exercidos** no caminho da regra: os modos `valor` (absoluto) e
`pct_gasto` do `actionParams` — só `percentual` rodou — e **ATIVAR** pela regra.

## ✍️ ESCRITA NA GRAPH API: o que já foi exercido (31/07/2026)

> ### ⛔ A documentação afirmava, em QUATRO lugares, que nenhuma escrita real
> ### tinha acontecido. Era FALSO.
> O usuário **pausou campanha e alterou orçamento pela ferramenta, em produção, e
> os dois funcionaram no Facebook.** A afirmação nasceu correta ("não exercida
> *nesta sessão*, a conta de teste não tem token") e foi sendo copiada adiante
> perdendo o "nesta sessão", até virar uma verdade geral que ninguém checou.
>
> **Lição:** "não verificado por mim" não é "não verificado". Antes de registrar
> algo como não exercido, pergunte ao usuário — ele usa o produto.

### Inventário — quatro caminhos de escrita, e dois rodam SOZINHOS

| Caminho | Onde | Exercido? |
|---|---|---|
| Pausar/ativar pelo toggle | `/api/ads/status` | ✅ uso real |
| Alterar orçamento (caneta inline) | `updateDailyBudget` | ✅ uso real |
| **`Purchase` na CAPI** | `dispatchPixel` | ✅ **automático, em TODA venda aprovada** |
| **`Lead`/`AddToCart`/`IC` na CAPI** | `/api/pixel/event` | ✅ **automático, pelo script instalado** |
| Teste de pixel | `/api/pixel/test` | ✅ |
| **Regras agindo sozinhas** | `rules/engine.ts` | ✅ **31/07/2026, em produção.** PAUSAR (por acidente) e AJUSTAR_ORCAMENTO (teste dirigido) |
| **Clamp NO teto de orçamento** | `rules/engine.ts` | ✅ **31/07/2026** — R$ 20 +50% com teto R$ 25 → **R$ 25,00 no Facebook**; a 2ª execução pulou com `já no teto` sem chamar a Meta |
| Criar campanha | `/api/ads/campaign` | ✅ 31/07/2026 — a cobaia crua |
| Ações em massa | `/api/ads/bulk` | ❌ nunca |
| Duplicar | `/copies` | ❌ nunca |
| Excluir | `deleteEntity` | ❌ nunca (irreversível) |

> ⚠️ Os dois automáticos são fáceis de esquecer porque ninguém clica neles: **cada
> venda aprovada escreve na Meta** e alimenta a otimização da campanha. Não é
> escrita de configuração, mas é dinheiro real sendo influenciado.

### ✅ A cadeia de unidades está correta (verificada no código)

`sync.ts` → `budget(v) = Number(v) / 100` (centavos → reais).
`manage.ts` → `Math.round(reais * 100)` (reais → centavos).

Consistente nos dois sentidos, e confirmada pelo uso real do usuário. **Não é
onde procurar se um orçamento sair errado** — procure no caminho da REGRA, que é
o único que nunca rodou.

### 🧪 Plano de validação do que falta

> ### 🔴🔴 A PREMISSA DA COBAIA CAIU — ela GASTOU (31/07/2026)
> A versão anterior desta seção dizia que a campanha de engajamento era **crua
> (sem conjunto e sem anúncio)** e por isso **não gastaria nem se fosse
> ativada** — "risco financeiro zero, não baixo".
>
> **Ela gastou R$ 0,13.** O valor apareceu no `details.avaliado` do log da regra
> que disparou por engano. Gasto só existe com entrega, e a Meta **só entrega
> através de conjuntos** — então ela tem conjunto e anúncio ativos, ou passou a
> ter em algum momento. A frase escrita acima já estava falsa quando foi lida.
>
> **Consequências, todas do plano de validação:**
> - o Passo 1(b) ("ativar é seguro porque não há entrega") **não vale mais**;
> - o Passo 2 (clamp de orçamento) mexeria numa campanha que entrega de verdade;
> - "risco financeiro zero" vira "risco real, pequeno".
>
> ⚠️ **A regra que fica: não confie na descrição de uma cobaia — MEÇA.**
> `npm run conta:estrutura` responde por campanha quantos conjuntos e anúncios
> ATIVOS ela tem e quanto gastou, e marca com `● PODE GASTAR` toda campanha
> `ACTIVE` com conjunto e anúncio ativos. Uma campanha só é segura enquanto for
> **crua (zero conjuntos)** — e isso é uma medição, não uma lembrança.
>
> ✅ **Pausada, ela volta a ser inofensiva** — campanha pausada não entrega, e o
> Passo 1(a) (pausar o que já está pausado) continua sendo o teste mais seguro.
> Mas o Passo 1(b) e o Passo 2 precisam de **outra** cobaia, comprovadamente
> crua pelo `conta:estrutura`.

**Passo 0 — ensaio a seco, obrigatório.** Regra com condição impossível
(`Gasto ≥ 999999`), nível Campanha, conta CA 1 MARIA. O `details.avaliado` do log
lista **cada entidade que a regra viu**, sem agir. Serve para responder: *as 12
campanhas ARQUIVADAS da conta entram no escopo?* Se entrarem, nenhuma regra de
ATIVAR pode rodar antes de apertar o escopo.

**Passo 1 — motor agindo.** (a) `Gasto ≥ 0` + **Pausar** numa campanha já pausada:
escrita real, efeito nulo, prova o caminho inteiro. (b) mesma regra com **Ativar**:
prova mudança de estado, e é segura porque sem conjuntos não há entrega.

**Passo 2 — o clamp.** Orçamento em **R$ 20**, regra **+50% com teto R$ 25**.
Esperado no Facebook: **R$ 25,00**. R$ 30 = clamp não aplicou; R$ 0,25 ou
R$ 2.500 = erro de unidade no caminho da regra.

**Passo 3 — ações em massa.** O teste mais informativo é pedir **R$ 1,00** de
orçamento: a Meta **rejeita** (abaixo do mínimo) e isso prova que o banco local só
é atualizado DEPOIS de a Graph aceitar.

**Passo 4 — duplicar.** Nasce **pausada** (`status_option: PAUSED`, o diálogo
pergunta). `deep_copy: true`.

> 🔴 **Reverter o duplicar é o problema:** a única remoção pela ferramenta é
> Excluir, e `deleteEntity` grava `status: DELETED`, que **a Meta não desfaz**.
> Arquive a cópia pelo Gerenciador do Facebook.

> ### ⛔ BID CAP NÃO É TESTÁVEL NESTA COBAIA
> `bid_amount` é campo de **CONJUNTO**, não de campanha, e exige estratégia
> `LOWEST_COST_WITH_BID_CAP` ou `COST_CAP`. Testá-lo exigiria criar um conjunto —
> o que remove a propriedade de "não pode gastar". Fica para quando houver uma
> campanha real de baixo risco.

**Rejeições LEGÍTIMAS, para não confundir com bug nosso:** orçamento abaixo do
mínimo diário da conta; `bid_amount` em campanha ou com estratégia incompatível;
orçamento de campanha quando os conjuntos têm orçamento próprio (ABO). Ativar
campanha pausada e o objetivo de engajamento **não** rejeitam nada.

## 🚦 Status de VEICULAÇÃO — `status` × `effective_status` (31/07/2026)

**Migration `20260731020000`** — `effectiveStatus String?` em `Campaign`,
`AdSet` e `Ad`. Aditiva: três colunas nullable, sem default e sem backfill.

### 🔴 O campo estava na chamada, e mesmo assim não era guardado

`effective_status` aparece **duas vezes** na requisição, com papéis diferentes:

| Onde | Papel |
|---|---|
| `effective_status: STATUS_SINCRONIZADOS` | **filtro** de quais objetos trazer |
| `fields: "…,effective_status,…"` | **campo** a ler |

O sync tinha só o primeiro. A chamada trazia exatamente os objetos certos e
**jogava fora a informação** — nada falhava, nada logava, e a resposta para "por
que minha campanha não está rodando" simplesmente não existia no banco.

| Campo | Responde |
|---|---|
| `status` | o que foi **configurado** — é o que o toggle da tabela reflete |
| `effective_status` | se está **realmente veiculando** |

### O mapa, e por que ele é DADO e não `switch` na view

`lib/ads/veiculacao.ts` é a fonte única — o `AdsTable` mostra e a `ads:sonda`
confere contra a resposta crua. Mesma razão de `corFinanceira` e de
`lib/ads/status.ts`: rótulo e cor decididos na tela divergem quando aparece a
segunda tela.

| `effective_status` | Na tela | Tom |
|---|---|---|
| `ACTIVE` | Veiculando | verde |
| `PAUSED` | Pausado | cinza |
| `ADSET_PAUSED` | Conjunto pausado | âmbar |
| `CAMPAIGN_PAUSED` | Campanha pausada | âmbar |
| `DISAPPROVED` | Reprovado | vermelho |
| `PENDING_REVIEW` | Em análise | âmbar |
| `PREAPPROVED` | Aprovado provisoriamente | âmbar |
| `PENDING_BILLING_INFO` | Falta pagamento | vermelho |
| `IN_PROCESS` | Preparando | âmbar |
| `WITH_ISSUES` | Com problema | vermelho |
| `ARCHIVED` | Arquivado | cinza |
| `DELETED` | Excluído | cinza |

> ### 📏 SONDA RODADA EM PRODUÇÃO (31/07/2026) — 2 dos 12 valores existem
> O campo **vem em 39 de 39 objetos** (2 contas × 3 níveis). Mas só dois valores
> apareceram:
>
> | Observado | Quantos |
> |---|---|
> | `ARCHIVED` | 36 |
> | `ACTIVE` | 3 |
>
> **Os outros 10 mapeamentos são TRADUÇÃO NÃO EXERCIDA** — `ADSET_PAUSED`,
> `CAMPAIGN_PAUSED`, `DISAPPROVED`, `PENDING_REVIEW`, `PREAPPROVED`,
> `PENDING_BILLING_INFO`, `IN_PROCESS`, `WITH_ISSUES`, `PAUSED` e `DELETED`
> nunca chegaram da API real. Eles vieram da documentação e continuam corretos
> em teste, mas ninguém viu a Meta emitir nenhum deles nesta conta.
>
> ⚠️ Isso vale principalmente para o caso mais útil da coluna: **nenhuma
> divergência foi observada** (zero objetos `ACTIVE` sem entregar). O selo âmbar
> com ⚠ existe, está testado e **nunca apareceu com dado real**.
>
> ⚠️ **`PREAPPROVED` e `PENDING_BILLING_INFO` continuam FORA de
> `STATUS_SINCRONIZADOS`**, agora com evidência: a sonda consulta com a lista
> maior e não achou nenhum objeto nesses estados. Não há o que ganhar mexendo
> num filtro que já derrubou o sync inteiro uma vez.
>
> ✅ **O sync está fiel:** o cruzamento status-local × status-da-Meta deu
> **nenhuma divergência**. O motor de regras decide pelo status local, então
> essa checagem vale repetir a cada sonda.

> ### ⛔ Valor NOVO da Meta aparece CRU — nunca vira chute
> A Meta acrescenta valores sem aviso. Um `default` que dissesse "não está
> veiculando" produziria diagnóstico falso; um que dissesse "veiculando"
> esconderia problema real. Valor fora do mapa é exibido **como veio** e marcado
> `desconhecido` — é o que faz a lacuna pedir correção em vez de passar batido.
>
> Pelo mesmo motivo a coluna é **`String?`, não enum**: um enum faria o **sync
> falhar** num valor novo, em vez de apenas exibi-lo sem tradução.

### 🔴 Três decisões que produzem alarme errado se forem invertidas

1. **NULO é "não informado", NUNCA "parado".** Antes do primeiro sync com este
   código, TODA linha do banco tem `effectiveStatus` nulo. Se nulo virasse
   alarme, o Gerenciador inteiro apareceria em âmbar no dia do deploy.
2. **Divergente = configurado `ACTIVE` **e** veiculação ≠ `ACTIVE`.** É o selo
   âmbar com ⚠. Linha **pausada** com `DISAPPROVED` não alarma: ela está parada
   por escolha, e o alarme existe para o que o usuário acha que está no ar.
3. **Status conclusivo responde sozinho.** `PAUSED`/`ARCHIVED`/`DELETED` não têm
   ambiguidade, então dispensam o campo da Meta. **É isto que faz a aba
   Arquivados distinguir arquivado de excluído** (o pedido): a Meta **não
   devolve objetos `DELETED`** em aresta de listagem nenhuma, então essas linhas
   nunca receberão `effectiveStatus` — sem esse ramo, "Excluído" ficaria em "—"
   para sempre.

### Onde aparece

Coluna **Veiculação**, logo depois do nome — antes de qualquer número, porque é
a pergunta que se faz primeiro: *"isto está rodando?"*. Gasto zerado numa linha
que não veicula não é problema de tracking, é a campanha parada.

O rodapé de totais mostra **"N sem entregar"** em âmbar. Um selo por linha se
perde numa lista de 40, e quem procura "por que não gastou nada" não vai rolar
até achar.

> ⚠️ **Na aba Contas a célula é um "—" seco, e a ausência é significativa.** Ali
> o toggle é "rastreando na Traffik", não entrega da Meta — quem veicula é
> campanha, conjunto e anúncio. Por isso `LinhaTabela.effectiveStatus` tem TRÊS
> estados: string (informado), `null` (não informado ainda) e **ausente** (este
> nível não tem veiculação). Um "aguardando sincronização" na aba Contas seria
> mentira.

> ⚠️ **`STATUS_SINCRONIZADOS` NÃO foi alterado.** Ele não pede `PREAPPROVED` nem
> `PENDING_BILLING_INFO`, então objeto nesses estados **não existe na
> ferramenta** — nem com o filtro "Arquivados". Acrescentá-los sem prova seria
> mexer no filtro que já derruba o sync inteiro quando erra (foi assim que 12
> campanhas sumiram). A `ads:sonda` consulta com a lista MAIOR justamente para
> dizer se existe algum: **se existir, ela manda acrescentar à lista.**

**Testado:** `npm run test:veiculacao` (40 asserções puras) + `test:veiculacao:e2e`
(13 asserções contra o banco de DEV, provando que o valor **chega** em
`computeAdsOverview` nos três níveis — a armadilha do `pedidoId` fora do
`select`, que nenhum `tsc`/`lint`/`build` acusa). **Conferido na tela** nos 4
níveis: campanha "Veiculando" × "⚠ Com problema", conjunto ligado com
"⚠ Campanha pausada", anúncio "⚠ Reprovado" ao lado de um "—" que **não** conta
no rodapé, e Contas com "—". Dados de teste restaurados por id depois.

### ⚠️ O que NÃO foi verificado

- 🔴 **Nenhuma resposta REAL da Graph API foi observada.** O campo entrou numa
  chamada que já acontecia (custo zero de rate limit), mas o formato e os
  valores continuam sendo os da documentação. **Rode a `ads:sonda` depois do
  primeiro sync** — é o mesmo risco de `AdSet.geoCountries`, que pode ficar
  inerte em silêncio.
- **Sem backfill**: toda linha nasce com `effectiveStatus` nulo e só o primeiro
  sync preenche. É por isso que nulo não pode alarmar.

## 🧫 A COBAIA: nenhuma campanha é crua, e não há tela para criar uma

**Medido em 31/07/2026:** as **13 campanhas** das duas contas têm 1 conjunto e 1
anúncio cada. **Nenhuma é crua.** A "Nova campanha de Engajamento" tinha
conjunto e anúncio ATIVOS e o gasto subiu de R$ 0,13 para R$ 0,17 entre duas
medições — estava entregando.

**A reconstrução:** o usuário criou a campanha pelo Gerenciador do Facebook, que
no fluxo guiado cria conjunto e anúncio junto. Ele acreditou ter criado uma
campanha crua, isso virou premissa escrita, e o plano de validação inteiro foi
construído em cima dela. É a mesma falha do "nenhuma escrita real foi
exercida": **uma afirmação plausível que ninguém mediu.**

> Isso também explica o `8/8/8` que a `ads:sonda` reportava por conta — não era
> campanha órfã, era 1 conjunto por campanha.

### 🔴 `POST /api/ads/campaign` cria SÓ a campanha — e não tem tela

Lido no código (`app/api/ads/campaign/route.ts` → `lib/facebook/manage.ts`):

```
POST /act_<conta>/campaigns
  name, objective, status: "PAUSED", special_ad_categories: "[]"
  daily_budget (só se vier no corpo, em centavos)
```

**Uma chamada, uma aresta.** Nada de `/adsets` nem de `/ads` — nem na Graph, nem
no banco local (o `upsert` cria só a linha de `Campaign`, com `status: PAUSED`).
É o oposto do fluxo guiado do Facebook.

> ### ✅ RESOLVIDO: a tela existe (31/07/2026)
> **"+ Nova campanha"** na aba Campanhas do Gerenciador →
> `views/ads/NovaCampanhaModal.tsx`. Conta, nome, objetivo (ODAX) e orçamento
> diário opcional. O texto diz o que ela cria e o que **não** cria.
>
> ⚠️ Os quatro handlers do estado eram `ChangeEvent<HTMLSelectElement>` —
> assinatura de `<select>` nativo, que este projeto não usa mais. Viraram
> `setNewCampaign*(valor)`. Nunca houve tela consumindo aquilo, então a
> assinatura era herança de um formulário que não existiu.
>
> ⚠️ **O campo de orçamento é o que define CBO**, e o texto diz isso: em branco,
> o orçamento vive nos conjuntos (ABO) e **regra de orçamento no nível de
> campanha não consegue alterá-lo**. Para a cobaia do teste do clamp, preencher
> é obrigatório.
>
> #### O histórico (por que ela não existia)
> `useTraffikState` tem `newCampaignOpen`, `openNewCampaign`, os 4 `onNewCampaign*`
> e o `createCampaign` — e **nenhum `.tsx` importa qualquer um deles**. A rota
> funciona, o estado existe, a tela nunca foi escrita.
>
> É o **sexto** caso do PROCEDIMENTO OBRIGATÓRIO nesta base: pronto, compilando,
> inerte. Entra na fila junto do resto do nav morto — mas aqui a dívida deixou
> de ser cosmética: **é o que impede criar a cobaia pela ferramenta.**

**Alternativa sem tela** (não é mais necessária, fica registrada): o console do
navegador logado no painel — usa o cookie de sessão, e a rota valida a posse da
conta pelo `userId`.

```js
await fetch("/api/ads/campaign", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    accountId: "<id INTERNO da conta>",   // npm run conta:estrutura mostra
    name: "COBAIA — não usar",
    objective: "OUTCOME_TRAFFIC",
    dailyBudget: 20,                       // CBO: exigido pelo teste do clamp
  }),
}).then((r) => r.json());
```

`npm run conta:estrutura` passou a imprimir o **`accountId` interno** no
cabeçalho de cada conta, porque ele não aparece em lugar nenhum da interface.

⚠️ **Medir depois de criar, sempre.** `conta:estrutura` tem de mostrar
`○ crua (sem conjunto)`. Assumir foi exatamente o erro anterior.

### O que volta a ser seguro com uma cobaia comprovadamente crua

| Passo | Situação |
|---|---|
| **1(a)** pausar o já pausado | ✅ sempre foi seguro |
| **1(b)** ativar | ✅ volta a ser: sem conjunto não há entrega |
| **2** clamp de orçamento | ✅ volta a ser — ver abaixo |
| **3** ações em massa (recusa de R$ 1,00) | ✅ |
| **4** duplicar | ⚠️ nasce pausada, mas **reverter é o problema**: a única remoção pela ferramenta grava `DELETED`, que a Meta não desfaz |
| bid cap | ❌ continua impossível: é campo de CONJUNTO, e criar um destrói a propriedade que torna a cobaia segura |

### 🎯 Como exercitar o CLAMP sem risco financeiro

**A pergunta é boa: campanha crua não gasta, logo não gera métrica, logo nenhuma
condição real dispara.** Então sim, é preciso forçar — mas com uma diferença
decisiva em relação ao acidente:

> **Forçar de propósito, com a ferramenta dizendo que você está forçando.**
> `Gasto ≥ 0` faz a análise estática emitir *"todas as condições são sempre
> verdadeiras… a regra vai agir sobre TODAS as entidades do escopo"*, e o
> "Testar condição" responde *"Bate em N de N"*. O acidente foi forçar **sem
> saber**; aqui a tela avisa antes de salvar.

**O valor do orçamento não pode custar dinheiro, e é isso que fecha o risco.**
Orçamento é **teto de gasto, não gasto**. Numa campanha sem conjunto não há
entrega, então mesmo um erro de unidade que gravasse R$ 2.500 em vez de R$ 25
**não gastaria um centavo**. A cobaia crua protege exatamente contra o erro que
o teste existe para pegar.

**Receita:**

| | |
|---|---|
| Cobaia | crua, **PAUSADA**, criada com `dailyBudget: 20` |
| Regra | nível Campanha · conta = só a da cobaia · **aumentar 50%** · **teto R$ 25** |
| Condição | `Gasto ≥ 0` |
| Limite diário | **1** |

> ⚠️ **`AJUSTAR_ORCAMENTO` não exige status ACTIVE** — só `PAUSAR`/`ATIVAR`
> checam status. A campanha pode (e deve) ficar pausada durante o teste.

Esperado no Facebook: **R$ 25,00**.

| Resultado | Leitura |
|---|---|
| R$ 25,00 | ✅ clamp aplicou e as unidades estão certas |
| R$ 30,00 | clamp não aplicou (unidade ok) |
| R$ 0,25 | erro de unidade: dividiu por 100 |
| R$ 2.500,00 | erro de unidade: multiplicou duas vezes |
| Recusa da Meta | orçamento abaixo do mínimo da conta — rejeição legítima, é o Passo 3 |

Rodar **de novo** exercita a outra guarda: deve registrar `já no teto
(R$ 25,00)` **sem chamar a Meta**.

> ### 🔴 O RISCO REAL não é o clamp — é o ESCOPO
> `Gasto ≥ 0` bate em **tudo** que estiver no escopo. Se outra campanha daquela
> conta tiver orçamento no nível de campanha (CBO), **o orçamento dela também
> sobe até o teto**. Não é hipótese: é o mesmo mecanismo do acidente.
>
> Antes de salvar, `npm run conta:estrutura` mostra por campanha o campo
> *"orçamento na campanha"*: quem exibe `—` é ABO e o motor **pula** com
> *"sem orçamento diário (CBO?)"*; quem exibe um valor **será alterado**.
> Escolha a conta em que a cobaia seja a única com valor ali.
>
> ✅ **A prévia deixou de superestimar** (31/07/2026): ela agora informa
> **quantas a AÇÃO alcançaria**, não só quantas satisfazem a condição. Numa
> conta só de ABO, uma regra de orçamento aparece como *"Bate em 13 · ⚠ Mas a
> ação não alteraria nenhuma delas"*, com `sem orçamento diário (CBO?)` ao lado
> de cada linha. Ver "Prévia da regra".

## 🔎 Drill-down no Gerenciador (31/07/2026)

Marcar campanhas faz as abas **Conjuntos** e **Anúncios** mostrarem só o que
pertence a elas; marcar conjuntos filtra **Anúncios**. A marcação **sobrevive à
troca de aba** — sem isso o recurso não existiria.

### ⛔ É a GENERALIZAÇÃO do `contasFiltro`, não um segundo mecanismo

O `contasFiltro` já era exatamente isto para um nível só: reaproveitava o
checkbox da tabela (que na aba Contas não tinha função, porque não há ação em
massa para conta) como filtro das abas de baixo. Virou:

```ts
const [marcados, setMarcados] = useState<Record<Aba, Set<string>>>({
  accounts: new Set(), campaigns: new Set(), adsets: new Set(), ads: new Set(),
});
const selecao = marcados[v.adsSub];   // ← seleção de ação em massa da aba atual
```

> **O que está marcado num nível é, ao mesmo tempo, a seleção para ação em massa
> naquela aba e o filtro das abas abaixo dela.** São a mesma intenção do usuário
> ("estou trabalhando nestas"), então são o mesmo dado. Um filtro de campanha
> paralelo ao de conta divergiria do primeiro — foi assim que a contagem das
> abas e o filtro da tabela já divergiram, mostrando "12 campanhas" com a tabela
> vazia.

> ⚠️ **A contagem das abas usa EXATAMENTE os mesmos filtros das linhas.** Com o
> drill-down a chance de divergir dobrou: um filtro novo aplicado só nas linhas
> produziria a mesma mentira de novo. `contar()` recebe `campaignId`/`adSetId`
> além de `accountId`.

> ⚠️ **Trocar de aba NÃO limpa a marcação.** O `setSelecao(new Set())` que havia
> no clique da aba tornaria o drill-down impossível — a marcação É o filtro.

> ⚠️ **Ação em massa limpa só o nível onde agiu.** As abas acima seguem
> marcadas: elas são o filtro que trouxe aquelas linhas, e apagá-las tiraria o
> usuário do contexto em que estava trabalhando.

**Interseção, nunca substituição.** Vazio em qualquer nível = "todos". Conta +
campanha + conjunto se acumulam.

**A barra mostra só os níveis ACIMA do atual** — o que está marcado na própria
aba é seleção de ação em massa, não filtro dela mesma. Cada chip diz o nível
("campanha X", "conjunto Y"), remove individualmente, e há "Limpar seleção".

> ⚠️ **O estado vazio precisou de um caso novo**: *"Nenhum conjunto pertence ao
> que está selecionado nas abas acima."* Sem ele, a tabela vazia parece dado
> faltando. Vem **depois** do aviso de arquivados — aquele é o surpreendente
> (ninguém pediu por ele); este explica uma escolha do próprio usuário.

**Conferido na tela** (dev, 2 contas × 2 campanhas × 2 conjuntos × 2 anúncios):
marcar 1 campanha levou Conjuntos e Anúncios de "2 itens" para "1 item", com a
barra nomeando a campanha; marcar o conjunto acumulou o segundo chip e manteve
Anúncios em 1; a marcação sobreviveu a duas trocas de aba; contagem das abas e
linhas da tabela coerentes em todos os passos.

## 📋 FILA DE TRABALHO PENDENTE

Para referência direta: *"vamos para o item 3d"*. Ordem de prioridade definida
pelo usuário em 30/07/2026.

> ⚠️ **Os itens 3b e 3c foram VERIFICADOS no código e já estão feitos** — a fila
> original vinha de um levantamento antigo. Ver as notas em cada um. Confira
> antes de executar qualquer item desta lista: esta fila também envelhece.

### 🔴 EXCLUIR WEBHOOK ÓRFA AS VENDAS E APAGA O GATEWAY DELAS (31/07/2026)

**Não apaga venda** — `Sale.webhookId` é `onDelete: SetNull` e `deleteWebhook`
faz um `delete` seco, sem cascade. O faturamento histórico sobrevive, que é o
comportamento certo: quem troca de gateway não pode perder o histórico.

🔴 **Mas a PLATAFORMA é perdida para sempre.** `Sale` **não tem coluna
`platform`** — a única forma de saber de qual gateway uma venda veio é
`sale.webhook.platform`. Com o webhook excluído, a venda fica indistinguível de
uma ingerida por chave de API (que também nasce com `webhookId` nulo).

Consequências medidas no schema:

| | Efeito |
|---|---|
| Faturamento, KPIs, funil, globo | ✅ **intactos** — nenhum filtra por `webhookId` |
| Gateway de origem | 🔴 **perdido**, sem backfill possível |
| Área que filtre por webhook | a venda **sai** dela e cai na Principal |
| Venda de TESTE já ingerida | continua contando, e agora sem gateway para achá-la |

> ⚠️ **`SetNull` está certo; a falta da coluna é que não.**

✅ **CORRIGIDO em 31/07/2026** — migration `20260731030000_sale_platform`
(aditiva: `Sale.platform TEXT` nullable + índice `(userId, platform)`).
`receber.ts` passa `platform: dono.rotuloLog` para o `ingestSale`, que é a mesma
string do `WebhookLog` — de propósito, para as duas não divergirem.

`npm run backfill:platform` recupera o histórico **enquanto os webhooks
existirem**. Simula por padrão; lista as órfãs com data, produto, valor, status
e **id**, que é o que permite agir sobre uma linha específica.

> ### ⏳ ESTE BACKFILL TEM PRAZO
> Cada gateway que o usuário remove leva junto a procedência das vendas dele,
> **sem segunda fonte**. Rodar cedo salva mais história. As duas vendas da Cakto
> já se perderam assim, antes da coluna existir.

### 🔴 RELATÓRIO MULTI-USUÁRIO QUE AGREGA SEM SEPARAR (31/07/2026)

`origem-venda.mjs` listava as vendas órfãs **separadas por dono** e, no fim,
calculava o impacto com um `SUM` **sem `WHERE "userId"`** — somando o banco
inteiro. Saiu uma "distorção de 40,9% do faturamento" que **não era de conta
nenhuma**: misturava as vendas de teste do `teste@traffik.io` (a conta do seed)
com as do dono real.

**O usuário pegou o erro antes de apagar.** O número teria justificado excluir
dado para resolver um problema que a conta dele não tinha.

> ### ⛔ A REGRA
> **Toda métrica de diagnóstico é recortada por `userId`, e o total do banco não
> é exibido** — ele não corresponde ao dashboard de ninguém.
>
> O produto inteiro filtra por usuário. Um script que não filtra **está medindo
> outra coisa**, e o resultado é plausível o bastante para ninguém desconfiar.
> Foi por pouco que não virou exclusão de venda.
>
> ⚠️ Vale para qualquer script novo: `sonda`, `auditar`, `simular`, `inspecionar`.
> Se a saída tem um número somado, pergunte **de quem é esse número**.

⚠️ **Sintoma de reconhecimento:** o relatório *separa* na listagem e *soma* no
resumo. A listagem por dono dá a impressão de que o recorte está feito — e o
resumo desfaz, três telas abaixo.

⚠️ **Por que o erro passou, e é a parte reaproveitável:** a listagem **separava
por dono** e o resumo somava três telas abaixo. A separação visível na exibição
deu a impressão de que o recorte estava feito no cálculo também.

> ### ⛔ Relatório que separa na EXIBIÇÃO precisa separar no CÁLCULO
> Senão a separação vira **falsa garantia** — e é pior que não separar, porque
> quem lê já viu a divisão na tela e não desconfia do total.

### 🔴🔴 CREDENCIAL EM CÓDIGO-FONTE: a conta de seed em produção

`prisma/seed.ts` criava a conta com **senha literal no código**, e a conta
existia **no banco de produção** — foi lá que apareceram as 10 vendas de teste de
24-25/07 (`CERT-KV-1`, `CERT-API-1`, `burst-0..4`, `race-0..2`), resíduo dos
testes dos Blocos 10 e 13.

> ### ⛔ A REGRA: credencial em código-fonte é VAZAMENTO mesmo com o isolamento correto
> O isolamento por `userId` funcionava — a conta não via os dados do dono. E isso
> **não resolve nada**, porque o problema não é leitura de dado:
>
> **O isolamento protege os DADOS; ele não impede a SESSÃO.**
>
> Dentro daquela sessão dá para criar webhook, conectar perfil do Facebook,
> gerar chave de API e disparar eventos para a CAPI — no ambiente real, com
> qualquer pessoa que tenha lido o repositório.
>
> ⚠️ Não avalie "vazou credencial?" perguntando *o que ela consegue ver*.
> Pergunte *o que ela consegue fazer*.

#### ⛔ COMO ISSO ENTROU — e é o que faz voltar

Ninguém decidiu vazar nada. Alguém achou **útil anotar a credencial de teste na
documentação para não esquecer** — e isso é genuinamente conveniente. Depois, no
**mesmo formato e na mesma linha**, entrou a de produção:

```
Logins: teste@traffik.io / <senha> (vazio) · pedrodurso8@gmail.com / <senha> (dono)
```

O formato é o veículo. Uma vez que existe um lugar "onde as senhas ficam
anotadas", a próxima senha vai para lá sem ninguém reavaliar — inclusive uma que
abre a conta com o perfil do Facebook e 6 contas de anúncio reais.

> ### 🔴 DOCUMENTAÇÃO DE PROJETO É CÓDIGO VERSIONADO
> `CLAUDE.md`, `README`, `AGENTS.md` e comentário em migration vão no mesmo
> commit e no mesmo clone que o `.ts`. **A regra de credencial é idêntica** — não
> existe "é só a documentação".
>
> ⚠️ Credencial de TESTE não é exceção: ela é a porta de entrada do hábito. O
> lugar de qualquer senha é o `.env` (gitignored) ou o cofre do provedor.
>
> ⚠️ E é por isso que as 4 menções restantes da senha antiga foram **removidas
> deste arquivo** mesmo já estando inertes: enquanto o padrão de anotar
> credencial na documentação existir aqui, ele será seguido de novo.

**Corrigido em 31/07/2026, com DUAS travas independentes** — cada uma bastaria,
e é por isso que as duas ficam:

1. **`exigirBancoDeDesenvolvimento()` no `seed.ts`**, antes de abrir conexão.
   É o que impede a conta de **voltar a existir** em produção. Verificado: com
   o ref de produção na `DATABASE_URL`, `npx prisma db seed` é recusado.
2. **Senha por `SEED_PASSWORD`**; sem ela, uma **aleatória** é gerada e impressa
   uma vez. Não existe mais valor conhecido para vazar.

O `upsert` passou a reescrever o `passwordHash` no `update` — sem isso, rodar o
seed numa base que já tem a conta manteria a senha antiga, inclusive a
a senha literal legada. Rodar o seed virou a forma de rotacionar.

⚠️ **A correção não apaga a conta que já existe em produção.** Ela impede a
recriação. Apagar é operação manual — ver `npm run conta:inventario`.

### Auditoria de credenciais no repositório (31/07/2026)

| Onde | O quê | Veredito |
|---|---|---|
| `prisma/seed.ts` | senha literal da conta de seed | 🔴 **era real e em produção** — corrigido |
| `scripts/seed-dev.mjs` | `dev123456` | ⚠️ literal, mas o script **já tem** `exigirBancoDeDesenvolvimento()` — não alcança produção. Migrar para env quando conveniente |
| `src/lib/gateways/exemplos/cakto.ts` | `secret: "f8c3de3d-…"` | ✅ valor da **documentação** da Cakto, usado só pelo testador. Não cria nada |
| `src/generated/prisma/**` | `accessToken`, `secret` | ✅ falso positivo — são **nomes de coluna** do cliente gerado |
| `.env*` | tudo | ✅ gitignored (`.env*`, com `!.env.example`) |

> ⚠️ **Nenhuma senha de banco está versionada** — mas as do dev e da produção
> passaram pelo chat e seguem pendentes de rotação em Supabase › Settings ›
> Database. Isso é anterior a esta auditoria e continua aberto.

### ⚠️ `teste@traffik.io` EXISTE EM PRODUÇÃO, com senha documentada

Criado por `prisma/seed.ts` (com a senha literal, hoje corrigida), é a conta que `demo-data.mjs` mira.
Ela está **no banco de produção** — foi lá que apareceram as 10 vendas de teste
de 24-25/07 (`CERT-KV-1`, `CERT-API-1`, `burst-0..4`, `race-0..2`), resíduo dos
testes dos Blocos 10 e 13.

🔴 **A senha está escrita neste arquivo e no seed.** Qualquer um que leia o
repositório entra na produção com ela. Os dados são de outra conta e o
isolamento por `userId` se mantém — mas é uma sessão válida no ambiente real.

**Ação recomendada:** apagar o usuário em produção (o `User` tem 15 relações
`Cascade`, então leva junto vendas, cliques, eventos, webhooks e pixels dele) ou
trocar a senha. **Rodar `prisma db seed` contra produção recria a conta.**

### 🔴 MIGRATION QUE CRIA CONSTRAINT TEM DE FAZER O DADO SATISFAZÊ-LA

**31/07/2026 — `20260731040000_pixel_event_dedup` falhou em produção** com
`23505 — could not create unique index`, duplicata
`(…, PageView, PageView-nblqy2)`.

A causa imediata foi a ordem invertida (push antes da migration). Mas a lição
**não** é "siga a ordem":

> Uma migration que exige que o mundo já esteja num certo estado é **dependente
> de ordem** — e ordem se inverte. Deploy corre em paralelo com quem roda o
> comando, um retry acontece, alguém aplica na sequência errada. Se a única
> defesa é disciplina humana, ela falha eventualmente.
>
> **A migration tem de ser autossuficiente:** se cria constraint, ela mesma
> remove o que a viola, no mesmo arquivo e na mesma transação. Aí ela funciona
> em qualquer ordem, e rodar de novo é seguro.

⚠️ **Neste caso a janela era estreita e mesmo assim foi atingida.** O índice era
criável enquanto todo `eventId` fosse aleatório (não colidem nunca). Bastou o
código determinístico subir primeiro para a duplicata nascer — em minutos.

#### Respondendo às duas alternativas consideradas

| Alternativa | Veredito |
|---|---|
| **Migration limpa antes de criar o índice** | ✅ **é a correta.** `DELETE … USING` mantendo a linha mais antiga, e só então `CREATE UNIQUE INDEX` |
| Código fazer upsert tolerando a ausência da constraint | ❌ não era o problema. `createMany({ skipDuplicates: true })` **já** funciona sem o índice — sem ele apenas não deduplica, o que é degradação, não falha. O código estava certo; a migration é que não era |

#### Estado durante a falha, para a próxima vez

`CREATE UNIQUE INDEX` roda dentro da transação da migration, então a falha faz
**rollback completo**: o índice não existe, nenhuma coluna mudou, nenhum dado
foi tocado. O bloqueio é **só de contabilidade** — a linha em
`_prisma_migrations` com `finished_at` nulo. O schema fica íntegro.

#### ⚠️ Por que a `040000` NÃO foi retrofitada

Ela **já tinha sido aplicada com sucesso no banco de desenvolvimento**. Editar
um arquivo de migration já aplicado muda o checksum que o Prisma guarda, e o
`migrate deploy` seguinte passa a recusar com *"migration modified after being
applied"*. Corrigir o passado quebraria o dev para consertar a produção.

A saída foi **`npm run pixel:duplicatas`** (simula por padrão; mantém a linha
mais antiga de cada grupo, desempate por `id` para ser determinístico), seguido
de `migrate resolve --rolled-back` e nova aplicação.

**Exercitado no dev derrubando o índice, semeando 3+2 duplicatas e limpando:**
3 removidas de 3 previstas, 0 grupos restantes, e os sobreviventes foram
exatamente as linhas mais antigas de cada grupo.

### ⛔ REGRA PERMANENTE: excluir configuração não pode apagar a PROCEDÊNCIA

Já existia a metade fácil da regra — *exclusão de configuração nunca destrói
dado de negócio* —, e ela estava sendo cumprida: `SetNull` em vez de `Cascade`.
Faltava a outra metade:

> **Guardar só a FK para a configuração deixa o dado órfão de CONTEXTO quando
> ela some.** O dado sobrevive e deixa de significar alguma coisa.
>
> Todo atributo que responde *"de onde isto veio?"* tem de ser **copiado para a
> linha no momento em que ela nasce**, não derivado por `join` na hora da
> leitura. O `join` é conveniência; a cópia é o registro.

**Auditoria das 15 relações `SetNull` do schema — um segundo caso, e é grave:**

| Relação | Procedência em risco | Veredito |
|---|---|---|
| `Sale.webhookId` | gateway de origem | ✅ **corrigido** (`Sale.platform`) |
| `Sale.apiCredentialId` | veio por chave de API | ✅ coberto — o backfill grava `platform: "API"` |
| 🔴 **`Sale.clickId`** | **campanha, criativo, fonte, UTMs** | ⚠️ **ABERTO** |
| `AdAccount.adProfileId` | perfil do Facebook | tolerável: a conta guarda `act_id` e nome próprios |
| `Notification.saleId` | venda que gerou o aviso | tolerável: a notificação carrega o texto |
| `*.workspaceId` (9×) | área | não é procedência — área é recorte, e é reatribuível |

> ### 🔴 `Sale` NÃO guarda cópia dos UTMs
> A campanha de uma venda é `sale.click.utmCampaign` — não existe
> `Sale.utmCampaign`. Como `clickId` é `SetNull`, **apagar o clique faz a venda
> perder a campanha para sempre**, mantendo o dinheiro. É exatamente o mesmo
> defeito do gateway, num campo que vale mais: é dele que saem ROAS, CPA e a
> atribuição por área.
>
> Hoje o único caminho que apaga clique é "apagar dados" na exclusão de área
> (atrás de duas travas), então o risco é baixo — mas é a **mesma classe**, e a
> correção é a mesma: copiar `utmSource`/`utmCampaign`/`utmContent` para a
> `Sale` na ingestão. **Não implementado; decisão do usuário pendente.**

### 🧪 PASSO OBRIGATÓRIO ao adicionar gateway: como ele sinaliza EVENTO DE TESTE

Acrescentado ao roteiro de 5 passos de `lib/gateways/` como **passo 0**, porque
tem de ser respondido **antes** de conectar em produção:

> **Descubra como o gateway marca um evento de teste, e declare isso no
> registro.** Se não houver sinal, **avise o usuário de que todo teste de
> webhook dele vai contar como venda real** — no faturamento, no CPA, no funil e
> no globo.

Não é hipótese: a Cakto ingeriu `Produto Teste / R$ 90,00` como venda, e a linha
**ainda conta**, agora sem gateway para achá-la (foi removida antes da coluna
`platform` existir). Um gateway novo repete isso por omissão.

⚠️ **O sinal tem de ser ESTRUTURAL** (`test: true`, ambiente declarado, id
reservado) — **nunca o nome do produto**. Detectar "Produto Teste" apagaria a
venda real de quem chame o produto assim.

### 🧪 Evento de TESTE da Cakto conta como venda real — PENDENTE

O webhook de teste da Cakto ingeriu `Produto Teste / R$ 90,00` e a linha
**conta no dashboard como venda**. Não há noção de "evento de teste" em lugar
nenhum do contrato de gateways.

**Bloqueado por falta do payload real.** Suspeita forte: ela reenvia o exemplo
da documentação verbatim — `exemplos/cakto.ts` tem `product.name: "Produto
Teste"` e `amount: 90`, que batem com o observado. **Não detectar por nome de
produto** (apagaria venda real de quem chame o produto assim); o sinal tem de
ser estrutural.

⚠️ **Enquanto isto não for resolvido, todo teste de webhook na Cakto vira
faturamento.** O usuário removeu a Cakto em 31/07/2026, então a investigação só
retoma quando ele reativar:

```bash
npm run venda:inspecionar -- --url '<conn>' --gateway CAKTO --n 5
```

### 🔌 Vias de atribuição por gateway — decisão de 31/07/2026

> ### ⛔ CAMPANHA precisa de CERTEZA. PAÍS precisa só de PLAUSIBILIDADE.
> Tratar as duas com o mesmo mecanismo faz pagar o preço da certeza para
> resolver a segunda. Errar a campanha move dinheiro entre campanhas e envenena
> a otimização; errar o país move um ponto no globo.

| Uso | Via aprovada |
|---|---|
| **Atribuição (campanha)** | **A** (parâmetro ecoado pelo gateway, uma linha no `REGISTRO`) + **B** (`fbc`/`fbp`, já pronto) |
| **País, e só país** | **D** (beacon de checkout com `click_id`, casado por proximidade de tempo + produto) — **com `countrySource` próprio**, para a confiança ficar registrada |
| Recusadas | **C** (e-mail pré-checkout: a maioria dos funis não coleta) |

| Gateway | `click_id` ecoado (A) | `fbc`/`fbp` (B) | IP do comprador |
|---|---|---|---|
| **Kirvano** | `src` ✅ | só `fbp` | ✅ `customer.ip` |
| **Cakto** | `sck` ✅ | ✅ os dois | ❌ |
| **OnyxPag** | 🔴 `tracking` **não volta** no webhook documentado | ❌ nenhum | ❌ |

> ### 🔴 A OnyxPag não tem via de atribuição NENHUMA
> A, B e E falham nela por desenho. Venda dela entra **sem campanha, sem
> criativo e sem país**, dependendo só do fallback. **A interface precisa
> avisar** — a capacidade já está declarada no registro, falta a tela ler.

### 0. GERENCIADOR — (a) e (b) FEITOS em 31/07/2026

**(a) Drill-down por campanha** → ✅ feito. Ver "Drill-down" abaixo.

> ⚠️ **Interseção com o filtro de conta, nunca substituição.** Nenhuma
> selecionada = mostra todas. A seleção sobrevive à troca de aba.
>
> É **generalização** do filtro de conta que já existe (`contasFiltro` +
> `daConta()` em `AdsManagerView`), não código novo. Se virar um segundo
> mecanismo paralelo, está errado — os dois vão divergir, como já divergiram a
> contagem das abas e o filtro da tabela.
>
> Custo: só cliente e interface. Sem schema, sem sync, sem migration — portanto
> sem ordem de deploy e sem risco em produção.

**(b) `effective_status`** → ✅ feito. Ver "Status de VEICULAÇÃO" abaixo.

### 0b. PRÉVIA DA REGRA → ✅ FEITO (31/07/2026)

Ver "Testar condição" abaixo. O que segue é o desenho, mantido porque explica
**o que foi recusado** e por quê.

#### Como ficou

| Peça | Onde |
|---|---|
| `previewRule(rule)` | `lib/rules/engine.ts` — reusa `loadEntities` + `conditionsMet` |
| `analisarCondicoes(conds)` | `lib/rules/analise.ts` — puro, sem dado nenhum |
| `previewRuleConditions(input)` | `lib/actions/rules.ts` — recebe o RASCUNHO, não um id |
| Botão "Testar condição" | `views/rules/RuleDrawer.tsx`, dentro do bloco Condições |

> ### 🔴 A prévia REUSA o motor — nunca uma segunda implementação
> Ela é uma **promessa do que o motor vai fazer**. Uma segunda cópia da
> avaliação divergiria da primeira, e a prévia passaria a prometer uma coisa
> enquanto o motor faz outra — pior que não ter prévia, porque cria confiança
> falsa em algo que mexe em orçamento real.
>
> `previewRule` para **antes** do caminho de ação: não chama `setEntityStatus`
> nem `updateDailyBudget`, não grava log, não mexe em `lastRunAt`.

> ⚠️ **A prévia NÃO aplica janela de horário nem limite diário**, de propósito.
> A pergunta é sobre a CONDIÇÃO ("bate em quem?"), não sobre "rodaria neste
> minuto?". Misturar as duas faria a prévia responder "0" às 3h da manhã por
> causa da janela, e o usuário concluiria que a condição está errada.

> ⚠️ **O resultado é descartado quando o rascunho muda.** `chavePrevia` cobre
> condições, nível, contas, período e produtos. Número velho ao lado de condição
> nova é pior que número nenhum — parece confirmação.

> ⚠️ **Quando nada bate, ela lista o que foi AVALIADO** (com "·" em vez de "✓").
> Uma tela muda justamente quando o usuário precisa entender *por que* não bateu
> seria o pior momento para ficar calada.

#### 🔴 BATER a condição ≠ SER ALTERADA (corrigido em 31/07/2026)

A primeira versão contava só quem satisfazia a condição, e isso **exagerava**.
Numa conta em que **todas as campanhas são ABO** — o caso real do usuário, 13 de
13 —, uma regra de orçamento bate em todas e altera **nenhuma**. Um número que
exagera ensina o usuário a ignorá-lo, que é o oposto do objetivo.

A prévia devolve `agiria` além de `bateram`, e cada linha traz **o motivo do
pulo**: `sem orçamento diário (CBO?)`, `já pausada`, `já ativa`, `já no teto
(R$ …)`, `recusado: aumento sem teto de orçamento configurado`.

> ### 🔴 `planejarAcao` — a decisão foi EXTRAÍDA do motor, não copiada
> Ela decide se a ação agiria e qual seria o novo orçamento, e é chamada pelos
> **dois**: o laço de `evaluateRule` e a prévia. Reimplementar a regra do teto
> na prévia produziria o pior resultado possível — uma prévia que promete uma
> coisa e um motor que faz outra, num código que mexe em orçamento real.
>
> ⚠️ O campo `ok` do plano preserva a semântica do log: pulo esperado ("já
> pausada", "já no teto") conta como sucesso; recusa ("sem teto", "sem
> orçamento") não. É o que alimenta `affected` — mexer ali muda o que a
> ferramenta reporta como feito.

> ⚠️ **A ação e seus parâmetros entram na `chavePrevia`.** Eles não mudam quem
> BATE, mas mudam quem a ação ALCANÇA — trocar de "pausar" para "ajustar
> orçamento" com o número antigo na tela seria a pior forma de mentir.

#### O que a análise estática pode e não pode afirmar

`lib/rules/analise.ts` só emite o que é demonstrável **por álgebra**:

1. **Contradição** — `Gasto > 100 E Gasto < 50` nunca é verdadeira.
2. **Piso das métricas** — `cpa`, `roas`, `ctr`, `gasto` e `vendas` são todas
   ≥ 0 por construção em `metricValue`, então `gasto ≥ 0` é sempre verdadeira e
   `gasto < 0` nunca é.

> ### ⛔ `gasto ≤ 999999` NÃO gera aviso estático — e isso é a decisão, não uma falha
> Provar que "999999 é grande" exigiria conhecer a faixa plausível de cada
> métrica. Erraria nos dois sentidos, e **um aviso que às vezes mente treina o
> usuário a ignorar todos os avisos** — inclusive os dois acima, que são certos.
>
> Quem responde "isso pega tudo?" é a PRÉVIA, contando: ela mostra
> **"Bate em 2 de 2"** em âmbar, com a frase *"a condição bate em tudo que está
> no escopo; se a ideia era filtrar, confira o operador"*. Contar em vez de
> adivinhar é a regra deste módulo.
>
> ⚠️ **ROI está fora da lista de propósito**: ele pode ser negativo (o piso é
> −1). Não é métrica de regra hoje; se entrar, o piso dele **não é 0**.

**Testado:** `npm run test:analise-regra` (32 asserções puras, várias delas
provando o que o módulo **se recusa** a afirmar) + `npm run test:previa-regra`
(16 asserções contra o banco de DEV: escopo igual ao do motor, arquivada fora,
o caso `≤ 999999` × `≥ 999999`, e **nada muda no banco depois de rodar**).
**Conferido na tela** com os dois operadores: `≤ 999999` → "Bate em 2 de 2" em
âmbar com o aviso; `≥ 999999` → "Bate em 0 de 2" em cor neutra, listando as duas
avaliadas com o gasto real.

> 🐛 **O primeiro `teste-analise-regra.mjs` deu 29 falsos negativos**: o helper
> `eq` comparava com `===` e quase toda asserção devolve um ARRAY, então
> comparava identidade de referência — "obtido" e "esperado" saíam idênticos na
> tela e o teste falhava. O módulo estava certo desde o início. Hoje o helper
> compara por `JSON.stringify`. **Teste que falha imprimindo dois valores iguais
> é bug do teste, não do código.**

#### Desenho original (mantido para referência)

A condição `gasto ≤ 999999` (pega tudo) é **visualmente idêntica** a
`gasto ≥ 999999` (não pega nada), e nada no produto distingue as duas até a
regra rodar. Ver "O ENSAIO A SECO DISPAROU".

> ### ⛔ NÃO implemente isto como heurística de "condição trivial"
> A tentação óbvia é um aviso do tipo *"`≤ 999999` provavelmente pega tudo"*.
> Isso é chute com cara de garantia: depende de saber a faixa plausível de cada
> métrica, erra nos dois sentidos, e um aviso que às vezes mente treina o
> usuário a ignorá-lo — o mesmo defeito do aviso âmbar que aparece sempre.
>
> **A resposta certa não é adivinhar, é CONTAR:** um botão *"Testar condição"*
> na gaveta que roda a avaliação sem agir e responde
> **"bate em N de M campanhas agora"**. Com `≤ 999999` teria dito "1 de 1", e o
> erro seria visível antes de salvar.
>
> Ele **reusa `loadEntities` + `conditionsMet`** — a mesma avaliação do motor,
> nunca uma segunda cópia (o motor divergiria da prévia, e a prévia é justamente
> a promessa do que ele vai fazer). O caminho de ação fica de fora: prévia não
> chama `setEntityStatus` nem `updateDailyBudget`.
>
> É o Passo 0 do plano da Graph API virando **funcionalidade** em vez de
> procedimento manual — e é o que teria evitado o disparo acidental.

**Complemento barato, este sim determinístico:** contradição entre condições
(`gasto > 100 E gasto < 50` nunca bate) e limite inferior conhecido (toda
métrica é ≥ 0, então `métrica ≥ 0` é sempre verdadeira e `métrica < 0` nunca é).
Esses dois são demonstráveis sem dado nenhum, ao contrário de "999999 é muito".

### 1. CAKTO + arquitetura universal de gateways — **PRÓXIMO**

Segundo gateway, com a camada de parsers que suporta muitos outros depois.
**Destrava o item 2.**

> ### ✅ O CRITÉRIO DE ACEITE: o teste do décimo gateway
> **Integrar o 10º gateway tem de custar um arquivo de parser + o cadastro da
> plataforma. Zero mudança em qualquer outro lugar.**
>
> Se integrar o próximo exigir mexer em rota, em `ingestSale`, na UI de
> Webhooks, num `switch` ou num `if` de plataforma, **a arquitetura falhou** —
> não importa quão limpo esteja o parser. O teste não é "o código está bonito",
> é "quantos arquivos eu toco".
>
> Hoje a rota `/api/webhook/sale/[webhookId]` já escolhe o parser pela
> `platform`, e o `GATEWAYS` da `WebhooksView` já é um array extensível. Os dois
> são o embrião certo — o trabalho é levar isso até o fim, não recomeçar.

> ### 🎛️ CAPACIDADES são propriedade do REGISTRO, nunca caso especial no código
> Gateways diferem no que conseguem entregar, e **essa diferença tem de ser
> declarada como dado**, ao lado do parser:
>
> | Capacidade | Por que importa | Se faltar |
> |---|---|---|
> | **Manda o IP do comprador?** | é a fonte confiável do país da venda | a venda cai no fallback do clique, e **55,6% do tráfego humano passa pelo datacenter da Meta** — o país vira estimativa |
> | **Manda `fbc`/`fbp`?** | melhora a correspondência na CAPI | perde sinal de atribuição |
> | **Manda taxas já calculadas?** | evita recalcular gateway/imposto | o cálculo cai em `lib/financeiro.ts`, com as taxas cadastradas |
> | **Manda telefone? Em que formato?** | E.164 antes do hash da CAPI | ver `lib/facebook/telefone.ts` |
> | **Reentrega o mesmo evento?** | idempotência | já coberto pelo upsert monotônico |
>
> ⚠️ **Declarar, e não descobrir por `if`.** Um `if (platform === "CAKTO")`
> espalhado pela ingestão é exatamente o que faz o 10º gateway custar caro. A
> capacidade vira campo do registro; o código lê o campo.
>
> ⚠️ **A tela precisa ler isso.** É o que permite avisar "este gateway não manda
> o IP do comprador, então o país destas vendas é estimado" — hoje o chip âmbar
> "estimado" do ranking já existe e é alimentado por `countrySource`. A
> capacidade declarada é o que torna o aviso **preventivo** em vez de
> retrospectivo.
>
> A tabela por gateway já iniciada está em "REQUISITO DE TODA INTEGRAÇÃO DE
> GATEWAY NOVA" — **Kirvano ✅ confirmado com 15 vendas reais**, os demais ❓.

> ### 🔴 Restrição que vale desde já
> **O reprocessamento PRECISA preservar `country`/`countrySource` quando já não
> são nulos.** `ingestSale` recalcula `paisDaVenda` a cada ingestão e a 2ª fonte
> é o IP do payload — reprocessar com o IP removido (item 2) faria o país
> recalculado **piorar**, caindo para o país do clique ou para o texto cru.
>
> Sem essa regra, a primeira correção de parser que rodar degrada
> geolocalização que já estava certa.

Hoje só a **Kirvano** tem parser dedicado (`parseKirvano.ts`), mais o
`normalizeSale` genérico. Ver "REQUISITO DE TODA INTEGRAÇÃO DE GATEWAY NOVA" —
a pergunta obrigatória é **se o gateway manda o IP do comprador no payload**.

### 2. FASE A — limpeza do IP nos payloads — **ADIADA**

**Pré-condição: a arquitetura de parsers do item 1 estar estável**, e não haver
mais nada a reprocessar. O payload cru é a única fonte para refazer uma venda
com um parser corrigido.

**Versão preferida: remover só o campo de IP**, preservando o resto. Substituir
o valor (`"ip": "[ip removido]"`), **não apagar a chave** — apagá-la muda a forma
do payload e faz depurar contra um formato que nunca chegou. Detalhes completos
na seção "🔐 Passo 7".

### 3. FILA DE UX — nunca executada, ~5 sessões

**(a) Microcópia** — textos com termo técnico ou plural entre parênteses.

> ⚠️ **A lista de ~52 reescritas NÃO existe no repositório.** Procurei: o que
> está documentado são os ~30 textos **já reescritos** (grupos 1 e 2) e os
> grupos 3 e 4, que viraram tooltips em `lib/explicacoes.ts`. **O levantamento
> precisa ser refeito**, não recuperado.
>
> Ao refazer: `lib/explicacoes.ts` é mais completo do que parece — confira antes
> de "adicionar tooltip". E vale a regra permanente: **simplifique jargão de
> PROGRAMAÇÃO, nunca de TRÁFEGO.** ROAS, CPA, CBO, pixel e gateway são o
> vocabulário nativo do usuário.

**(b) Scripts e snippets em gaveta** — ✅ **JÁ FEITO.** Verificado: `UtmsView`,
`PixelView` e `WebhooksView` usam `Drawer`/`CampoCopiavel`. A URL do webhook
visível já é a exceção prevista.

**(c) Padronização de controles** — ✅ **JÁ FEITO.** Verificado no código:

| | Alegado na fila | Real |
|---|---|---|
| `<select>` nativos | ~22 em 8 arquivos | **0**, fora das 2 exceções documentadas (mês/ano do `DateRangePicker`, `test-checkout`) |
| Checkboxes nativos | 7 | **0** (a única ocorrência é um comentário) |
| Ícones `0 0 256 256` | dois sistemas | **0** — `Icon.tsx` foi deletado; a única ocorrência é um comentário histórico |

**(d)** ⚠️ **ESCOPO REDUZIDO em 01/08/2026** — ver "ITEM (d) — escopo NOVO". Não é mais varrer 23 blocos: são 4 tipos de overlay + os condicionais.

**(d) PROMPT J — responsividade em duas dimensões** (viewport e container).
Inclui os dois casos confirmados:
- Rodapé do funil — ✅ **resolvido** (`min-height:0`; a causa é genérica, ver a
  seção própria)
- ⏳ **Varredura de elementos condicionais** — semear dados que ativem **cada**
  caminho (estados de erro, avisos, rodapés, badges, chips) e conferir **cada um
  na tela**. A auditoria feita deu "0 de 23", mas só prova que não há transbordo
  **naquele estado de dados**.

**(e) Espaço mal aproveitado nas abas** — ✅ **FEITO.** Webhooks, UTMs, Taxas e
Pixel em 30/07/2026; **Testes e Notificações em 31/07/2026** (ver a seção
própria). Áreas e Regras **não têm restrição de largura** — o item da fila
estava desatualizado.

**(g)** ✅ **FEITO em 01/08/2026** — ver "COMECE AQUI". O que segue é o desenho
original, mantido porque explica o que foi recusado (o preset) e por quê.

**(g) 🔴 REGRAS EM DUAS REGIÕES — prioridade ACIMA do (f)** *(decidido em
31/07/2026)*

Herdar da gaveta do Pixel reformada as duas coisas que transferem, e só elas:

1. **Separação por região, com selo** — o análogo do `⟳ muda o script` × `⚡ vale
   na hora`:

   | Região | Selo |
   |---|---|
   | Ação, teto de orçamento, escopo (contas/produtos/nível) | **mexe na sua conta do Facebook** |
   | Período de cálculo, frequência, intervalo de execução, limite diário | **só decide quando roda** |

2. **Esconder no avançado** o que tem padrão sensato: intervalo de execução,
   limite diário e período de cálculo. De ~11 controles visíveis para ~5 (nome +
   escopo + condição + ação).

> ### 🔴 Por que isto vale MAIS que na gaveta do Pixel
> Lá o pior caso de misturar as regiões era **script defasado**. Aqui um dos
> grupos **move dinheiro real** — pausa campanha e altera orçamento sozinho, de
> madrugada — e hoje os dois estão **intercalados** na mesma gaveta.

> ### ⛔ NÃO invente uma pergunta única aqui
> A terceira ideia da gaveta do Pixel — *uma pergunta em vez de vinte escolhas* —
> **não transfere**, e isso foi avaliado e recusado em 31/07/2026. Ela funciona lá
> porque existe um caso comum de verdade (infoprodutor com o pixel do Facebook já
> na página) que deriva os demais campos. Numa regra não existe caso comum: a
> escolha da ação **é** a decisão. Um preset aqui inventaria uma pergunta, que é o
> oposto do objetivo.
>
> Pelo mesmo motivo isso não vale para as outras telas: Webhooks já é montada do
> registro, Áreas já foi reduzida a três campos na Sessão 3, e Notificações são
> booleanos independentes — lá o que faltava era tornar visível a dependência
> (com os dois alertas desligados, os quatro "Exibir na notificação" não aparecem
> em lugar nenhum), e isso já foi acrescentado.

**(f)** ✅ **FEITO em 01/08/2026** — ver "COMECE AQUI". Os tooltips ⓘ nas métricas
já existiam em `lib/explicacoes.ts` desde os grupos 3 e 4; o que faltava eram os
7 estados vazios mudos e o checklist que mostrava a área errada.

**(f) Camada didática** — estados vazios que ensinam, indicador de progresso de
configuração, tooltips ⓘ nas métricas.

### 4. RAMOS NUNCA EXERCIDOS — mapeado, sem ação

`cities`, `regions` e `country_groups` em `paisesDaSegmentacao` (`sync.ts`).
Cobertos por asserção e **nunca rodaram contra resposta real da Graph API** — a
sonda de 30/07/2026 mostrou 12 conjuntos, todos pelo caminho simples
(`countries`), zero dos outros três.

Aparecem quando o usuário criar campanha segmentada por cidade/região, ou usar
grupo de países. **`country_groups` é o mais arriscado**: não é expandido de
propósito, então uma campanha "Europa" produz lista vazia e simplesmente não
desempata — comportamento correto, mas silencioso.


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

## 🔴 TESTES COM USUÁRIOS REAIS (04/08/2026) — as TRÊS RAÍZES

Primeira rodada com testadores de verdade. Os ~16 problemas relatados não são
16 causas: são **três**, e cada uma aparece em telas diferentes com cara
diferente. Classificar por raiz é o que evita consertar o mesmo defeito quatro
vezes e deixar a quinta ocorrência de pé.

### Raiz 1 — MAIS DE UMA IMPLEMENTAÇÃO DA MESMA CONTA

Já conhecida (foi assim que a tela de Áreas passou a dizer "Sem webhook" para
uma área com webhook), mas ainda não estava valendo para o **dinheiro**.

**Existem TRÊS "ROI" e TRÊS "lucro" no produto:**

| Onde | ROI | Lucro |
|---|---|---|
| Dashboard | `lucro líquido ÷ custoTotal` (`lib/financeiro.ts`) | líquido − anúncios − recorrentes |
| Gerenciador | `(faturamento − gasto) ÷ gasto` (`lib/ads/metrics.ts`) | bruto, sem taxas |
| Taxas e Despesas | — | `revenue − spend − expenses.total` (`useTraffikState`) |

> ⚠️ **A terceira reimplementa o cálculo e erra**: `expenses.total` é
> `fin.totalDescontos`, que **exclui as despesas recorrentes**. O painel mostra
> a linha "Despesas − R$ X" e **não a subtrai** do Lucro exibido. O mesmo erro
> está no tooltip do ROI (`spend + expenses.total`). Só não aparece para quem
> tem despesa zerada. E o painel não tem linha de coprodução nem custo de
> produto, então com esses cadastrados ele deixa de fechar visualmente.

### Raiz 2 — ATRIBUIÇÃO INCOMPLETA, tratada de 4 jeitos diferentes

A venda que não cola numa campanha existe, e **cada tela decide sozinha o que
fazer com ela**:

| Tela | O que faz com o não atribuível |
|---|---|
| Dashboard | soma tudo (correto: é nível de conta) |
| Gerenciador, nível campanha | ignora, e **herda dos filhos** com `\|\| agg.X` |
| Gerenciador, conjunto e anúncio | 🔴 `results: 0, revenue: 0` **fixos no código** |
| Funil | conta em etapas de fontes diferentes |

> ### 🔴 Conjunto e anúncio NUNCA tiveram faturamento
> `overview.ts` monta `adRows` e `adSetRows` com `results: 0, revenue: 0`
> literais. Não é o drill-down que "perde as métricas" — é que naquele nível o
> número nunca existiu. O drill-down só levou o usuário até onde o zero mora.

> ### ⚠️ `splitPipe` rejeita o ID e ACEITA o NOME
> `{{campaign.name}}|{{campaign.id}}` vira `campaignId: null` (bom, o id não é
> numérico) e `campaignName: "{{campaign.name}}"` (ruim: entra no balde de
> atribuição por nome). **Não existe verificação de chaves duplas nem de `%7B`
> em lugar nenhum** — nem no parser, nem em `/api/track/click`, nem na ingestão.
> Template não substituído significa que o clique **não veio de entrega de
> anúncio** (preview, crawler, link colado): o destino certo dele é tráfego
> direto.

### 🔴 Raiz 3 — CONTROLE QUE NÃO CONTROLA NADA

**A mais perigosa das três**, e a que motivou a varredura: são controles que o
usuário mexe acreditando ter mudado alguma coisa. Não há erro, não há log, e a
tela **confirma** a escolha — só o comportamento não muda.

> ### ⛔ É pior que código morto, e por um motivo específico
> Código inerte (os casos anteriores do PROCEDIMENTO) não faz nada e ninguém
> depende dele. Um **controle** inerte é pior: ele produz uma crença. O usuário
> desliga o rastreamento de uma conta, vê o toggle desligado, e **decide com
> base nisso**. A tela virou a fonte de uma informação falsa.
>
> **Ao entregar um controle, o teste não é "salva?" — é "quem LÊ o que ele
> salvou?".** É o mesmo `grep` do PROCEDIMENTO, aplicado do lado da escrita.

### Varredura completa dos controles (04/08/2026)

Todo `<Checkbox>`, `<Select>` e `role="switch"` do produto, rastreado até o
consumidor. **4 inertes de ~40.**

| Controle | Onde | Veredito |
|---|---|---|
| 🔴 **Toggle da aba Contas** | Gerenciador | **no-op absoluto** — `nivel` é `null` e o handler era `if (nivel) …`. ✅ **corrigido** |
| 🔴 **Rastreamento da conta** | Integrações › Anúncios | salva `trackingEnabled`, e **nada em `computeAdsOverview`/`computeDashboard` filtra por ele**. Desligar só afeta sincronizações futuras; a listagem e o gasto continuam |
| ✅ **Produtos da regra** | Regras | a gaveta gravava `targetProducts` (plural) e o motor lia `targetProduct` (**singular**, legado), que a gaveta nunca preenche. **Uma regra restrita a um produto agia sobre TODOS** — com o card escrevendo o nome escolhido. **Corrigido em 04/08/2026**: `produtosDaRegra()` une as duas colunas, e a prévia usa a mesma função |
| 🔴 **"Nome do dashboard"** | Notificações | `showDashboardName` é salvo, viaja no DTO e `dispatchNotification` usa os outros três `show*` e **não usa este** |
| ⚠️ "Fixar" | Gerenciador | inerte por decisão declarada (só de sessão) — não conta |
| ✅ demais ~35 | — | rastreados até um consumidor real |

> ⚠️ **Os dois primeiros são a mesma coluna vista dos dois lados**: um não
> chamava a action, o outro chamava e ninguém lia o resultado. Consertar só o
> toggle teria deixado o usuário com um controle que agora responde e continua
> sem efeito — que é pior, porque passa a parecer que funciona.

> ✅ **`targetProducts` foi ligado em 04/08/2026, e o que tornou isso barato foi
> a MEDIÇÃO.** O risco era mudar o escopo de regras já cadastradas em silêncio —
> nos dois sentidos, porque uma regra criada achando que era global e que passa
> a ser restrita também é mudança silenciosa. O `diag:testadores` respondeu
> **zero regras nos dois usuários**, então não havia comportamento existente
> para quebrar: sem migração, sem aviso, sem backfill.
>
> ⚠️ **Se houvesse regra ativa, o caminho seria outro** — avisar antes, ou fazer
> a UI dizer a verdade em vez de mudar o motor. Não repita o atalho sem refazer
> a contagem.

> ### 🔴 O que ESCONDEU este bug: `rule as unknown as RuleRow`
> O motor carrega as regras com `findMany` (sem `select`, então todas as colunas
> vêm) e converte com um **cast duplo**. É ele que fez `targetProducts` faltar
> na interface `RuleRow` sem o compilador dizer nada.
>
> **Coluna nova no schema precisa ser acrescentada à `RuleRow` à mão.** O cast
> não avisa — é a mesma família da armadilha do `pedidoId` fora do `select`,
> só que do lado do tipo em vez do lado da consulta.

### 🔴 7º caso do PROCEDIMENTO: comentário que afirma o CONTRÁRIO do código

`dispatchPixel.ts` enviava `eventId: sale.id` com o comentário
`// dedup com o pixel do navegador`. **A dedup do Purchase nunca funcionou** —
e não é regressão: está assim desde `f62d2db`, o primeiro commit do pixel.

`sale.id` é um cuid do nosso banco. Nenhum pixel de navegador consegue
reproduzi-lo, e o **nosso script nunca dispara `Purchase`** (é server-side; a
rota `/api/pixel/event` o recusa explicitamente). Nunca houve par para a Meta
juntar.

> ### ⛔ Os casos anteriores eram código INERTE. Este era código ATIVO com uma
> ### legenda falsa.
> Ele rodava, em toda venda, fazendo exatamente o que o código dizia — e o
> comentário descrevia um efeito que não existia. Todo mundo que leu aquela
> linha (inclusive eu, em três sessões) concluiu que a duplicata estava
> resolvida e foi procurar o problema em outro lugar.
>
> **Comentário que afirma um efeito é uma afirmação testável.** Se ele diz
> "isto deduplica", tem que existir o outro lado do par — e o `grep` que
> procura o outro lado leva 10 segundos.

**A correção é PARTIÇÃO**, não coordenação — não existe id compartilhável aqui.
Ver `lib/pixel/preset.ts`: o preset ganhou uma **segunda pergunta** ("alguém
mais já avisa o Facebook quando a venda é aprovada?") que decide o dono do
`Purchase`.

> ### ⛔ São DUAS perguntas porque são DUAS páginas
> `temPixelNativo` fala da **página de vendas**; o `Purchase` é disparado na
> **página de obrigado ou no checkout do gateway**, que quase nunca é do
> usuário. Derivar uma da outra erra nos dois sentidos: "tem pixel ⇒ ele manda
> o Purchase" faz quem só tem pixel na página de vendas **perder toda venda na
> Meta, em silêncio**; o contrário é o bug atual.

> ⚠️ **O padrão continua sendo "a Traffik envia"**, e é escolha: não enviar
> perde conversão sem nada denunciar; enviar duplicado aparece no Gerenciador
> de Eventos. Mesma regra do `lerDonos`. Por isso o **aviso âmbar aparece na
> resposta PADRÃO**, ao contrário de quase todo aviso do produto — é ela que
> custa caro quando está errada, e o usuário não tem como saber o que o
> checkout do gateway dele faz sem ir olhar.

> ### ⚠️ `Purchase` saiu da assinatura do script (detectores v3)
> O dono do Purchase **não muda o script** (ele nunca sai do navegador), mas
> entrava em `ORDEM_EVENTOS` e em `eventosAlheios` — então trocá-lo mudava o
> hash e a gaveta mandava **regerar e recolar o snippet à toa**. Aviso que às
> vezes mente treina o usuário a ignorar todos.
>
> `VERSAO` foi para `v3` e a comparação de `hashDonos` passou a exigir
> **mesma versão** nos dois lados: um script v2 instalado reporta um hash
> calculado sobre outro conjunto de eventos, e compará-lo acusaria divergência
> em 100% dos scripts v2 corretos.

### ⚡ O N+1 do sync saiu (04/08/2026)

`syncAccountMetrics` e `syncAccount` faziam **um `upsert` por linha de insight**,
em série. Conta com 48 anúncios × 2 dias = **96 idas ao Supabase**: a ~99 ms de
latência, ~9,5 s só de rede, dentro de um `after()` com `maxDuration`.

Medido em produção: as contas de **48 e 28 anúncios nunca gravaram métrica
nenhuma**; a de **4 anúncios** funcionava. É a assinatura de estouro de tempo —
a função morre, a reserva do `autoSync` fica presa até expirar (10 min), tenta
de novo e morre de novo.

Agora é `gravarMetricas()`: **uma instrução por lote de 500 linhas**.

> ### ⛔ `createMany({ skipDuplicates: true })` NÃO serve aqui
> Ele pula a linha que já existe — e a linha de HOJE sempre existe, porque o
> gasto do dia corrente é reescrito a cada ciclo enquanto a campanha entrega.
> **O gasto congelaria no primeiro valor do dia**, com o número continuando
> plausível. Tem de ser `ON CONFLICT DO UPDATE`.

> ### ⚠️ As duas colunas que o Prisma preenche e o SQL cru não
> | Coluna | Por que quebraria |
> |---|---|
> | `id` | `@default(cuid())` é gerado na APLICAÇÃO; no banco é `NOT NULL` **sem default** |
> | `updatedAt` | `@updatedAt` também é do cliente; o INSERT violaria `NOT NULL` e o UPDATE deixaria o valor velho |
>
> `timezone('UTC', now())` e não `now()`: a coluna é `timestamp WITHOUT time
> zone` guardando UTC, e `now()` seria convertido pelo fuso da SESSÃO.
>
> ⚠️ O dia viaja como **string `YYYY-MM-DD`** até o `::date` do SQL. O
> `new Date(ins.date_start)` que existia transformava o dia num instante — a
> origem clássica de bug de fuso neste projeto.

`npm run test:metricas-lote` — 16 asserções contra o banco de DEV: inserção,
atualização pelo `ON CONFLICT` (a que o `skipDuplicates` não faria), `id` e
`updatedAt` preenchidos, lote com conflito no meio, e nenhuma linha perdida.

### 🔴 RISCO: uma restrição no APP derruba TODOS os usuários de uma vez

Descoberto em 04/08/2026 num testador: a **conta de desenvolvedor** dele foi
restringida pela Meta. O token inteiro parou, e a Graph passou a responder
`(#200) … permission` **por conta** — a mensagem imprecisa de sempre.

> ### ⛔ Reconectar NÃO resolve enquanto a restrição durar
> É a única das três causas do `(#200)` em que o caminho óbvio falha. Quem
> tenta reconectar, vê falhar e não tem o que olhar em seguida fica sem saída —
> por isso a terceira hipótese entrou no texto de `erroMeta.ts`.

**O risco maior é estrutural e ainda não aconteceu.** Hoje cada testador precisa
de conta de desenvolvedor porque o app está em modo desenvolvimento. Aberto ao
público, os clientes não terão — mas **o nosso app pode ser restringido, e aí
todos param simultaneamente**.

| | Hoje (modo dev) | Aberto |
|---|---|---|
| Quem precisa de conta de desenvolvedor | cada testador | ninguém |
| Restrição derruba | um usuário | 🔴 **todos, ao mesmo tempo** |
| O que a tela diz | erro por perfil | o mesmo — e cada um acha que é problema dele |

⚠️ **O que falta:** quando N usuários falham com a mesma mensagem na mesma
janela, a causa é nossa, não deles. A ferramenta precisa dizer isso — hoje ela
manda cada um conferir o próprio Business Manager. Não implementado; o sinal já
existe no banco (`AdProfile.lastDiscoveryError` + `AdAccount.lastSyncError`),
então é consulta de agregação, não coluna nova.

### ⏳ Backoff das tentativas — `lib/facebook/backoff.ts`

A conta do testador acumulou **50 tentativas** contra um erro que não passa
sozinho. Erro de permissão não se resolve tentando de novo em 20 s.

| Falhas seguidas | Espera |
|---|---|
| 0–2 | nenhuma (pode ser rede, blip da Meta) |
| 3–9 | 5 min |
| 10–29 | 30 min |
| 30+ | 2 h (teto) |

> ### ⚠️ O motivo NÃO é economizar chamada
> O rate limit da Graph é **por APP**. Uma conta em repetição queima cota que é
> de todos — com N clientes, um token quebrado degrada a sincronização dos
> outros.

> ### ⛔ Três coisas que NÃO podem mudar
> 1. **O botão "Sincronizar" ignora o backoff.** Quem acabou de arrumar precisa
>    conferir na hora; 2 h de espera no clique manual faria a correção parecer
>    que não funcionou. (`syncSingleAccount` não passa pelos laços.)
> 2. **Reconectar ZERA os contadores** — inclusive o erro do perfil. O ato de
>    reconectar é a evidência de que a causa mudou.
> 3. **Estar em espera não esconde a conta nem o erro.** A linha continua na
>    tela, com o motivo e um "nova tentativa em ~28 min". Conta que para de
>    tentar sem dizer que vai voltar é indistinguível de conta esquecida.
>
> ⚠️ O teto de 2 h existe para a volta ser detectada **sozinha**: liberada a
> restrição, o sync retoma em no máximo duas horas sem ninguém clicar.
>
> ⚠️ `emEspera` entra no `SyncSummary` para `accounts: 0` não parecer "não achou
> conta nenhuma" quando o que houve foi backoff.

`npm run test:backoff` — 16 asserções, incluindo o estado inconsistente
(contador sem data) que erra para o lado de TENTAR: travar uma conta para
sempre por causa de dado incompleto seria pior que uma tentativa a mais.

### ✅ Status de conta, tradução, backoff e reset — EXERCIDOS em produção (04/08)

Com dado real de outro usuário, e três dos casos foram os de borda que o
desenho previa:

| Observado | O que valida |
|---|---|
| `"1"` → **Desabilitada**, com bloco traduzido e sem tentar mais | `account_status: 2` + backoff |
| Conta 1 → **Pagamento pendente**, 48 anúncios, 0 métricas | `account_status: 3` |
| Contas 2 e 3 → **Ativa** | `account_status: 1` |
| Perfil → sem aviso | `lastDiscoveryError` limpo pelo reconectar |

> ### ✅ "Pagamento pendente" prova a distinção que quase se perdeu
> `account_status: 3` **para de veicular e continua legível pela API**. Se
> `sincroniza` fosse `false` para ele — o que parece natural, já que a conta
> "não está ativa" —, a ferramenta teria escondido o **gasto histórico** dela.
> A separação entre "não veicula" e "não sincroniza" não era teoria.

### 🔴 O PRODUTO AINDA DEPENDE DE ALGUÉM MANDAR CLICAR

O testador só descobriu porque foi instruído a clicar em "Sincronizar".
Sozinho, ele veria **três contas com zero métrica** e concluiria que a
ferramenta não funciona.

A causa: **o auto-sync pede só `DIAS_AUTO = 2`**. Conta sem gasto nas últimas
48h nunca recebe linha nenhuma — e o histórico só entra pelo cron `?full=1` ou
pelo botão manual.

⚠️ E hoje **"sem gasto no período" e "ainda não buscamos o histórico" são
indistinguíveis na tela**: as duas mostram zero.

### 🔴🔴 DOIS AGENDADORES RODANDO AO MESMO TEMPO (descoberto em 05/08/2026)

O usuário configurou o **cron-job.org** numa sessão anterior. O
`.github/workflows/cron.yml` **nunca foi removido** — e está ATIVO. Medido pela
API do GitHub: `state: "active"`, **291 execuções**, a mais recente minutos
antes da verificação.

> ⚠️ **A documentação daqui dizia que o Actions era a rede de segurança e não
> mencionava o cron-job.org.** Isso fez o usuário se preocupar com um risco que
> não existia (o Actions desativar por 60 dias sem commit) e **não ver o que
> existia** (os dois disparando as mesmas rotas).

**Nem toda rota sofre igual** — e a diferença é a proteção que cada uma tem:

| Rota | Chamada em dobro | Por quê |
|---|---|---|
| `/api/cron/sync-facebook` | ✅ **inofensiva** | `autoSyncSeNecessario` tem a reserva no banco e os intervalos. A segunda sai `pulado` |
| `/api/cron/manutencao` | ⚠️ desperdício | as consultas são idempotentes |
| `/api/cron/reports` | 🔴 **notificação duplicada** | `generate.ts` faz `notification.create` sem condição |
| `/api/cron/run-rules` | 🔴🔴 **AÇÃO EM DOBRO** | ver abaixo |

> ### 🔴 `run-rules` tem uma corrida de ler-checar-agir, e ela move dinheiro
> ```js
> if (rule.lastRunAt && now - rule.lastRunAt.getTime() < rule.frequencyMin * 60_000) continue;
> const result = await evaluateRule(rule);   // ← PAUSA CAMPANHA / MUDA ORÇAMENTO
> await prisma.$transaction([ log, update lastRunAt ]);   // ← só AGORA marca
> ```
> A frequência é checada, a **ação acontece**, e só depois `lastRunAt` é
> gravado. Dois chamadores simultâneos passam os dois pela checagem.
>
> Numa regra de `+50%` de orçamento, execução dupla dá **+125%**. O
> `maxBudget` limita o estrago; não o impede.
>
> ⚠️ **O `concurrency` do workflow não cobre isto** — ele impede o Actions de se
> sobrepor a si mesmo, não de coincidir com o cron-job.org.
>
> **O conserto é o padrão que esta base já usa três vezes** (reserva do
> auto-sync, upsert monotônico de venda, `garantirAreaPrincipal`): um
> `updateMany` condicional que reserva a execução ANTES de agir — quem recebe
> `count: 0` desiste. Quem decide o vencedor é o banco.

⚠️ **O que NÃO dá para saber daqui:** quais rotas o cron-job.org chama e com
qual frequência. É serviço externo, sem API configurada aqui. **Só o painel
dele responde.**

### ⛔ PADRÃO: mudar QUANDO o estado é gravado pode criar silêncio novo

Descoberto em 05/08/2026, numa correção minha e no mesmo dia em que ela subiu.

A corrida de ler-checar-agir do `run-rules` foi consertada movendo a gravação
de `lastRunAt` para **antes** da ação. A reserva estava certa. O que faltou foi
olhar o que acontecia **depois** dela:

| | Antes da reserva | Depois |
|---|---|---|
| `evaluateRule` lança | `lastRunAt` intacto → tenta de novo no ciclo seguinte | `lastRunAt` **já avançado** → pula a janela inteira |
| Registro | nenhum (tolerável — ia tentar de novo) | nenhum (**silêncio**, e a regra não roda) |

O usuário veria *"última execução há 30 min"* e concluiria que rodou normal.

> **Uma correção que muda o MOMENTO em que o estado é gravado transforma o
> significado de todo caminho de erro que passa por ali.** O erro que era
> tolerável — porque seria repetido — vira erro definitivo e mudo.
>
> ⚠️ Ao mover uma gravação para antes de uma operação, **liste o que pode falhar
> entre as duas** e decida o que cada falha significa agora. Aqui a resposta foi
> um `try/catch` que registra `status: "ERRO"` no histórico da regra.

É primo da regra do `NULL` (o mesmo valor significando coisas diferentes em
colunas diferentes): aqui é o mesmo CÓDIGO significando coisas diferentes
antes e depois de uma mudança de ordem.

### 🔴 `userTimezone` cai em São Paulo EM SILÊNCIO — e isso vira sistemático

`src/lib/userTimezone.ts:21` tem um `catch` que devolve `DEFAULT_TIMEZONE`
(`America/Sao_Paulo`) quando a leitura falha. Hoje o efeito é invisível porque
todo mundo está no Brasil.

> ### ⛔ Com usuário fora do Brasil, isso deixa de ser fallback e vira ERRO EM TUDO
> O fuso decide onde o dia começa. Ele não afeta um número: afeta **todos** —
> janela do período, `byHour`, `byDay`, buckets do gráfico, a janela de
> comparação dos deltas, o `time_range` mandado à Meta, o limite diário do motor
> de regras e a hora do relatório. É a seção "Fuso horário — causa raiz" inteira,
> reintroduzida por um `catch`.
>
> E é **sistemático, não intermitente**: quem está em Lisboa vê todo dia
> começando 4h cedo, sempre, sem nada na tela denunciando.

⚠️ **Não é urgente hoje e não pode ser esquecido amanhã.** O gatilho é o primeiro
usuário fora do fuso do Brasil — que chega junto com abrir o app ao público.
O conserto é o mesmo padrão do `lastSyncError`: registrar que o fallback foi
usado, em vez de silenciá-lo.

### ✅ VALIDADO EM PRODUÇÃO com dado de OUTRO usuário (04/08/2026)

O testador reconectou depois que a restrição da conta de desenvolvedor dele
caiu, e quatro coisas foram exercidas de uma vez, com dado real que não é nosso:

| | O quê |
|---|---|
| ✅ | `accountStatus` gravado e traduzido — as contas voltaram a "Ativa" |
| ✅ | Tradução do erro `(#200)` |
| ✅ | Aviso de perfil (`lastDiscoveryError`) apareceu **e sumiu sozinho** ao reconectar |
| ✅ | Reset dos contadores no callback do OAuth |
| ⚠️ | Upsert em lote — ver a ressalva abaixo |

> ### ⚠️ A leitura de que o LOTE destravou os 102 anúncios NÃO se sustenta
> A conclusão natural foi: "102 anúncios × 40 dias teria estourado o tempo com
> o N+1". Ela é plausível e **os números não a sustentam**.
>
> O `40` daquela mensagem é `summary.metrics` — **linhas gravadas**, não dias
> (o rótulo "dias" no botão está errado e é dívida). Foram 40 linhas, não
> 4.080: a maioria dos 102 anúncios não teve gasto no período. E 40 upserts em
> série são ~4 s, que o caminho MANUAL (`syncSingleAccount`, requisição direta,
> fora do `after()`) aguentaria sem lote.
>
> **O que destravou foi o token voltar.** O lote continua sendo a correção
> certa — ele protege o ciclo automático recorrente, que é onde o orçamento é
> apertado —, mas atribuir a ele este caso seria confundir correlação com causa.
>
> ⚠️ Fica um sinal a conferir: **Conta 2 sincronizou 28 anúncios e `0` linhas de
> métrica.** Pode ser ausência de gasto (legítimo) ou `metricasOrfas`. O
> `diag:testadores` responde na seção "Por conta".

### 📋 ORDEM DE RETOMADA aprovada em 04/08/2026

Depois dos testes com usuários reais. **Atribuição saiu da frente**: o guarda de
template está feito e o que falta (o `click_id` chegando da OnyxPag) é trabalho
do usuário, no checkout dele.

| # | O quê | Por quê nesta posição |
|---|---|---|
| 1 | **1.3 — taxas por forma de pagamento** | bug isolado e concreto: a opção "Todas" salva `OUTRO`, que é uma forma de pagamento REAL. Não depende de nada |
| 2 | **1.1 — ROI único, com fórmula visível** | ver abaixo |
| 3 | **1.2 — gasto às 00:00** | |
| 4 | **Família 1 da varredura** (3 pontos) | `dispatchPixel`, `checkoutEvent`, `dispatchNotification` — os três afetam dinheiro em silêncio, e o padrão de conserto já está provado com o `lastSyncError` |
| 5 | **1.4 — auditoria completa de métricas** | só depois que a fonte única de ROI/lucro existir; antes disso ela mediria o alvo errado |
| 6 | Bloco 4 — funcionalidades novas | |

> ### 🔴 O card de ROI mostra QUANTO NÃO ESTÁ ATRIBUÍDO, junto do número
> Decisão do usuário, e é o desenho certo: medido em 04/08/2026, **49,6% do
> faturamento dele e 100% do faturamento do testador não têm campanha**.
>
> A fórmula correta vai continuar mostrando número ruim enquanto a atribuição
> não subir — e é exatamente isso que ela precisa **deixar visível**. Sem o
> número ao lado, o usuário culpa a campanha por um problema de tracking.
>
> ⚠️ Esconder ou suavizar o ROI nesse caso seria o pior desfecho: decisão de
> mídia tomada sobre um número que descreve o rastreamento, não o anúncio.

⏳ **Fora da fila, sem prazo:** `capi.ts` e `rules/engine` (Família 1, os dois
que já deixam rastro), a Família 2 inteira, e o rótulo "dias" do botão
Sincronizar, que na verdade mostra LINHAS gravadas.

### 🔍 `npm run falha:coletiva` — "é problema dele ou é nosso?"

Uma restrição no NOSSO app derruba todos ao mesmo tempo, e a tela diz a mesma
coisa que diria para um problema individual — cada um abre chamado achando que
é problema dele.

Agrupa as contas com erro recente pela **causa traduzida** e conta **usuários
distintos**. Dois ou mais já é o sinal.

> ### ⚠️ Agrupa pela CAUSA, nunca pelo texto cru
> A Meta prefixa o nome da conta e anexa a URL da doc, então duas mensagens da
> mesma causa nunca são strings iguais. Agrupar por texto cru não acharia grupo
> nenhum — foi exercitado com dois usuários e textos diferentes.

> ⛔ **O veredito não é binário.** "1 de 1 usuário falhando" não é evidência de
> nada; é o caso normal de quem tem um usuário só. Com menos de 2 usuários
> conectados o script **diz que não consegue distinguir**, em vez de dar um
> veredito que não se sustenta.

O aviso automático na tela fica para quando houver volume — a decisão foi
começar pelo script, rodado sob suspeita.

### 🔍 `npm run diag:testadores` — só leitura, pode rodar em produção

```
npm run diag:testadores -- --url "<conn>"
npm run diag:testadores -- --url "<conn>" --dias 7 --email alguem@exemplo.com
```

Responde três perguntas que só o dado de produção responde: **quanto do
faturamento está atribuído a campanha** (é o que explica o ROI divergente),
**o estado do sync de cada testador** (`lastSyncedAt` × `lastMetricsAt` ×
última métrica GRAVADA × token expirado) e **quantos cliques têm template não
substituído**, com o impacto da reclassificação medido antes de decidir.

> ⚠️ **Tudo recortado por `userId`, e não existe total do banco no relatório** —
> é a regra que o `origem-venda.mjs` custou para aprender.
>
> ⚠️ Ele imprime `lastMetricsAt` **e** a última linha de `DailyAdMetric`
> gravada. São perguntas diferentes: a primeira diz que TENTAMOS sincronizar, a
> segunda que CHEGOU dado. `autoSyncSeNecessario` devolve `modo: "erro"` e **a
> tela descarta** — um token expirado faz o sync falhar a cada 20s para sempre
> sem nada aparecer no painel.

### 🐛 Conta nova nasce com um webhook

`signupAction` (`app/(auth)/actions.ts`) cria explicitamente um
`Webhook principal` da plataforma `CUSTOM` em toda conta nova, e a tela de
cadastro anuncia isso ("Seu webhook de vendas já sai configurado").

⚠️ Como `CUSTOM` tem `auth.exigir: false`, esse webhook é um **endpoint de
ingestão sem segredo**, criado para todo usuário sem que ele peça. Quem
conhecer o token consegue inserir venda na conta. Decidir se ele deixa de
nascer ou se passa a exigir chave.

## 🚦 COMECE AQUI — fila de UX: (f) e (g) fechados (01/08/2026)

### (g) Regras em duas regiões — o grupo que move dinheiro parou de ser intercalado

A gaveta tinha os campos das duas naturezas **misturados**, e um dos grupos pausa
campanha e altera orçamento sozinho, de madrugada. Agora são 4 seções com selo,
pelo mesmo desenho da gaveta do Pixel:

| Seção | Selo |
|---|---|
| A ação · Onde ela age · Quando ela dispara | **⚠ mexe na sua conta do Facebook** (âmbar) |
| Ritmo | ⚡ só decide quando roda (discreto) |

**De ~11 controles visíveis para 8** (nome · ação · nível · contas · produtos ·
condição · frequência · ativar). Período de cálculo, intervalo de execução e
limite diário foram para **"Configuração avançada"**, fechada por padrão.

> ### 🔴 A CONDIÇÃO ficou do lado que mexe na conta — não do lado do ritmo
> Ela parece configuração de leitura e **é o mecanismo de segurança da regra**.
> Foi um operador invertido (`gasto ≤ 999999` em vez de `≥`) que fez a regra agir
> sobre tudo no escopo, em produção. Errar a condição é errar o que a Meta recebe.
> Movê-la para "Ritmo" faria o selo mentir na única linha em que isso custa caro.

> ### ⚠️ O período de cálculo NÃO é agendamento, e por isso não sumiu de vista
> Ele decide **o que "CPA > 50" significa** — a janela em que a métrica é medida.
> Está no avançado porque tem padrão sensato ("hoje"), mas o valor escolhido
> aparece na dica das Condições: *"As métricas são medidas em: últimos 7 dias."*
> **Uma regra nunca é lida sem a janela dela.** Se ele voltar a ficar só no
> avançado, sem eco na condição, a gaveta passa a esconder metade do critério.
>
> Foi a única divergência do pedido original (que o listava como "só decide
> quando roda") e está registrada aqui de propósito.

> ### ⛔ Esconder controle com padrão é bom; esconder valor JÁ CONFIGURADO é armadilha
> `usaAvancado()` compara o rascunho com o `RASCUNHO_REGRA` e faz a seção nascer
> **aberta** quando há qualquer valor fora do padrão. Sem isso, editar uma regra
> que só roda das 8h às 18h não mostraria nada sobre isso.
>
> É inicializador de `useState`, não efeito — a gaveta é montada do zero a cada
> abertura (`{rascunho && <RuleDrawer …>}`).

**Ganho de layout de quebra:** "Quanto aumentar" e "Teto de orçamento" moravam
**depois** do construtor de condições. Marcar "Aumentar orçamento" fazia o campo
do valor nascer do outro lado de um bloco inteiro de outra coisa. Agora ficam
logo abaixo da ação que os cria.

> ⛔ **Sem preset, e a decisão continua valendo.** Numa regra a escolha da ação
> **é** a decisão — não existe caso comum que derive os outros campos, como o
> "tem pixel nativo?" deriva na gaveta do Pixel. Um preset aqui inventaria uma
> pergunta, que é o oposto do objetivo.

**`ui/Secao.tsx`** — o cabeçalho com selo saiu da `PixelView` para ser
compartilhado, com o par de selos passado como dado. Duas cópias do mesmo
cabeçalho divergem no primeiro ajuste de espaçamento, e o valor do padrão está em
ele ser reconhecível de uma gaveta para a outra. A `PixelView` ficou com um
`Secao` local de 3 linhas que mapeia `"script"`/`"hora"` para o componente base.

### (f) Camada didática

**Estados vazios que ensinam.** Auditei os ~25 do produto: a maioria **já
ensinava** (Criativos, Gerenciador, Regras, Áreas, Testes, Webhooks — todos com
próximo passo). Os que só anunciavam ausência eram 7, e todos foram reescritos
para dizer a **consequência**:

| Onde | Antes | Agora diz |
|---|---|---|
| Taxas ×5 | "Nenhuma taxa de gateway cadastrada." | o que deixa de ser descontado e o que isso faz com o líquido/lucro |
| Sino do Header | "Nenhuma notificação ainda." | quando elas chegam + link para escolher quais |
| Integrações › Anúncios | "Nenhuma conta de anúncio neste perfil." | confira o Facebook certo; conta nova aparece sozinha no próximo sync |

> ⚠️ O card de gateway diz também que **gateway que informa a taxa em cada venda
> já entra sozinho** — sem isso a tela cobraria cadastro de um número já medido,
> que é o que treina o usuário a ignorar o aviso âmbar do topo.
>
> ⚠️ "Custo de produto" diz explicitamente que **produto 100% digital pode ficar
> em branco**. Estado vazio que ensina não pode transformar um campo opcional em
> pendência imaginária.

**Indicador de progresso — o que faltava era CORREÇÃO, não peça nova.**

| Onde | Situação |
|---|---|
| Banner do Dashboard (`getPendenciasDaArea`) | ✅ cobre as áreas secundárias |
| Cards de `/dashboard/areas` | ✅ pendências por área |
| Checklist em Integrações › Testes | 🔴 **mostrava a área ERRADA** — corrigido |

> ### 🔴🔴 CASO: componente cliente que busca no MOUNT não reage a `router.refresh()`
>
> `ChecklistCard` chamava `getInstallChecklist()` **sem argumento**, deixando o
> servidor cair no `getLastWorkspaceId()`, e o efeito rodava **uma vez, na
> montagem**. `trocarWorkspace` faz `router.refresh()`, que re-renderiza o
> servidor mas **preserva estado de componente cliente** — então trocar de área
> com a aba aberta deixava o card afirmando "4 de 5 prontos" sobre uma área que o
> usuário já tinha deixado. **Alguém confiaria nesse número.**
>
> **A assinatura do defeito, para reconhecer o próximo:**
> 1. componente **cliente** autocontido, que busca por server action;
> 2. a action é **escopada por área** e aceita `workspaceId?` com fallback para
>    `getLastWorkspaceId()`;
> 3. a chamada **omite o argumento**;
> 4. o efeito tem deps `[]` (ou um `useCallback` com deps `[]`).
>
> Os quatro juntos = a tela mostra a área anterior, com cara de dado atual.
> Nenhum `tsc`/`lint`/`build`/teste acusa. **A correção é sempre a mesma:**
> `workspaceId` por prop, vindo de `useTraffik().workspaceAtiva` na página, e a
> prop nas dependências.

> ### ⛔⛔ TELA STALE QUE EXIBE NÚMERO É RUIM. QUE EXIBE ALGO COPIÁVEL É ARMADILHA.
>
> Esta é a distinção que importa ao priorizar, e os três casos desta auditoria
> caem dos dois lados de uma linha bem nítida:
>
> | | Checklist · Pixel | **UTMs** |
> |---|---|---|
> | O que a tela mostrava | informação desatualizada | **um artefato para copiar** |
> | Onde o erro morre | ao recarregar a página | **no site do cliente, permanente** |
> | Quem descobre | quem olhar de novo | **ninguém** — só o relatório, semanas depois |
> | Reversível? | sozinho | só reinstalando, e é preciso SABER que precisa |
>
> Ler "4 de 5 prontos" da área errada custa uma decisão ruim que o próximo
> carregamento corrige. Copiar o script da área errada, colar no site e sair
> carimbando cliques na operação errada **não se corrige sozinho nunca**: o dado
> entra errado no banco, com aparência perfeitamente normal, e a tela que
> mentiu já foi fechada.
>
> **Regra ao triar este defeito:** pergunte o que a tela ENTREGA, não o que ela
> exibe. Se o usuário leva alguma coisa dali para fora — script, snippet, URL de
> webhook, chave de API, id — o componente stale deixa de ser incômodo e vira
> **fonte de dado errado permanente**, e sobe de prioridade na hora.
>
> ⚠️ As telas que entregam artefato hoje: **UTMs** (script por área) · **Pixel**
> (script com o `PixelConfig.id`) · **Webhooks** (URL do gateway, chave de API).
> Toda uma delas tem de reagir à troca de área — as três já reagem, mas é aqui
> que a próxima regressão custa caro.

### 🔎 Auditoria do padrão — 3 casos, todos corrigidos em 01/08/2026

Varredura de **todo** `useEffect` que busca dado nas views:

| Onde | Veredito |
|---|---|
| `ChecklistCard` (Testes) | 🔴 **era o bug** — `getInstallChecklist()` sem arg, deps `[]` |
| 🔴 **`UtmsView`** | `getUtmCodes()` sem arg, deps `[]` — **o pior dos três**, ver abaixo |
| 🔴 **`PixelView`** | `listPixels()` sem arg, deps `[]` — listava os pixels da área anterior |
| `RulesView` | ✅ já recebia `workspaceId` e tinha nas deps |
| `AnunciosView` · `WebhooksView` | ✅ leem do contexto (`v`), que o layout do servidor renova |
| `AreasView` | ✅ lista TODAS as áreas por natureza — não é escopada |
| `TestadorPayloadCard` | ✅ gateways vêm do `REGISTRO`, global |
| `ExcluirAreaDialog` | ✅ recebe a área explicitamente |
| `EspelhoCard` · `WebhookLogsCard` (Testes) | ⚠️ **globais hoje** — não é staleness |
| `listTestablePixels` (Teste de Pixel) | ⚠️ **não aceita `workspaceId`** (`where: { userId }`) — lista pixels de todas as áreas. É inconsistência de ESCOPO, não o mesmo defeito; não foi mexido |

> ### 🔴 Na aba UTMs o defeito não era número velho — era INSTALAÇÃO ERRADA
> Desde a Sessão 3 o script de UTM é **por área** (embute o `WS`). Com a busca
> presa à montagem, trocar de área continuava exibindo o script da área
> ANTERIOR — e esse bloco existe para ser **copiado e colado no site**. O
> resultado seria carimbar os cliques daquela página na área errada, sem nada na
> tela denunciando, e só aparecendo depois no relatório.
>
> É o caso que mostra por que este padrão merece a auditoria: o mesmo defeito
> mecânico produz "um número desatualizado" numa tela e "dado de produção
> atribuído à operação errada" em outra.

**Medido no navegador, nas três**, trocando de área **sem navegar**:

| Tela | Antes da troca | Depois | Voltando |
|---|---|---|---|
| Checklist (Testes) | 4 de 5 prontos | **1 de 5** | 4 de 5 |
| UTMs | "Instale na página de vendas de **Principal**" | **…de `mjh`** | Principal |
| Pixel | 2 pixels | **"Cadastrar seu primeiro pixel"** | 2 pixels |

> ### ⛔ A Principal continua sem banner, e isso não mudou
> Reavaliei e mantive: ela é o catch-all e é o estado normal de quem tem uma
> operação só. O onboarding de primeiro acesso já foi cortado uma vez pelo
> usuário, e nada nesta sessão deu motivo novo para reabrir.

### 📏 `resize_window` mente com a janela MAXIMIZADA — investigado antes do (d)

**Reproduzido:** a chamada devolve *"Successfully resized window … to 900x850
pixels"* e `innerWidth` **não sai de 2560**. Chamar de novo não adianta. A janela
está maximizada (`innerWidth === screen.availWidth`), e nesse estado o gerenciador
de janelas ignora o `chrome.windows.update({width,height})` — nada no retorno
confere o resultado, então ele reporta sucesso.

> ### ⛔ A regra que fica: NUNCA confie na mensagem de sucesso
> Depois de qualquer resize, **leia `innerWidth`/`innerHeight` e compare**. É a
> defesa que vale independentemente do mecanismo. `innerWidth === screen.availWidth`
> é o indício de maximizada.

**Contornos, em ordem de custo:**

| | Como | Limite |
|---|---|---|
| 1 | **Restaurar a janela** antes da varredura (Win+Down ou duplo clique na barra de título) | precisa do usuário — a extensão manda tecla para a PÁGINA, não para o gerenciador de janelas |
| 2 | `chrome-devtools-mcp` → `resize_page` (CDP `Emulation.setDeviceMetricsOverride`) | muda o viewport de layout, **imune ao estado da janela**. Bloqueado aqui: o perfil `~/.cache/chrome-devtools-mcp/chrome-profile` já está em uso (precisa fechar aquele Chrome ou `--isolated`), e é sessão separada → exige novo login |
| 3 | **Constringir o container** (método da sessão passada) | ver abaixo — para ESTE código é equivalente, com uma exceção |

> ### ✅ Por que o método 3 basta neste projeto — e onde ele NÃO basta
> **Não existe uma única `@media` de largura na base** (verificado: só
> `prefers-reduced-motion` e `prefers-color-scheme`). Toda responsividade é
> `auto-fit`/`minmax`, e o `react-grid-layout` usa `useContainerWidth()` — ou
> seja, **tudo responde à largura do CONTAINER, não do viewport**. Constringir o
> container é equivalente a estreitar a janela.
>
> 🔴 **A exceção é o que importa para o (d):** as camadas flutuantes são
> `position:fixed` e portadas para o `<body>` — `Drawer`, `Modal`, o dropdown do
> `Select` e o popup do `DateRangePicker`. Elas dimensionam pelo **viewport**, que
> o método do container não estreita. E o `Drawer` tem `largura` **fixa em px**
> (520 padrão, 560 nas gavetas de Regra e Pixel): **abaixo de ~600px de viewport
> ele não cabe, e a varredura por container não teria como acusar.**
>
> Conclusão prática: o "0 de 23" da sessão passada segue válido para o conteúdo
> das páginas; **os overlays continuam sem varredura** e são o primeiro alvo do
> item (d) — com a janela restaurada (contorno 1) ou via CDP (contorno 2).

### Verificação

`tsc --noEmit`, `lint` e `next build` limpos. Suítes: `test:analise-regra` 32/0 ·
`test:previa-regra` 30/0 · `test:detectores` 56/0 · `test:espelho` 39/0 ·
`test:veiculacao` 40/0.

**Conferido na tela** (dev, `dev@exemplo.dev`, banco de DEV confirmado por
`npm run db:onde`): as 4 seções com os selos e tooltips certos; "Configuração
avançada" abrindo com os 3 campos; trocar o período para "Últimos 7 dias"
atualizando a dica das Condições; escolher "Aumentar orçamento" fazendo valor e
teto aparecerem **dentro de "A ação"**, com o teto em vermelho e o Salvar
desabilitado; editar uma regra com limite diário 5 (≠ padrão) **abrindo o
avançado sozinha**; os 4 estados vazios de Taxas e o do sino renderizados, com
**0 transbordo em 8 cards** e sem rolagem horizontal na página.

### 📋 Próximo

1. **(d) — escopo REDUZIDO, ver a seção abaixo.** Deixou de ser "varrer 23
   blocos": são **4 tipos de overlay + os estados condicionais**.
2. Evento de TESTE da Cakto contando como venda real — bloqueado até reativar a
   Cakto.
3. Import/export do Bloco 8; faxina do nav morto no `useTraffikState` +
   `EditDashboardDrawer` inalcançável.

## 🎯 ITEM (d) — escopo NOVO, aprovado em 01/08/2026

**Deixou de ser "varrer 23 blocos em N larguras".** A descoberta de que **não
existe uma única `@media` de largura na base** (só `prefers-reduced-motion` e
`prefers-color-scheme`) muda o cálculo: toda responsividade é `auto-fit`/`minmax`
mais o `react-grid-layout` com `useContainerWidth()`, ou seja, **tudo responde à
largura do CONTAINER**. Constringir o container é equivalente a estreitar a
janela, e o **"0 de 23" da sessão anterior vale** — não precisa ser refeito.

### O que sobra, e é o alvo real: os `position:fixed`

São os únicos que dimensionam pelo **viewport**, que o método do container não
estreita. Todos passam por `ui/useOverlay` e são portados para o `<body>`:

| # | Overlay | Suspeita |
|---|---|---|
| 1 | **`ui/Drawer`** | 🔴 **largura FIXA em px** — 520 padrão, **560** nas gavetas de Regra e Pixel. Abaixo de ~600px de viewport não cabe |
| 2 | `ui/Modal` | centrado; conferir `max-width` e as margens |
| 3 | Dropdown do `ui/Select` | ancorado ao gatilho, `minWidth` por chamada (até 290px) |
| 4 | Popup do `ui/DateRangePicker` | ancoragem **fixa** (`left: 0`), sem reposicionamento — dívida já registrada |

> ⚠️ **O `Drawer` é o alvo óbvio e o mais barato de consertar**: `largura` vira
> um teto (`min(largura, 100vw - margem)`) em vez de um valor absoluto. Mas
> **meça antes de mudar** — foi medir que evitou aumentar o `minH` do funil
> quando o problema era `min-height:auto`.

### E a varredura de condicionais, que continua no item

Semear dados que ativem **cada caminho condicional** — estados de erro, avisos
âmbar, rodapés, badges, chips — e conferir **cada um na tela**. O "0 de 23" só
prova que não há transbordo **naquele estado de dados**; o rodapé do funil ficou
invisível por semanas justamente por ser condicional.

### 📏 A regra do resize, que vale para qualquer sessão

> ### ⛔ NUNCA confie na mensagem de sucesso do `resize_window`
> Com a janela **maximizada** ele devolve *"Successfully resized window … to
> 900x850 pixels"* e **nada acontece** — o gerenciador de janelas ignora o
> `chrome.windows.update({width,height})` nesse estado, e nada no retorno confere
> o resultado. Chamar de novo não adianta. Reproduzido em 01/08/2026.
>
> **Depois de qualquer resize, leia `innerWidth`/`innerHeight` e compare.**
> `innerWidth === screen.availWidth` é o indício de janela maximizada.

**O método do (d) é janela restaurada ou CDP — NÃO o container:**

| | Como | Custo |
|---|---|---|
| 1 | **Restaurar a janela** (Win+Down ou duplo clique na barra de título) antes da sessão | precisa do usuário: a extensão manda tecla para a PÁGINA, não para o gerenciador de janelas |
| 2 | `chrome-devtools-mcp` → `resize_page` (CDP `Emulation.setDeviceMetricsOverride`) | **imune ao estado da janela**. Exige fechar o Chrome do perfil `~/.cache/chrome-devtools-mcp/chrome-profile` (ou `--isolated`), e é sessão separada → novo login |
| ❌ | Constringir o container | **não serve aqui**: overlay é `position:fixed` e não enxerga o container |

---

## 🛒 CHECKOUT PRÓPRIO — decisões de 01/08/2026

O usuário está construindo uma **página de vendas com checkout próprio** sobre a
OnyxPag. Isso muda três coisas em relação a um gateway hospedado, e as três já
morderam em outro contexto.

### ⛔ O Purchase é do WEBHOOK, e só dele. Nunca `fbq('track','Purchase')` na /obrigado.

**Decisão do usuário, 01/08/2026.** Vale para qualquer checkout próprio, não só
este. Hoje o nosso script **não dispara Purchase** (a rota `/api/pixel/event`
rejeita: `EVENT_MAP` só tem Lead/AddToCart/InitiateCheckout, mais o PageView) —
quem dispara é `dispatchPurchaseEvents(saleId)` quando a venda entra APROVADA.

Pôr um Purchase de navegador na página de obrigado cria o **segundo caminho sem
`event_id` compartilhado**, e a Meta conta 2. É exatamente o padrão da Kirvano
que foi resolvido em 31/07 — recriado num contexto novo.

> ### 🔴 E aqui NÃO dá para coordenar, só particionar
> Com a Kirvano a partição foi escolha; aqui é a única opção. Purchase não passa
> pelo `/api/pixel/event`, então não existe caminho para os dois lados
> compartilharem o mesmo `eid`. Ou o webhook envia, ou o navegador envia.

**Os três motivos de o dono ser o webhook, na ordem em que pesam:**

| | |
|---|---|
| 1 | 🔴 **PIX pago depois.** O comprador gera o PIX, fecha a aba e paga dois dias depois — **nunca volta à /obrigado**. Só o webhook sabe que a venda existiu. É o motivo decisivo |
| 2 | A /obrigado dispara na **chegada**, não no pagamento. Purchase por PIX apenas gerado é faturamento que pode nunca existir |
| 3 | Server-side atravessa bloqueador de anúncios e leva o `user_data` que montamos (`fbc`/`fbp`, e-mail e telefone com hash) |

> ⚠️ Se um dia o navegador tiver de ser o dono, o caminho é a gaveta do Pixel →
> Purchase = **"O pixel da sua página"**, que faz a Traffik parar de enviar.
> **Nunca os dois** — ver `lib/pixel/donos.ts`.

### 🔗 A OnyxPag não tem via de atribuição — mas o checkout é DELE

`REGISTRO` declara: sem `click_id` ecoado, sem `fbc`/`fbp`, sem IP do comprador.
Venda dela entra sem campanha, sem criativo e sem país. **Num checkout hospedado
isso é limitação do gateway; num checkout próprio é uma escolha de quem monta a
página**, porque a API aceita `tracking`/`metadata` na criação da cobrança.

> ### 🔴 O campo é `click_id`, NÃO `sck`
> O parser lê os dois, mas em destinos diferentes, e só um alimenta o match:
>
> ```ts
> clickId: toStr(pick(trk, ["click_id", "clickId", "trk_click_id"]), 191),  // ← vira o match
> utm: { sck: toStr(pick(trk, ["sck", "client_reference_id", "xcode"]), 191) } // ← texto livre
> ```
>
> `ingestSale` chama `matchClick(userId, data.clickId, …)` — **`utm.sck` não
> entra**. Mandar o click_id em `sck` grava a string e **não casa clique
> nenhum**, sem erro em lugar nenhum. Foi o conselho errado dado numa primeira
> resposta desta sessão, corrigido ao ler o `ingestSale`.

`rastreio(d)` mescla `{...d, ...d.metadata, ...d.tracking}`, então **mandar em
`tracking` e `metadata` ao mesmo tempo é gratuito** e aumenta a chance de um dos
dois voltar no webhook.

> ⚠️ **A doc da OnyxPag NÃO promete devolver `tracking` no webhook.** O parser é
> defensivo. Mandar é necessário e **não é suficiente** — só um payload real
> responde. Confira com `npm run venda:inspecionar -- --gateway ONYXPAG` depois
> da primeira venda: se `clickId` vier nulo com o campo enviado, ela não devolve
> e a atribuição terá de vir por outra via.

### 🧪 `npm run pixel:duplicados` — por que o mesmo evento virou duas linhas

Somente leitura, recortado por `userId`. Confere se o índice único existe (a
`20260731040000` já falhou uma vez em produção), agrupa por *mesma ação*
(usuário + pixel + evento + url + fbclid) e lista os últimos eventos com os
**ingredientes do `eid` lado a lado**, dizendo qual divergiu.

```js
eid(nome) = nome + "-" + hash([CONFIG, nome, location.href, fbclid, Math.floor(Date.now()/10000)])
```

| Divergiu | Causa | De quem é |
|---|---|---|
| `url` | `location.href` mudou entre os POSTs (o Next normaliza query, assenta o router) | da página |
| `fbclid` | o cookie ainda não tinha sido lido na 1ª chamada | da página |
| **só o balde** | 🔴 `Math.floor(Date.now()/10000)` é **balde fixo, não janela deslizante** | **nosso** |

> ### 🐛 O AGRUPAMENTO tinha o mesmo defeito que o aviso — corrigido em 01/08
> A 1ª versão agrupava por (usuário, pixel, evento, url, fbclid) na **janela
> inteira** e chamava tudo de duplicata. Isso juntava **todos os PageView da
> mesma URL em 180 minutos**, e quem está construindo o site recarrega dezenas
> de vezes: ele acusou "CAUSA 3" em eventos a **17, 22 e 40 segundos** de
> distância — recarregamentos legítimos.
>
> Eu tinha corrigido exatamente isso no aviso linha a linha (janela de 30 s) e
> **deixei passar no agrupamento**. Hoje usa `lag()` sobre pares CONSECUTIVOS a
> até 5 s (`--segundos`), que é a única distância em que "mesmo carregamento" é
> explicação possível.
>
> ### ⛔ REGRA: ao endurecer um alarme, procure as OUTRAS SAÍDAS do mesmo módulo
> Um módulo de diagnóstico quase sempre tem mais de um caminho até a tela. Este
> tinha dois — o agrupamento e o aviso linha a linha — e eu corrigi **um**.
> A saída não corrigida continuou afirmando o oposto da corrigida, e é a que o
> usuário leu primeiro.
>
> **É a mesma família do `origem-venda.mjs`**, que separava por dono na
> *exibição* e somava o banco inteiro no *cálculo*: dois caminhos para a mesma
> pergunta, um deles arrumado. Nos dois casos a parte correta deu **falsa
> garantia** — quem viu a separação/janela funcionando não desconfiou da outra.
>
> E é a mesma família do bypass de webhook: endurecer `/api/webhook/kirvano` e
> deixar `/api/webhook/sale/[token]` aceitando a mesma credencial.
>
> **Ao corrigir um limiar, uma janela, um filtro ou uma autenticação: `grep` o
> módulo inteiro pelo mesmo conceito antes de fechar.** Corrigir uma saída de
> duas é pior que não corrigir nenhuma.
>
> ⚠️ E a regra de sempre: diagnóstico que acusa comportamento normal é pior que
> nenhum — ele treina a ignorar o alarme que importa.

### ✅ AS DUAS CAUSAS EXISTEM — medidas em produção, e o gerador foi reescrito

Com o script corrigido, o usuário achou as duas em dados reais:

| Causa | Evidência |
|---|---|
| **1** | `04:42:31.602 /checkout?qty=1` × `04:42:31.606 /checkout?product=snow-foam-sgt-9939&qty=1` — **4 ms**, `location.href` mudou no mesmo carregamento |
| **3** | `04:46:29.591` (balde 178555958) × `04:46:30.512` (balde 178555959) — **921 ms**, mesma URL, cruzou a fronteira |

**`eid()` foi reescrito** (`lib/pixel/script.ts`): saiu `location.href`, saiu o
`fbclid`, saiu o balde fixo. Entrou uma **ÂNCORA por carregamento** —
`Math.random() + Date.now()`, gerada uma vez — mais `location.pathname`.

> ### ⛔ A âncora é POR EVENTO, nunca global
> | | `PageView` | `Lead` · `AddToCart` · `InitiateCheckout` |
> |---|---|---|
> | Quem dispara | o carregamento | o usuário |
> | Dois disparos no mesmo load | a **mesma visita** contada 2× | podem ser **duas intenções reais** |
> | Logo | deduplica SEMPRE (só âncora) | deduplica só se quase simultâneos |
>
> `PageView` usa `[CONFIG, nome, pathname, ANCORA]` — sem tempo nenhum. Os de
> ação acrescentam o instante, mas com **janela DESLIZANTE de 1 s ancorada no
> primeiro disparo** (`ultimoDeAcao`), nunca um balde fixo — é a fronteira que
> criava o bug. Deduplicar dois cliques em "comprar" separados por segundos
> apagaria uma intenção real do funil.

> ⚠️ **`location.href` → `location.pathname`, e não "remover a URL".** O
> `pathname` preserva a distinção entre rotas de uma SPA, que é o motivo de a
> URL estar na chave. Foi a **querystring** que mudou nos dois POSTs medidos, e
> o `pathname` era o mesmo (`/checkout`).
>
> ### ⚠️ LIMITAÇÃO CONHECIDA: PageView some quando só a QUERY distingue a página
> Numa SPA que dispare `PageView` duas vezes no mesmo carregamento para o mesmo
> `pathname`, mudando **só a querystring**, os dois viram **um evento só**.
>
> Hoje é o lado certo de errar — foi exatamente essa mudança de query que
> produziu a causa 1, e o caso comum é ruído, não navegação. Mas o dia em que
> isso morde é previsível: **uma página em que a query É a navegação** — filtro
> de catálogo (`/produtos?categoria=x` → `?categoria=y`), paginação, busca. Ali
> o segundo PageView é legítimo e vai **sumir em silêncio**.
>
> **O sintoma será "PageView faltando", nunca um erro.** Se aparecer, o conserto
> não é voltar ao `location.href` (isso ressuscita a causa 1): é acrescentar um
> contador de PageView por carregamento à chave — o que dedupica o POST repetido
> e preserva a navegação, ao custo de um estado a mais no script.
>
> ⚠️ Vale só para `PageView`. Os eventos de ação já têm o instante na chave.
>
> ⚠️ **O `fbclid` saiu da chave** porque a âncora já distingue visitantes: dois
> navegadores nunca compartilham âncora. Era ele a causa 2.

**`npm run test:eid` — 11 asserções, 0 falhas**, exercitando o script gerado num
DOM falso com relógio e URL controláveis: as duas causas reais reproduzidas
(mesmo id agora), **e os três casos legítimos que NÃO podem deduplicar** —
recarregar a página, mudar de rota na SPA, e dois cliques reais a 3 s.

> ⚠️ **O snippet vive no HTML do cliente.** Quem já instalou continua com o
> gerador antigo até recolar. Ids antigos e novos não colidem, então a mudança é
> segura em qualquer ordem.

### 🌐 AMBIENTE DE TESTE detectado sozinho — o usuário cola o snippet e pronto

**Migration `20260801000000_pixel_event_ambiente`** — `PixelEvent.ambiente`
nullable + índice `(userId, ambiente, timestamp)`. Aditiva, sem backfill: toda
linha antiga continua contando, então aplicar não muda número nenhum na tela.

> ### ⛔ EU RECUSEI ISSO ANTES, E ESTAVA ERRADO
> Meu argumento foi *"muita gente roda produção em `*.netlify.app`"* — e é
> verdade. Mas a proposta nunca foi `*.netlify.app`: era
> **`<hash>--<site>.netlify.app`**, que é um **formato RESERVADO** pela
> plataforma para deploy efêmero. O `--` é o separador que a Netlify usa; um
> domínio de produção não o tem. Eu conflatei "hospedeiro" com "formato" e
> recusei a coisa certa pelo motivo errado.
>
> **Ao recusar uma detecção por ser "heurística frágil", verifique se o que foi
> proposto é um formato garantido pela plataforma.** Palpite sobre o hospedeiro
> é frágil; formato reservado é contrato.

> ### 🔴 E o que tornou o risco aceitável foi MARCAR, não apagar
> A objeção real — perda silenciosa de conversão — morre quando o evento
> **continua gravado**. Ele sai do funil, não vai para a Meta, e a tela diz
> quantos foram. Se a detecção errar, o dado está lá, o número aparece e
> `npm run eventos:marcar -- --limpar --aplicar` desfaz. Erro visível e
> reversível em vez de irreversível e invisível.

**Zero configuração, por exigência do usuário.** Nada de `if` na página do
cliente, nada de declarar domínio, nada de ele saber que o problema existe.
`lib/pixel/ambiente.ts` classifica pelo **formato do host**:

| Ambiente | Formato |
|---|---|
| `preview` | `<algo>--<site>.netlify.app` · `*.netlify.live` · `<projeto>-git-<branch>.vercel.app` |
| `local` | `localhost` · `*.localhost` · `127.*` · `[::1]` · `*.local` · faixas privadas (10/172.16-31/192.168) |
| `tunel` | `*.ngrok*` · `*.loca.lt` · `*.trycloudflare.com` |

> ⚠️ **O preview de hash aleatório da Vercel NÃO entra.** `projeto-a1b2c3d4-escopo.vercel.app`
> tem o mesmo desenho de um projeto chamado `loja-verao-brasil`, e o falso
> positivo aqui tira evento real do funil **e da CAPI**. Só o `-git-`, que é
> reservado.
>
> ⚠️ **URL ausente ou ilegível → PRODUÇÃO**, nunca teste. O `InitiateCheckout`
> que nasce do webhook do gateway não tem URL; marcar por omissão o tiraria do
> funil.

**Ambiente efêmero não vai para a CAPI.** É o único efeito irreversível da
detecção — e é onde os formatos são mais inequívocos (nenhuma loja atende em
`localhost`). Um Purchase de localhost ensina a otimização a procurar ninguém:
o número na tela se conserta relendo o banco, o sinal entregue à Meta não.

**A linha na tela** fica no funil, ao lado do aviso de robô e pela mesma razão
(o rodapé daquele bloco é cortado na altura padrão do grid): *"N eventos de
teste fora do funil"*, com o detalhamento por ambiente no `title`. **Uma
detecção que silencia o que removeu é indistinguível de um bug que come
eventos.**

**`npm run eventos:marcar`** classifica o histórico — simula por padrão,
`ALLOW_PROD_WRITES`, `--email` obrigatório, imprime as duas listas (a que marca
e a que fica) e `--limpar --aplicar` desfaz.

> ⛔ Ele usa a **mesma `ambienteDaUrl()`** da ingestão. A 1ª versão tinha o
> padrão escrito em SQL (`url LIKE '%--%.netlify.app%'`) — duas implementações
> da mesma pergunta, que divergem no primeiro formato novo. O `eventos:limpar`
> que apagava foi **removido**: marcar é melhor em tudo.

> ### 🐛 A autoconferência pegou um bug NO PRÓPRIO VERIFICADOR
> Depois do `--aplicar` ele comparou o funil com o previsto e acusou
> `previsto 10, obtido 12`. A marcação estava certa; a **conferência** é que
> contava sem `AND ambiente IS NULL` — lia as linhas recém-marcadas, que
> continuam no banco justamente porque não apagamos nada.
>
> É o argumento a favor de toda verificação pós-escrita: ela falhou onde
> deveria, e o erro era dela. Sem ela, o script teria dito "pronto" e ninguém
> saberia se o funil mudou.

### 🔁 Previews que só se revelam EM CONJUNTO — regra de REPETIÇÃO

O preview de hash aleatório da Vercel ficou de fora de `FORMATOS` porque
`<projeto>-<hash>-<escopo>.vercel.app` é indistinguível, **numa URL sozinha**,
de um projeto legítimo com hífens. O dado real do usuário trouxe o
contrapadrão:

```
moldes-ahuhuv5fb-noahvivaryder3s-projects.vercel.app
moldes-ralhb1gzf-noahvivaryder3s-projects.vercel.app
moldes-ppxn74d34-noahvivaryder3s-projects.vercel.app
moldes-4i5mg0sx2-noahvivaryder3s-projects.vercel.app
```

**Quatro** hosts, mesmo prefixo, mesmo escopo, diferindo só num segmento do
meio. Nenhum site de produção tem quatro domínios assim. **O sinal não é o
formato de UMA url — é a repetição.**

> ### ⛔ ISTO NÃO RODA NA INGESTÃO, E NÃO PODE RODAR
> A classificação de um evento depende da EXISTÊNCIA de outros. No primeiro
> POST não há repetição para observar, então:
> 1. **não dá para cortar o envio à CAPI com esta regra** — a decisão é tomada
>    antes de a evidência existir;
> 2. os primeiros eventos de uma família nunca seriam marcados ao vivo.
>
> É regra **retroativa**, e o lugar dela é o `eventos:marcar`, que mostra o que
> vai fazer e **espera aprovação**. É a confirmação que torna uma regra ambígua
> segura: um falso positivo é pego pelo usuário, não pela produção. Por isso ela
> sai numa **seção separada** da lista de formatos reservados — misturar faria a
> confiança de uma emprestar credibilidade à outra. `--sem-repeticao` pula.

**O teste decisivo NÃO é "alfanumérico curto".** `cliente1`, `cliente2`,
`cliente3` passariam nisso e um multi-tenant legítimo seria marcado. O que
separa os dois é o **prefixo comum**: hashes de verdade não compartilham começo
(`a`/`r`/`p`/`4`), `cliente1..3` compartilham sete caracteres. `pareceHashes()`
exige `[a-z0-9]{6,14}`, ao menos um dígito, e **prefixo comum ≤ 1**.

Mais: mínimo de **3 hosts**, e só segmentos do MEIO (o primeiro é o projeto, o
último carrega o domínio).

### 🌐 `example.com` — é RFC, não palpite

Investigado: **não vem de código nosso** — as únicas ocorrências de
`example.com` no repositório são e-mails em fixtures, e o testador de payload
nunca grava `PixelEvent`. Origem provável: requisição manual do próprio usuário
ao endpoint público.

Entrou em `FORMATOS` mesmo assim, e por um motivo forte: **RFC 2606 e RFC 6761
RESERVAM** `example.com/.org/.net`, `.test`, `.invalid` e `.example` — a IANA
garante que nunca são delegados. Não existe loja ali. É contrato, como os
formatos de plataforma.

> ⚠️ `example.com.br` e `meuexample.com` **não casam** — são domínios reais e
> delegáveis. Estão no teste.

> 💡 **Como saber se um evento veio de script instalado ou de curl:** o script
> manda `espelho` e `det` em todo POST. Linha com os dois NULOS não veio de um
> navegador com o snippet — veio de requisição manual.

**Testado:** `npm run test:ambiente` — **46 asserções**, a maioria do lado
*"NÃO é teste"*: `sigmatoolsd.netlify.app` (produção do usuário),
`minha-loja.netlify.app`, `loja-verao-brasil.vercel.app`,
`loja.netlify.app/promo--relampago` (o `--` depois do domínio),
`localhost.minhaloja.com`. E ponta a ponta no banco de DEV com as URLs reais:
os 4 de preview/localhost marcados, os 3 de produção intactos, funil 12 → 10,
`--limpar` desfazendo. Linhas removidas por id depois.

> ### ⏳ ORDEM DE DEPLOY
> `npx prisma migrate deploy` na produção **e só então** o push. O código novo
> faz `SELECT` de `ambiente` em toda carga do dashboard.
>
> Depois do deploy, opcionalmente:
> `npm run eventos:marcar -- --url '<conn>' --email <você>` (simula primeiro).

### 🔴 O conserto da causa 3, se ela se confirmar (histórico — CONFIRMOU)
> Duas chamadas a 1 ms de distância caem em baldes diferentes sempre que cruzam
> uma fronteira de 10 s. A probabilidade é baixa (≈ Δt/10000) e **não é zero** —
> e é sistemática, não aleatória: todo usuário com dois POSTs por carregamento
> a pega eventualmente.
>
> **A correção NÃO é aumentar o balde** — isso só dilui o problema e passa a
> juntar ações genuinamente distintas (dois cliques reais em "comprar" viram um
> evento só). O tempo tem de **sair da chave**: o id passa a derivar de uma
> âncora estável do carregamento, gerada uma vez e reusada.
>
> Um `sessionStorage`/variável de módulo com um id por *pageview*
> (`CONFIG + nome + pageviewId`) resolve as três causas de uma vez: sobrevive ao
> `location.href` mudando, não depende do `fbclid` já estar lido e não tem
> fronteira para cruzar. **Custo:** o mesmo evento disparado de propósito duas
> vezes na mesma página passa a deduplicar — o que para `PageView` é certo e
> para `InitiateCheckout` **não é** (dois cliques reais em "comprar" são duas
> intenções). Então a âncora tem de ser por evento, não global: `PageView` usa a
> do carregamento; os de ação continuam precisando de um discriminador.
>
> ⚠️ **Não implemente antes de o script dizer que é a causa 3.** As causas 1 e 2
> são muito mais prováveis e não exigem mexer no gerador.

### ⚠️ `listTestablePixels` — defeito de ROTULAGEM, não de staleness

`where: { userId }`, sem escopo de área: o seletor do Teste de Pixel lista os
pixels de **todas** as áreas, rotulados só como `nome (N pixels da Meta)`, sem
dizer de qual área cada um é.

**Não é a família da `UtmsView`, e a distinção decide a prioridade:**

| | UtmsView | Teste de Pixel |
|---|---|---|
| A lista está errada? | sim — **stale** | não — global, sempre completa |
| Quem escolhe | ninguém: você copia o que está na tela | **você**, num dropdown |
| O erro persiste? | sim, no site do cliente | não, é um evento de teste |

O único jeito de errar é confundir dois pixels **pelo nome**. Consequência: um
Purchase de teste de R$ 1 na CAPI do pixel errado — chato, não permanente.

**Fica sem subir na fila** (decisão do usuário, 01/08/2026: hoje há uma área só
com pixel, então o risco não existe). O conserto, quando vier, é de uma linha:
mostrar a área no rótulo, ou escopar a consulta.

### ➖ `AddPaymentInfo` não é nosso

Não está em `EVENTOS_DO_PIXEL` nem no `EVENT_MAP` — `/api/pixel/event`
responderia **400**. Se ele aparece disparando com valor numa página, é o `fbq`
do próprio usuário ou a biblioteca do checkout. Nós não emitimos nem
registramos. **Sem ação.**

---

## 🔒 PROTEÇÃO PREVENTIVA: padrão aprovado bloqueia na ingestão (01/08/2026)

Fecha a assimetria: a Netlify era **preventiva** (formato reservado), a Vercel
era **retroativa** (regra de repetição) — então todo preview novo dela já tinha
ido para a CAPI antes de qualquer coisa marcá-lo.

**Migration `20260801010000`** — `User.testHostPatterns` (Json, nullable).

Ao APROVAR uma família (`eventos:marcar --aplicar`), o padrão
`moldes-*-noahvivaryder3s-projects.vercel.app` é guardado e passa a valer **na
ingestão**, como os formatos.

> ### 🔴 Aprovar amplia o ALCANCE, nunca afrouxa o teste
> Casar o molde **não basta**: `casaPadrao` ainda exige que o segmento variável
> pareça hash. `moldes-producao-noahvivaryder3s-projects.vercel.app` casa o
> desenho e **não bloqueia**, porque `producao` é palavra.
>
> É o critério "errar para o lado seguro" aplicado: bloquear é irreversível (o
> evento não vai para a CAPI e não volta), então a aprovação estende o alcance
> de uma regra que continua rigorosa. Ela exige, cumulativamente: mesmo número
> de segmentos, todos os fixos idênticos, **exatamente um** curinga, ele **no
> meio** (nunca no primeiro nem no último, que carregam projeto e domínio), e o
> teste de hash.

> ### ⛔ A ordem é CONTRATO primeiro, escolha depois
> `FORMATOS` decide antes da lista aprovada. Se um dia discordarem, quem manda é
> o contrato de plataforma — a lista do usuário só age sobre o que sobrou.

> ### ⚠️ Custo zero no caminho quente
> Os padrões viajam no **mesmo `include`** do `PixelConfig` que a rota já fazia
> (`user: { select: { testHostPatterns: true } }`). Nenhuma ida extra ao banco
> num endpoint público que roda em toda visita. Foi por isso que virou coluna
> Json em `User`, e não tabela.

> ### 🔴 A REVERSÃO MORA NA TELA, não no SQL
> **Integrações › Testes › "Endereços que não contam como visita"** lista os
> padrões aprovados com botão Remover. Uma regra de bloqueio que só saísse por
> SQL seria irreversível na prática — e irreversível é exatamente o que ela não
> pode ser. O card **só aparece quando há padrão**: nada a gerenciar = nada na
> tela.

**Testado:** `npm run test:ambiente` — **58 asserções**. As 12 novas são quase
todas RECUSAS: segmento que é palavra, outro escopo, outro projeto, segmentos a
mais, produção do mesmo projeto, domínio próprio, lista vazia.

**E exercitado AO VIVO** contra `/api/pixel/event` (dev), com o padrão guardado:

| POST | Resposta |
|---|---|
| host **novo** do padrão | `{"registrado":true,"enviado":false,"motivo":"ambiente de teste","ambiente":"preview"}` |
| `moldes.tiarosi.online` | não caiu na regra de ambiente |
| `moldes-**producao**-…` | não caiu na regra de ambiente |
| `sigmatoolsd.netlify.app` | não caiu na regra de ambiente |

> 🐛 **O primeiro probe deu 500** — o dev server rodava com um cliente Prisma
> gerado ANTES da coluna existir. Não era bug de código (`tsc` e `build`
> passavam); era processo velho. **Depois de `prisma generate`, reinicie o dev
> server antes de sondar** — senão o 500 parece regressão e não é.

---

## 👥 ANTES DE CONVIDAR OUTRAS PESSOAS (01/08/2026)

### ✅ Isolamento — auditado, e está correto

| Superfície | Veredito |
|---|---|
| Server actions (`expenses`, `facebook`, `webhooks`, `apiCredentials`, `pixels`, `rules`) | ✅ todas no padrão `findFirst({ id, userId })` → `throw` → mutar por id |
| Rotas que escrevem (`ads/status`, `ads/bulk`, `ads/campaign`, `pixel/test`, `sync/facebook`) | ✅ resolvem o alvo com `adAccount: { userId }` ou `userId` no `where` |

Nenhuma exceção encontrada. **Ninguém lê nem escreve dado de outro por engano.**

### 🔴 O cron em SÉRIE — corrigido o que dava sem escalar

`sync-facebook` processa os usuários um a um. Com 1 nunca importou; com N, o
tempo soma e pode estourar o `maxDuration` — e aí **a função é morta sem
resposta nenhuma**: nenhum log, nenhum contador, nenhum sinal. O último da fila
não sincroniza e ninguém fica sabendo.

| | O quê |
|---|---|
| 1 | **Orçamento de tempo** (`maxDuration - 15s`). O laço para de COMEÇAR usuário novo e **consegue responder** com `interrompido: true` + `naoAlcancados` |
| 2 | **`entraram` × `completaram`**, mais `ms` por usuário e `msPorUsuario` |
| 3 | **Ordem ROTATIVA** — `AdProfile.lastSyncedAt` ascendente, **nulos primeiro** |

> ### ⛔ O contador sozinho NÃO resolveria
> Função morta não devolve resposta, e sem resposta não há contador. **É o
> orçamento que transforma o modo de falha invisível em `interrompido: true`.**
> O contador cobre o outro caso, o de responder com alguém faltando. Os dois
> juntos cobrem as duas formas de perder um usuário.

> ### ⚖️ A ordem rotativa não aumenta a vazão — resolve a INJUSTIÇA
> Com ordem fixa é sempre o mesmo que fica de fora, e para ele a ferramenta
> parece não funcionar. Por idade, quem ficou de fora é o **primeiro** da
> execução seguinte. `nulls: "first"` prioriza quem nunca sincronizou — o caso
> de todo convidado no primeiro dia.
>
> ⚠️ `distinct` depois do `orderBy`: usuário com dois perfis entra uma vez, pelo
> perfil mais antigo, que é a prioridade certa.

| Sinal no retorno | Significa |
|---|---|
| `entraram === completaram`, `interrompido: false` | todos rodaram |
| `interrompido: true` | 🔴 orçamento acabou; `naoAlcancados` diz quem ficou |
| `entraram > completaram` | 🔴 alguém não terminou **nem caiu no catch** |

> ### ⚠️ O `msPorUsuario` medido no DEV NÃO VALE
> Medido: **2.429 ms para 1 usuário**. Mas o token do dev é falso, então o
> caminho exercido é o de **erro** (`Invalid OAuth access token`), que falha
> rápido. Um sync real chama a Graph API `1 + 4×contas` vezes.
>
> **A medição verdadeira só existe em produção.** Chame a rota com o
> `CRON_SECRET` e leia `msPorUsuario`; `orcamentoMs ÷ msPorUsuario` é o teto
> real de usuários por execução. Faça com os convidados já conectados.

### 📋 Fila registrada — sem urgência para 3 pessoas

| | Item | Sintoma quando morder |
|---|---|---|
| 1 | **Rate limit da Graph API é por APP, não por usuário** | sync falhando em pico. N pessoas no painel multiplicam chamadas contra a mesma cota |
| 2 | **`ENCRYPTION_KEY` = ponto único de falha para TODOS** | trocá-la hoje perde os seus tokens; com convidados, os de todos. Sem rotação implementada |
| 3 | **`WebhookLog` cresce com N usuários** | `/api/cron/manutencao` já existe e está agendado; conferir que dá conta |
| 4 | **Zero teste de concorrência ENTRE usuários** | dois syncs simultâneos, dois webhooks de contas diferentes. A trava do auto-sync é por conta e deve segurar — é raciocínio, não medição |
| 5 | 🔒 **id em texto nos endpoints públicos** | ver abaixo |

> ### 🔒 O id público dos endpoints de tracking — SEGURANÇA para quando abrir
> `/api/track/click` recebe `account` = o `userId` literal; `/api/pixel/event`
> recebe o `pixelConfigId`. Os dois são públicos por desenho e **os ids ficam
> visíveis no HTML de quem instala o snippet**.
>
> Não é vazamento de leitura — é **poluição de escrita**: quem ler o snippet de
> outro pode injetar cliques e eventos falsos na conta dele.
>
> ⚠️ **Que a Utmify tenha o mesmo problema não o torna aceitável para sempre.**
> Com 3 conhecidos o risco é zero; num produto aberto, não. A correção natural é
> um id de tracking próprio (não o `userId`) + origem declarada por pixel, com
> evento de origem não declarada **marcado, nunca descartado** — mesma regra do
> ambiente de teste.

### 🔌 Gateways — o maior risco do convite

| Gateway | Estado |
|---|---|
| Kirvano · Cakto | ✅ parser dedicado, validados com venda real |
| OnyxPag | ⚠️ parser pronto, **nunca recebeu payload real** |
| **Hotmart · Kiwify** | 🔴 `ativo: false` — **não aparecem na tela** |
| Sistema próprio (CUSTOM) | ✅ ativo, parser genérico |

> ⚠️ **A saída pelo CUSTOM é parcial e perigosa.** Dá para apontar o webhook da
> Hotmart para um "Sistema próprio", e o parser genérico provavelmente extrai
> valor, e-mail e produto. Mas o **status** não está mapeado
> (`PURCHASE_APPROVED` cai no `statusPeloTexto`), então venda aprovada pode
> entrar como pendente. **Faturamento errado é pior que erro visível.**

**Custo de um gateway novo: meia sessão** — parser + registro + logo +
exemplos, como a Cakto. **Mas exija um payload REAL antes de começar**: sem ele
repete-se a OnyxPag, que passa nos exemplos da doc e ninguém sabe se funciona.

### 🤝 Traffik e Utmify em PARALELO

🔴 **O risco real é contagem dupla na Meta.** As duas mandando `Purchase` para o
mesmo pixel = cada conversão contada duas vezes, porque o `event_id` de uma
nunca coincide com o da outra. É o bug de 31/07, recriado.

> **Avise antes: UMA ferramenta só envia cada evento à CAPI.** Se a Utmify manda
> Purchase, na Traffik ponha o dono como "Ninguém" (Integrações › Pixel ›
> avançado). Ou o contrário. Nunca as duas.

O resto convive: os scripts não colidem (cookies e globais distintos), e dois
cliques registrados é o que se quer comparar. Mas avise que **os números vão
divergir sem que nenhum esteja errado** — janela de atribuição, dedup por sessão
× por pessoa, consolidação. Sem esse aviso, a primeira divergência vira "a
Traffik está errada".

⚠️ O snippet da Traffik vem **depois** do código base do Facebook no `<head>`,
senão o espelho no `fbq` entra em fila.

### ⚠️ Cadastro — NÃO verificado no navegador

O `signupAction` está correto (lido e com os inserts reproduzidos): valida,
recusa e-mail duplicado, cria `User` + `NotificationSettings` +
`DashboardPreference` + webhook principal, e loga. **Mas a jornada no navegador
não foi exercitada** — não consegui deslogar no harness, e `/signup` redireciona
quem já tem sessão. **Teste em janela anônima.**

⚠️ A conta nova **não cria Área de Trabalho no cadastro** — ela nasce no
primeiro carregamento do dashboard, via `garantirAreaPrincipal()`. É uma escrita
no primeiro load: se falhar ali, o convidado vê um dashboard quebrado sem
entender por quê.

---

## 🏁 FECHAMENTO DA SESSÃO DE 01/08/2026

### Entregue

| | O quê |
|---|---|
| ✅ | **Fila de UX (f) e (g)** — regras em duas regiões com selo; 7 estados vazios que ensinam |
| ✅ | **Checklist/UTMs/Pixel seguindo a troca de área** — 3 casos do mesmo padrão, com o da UtmsView produzindo **instalação errada**, não só número velho |
| ✅ | **`eid` determinístico por ÂNCORA** — as duas causas medidas em produção (`location.href` a 4 ms; balde de 10 s a 921 ms) |
| ✅ | **Detecção de ambiente de teste** — `PixelEvent.ambiente`, formatos reservados, fora do funil e fora da CAPI |
| ✅ | **Regra de repetição** (retroativa) + **padrão aprovado** (preventivo, removível na tela) |
| ✅ | **25 eventos marcados em produção** pelo usuário — localhost e os 6 previews da Netlify. O funil **não mudou** (49 → 49): nenhum deles gerou InitiateCheckout |
| ✅ | Purchase de checkout próprio é do **webhook, e só dele** |

### ⚠️ NÃO exercitado contra tráfego real

| | Item |
|---|---|
| ⚠️ | **`-git-` da Vercel e os túneis** (ngrok, loca.lt, trycloudflare) — só contra os formatos documentados. Netlify preview, localhost e o padrão aprovado saíram de dados reais |
| ⚠️ | O **card de padrões aprovados** não foi visto no navegador (a lista do dev foi limpa no fim) |
| ⚠️ | `AddToCart` e `Lead` continuam sem nunca terem disparado numa página real |

### 📋 A fila que sobra

1. **Item (d) da UX, em sessão própria.** Escopo já reduzido: **4 tipos de
   overlay** `position:fixed` (Drawer com largura fixa de 520/560px à frente) +
   a varredura de condicionais. Resolva o contorno do `resize_window` ANTES —
   janela restaurada ou CDP, nunca o container, que overlay não enxerga.
2. **`click_id` na OnyxPag**, quando a página for ao ar. O campo é `click_id`
   (NÃO `sck`), em `tracking` **e** `metadata`. O parser já lê; falta o
   construtor mandar. Confira com `npm run venda:inspecionar -- --gateway ONYXPAG`
   depois da primeira venda — a doc não promete devolver `tracking` no webhook.
3. Evento de TESTE da Cakto contando como venda — bloqueado até reativá-la.
4. Import/export do Bloco 8; faxina do nav morto no `useTraffikState` +
   `EditDashboardDrawer` inalcançável.

---

## 🚦 (histórico) fila de UX: (e) e (a) fechados (31/07/2026, 5ª parte)

### O que ficou pronto

**(e) Espaço mal aproveitado — as duas telas que faltavam.**
`TestesView` (era `max-width:920px`) e `NotificationsView` (era `680px`) adotaram
o padrão de 2 colunas de Webhooks/UTMs/Taxas/Pixel.

Em Testes a divisão é **semântica, não a lista cortada ao meio**:

| Coluna | Cards | O que têm em comum |
|---|---|---|
| **Como está agora** | Checklist · Espelho · Teste de Webhook | só **leem** o que já aconteceu — e são os que crescem sem teto (20 logs, detalhamento por evento) |
| **Testar agora** | Teste de Pixel · Teste de Tracking · Testar um aviso de venda | você fornece algo e a resposta vem do serviço de verdade |

Em Notificações os toggles viraram **ladrilhos numa grade**, e esse é o ponto:
sem isso, alargar a tela só esticaria cada linha (rótulo à esquerda,
interruptor à direita, um metro de nada no meio — o defeito que a `FeesView`
corrigiu). Em grade, alargar **acomoda mais itens por linha**.

> ⚠️ **`min-width:0` nas colunas não é enfeite.** Item de grid nasce com mínimo
> = conteúdo, e a coluna esquerda de Testes guarda o `<pre>` do payload cru.
> Medido com 3 avisos reais contendo uma URL de 250 caracteres sem espaço:
> **transbordo 0 em todas as larguras de 1600 a 420**, e `document.scrollWidth`
> nunca passou do viewport. Colapsa para 1 coluna em ~864px.
>
> ⚠️ `resize_window`/`resize_page` **não pegam com a janela do Chrome
> maximizada** — falham em silêncio (a captura muda de escala e parece que
> funcionou). A varredura de larguras foi feita constringindo o container, que
> é equivalente para layout que só depende de `auto-fit`/`minmax`. Se precisar
> de viewport real, restaure a janela antes.

**(a) Microcópia — as 9 telas nunca auditadas, lidas uma a uma.**
Limpas, nada a fazer: nova campanha, coluna de veiculação, aviso de snippet,
card de espelho. Os módulos de rótulo (`veiculacao.ts`, `espelho.ts`,
`detectores.ts`) já estavam escritos em consequência.

O que estava errado:

| Achado | Onde |
|---|---|
| 🔴 **Plural entre parênteses, 9×** — incluindo *"Isto marca 1 item(ns) como excluídos"* no diálogo de EXCLUSÃO em massa | `AdsActionBar` (2) · Checklist (4) · ação em massa · sync · runRules · testador |
| **Crase renderizada literal** — `` `secret` `` e `` `postbackUrl` `` apareciam com as crases na gaveta | `REGISTRO` (Cakto, OnyxPag) |
| **Nome interno na tela** — "o **motor** recusa" (3×), "TODAS as **entidades** do escopo", "orçamento atual da **entidade**" | Regras |
| **"payload" e "corpo cru"** — já estavam na lista de fora junto com POST/endpoint/cabeçalho | aba Testes |
| **"Nenhum pixel com token da CAPI"** — sobreviveu à troca que o resto do produto já fez para "conectado" | Checklist |

> ### ⛔ O parêntese não é só feiúra: ele esconde erro de concordância
> *"1 item(ns) como excluídos"* está errado em número **e** em gênero, na tela
> mais perigosa do produto (a Meta não desfaz exclusão). O `plural()` sozinho
> não bastava — o nome do nível tem gênero, então `NOME_DO_NIVEL` guarda
> `{ um, varios, genero }` e a frase concorda. Conferido na tela nos quatro
> casos: "1 campanha … excluída", "2 campanhas … excluídas", "2 anúncios …
> excluídos".
>
> `NOME_DO_NIVEL` mora em `AdsActionBar` (casa do tipo `Nivel`) e o
> `AdsManagerView` **importa de lá** em vez de manter a segunda cópia — os dois
> nomeiam os mesmos níveis, e duas listas para a mesma pergunta divergem.

**Deixados de propósito:** `NEXT_PUBLIC_APP_URL` no aviso de URL local (só
aparece em dev, e só quem faz o deploy pode agir), `</head>`, "Contém CSS"
(dentro do avançado) e o bloco de código das Credenciais de API (já endereçado
a "quem cuida do seu site").

### ⚠️ NÃO exercitado na tela — verificado só por código

| Item | Por que ficou assim |
|---|---|
| Ramo **"Falta conectar"** do card de pixel | exige um `PixelConfig` com `MetaPixel` cadastrado **e sem token**; os do dev têm zero pixels da Meta, então caem no outro ramo |
| **"N campanhas atualizadas"** (resultado da ação em massa) | executar exigiria escrita real na Graph API |
| **Resumo do sync** (`N erros`) e **`runRules`** (`N regras avaliadas`) | idem — dependem de chamada externa que não foi disparada |

Os três são troca de texto coberta por `tsc`/`build`, mas nenhum foi visto
renderizado. O diálogo de exclusão, esse sim, foi aberto e **cancelado** nos
dois níveis para conferir a concordância.

### 📋 Ordem da próxima sessão (decidida pelo usuário)

1. **(f) Camada didática** — estados vazios que ensinam + indicador de progresso
   de configuração.
2. **(g) Regras em duas regiões** — ver a fila de UX. Prioridade acima do (f)
   *no valor*, mas o usuário escolheu fazer (f) primeiro.
3. **(d) Responsividade / varredura de condicionais** — **por último e em sessão
   própria**: exige semear dados que ativem cada caminho condicional.

### Verificação desta sessão

`tsc`, `lint` e `build` limpos. Suítes afetadas: `test:analise-regra` 32/0 ·
`test:detectores` 56/0 · `test:espelho` 39/0 · `test:veiculacao` 40/0 ·
`test:gateways` 45/0. Os 3 `WebhookLog` semeados para testar o `<pre>` foram
removidos **por id coletado na criação**.

---

## 🚦 (histórico) gaveta do Pixel simplificada (31/07/2026, 4ª parte)

**Commitado em `cf19351` e já no `origin/main`** (a nota de "sem commit" acima
era da própria sessão que escreveu isto, e envelheceu).

> ✅ **`20260731090000_pixel_config_setup` ESTÁ APLICADA em produção** —
> confirmado pelo usuário em 01/08/2026: `37 migrations found · No pending
> migrations to apply`. Ele rodou o `migrate deploy` na própria sessão em que o
> aviso foi escrito. **Não há pendência de migration.**
>
> ⚠️ O aviso anterior dizia "continua marcada como PENDENTE" e estava
> **errado** — ninguém tinha verificado, e "não verificado por mim" virou "não
> aplicado" na escrita. É o mesmo modo de falha do "nenhuma escrita real foi
> exercida", que também nasceu de uma afirmação plausível e não checada.
> **Antes de registrar algo como pendente, pergunte — o usuário opera o sistema.**

A gaveta expunha o **mecanismo** em vez de resolver: ~10 blocos, e só o "Quem
envia cada evento" eram **5 linhas × 4 opções = 20 decisões** que exigem entender
deduplicação da Meta. Hoje são **8 controles** no caminho padrão.

> ### ⛔ Quando o caso é o mesmo para quase todos, a ferramenta RESOLVE
> O usuário desta ferramenta é infoprodutor: pixel do Facebook na página,
> checkout hospedado pelo gateway. Uma pergunta que ele não consegue responder
> sem estudar o mecanismo não é configuração — é transferência de problema.
>
> **Uma pergunta** ("o código do Facebook está instalado nesta página?") define
> os 5 donos. O resto tem padrão sensato e vive em "Configuração avançada".

### 🔴 Dois achados que a simplificação desenterrou — e a corrigem

**Achado 1 — `eventOwners` também é ASSADO no script, e a assinatura v1 não
cobria.** `pixelScript()` embute `var ALHEIOS = [...]`, mas a assinatura só
cobria `lead`/`addToCart`/`ic`. Mudar o dono de um evento gerava script defasado
**que o aviso de ontem não pegava** — e uma direção recria o bug que a 2ª parte
consertou:

| Passo | O que acontece |
|---|---|
| Dono do `PageView` vai de "pixel da página" para "Traffik" | |
| Servidor (decide **ao vivo**) | passa a mandar PageView à CAPI |
| Script instalado (`ALHEIOS` **congelado**) | continua sem espelhar |
| Pixel nativo | segue disparando o dele, sem `eid` |
| **Resultado** | CAPI sem par + nativo sozinho = **a Meta conta 2 de novo** |

E a gaveta antiga convidava a isso: a nota do PageView dizia *"Escolha Traffik só
se você NÃO tiver o pixel do Facebook na página"*, e quem clicava sem reinstalar
caía exatamente aí. **Assinatura v2** cobre donos + pixel nativo.

**Achado 2 — `sem-fbq` misturava um erro com uma configuração legítima.** Quem
**não tem** pixel nativo — caso válido, em que a CAPI é o único caminho — ganhava
10s de espera, `console.warn` e `sem-fbq` gravado **em toda visita**: alarme
vermelho permanente numa instalação correta. Agora o script recebe
`var NATIVO = false` e devolve **`sem-nativo`**, estado de tom neutro.

> ⚠️ Os dois achados são a **mesma raiz** que o preset resolve: o dono do evento
> (lido AO VIVO pelo servidor) e o comportamento do script (ASSADO no snippet)
> moravam em lugares diferentes e podiam discordar. Uma resposta, os dois lados
> coerentes por construção.

### Assinatura v2 — subir a versão NÃO acusa todo mundo

> ### ⛔ Comparar só os campos que a versão instalada CONHECE
> Um script v1 pode estar perfeitamente correto: ele só não sabe reportar "quem
> envia cada evento". Marcá-lo como divergente pintaria de âmbar a gaveta de todo
> usuário no dia do deploy, para a maioria sem nada errado — e **aviso que
> aparece sempre vira ruído que se aprende a ignorar**.
>
> `lerAssinatura` aceita 5 partes (v1) e 7 (v2); o que a v1 não tem volta `null`
> e sai da comparação. `avisoDeVersao()` devolve uma **nota cinza** — não
> divergência — dizendo *"se você mudou 'quem envia' depois de instalar, recole"*.
> Ela some sozinha na primeira reinstalação.

### O eixo "⟳ muda o script × ⚡ vale na hora"

| ⟳ Exige recolar | ⚡ Vale na hora |
|---|---|
| A pergunta do preset | Nome |
| Início de checkout · Lead · Carrinho | ID do pixel e token da CAPI |
| Regra de detecção do IC | Purchase (ligar, modo, valor, produto) |
| **Quem envia cada evento** | Ativar/desativar o pixel |

> ### ⛔ O selo é da REGIÃO, nunca do campo
> Exigência do usuário, e é restrição de layout, não decoração: campo a campo
> seriam ~15 selos numa gaveta de 5 blocos. **Se um campo que muda o script for
> parar num bloco `hora`, o selo passa a mentir** — ao mover campo de lugar,
> confira em qual lado ele cai.

**Ordem:** dados do pixel → como é o seu site (preset + eventos) → **script** →
envio das vendas → avançado.

> ⚠️ O script fica **depois** do bloco que o determina, não antes (o usuário
> pediu antes e concordou com a inversão): script acima das causas significa que
> marcar "Lead" deixa o código silenciosamente velho — o defeito exato que este
> trabalho conserta. A leitura vira *"isto define o script; aqui está o script"*.
>
> ⚠️ **Na criação não há script**, e a tela diz isso: ele embute o
> `PixelConfig.id`, que só existe depois do primeiro save.

### O preset

| | Sim, tenho pixel nativo (padrão) | Não |
|---|---|---|
| `PageView` | **o pixel da página** | **Traffik** |
| Lead · AddToCart · IC · Purchase | Traffik | Traffik |
| Script | espelha no `fbq` | **não espelha, não espera, não avisa** |

> ⚠️ **Só o `PageView` inverte.** Os demais só saem do navegador se alguém chamar
> `fbq('track', …)` explicitamente — não há emissor automático concorrendo, e
> rebaixá-los perderia conversão em silêncio.
>
> ⚠️ **Responder de novo SOBRESCREVE ajuste manual**, de propósito: é um pedido
> explícito de "reconfigure para este caso". O caminho de volta é o
> **`↩ voltar ao padrão`**, que só aparece quando os donos divergem do preset
> (`seguePreset`).

### `PixelConfig.setup` — nulo é "ainda não perguntamos"

`lerPreset()` **infere** do dono do PageView. Como o padrão do projeto já é
`PageView: "navegador"`, **todo pixel existente infere "tem pixel nativo"** — que
é exatamente o comportamento em vigor. Só cai em `false` quem trocou o PageView
para Traffik na mão, e aí `false` é a leitura certa.

### O que ficou de fora, e por quê

- **A 2ª pergunta ("onde o comprador paga?") foi CORTADA** pelo usuário: o padrão
  `clique_checkout` já cobre os dois casos, e uma pergunta a menos é uma decisão
  a menos. A escolha da regra de detecção vive só no avançado.
- **Nenhuma capacidade se perdeu.** Os 4 donos por evento continuam ajustáveis —
  viraram 5 dropdowns em vez de 20 botões.
- O campo **"Tipo: Meta (Facebook)"** saiu: era um select de uma opção só.

### Verificação

`test:detectores` **56/0** · `test:espelho` **39/0** · `test:utm-venda` 25/0 ·
`test:match` 20/0 · `tsc`, `lint` e `build` limpos.

**Conferido na tela** (dev, `dev@exemplo.dev`): criação cabe em meia gaveta (8
controles); edição mostra o aviso âmbar de script defasado; responder "Não, só a
Traffik" **reescreveu o PageView de "O pixel da sua página" para "Traffik"**;
mudar Purchase para "Ninguém" fez aparecer o `↩ voltar ao padrão`; os selos
`⟳ muda o script` / `⚡ vale na hora` aparecem no cabeçalho de cada região.

> ⚠️ **Não exercitado:** salvar um pixel com o preset "Não" e conferir o script
> gerado com `NATIVO = false` **no navegador** — só em teste (DOM falso). E o
> `sem-nativo` nunca foi gravado por um script real.

---

## 🚦 (histórico) sessão de 31/07/2026 (3ª parte) — TUDO EM PRODUÇÃO

**Três itens fechados e no ar** (commit `9c97a25`), migrations aplicadas antes do
push, produção sondada 6× sem `500`. **E a dedup do pixel foi confirmada do lado
da Meta** — a última prova que faltava do trabalho da 2ª parte.

| | Item | Estado |
|---|---|---|
| 1 | Aviso de snippet defasado na gaveta do Pixel | ✅ em produção, conferido na tela |
| 2 | Leitor da coluna `espelho` (aba Testes) | ✅ em produção, conferido na tela |
| 3 | UTMs copiadas para `Sale` + backfill | ✅ em produção; **backfill ainda não rodado** |
| — | Dedup confirmada no Gerenciador de Eventos da Meta | ✅ entrada única, "API de Conversões e navegador" |

> ⏳ **Único passo pendente, e não é urgente:** `npm run backfill:utms` (simula
> por padrão). Nada apaga `Click` automaticamente, então a janela dele **não está
> fechando** — ao contrário da do `backfill:platform`, que perde história a cada
> gateway removido.
>
> ```powershell
> npm run backup -- --url '<conn>'          # sempre antes
> npm run backfill:utms -- --url '<conn>'   # SIMULA
> ```

> ⚠️ **O aviso de snippet vai dizer "versão anterior" em produção, e está certo:**
> os snippets instalados hoje não sabem reportar a assinatura. Some quando o
> usuário regerar e reinstalar. Pelo mesmo motivo, boa parte do histórico do card
> de espelho aparece como "não informado" — o que interessa é o que entra daqui
> para frente.

### 1. ✅ Aviso de snippet defasado na gaveta do Pixel

`src/lib/pixel/detectores.ts` — o script **assina** o que ele detecta no momento
em que é gerado (`var DET = "v1.l1.a0.icontem_texto.v1rljein"`), manda a
assinatura no POST de todo evento, e a gaveta compara com o `PixelEventRule` ao
vivo. Migration `…070000` (`PixelEvent.detectores`).

> ### 🔴 As duas direções NÃO são simétricas, e a tela diz qual é qual
> | Na gaveta | No script instalado | O que acontece |
> |---|---|---|
> | Lead **ligado** | `LEAD=false` | 🔴 **nenhum evento sai, e nada denuncia** |
> | Lead desligado | `LEAD=true` | o evento sai e o servidor recusa com `regra desabilitada` — barulhento, tudo bem |
>
> Por isso `diferencasDeDetectores` tem frases diferentes para cada direção.
> Uma frase só ("os detectores divergem") esconderia qual delas custa conversão.

**Quatro estados, e `sem-dados` NÃO é `ok`:**

| Estado | Quando |
|---|---|
| `ok` | a assinatura reportada bate com a regra ao vivo |
| `divergente` | 🔴 discordam; as frases dizem em quê e o que fazer |
| `script-antigo` | está rodando, mas é anterior a este diagnóstico |
| `sem-dados` | nenhum evento chegou — **não afirmamos nada** |

Ausência de evento pode ser script não instalado, site sem tráfego ou script
quebrado, e não distinguimos os três. Dizer "tudo certo" ali seria o mesmo
silêncio que o diagnóstico existe para acabar.

> ⚠️ **Decide pelo evento mais recente VINDO DO SCRIPT**, não pela última
> assinatura já vista: um script reinstalado numa versão anterior tem de aparecer
> como antigo, e não como a assinatura boa da semana passada. Eventos com
> `eventId` começando em `gw:` são do webhook do gateway
> (`webhook/checkoutEvent.ts`) e nunca têm detector.

> ⚠️ **A checagem é recarregada DEPOIS de salvar.** Salvar muda o que a
> ferramenta espera do script; um resultado calculado antes viraria afirmação
> sobre a configuração anterior — pior que nenhuma, porque parece confirmação.

> ⚠️ **Normalização é o que impede alarme falso.** `"pay.kirvano.com, hotmart"` e
> `"pay.kirvano.com,hotmart"` dão a MESMA assinatura, porque
> `dominiosCheckout()` já apara e passa para minúsculas. Mas **seletor CSS não é
> normalizado** — `.btnCheckout` ≠ `.btncheckout` de verdade. Um aviso que às
> vezes mente treina o usuário a ignorar todos.

> ⚠️ **A rota aceita qualquer string curta em `det`**, de propósito. Validar
> contra o formato ATUAL transformaria snippet velho em snippet invisível — que é
> exatamente o caso que a coluna existe para exibir. O teto de 120 caracteres é só
> para a rota pública não escrever texto ilimitado.

**Campo novo no detector precisa entrar na assinatura** — senão ela passa a dizer
"igual" para snippets que já não são.

### 2. ✅ Leitor da coluna `espelho` (a dívida da sessão anterior)

Card **"Espelho no pixel da sua página"** em Integrações › Testes, entre o Teste
de Pixel e o de Webhook. Pílulas com a contagem por situação, aviso âmbar só
quando há problema real, e detalhamento por evento.

`src/lib/pixel/espelho.ts` é a fonte única de rótulo, tom e texto de ajuda —
**não pode morar em `actions/diagnostics.ts`**, que é `"use server"`: lá todo
export vira endpoint e um array exportado quebra o build.

> ⚠️ **`nulo` NÃO é falha**, e a distinção é o que dá valor ao resto. Cobre dois
> casos legítimos: evento de script anterior à coluna, e evento criado pelo
> SERVIDOR (o `InitiateCheckout` que nasce do webhook do gateway — esse nunca
> passa por navegador nenhum). Sem separá-lo, todo o histórico apareceria como
> espelho quebrado e o número que importa (`sem-fbq`) se perderia no meio.
>
> ⚠️ **O aviso âmbar só aparece com problema.** Alerta permanente vira ruído que
> se aprende a ignorar — inclusive quando muda de texto.

### 3. ✅ UTMs copiadas para `Sale` — migration `…080000`

`utmSource`/`utmMedium`/`utmCampaign`/`utmContent`/`utmTerm`/`fbclid`, gravados na
ingestão a partir do clique casado. Mesma classe do `Sale.platform`.

> ### ⛔ PRECEDÊNCIA: a cadeia `Sale → Click` VENCE a cópia — confirmado
> A preferência do usuário está certa e virou `lib/vendas/utmsDaVenda.ts`, o
> único ponto que decide isso. Três razões:
>
> 1. **É o caminho já exercido.** `ads/overview.ts`, `ads/creatives.ts` e
>    `areas/precedencia.ts` leem do `Click` há meses, contra dado real.
> 2. **Duas fontes para a mesma pergunta divergem sempre** — foi assim que a tela
>    de Áreas passou a dizer "Sem webhook" para uma área com webhook vinculado.
> 3. **A cópia é seguro, não índice.** Ela existe para o dia em que o clique
>    sumir; enquanto ele estiver lá, ele manda.
>
> ⚠️ Enquanto o clique existir, **as duas respondem igual** — a cópia é feita a
> partir dele e um `Click` nunca muda de UTM. A precedência só passa a importar
> quando o clique é apagado, o que hoje só acontece por "apagar dados" na
> exclusão de área, atrás de duas travas. **É por isso que ela é barata: não muda
> número nenhum hoje.**
>
> ⚠️ **Nunca mescla.** Campanha do clique + criativo da cópia produziria uma
> atribuição que não existiu em lugar nenhum. E o clique vence quando **tem algo a
> dizer**, não pela mera existência: um clique de tráfego direto não pode calar
> uma cópia herdada de um clique anterior mais forte.

> ### 🔴 Os UTMs viajam no MESMO `updateMany` do `clickId`
> Sob a MESMA guarda de precedência de fonte. Numa instrução separada, um match
> mais fraco poderia trocar a campanha sem trocar o clique, e a cópia passaria a
> descrever outro visitante. Escreve **inclusive os nulos**: a cópia descreve o
> clique para o qual a venda aponta AGORA.

> ### ⚠️ A armadilha do `select`, de novo — e desta vez com teste
> `matchClick` precisa **selecionar** as seis colunas. Fora do `select` elas
> chegam `undefined`, a venda nasce sem campanha e **nenhum `tsc`/`lint`/`build`
> acusa** — é a armadilha do `pedidoId`. O `select` virou constante única
> (`CAMPOS`) usada pelas três vias de match, e `test:utm-venda` chama o
> `matchClick` de verdade contra o banco para provar que os valores chegam.

**`npm run backfill:utms`** — simula por padrão. Idempotente de verdade: o `WHERE`
exige as seis colunas da venda nulas **e** o clique com ao menos uma preenchida.
Sem a segunda metade, toda venda de tráfego direto seria reescrita com nulos a
cada passada e a 2ª execução reportaria linhas tocadas.

> ✅ **A verificação que o usuário pediu é MEDIDA, não prometida.** Depois do
> `--aplicar` o script compara `country`/`countrySource` **linha a linha** e falha
> se qualquer um mudou; depois roda a 2ª passada e falha se ela tocar em algo.
> Exercitado contra o banco de dev: 8 vendas, país idêntico em 8, 2ª passada 0.
>
> ⚠️ O relatório é **recortado por dono** (`userId`), como manda a regra do
> `origem-venda.mjs`: um script que soma o banco inteiro está medindo outra coisa.

**A coluna tem leitor**: `npm run venda:inspecionar` mostra Campanha/Criativo/
Fonte resolvidos por `utmsDaVenda` e diz **de onde a resposta veio** ("respondido
pelo CLIQUE (a fonte)" × "pela CÓPIA na venda (o clique sumiu)"), avisando quando
falta cópia.

> 🐛 **Achado de quebra:** o `SELECT s.*, c."utmCampaign", c.fbclid` do inspetor
> passou a ter **nome de coluna repetido** — `Sale` agora tem `utmCampaign` e
> `fbclid` próprios, e no objeto de linha do `pg` o último vence. O inspetor
> mostraria o clique achando que mostra a venda. As colunas do clique foram
> aliasadas. **Toda consulta que faz `s.*` + join no `Click` tem esse risco.**

> ### ⚠️ O que NÃO foi feito, de propósito
> **A atribuição não usa a cópia como fallback.** Ela só dispararia com o clique
> apagado — que hoje não acontece sozinho — e ligá-la mudaria números (venda hoje
> não atribuível passaria a ser) sem gatilho que justifique. `utmsDaVenda` está
> pronto para quando fizer sentido: é uma linha.

### Verificação

| | |
|---|---|
| `npm run test:detectores` | **28 asserções, 0 falhas** (puro) |
| `npm run test:utm-venda` | **25 asserções, 0 falhas** (banco de DEV) |
| `npm run test:espelho` · `test:match` · `test:gateways` | 30 · 20 · 45, todos passando |
| `tsc --noEmit` · `lint` · `next build` | limpos |
| **Na tela** | as duas telas conferidas no navegador — ver abaixo |

**Conferido na tela** (dev, `dev@exemplo.dev`, dados semeados e removidos por id):

- gaveta do Pixel, pixel divergente → aviso âmbar com **as duas frases**
  ("Lead está ligado aqui, mas o script instalado não escuta o envio de
  formulários — nenhum evento chega." e "A regra de Initiate Checkout aqui é
  'contém texto'; o script instalado usa 'desligado'."), mais a instrução de
  regerar e o "Último evento recebido 5min atrás";
- gaveta do outro pixel → "✓ O script instalado no seu site corresponde a esta
  configuração.";
- aba Testes → `11 saiu junto · 3 saiu depois de esperar · 4 o pixel da página
  nunca apareceu · 1 erro ao espelhar · 8 outro dono envia · 8 não informado`,
  com o bloco âmbar só para os dois problemas e o detalhamento por evento.

### 📋 A FILA

1. **FILA DE UX — o próximo trabalho, com REAUDITORIA ANTES de executar.**
   Decisão do usuário: ela é grande demais para dividir sessão, e a lista
   envelhece (3b e 3c já estavam feitos quando a fila dizia que não). As telas
   criadas desde a última apuração — gaveta da Cakto, nova campanha, drill-down,
   coluna de veiculação, testar condição, dono do pixel, e agora o aviso de
   snippet e o card de espelho — **nunca foram auditadas** quanto à linguagem.
   Devolver com FEITO / PARCIAL / NÃO FEITO e uma recomendação de ordem.
   ⚠️ Vale a regra permanente: **simplifique jargão de PROGRAMAÇÃO, nunca de
   TRÁFEGO**, e confira `lib/explicacoes.ts` antes de "adicionar tooltip".
2. **Evento de TESTE da Cakto conta como venda real** — bloqueado até o usuário
   reativar a Cakto (precisa do payload real).
3. Import/export do Bloco 8; faxina do nav morto no `useTraffikState` +
   `EditDashboardDrawer` inalcançável.

### O que o usuário ainda deve

Nada. ✅ **A dedup foi confirmada do lado da Meta** — ver a seção abaixo. Os dois
itens que estavam aqui saíram: um foi verificado, o outro não se aplica ao funil.

## ✅✅ DEDUP CONFIRMADA NO GERENCIADOR DE EVENTOS DA META (31/07/2026)

**O usuário confirmou: o `InitiateCheckout` aparece como *"enviado por API de
Conversões e navegador"*, numa entrada ÚNICA.**

Isto fecha o ciclo que começou com **"1 venda real, o Gerenciador de Anúncios
marcando 2"**. A Meta estava contando cada conversão duas vezes e otimizando as
campanhas com sinal inflado — dinheiro real, sem erro e sem log em lugar nenhum.

> ### 🔴 A EVIDÊNCIA É DO LADO DA META, e é isso que a torna conclusiva
> Tudo que tínhamos até aqui provava o NOSSO lado: o `eid` no formato
> `InitiateCheckout-90whss` só sai do nosso `eid()`, o único ponto que chama
> `fbq('track', …, {eventID})` é o `espelhar()`, e o par não pode divergir por
> construção (o `track()` calcula o id UMA vez e entrega a mesma variável ao
> espelho e ao payload).
>
> **Nada disso prova que a META juntou os dois.** Só o Gerenciador de Eventos
> responde isso, e a resposta é binária: uma entrada marcada "API de Conversões e
> navegador" = juntou; duas entradas separadas = não juntou. Foi a segunda ponta
> que faltava, e ela não tinha substituto do nosso lado.
>
> ⚠️ **Não confunda com o `sent: 1` da nossa resposta.** Ele diz que a CAPI
> aceitou o evento, não que ela o casou com o do navegador. Era exatamente essa
> confusão que mantinha o bug invisível: a nossa CAPI respondia `sent: 1` o tempo
> todo enquanto a Meta contava dois.

### Estado final, evento a evento

| Evento | Situação |
|---|---|
| ✅ `PageView` | 1 requisição `/tr`, **sem `eid`**, dono é o pixel da página. Sem duplicação — é a partição funcionando, não coordenação |
| ✅ `InitiateCheckout` | espelho disparando, **dedup confirmada na Meta** |
| ⬜ `Lead` | toggle desligado; o usuário não tem formulário no funil atual |
| ➖ `AddToCart` | **não se aplica** — checkout hospedado pelo gateway, sem carrinho |

> ⚠️ **`AddToCart` saiu da lista de pendências, mas o detector dele continua sem
> nunca ter rodado.** A heurística é fixa (regex de "carrinho"/"comprar" no texto
> ou na classe) e nunca foi exercitada contra uma página real. Não é dívida deste
> usuário — o funil dele não tem carrinho —, mas **é dívida do produto**: no dia
> em que alguém com carrinho ligar o toggle, essa regex será exercitada pela
> primeira vez em produção.
>
> ⚠️ O mesmo vale para `Lead`, em menor grau: o caminho existe e passa nos testes
> em DOM falso (`npm run test:espelho`), mas nunca disparou num formulário real.

---

## 🚦 (histórico) fechamento da sessão de 31/07/2026 (2ª parte)

Tudo commitado e no `origin/main` até **`0fa68d1`**. As migrations
`20260731030000_sale_platform`, `…040000_pixel_event_dedup`,
`…050000_pixel_event_owners` e **`…060000_pixel_event_espelho`** estão
**aplicadas em produção**.

### ✅ O ESPELHO NO `fbq` NUNCA TINHA RODADO — corrigido e VERIFICADO em produção

A sessão anterior entregou o espelho (`057c06e`) e ele **nunca disparou uma vez**.
Sonda do usuário no navegador: **uma única** requisição para `facebook.com/tr`,
**sem `eid`**, enquanto a nossa CAPI respondia `sent: 1`. A Meta recebia dois
PageView sem nada em comum e contava os dois — desde o commit que "consertou" a
dedup.

**Causa:** a guarda `if (typeof window.fbq === "function")` dentro de um
`try/catch` vazio. O snippet é um IIFE inline e roda `track("PageView")` de forma
**síncrona, no parse**; colado ANTES do código da Meta no `<head>`, o `fbq` ainda
não existe. A guarda retornava **sem log nenhum**.

> ### 🔴 É o SÉTIMO caso do PROCEDIMENTO, e o mais sutil até agora
> Os anteriores eram código nunca chamado. Este **era chamado**, na hora certa,
> com os argumentos certos — e desistia na primeira linha. `tsc`, `lint`, `build`
> e os testes passavam. O que denunciou foi o usuário abrir o DevTools.
>
> **Guarda de compatibilidade (`if (typeof X === "function")`) precisa de ramo
> `else`.** Ela existe justamente para o caso em que a dependência falta — que é
> o caso que ninguém vai observar se ela for calada.

**Duas correções, e as duas importam:**

| | O quê |
|---|---|
| **Tolerar a ordem** | sem `fbq`, o espelho entra numa **fila** e sai assim que ele aparece — sondagem de 200 ms, teto de 10 s. O `event_id` é capturado no `track()` e viaja na fila: recalcular quebraria o par, porque o `eid` tem janela de 10 s |
| **Não falhar calado** | estourou o teto → `console.warn` dizendo **quais eventos** e o que fazer, e **`PixelEvent.espelho`** gravado (`ok` · `adiado` · `adiado-ok` · `sem-fbq` · `erro` · `alheio`) |

O estado viaja no próprio POST do evento. Quando só se resolve depois, um segundo
POST com **`somenteEspelho: true`** atualiza a coluna e **para** — não grava linha
nova e **não reenvia para a CAPI**, que duplicaria o envio server-side.

> ⛔ **Descartado esperar `load`/`DOMContentLoaded`:** falha justamente com código
> da Meta injetado por GTM *depois* do marco, e não tem sinal de fracasso. A
> sondagem tem prazo, e vencido o prazo ela **relata**.
>
> ⛔ **NUNCA definir `window.fbq` nós mesmos** para "garantir" que existe. O
> código-base da Meta começa com `if (f.fbq) return;` — um stub nosso faria o
> snippet do usuário **abortar inteiro**, e o pixel dele nunca inicializaria.

### 🔴 `PageView` passou a ser do pixel NATIVO por padrão

O código-base da Meta termina em `fbq('track','PageView')`: dispara em todo
carregamento, **sem `event_id`**, e não há como fazê-lo ir com um.

> ### ⛔ O espelho NÃO resolve o PageView — a conta prova
> | | requisições `/tr` | a Meta conta |
> |---|---|---|
> | Sem espelho | 1 (automática, sem `eid`) | automática + CAPI sem par = **2** |
> | Com espelho | 2 (automática + espelho `eid=X`) | automática + [espelho ⟷ CAPI] = **2** |
>
> O espelho casa com a **nossa** CAPI; o automático continua sozinho. **Dá 2 nos
> dois casos.** Como nenhum dos dois lados cede, quem cede somos nós.

`PADRAO_DO_EVENTO` (em `donos.ts`) põe `PageView` em **`navegador`**; os demais
seguem em `traffik`, onde não existe segundo emissor automático e rebaixar
perderia conversão em silêncio.

⚠️ **Isto MUDA o comportamento de quem já tinha pixel cadastrado**, e é o
objetivo — essas contas contavam visita em dobro. Quem **não** tem pixel nativo
na página escolhe "Traffik" na gaveta e volta ao envio server-side.

O valor **`navegador`** é novo (eram 3 donos, agora 4). "Meu gateway" apontava
para o lugar errado no PageView: ali o outro emissor é o pixel da **própria
página do usuário**, não o checkout — e um rótulo que aponta para o lugar errado
manda procurar o problema onde ele não está. Cada opção agora traz a consequência
escrita embaixo (`EXPLICACAO_DONO`), e o PageView tem aviso âmbar fixo
(`NOTA_DO_EVENTO`).

### ✅ Verificado em produção pelo usuário, no navegador

| Evento | Resultado |
|---|---|
| **PageView** | 1 requisição `/tr` sem `eid`; POST devolveu `{"enviado":false,"motivo":"outro dono"}` — **sem duplicação** |
| **InitiateCheckout** | 🎯 **o espelho disparou**: `eid=InitiateCheckout-90whss` e `-9uvavo` em dois cliques a 31 s de distância (ids diferentes = correto, são duas ações reais) |
| **Lead** | não disparou — **toggle desligado na gaveta**, comportamento correto (ver abaixo) |
| **AddToCart** | ainda não exercitado |

`npm run test:espelho` — **30 asserções, 0 falhas**. Exercita o script gerado num
DOM falso: `new Function` valida a sintaxe da template string, `fbq` presente
espelha na hora, `fbq` ausente enfileira e sai quando ele aparece, `fbq` que nunca
vem gera warn + relato, e o padrão novo deixa PageView como `alheio` **mas ainda
registrado no nosso banco**.

> ### 🔎 O formato do `eid` já é prova de que o espelho rodou
> `InitiateCheckout-90whss` (nome + hash base36) só sai do nosso `eid()`, e o
> **único** ponto do projeto que chama `fbq('track', …, {eventID})` é o
> `espelhar()`. O pixel nativo não produz essa forma; o do gateway produzia UUID.
>
> E o par não pode divergir **por construção**: `track()` calcula `id` uma vez e
> entrega a MESMA variável ao espelho e ao `payload.eventId`. Não são dois
> cálculos.
>
> ⚠️ O que nada disso prova é se a **Meta** juntou os dois. Só o Gerenciador de
> Eventos responde: uma linha marcada **"Navegador e Servidor"**, não duas.

### 🔴 ACHADO: o detector fica CONGELADO no snippet instalado

`LEAD`, `ADD_TO_CART` e a regra de `IC` são **assados no script na geração**
(`var LEAD = false;` → `if (LEAD) document.addEventListener(...)`), enquanto o
servidor consulta `PixelEventRule` **ao vivo**. As duas pontas divergem, e uma
das direções é silenciosa:

| Gaveta | Script instalado | Resultado |
|---|---|---|
| Lead **ligado** | `LEAD=false` (snippet velho) | 🔴 **nenhum evento, e nada denuncia** |
| Lead desligado | `LEAD=true` | evento sai do navegador, servidor recusa com `regra desabilitada` — barulhento, tudo bem |

**Ligar o toggle na gaveta não conserta sozinho — tem de regerar e reinstalar.**
É a mesma classe de tudo nesta sessão: configuração numa ponta, comportamento
congelado na outra.

> ⚠️ **Com clientes isso deixa de ser inconveniente e vira impossível** — não dá
> para abrir o DevTools na página de cada um para descobrir que o script está
> velho. Virou o **item 1 da fila**.

**Diagnóstico enquanto o aviso não existe** (do mais barato ao mais caro):
1. abrir a gaveta e olhar o toggle;
2. no console do DevTools, `getEventListeners(document).submit` → `undefined`
   significa `LEAD=false` no script instalado (sem efeito colateral);
3. `window.traffikPixel.track("Lead")` — a resposta do POST separa os dois casos:
   `{"skipped":"regra desabilitada"}` = regra off; `{"sent":1}` = **divergência**.
   ⚠️ Este manda um Lead **real** para a Meta.

### 📌 (histórico) o que a 1ª parte da sessão entregou

**Confirmado em produção pelo usuário: 1 venda real, o Gerenciador de Anúncios
marcando 2.** A Meta vinha contando cada conversão duas vezes e otimizando as
campanhas com sinal inflado. Três coisas foram feitas:

| | O quê |
|---|---|
| **`eventId` determinístico** | era `nome + Date.now() + Math.random()` — id novo a cada chamada, dedup impossível por construção. Hoje deriva de pixel + evento + página + visitante + janela de 10s (FNV-1a) |
| **Espelho no `fbq`** | 🔴 o código **nunca tocava em `fbq`**. Mandávamos `event_id` à CAPI e nunca dizíamos ao pixel do navegador para usar o mesmo. **Tornar o id determinístico sozinho NÃO consertaria** — dedup exige que a mesma parte dispare os dois lados |
| **Seletor de dono por evento** | `lib/pixel/donos.ts`, consultado pelos TRÊS caminhos de envio. Padrão **Traffik em tudo** |

> ### 🔴 A KIRVANO NÃO TEM CAPI PRÓPRIA — verificado no Gerenciador de Eventos
> Aparece **uma única** integração de API de Conversões, e ela é a nossa. Só o
> pixel de navegador dela dispara.
>
> **Então ela não pode ser dona de evento nenhum.** Delegar o Purchase a ela
> trocaria um envio server-side por um de navegador, e perderia as três coisas
> que importam: resistência a ad blocker, disparo só em venda **aprovada** (o
> dela dispara na página de obrigado, antes de o PIX ser pago) e o `user_data`
> que montamos (`fbc`/`fbp` reais, e-mail e telefone com hash).
>
> ⚠️ **O `eid` do gateway NÃO é derivável.** É um UUID gerado no navegador dele
> (`InitiateCheckout-ff7d1800-…`) e **não aparece em campo nenhum do webhook** —
> verificado nos 167 payloads reais, onde `sale_id` e `checkout_id` são códigos
> de 8 caracteres. Por isso a ausência de duplicata vem de **partição** (um dono
> por evento), nunca de coordenação.

⚠️ **O snippet vive no HTML do cliente.** A correção só chega por reinstalação.

### ⚠️ O QUE AINDA NÃO FOI VERIFICADO

| | Item | Por que ficou assim |
|---|---|---|
| ✅ | ~~**A dedup no Gerenciador de Eventos da Meta**~~ | **CONFIRMADA em 31/07/2026** — entrada única, "API de Conversões e navegador". Ver a seção da 3ª parte |
| ➖ | **`AddToCart`** | **não se aplica** ao funil do usuário (checkout hospedado, sem carrinho). O detector — heurística fixa de "carrinho"/"comprar" — segue sem nunca ter rodado numa página real |
| ⚠️ | **O bloco "Quem envia cada evento" com 4 opções** | a gaveta foi aberta (o toggle de Lead foi conferido), mas o bloco reescrito nesta sessão **não foi olhado na tela** |
| ⚠️ | **O globo** | corrigido em `47e2523`; vale reconferir zoom máximo e marcador cruzando a borda |

### 🔴 Dívida criada nesta sessão

**`PixelEvent.espelho` tem escritor e NENHUM leitor na tela.** É o padrão que o
PROCEDIMENTO existe para pegar, registrado de propósito em vez de deixar passar.
Hoje só responde por SQL:

```sql
SELECT event, COALESCE(espelho,'(nulo)') AS espelho, count(*)
FROM "PixelEvent"
WHERE "userId" = '<id>' AND timestamp > now() - interval '7 days'
GROUP BY 1,2 ORDER BY 1,2;
```

⚠️ `NULL` = evento gravado por script anterior à coluna, ou pelo caminho
server-side. **Não é "falhou"** — sem essa distinção todo evento histórico
apareceria como espelho quebrado.

### 📋 A FILA

**Os itens 1 e 2 são da mesma família: tornar visível o que hoje só se descobre
por teste manual.** Ordem definida pelo usuário em 31/07/2026.

1. **Aviso de snippet defasado na gaveta do Pixel.** O detector fica congelado no
   script instalado (ver o achado acima), e a divergência silenciosa — regra
   ligada, script velho — não produz evento nenhum e nada denuncia.
   **Com clientes isso é inviável de diagnosticar**: não dá para abrir o DevTools
   na página de cada um.
   > 💡 **O caminho já está pronto**: o script **já reporta pelo POST** de todo
   > evento. Basta mandar junto quais detectores ele tem ligados
   > (`lead`/`addToCart`/`ic` + o tipo da regra) e comparar com o
   > `PixelEventRule` ao vivo. A gaveta então avisa "o script instalado está
   > desatualizado — regere e reinstale".
2. **Leitor da coluna `espelho` na aba Testes.** Algo como
   *"espelhos nos últimos 7 dias: 412 ok · 3 sem-fbq"*, com o detalhamento por
   evento. É o que fecha a dívida acima.
3. **Cópia dos UTMs para `Sale`.** Mesma classe do `Sale.platform`: hoje a
   campanha de uma venda só existe via `sale.click.utmCampaign`, e `clickId` é
   `SetNull`. A janela de backfill **não está fechando** (nada apaga `Click`
   automaticamente), então é barato e não urgente.
   ⚠️ Decidir a precedência antes de codar — a preferência do usuário é
   **continuar usando a cadeia `Sale → Click` enquanto o clique existir**, com a
   cópia só como fallback.
4. **Reauditoria da fila de UX** — 3a corrigido, 3b/3c já feitos, **3d e 3f
   pendentes**, 3e a verificar. ⚠️ A fila envelhece: as telas criadas desde então
   (gaveta da Cakto, nova campanha, drill-down, coluna de veiculação, testar
   condição, dono do pixel) **não foram auditadas** quanto à linguagem.

Dívidas antigas que continuam: nav morto no `useTraffikState`,
`EditDashboardDrawer` inalcançável, import/export do Bloco 8.

> ⚠️ **O dia 31/07 passou de US$ 560 em uso de API somando as duas partes.** Ele
> cobriu segurança de credenciais, `Sale.platform`, limpeza de dado de teste em
> produção, o globo, o desempate por fuso e o pixel inteiro — do `eventId`
> determinístico até o espelho comprovadamente disparando em produção.
> **Comece a próxima com contexto limpo.**

## 🚦 (histórico) estado em 30/07/2026

Tudo até `3bc1cda` está **em produção**. **A padronização visual terminou** — os
dois itens que faltavam (aproveitamento do espaço das 4 telas + os SVGs legados)
foram feitos em 30/07/2026 e estão **na árvore de trabalho, ainda SEM COMMIT**,
aguardando o teste do usuário.

> 🔴 **HÁ MIGRATION PENDENTE (31/07/2026): `20260731020000_effective_status`.**
> Ordem obrigatória: `npx prisma migrate deploy` na produção **e só então**
> `git push`. Ela é aditiva (3 colunas nullable), então o build antigo continua
> funcionando — mas o código novo faz `SELECT` delas em toda carga do
> Gerenciador. Depois do primeiro sync, rode **`npm run ads:sonda`**.

### ⚠️ Fila da próxima sessão

**GEOLOCALIZAÇÃO — passos 1 a 4 FEITOS e o backfill APLICADO em produção.**
As rotas resolvem o país, a base cobre IPv4 **e IPv6**, o mapa foi de 32 para
**252 países**, e o histórico foi preenchido: **237 cliques · 15 vendas** (eram
0 e 2). 11 vendas são perda definitiva — nunca tiveram IP no payload.

⚠️ **Dois achados mudaram a ordem, e os dois BLOQUEIAM o hash do IP** (que é
irreversível): a marcação de bot e o **navegador embutido do app da Meta**, que
responde por **55,6% do tráfego humano** e falseia o país do clique. Ver as
seções próprias.

✅ **Passo 5 (marcação de bot) FEITO** — tem **migration**, então o deploy é
`migrate deploy` → `npm run bot:reclassificar --aplicar` → `push`, nessa ordem.

✅ **Passo 6 FEITO** — desempate pela segmentação da campanha + `countrySource`.
Tem **migration**: `migrate deploy` → `push`, nessa ordem (sem script no meio).

⚠️ **Confirme no primeiro sync que `AdSet.geoCountries` vem preenchido.** Se
vier vazio para todos, o desempate fica **inerte em silêncio** — o mesmo estado
em que a base de países ficou antes do passo 1.

**A fila completa está em "📋 FILA DE TRABALHO PENDENTE"** — referência por
item (*"vamos para o 3d"*). O próximo é o **item 1: Cakto + arquitetura
universal de gateways**.

**Concluído nesta sessão, nesta ordem:**
1. Aguardar o sync e rodar **`npm run geo:sonda`** — obrigatória, prova se o
   desempate está ativo ou inerte.
2. **Fase B** do passo 7: purga progressiva do `Click.ip` (7 dias) + retenção do
   `WebhookLog`. Aprovada, nada escrito ainda.
3. **Fase A ADIADA** — limpar o IP dos payloads só depois da arquitetura de
   parsers estar estável, e na versão que remove **só o IP**.

⚠️ **O plano original do passo 7 estava errado** e a investigação salvou: hashear
o `Click.ip` quebraria o `client_ip_address` da CAPI **em silêncio**, degradando
a otimização de campanha com dinheiro real. Ver a seção "🔐 Passo 7".

Fora isso: **faxina de código morto** (lista em "Pendências abertas") e o
**import/export do Bloco 8**, que ficou de fora de propósito. O lint está em
zero e não há item de padronização visual pendente.

⚠️ **As ações em massa e o duplicar nunca foram exercidos.** Pausar e alterar
orçamento já foram, por uso real; o **motor de regras** rodou em produção em
31/07/2026, com escopo confirmado. Ver "Escrita na Graph API" e "O ENSAIO A SECO
DISPAROU".

### O que NÃO está pendente (não refaça)

| Item | Situação |
|---|---|
| Microcópia | ✅ ~30 textos + tooltips. `lib/explicacoes.ts` é o catálogo — **confira antes de "adicionar tooltip"**, ele é mais completo do que parece |
| Selects e checkboxes nativos | ✅ **zero**, fora de 2 exceções documentadas (mês/ano do `DateRangePicker`, `test-checkout`) |
| Emojis | ✅ trocados por `ui/Icone` (`lucide-react`). Emoji de **bandeira** no `CountryMap` fica — ali é bandeira, não ícone |
| Scripts expostos | ✅ UTMs e Pixel em gaveta |
| Bloco 8 (Regras) | ✅ completo, menos import/export (fora de propósito) |
| Áreas de Trabalho | ✅ sessões 1–4 + exclusão com escolha |
| Aproveitamento do espaço | ✅ as 4 telas refeitas em 30/07 — ver a seção própria |
| SVGs em 256×256 | ✅ **zero**. `Icon.tsx` (`NavIcon`) foi deletado |
| Lint | ✅ **zero problemas**. Os `eslint-disable` que restam são deliberados e levam o motivo na linha — **não os remova sem ler o motivo** |
| Texto esticado nos gráficos | ✅ resolvido por `ui/useTamanho` — ver a seção própria |
| Layout padrão do Dashboard | ✅ 21 blocos, em `PADRAO_KPIS`/`PADRAO_GRAFICOS` |

### 🔴 Cinco regras que custaram caro — não reabra

1. **`NULL` não significa a mesma coisa em toda coluna.** Ver a tabela na seção
   própria. Em `AutomationRule` e `Expense`, nulo **amplia escopo**.
2. **Campo de formulário mora na VIEW, nunca no `useTraffikState`.** Cada tecla
   ali re-renderiza o dashboard inteiro.
3. **Não devolva `onClose` às dependências do efeito de `useOverlay`.** Era a
   causa do campo perder o foco a cada tecla, em toda gaveta e modal.
4. **`useTraffikState` sincroniza as props do servidor por efeito.** O
   inicializador de `useState` só roda na montagem — sem o efeito, trocar de área
   mostrava a integração da área ANTERIOR.
5. **Helper consumido pela UI não pode morar em módulo que importa Prisma.**
   `FeesView` é client component; o import arrastou o driver `pg` (`dns`, `fs`)
   para o bundle e quebrou o build. Ver `lib/areas/taxas.ts`.
6. **`useTamanho` usa callback ref + nó em estado.** Com `useRef` + deps `[]` o
   observer nunca se anexa quando o elemento ainda não existe (gráfico que abre
   vazio) e a largura fica 0 para sempre.
7. **`align-items:start` num grid de cards mata o rodapé alinhado.** Com `start`
   cada card fica só com a altura do próprio conteúdo, o `margin-top:auto` do
   rodapé não tem folga, e um nome que quebra em 3 linhas desalinha os botões de
   toda a fileira. Grade de cards com rodapé usa `stretch`.

## 🧱 Aproveitamento do espaço nas 4 telas (30/07/2026)

Quatro telas tinham um card pequeno no canto e o resto vazio. As quatro usavam
`grid auto-fit minmax(360px,1fr)`, que dá metade da tela a cada bloco
independentemente de quanto conteúdo cada um tem.

> ### ⚠️ O erro de projeto era supor MUITOS itens. O caso comum é UM.
> Cheguei a dar **1,5fr** aos gateways de Webhooks por serem "o caminho
> principal". Ficou pior: com **um** gateway — que é o normal, quem usa a
> ferramenta tem um checkout — o card de 290px ficava sozinho num track de
> 1350px. Era o mesmo "card no canto", só menor.
>
> **Dimensione a coluna pelo caso de 1–2 itens, não pelo de 10.** Colunas iguais
> de ~680px cabem exatamente 2 trilhas de card: 1 webhook + o tile de adicionar
> preenchem a fileira, e com 4 viram duas fileiras cheias.

| Tela | Antes | Agora |
|---|---|---|
| **Webhooks** | 2 colunas `auto-fit`, linhas de largura total, conteúdo em 200px de altura | 2 colunas iguais; gateways em **grade de cards**; estado vazio da chave explica **quando** ela serve |
| **Pixel** | `max-width:920px`, cada pixel numa linha de 35px | full width, **um card** com intro + grade de cards; chip âmbar de "não envia nada" |
| **UTMs** | card esquerdo = um título e um botão (tudo dentro do modal) | as **3 plataformas na tela**, com Copiar na linha; o código segue no modal |
| **Taxas** | coluna de 1050px, `Nome da despesa` com 1050px de largura | **3 cards de custo lado a lado** + sidebar; formulário que **embrulha** |

### O tile "+" dentro da grade é layout, não só ação

`+ Adicionar` como **tile tracejado no fim da grade** (padrão que Integrações ›
Anúncios já usava) é o que garante que a fileira nunca fique com um card solto.

> ⚠️ **Onde há tile, NÃO há botão no cabeçalho.** Os dois seriam a mesma ação em
> dois lugares — o erro do "Editar" duplicado no card de webhook. A regra que
> ficou: **galeria usa tile; lista usa botão no cabeçalho** (por isso Credenciais
> de API, que é lista numa coluna estreita, manteve o botão).

### Detalhes que não são óbvios

- **`minmax(0,1fr)` em vez de `1fr`** em todo grid de 2 colunas: com `fr` puro o
  mínimo do track é o conteúdo, e uma linha longa do `<pre>` do payload ou um nome
  de despesa comprido **estoura o track e cria rolagem horizontal na página**.
- **`item` da grade é `div` com borda, não `.card`** quando está dentro de um
  `.card`: o fundo seria o mesmo do pai e o cartão desapareceria.
- **`FormAdicionar` embrulha com `flex:1 1 140px` + `min-width:0`**, sem media
  query. Sem o `min-width:0` o conteúdo define o mínimo do item flex, o `wrap`
  nunca acontece e a linha estoura o card.
- **O modal de "Parâmetros de URL" foi MANTIDO** — a regra do Bloco 11 (dado
  verboso não aparece na listagem) continua valendo. O que entrou no card foi a
  **escolha** da plataforma, com "Copiar" na própria linha.

> ### ⛔ Espaço vazio NÃO se preenche com bloco de código
> Cheguei a abrir o "Como usar" das Credenciais de API por padrão (`<details open>`)
> quando não havia chave, com o argumento de que era o momento em que a pessoa
> precisava do payload — e de que enchia a coluna. **Reprovado pelo usuário em
> 30/07/2026, nas duas frentes:** um bloco de código escancarado e, pior, uma
> explicação que só um dev entenderia (*"envie um **POST** para o **endpoint** com
> a chave no **cabeçalho** `Authorization`; os nomes dos campos são
> **tolerantes**"*).
>
> **Quem lê esta tela é gestor de tráfego. Quem consome aquele bloco é a pessoa
> que fez o checkout dele.** Então:
> - o `<details>` volta a nascer **fechado**, e chama-se **"O que entregar para
>   quem cuida do seu site"** — o título já diz a quem interessa;
> - o texto de dentro começa com *"você não precisa entender o que aparece aqui"*
>   e manda gerar a chave e repassar dois blocos;
> - a URL e o exemplo ganharam rótulos em português (*"Endereço para enviar as
>   vendas"*, *"Exemplo de como enviar"*) em vez de nada;
> - **o vazio da coluna é preenchido pelo estado vazio da chave**, que explica em
>   linguagem normal *quando* uma chave é necessária (checkout sob medida, ou
>   plataforma fora da lista). Isso é conteúdo útil; o code dump não era.
>
> Vale a regra de microcópia que já existia, aplicada ao caso: **POST, endpoint,
> cabeçalho, payload e "campos tolerantes" são jargão de PROGRAMAÇÃO e saem.**
> `gateway` e `checkout` são vocabulário do usuário e ficam.

## 🎨 Convergência de ícones CONCLUÍDA (30/07/2026)

Os 11 SVGs em `viewBox="0 0 256 256"` (`strokeWidth` de 16 a 20) foram migrados
para `ui/Icone`, que é 24×24 com traço 1,75. **`Icon.tsx` (`NavIcon`) foi
deletado.** 27 nomes novos no `MAPA`, ~35 pontos de uso.

> ### ⛔ Banco de `path` em string é COMO a divergência volta
> Dois lugares guardavam `icon: "M40 40 h72…"` num array de configuração — o `NAV`
> da `Sidebar` (7 ícones) e as `ABAS` do `AdsManagerView` (4). Parecia dado,
> era desenho, e escapava de qualquer padronização de tamanho e traço.
>
> **Campo de ícone dirigido por dados guarda um `NomeIcone`, nunca um `path`.**

- **`Icone` ganhou `style?: CSSProperties`**, mesclado depois da base. É só para
  `transform`/`animation`/`opacity` — a seta do delta que gira 180° na queda, o
  caret do menu, o "Atualizar" que roda, a opacidade do estado vazio. **Não é
  porta para cor:** cor passa por `cor`, senão volta a haver hex solto na view.
- **`IconeEvento` do feed deixou de receber cor.** A pílula em volta já pinta
  `color:<cor do evento>` e o ícone herda por `currentColor`.
- **`pix` é `QrCode`**: no Brasil o Pix *é* o QR code. O losango genérico anterior
  não dizia nada.
- **Não passam por aqui, de propósito:** os `<svg>` de `Funnel`, `Donut`,
  `CountryMap`, `AreaChart` e o `Sparkline` do `chartKit` são telas de gráfico
  desenhadas por coordenada. `Select`, `Checkbox`, `InfoTip` e `WorkspaceSelect`
  têm um SVG cada, já em 24×24, que é o desenho interno do primitivo.

### Achados de quebra

- **`EditDashboardDrawer` é código MORTO e inalcançável.** Está montado em
  `DashboardShell`, mas **ninguém chama `openEditDash`** — quem edita o dashboard
  é o painel inline "Métricas disponíveis" do Bloco 2. Entra na faxina.
- **`AdsManagerView` mostrava `{contagem} item(ns)`**, que o `plural()` existe
  para eliminar. Corrigido para "2 itens" / "nada aqui".
- **A logo da Cartpanda ficou mais exposta.** Antes só aparecia nas abas do modal;
  agora está numa das 3 linhas de destino da aba UTMs. Segue sendo o caso ruim
  documentado (panda preto em fundo transparente, quase invisível no tema
  escuro) — resolver exige arte em versão clara.

## 📊 Gráficos: texto em escala 1:1 e rótulos que raleiam (30/07/2026)

**Sintoma relatado:** no bloco pequeno os rótulos do "Faturamento vs. gasto"
ficavam **achatados**; no bloco grande, **esticados e enormes**. E "Vendas por
dia" com 30 dias empilhava datas encostadas umas nas outras.

**Causa: `viewBox` fixo + `preserveAspectRatio="none"`.** O `AreaChart` usava
`viewBox="0 0 640 260"`, então a escala horizontal era `largura/640` e a vertical
`altura/260` — valores diferentes, que deformam o **texto** junto com a
geometria. O bloco é redimensionável, então a mesma tela tinha duas tipografias
erradas dependendo do arraste do usuário. (O `<pre>` do tooltip já havia sido
tirado do SVG por esse motivo; os eixos ficaram para trás.)

**`ui/useTamanho.ts`** mede o elemento com `ResizeObserver`. Com a largura em
estado, o `viewBox` passa a ser o tamanho real (**1 unidade = 1 pixel**, escala
1,000 medida em runtime) e o gráfico decide **quantos** rótulos cabem.

| | Antes | Agora |
|---|---|---|
| Escala do texto | variava com o bloco | sempre 1:1 |
| Rótulos do eixo X (área) | `ceil(n / 8)`, fixo | pela largura medida; primeiro e **último** garantidos |
| Rótulos das barras | **todos**, sempre | a cada `ceil(n / (largura/42))`, mais o último |

Medido: 30 barras em 615px → 11 rótulos; o mesmo bloco mais largo → 16. Os 30
dias do eixo do `AreaChart` couberam inteiros em 2.254px, sem deformar.

> ### ⛔ `useTamanho` usa CALLBACK REF e guarda o nó em ESTADO
> A primeira versão era `useRef` + `useEffect(…, [])`, e estava **silenciosamente
> quebrada**: o efeito roda uma vez, e nesse instante o elemento **não existe** —
> todo gráfico faz `return <ChartEmpty/>` antes do markup quando não há dado, e o
> Dashboard abre justamente sem dado. `ref.current` era `null`, o observer nunca
> era anexado, e com deps `[]` **não havia segunda tentativa**: a largura ficava 0
> para sempre e o raleamento nunca acontecia.
>
> Com o nó em estado, **montar o elemento é uma mudança de dependência**.
>
> ⚠️ Quem precisa do DOM (um `getBoundingClientRect()` em evento) usa o **`no`**
> devolvido pelo hook, não `algumRef.current`.
>
> ⚠️ **DESTRUTURE o retorno.** Guardar o objeto (`const caixa = useTamanho()`)
> faz o `react-hooks/refs` tratar todo `caixa.*` como leitura de ref no render e
> acusar erro até em `caixa.largura`, que é estado comum.

> ⚠️ **`Sparkline`, `Donut`, `Funnel` e `CountryMap` seguem com `viewBox` fixo, e
> está certo:** o `Sparkline` não tem texto nenhum, e nos outros o texto é HTML
> por fora do SVG. Esticar só é problema quando há `<text>` dentro.

## 🧭 Layout PADRÃO do Dashboard — transcrito do arranjo do usuário (30/07/2026)

**23 blocos**, e é o que toda **área nova** e **conta nova** vê. Vive em
`KPIS_PADRAO` + `GRAFICOS_PADRAO`, em `blocks.ts`.

> ### ⛔ É uma TABELA EXPLÍCITA de coordenadas. Não volte para o algoritmo.
> A primeira versão empacotava os blocos em fileiras que somavam 12. Estava
> correta e ficou **genérica**: pares lado a lado, tudo do mesmo tamanho. O
> usuário montou o arranjo dele arrastando na tela e pediu para virar o padrão —
> então o padrão é a transcrição, coordenada por coordenada. **Fluxo automático
> não reproduz uma composição feita a olho.**

```
 ┌ 12 KPIs, 6 por fileira (w=2) ──────────────────────────────────────┐
 │ Fat. │ Gasto │ ROAS │ Ticket │ CTR  │ Reemb.                       │
 │ Pend.│ Vendas│ ROI  │ CPA    │ ARPU │ Margem                       │
 ├──────────── ESQUERDA (w=7) ──────────┬──── DIREITA (w=5) ──────────┤
 │ Funil de conversão              h=7  │ Vendas por país         h=7 │
 │ Atividade recente               h=6  │ Taxa de aprovação       h=4 │
 │ Fat. vs gasto (4) │ Produto (3) h=5  │ Vendas por dia          h=4 │
 │ Fonte (3) │ Pagamento (4)       h=5  │ Lucro por horário       h=4 │
 │                                      │ Vendas por horário      h=4 │
 └──────────────────────────────────────┴─────────────────────────────┘
```

**Duas colunas de larguras DIFERENTES (7 e 5)**, e é isso que dá o aproveitamento
de espaço: o funil e o feed pedem largura, os cinco blocos da direita são
compactos e empilham.

> ⚠️ **As colunas terminam na MESMA linha, e isso é o que elimina o buraco.**
> Esquerda `7+6+5+5 = 23`; direita `7+4+4+4+4 = 23`. Ao mexer numa altura,
> reequilibre a outra coluna — o `react-grid-layout` compacta na vertical, então
> um desequilíbrio não dá erro: aparece como vazio no pé de uma coluna.
>
> ⚠️ **Verificado com um mapa de ocupação**: 0 colisões, 0 células vazias nas 23
> linhas, e os KPIs terminando exatamente na borda direita do grid.
>
> ⚠️ **`kpi:chargeback` fica FORA** de propósito — são 12 KPIs, não 13. Continua
> em "Métricas disponíveis".
>
> ⚠️ **No mobile (4 colunas) tudo vira largura total**, empilhado na ordem visual
> do desktop (`y`, depois `x`) — duas colunas de gráfico em 4 unidades deixariam
> as duas ilegíveis.
>
> ⚠️ **Layout já salvo NÃO é mexido.** Quem tem `DashboardLayout` no banco
> continua com o arranjo dele; reorganizar o dashboard de alguém sem pedir seria
> pior que o problema. Para adotar o padrão: "Redefinir configurações".

### 🔴 Bug real achado no caminho: "Redefinir" apagava o layout da área ERRADA

`useDashboardLayout` tinha `redefinir` com deps **`[]`** e `salvar` com
`[layouts]`, os dois usando `workspaceId` por dentro. `useCallback` congela o
valor do render em que foi criado, então o callback carregava a área ativa **na
montagem do Dashboard**: trocar de área e clicar apagava/gravava o layout de
outra área. No `redefinir` era certeza (nunca recriado); no `salvar` era uma
corrida que `[layouts]` mascarava.

Agrava porque `redefinir` é destrutivo, imediato e **"Cancelar" não desfaz**.

> ⚠️ **Aviso de `exhaustive-deps` sobre `workspaceId` neste projeto é sinal de
> bug, não ruído.** Todo o isolamento por área depende desse id chegar certo.

## ✅ Lint zerado — e o que NÃO se conserta obedecendo (30/07/2026)

De **36 problemas (21 erros) para 0**. A distribuição importa mais que o número:

| Regra | Qtd | Desfecho |
|---|---|---|
| `no-unused-vars` | 13 | removidos de verdade (ver abaixo) |
| `react-hooks/refs` | 10 | **consertados**: viraram largura medida |
| `set-state-in-effect` | 10 | suprimidos **um a um, com o motivo na linha** |
| `exhaustive-deps` | 2 | 1 bug real (acima) + 1 dep de nó |
| `immutability` | 1 | `Donut` pré-calcula os ângulos |

**O que era código morto de verdade** (não só "variável sem uso"): o componente
`Barras` inteiro no `BlockContent` (substituído pelo `Donut`), `NOME_FONTE` no
`AdsTable` (a legenda virou "Vem do Facebook / Medido pela Traffik / Calculado"),
as props `onSincronizar`/`sincronizando` do `AdsActionBar` — restos do botão
"Sincronizar métricas", que o `AdsManagerView` ainda passava — e o `semVenda` da
`AreasView`, do chip de produto sem venda que saiu na Sessão 3.

> ### ⛔ `set-state-in-effect` NÃO se conserta obedecendo
> Dois dos 10 são a **regra #4 das "cinco que custaram caro"**: o
> `useTraffikState` sincroniza as props do servidor por efeito porque o
> inicializador do `useState` só roda na montagem — sem isso, trocar de área
> mostra os dados da área ANTERIOR. Outro é o `useOverlay`, cuja correção de foco
> a regra #3 protege. Os demais são carga de dado e sincronia com sistema externo
> (`localStorage`, `prefers-color-scheme`), que a própria doc do React permite.
>
> **Obedecer à regra aqui reintroduz bugs já pagos.** Cada `eslint-disable` leva
> o motivo na própria linha.

> ### ⚠️ Ao inserir um `eslint-disable` acima de uma linha, CONFIRA que você não
> ### substituiu a linha
> Fazendo isso em lote eu **apaguei três linhas de comportamento** —
> `setBusca("")` (o campo de busca do `Select` parava de limpar ao reabrir),
> `setDados(null)` (`BannerPendencias` perdia o estado de carregando) e
> `setCarregando(true)` (a `RulesView` parava de mostrar que estava carregando).
> Nenhuma quebrava tipo ou build; o que denunciou foi o lint reclamando de
> **"Unused eslint-disable directive"** — o comentário tinha ocupado o lugar do
> `setState` que ele deveria justificar. Restauradas.

> ⚠️ **`public/*.js` saiu do lint** (`eslint.config.mjs`). São os runtimes
> instaláveis, ES5 por exigência de compatibilidade e **gerados** — lintar com as
> regras do app só produzia ruído em código que não é da aplicação.

### 🐛 De quebra: o cursor "grabbing" do globo nunca aparecia

`CountryMap` lia `arrasto.current` no `style` durante o render. Mudar um ref não
redispara render, então o cursor **nunca** trocava ao arrastar. Virou estado.

## 📅 Períodos: UMA fonte, três telas (30/07/2026 — Prompt C)

`src/lib/periodo.ts` é a **fonte única** das janelas de data, usada pelo seletor da
interface E pelo servidor. `src/components/dashboard/ui/FiltroPeriodo.tsx` é o
**único** seletor de período da ferramenta.

### 🔴 Havia TRÊS implementações da mesma regra — e duas estavam erradas

`resolveRange` (`dashboard/metrics.ts`), `rangeStart` (`ads/overview.ts`) e outro
`rangeStart` (`ads/creatives.ts`), este último com o comentário *"mesma janela do
gerenciador"* — a confissão de que era cópia.

**Os dois `rangeStart` devolviam só o INÍCIO** e filtravam `timestamp >= start`,
isto é "do início até agora". Isso funcionava por acidente: os únicos períodos
eram Hoje/7d/30d, que terminam hoje. Ao entrar "Ontem" e "Mês passado" no
seletor, aquilo passaria a trazer **a janela escolhida mais tudo o que veio
depois** — "Mês passado" incluindo o mês atual.

**Provado contra o banco de dev** (gasto todo em julho, hoje é 30/07):

| Período | Gasto retornado | |
|---|---|---|
| `mesPassado` (junho) | **R$ 0,00** | ✅ correto — com o código antigo daria 800 |
| `mesAtual` (julho) | R$ 800,00 | ✅ |
| `ontem` (29/07) | R$ 800,00 | ✅ |
| `hoje` (30/07) | R$ 0,00 | ✅ |

### O que a centralização entregou

- **7 períodos** em vez de 3: Hoje · Ontem · Últimos 7 · Últimos 30 · Este mês ·
  Mês passado · Personalizado — nas **três** telas (Dashboard, Gerenciador,
  Criativos). O Gerenciador e os Criativos não tinham calendário nenhum.
- **"Ontem" ganha detalhamento por HORA** de graça: a granularidade passou a ser
  "hora quando a janela é de um dia", em vez de "hora só quando é hoje".
- `DashPeriod` e `CreativePeriod` viraram **alias de `PeriodoNome`**. Eram três
  uniões separadas — um período novo exigia editar três arquivos para funcionar.

> ### ⛔ O período viaja como NOME, nunca como intervalo de datas
> `?period=mesPassado`, não `?from=…&to=…`. Quem resolve a janela é o servidor,
> com o **fuso do usuário** — que o navegador não conhece de forma confiável.
> Resolver data no cliente foi exatamente o bug de "o hoje do calendário era o do
> navegador". A única exceção é `custom`, que **é** um intervalo por definição.
>
> ⚠️ **Valide com `ehPeriodoValido`, não com uma lista escrita na rota.** As três
> rotas tinham `["hoje","7d","30d"].includes(...)` — uma lista local fica para trás
> a cada período novo e o valor cai no fallback **em silêncio**.
>
> ⚠️ **O relógio de `janelaDoPeriodo` é injetável (`agora`).** Não é luxo de teste:
> trocar `Date.now` de fora **não funciona**, porque `new Date()` lê o relógio
> interno direto — foi assim que 8 asserções minhas falharam antes de eu perceber
> que o teste estava errado, não o código.
>
> ⚠️ **Aritmética de mês é por STRING.** Nada de `new Date(ano, mes-1, 1)`: o
> construtor trabalha no fuso do PROCESSO, que na Vercel é UTC. O último dia do mês
> passado é `primeiroDoMesAtual − 1 dia` em chave de dia.

**`npm run test:periodo` — 33 asserções**, com `TZ=UTC` forçado (o fuso da
Vercel): virada de ano num fuso +14, fevereiro bissexto, o mesmo instante dando
dias diferentes em fusos diferentes, `custom` invertido, e querystring adulterada.

### Botão "Atualizar" (C1) — já existia; faltava a idade do dado

Posição, spinner, `disabled` durante a atualização, ausência de reload e mensagem
de erro **já estavam feitos**. O que faltava era o **"Atualizado há Xs"**: o
`syncLabel` existia no estado e só era exibido no Gerenciador — no Dashboard, que
é onde fica o botão, não havia como saber se o número é de agora ou de 20 minutos
atrás. Ele desaparece enquanto sincroniza, porque aí quem informa é o botão.

## 💰 Faturamento líquido, Lucro e cores (30/07/2026 — Prompt B)

`src/lib/financeiro.ts` é a **conta única** de líquido, lucro, margem, ROI e das
cores dessas métricas.

### 🔴 Coprodução e custo de produto NÃO EXISTIAM

`ExpenseType` tinha só `TAXA_GATEWAY`, `IMPOSTO` e `DESPESA_RECORRENTE`. Sem os
dois tipos novos, o Faturamento Líquido só descontaria gateway e imposto e
apareceria **maior que a realidade** — continuando plausível, que é o pior tipo de
erro. Migration `20260730120000` acrescenta `COPRODUCAO` e `CUSTO_PRODUTO`
(**aditiva**: `ALTER TYPE ... ADD VALUE`, nenhuma linha muda de tipo), e a tela de
Taxas ganhou dois cards para cadastrá-los.

### A cadeia

```
  Faturamento bruto        (vendas APROVADAS no período)
− Taxa de gateway          (por FORMA DE PAGAMENTO, não sobre o total)
− Coprodução / afiliados
− Impostos
− Custo de produto
= FATURAMENTO LÍQUIDO
− Gasto com anúncios
− Despesas recorrentes
= LUCRO
```

> ### ⚠️ Desconto não cadastrado vale ZERO — e `faltando` é o que denuncia
> Nada é obrigatório, para a conta não quebrar. O efeito colateral é que o líquido
> fica **maior que a realidade** e o número continua plausível. Por isso
> `Composicao.faltando` devolve quais descontos estão ausentes, e o aviso âmbar da
> tela de Taxas agora cobre os **quatro** (antes só gateway e imposto).
> **Não remova esse campo sem tornar as taxas obrigatórias.**

> ### ⚠️ A cor vem de `corFinanceira`, nunca decidida na view
>
> **O equilíbrio do ROAS é 1x; o do ROI é 0.** São escalas diferentes e não podem
> usar o mesmo corte: `ROAS 0,80x` é um número positivo e **é prejuízo** — cada
> R$ 1 de anúncio devolveu 80 centavos. O mesmo `0,80` no ROI é lucro de 80%.
>
> ⚠️ **Sem GASTO não existe ROAS** (a conta é faturamento ÷ gasto). Nesse caso
> quem chama passa `null` e a cor fica neutra — senão um painel zerado mostraria
> `0,00x` em vermelho, o mesmo defeito que o ROI tinha.
>
> - **Abaixo do equilíbrio é sempre VERMELHO** — prejuízo tem de saltar aos olhos.
> - **ROI positivo é VERDE**; é uma nota de desempenho.
> - **Lucro e margem positivos ficam na cor NORMAL, sem `+`.** Pintar todo lucro
>   de verde tira o contraste de quando algo dá errado, e `+R$ 340` parece erro de
>   digitação.
>
> O `AdsTable` tinha um ternário inline pintando lucro **positivo de verde** —
> contra a regra. Foi substituído, e o ROI da tabela também passou a ter cor.

> ### ⚠️ `lucroLiquido` e `lucro` são chaves DIFERENTES
> `METRICAS.lucro` já existia e descreve o lucro **bruto** do Gerenciador ("não
> desconta taxas, impostos nem despesas"). O card do Dashboard usa
> **`lucroLiquido`**, com explicação própria. Uma chave só faria o card do
> Dashboard exibir a explicação que diz o **oposto** do que ele faz.

- **Vendas pendentes virou VALOR.** "12 vendas pendentes" não diz quanto dinheiro
  está na mesa; `R$ 240,00` diz. A contagem ficou como linha de apoio.
- **Card sem delta deixou de imprimir "vs. período anterior"** — um rótulo de
  comparação num card que não compara nada. Cinco cards caíam nisso; agora usam o
  `trendLabel`, que diz algo de verdade.
- Líquido e Lucro **não têm delta** de propósito: dependem das taxas do período,
  que não são reprocessadas na janela anterior. Delta inventado seria pior.
- Os dois cards estão em **"Métricas disponíveis"**, arrastáveis. **Não entram no
  layout padrão**, que é a transcrição aprovada de 12 KPIs.

**`npm run test:financeiro` — 33 asserções**: cadeia completa, taxa incidindo só
sobre a própria forma de pagamento, desconto ausente valendo zero **e** denunciado,
ROI `null` com custo zero (não `0`), piso de −1,00x, valor fixo, e as 6 regras de cor.

## 🌐 IP do visitante e `PROXIES_CONFIAVEIS` (30/07/2026)

`src/lib/geo/clientIp.ts` é a **única** função que decide o IP do visitante.
Havia **três** cópias (`/api/track/click`, `/api/pixel/event`,
`webhook/ingestSale`), todas com `x-forwarded-for.split(",")[0]`.

> ### 🔴 `split(",")[0]` é confiar no CLIENTE
> `X-Forwarded-For` é um header comum: qualquer um manda
> `X-Forwarded-For: 8.8.8.8`. O proxy **acrescenta** o IP real ao **FIM** da
> cadeia — o começo é o que o cliente inventou.
>
> ```
> X-Forwarded-For: <mentira>, <real>, <proxy1>, <proxy2>
>                   ↑ nunca               ↑ N proxies nossos
> ```
>
> Conta-se da **direita**, pulando `PROXIES_CONFIAVEIS`.
>
> ⚠️ E numa VPS atrás de nginx **sem** XFF, o IP visto é `127.0.0.1` — todo
> visitante viraria "não identificado", e o sintoma só apareceria depois da
> migração, com tráfego real já perdido.

### Qual valor usar

| Ambiente | `PROXIES_CONFIAVEIS` |
|---|---|
| Vercel | **1** (a borda acrescenta um salto) |
| VPS + nginx/Caddy | **1** (com `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for`) |
| Cloudflare + nginx | **2** — mas o `cf-connecting-ip` já resolve sozinho |
| Sem proxy nenhum | **0** |

**Não deduza: use `GET /api/diagnostico/ip`.** Ele mostra o que cada valor
produziria com os headers daquela requisição; a linha cujo IP for o seu é a
configuração certa.

> ### 🔒 A rota é DESLIGADA por padrão — procedimento de uso
> 1. Defina **`DIAGNOSTICO_IP=1`** no ambiente e faça o redeploy/restart.
> 2. Abra `/api/diagnostico/ip` **logado**, compare com o seu IP público real e
>    anote o valor certo de `PROXIES_CONFIAVEIS`.
> 3. **Remova a variável** e faça o redeploy. A rota volta a responder 404.
>
> Sem a variável ela responde **404, não 403** — o 403 confirmaria que a rota
> existe; o 404 é indistinguível de uma rota que nunca foi escrita.
>
> ⚠️ Exigir sessão **não bastava**: a rota ecoa os headers de proxy do ambiente,
> e uma superfície de diagnóstico não deve ficar de pé em produção só porque tem
> senha — é infraestrutura exposta o tempo todo para servir a um uso de minutos.
> Falha FECHADA, como o `cronAuth` e os webhooks.

> ⚠️ A rota **não adivinha sozinha**, de propósito. A heurística óbvia — contar
> IPs privados no fim da cadeia — funciona na VPS e **falha na Vercel**, onde a
> borda tem IP público. Palpite que acerta num ambiente e erra no outro é pior
> que nenhum.
>
> ⚠️ **Errar para MAIS aceita IP forjado. Errar para MENOS grava o IP do
> proxy** e todo visitante vira o mesmo endereço.

**`npm run test:ip` — 27 asserções**: Vercel, VPS+nginx (XFF e X-Real-IP),
Cloudflare+nginx, conexão direta, tentativas de forjar, IPv4 com porta, IPv6 com
colchetes, CGNAT, `unknown`, e `PROXIES_CONFIAVEIS=2`.

## 📞 Telefone em E.164 antes do hash da CAPI

`capi.ts` fazia `phone.replace(/\D/g, "")` — tirava a pontuação e **deixava o
número sem DDI**. `(11) 98765-4321` virava `11987654321`, enquanto a Meta espera
`5511987654321`. O SHA-256 dos dois é diferente, então **o telefone nunca casava
com ninguém**: um sinal de correspondência perdido em toda venda.

Não é privacidade — é **qualidade de match**, que alimenta otimização de campanha
e público semelhante.

`lib/facebook/telefone.ts` desambigua por COMPRIMENTO, porque no Brasil o DDI
(`55`) colide com um DDD válido (55, Santa Maria/RS):

| Dígitos | Leitura |
|---|---|
| 10 | DDD + fixo → prefixa `55` |
| 11 | DDD + celular → prefixa `55` |
| 12–13 começando em 55 | já tem DDI |

⚠️ `55987654321` é **DDD 55 + celular**, não DDI — número nacional brasileiro tem
no mínimo 10 dígitos.

✅ **Validado contra o formato REAL da Kirvano**, confirmado pelo usuário em
30/07/2026 de venda real: **`+55 (33) 98875-6674`**. O `+` inicial declara que o
número já é internacional, então os dígitos são usados como estão
(`5533988756674`) sem inferir DDI. O teste cobre também o mesmo número **sem o
`+`** e **sem o DDI**, que são os caminhos que dependem da desambiguação por
comprimento.

**O que a CAPI envia hoje** (auditado): `email`, `phone` e `country` com
**SHA-256** ✅; `client_ip_address` e `client_user_agent` em texto claro —
**exigência da Meta**, que recusa esses dois hasheados. Nome do comprador **não
é enviado**.

## 🌍 GEOLOCALIZAÇÃO — ESTADO ATUAL (30/07/2026, sessão 2)

### ✅ LIGADA — passos 1 e 2 feitos

A base deixou de ser inerte: `/api/track/click` e a ingestão de venda resolvem o
país e gravam em `Click.country` / `Sale.country`. **O backfill do histórico
ainda não rodou em produção** — é o único passo manual que sobrou antes do
passo 3.

| | Onde | O que faz |
|---|---|---|
| ✅ | `/api/track/click` | `resolverPais(header, ip)` — aqui quem requisita **é** o visitante |
| ✅ | `webhook/ingestSale.ts` | `paisDaVenda()` — 4 fontes, **nenhuma delas o IP da conexão** |
| ✅ | `matchClick` | passou a devolver o país do clique casado, 3ª fonte da venda |
| ✅ | `npm run geo:backfill` | simula por padrão; `--aplicar` escreve. Idempotente |
| ⏳ | produção | **rodar o backfill** (ver o roteiro abaixo) |

> ### 🔴 O IP DA CONEXÃO DE UM WEBHOOK NÃO É O COMPRADOR
> Quem abre a conexão num webhook é o servidor do gateway. Passar esse IP — ou o
> `x-vercel-ip-country` daquela requisição — para `resolverPais()` carimbaria
> **toda venda** com o país do datacenter da Kirvano. Seria um país real, com
> vendas reais, e nada denunciaria o erro. Por isso `resolverPais()` só é chamada
> no `/api/track/click`, e a venda usa `paisDaVenda()`, nesta ordem:
>
> | # | Fonte | Por quê |
> |---|---|---|
> | 1 | `country` do payload, **se já for ISO-2** | o gateway conhece o comprador |
> | 2 | IP **do payload** (`buyer_ip`, `customer.ip`) | é o IP do comprador |
> | 3 | País do clique casado | o visitante falou direto conosco naquele momento |
> | 4 | `country` cru do payload | último recurso, para não sumir do ranking |
>
> ⚠️ **`normalizarPais()` recusa o que não é ISO-2.** Gateways mandam `"Brasil"`,
> `"BRA"`, `"brazil"` — e um `"BRASIL"` gravado na coluna não casa com nada no
> mapa nem no ranking, virando país fantasma. Recusar é o que deixa a resolução
> por IP assumir, que acerta.
>
> ⚠️ **O `country` do CORPO não vence o servidor** no `/api/track/click`: o corpo
> vem do navegador e é forjável. Nenhum script envia esse campo hoje, mas a ordem
> tinha de estar certa antes de algum passar a enviar.

> ### ⚠️ O upsert monotônico não pode APAGAR o país
> A "gerada" pode chegar sem clique casado e a "paga" já com ele — ou o inverso.
> O `updateMany` só grava `country` quando tem um, pelo mesmo motivo do `clickId`:
> sobrescrever com `null` apagaria o país já descoberto.

### 🧪 Verificado ponta a ponta (dev server + banco de dev) — 17 asserções, 0 falhas

| Caso | Resultado |
|---|---|
| IP brasileiro, 1 proxy | `BR` |
| **XFF forjado** (`8.8.8.8` na frente da cadeia) | `BR` — a mentira do cliente foi ignorada |
| `x-vercel-ip-country: PT` (atalho) | `PT` |
| Corpo forjando `country=US`, IP irlandês | `IE` — o servidor vence |
| IPv6 | `null` — nunca país errado |
| **Venda sem fonte, conexão de `8.8.8.8`** | `null` — **o IP do gateway NÃO virou US** |
| Venda com IP do comprador no payload | `BR` |
| Venda com `"Brasil"` + IP holandês | `NL` — texto livre recusado |
| Venda com `"pt"` no payload + IP `BR` | `PT` — payload ISO-2 vence |
| Venda casada por `click_id` | herdou o `IE` do clique |
| Pendente com país → aprovada **sem** país | continua `PT` |
| Pendente sem país → aprovada com IP `BR` | virou `BR` |
| Backfill: 2ª passada | **0 resolvidos** (idempotente) |

Dados de teste removidos por id depois (7 vendas, 5 cliques, 1 webhook, 2 eventos,
9 logs, 9 notificações órfãs — a `Notification.saleId` é `SetNull`, então elas
**não** somem com a venda). `tsc`, `lint` e `next build` limpos.

### ✅ Backfill APLICADO em produção (30/07/2026)

| | Antes | Depois |
|---|---|---|
| Cliques com país | 0 | **237** — BR 147 · US 65 · IE 25 |
| Vendas com país | 2 | **15** (todas pelo IP do comprador no payload) |
| Vendas irrecuperáveis | — | **11** (sem IP nenhum no payload) |

O backfill IPv4 e o IPv6 acabaram rodando **num único `--aplicar`**, porque a
execução IPv4 anterior tinha ficado só na simulação. **Não deu diferença: o
script é idempotente** (`UPDATE … AND country IS NULL`), então a passada única
com a base completa resolveu os dois de uma vez.

> ⚠️ As 11 vendas sem IP são **perda definitiva**, não pendência. Nenhum passo
> futuro as recupera — o payload daquelas vendas nunca teve IP do comprador.

### 🔌 REQUISITO DE TODA INTEGRAÇÃO DE GATEWAY NOVA

> ### 🔴 Pergunte SEMPRE: este gateway manda o IP do comprador no payload?
>
> É a diferença entre geolocalização **medida** e **estimada**, e ela não
> aparece na tela sozinha — o número fica plausível dos dois jeitos.
>
> | O gateway manda IP? | O que acontece |
> |---|---|
> | **Sim** (Kirvano) | `Sale.country` vem do IP real do comprador. Confiável. |
> | **Não** | A venda cai no **fallback do clique** — e 55,6% dos cliques passam pelo datacenter da Meta, então o país é palpite |
>
> Ao integrar um gateway, cheque no payload real as chaves que
> `normalizeSale` procura: `ip` · `buyer_ip` · `customer.ip` · `ip_address`. Se
> nenhuma vier, **registre aqui** — e considere pedir o campo ao gateway, que
> costuma existir e só não vir por padrão.
>
> ⚠️ **Zero vendas dependem do fallback hoje.** Isso é propriedade da **Kirvano**,
> não do nosso desenho. Não escreva código assumindo que `Sale.country` é sempre
> confiável.

**A ferramenta detecta sozinha.** `computeDashboard` conta, por país, quantas
vendas herdaram o país do clique em vez de trazer o próprio (`byCountry[].estimadas`),
e o ranking marca com um chip **âmbar "estimado"**, com o motivo no `title`.
Nenhuma migration foi necessária: `Sale.country` nulo + `Click.country` presente
**é** a assinatura do fallback.

| Gateway | Manda IP do comprador? | Verificado em |
|---|---|---|
| **Kirvano** | ✅ sim (`customer.ip`) | 30/07/2026, 15 vendas reais |
| **Cakto** | 🔴 **não** — capacidade declarada `ipDoComprador: false` | 31/07/2026, **PIX real pago**. É o primeiro gateway cuja geografia depende do clique |
| **OnyxPag** | 🔴 **não** — e também não manda `fbc`, `fbp` nem `click_id` | 31/07/2026, pela documentação. Sem nenhuma via de atribuição: a venda entra sem campanha e sem país |
| Hotmart | ❓ não integrado | — |
| Kiwify | ❓ não integrado | — |
| Cartpanda | ❓ não integrado | — |
| Chave de API (`/api/webhook/ingest`) | ⚠️ depende de quem envia | documentar no "Como usar" |

### 📋 Como rodar o backfill em PRODUÇÃO

```bash
# 1. BACKUP primeiro — o passo 3 é irreversível e o Supabase Free não tem PITR
npm run backup -- --url '<connection string de produção>'

# 2. SIMULE (não escreve nada) e leia os números
npm run geo:backfill -- --url '<connection string de produção>'

# 3. Só depois de conferir:
ALLOW_PROD_WRITES=EU_QUERO_MESMO_ESCREVER_EM_PRODUCAO \
  npm run geo:backfill -- --url '<connection string de produção>' --aplicar
```

- **Sem `--aplicar` é só leitura.** Imprime quantos resolveu, por qual fonte, e
  quantos ficaram sem país **com o motivo** (sem IP · IP privado · IPv6 · IPv4
  fora da base). É esse relatório que diz se o resultado faz sentido.
- **Cliques primeiro, vendas depois** — a 3ª fonte da venda é o país do clique,
  que acabou de ser preenchido. Na ordem inversa quase nada herdaria.
- **Idempotente**: o `UPDATE` tem `AND country IS NULL`, então rodar duas vezes
  não mexe no que já foi resolvido.
- A trava exige a autorização por extenso porque escreve em produção — e com
  `--url` o script **reescreve `process.env.DATABASE_URL` antes de chamar o
  guard**, senão a trava avaliaria o banco errado e liberaria indevidamente.

> ⚠️ **O backfill lê o IP do comprador de dentro do `Sale.rawPayload`.** É
> exatamente esse campo que o passo 3 vai limpar — daí a ordem ser inegociável.

### ✅ Pronto e testado desde a sessão anterior

- **Extração de IP única e testável** (`lib/geo/clientIp.ts`), cobrindo Vercel,
  VPS+nginx e Cloudflare. Substituiu **três** cópias de
  `x-forwarded-for.split(",")[0]`, que pega o valor que o CLIENTE controla.
- **Base `user-country`**: 290.457 faixas · 251 países · 1,4 MB binários ·
  **PDDL-1.0** (domínio público, sem exigir conta). Artefato **commitado**.
- **`npm run geo:atualizar`** regenera o artefato (rotina mensal).
- **`resolverPais()`** funcionando: header da plataforma como **atalho**, base
  local como **caminho principal** — sem o header o resultado é **idêntico**.
- **`/api/diagnostico/ip`** protegida por `DIAGNOSTICO_IP` (**404** sem a
  variável — 404 e não 403, para nem confirmar que a rota existe).
- **186 asserções em 6 suítes, 0 falhas** (`pais` 30 · `ip` 27 · `telefone` 28 ·
  `financeiro` 42 · `periodo` 33 · `areas` 26).

### ⏳ ORDEM DOS PASSOS — revisada em 30/07/2026 (sessão 2)

| | Passo | Estado |
|---|---|---|
| 1 | Chamar `resolverPais()` nas rotas | ✅ feito |
| 2 | Backfill IPv4 do histórico | ✅ script pronto · **usuário rodou** |
| 3 | **IPv6 na base** + cobertura mundial do mapa | ✅ feito nesta sessão |
| 4 | Rodar o backfill de novo (recupera as vendas IPv6) | ✅ **aplicado — 237 cliques · 15 vendas** |
| 5 | Marcação de bot (`Click.bot`) | ✅ **feito — tem MIGRATION, ver ordem de deploy** |
| 6 | Correção do navegador embutido de app | ✅ **feito — tem MIGRATION** |
| 7B | **Purga progressiva do `Click.ip`** + retenção do `WebhookLog` | ✅ **feito** — sem migration |
| 7A | **Limpeza do IP nos payloads** | ⏸️ **ADIADO** — depende da arquitetura de parsers |

> ### 🔴🔴 O HASH DO IP É O ÚLTIMO PASSO, E DEPENDE DE TODOS OS ANTERIORES
>
> Ele é **irreversível**: destrói a única fonte de que os passos 2, 3 e 6
> dependem. Cada passo anterior que ficar para depois dele fica para **nunca**.
>
> A ordem já quase se inverteu uma vez: o plano original era anonimizar logo
> depois do backfill IPv4, e isso teria congelado **50% das vendas sem país**
> — todas IPv6, todas brasileiras, incluindo uma aprovada. O que salvou foi
> medir antes de executar.
>
> **Antes do passo 7, confirme que estão resolvidos:**
> - [ ] Backfill rodado **depois** do IPv6, com a contagem conferida
> - [x] Bot marcado ✅ (usa `userAgent`, que o hash **não** apaga)
> - [x] Navegador de app resolvido ✅ — e a solução escolhida **não usa o IP**
>       para detectar datacenter, então o hash deixou de ter essa dependência.
>       Se tivéssemos ido pela base de ASN, o passo 7 ficaria bloqueado para
>       sempre: comparar com faixas exige o IP legível.
>
> **E exige backup imediatamente antes:**
> ```bash
> npm run backup -- --url '<connection string de produção>'
> ```

## 🌐 IPv6 e cobertura mundial do mapa (30/07/2026, sessão 2)

### Por que o IPv6 deixou de ser opcional

Medido no backup de produção: **100% das vendas sem país eram IPv6** — 14 de 14,
todas do bloco `2804:29b8::/32` (LACNIC/Brasil), **incluindo a única venda
aprovada** entre elas. E **0 cliques eram IPv6**.

Não é coincidência: o clique chega pelo navegador (o site é servido em IPv4),
mas o gateway registra o IP do comprador na rede móvel ou de casa, onde o IPv6
já é padrão no Brasil. **A tabela `Sale` é IPv6; a `Click` é IPv4.**

| | Antes | Depois |
|---|---|---|
| Vendas com país (backup real) | 2 de 26 | **15 de 26** |
| Cliques com país | 237 | 237 (já eram IPv4) |

### O prefixo é truncado em 64 bits

| Prefixo | Entradas | Faixas perdidas | Binário |
|---|---|---|---|
| **64 (escolhido)** | 329.970 | 12.417 (4,5%) | **2,84 MB** |
| 56 | 262.590 | 87.061 (32%) | 2,00 MB |
| 48 | 240.242 | 104.720 (38%) | 1,60 MB |

Os cortes menores economizam pouco e descartam um terço das faixas. As 4,5%
perdidas em 64 são alocações mais específicas — cliente único, que herda o país
do bloco que o contém, quase sempre correto.

> ### ⚠️ Nada de BigInt no caminho quente
> `ipv6ParaPrefixo()` devolve **dois `number` de 32 bits** (`alto`, `baixo`), e a
> busca binária compara lexicograficamente. BigInt aloca no heap a cada
> operação, e isto roda em toda requisição de clique e em toda venda. O gerador
> usa BigInt — ele roda uma vez por mês, na sua máquina.

> ### ⚠️ IPv4-mapeado (`::ffff:1.2.3.4`) tem desvio próprio
> É um IPv4 escrito em notação IPv6: a base de IPv6 **não** o cobre, a de IPv4
> sim. Sem o desvio em `paisDoIp`, todo cliente atrás de um proxy dual-stack
> cairia em "não identificado".

> ### ⚠️ `*` seguido de `/` FECHA O COMENTÁRIO
> Escrever `**/64**` num bloco `/** … */` quebrou o gerador e depois o `pais.ts`
> com `SyntaxError`. Nos comentários deste projeto, prefixo IPv6 se escreve
> **sem barra** ("truncado em 64 bits").

> ### 🔒 A guarda de 256 países não é teórica
> O índice do país é um `Uint8`. Com IPv4 e IPv6 compartilhando a tabela, o total
> subiu de **251 para 252** — a 4 de estourar e dar a volta em silêncio,
> mapeando um país para outro. O gerador **aborta** acima de 256 e diz para
> trocar por `Uint16Array`.

### 💰 O artefato de 5,7 MB — custo MEDIDO, não estimado

| | |
|---|---|
| `import` do módulo | 66 ms |
| 1ª consulta IPv4 (decodifica a base) | 3,3 ms |
| 1ª consulta IPv6 (decodifica a base) | 3,6 ms |
| **Cold start total** | **73 ms** |
| Consulta aquecida IPv4 | **0,18 µs** |
| Consulta aquecida IPv6 | **0,50 µs** |
| Bundle do servidor (`.next/server`) | **35 MB** — limite da Vercel é 250 MB |

- **O artefato fica num chunk próprio** (`chunks/src_lib_geo_pais_ts_*.js`,
  5,76 MB). Rota que não importa a base **não paga nada** — o dashboard, as
  notificações e o sync seguem iguais.
- **Nunca vai para o navegador.** Só rotas de API o importam.
- Os 66 ms do `import` foram medidos com type-stripping do `.ts`; no build de
  produção o parse é de `.js` já compilado, então o número real é **menor**.
- **73 ms uma vez por instância fria**, contra ~99 ms de UMA ida ao Supabase.
  Está na mesma ordem de grandeza de uma query — e a base não faz I/O nenhum.

### Cobertura por região (amostragem de 2.000 IPs por RIR)

| RIR | Cobertura IPv4 | IPv6 |
|---|---|---|
| LACNIC (América Latina) | **100,0%** | ✓ AR, BR |
| RIPE (Europa/Oriente Médio) | **100,0%** | ✓ DE, IE |
| ARIN (América do Norte) | 99,9% | ✓ US |
| APNIC (Ásia-Pacífico) | 99,3% | ✓ KR, IN, CN |
| **AFRINIC (África)** | **95,9%** | ✓ DZ, TZ |

**A única lacuna real é a África, com ~4% do espaço sem país.**

> ### ⚠️ Venda que a base não cobre aparece como "Não identificado" — nunca some
> Antes, `byCountry` fazia `if (!code) continue` e a venda sem país **sumia do
> bloco inteiro**. O ranking então dava a impressão de que 100% das vendas
> estavam geolocalizadas, e o único caso em que isso importa — a região que a
> base cobre mal — era o invisível.
>
> Hoje ela vira a entrada `code: ""`, mostrada como **"Não identificado"** com
> chip **"sem localização"**, e o `title` explica a cobertura por região
> (~100% na América Latina e na Europa, **~96% na África**).
>
> **Nunca chutar.** `paisDoIp` devolve `null` para bloco não coberto em vez de
> herdar o país da faixa anterior — é para isso que existem as entradas de
> "buraco" na cobertura contínua.

### O mapa saiu de 32 para 252 países

Os 32 eram "os que aparecem em infoproduto em português" — premissa errada para
uma ferramenta usada por quem roda oferta mundial: **o mercado novo era
justamente o invisível**. Hoje cobre os 193 membros da ONU + territórios com
tráfego próprio, e `npm run test:pais` **falha** se a base resolver um país que
o mapa não sabe desenhar. Paridade atual: **252 no mapa · 252 na base**.

- **A bandeira é CALCULADA** (`bandeiraDe`), pelos indicadores regionais Unicode.
  250 emojis literais num arquivo-fonte são convite a erro invisível — um emoji
  errado é indistinguível de um certo em code review.
- **`FX` e `AN` estão na tabela de propósito.** São códigos ISO **obsoletos**
  (França metropolitana; Antilhas Neerlandesas, dissolvidas em 2010) que a base
  de IP ainda emite para blocos antigos. Sem eles a venda seria geolocalizada e
  mesmo assim não apareceria.
- **País sem posição no mapa é MARCADO no ranking, nunca omitido** — chip "sem
  posição no mapa" com explicação no `title`. É a mesma regra do "Não
  identificado": o que some em silêncio é o que o usuário está procurando.

## 🤖 Marcação de bot (30/07/2026, passo 5) — MARCA, nunca bloqueia

**Migration `20260730180000_click_bot`** — `Click.bot` (`DEFAULT false`),
`Click.botMotivo`, e o índice `(userId, bot, timestamp)`. Aditiva.

> ### 🔴 ORDEM DE DEPLOY: migration → `bot:reclassificar` → push
> 1. `npx prisma migrate deploy` na produção
> 2. **`npm run bot:reclassificar -- --url '<conn>' --aplicar`**
> 3. `git push`
>
> ⚠️ **O passo 2 não é opcional.** A coluna nasce com `DEFAULT false`, então
> todo clique histórico nasce "não é bot" — errado para ~16,5% deles. Sem a
> reclassificação, a contagem na tela fica **zerada** e parece que o filtro não
> funciona, enquanto o funil segue inflado.

### ⛔ Marca, não bloqueia — e por quê

O `/api/track/click` **continua gravando tudo**. Só as métricas excluem
`bot: true`.

Bloquear significaria **não gravar**, e aí um falso positivo apaga um cliente
**sem deixar rastro** — não há como descobrir depois nem desfazer. Marcado, o
erro se corrige: `npm run bot:reclassificar` reavalia **todo** o histórico com a
lista nova, porque o `userAgent` continua no banco. É isso que torna a lista de
padrões editável sem medo.

### ⛔ PAÍS NUNCA É CRITÉRIO. IP DE DATACENTER TAMBÉM NÃO.

A suspeita inicial era de que os 90 cliques de US+IE fossem crawler — a Irlanda
é o datacenter europeu da Meta. A decomposição mostrou **37 bots e 53 pessoas
reais**, e as 2 únicas vendas que casaram com um clique vieram justamente dali.

**Neste produto, IP de datacenter da Meta é evidência de usuário REAL de rede
social** — 55,6% do tráfego humano vem do navegador embutido do app. Quase o
oposto de bot.

> ⚠️ Isso continua valendo quando a detecção de datacenter existir (passo 6):
> ela serve para corrigir o **país**, nunca para classificar bot.

**O único critério é o `userAgent`.**

### A lista de padrões

`lib/bots/classificar.ts` → `PADROES`, uma lista de `{ re, motivo }` lida de cima
para baixo. Acrescentar é **uma linha** + rodar o reclassificador.

> ### ⚠️ A ORDEM importa
> O crawler da Meta se anuncia **dentro** de um user agent de navegador comum
> (`Mozilla/5.0 (…) Chrome/145 (compatible; meta-externalads/1.1 …)`), então
> precisa ser testado antes de qualquer regra genérica.

> ### ⚠️ Conservador de propósito
> Um bot que escapa infla a contagem em alguns por cento. **Um humano marcado
> como bot some das métricas e leva a decisão de mídia junto.** Na dúvida, fora.
>
> - **User agent AUSENTE não é bot.** Extensão de privacidade e configuração
>   corporativa suprimem o header.
> - **WebView (`; wv)`) não é bot** — é o padrão do app do Instagram no Android.
> - `\bbot\b` tem limites de palavra: sem eles, "Abbott" num nome de aparelho
>   viraria robô.
> - **`\brobot\b` é padrão SEPARADO**: o `\b` de `bot` **não** casa dentro de
>   "Robot" (o `o` anterior é caractere de palavra). Um teste com
>   `SomeCompany Robot/1.0` passava batido — foi assim que a lacuna apareceu.

### Onde o bot é excluído — e onde NÃO é

| Consulta | Exclui bot? | Por quê |
|---|---|---|
| `metrics.ts` — cliques do funil e do feed | ✅ | é métrica |
| `ads/overview.ts` — "Cliq. atr." e IC | ✅ | é métrica |
| `matchClick` — casar venda por IP | ✅ | robô não compra; a venda herdaria o país do datacenter dele |
| `diagnostics.ts` — "script de UTM detectado" | ❌ | a pergunta é *"o script está instalado?"*. Um crawler que disparou o script **prova** que sim |
| `utm.ts` — cliques carimbados por área | ❌ | idem: é sobre instalação, não sobre tráfego |
| `areas/exclusao.ts` | ❌ | atribuição e exclusão precisam ver **todas** as linhas |

### Conferência na tela (exigência do usuário)

O funil mostra **"N acessos de robô removidos"**, com o detalhamento por motivo
no `title`. Sem isso, "removemos os bots" seria uma afirmação a aceitar no
escuro — o número existe para o usuário julgar se o filtro exagera ou falha.

> ### ⚠️ Fica no TOPO do funil, não no rodapé — ver o caso confirmado abaixo

## ✅ RESOLVIDO: rodapé do funil invisível — e a causa é GENÉRICA

**Medido e corrigido em 30/07/2026.** O resumo do gargalo existia há semanas e
**nunca tinha sido visto por ninguém**. Junto com ele estavam invisíveis a
pílula de perda entre etapas (`−5 · 100,0%`) e os valores absolutos sob cada
etapa.

### A causa: item de flex nasce com `min-height:auto`

Um item de flex **não encolhe abaixo do próprio conteúdo** a menos que se diga
`min-height:0`. O div que envolve rótulos+gráfico no `Funnel` tinha `flex:1` e
nada mais, então media **422px dentro de um espaço de 338px** e empurrava o
resumo 122px para fora do card — que tem `overflow:hidden` de propósito.

```
card (376px, overflow:hidden)
└─ raiz do Funnel (338px)
   ├─ div rótulos+gráfico   flex:1  min-height:auto  →  422px  ⛔ não cede
   └─ resumo do gargalo     36px    →  empurrado para fora
```

**A correção é uma linha:** `min-height:0` nesse div. Mais `min-height:200px`
(era 230) na raiz, porque no menor tamanho que o grid permite (`minH: 5` = card
de 264px) sobram 226px e 230 estourava por 4px.

> ### ⛔ NÃO era problema de altura do bloco
> A saída óbvia — aumentar o `minH` do funil — teria sido **errada duas vezes**:
> empurraria layouts já salvos, e o bloco tinha espaço de sobra (376px para
> ~370px de conteúdo). O conteúdo é que se recusava a caber.
>
> **Meça antes de redimensionar.** Foi a medição no navegador que mostrou os
> 422px; a aritmética sozinha dizia que cabia.

### Auditoria: os outros 22 blocos estão limpos

Verificado empiricamente — cada card medido por `scrollHeight > clientHeight`
e por descendente com base além da base do card:

| Tamanho | Blocos com conteúdo cortado |
|---|---|
| Tamanho real do layout padrão | **0 de 23** |
| Menor tamanho que o grid permite (264px) | **0 de 23** |
| 208px (abaixo do mínimo, inalcançável pelo usuário) | 2 — Funil e Vendas por país |

> ⚠️ **O limite desta auditoria:** bloco em estado vazio renderiza pouco e não
> tem como transbordar. O defeito do funil só apareceu **com dado que produzisse
> gargalo**. Então "0 de 23" significa *"nenhum bloco transborda com os dados
> que existiam no banco de dev"*, não *"nenhum bloco jamais transborda"*.
>
> **Elemento condicional é onde este defeito mora**: resumo, aviso, estado de
> erro, rodapé — coisas que só aparecem em certas combinações de dados. `tsc`,
> `lint` e `build` passam com eles invisíveis, e o `find` do navegador os
> encontra no DOM. **Só ver na tela prova.**

### ⚠️ Limitação conhecida desta auditoria — está na FILA

O "0 de 23" prova que **não há transbordo naquele estado de dados**, não que não
haja em nenhum. O defeito do funil só apareceu **com dado suficiente para gerar
gargalo**, e o banco de dev tem 8 vendas.

**Sessão de varredura de verdade (na fila, junto do Prompt J):** semear dados que
ativem **cada caminho condicional** — estados de erro, avisos, rodapés, badges,
chips — e conferir **cada um na tela**. É a única forma de fechar esta classe.

Onde procurar: qualquer coisa que só renderize sob condição. `tsc`, `lint` e
`build` passam com o elemento invisível, e o `find` do navegador o encontra no
DOM. **Só ver na tela prova.**

### O que fica para o Prompt J

O bloco de 208px mostra que Funil e Vendas por país estourariam **se** o mínimo
do grid baixasse. Se o Prompt J permitir blocos menores, estes dois são os
primeiros a revisar — e a regra a aplicar é a mesma: **todo item de flex que
precise ceder espaço leva `min-height:0`**.

## 🔐 Passo 7 — anonimização do IP: DUAS FASES, e a ordem inverteu

Decidido em 30/07/2026, **nada implementado ainda**. O plano original ("hashear o
IP e limpar os payloads") não sobreviveu à investigação: hashear o `Click.ip`
quebraria a CAPI, e limpar os payloads mataria o reprocessamento de vendas.

### 🔴 O achado que mudou o plano: `Click.ip` alimenta a CAPI EM TEXTO CLARO

`dispatchPixel.ts` passa `sale.click?.ip` para `capi.ts`, que faz
`userData.client_ip_address = input.clientIp` — **sem hash, de propósito**: a
Meta **recusa** `client_ip_address` e `client_user_agent` hasheados. São os dois
únicos campos que vão em claro.

Hashear o `Click.ip` faria toda venda enviar um hash onde a Meta espera um IP.
Ela **não rejeita a chamada** — degrada em silêncio a qualidade de
correspondência de todo `Purchase`, que é o sinal que alimenta a otimização das
campanhas. **Dinheiro real, sem erro, sem log.**

> ⚠️ **São TRÊS consumidores de `Click.ip`, não um.** Um levantamento que só
> olhasse o `matchClick` teria concluído que o hash era seguro.
>
> | Consumidor | Uso | Sobrevive ao hash? |
> |---|---|---|
> | `matchClick` | igualdade no `where` | ✅ se os dois lados forem hasheados |
> | `dispatchPixel` → CAPI | valor literal enviado à Meta | 🔴 **não** |
> | `/api/pixel/event` → CAPI | usa `ipDaRequisicao(req)`, não o banco | ✅ não afetado |

### A decisão: purga PROGRESSIVA (opção 3 de 3)

Descartadas: **(1)** não hashear nada (privacidade fica parcial) e **(2)** hashear
e aceitar perder a CAPI.

> **Contra a (2), o argumento do usuário:** trocaria um ganho invisível
> (privacidade que ninguém audita) por uma perda invisível (otimização
> degradando sem erro). Duas coisas que ninguém mede, uma delas custando
> dinheiro.
>
> **A favor da (3):** os dois usos do IP têm **PRAZO**. Passado ele, o IP em
> claro não serve para nada — só fica guardado.

### FASE B — purga progressiva ✅ IMPLEMENTADA (30/07/2026)

`src/lib/geo/anonimizarIp.ts` · guarda em `capi.ts` · `matchClick` tolerante ·
`/api/cron/manutencao` estendido · `npm run ip:simular` · `npm run test:match`.
**Sem migration** — só usa colunas que já existem.

> ### 🔴 A rota `/api/cron/manutencao` JÁ EXISTIA e NUNCA foi agendada
> Criada em 28/07/2026 (commit `ec9891c`) com retenção de `WebhookLog` e aviso
> de token vencendo — e **não estava no `.github/workflows/cron.yml`**. Rodou
> zero vezes. O CLAUDE.md listava a retenção como dívida aberta; ela estava
> escrita e inerte.
>
> **É o mesmo modo de falha da base de países antes do passo 1, e da terceira
> vez que ele aparece nesta sessão.** Agendada agora, diariamente às 04h UTC
> (01h em Brasília) — horário de baixo tráfego porque ela ESCREVE.
>
> ⚠️ **Ao criar rota de cron, agende no mesmo commit.** Uma rota sem agendamento
> não falha, não avisa e parece pronta.

**Retenção do `WebhookLog` passou de 90 fixos para diferenciada** (30 dias para
`PROCESSADO`, 90 para falha/órfão): o log de sucesso é redundante com
`Sale.rawPayload`; o de falha é a única cópia.

**Retenção: 7 dias.** Três prazos se somam e o maior manda:

| Prazo | Duração |
|---|---|
| Match por IP (`IP_WINDOW_MS`) | 12 h |
| Atribuição da Meta | **7 dias por clique** (padrão) + 1 dia por visualização |
| IP residencial continuar sendo da mesma pessoa | dias (rotação de IP dinâmico) |

> ⚠️ A janela da Meta é **configurável por conjunto** (`attribution_spec`), e as
> janelas de 28 dias foram removidas em 2021. **Melhoria futura registrada:**
> derivar a retenção da maior janela configurada nos conjuntos, em vez de fixar
> 7 dias — o campo vem do mesmo `GET /adsets` que já fazemos. Decisão do
> usuário: **não vale o trabalho antes de haver volume.**

**Cron: `/api/cron/manutencao`, diário e novo.** Não pendura nos três existentes
(`sync-facebook`, `run-rules`, `reports`) — eles têm ritmo e modo de falha
próprios. E aproveita para fechar a dívida da retenção do `WebhookLog`.

**Duas guardas, dois propósitos:**

| Guarda | Onde | Para quê |
|---|---|---|
| Prefixo no valor (padrão do `trkenc.v1.`) | script de purga | **idempotência** — não re-hashear |
| `ehIpValido()` | `capi.ts` | **a CAPI só envia o que PARECE um IP** |

> ⚠️ O `ehIpValido` é a guarda que importa: um SHA-256 tem 64 hexadecimais e
> nunca passa nela. Protege contra o hash **e** contra qualquer outro lixo que
> apareça no campo.

**Venda que chega depois da purga do clique dela:** o match por IP não é
afetado (janela de 12 h × retenção de 7 dias — nem é exercido). O match direto
por `click_id` **não tem limite de tempo**, então essa venda perde o
`client_ip_address` na CAPI.

> ⚠️ **Isso é o comportamento CORRETO, não um custo aceito.** Um IP de 7+ dias
> provavelmente já não é daquela pessoa. Enviá-lo não seria sinal fraco, seria
> sinal **errado**, apontando para outro assinante. **Omitir é melhor que mentir.**

**Retenção do `WebhookLog` — diferenciada:**

| Status | Retenção | Por quê |
|---|---|---|
| `PROCESSADO` | 30 dias | o payload **já está duplicado** em `Sale.rawPayload` |
| `REJEITADO` · `ERRO` · `RECEBIDO` órfão | **90 dias** | é a **única cópia**, e são os que se depura |

Log de sucesso é redundante; log de falha é o produto. E as falhas sem dono
(chave inválida, token desconhecido) **nem aparecem na interface** — depurar
"meu gateway manda e não chega" com o suporte do gateway leva semanas.
`RECEBIDO` que nunca fechou = processamento estourou no meio; tratado como
`ERRO`.

**Teste de regressão — `npm run test:match`, 20 asserções.** O bloco 5 executa
**a própria consulta da purga** contra linhas semeadas com data no passado:
clique de 10 dias vira hash, de 2 dias fica intacto, já anonimizado não é
re-hasheado, 2ª passada não mexe em nada, **o país não é tocado**, o purgado é
recusado pela CAPI e ainda casa no match.

> ⚠️ Esse bloco foi acrescentado depois de o usuário perguntar se a purga tinha
> sido testada de verdade. **Não tinha** — só a função pura e o `matchClick`. A
> consulta nunca havia rodado contra linha nenhuma, e a simulação em produção dá
> 0 porque todos os cliques estão dentro da retenção. Ver o PROCEDIMENTO no topo.

Os quatro casos exigidos:

1. Clique com IP conhecido → venda com o mesmo IP, **sem `click_id`** →
   `matchMethod === "ip"` e o `clickId` certo
2. IP diferente → `matchMethod === "none"`
3. **Clique já purgado (IP em hash)** → venda com IP em claro → **o match ainda
   casa**, porque os dois lados passam pela mesma função
4. E o par do 3: a CAPI daquela venda **omite** `client_ip_address`

> ⚠️ **O caso 2 é o que dá valor ao teste.** Sem ele, um `where` quebrado que
> casasse com qualquer clique passaria despercebido.

⚠️ O teste **duplica** o `where` do `matchClick` em SQL, como a `geo:sonda`
duplica a extração do `sync.ts`. Se importasse a função, um bug nela passaria
por "tudo certo". Escreve no banco de DEV, passa pelo `guard-db` e limpa por id.

**`npm run ip:simular`** — só leitura, **sem `--aplicar` de propósito**: quem
escreve é o cron, com teto de 5.000 por execução. Uma segunda porta para uma
operação irreversível seria uma a mais do que o necessário. Mostra quantos IPs
seriam anonimizados, quantos ficam legíveis, quantas vendas perderiam
`client_ip_address`, **em quais chaves o IP aparece dentro dos payloads** (é
assim que se descobre o nome que um gateway novo usa) e a contagem de país
resolvido — que tem de ser idêntica antes e depois.

### FASE A — limpeza do IP nos payloads: ⏸️ ADIADA

> ### ⛔ PRÉ-CONDIÇÃO: a arquitetura de parsers de gateway estar ESTÁVEL
> O usuário está integrando a **Cakto** e depois muitos outros gateways, com uma
> arquitetura universal de parsers construída em cima dos payloads guardados.
>
> **Se um parser tiver bug e for preciso reprocessar as vendas com a correção, o
> payload cru é a ÚNICA fonte.** Limpar antes disso queima essa ponte.
>
> Só depois de a arquitetura estar estável e não haver mais nada a reprocessar.

**E na versão cirúrgica, não na total.** Remover **apenas o campo de IP** de
dentro do payload atende a privacidade sem perder o reprocessamento. Duas
escolhas de projeto separam funcionar de sabotar:

- **Substituir o valor, não apagar a chave** (`"ip": "[ip removido]"`). Um parser
  testado contra payload histórico pode assumir que a chave existe; apagá-la
  muda a **forma** do payload e faz depurar contra um formato que nunca chegou.
- **Achar por chave conhecida + varredura por valor.** A lista de chaves sai do
  `normalizeSale` (fonte única), mas gateway novo usa nome novo e o IP escaparia
  em silêncio. A varredura pega o desconhecido; a simulação **lista as chaves
  onde encontrou**, e é assim que o nome que a Cakto usa entra na lista.

> ⚠️ **A varredura por valor tem de ser só de IPv4.** O `ehIpValido` aceita IPv6
> por uma regra frouxa (`[0-9a-f:]+` com um `::`), e **`"10:30"` passa nela** —
> um horário no payload viraria "IP removido".

### 🔴 Restrição para a arquitetura de parsers — vale JÁ, não depois

`ingestSale` recalcula `paisDaVenda` a cada ingestão, e a **2ª fonte é o IP do
payload**. Reprocessar uma venda com o IP removido faria o país recalculado
**piorar** — cairia para o país do clique ou para o texto cru.

**O reprocessamento PRECISA preservar `country`/`countrySource` quando já não
são nulos.** Isso independe da Fase A: sem essa regra, um reprocessamento
"inofensivo" degrada geolocalização já resolvida.

### Checklist antes de autorizar qualquer escrita

| | Item | Estado |
|---|---|---|
| ✅ | País resolvido nas rotas | feito |
| ✅ | Backfill do país aplicado | 237 cliques · 15 vendas |
| ✅ | IPv6 na base | feito |
| ✅ | Bots marcados | 39 de 237 |
| ⏳ | **Desempate comprovado pela `geo:sonda`** | a fazer |
| ⏳ | Backup imediatamente antes | `npm run backup -- --url '<conn>'` |
| ⏳ | Simulação antes do `--aplicar` | com os números conferíveis abaixo |

**A simulação tem de mostrar:** quantos `Click.ip` seriam hasheados (e quantos
já estão), quantos `Sale.rawPayload` e `WebhookLog.payloadRaw` contêm IP e **em
quais chaves**, e a **contagem de `Click.country`/`Sale.country` não-nulos antes
e depois — que tem de ser idêntica.** País já resolvido não pode ser tocado.


## 🔴 ACHADO: o navegador embutido do app da Meta falseia a geolocalização

**Medido no backup de produção (30/07/2026). Diagnóstico feito, solução NÃO
implementada** — ver o passo 6 da ordem.

O navegador embutido do Instagram e do Facebook roteia pela infraestrutura da
Meta. O IP que chega até nós é o de um **datacenter da Meta**, não o do
visitante. Isso não é caso de borda neste produto: **é o caminho principal.**

| | Cliques | % dos humanos |
|---|---|---|
| Instagram (app) | 70 | 35,4% |
| Facebook (app) | 40 | 20,2% |
| **Total em navegador embutido** | **110** | **55,6%** |

De 198 cliques humanos (237 menos 39 bots), **29 resolveram para fora do Brasil**
sendo brasileiros — com `pt_BR` no user agent e, em 8 deles, **`FBCR/VIVO`**, a
operadora Vivo.

> ### ⚠️ Foi por pouco que isto não virou "filtrar os gringos"
> A suspeita inicial era de que os 90 cliques US+IE fossem todos crawler. A
> decomposição mostrou **37 bots e 53 pessoas reais** — e as 2 únicas vendas que
> casaram com um clique vieram justamente do navegador do app. Filtrar por país
> teria apagado compradores.
>
> **Regra que fica: país NUNCA é critério de filtragem.** Critério é `userAgent`
> e origem de datacenter.

### ✅ Onde o problema NÃO está: as vendas

Verificado no backup, e é melhor do que se temia:

| Fonte do país da venda | Vendas |
|---|---|
| IP do comprador no payload (fonte confiável) | 15 |
| **Só o país do clique casado (exposto ao erro)** | **0** |
| Sem fonte nenhuma | 11 |

**Nenhuma venda depende hoje do fallback para o clique**, porque a Kirvano manda
o IP do comprador em todo payload — e esse IP é o real dele, não o da Meta.
O globo de "Vendas por país" **não está contaminado**.

> ⚠️ **Isso é uma propriedade da Kirvano, não do desenho.** Um gateway que não
> mande o IP do comprador faz toda venda dele cair no país do clique — e aí o
> erro entra no globo. `metrics.ts` faz `s.country ?? s.click?.country`.

**O que está errado é a geografia do CLIQUE**: "Vendas por país" está certo, mas
qualquer análise de *visitas* por país está inflando US/IE e subnotificando o
país real.

### ✅ RESOLVIDO no passo 6 (30/07/2026) — pela SEGMENTAÇÃO, não por datacenter

**Migration `20260730200000_geo_desempate`** — `AdSet.geoCountries`,
`Click.countrySource`, `Click.acceptLanguage`, `Click.timezone`,
`Sale.countrySource`. Tudo aditivo, tudo com default.

> ### ⛔ NÃO detectamos datacenter. Decisão do usuário, e o motivo não foi custo.
> A alternativa era manter uma base de faixas de IP da Meta (ASN). Descartada:
>
> **A segmentação é o que o anunciante CONFIGUROU, não uma inferência.** Se a
> campanha só roda BR e MX e o IP diz US, o IP está errado **independente do
> motivo** — datacenter, VPN, proxy corporativo ou base desatualizada. A
> detecção de datacenter resolveria *um* motivo; a segmentação resolve todos.
>
> E o caso que a detecção protegeria — IP residencial legítimo sobrescrito — não
> existe: um IP residencial legítimo **não contradiz** a segmentação da própria
> campanha que trouxe aquele visitante.
>
> ⚠️ **Efeito colateral decisivo:** o hash do IP (passo 7) deixou de depender
> disto. Pela base de ASN, o passo 7 ficaria bloqueado **para sempre** —
> comparar IP com faixas exige o IP legível.

### Cada sinal produz um CONJUNTO, nunca uma afirmação

Nenhum sinal nomeia um país sozinho. Cada um devolve os países possíveis, que
são **intersectados com a segmentação**. Só resolve quando sobra exatamente um.

Isso importa porque operadora não é global: **"Claro" opera em BR, AR, CL, CO,
PE** e mais. Dizer `CLARO → BR` seria chutar. Mas `CLARO ∩ {BR, MX}` = `{BR}`
resolve com honestidade, e `CLARO ∩ {BR, AR}` **não resolve** — e aí a resposta
certa é incerto.

| # | Sinal | Força | Ressalva |
|---|---|---|---|
| 1 | Segmentação com **um país só** | máxima | não precisa de mais nada |
| 2 | `FBCR/<operadora>` | forte | quase sempre multipaís |
| 3 | `Accept-Language` | média | header com pesos — vale para o script JÁ instalado |
| 4 | locale do user agent (`pt_BR`) | fraca | é o idioma do APARELHO |

> ### ⛔ Sem contradição, NADA disso roda
> Campanha mundial (lista vazia) ou IP compatível com a segmentação → devolve o
> país do IP e pronto. Não há por que adivinhar quando a medida é coerente. Um
> **americano real** comprando pelo Instagram numa campanha que roda US continua
> `US`.

> ### ⛔ Nada resolveu = INCERTO. O país do IP NÃO volta.
> Quando o IP contradiz a campanha ele é **sabidamente errado** — devolvê-lo
> produziria um número plausível e falso no mapa. `null` vira "Não identificado"
> na tela, que é uma afirmação verdadeira.

### Custo na Graph API: ZERO chamadas a mais

`targeting{geo_locations}` é **campo do AdSet**, e `syncAdSets` já faz
`GET /{account}/adsets?fields=…`. É um campo a mais numa requisição que já
acontece. Sob demanda seria uma requisição por clique, dentro de uma rota que
hoje só escreve no banco — e cliques chegam às dezenas por minuto.

> ⚠️ **Não basta ler `countries`.** Campanha segmentada por cidade ou região não
> preenche `countries` — o país vem DENTRO de cada item (`cities[].country`).
> Ler só `countries` faria toda campanha local parecer mundial, que é exatamente
> o caso em que o desempate mais importa.
>
> ⚠️ **`country_groups` NÃO é expandido** de propósito. Expandir "europe" para 44
> países tornaria a interseção tão larga que nunca sobraria um país só —
> desempate que nunca dispara é pior que desempate ausente, porque parece que
> está funcionando.
>
> ⚠️ **União dos conjuntos, não interseção.** Se um conjunto roda BR e outro MX,
> a campanha alcança os dois. Interseção devolveria vazio e nada desempataria.

### `countrySource` — a procedência de cada país

`ip · campanha · carrier · idioma · locale · header · incerto` no clique;
`payload · ip · clique · payload_cru` na venda. Sem isso não há como auditar nem
como a tela dizer "isto é estimativa".

**O ranking já usa:** país cuja fonte não é `payload` nem `ip` conta como
**estimada** e ganha o chip âmbar. Medida é `payload`/`ip`; o resto é inferência.

### Sinais coletados agora, usados depois

- **`Accept-Language`** — já em uso no desempate. É header, então **vale para o
  script já instalado**, sem reinstalação.
- **`Click.timezone`** — `Intl.DateTimeFormat().resolvedOptions().timeZone`.
  Sinal **geográfico direto** (`America/Sao_Paulo`), mais forte que o locale, e
  **ainda não usado**: converter fuso→país exige uma tabela de ~400 zonas, e uma
  tabela parcial funcionaria para alguns países e não para outros — pior que
  nenhuma, num produto mundial. Coletado agora porque não dá para voltar no
  tempo. **Só chega de quem reinstalar o script.**

> ⚠️ O `tz` vai dentro de `try/catch` no `t.js`: `Intl` pode faltar em navegador
> antigo, e um erro ali pararia o rastreamento inteiro por um campo opcional.

**Testado:** `npm run test:desempate` — **27 asserções** com os user agents reais
dos 29 cliques que resolviam errado. Cobre: sem contradição o IP vence;
americano real não é sobrescrito; campanha de um país decide sozinha; carrier,
idioma e locale na ordem certa; **operadora multipaís não decide sozinha**; e
nada-resolve devolve `incerto` sem trazer o IP de volta.

### ⚠️ Não feito no passo 6

- **Backfill do `countrySource` histórico.** Cliques e vendas já gravados ficam
  com a coluna NULA — não dá para reconstruir a procedência de uma decisão já
  tomada. O ranking trata NULO como "não estimada", que é o comportamento antigo.
- **Reprocessar cliques antigos com a segmentação.** Exigiria refazer a resolução
  de 237 cliques com dados de campanha que só existirão após o próximo sync
  completo. Avaliar depois de `geoCountries` estar populado.
- **🔴 Nenhuma resposta REAL da Graph API foi observada.** O campo `targeting`
  entrou numa chamada de leitura já existente, mas o formato real não foi visto.

### 🔬 `npm run geo:sonda` — obrigatória ANTES do passo 7

```bash
npm run geo:sonda -- --url '<connection string de produção>'
npm run geo:sonda -- --url '<conn>' --cru   # despeja o JSON completo
```

**Só leitura** (`GET` na Graph API + `SELECT`). Custo: **1 chamada por conta
rastreada**.

> ### ⛔ Ela chama a GRAPH API, e não é firula
> Ler o banco responde *"está vazio?"*. Só a resposta crua responde a pergunta
> que importa: **vazio porque a campanha é mundial, ou vazio porque o campo não
> veio?** As duas produzem exatamente a mesma linha no banco — e uma delas
> significa que o desempate está morto.
>
> É a lição do passo 1: a base de países ficou pronta, testada e commitada uma
> sessão inteira **sem ser consultada por ninguém**, e só descobrimos por acaso.

O que ela reporta: conjuntos com segmentação × vazios, média de países,
`country_groups` não expandidos (com os nomes), quantos usam `cities`/`regions`
— e **um exemplo real da resposta**, mais um exemplo de segmentação por cidade
para confirmar que o país sai de `cities[].country`.

**Vereditos:**

| Saída | Significa |
|---|---|
| Todos sem `targeting` | 🔴 **o campo não vem. Desempate INERTE. NÃO avance para o passo 7** |
| Campo vem, nenhuma restrição de país | 🟡 correto — campanha mundial não desempata |
| N conjuntos com país extraível | ✅ funcionando |
| Graph OK mas banco vazio | ⚠️ o sync ainda não rodou com o código novo |

> ⚠️ A sonda **duplica** a extração de `paisesDaSegmentacao`. É de propósito: se
> ela importasse a do `sync.ts`, um bug lá apareceria como "tudo certo" aqui. A
> cópia é a testemunha independente — se divergirem, a sonda mente.


### 📌 Decisões registradas

- **A base local é o caminho PRINCIPAL; o header da Vercel é só atalho**, porque
  o produto vai migrar para **VPS dedicada**. Nada pode depender do header para
  funcionar — senão a migração quebra a geolocalização e o sintoma só aparece
  com tráfego real já perdido.
- **`PROXIES_CONFIAVEIS`**: errar para **MAIS** aceita IP forjado; errar para
  **MENOS** grava o IP do proxy e todo visitante vira o mesmo endereço. Tabela
  por ambiente documentada na seção "IP do visitante".
- **MaxMind e IP2Location LITE exigem cadastro** e estão descartados. O
  `geo-whois-asn-country` que chegou a ser cogitado **não existe mais**: o
  repositório deixou de usar WHOIS de RIR porque as AUPs proíbem mapeamento
  geográfico.
- **Cobertura contínua** no artefato: buracos do espaço IPv4 são entradas
  explícitas para "desconhecido". 5 bytes por entrada em vez de 9, e um IP em
  bloco reservado não herda o país da faixa anterior.
- **IPv4 apenas.** IPv6 devolve `null` (não identificado), nunca país errado.

### ⚠️ Pendência conhecida

`/api/diagnostico/ip` manipula `process.env.PROXIES_CONFIAVEIS` para simular
cada valor e restaura no `finally`. Em serverless é seguro (uma requisição por
instância); **numa VPS com concorrência, duas chamadas simultâneas poderiam se
atrapalhar** por um instante. Não afeta o `/api/track/click` — o efeito seria um
número errado na própria página de diagnóstico. **Ajustar para receber o valor
por parâmetro em vez de mexer no ambiente.**

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
npm run backfill:utms    # copia os UTMs do clique. SIMULA; --aplicar escreve
npm run test:veiculacao  # 40 asserções, status configurado × veiculação (puro)
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

- **Nav morto no `useTraffikState`** (`navAnalise`, `pageTitle`, `activeTab`,
  `fbTabs`…), o gerador de link/snippet antigo (`utmUrl`, `snippetText`) e o
  `ruleForm` com ~37 handlers, órfão desde que a `RulesView` foi reescrita.
- **`EditDashboardDrawer` + `editDashOpen`/`openEditDash`/`closeEditDash`/
  `metricList`** — a gaveta está montada no `DashboardShell` mas **nada a abre**;
  quem edita o dashboard é o painel inline do Bloco 2. Descoberto em 30/07/2026.
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

## 🎨 Marca e logos

Arquivos em `public/logos/` (webp, vindos do designer):

| Arquivo | Onde |
|---|---|
| `traffik-claro.webp` | Wordmark de letras **brancas** — sidebar (o tema é escuro) |
| `traffik-escuro.webp` | Wordmark de letras pretas — reservado para fundo claro, **ainda sem uso** |
| `kirvano/hotmart/cartpanda/kiwify/facebook.webp` | Gateways e plataformas |
| `favicon.webp` | Origem do favicon |

- **`ui/LogoGateway.tsx`** é o único ponto que resolve logo de gateway. Recebe o id
  (`KIRVANO`, `HOTMART`, …) e **cai no monograma quando não há arquivo** — hoje nenhum
  gateway está nessa situação, mas o fallback fica para o próximo que entrar na lista
  antes de a arte chegar.
- **Sem fundo atrás das logos**, por pedido do usuário: só `border-radius` +
  `overflow:hidden`, que arredonda o fundo **já embutido** em artes como a da Kirvano
  em vez de deixar quina viva. Luminância média dos pixels opacos (medida com o sharp):
  Kirvano 63, Cartpanda 87, Hotmart 112, Facebook 134, Kiwify 148 — sobre `/255`.
  A Kirvano tem 94% de área opaca (traz o próprio fundo escuro), então continua legível.
  ⚠️ **A Cartpanda é o caso ruim**: panda preto com detalhes brancos em fundo
  transparente, então no tema escuro sobram quase só os olhos. Só aparece nas abas do
  modal de UTMs. Resolver exige um arquivo em versão clara ou um fundo sutil só nela.
- **Favicon**: `src/app/icon.png` (512) e `apple-icon.png` (180), gerados do `.webp` por
  `scripts/gen-favicon.mjs` com o `sharp` (que já vinha com o Next). A convenção de
  arquivo do Next **não aceita webp**, e nem todo navegador desenha favicon nesse
  formato — por isso a conversão. O `src/app/favicon.ico` antigo foi removido, senão
  teria precedência.
- **Tamanhos**: o wordmark é preso pela **largura** (`max-width:184px`, altura livre),
  não pela altura — assim ocupa a coluna da sidebar como na referência da Utmify, e a
  proporção 904×230 nunca estica. Renderiza 184×47. O mesmo wordmark, a 168px, substituiu
  o monograma "T" no **login/cadastro** (`(auth)/AuthShell.tsx`). Gateways a 34px no card
  e 38px na grade da gaveta; 22px nas abas do modal de UTMs.
- O subtítulo "Analytics de tráfego" saiu da sidebar — a marca agora fala sozinha.

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

## 🗄️ Padrão de revelação: gavetas laterais

**Regra da ferramenta:** dado sensível ou verboso (URL de webhook, token, script, id)
**nunca aparece na listagem**. A listagem mostra nome, status e uma métrica de uso; o
detalhe vive numa gaveta que desliza da direita, com botão de copiar.

`ui/Drawer.tsx` — `Drawer` + `CampoCopiavel`. Fecha no Esc, trava o scroll do fundo,
devolve o foco a quem abriu e prende o Tab dentro dela.

> ⚠️ **A gaveta é renderizada via `createPortal` no `<body>`, e isso é obrigatório.**
> Ela é `position:fixed`, e qualquer ancestral com `transform` vira o bloco de contenção
> — a animação `.page-enter` do shell fazia exatamente isso, e a gaveta abria com a
> **altura colapsada** (só o cabeçalho e o rodapé). Se um dia aparecer um painel fixo
> "achatado", é esse o motivo.

Aplicado em:
- **Webhooks**: "Adicionar Webhook" abre gaveta com **grade de gateways + busca**
  (preparada para muitos; só Kirvano ativa). A listagem mostra logo, nome, status e
  nº de eventos — **sem a URL**. "Editar" abre a gaveta e só ali a URL é revelada.
- **Pixel**: card compacto (nome, status, nº de pixels Meta, nº de eventos ativos).
  "Editar / ver" abre a gaveta com toda a configuração **e o script gerado**, que
  deixou de ter modal próprio. Ao salvar um pixel novo a gaveta continua aberta nele,
  porque é onde o script aparece.
- **Anúncios**: clicar no perfil abre gaveta com as contas e seus toggles, em vez de
  expandir inline empurrando a vitrine. O tile "+" segue sempre visível.
- **UTMs**: já estava no padrão desde o Bloco 11 ("Ver opções" → modal com Hotmart /
  Cartpanda / Outros e botão copiar). Nada a mudar.

### Bug do zoom do globo (corrigido)

O `scale` da projeção crescia com o zoom mas o `translate` ficava preso no centro do
`viewBox`: a esfera transbordava e aparecia cortada/deslocada. Agora há
`clampZoom` (1–4) e **`clampPan`**, que limita o deslocamento do centro a
`raio − SIZE/2`. O efeito: em zoom 1 o globo aparece inteiro e centrado; com zoom, o
quadro fica sempre **dentro** da esfera, então nunca se vê o fundo. O wheel faz
zoom-to-cursor e o Reset volta a zoom 1, pan zero e rotação inicial.
Verificado: esfera 288px dentro da moldura de 300 em zoom 1 → 1097px cobrindo
integralmente a moldura após 6 passos de zoom.

---

### 3ª rodada de polimento + bug dos gráficos de barra

**BUG CRÍTICO corrigido:** "Vendas por Horário", "Lucro por Horário" e "Vendas por Dia"
renderizavam só a alça roxa e o corpo vazio. **Não era altura zerada** — os três ids
estavam registrados em `blocks.ts` mas **sem `case` correspondente no `BlockContent`**:
uma edição minha anterior, ao remover casos duplicados, apagou os novos junto. O
`switch` caía no `default: return null`. Lição: `blocks.ts` e o `switch` do
`BlockContent` são duas listas que precisam andar juntas — **um bloco registrado sem
case vira um card vazio silencioso**, sem erro de tipo nem de runtime.

Demais melhorias desta rodada:
- **Barras**: 24 posições sempre presentes (horário) e **todos os dias da janela**
  (`byDay` agora preenche as lacunas no backend, antes só trazia dias COM venda).
  Barras-fantasma nas posições sem valor, grade, eixo Y, subida escalonada e tooltip
  com faixa de hora (`14h00 – 15h00`) ou data por extenso.
- **Donuts**: micro-interação no centro (troca o total pelo valor+% da fatia sob o
  mouse), mini-barra de proporção na legenda, glow quando há **uma fatia só**.
- **Funil**: percentual sobre "pílula" semi-transparente com blur (o número branco
  sumia nos trechos claros do gradiente), fio mínimo de 4,5% para o estrangulamento
  não desaparecer, e tooltip com **as duas taxas** (vs. etapa anterior e vs. topo).
- **Taxa de aprovação**: ícone por método, cor reagindo ao valor (verde ≥80%,
  amarelo ≥50%, vermelho abaixo), glow na ponta, animação escalonada e **os 3 métodos
  sempre visíveis** — um método sem dado mostra "N/A" em vez de sumir da lista, que era
  justamente o que escondia o método que parou de vender.
- **Atividade recente**: virou **feed unificado**. Antes todo evento saía como "Venda"
  porque o tipo era fixo por origem de tabela. Agora são 6 tipos com badge, ícone e cor
  próprios — clique (azul), checkout (roxo), venda pendente (âmbar), venda aprovada
  (verde), reembolso e chargeback (vermelho) — com **filtro por tipo** no topo e entrada
  escalonada. Os `PixelEvent` passaram a ser lidos como linhas (antes só `count()`).

**Ainda pendente:**
- O filtro do feed é **local** (filtra o que já veio); não recarrega do servidor.
- O feed traz no máximo 40 eventos por janela, sem paginação.
- Sparklines seguem cobrindo 7 métricas; ROI, margem e CTR continuam sem série.

---

### Polimento premium dos gráficos (2ª revisão de design)

Reformulação completa do acabamento, pedida com referências (Apple/Linear/Vercel):

- **`ui/chartKit.tsx` — peças compartilhadas.** `ChartTooltip` (fundo translúcido com
  `backdrop-filter`, borda sutil, sombra), `ChartEmpty` (ícone + frase útil),
  `Sparkline`, `Delta` (seta + verde/vermelho, com flag `invertido` para métricas de
  custo onde subir é ruim) e a paleta análoga. Antes cada gráfico inventava o seu.
- **Globo** (`CountryMap`): `d3.geoOrthographic` — esfera girável de verdade, com
  gradiente radial de iluminação, oceano azul-marinho, continentes com borda luminosa,
  marcadores pulsantes proporcionais, **rotação automática que pausa ao interagir**,
  arraste/scroll/reset e tooltip com bandeira. Estado vazio = globo girando com legenda
  discreta sobreposta.
  **WebGL/three.js foi descartado de propósito:** seria um canvas com contexto próprio
  dentro de um bloco redimensionável, com risco em máquina sem aceleração. O d3 desenha
  SVG comum, participa do layout e não tem contexto para perder.
- **Funil**: gradiente contínuo azul→roxo→magenta, animação de preenchimento da esquerda
  para a direita (`clipPath` animado), taxa no centro, valor absoluto embaixo, tooltip
  por etapa.
- **Donuts**: espessura generosa, gap entre fatias, fatia ativa cresce e as outras
  esmaecem, total no centro, legenda em **colunas alinhadas** (cor · nome · R$ · %).
- **Barras**: barras-fantasma nas posições sem valor (dá contexto de série temporal em
  vez de uma barra solitária no vazio), grade, eixo Y, animação de subida escalonada e
  **tooltip detalhado** — "14h00 – 15h00" com vendas e faturamento; no diário, a data
  por extenso.
- **Cards de KPI**: hierarquia (label → número grande → comparação), **sparkline** da
  métrica no período e delta colorido com seta. As séries vêm de `chart.sparklines`,
  derivadas dos mesmos buckets do gráfico grande.

**Dois erros meus corrigidos no caminho:**
1. Tentei forçar o funil a estreitar sempre (clamp monotônico no mínimo acumulado). Isso
   **colapsava o funil inteiro numa linha** quando o 1º estágio era 0 — que é o caso
   comum, com o Facebook não sincronizado. Voltou a ser proporção direta: com dados
   encadeados a forma afunila sozinha, e quando um estágio posterior é maior isso é
   informação real (ICs vêm do pixel, vendas vêm do gateway — fontes independentes).
2. O gradiente do funil saía **listrado**: `linearGradient` usa `objectBoundingBox` por
   padrão, então cada segmento aplicava a escala inteira à própria caixa. Corrigido com
   `gradientUnits="userSpaceOnUse"`.

> **Dados do globo**: `scripts/gen-world-paths.mjs` agora gera `src/lib/worldGeo.ts` com
> **coordenadas lng/lat** (não paths SVG), porque a projeção ortográfica reprojeta a
> cada frame. Continua pré-computado e commitado — sem TopoJSON no navegador e sem
> `world-atlas`/`topojson-client` no package.json. A única dependência nova é `d3-geo`.

**Ainda pendente do polimento:**
- O globo cobre os **~32 países** da tabela `lib/countries.ts`; fora dela, o país aparece
  só no Ranking.
- Os continentes são **contorno de terra**, sem fronteiras por país — os países são
  identificados pelos marcadores.
- Sparklines existem para faturamento, gasto, vendas, ROAS, ticket, ARPU e CPA. **ROI,
  margem, CTR e as métricas de contagem não têm série** e ficam sem mini-gráfico.
- `deltas` do backend não cobrem todas as métricas; as sem delta mostram o texto neutro.

---

### Revisão de design do Bloco 5 (feedback do usuário)

Os gráficos foram reprovados na primeira entrega e refeitos:
- **Funil**: os trapézios com quinas viraram **bulbos com curvas de Bézier**, gradiente
  azul→roxo→rosa, nome da etapa no topo, % sobre o eixo e valor absoluto embaixo.
  A meia-altura de cada etapa é proporcional ao valor, e o estrangulamento entre elas
  sai das curvas — não de barras justapostas.
- **Mapa**: agora é o **modo padrão** (antes abria em Ranking, e o usuário nunca via o
  mapa) e desenha os continentes de verdade.
- **Donuts**: eram um disco fixo de 140 px perdido num card alto ("raso e vazio").
  Passaram a **escalar com o bloco** (`flex` no SVG + legenda centralizada).
- **Barras** (por horário / lucro / por dia): eram tracinhos de 2 px espalhados.
  Ganharam grade de fundo, eixo Y, gradiente, brilho e topo arredondado — com
  `max-width` por barra para 2 ou 3 pontos não virarem blocos gigantes.

**Incompleto / TODO no Bloco 5:**
- O mapa desenha **contorno de terra**, não fronteiras por país — os países são
  identificados pelos marcadores, não por preenchimento.
- **`lib/countries.ts` cobre ~32 países.** Um país fora da lista aparece no Ranking com
  o código cru, mas **não ganha ponto no mapa**. Ampliar é acrescentar uma linha.
- **O funil mistura fontes com granularidades diferentes**: "cliques no anúncio" vem de
  métricas **diárias** do Facebook, enquanto os outros estágios são eventos com hora.
  Num período de horas os números não são comparáveis.
- **"Vendas iniciadas" conta todos os eventos de venda** (inclusive reembolsadas e
  chargebacks), porque é o que existe hoje na tabela.
- Os rótulos dos eixos ficam dentro de um SVG com `preserveAspectRatio="none"`; em
  blocos muito largos e baixos o texto estica. O tooltip já é HTML por isso.
- A **animação do funil** depende do browser interpolar `points`; o suporte é bom mas
  não é garantido em todos.

---

### Bloco 4 — Métricas do Dashboard

Feito:
- **ROI virou multiplicador.** Era `(profit / totalCost) * 100` exibido como `1331%`;
  agora é a razão pura, formatada com **`multFmt`** (2 casas: `13,31x`). Os `deltas`
  não foram afetados — são variação percentual entre períodos, e a escala se cancela.
- **ARPU** = faturamento ÷ compradores únicos. O comprador é identificado pelo e-mail;
  **vendas sem e-mail contam como compradores distintos**, porque não há como agrupá-las
  — melhor superestimar o denominador (ARPU conservador) do que fundir pessoas.
- **CPA já existia** (`spend / salesCount`) desde a v1 — só não estava evidente. Nada a
  fazer além de confirmar que está no `blocks.ts`.
- **Três séries novas**: vendas por horário, lucro por horário (24 posições) e vendas
  por dia (até 30). Renderizadas por um `BarrasVerticais` reutilizável, com tooltip por
  barra e rótulo de hora a cada 3h para não virar sopa de números.
- Os 4 blocos novos entram **desativados**, aparecendo em "Métricas disponíveis" —
  quem já tinha layout salvo não vê o dashboard mudar sozinho.

> **Decisão sobre "respeitar os filtros".** O roteiro pede "24h do dia atual" e
> "últimos 30 dias" mas também exige que toda métrica respeite os filtros do topo.
> Resolvido bucketizando a **janela já filtrada**: com o período em "Hoje" o gráfico por
> horário É as 24h de hoje; com "Últimos 30 dias" o por-dia É o mês. Fica coerente com
> qualquer filtro em vez de ignorar o de cima.

> **Lucro por hora é rateado.** Não há como atribuir gasto de anúncio (que vem de
> métricas *diárias*) nem despesas de gateway/imposto a uma hora específica. O lucro
> horário aplica `custoSobreReceita = (gasto + despesas) / faturamento` proporcional ao
> faturamento da hora. É aproximação, não custo real por hora.

**Testado com dados reais:** 4 vendas semeadas (duas do mesmo e-mail, uma sem e-mail)
→ `revenue=1238,70`, `buyers=5`, `arpu=247,74` — confirmando que o mesmo comprador com
2 compras conta uma vez. `byHour` com 24 posições e vendas nas horas certas; ROI saiu
`13,31x` na tela (era `1331%`). Os 4 blocos apareceram em "Métricas disponíveis" e
foram adicionados ao grid. Dados de teste removidos depois.

**Incompleto / TODO no Bloco 4:**
- **`roasFmt` continua com 1 casa** (`0,0x`) enquanto o ROI usa 2 (`13,31x`). O roteiro
  dizia "igual ao ROAS" mas deu exemplos de 2 casas (`1,87x`); segui os exemplos e não
  mexi no ROAS, que não estava no escopo. **Alinhar os dois se você preferir.**
- **Sem delta para o ARPU**: `trendOf("arpu")` procura uma chave que o backend não
  calcula, então cai no texto neutro "vs. período anterior" em vez de uma variação.
- Os gráficos de barras são **CSS puro, sem eixo Y nem grade** — o valor só aparece no
  tooltip. Eixos e tooltips ricos são o Bloco 5.
- "Vendas por dia" corta em 30 pontos; um período personalizado mais longo mostra só os
  30 últimos dias, silenciosamente.

---

### Bloco 3 — Filtros e container do topo

Feito:
- **Container único** (`.tk-filtros`) com os 4 filtros + o botão "Editar dashboard",
  usando fundo/borda/raio dos cards. Para o botão morar aqui, o estado do grid saiu do
  `DashboardGrid` para o hook **`useDashboardLayout`**, chamado na `DashboardView` — o
  grid virou puro renderizador. Em modo de edição o container troca o botão por
  Salvar / Cancelar / Redefinir.
- **`ui/Select.tsx`** — select próprio (o nativo não aceita dropdown escuro nem busca).
  Mantém o que o nativo dava de graça em acessibilidade: `combobox`/`listbox`, setas,
  Enter/Esc/Home/End e foco de volta no gatilho ao fechar. **Busca interna aparece só
  quando a lista tem ≥ 8 itens** (`searchThreshold`) — é o caso das contas de anúncio.
- **`ui/DateRangePicker.tsx`** — calendário de intervalo: seleção de duas pontas com
  pré-visualização no hover, setas de mês, dropdowns de mês e ano, os 6 atalhos
  (Hoje / Ontem / Últimos 7 / Últimos 30 / Este mês / Mês passado), Aplicar e Cancelar,
  e dias futuros desabilitados.
- **`lib/dateRange.ts`** — a lógica de data ficou fora do componente, como função pura
  e testável.

> ⚠️ **Nunca usar `Date.toISOString()` para pegar "o dia".** Ele converte para UTC e no
> Brasil (UTC-3) **a partir das 21h local já devolve o dia seguinte** — o filtro "Hoje"
> apontaria para amanhã toda noite. Use `toISO()` do `lib/dateRange.ts`, que monta a
> data a partir dos componentes locais. Verificado: 21:00 de 24/07 → `toISOString()`
> dá `2026-07-25`.

O backend **já suportava** `period=custom` com `from`/`to` (em `metrics.ts` desde a v1);
faltava só o front mandar. `useTraffikState` ganhou `dashFrom`/`dashTo` e setters por
valor (`setDashPeriod`, `setDashRange`, …) no lugar dos antigos `onDashX` que recebiam
um `ChangeEvent` de `<select>` nativo.

**Testado:** 17 casos da lógica de data passando, incluindo ano bissexto, "Mês passado"
a partir de janeiro (cai em dez/2025), grade de julho (3 vazios + 31 dias) e a
divergência de fuso demonstrada às 21h. No navegador: dropdown escuro com hover roxo e
✓ no selecionado; calendário abre **dentro da tela** com os 6 atalhos e 7 dias futuros
desabilitados; aplicar "Este mês" fechou o popup, mudou o rótulo do filtro para
`01/07 – 24/07` e disparou
`GET /api/dashboard?period=custom&…&from=2026-07-01&to=2026-07-24` → 200.
Também confirmei aqui o que faltava do Bloco 2: **o layout salvo é restaurado** ao
recarregar.

**Incompleto / TODO no Bloco 3:**
- O calendário é **um mês só** (o padrão do mercado para intervalo mostra dois lado a
  lado). Escolher um intervalo longo exige navegar de mês em mês.
- **Ancoragem fixa** (`left: 0`): o popup abre sempre alinhado à esquerda do gatilho,
  com `max-width` para não sair da tela. Não há reposicionamento automático — se o
  filtro de período for para o lado direito da barra um dia, vai precisar de ajuste.
- Os `<select>` de mês/ano **dentro** do calendário ainda são nativos. São listas
  curtas e dentro de um popup já customizado; trocar traria pouco.
- O `Select` não faz *type-ahead* (digitar "c" para pular para "Cartão") quando a busca
  está escondida.
- Sem `<Portal>`: o popup é `position:absolute` dentro do container. Funciona porque o
  container não tem `overflow:hidden`, mas é uma dependência frágil.

---

### Bloco 2 — Grid arrastável do Dashboard

**Escolha da lib: `react-grid-layout` 2.2.3.** O `dnd-kit` é melhor para listas
ordenáveis, mas **não tem redimensionamento** — teria que construir resize,
colisão e compactação na mão. O RGL foi feito exatamente para grid de dashboard,
o layout dele é um array serializável (`{i,x,y,w,h}`) que vai direto para o Json
do Prisma, e o `Responsive` já resolve breakpoints — que é o requisito de
"layouts separados para desktop e mobile". Aceita React 19 (peer `>= 16.3`).

> ⚠️ A **v2 mudou a API** em relação aos exemplos da v1 que circulam por aí:
> `dragConfig={{enabled, handle}}` e `resizeConfig={{enabled, handles}}` no lugar
> de `isDraggable`/`isResizable`, e **não existe mais o HOC `WidthProvider`** — usa-se
> o hook `useContainerWidth()`, que devolve `{ width, containerRef }`.

Feito:
- **`blocks.ts` — registro único** do que existe no dashboard: 18 blocos (12 KPIs +
  6 gráficos/tabelas), cada um com tamanho padrão e mínimo. O layout padrão, o painel
  de "Métricas Disponíveis" e o saneamento derivam **todos** daqui, então adicionar
  uma métrica no Bloco 4 é acrescentar uma entrada nessa lista.
- **`sanitizeLayout`** roda na leitura **e** na escrita: descarta bloco que não existe
  mais no código, força os tamanhos mínimos e ignora entrada inválida. É o que impede
  um layout salvo de quebrar o dashboard depois de um deploy que removeu um bloco.
- **`DashboardGrid.tsx`**: modo de edição com alças de arraste (o cabeçalho roxo do
  bloco), redimensionamento pelo canto, botão ✕ para remover, painel lateral com os
  blocos ainda não usados, e **Salvar / Cancelar / Redefinir configurações**.
  "Cancelar" volta para um snapshot tirado ao entrar em edição.
- **Tabela `DashboardLayout`** (migration `20260724210000`): `@@unique([userId, viewport])`,
  uma linha por usuário × viewport. Actions em `lib/actions/dashboardLayout.ts`.
- `DashboardView` ficou só com a barra de filtros + `<DashboardGrid />`; todo o
  conteúdo virou `BlockContent.tsx`, que mapeia id do bloco → JSX.
- `useTraffikState` passou a expor `metricCards` (o registro por chave) — o grid
  precisa buscar a métrica pelo id, não pela ordem.

**Testado:** modo de edição abre com alças e painel; arrastar um KPI reflui os
vizinhos; adicionar bloco pelo painel funciona (ele some da lista de disponíveis);
"Salvar" grava as duas viewports (14 blocos cada) e o desktop reflete a ordem
arrastada enquanto o mobile mantém o padrão — provando que os layouts são mesmo
independentes. Round-trip do `sanitizeLayout` verificado contra o banco real, mais
os casos de bloco removido (15→14), tamanho abaixo do mínimo (corrigido para 4/5) e
entrada inválida (`null`). `tsc` e `next build` limpos.

**Incompleto / TODO no Bloco 2:**
- **A restauração ao recarregar não foi confirmada visualmente** — a extensão do Chrome
  caiu no fim. Está verificada no banco e pelo round-trip do `sanitizeLayout`, e o
  caminho de leitura é direto (`loadDashboardLayouts` → `setLayouts`), mas convém abrir
  o dashboard e conferir a olho.
- O painel "Métricas Disponíveis" adiciona **por clique, não por arraste**. O roteiro
  pedia arrastar de dentro do painel para a grade; o RGL suporta (`dropConfig` +
  `droppingItem` + HTML5 drag), mas o clique é mais previsível e acessível. Trocar se
  fizer falta.
- **`Cancelar` não desfaz o `Redefinir configurações`** — o reset já apaga no banco na
  hora. É destrutivo e sem confirmação.
- Os gráficos ainda são os SVGs antigos, só que dentro de blocos redimensionáveis.
  Quem os refaz de verdade (área, funil trapezoidal, mapa, donuts) é o **Bloco 5**.
- Sem `rowHeight` responsivo: em telas muito baixas os blocos altos forçam scroll.

---

## ⚡ Performance — o que estava lento e por quê

Medido em 24/07/2026 com o dev server e o Supabase real. **A latência de ida e
volta ao banco é ~99ms** (us-east-1). Esse é o custo unitário: qualquer caminho
com N queries **em série** custa N × 99ms. Otimizar aqui é sempre "reduzir o
número de round-trips sequenciais", não micro-otimizar SQL.

| | Antes | Depois |
|---|---|---|
| `GET /dashboard` (render do layout) | 811–874ms | **~283ms** |
| `GET /api/dashboard` | 383ms → 1520ms sob polling | **~222ms** |
| `GET /api/notifications` | 400ms → 1315ms sob polling | **~117ms** |

**As três causas, em ordem de impacto:**

1. **`getNotificationSettings` fazia uma ESCRITA a cada page load.** Eram 3 round-trips
   em série (checar usuário → `upsert`), ~630ms, e como roda no `Promise.all` do
   layout, **segurava sozinho o layout inteiro** (os outros 8 terminavam em ~230ms).
   Virou leitura pura: `findUnique` e só cria a linha se realmente faltar.
2. **`auth()` batia no banco a cada chamada.** O callback `session` resolve o id pelo
   e-mail (auto-cura de sessão do commit `a08d0e9`) — e **um page load chama `auth()`
   ~10x** (o guard + cada server action do layout). Agora tem duas camadas de cache em
   `src/auth.ts`: `cache()` do React (colapsa as ~10 de um request em 1) + um TTL de
   5 min em memória (evita repetir entre requests). A auto-cura continua valendo, só
   que com defasagem de até 5 min.
3. **O polling não parava em aba escondida.** `setInterval` de 15s seguia rodando em
   background; a contenção era o que fazia as mesmas rotas irem de ~380ms para ~1.4s.
   O helper `startPolling` (em `useTraffikState.ts`) só roda com
   `document.visibilityState === "visible"` e **revalida ao voltar** para a aba.

**Percepção de fluidez** (o "não está fluido" era em boa parte falta de feedback):
- O design tinha `:hover`/`:active` **sem transição nenhuma** — trocavam de forma seca.
  `globals.css` ganhou um bloco "Movimento" com tokens (`--dur-fast`, `--dur-base`,
  `--ease-out`), transições em `.btn`/`.input`/`.nav-item`/`.tag`/links, recuo tátil no
  clique, animação de entrada dos diálogos e `.skeleton`.
- **`(app)/loading.tsx`**: antes o clique num link não mostrava nada até o servidor
  responder. Agora aparece um esqueleto na hora (o shell fica no layout e é preservado
  entre rotas irmãs).
- **`.page-enter`** no `DashboardShell`, com `key={pathname}` — sem a key o React
  reaproveita o nó e a animação não redispara.
- Tudo dentro de `@media (prefers-reduced-motion: reduce)`.

> **Não adotado (de propósito):** o Next 16 tem `unstable_instant` +
> `cacheComponents` para navegação realmente instantânea
> (`node_modules/next/dist/docs/01-app/02-guides/instant-navigation.md`). Exige ligar
> Cache Components e reestruturar as páginas com `use cache` + `<Suspense>` nos lugares
> certos, e a API está marcada como **draft**. Fica como opção quando o roteiro v2
> estiver fechado.

**O que NÃO foi otimizado:** o layout continua buscando os 9 conjuntos de dados em
**toda** navegação, mesmo os que a página aberta não usa (ex.: `listExpenses` numa tela
de Integrações). Com o `Promise.all` isso custa ~230ms — o tempo do mais lento, não a
soma —, então o ganho de separar por rota seria pequeno perto do risco de refatorar o
`useTraffikState`. Reavaliar se o `Promise.all` passar de ~400ms.

---

## Dívidas técnicas conhecidas

Registradas de propósito — **não são bugs esquecidos**, são decisões tomadas.

| # | Dívida | Por quê / risco |
|---|--------|-----------------|
| 0 | ~~**`PixelEvent.espelho` sem leitor**~~ e ~~**detector congelado sem aviso**~~ ✅ **RESOLVIDOS em 31/07/2026 (3ª parte)** — card na aba Testes e aviso na gaveta do Pixel. | Fica só a confirmação no Gerenciador de Eventos da Meta, que é do usuário. |
| 1 | ~~**Dedup parcial dos eventos de pixel.**~~ ✅ **RESOLVIDO em 31/07/2026.** `eventId` determinístico (`057c06e`), espelho no `fbq` (`057c06e`, que **nunca rodou** até `0fa68d1`) e partição por dono do evento (`e755894`). Verificado em produção: `eid=InitiateCheckout-90whss` saindo pelo navegador com o mesmo id da CAPI, e **confirmado no Gerenciador de Eventos da Meta** — entrada única, "API de Conversões e navegador". | ✅ **Nada.** As duas pontas estão provadas: a nossa (o id sai igual dos dois lados) e a da Meta (ela juntou). O detector congelado saiu na 3ª parte de 31/07. |
| 2 | **Nav morto no `useTraffikState`** (`navAnalise`, `navAuto`, `navConfig`, `pageTitle`, `activeTab`, `fbTabs`, `fbSub`) e o **gerador de link/snippet antigo** (`utmUrl`, `snippetText`). Nada é renderizado. | Sobrou do Bloco 1/11. Limpar num passo de faxina. |
| 3 | **Atribuição por nome é ambígua** quando dois anúncios/campanhas têm o mesmo nome. | Limitação pré-existente; o id resolve para tráfego novo com os códigos do Bloco 11. O Teste de Tracking (Bloco 13) agora **avisa** quando o casamento foi por nome. |
| 4 | **`WebhookLog` sem retenção nem paginação.** | Cresce indefinidamente. Falta cron de purga. |
| 5 | **`AdProfile.accessToken` e `Webhook.secret` ainda em texto puro.** | Fora do escopo da encriptação pedida (que cobriu `MetaPixel`/`ApiCredential`). Mesmo helper serve se forem migrados. |
| 6 | **Sem rotação de `ENCRYPTION_KEY`.** | Trocar a chave torna ilegível o que já foi gravado. Uma rotação exigiria decriptar com a chave antiga e re-encriptar com a nova. |

---

## Próximo passo recomendado

1. **Resolver o deploy da Vercel** — os 4 passos manuais na seção acima. É a única
   pendência que depende do painel e trava ver qualquer coisa em produção.
2. **Bloco 6** (Gerenciador de Anúncios: layout e colunas estilo Facebook) — abas viram
   cards, tabela com 14 colunas de métricas, colunas fixas ao rolar, toggle de
   pausar/ativar na primeira coluna chamando a Marketing API, e checkboxes de seleção.
3. Depois **Bloco 7** (ações em massa, CBO/ABO) e **Bloco 8** (Regras).
4. Faxina pendente: a dívida técnica #2 (nav morto no `useTraffikState`).
