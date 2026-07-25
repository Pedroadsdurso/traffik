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

> ⚠️ **`CRON_SECRET` é obrigatória em produção.** A checagem nas rotas é
> `if (secret && auth !== ...)`: **sem a env var definida, as rotas de cron ficam
> públicas** e qualquer um pode disparar `/api/cron/run-rules`, que pausa campanha e
> altera orçamento de verdade.

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

## 🎨 Marca e logos

Arquivos em `public/logos/` (webp, vindos do designer):

| Arquivo | Onde |
|---|---|
| `traffik-claro.webp` | Wordmark de letras **brancas** — sidebar (o tema é escuro) |
| `traffik-escuro.webp` | Wordmark de letras pretas — reservado para fundo claro, **ainda sem uso** |
| `kirvano/hotmart/cartpanda/facebook.webp` | Gateways e plataformas |
| `favicon.webp` | Origem do favicon |

- **`ui/LogoGateway.tsx`** é o único ponto que resolve logo de gateway. Recebe o id
  (`KIRVANO`, `HOTMART`, …) e **cai no monograma quando não há arquivo** — hoje é o caso
  da Kiwify. Renderiza sobre um quadrado branco arredondado porque as artes têm fundo
  transparente e várias são escuras: sem isso a Kirvano sumiria no card.
- **Favicon**: `src/app/icon.png` (512) e `apple-icon.png` (180), gerados do `.webp` por
  `scripts/gen-favicon.mjs` com o `sharp` (que já vinha com o Next). A convenção de
  arquivo do Next **não aceita webp**, e nem todo navegador desenha favicon nesse
  formato — por isso a conversão. O `src/app/favicon.ico` antigo foi removido, senão
  teria precedência.
- **Tamanhos**: wordmark com `height:26px` e largura automática (proporção 904×230, nunca
  esticar); gateways a 34px no card e 38px na grade da gaveta; 22px nas abas do modal
  de UTMs.

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
