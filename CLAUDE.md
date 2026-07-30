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
- **Nenhuma ação de escrita foi exercida contra a API real do Facebook** nesta sessão
  (a conta de teste não tem token). O caminho até a Graph API está escrito e tipado,
  mas **a primeira execução real precisa ser observada** — comece por uma campanha
  pausada e de baixo risco.
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

**O cron do GitHub Actions continua**, e ainda importa: ele cobre a janela de 30
dias e mantém o motor de regras rodando **com ninguém olhando a tela** — o
auto-sync só dispara quando há requisição do painel.

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

> ⚠️ **Nenhuma ação de escrita foi exercida contra a Graph API real.** As duas
> guardas do teto agem ANTES da chamada, então foram provadas de verdade; o
> `clamp` no teto e o `updateDailyBudget` em si continuam sem execução real.
> **A primeira execução real precisa ser observada** — comece por campanha
> pausada e de baixo risco.

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

## 🚦 COMECE AQUI — estado em 30/07/2026 e a fila da próxima sessão

Tudo até `3bc1cda` está **em produção**. **A padronização visual terminou** — os
dois itens que faltavam (aproveitamento do espaço das 4 telas + os SVGs legados)
foram feitos em 30/07/2026 e estão **na árvore de trabalho, ainda SEM COMMIT**,
aguardando o teste do usuário. Sem migration pendente — o deploy é só push.

### ⚠️ Fila da próxima sessão

Não há item de padronização visual pendente, e o **lint está em zero**. O que
sobrou é **faxina de código morto** (lista em "Pendências abertas", abaixo) e o
**import/export do Bloco 8**, que ficou de fora de propósito.

⚠️ **Nenhuma escrita real contra a Graph API foi exercida** — segue sendo a
verificação mais importante em aberto. Ver "Pendências abertas".

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

## 🌍 GEOLOCALIZAÇÃO — estado e a ordem que NÃO pode inverter

### ✅ Pronto
- **`lib/geo/clientIp.ts`** — extração única do IP, robusta atrás de proxy.
  Substituiu **três** cópias de `x-forwarded-for.split(",")[0]`.
- **`npm run test:ip`** — 27 asserções (Vercel, VPS+nginx, Cloudflare, forja).
- **`GET /api/diagnostico/ip`** — diz qual `PROXIES_CONFIAVEIS` usar no ambiente
  real, em vez de deduzir.
- Pasta `lib/geo/` criada, pronta para receber a base.

### ✅ Pronto (continuação)
- **`npm run geo:atualizar`** → `scripts/gen-ip-country.mjs` baixa o
  `user-country-ipv4.csv` (**PDDL-1.0**, sem conta) e gera
  `lib/geo/ipCountryData.ts`: **290.457 faixas · 251 países · 1,4 MB binários**
  em base64. **COMMITADO**, como `worldPaths.ts` e `public/*.js`.
- **`lib/geo/pais.ts`** — `resolverPais(header, ip)`. Busca binária, ~19
  comparações, sem I/O e sem rede.
- **`npm run test:pais`** — 30 asserções com IPs reais (US, AU, BR).

> ⚠️ **Cobertura CONTÍNUA**: os buracos do espaço IPv4 (blocos reservados) são
> entradas explícitas apontando para "desconhecido". Por isso o fim de uma faixa
> é o início da próxima e bastam **5 bytes** por entrada, em vez de 9. Sem isso,
> um IP num bloco reservado herdaria o país da faixa anterior — pior que
> responder "não identificado".
>
> ⚠️ **IPv4 apenas.** IPv6 devolve `null`, tratado como não identificado, nunca
> como um país errado.
>
> ⚠️ **Atualização mensal**: rodar `npm run geo:atualizar`, conferir o resumo
> (nº de faixas e países) e commitar a saída.

