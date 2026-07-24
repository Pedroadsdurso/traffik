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
    useTraffikState.ts              # HOOK GIGANTE: todo o estado/derivações do dashboard
    types.ts                        # só TabKey e MetricKey
    views/                          # DashboardView, AdsManagerView, CreativesView, RulesView,
                                    #   NotificationsView, FeesView, UtmView
    views/integracoes/              # AnunciosView, WebhooksView, PixelView, TestesView
  lib/
    prisma.ts appUrl.ts format.ts sx.ts
    crypto/secrets.ts               # AES-256-GCM das credenciais em repouso
    actions/                        # server actions ("use server"), retornam DTOs
      webhooks pixels rules notifications expenses facebook dashboardPrefs session
      apiCredentials utm diagnostics
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
| 2 | Grid arrastável do Dashboard | ⏳ pendente |
| 3 | Filtros e container do topo | ⏳ pendente |
| 4 | Métricas do Dashboard (ROI×, ARPU, CPA, por horário…) | ⏳ pendente |
| 5 | Gráficos (funil, mapa de países, donuts, taxa de aprovação) | ⏳ pendente |
| 6 | Gerenciador de Anúncios: layout+colunas estilo FB | ⏳ pendente |
| 7 | Gerenciador: painel de ações em massa (CBO/ABO) | ⏳ pendente |
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
2. **Bloco 2** (grid arrastável do Dashboard) — as Integrações (9–13) estão fechadas,
   e o roteiro manda ir para o Dashboard agora. Escolher entre `react-grid-layout` e
   `dnd-kit`, criar a tabela `DashboardLayout` (user_id, layout JSON, viewport) e
   salvar layouts separados para desktop e mobile.
3. Oportunidade de faxina antes do Bloco 2: limpar a dívida técnica #2, já que o
   Bloco 2 mexe pesado no `useTraffikState`.