### ⏳ Falta, NESTA ORDEM
1. ✅ ~~Gerador da base~~ — **mas a base ainda NÃO é consultada por ninguém.**
   Falta chamar `resolverPais()` no `/api/track/click` e no webhook, e gravar em
   `Click.country` / `Sale.country`. (`ip-location-db`, **PDDL-1.0**, sem conta).
   `user-country-ipv4.csv`, formato `start_ip,end_ip,país`, **sem cabeçalho**.
   Converter em array binário ordenado (~1,2 MB) e **commitar**, como
   `worldPaths.ts` e `public/*.js` já fazem. Busca binária em memória.
2. Resolução de país no `/api/track/click` e no webhook.
3. **Hash do IP** — `sha256(ENCRYPTION_KEY + ip)`, mesmo padrão do
   `ApiCredential.keyHash`. Preserva o casamento de `matchClick`; truncar
   para /24 quebraria (vários visitantes dividem /24).
4. Limpeza do IP em `Sale.rawPayload` e `WebhookLog.payloadRaw` **antes** de
   persistir — hoje o IP fica ali indefinidamente.
5. **Backfill** do país nos `Click` que ainda têm IP.
6. Ranking do globo com **"Não identificado"** agrupado, nunca sumindo.

> ### 🔴🔴 A ORDEM DO BACKFILL NÃO PODE INVERTER
> **PAÍS PRIMEIRO, ANONIMIZAÇÃO DEPOIS.**
>
> O backfill (5) só é possível enquanto `Click.ip` ainda tem o IP legível.
> Anonimizar antes (3/4) **destrói a única chance** de derivar o país do
> histórico — e não há como voltar atrás.
>
> Na prática: aplicar 1 e 2, rodar o backfill, **conferir a contagem**, e só
> então aplicar 3 e 4.

> ### ⛔ A BASE LOCAL é o caminho principal. O header da Vercel é só atalho.
> O usuário vai migrar para **VPS**. Se existir `x-vercel-ip-country`, usa (evita
> a busca); se não existir, cai na base local **com o mesmo resultado**. **Nada
> pode depender do header para funcionar** — senão a migração quebra a
> geolocalização inteira e o sintoma só aparece com tráfego real.

⚠️ **MaxMind e IP2Location LITE exigem conta** e o usuário não consegue criar.
O `geo-whois-asn-country` que eu havia recomendado **não existe mais**: o repo
deixou de usar WHOIS de RIR porque as AUPs proíbem mapeamento geográfico.

### Comandos

```bash
npm run test:areas       # 26 asserções, atribuição por área (backup de produção)
npm run test:periodo     # 33 asserções, janelas de período (puro, TZ=UTC)
npm run test:financeiro  # 33 asserções, líquido/lucro/ROI e cores (puro)
npm run test:pais        # 30 asserções, IP -> país pela base local
npm run geo:atualizar    # regenera a base (mensal) — commitar a saída
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
- **`Workspace.accountIds` / `webhookIds` / `pixelConfigIds` / `products`** —
  mortos, mantidos pela regra dos dois deploys.
- **`DashboardLayout.workspaceId` nullable** — o NOT NULL entra num 2º deploy.
- **Nenhuma escrita real contra a Graph API foi exercida.** O teste seguro
  combinado: regra de PAUSAR numa campanha **já pausada**, condição `Gasto ≥ 0`.
  O log deve dizer `✓ <campanha> — PAUSAR (já pausada)` sem alterar nada.
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
| 1 | **Dedup parcial dos eventos de pixel.** `Lead`/`AddToCart`/`InitiateCheckout` mandam um `eventId` aleatório do cliente, então o Facebook **não consegue deduplicar** se o pixel do navegador disparar o mesmo evento. Só o `Purchase` deduplica de verdade (usa `sale.id`). | **Aceito conscientemente pelo usuário** em 24/07/2026 como suficiente para começar. Risco: contagem inflada desses 3 eventos se o usuário também tiver o pixel nativo da Meta instalado. Para resolver: derivar o `eventId` de algo estável (ex.: `fbclid` + nome do evento + janela de tempo) e expor a mesma chave ao pixel do navegador. |
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
