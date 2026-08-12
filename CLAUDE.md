@AGENTS.md

# ⛔⛔ O REDESIGN NÃO MUDA FUNCIONALIDADE, CONTAS NEM LÓGICA

> **Regra do dono, 07/08/2026. Vale daqui até o fim do redesign, e vence
> qualquer outra instrução deste arquivo.**

**Tudo funciona exatamente como antes.** O redesign troca a APRESENTAÇÃO — cor,
tipografia, layout, componente, microcópia. Ele não troca o que um número vale,
o que um botão faz, nem o que uma consulta devolve.

**Mudança de comportamento só com aprovação EXPLÍCITA do dono, item a item** —
como foi no rateio de despesa recorrente e no denominador zero. Os dois foram
propostos, medidos, discutidos e aprovados um a um. Nenhum dos dois entrou "de
passagem" num commit de tela.

> ### ⛔ O PADRÃO AO ACHAR ALGO ERRADO NO CAMINHO
> **MEDE · REGISTRA · AVISA. NÃO CONSERTA.**
>
> | | |
> |---|---|
> | **Mede** | contra dado real, não por leitura do código. Se a medição contradisser a intuição, meça de novo antes de reportar |
> | **Registra** | no `CLAUDE.md` como bug conhecido, com o número medido e a decisão adiada |
> | **Avisa** | na hora, não no fim do relatório |
> | ⛔ **Não conserta** | nem "enquanto está aberto", nem "é só uma linha", nem "obviamente era isso que se queria" |

⚠️ **Por que a tentação é forte e por que ela é errada:** achar o defeito dá a
sensação de que consertar é o passo seguinte óbvio. Mas um conserto embutido num
commit de redesign muda número em produção **sem ninguém ter decidido isso**, e
some no meio de um diff que o revisor está lendo como mudança visual. O dono
descobre pelo suporte.

## ⛔ A FRONTEIRA — escrita, senão a ressalva vira brecha

**A regra congela o que existia ANTES da branch `redesign/dashboard`.**

| | |
|---|---|
| 🔒 **congelado** | cálculo, rota ou comportamento que já estava na `main`. Não muda sem aval do dono |
| ✅ **livre** | código escrito NESTA reescrita — ele não tem comportamento anterior a preservar |

Consertar defeito do trabalho novo na hora (como foi o `inicioDaFita`) **não é
exceção à regra — é o escopo dela.**

> ### 🔎 NA DÚVIDA DE QUE LADO UMA COISA CAI, `git log` NA LINHA
> ```bash
> git log -1 --format='%h %ad %s' --date=short -L <linha>,<linha>:<arquivo>
> # o ponto de corte:
> git merge-base main redesign/dashboard   # 4e6aa9e, 05/08/2026
> ```
> **Commit anterior a `4e6aa9e` → congelado.** Não é questão de julgamento sobre
> "isto parece novo": é uma consulta com resposta binária, e ela existe
> justamente para que a dúvida não seja resolvida pela conveniência de quem está
> com o arquivo aberto.

# 🧭 META-REGRA — COMO REGISTRAR UM ACHADO, PARA QUE ELE SIRVA

> **Formulação do dono, 12/08/2026.** Está no topo porque governa todo o resto
> deste arquivo — inclusive as regras que já estão escritas nele.

> ## Um caso descrito é história. Um padrão nomeado é ferramenta.

Ao registrar um achado, escreva **o PADRÃO e o sinal barato que o denuncia**, não
só o que aconteceu. **Se o registro não permite procurar pela próxima ocorrência,
ele não vai impedir nenhuma.**

### 🔬 O TESTE É OBJETIVO — e ele reprova registro bonito

O registro precisa entregar **um `grep`, uma pergunta ou uma medição**. Se
entregar só uma narrativa, reescreva.

| O registro dá… | Serve? |
|---|---|
| um `grep` que acha candidatos | ✅ |
| uma pergunta binária a fazer em cada candidato | ✅ |
| uma medição com o valor que o caso ERRADO produziria | ✅ |
| um relato do que aconteceu, por melhor escrito que seja | ⛔ **não** |

### O caso que produziu a meta-regra

`lib/financeiro.ts` documentava, desde sempre:

> *"O suporte a taxa global sempre existiu (`paymentMethod: null` usa o
> faturamento inteiro como base) — a tela é que não tinha como produzi-lo."*

A frase está correta, é clara, e **não impediu que exatamente isso se repetisse**
na reescrita da mesma tela, em 12/08/2026 — desta vez em dois campos. Porque ela
descrevia **um caso**, e um caso descrito não protege o caso seguinte: ninguém
consegue procurar por "outros lugares onde isto acontece" a partir dela.

Reescrita como padrão, ela virou *A TELA NOVA APRESENTA ESTADO QUE ELA NÃO
CONSEGUE CRIAR*, com o `grep` (os `add*`/`set*`/`create*` da tela deletada) e o
sinal barato (**helper com parâmetro que ninguém mais passa**). Foi só então que
ela achou dois campos de uma vez.

> ### ⛔ E ISTO EXPLICA POR QUE TANTA COISA SE REPETIU COM TUDO DOCUMENTADO
> Este arquivo tem centenas de casos registrados, e várias famílias mordem duas,
> três, **sete vezes**. Não é falta de registro — é registro em forma de
> história. As famílias que pararam de reincidir são exatamente as que ganharam
> ferramenta: `no-use-before-define` virou lint, "nada entra sem renderizar"
> virou tipo, "toda guarda leva linha de base" virou asserção.

⚠️ **Ao escrever "⛔ sempre faça X", pergunte na mesma frase: *como eu acho a
próxima violação disto?*** Se a resposta for "lendo com atenção", o registro
ainda não está pronto.

---

## 🎣 A FORMA DA PERGUNTA DECIDE O QUE A INVESTIGAÇÃO ACHA

> **Terceira ocorrência em uma sessão só, 12/08/2026.** É a meta-regra acima
> aplicada ao momento ANTERIOR ao registro: à pergunta que se faz ao investigar.

> ## "O X é o único?" convida a CONFIRMAR. "O que mais tem a mesma propriedade?" convida a PROCURAR.

**As duas são a mesma investigação, e acham coisas diferentes:**

| A pergunta | O que ela achou |
|---|---|
| *"o `Icone` é o único?"* | **1 arquivo** — e a resposta foi "sim", que é falsa |
| *"o que mais em `tk/` importa de `dashboard/ui/`?"* | **2 arquivos** — `Icone` (12 consumidores) e `Modal` (3) |

A primeira forma tem um alvo, e a mente vai até ele e para. A segunda tem um
CRITÉRIO, e o critério varre. É a diferença entre verificar uma hipótese e
enumerar um conjunto — e só a segunda encontra o que ninguém tinha suspeitado.

### ⚠️ E O CRITÉRIO PRECISA DAS DUAS METADES

O que varreu não foi *"importa do sistema antigo"* — foi **"importa do sistema
antigo E lê `--color-*`"**. Sem a segunda metade a lista teria **4 itens**, e
dois deles (`useOverlay`, `useTamanho`) seriam trabalho inútil: são hooks, não
carregam cor, e migrar não mudaria nada.

| Critério | Itens | Úteis |
|---|---|---|
| importa do antigo | 4 | 2 |
| importa do antigo **E** lê `--color-*` | **2** | **2** |

⛔ **Um critério largo demais não é conservador — ele é caro e desacredita a
lista.** Quem executa descobre que metade não fazia sentido e passa a duvidar da
outra metade.

> ### ⛔ A DISCIPLINA, em uma linha
> **Ao investigar, escreva o CRITÉRIO antes de escrever o `grep`** — e inclua
> nele a propriedade que faz o item IMPORTAR, não só a que o faz pertencer.

⚠️ **As outras duas ocorrências desta sessão**, pela mesma causa: *"o
`pixelConfigIds` está órfão?"* escondia *"quantos vínculos paralelos existem para
esta relação?"* (achou o par partido), e *"o `calc` falta no formulário?"*
escondia *"quais campos o servidor persiste e a tela não envia?"* (achou o
`calc` **e** o `paymentMethod`).

---

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

| Tela | ✅ feito | ❌ falta | 🔧 diverge por decisão |
|---|---|---|---|
| SHELL | 18 | — | 2 |
| DASHBOARD | 29 | — | 9 |
| INTEGRAÇÕES | 24 | — | 17 |
| REGRAS | 0 | 21 | — |
| CAMPANHAS / GERENCIADOR | 18 | 1 | 4 |
| UTM & SNIPPETS | 22 | — | 10 |
| PIXEL & EVENTOS | 28 | — | 1 |
| WEBHOOKS | 18 | — | 6 |
| CRIATIVOS | 12 | — | 3 |
| LOGIN | 14 | — | 5 |
| TAXAS E DESPESAS | 17 | — | 2 |
| ÁREAS DE TRABALHO | 14 | — | 2 |
| NOTIFICAÇÕES | 11 | — | — |
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
- 🔴 **`Workspace.*` — ESTA ENTRADA ESTAVA ERRADA E AUTORIZAVA DELETAR CÓDIGO
  VIVO.** Ela dizia *"`accountIds` / `webhookIds` / `pixelConfigIds` /
  `products` — mortos, mantidos pela regra dos dois deploys"*. **Medido em
  12/08/2026**, contando referências fora de `actions/workspaces.ts` e da view
  que morre:

  | Campo | Referências | Onde |
  |---|---|---|
  | `sources` | **21** | inclusive `dashboard/metrics.ts` — é recorte de painel |
  | `products` | **19** | idem |
  | `accountIds` | 1 | precedência de área |
  | `webhookIds` | 1 | precedência de área |
  | `pixelConfigIds` | **0** | ⚠️ escrito e sem consumidor conhecido |

  Ou seja: **dois deles são centrais ao produto**, e a documentação os declarava
  mortos. Documentação que envelhece produz confusão; esta produzia **dano** —
  qualquer faxina que confiasse nela apagaria o recorte por fonte e por produto
  do Dashboard.

  ⚠️ **Por que ela estava errada:** quase certamente foi escrita quando os quatro
  eram mesmo inertes, e nunca revisitada quando `sources`/`products` ganharam
  consumidores. É exatamente a família da **META-REGRA do topo**: o registro
  descrevia um ESTADO ("estão mortos") em vez de dar a ferramenta que o
  reconfere. Um estado registrado envelhece sozinho; uma medição, não.

  ⛔ **Ao reencontrar "está morto" neste arquivo, RECONTE antes de agir.** O
  comando é uma linha, e o custo de não rodá-lo é apagar código vivo:
  ```bash
  grep -rn "CAMPO" src/ --include=*.ts --include=*.tsx | grep -v generated/prisma | wc -l
  ```

  🔜 **O `pixelConfigIds` é o único de fato sem leitor — e o achado não é
  "remover o controle".** É **descobrir por que gravamos algo que ninguém lê**:
  um dos dois lados está errado, e remover o controle escolheria um lado sem
  medir. Decisão do dono, 12/08/2026.
- **`DashboardLayout.workspaceId` nullable** — o NOT NULL entra num 2º deploy.
- **`DashboardLayout.workspaceId` nullable** — o NOT NULL entra num 2º deploy.
- **As ações em massa, o duplicar e o excluir nunca foram exercidos.** O
  **motor de regras** foi: PAUSAR (por acidente) e **AJUSTAR_ORCAMENTO com o
  clamp** (teste dirigido), os dois em produção em 31/07/2026. Ver "O CLAMP FOI
  EXERCIDO".
- **`WebhookLog` sem retenção**, e logs sem dono não aparecem na UI.


---

# 🔤 GUARDA POR TEXTO MIRA O QUE SÓ O ERRADO TEM — o certo costuma conter a mesma sintaxe

> **Três vezes numa sessão só, em 11/08/2026.** Já não é descuido: é padrão, e
> ele tem uma forma reconhecível.

A intuição diz *"proíba a sintaxe do defeito"*. O problema é que **a chamada
correta quase sempre contém essa mesma sintaxe** — porque as duas fazem a mesma
coisa, só que uma passa pelo lugar certo.

| # | A guarda | O que ela pegou |
|---|---|---|
| 1 | `replace("<Tooltip conteudo=")` | **1 de 2** — a outra ocorrência era multilinha. O `assert` de contagem salvou |
| 2 | `!/setCarregando/` no arquivo da tela | o **comentário do próprio arquivo**, que cita o símbolo para explicar por que ele não existe |
| 3 | `!/temPixelNativo:\s*(true\|false)/` | a chamada **legítima** `responderPreset(f, { temPixelNativo: true })` |

O caso 3 é o mais instrutivo: a guarda existe para proibir atribuição direta, e
a única forma CERTA de mudar o campo é… uma atribuição, dentro do redutor. A
sintaxe é idêntica; o que difere é **onde ela está**.

> ### ⛔ AS DUAS SAÍDAS, nesta ordem
> **1. Confira por LINHA, não por substring.** Toda ocorrência da sintaxe tem de
> estar numa linha que também contenha o caminho autorizado. É preciso, e a
> falha reporta **qual linha** — em vez de só afirmar que existe.
>
> ```js
> const ofensoras = fonte.split(/\r?\n/).map((l, i) => [i + 1, l])
>   .filter(([, l]) => /ALVO/.test(l) && !/CAMINHO_AUTORIZADO/.test(l));
> assert.deepEqual(ofensoras, []);
> ```
>
> **2. Quando não der para separar por linha, mire o que SÓ O ERRADO TEM.** Não
> o que os dois compartilham. No caso 2 o alvo virou a DECLARAÇÃO
> (`const [carregando,`), que a prosa não contém.

### ⚠️ E toda guarda leva a LINHA DE BASE junto

Nos três casos a guarda podia passar sem examinar nada — arquivo vazio, símbolo
ausente, coleção sem itens. **`=== 0` passa com a coleção vazia.** Por isso a
guarda do preset afirma duas coisas antes de negar a terceira: que houve
atribuição para examinar, e que o redutor é de fato usado.

> ### 📌 RECORRÊNCIA — 12/08/2026, superfície NOVA: verificação de DOCUMENTAÇÃO
> Conferindo se três correções tinham entrado num `.md`, uma das cinco âncoras
> voltou **0** e eu quase reportei *"não entrou"*. O texto estava lá; a âncora é
> que não casava.
>
> É a mesma família, num lugar onde ninguém a esperava: até aqui ela sempre
> mordeu guarda de TESTE sobre CÓDIGO. Aqui era um `grep` de conferência sobre
> prosa que eu mesmo acabara de escrever.
>
> ⛔ **A regra não muda, o alcance sim: vale para qualquer verificação por
> casamento de texto, inclusive a que confere se a edição de um documento
> pegou.** `0` significa "a âncora não casou" — e só depois de reconferir a
> âncora ele pode significar "o texto não está lá".

⚠️ Prima direta de *EDIÇÃO POR CASAMENTO DE STRING SE VERIFICA* e de *uma
asserção precisa poder FALHAR pelo motivo que ela alega medir*. A pergunta é
sempre a mesma: **que valor o caso ERRADO produziria — e o caso CERTO produz
outro?** Se os dois produzem o mesmo, a guarda não mede nada.

---
# 🎭 ARTEFATO VÁLIDO DE CONTEXTO ERRADO É PIOR QUE ARTEFATO INVÁLIDO

> **Formulação do dono, 11/08/2026.** Extensão da regra *tela stale que ENTREGA
> artefato é armadilha* — e ela generaliza para **Webhooks**, que é a tela
> depois de Pixel/Eventos.

> ## O inválido quebra na hora. O válido instala e trabalha — e a denúncia vem de um sistema que não é o nosso, semanas depois.

| | Como se descobre |
|---|---|
| artefato **inválido** (script truncado, URL sem esquema, token vazio) | na instalação. O site quebra, o gateway recusa, alguém volta |
| artefato **válido de outro contexto** | 🔴 **não se descobre.** Ele roda, grava, dispara — no lugar errado |

### As duas formas, e elas pedem asserções DIFERENTES

| Forma | Onde já apareceu | O que a asserção prova |
|---|---|---|
| **conteúdo errado** — o artefato carrega o contexto errado dentro de si | script de UTM (embute `var WS`) | trocar o contexto muda o TEXTO do artefato |
| **contexto errado** — o artefato está certo, e é de outro dono | script de pixel (embute só o `PixelConfig.id`) | trocar o contexto muda a LISTA de artefatos alcançáveis |

⛔ **Provar a primeira não prova a segunda.** Um `grep` pelo id do contexto
dentro do artefato responde à forma 1 e é cego para a forma 2 — porque na forma
2 o id do contexto **não está lá**, por desenho.

### Por que a segunda é mais cara

Na forma 1 há um valor errado no arquivo: quem for conferir, acha. Na forma 2
**o arquivo passa em qualquer conferência** — ele é exatamente o que a
ferramenta deveria gerar, só que para outra operação.

O usuário instala o pixel da operação A na página da operação B. O script roda,
os eventos chegam, os números aparecem. **Quem denuncia é o Gerenciador de
Eventos da Meta**, que é de outra empresa, e só quando alguém for procurar.

> ### ⛔ A PERGUNTA, ANTES DE PÔR QUALQUER ARTEFATO NUMA TELA
> **"Se esta tela estiver desatualizada, o que sai daqui é INVÁLIDO ou é
> VÁLIDO-DE-OUTRO-DONO?"**
>
> Se for o segundo, a asserção não é sobre o conteúdo do artefato — é sobre a
> LISTA. E a fixture precisa de mais de um dono, senão ela passa sem exercer o
> recorte.

⚠️ **Vale para tudo que o usuário leva para fora:** script de pixel, script de
UTM, URL de webhook, chave de API, snippet, parâmetro de anúncio. O que muda de
um para o outro é só qual das duas formas ele tem.

---
# 🕳️ VÃO DENTRO DE UM CARD PROMETE CONTEÚDO. VÃO FORA NÃO PROMETE NADA.

> **Formulação do dono, 11/08/2026.** Nasceu no Builder de UTM e **não é regra
> do Builder** — ela decide qualquer vão que apareça nas telas que faltam.

Não existe arranjo com zero vão numa fileira de cards: a altura da fileira é a
da coluna mais alta, e conteúdos de tamanhos diferentes não terminam juntos.
**O que se escolhe é ONDE o vão fica** — e as duas escolhas não são
equivalentes:

| Onde | Como se lê |
|---|---|
| **fora** do card — borda de baixo irregular | **ausência.** Não afirma nada: é o retrato de conteúdos de tamanhos diferentes |
| **dentro** do card | 🔴 **promessa.** O olho lê *"aqui cabia algo que não veio"* |

### ⚖️ A EXCEÇÃO TEM CRITÉRIO, E O CRITÉRIO É O CHÃO

> ## A pergunta não é QUANTO vão. É O QUE ESTÁ EMBAIXO DELE.

| O que há sob o vão | Leitura |
|---|---|
| **barra de ação** (Salvar, Gerar, Aplicar) | ✅ rodapé de formulário — o vão é respiro |
| **mais conteúdo** | 🔴 promessa não cumprida — parece que faltou carregar |
| **nada** (fim do card) | ✅ o card acabou |

**Mesma quantidade de pixels, duas leituras.** No caso que produziu a regra, os
mesmos ~130px liam como rodapé no `Gerador` (que tem `Limpar campos` / `Gerar
URL` embaixo) e como conteúdo faltando no `URL gerada` (que tinha chips em cima
e `Salvar como modelo` embaixo).

⚠️ **É a mesma decisão do `alignSelf: start` do bloco vazio do Dashboard**, e o
argumento é o do dono: *alinhamento é estética da linha; espaço morto é a tela
AFIRMANDO que ali cabia algo.*

⛔ Esta regra já foi violada uma vez, por mim, em 11/08/2026 — eu fechei a borda
irregular com `alignItems: stretch` e empurrei o vão para dentro dos cards. Só o
print resolveu. **Alinhar a borda de baixo não é um objetivo**; é o que se
sacrifica quando as alternativas são piores.

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

# 📌 ESTADO DA SESSÃO — 07/08/2026 (funil, ROAS e a regra do congelamento)

> **Mais nova que tudo acima.** Se contradisser, ela vence.
>
> ⛔ **NADA FOI PARA O GITHUB.** `main` intacta, **60 commits locais** em
> `redesign/dashboard` esperando decisão do dono. Ponto de corte da branch:
> `4e6aa9e`, 05/08/2026.

## 🥇 A REGRA QUE GOVERNA O RESTO DO REDESIGN

**O redesign não muda funcionalidade, contas nem lógica.** Está no TOPO deste
arquivo, com a fronteira escrita (`git log` na linha; commit anterior a
`4e6aa9e` é congelado). Ao achar defeito: **MEDE · REGISTRA · AVISA. NÃO
CONSERTA.**

Primeira aplicação dela foi o ROAS, na mesma sessão.

## ✅ O FUNIL FECHOU — 9ª versão, e ela veio de TIRAR coisas

| | |
|---|---|
| **8ª** (`4174413`) | `Cliques` sai da GEOMETRIA. Dois sistemas de medição (Meta × nosso `Click`) na mesma escala faziam a instalação quebrada engolir a figura do comportamento. Amplitude das 4 etapas finais: **0,8px → 105,6px** a 2,9% de cobertura |
| **9ª** (`2f76759`) | **uma fita só, contínua.** A hachura do "não medido" saiu — ela partia a figura em três objetos. A informação virou **guia tracejada + `* não medido` no rótulo**, com a palavra visível (não só no `title`) |

**A cobertura mora no vão antes da fita**, com número grande e cor de atenção
abaixo de **25%** — limiar calibrado para o denominador que TEMOS (`clicks` da
Meta, que conta todo clique no anúncio). ⚠️ **Ele precisa SUBIR para ~75% no dia
em que virar `link_clicks`**, e isso está escrito na constante.

## 🐛 O ROAS — medido, declarado, NÃO corrigido

Dashboard: **3,54x**. Real da Meta: **0,71x**. Numerador de todos os canais,
denominador só da Meta. Detalhe completo na seção própria.

✅ **Decisão do dono: a conta não muda.** A tela ganhou a linha
`receita de todos os canais ÷ gasto da Meta` (`DadosKpi.base`, genérico — o CPA
tem a mesma forma quando alguém medir).

⛔ **O ROAS por campanha (`overview.ts:393`) NÃO tem o defeito** e alimenta o
Insights do Gerenciador. Eu travei o Gerenciador citando o defeito errado; o
dono corrigiu. **Não unifique os dois.**

## 📋 Regras novas registradas

| Seção | O que |
|---|---|
| 📐 **Dois instrumentos não se comparam** | a razão entre medições de sistemas diferentes mede CONCORDÂNCIA, não fenômeno. Tabela de onde reaparece |
| 🔤 **Bug por ambiguidade de NOME** | `inicioDaFita` = centro da etapa **ou** borda da área. O 1º desta base que não é de lógica |
| 🟩💀 **Teste verde sobre caminho morto** | a varredura de órfãos inclui os TESTES deles |
| 🔬 **Direção na asserção diferencial** | "não acrescenta" (`<=`) ≠ "é igual" (`===`) |
| 🌱 **O que falta no seed do funil** | não é reetiquetar fonte, é criar jornada com checkout |

## ➡️ PRÓXIMO, na ordem do dono

1. **Varredura por arquivo do `06`** — não começou.
2. **Gerenciador / Campanhas** — não começou. As três perguntas de sempre antes
   de codificar.

**Levantamento já feito:** 2.751 linhas (`overview.ts` 492 · `AdsManagerView`
490 · `AdsTable` 447 · `AdsActionBar` 298 · `veiculacao.ts` 239 · `creatives.ts`
204 · `NovaCampanhaModal` 125 · `metrics.ts` 98). O `04` tem **18 itens, todos
❌** + 1 🔧.

**Onde eu suspeito que estoura** — as três, e nenhuma é o ROAS:

- **`AdsTable` com ~20 colunas.** Colunas congeladas + conjuntos nomeados é a
  única parte do plano **sem modelo na referência**.
- **`Distribuição por plataforma`** está 🔧 fora por a ferramenta ser
  mono-plataforma — mas as vendas têm **4 `utmSource`**. Suspeito que o item
  seja sobre ORIGEM DE TRÁFEGO e tenha sido descartado pelo motivo errado. É
  medição, não opinião.
- **`Linhas de rascunho com — nas métricas`** é "não medido ≠ zero" na tabela.
  Conferir se `veiculacao.ts` já separa rascunho de pausado.

---

# 📌 ESTADO DA SESSÃO — 07/08/2026 (preparação do Gerenciador)

> **A mais nova. Se contradisser qualquer coisa acima, ela vence.**
>
> ⛔ **NADA FOI PARA O GITHUB.** `main` intacta, **11 commits locais** em
> `redesign/dashboard`. O push é decisão do dono, e ele não a tomou.

## ✅ A PRÓXIMA SESSÃO CONSTRÓI O GERENCIADOR — e construiu, em 07–08/08

> **RESOLVIDO.** A tela existe desde 08/08/2026 (`GerenciadorScreen`, 925
> linhas). O que segue abaixo é o inventário de PREPARAÇÃO que ela consumiu, e
> continua útil como referência do que já estava pronto — mas **não leia como
> tarefa pendente**. O estado de hoje é a seção de **08/08** no fim do arquivo.

Decisão do dono, e o motivo está na seção **MODO DE TRABALHO ATÉ AS DEZ TELAS
EXISTIREM**, no fim deste arquivo. Leia-a antes de começar — ela muda o que
fazer com uma descoberta no meio do caminho.

**Está tudo pronto para desenhar:**

| | |
|---|---|
| `CampaignRow.medicao` | os **três** estados, com `test:medicao` (9 asserções, no `test:banco`) |
| `CampaignRow.objective` | chega à tela; `AdRow`/`AdSetRow` herdam da campanha |
| Insights | especificado: os 4 cartões filtram por **`effectiveStatus`**, não por `status`. O 5º cartão (melhor ROAS pausada) é condicional e sai da mesma lista |
| `04`, seção CAMPANHAS | 15 ❌ e 5 🔧, todos com motivo escrito |
| dev | 12 campanhas · 4 status · 1 nunca sincronizada e sem métrica · 14 checkouts de navegador + 24 de gateway |

⚠️ **Onde eu suspeito que estoura** continua sendo `AdsTable` com ~20 colunas —
conjuntos nomeados e colunas congeladas são a única parte do plano **sem modelo
na referência**. Avise antes de improvisar ali.

## ✅ O que ficou pronto

| | |
|---|---|
| ✅ | **`--tk-altura-controle` passou a controlar os 5 controles do header.** 4 traziam `height: 32` na mão e concordavam por coincidência (`:root` vale 32). Provado nos dois: 32 no padrão, **40 no `comfortable`**, `top` idêntico nos cinco |
| ✅ | **`no-use-before-define` LIGADA**, e as **53 violações CONSERTADAS** (5 símbolos, todos desta branch). Lint sai com 0 erros |
| ✅ | **Os três estados de medição** no `CampaignRow` — `sumAds` intocado, é fato sobre existência de linha |
| ✅ | **O funil não desenha mais gravata-borboleta** — etapa zero com posterior positiva vira "não medida" e a fita interpola |
| ✅ | **`dev:campanhas`** — 12 campanhas com estado, receita, e checkout nos dois ramos |
| ✅ | **`docs:estado`** só conta tabela de item e morre se uma seção perder todas. ⚠️ O carimbo de data que ele ganhou aqui **foi REMOVIDO em 08/08** — trocar UTC pelo dia de São Paulo consertou a janela das 21h e deixou a origem em pé; o bloco continuava reprovando sozinho à meia-noite |
| ✅ | **`.gitattributes`** — resolve 1 dos 3 sintomas de CRLF; os outros dois estão explicados nele |

## 🐛 O que eu quebrei e consertei nesta sessão

**Vale mais que a lista de acertos**, porque três dos quatro passaram por `tsc`,
`lint` e `build`:

| | |
|---|---|
| **TDZ ×2 no `overview.ts`** | `campaignObjectiveById` e `medicaoDe` declarados abaixo de quem os consome. A 1ª derrubou a `/api/ads` com **500 de corpo vazio**; a 2ª foi o teste que pegou. É o que motivou ligar o lint |
| **Renomear campanha zerou a receita de 2** | `splitPipe` descarta id não numérico, então o dev sempre atribuiu por NOME. Expôs que **o ramo do ID nunca foi percorrido no dev** |
| **`teste-medicao` comeu o seed** | apagava métrica que não criou. Virou regra própria |
| **2 edições por casamento de string que não pegaram** | a do `eslint.config.mjs` (quase reportei silêncio como medição) e o `console.log` do seed — este último **denunciado pelo lint novo**, duas variáveis contadas e nunca lidas |

## 🕳️ O que ficou devendo

- ~~**A tela do Gerenciador.** Terceira sessão seguida em que a preparação
  consumiu tudo~~ → ✅ **construída em 08/08/2026.** A quarta foi a que nasceu.
- **4 advertências de `no-unused-vars`** (`i` não usado em `.map`), em
  `VisaoGeralScreen` ×3 e `FeedVendas`. Pré-existentes, triviais.
- A lista **ACHADOS ADIADOS**, no fim deste arquivo, com 9 itens medidos.

---

# 📌 ESTADO DA SESSÃO — 07/08/2026 (acabamento)

> Substitui a seção anterior de 07/08, que descrevia o estado no COMEÇO do dia.
> Tudo é commit LOCAL em `redesign/dashboard`. **A `main` está intacta e nada foi
> para o GitHub.**

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

## ✅ PRÓXIMO ERA Gerenciador / Campanhas — feito em 08/08/2026

> **Não é mais o próximo.** Ficou aqui porque o raciocínio abaixo é o que guiou
> a construção. O próximo de verdade está na seção de **08/08**, no fim.

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

# ✋ EDIÇÃO POR CASAMENTO DE STRING SE VERIFICA. SEMPRE.

> **O pior defeito desta base não é o que quebra — é o que MENTE PARA A
> VERIFICAÇÃO.** Registrado em 07/08/2026, e o caso é meu.

Eu editei o `eslint.config.mjs` com um `replace` de string, medi o resultado e
ia reportar **"zero erros com a regra ligada"**. A edição não tinha pegado — o
arquivo está em CRLF e meu padrão tinha `\n`. O `replace` não casou, não
reclamou, e devolveu o arquivo intacto.

**A medição seguinte mediu o silêncio e eu quase o chamei de resultado.**

| | |
|---|---|
| ✅ o que salvou | `--print-config`, que responde *"a regra está no config efetivo?"* |
| ❌ o que não salvaria | rodar o lint e ver "0 problemas" — é o mesmo resultado dos dois estados |

> ### ⛔ A REGRA
> **Depois de toda edição por casamento de string, LEIA o resultado.** Não o
> efeito — o resultado: o arquivo mudou, o símbolo está lá, o config efetivo
> contém a chave.
>
> E ao escrever o casamento, **afirme que ele casou**: `assert s.count(alvo)==1`
> antes de substituir. Um `replace` que não acha nada é indistinguível de um que
> achou e substituiu por igual.

⚠️ **É prima da "asserção que não pode falhar"**, e a pergunta é a mesma: *que
valor o caso ERRADO produziria?* Se "não editei" e "editei" produzem a mesma
saída na sua verificação, você não está verificando nada.

⚠️ E o gatilho concreto neste repositório: **402 arquivos versionados estão em
CRLF**. Todo padrão multilinha ancorado em `\n` falha em silêncio neles. O
`.gitattributes` declara a normalização, mas **não conserta isto** — a árvore
de trabalho continua CRLF de propósito.

# 🧪 TESTE QUE ESCREVE NO BANCO DE DEV SÓ APAGA O QUE ELE MESMO CRIOU

> **É o gerador de estado errado, na camada de VERIFICAÇÃO — e por isso pior.**
> 07/08/2026.

`teste-medicao.mjs` limpava as métricas das campanhas que ia usar, e restaurava
só as linhas que ele próprio havia inserido. Rodou duas vezes e **comeu o seed
de 3 campanhas**: elas passaram a mostrar `—` no Gerenciador, e o contador do
seed foi de 1 para 4 "sem métrica".

### Por que é pior que um seed ruim

Um seed ruim produz um estado que alguém pode desconfiar. Um teste que estraga
o banco produz um estado que **ninguém liga ao teste**: a próxima pessoa abre a
tela, vê o que a verificação deixou para trás, e conclui sobre o PRODUTO.

> ### ⛔ A REGRA
> **Teste que escreve no banco compartilhado só apaga o que ele mesmo criou, e
> só o que criou NESTA execução.** Precisar limpar linha alheia é o sinal de que
> o fixture deveria criar as próprias.
>
> Quando o teste precisar mesmo remover algo que já existia — porque o caso a
> exercitar é a ausência —, ele **guarda a linha e reinsere com o MESMO id**.
> Reinserir com id novo deixa órfã na segunda execução.

⚠️ **Prove o restauro rodando duas vezes seguidas.** Um teste que passa na
primeira e falha na segunda tem restauro quebrado; um que passa nas duas mas
deixa lixo só aparece na tela, dias depois.

# 🤫 AS TRÊS FORMAS DO MESMO SILÊNCIO — teste que não existe

> Elas já apareceram separadas. Juntas, o padrão fica visível: **em nenhuma das
> três a suíte fica vermelha. Nas três ela AFIRMA que está tudo coberto.**

| # | Forma | O que a suíte reporta |
|---|---|---|
| 1 | **script fora do agregado** (`teste-fita`) | nada — ninguém o invoca |
| 2 | **teste verde sobre caminho morto** (`perdaLabel`) | ✅ sobre símbolo com zero chamadores de produção |
| 3 | **`checar()` depois do `process.exit`** | ✅ **29 asserções**, com três nunca alcançadas |

A terceira nasceu em 07/08/2026 e é a mais difícil de ver: o arquivo **está** no
agregado, **roda**, e o que ele mede **importa**. As asserções foram escritas no
fim do arquivo, depois da linha que encerra o processo. Elas nunca executaram, e
o número no rodapé subiu com confiança para 29 — parecendo cobertura.

> ### ⛔ O QUE RESPONDE ÀS TRÊS
> **Escreva a asserção, rode, e CONFIRA QUE O NOME DELA APARECEU NA SAÍDA.** Não
> o total; o nome. Os três casos passam por qualquer verificação baseada em
> "ficou verde" e em "o número subiu".

⚠️ Ao acrescentar asserção num arquivo existente, **olhe onde o arquivo
termina**. Vários scripts desta base fecham com `console.log` de resumo +
`process.exit`, e o que vem depois é código morto com sintaxe de teste.

# 🕐 A REGRA DO FUSO PEGOU O PRÓPRIO GERADOR DE DOCUMENTAÇÃO

`gerar-estado.mjs` carimbava `Última geração:` com
`new Date().toISOString()` — **o dia em UTC**. Às 21:13 em Brasília já é o dia
seguinte lá: o carimbo mudou sozinho, o `--conferir` passou a acusar
"desatualizado", e o `npm test` ficou **vermelho sem ninguém ter tocado em
nada**.

É a janela exata que o próprio CLAUDE.md documenta ("um teste que falha só
depois das 21h é pior que um que falha sempre"), falhando num script cuja única
função é manter a documentação honesta.

> ### ⛔ VALE PARA GERADOR DE DOCUMENTAÇÃO IGUAL
> "Nenhuma agregação usa o dia do PROCESSO" não é regra de métrica — é regra de
> **qualquer carimbo de data que entre num arquivo versionado**. Se o valor
> gravado muda sozinho às 21h, ele não descreve nada; ele só produz diff.

# 🌗 SEED QUE PRODUZ ESTADO **INCOMPLETO** — o ramo que nunca foi percorrido

> **A agravante sobre a família do gerador: aqui o seed não produzia estado
> ERRADO. Produzia estado INCOMPLETO.** O código funcionava, os testes passavam,
> e metade do caminho nunca tinha sido exercida. 07/08/2026.

O caso, achado ao dar estado às campanhas do dev:

`splitPipe` (`lib/utm/parse.ts:72`) **descarta id não numérico** — a Meta usa
inteiros longos, e um `camp-dev-A` é indistinguível de placeholder não
substituído (`{{campaign.id}}`). O `seed-dev.mjs` gravava exatamente
`fbCampaignId = 'camp-dev-A'`.

Consequência: `camp.id` saía `null` e **toda** atribuição venda→campanha do dev
caía no ramo do **NOME** (`resultsByName`, `overview.ts`). O ramo do **ID** — que
é o que roda em produção, e que o **Bloco 11 inteiro existe para tornar
confiável** — nunca foi percorrido nem uma vez.

### Por que isto engana diferente do estado errado

| | O que se vê | Como se descobre |
|---|---|---|
| estado **errado** | número implausível, tela esquisita | alguém olha e desconfia |
| estado **incompleto** | **tudo certo** — o ramo exercido funciona | 🔴 **só por acidente** |

Este foi descoberto porque renomear as campanhas zerou o faturamento das duas
originais. Se eu não tivesse renomeado, seguiria escondido — e a dívida técnica
nº 3 ("atribuição por nome é ambígua") continuaria sendo a única coisa que o dev
sabia fazer, enquanto a documentação afirmava que o id resolve.

> ### ⛔ A PERGUNTA QUE GENERALIZA
> Não é *"o seed produz o estado certo?"* — é **"quais RAMOS o seed nunca faz o
> código percorrer?"**
>
> Todo `if/else` sobre a forma de um dado (id × nome, com clique × órfã, com
> pixel × sem) é um ramo que o dev pode nunca visitar. E um ramo nunca visitado
> em desenvolvimento é indistinguível de um ramo correto.

⚠️ **Suspeitas levantadas e NÃO investigadas** (07/08/2026, a pedido do dono —
são hipóteses, não medições):

| Ramo | Por que suspeito |
|---|---|
| `matchClick` por **IP** | o seed liga venda→clique por `clickId` direto; `matchMethod: "ip"` provavelmente nunca dispara |
| Venda **órfã** de clique | há `test:utm-orfa`, mas o seed do dev normal parece sempre ter clique |
| `Sale.utm*` **próprios** × fallback do clique | as 35 originais têm `Sale.utmSource` NULL — só o ramo do fallback roda |
| `checkoutSource: "navegador"` | já registrado: **0 `Click` com `checkoutAt`** no dev |
| `apiCredentialId` | `ApiCredential` tem zero linhas; o passo 4 da precedência de área nunca dispara |
| Gateway ≠ Kirvano | `Sale.platform` é NULL em todas as 35 |

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

# 🛡️ "NÃO QUEBRA" NÃO É "NÃO PODE QUEBRAR" — a proteção acidental

> **A lição das 53 violações de `no-use-before-define`**, e ela generaliza para
> muito além de TDZ. 07/08/2026.

As cinco declarações que a regra acusou (`HERO_PADRAO`, `MAX_FAIXA`,
`COLUNAS_ANTIGAS`, `mono`, `celula`) estavam **abaixo de quem as consome** — uma
delas por ~950 linhas. E nenhuma quebrava.

O motivo: o consumo mora **dentro de função**, e função só roda depois de o
módulo terminar de carregar. A zona morta temporal já acabou quando alguém
chama.

> ### 🔴 ISSO NÃO É ESTAR CERTO. É ESTAR PROTEGIDO POR ACIDENTE.
> A propriedade que segurava não era "a declaração vem antes", era "ninguém
> avalia isto no corpo do módulo" — e **ninguém a escreveu em lugar nenhum**.
> Ela some no primeiro commit que calcular um valor fora de função.
>
> Que é **literalmente o que aconteceu duas vezes no `overview.ts` na mesma
> sessão**: `campaignObjectiveById` e `medicaoDe`, os dois consumidos num
> `.map()` no corpo da função, os dois estourando `Cannot access … before
> initialization`. `tsc` verde nas duas.

| | |
|---|---|
| **não quebra** | há um caminho em que dá certo, e é o que se está exercitando |
| **não pode quebrar** | não existe caminho em que dá errado |

⛔ **Ao encontrar código que "funciona", pergunte QUAL PROPRIEDADE o faz
funcionar — e se ela está escrita.** Se não estiver, ou você a escreve, ou põe
uma ferramenta para cobrá-la. Aqui foi a segunda: o lint garante a segunda
coluna, e não depende de ninguém lembrar.

⚠️ É a mesma família da **cicatriz que virou anatomia** e da **proteção por
TIMING, não por estrutura** (`elapsed()`). Nas três, o que segura é uma
circunstância — e circunstância não é contrato.

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

# ⚙️ ESTADO CONFIGURADO × ESTADO EFETIVO — toda decisão sobre "está rodando?" lê o EFETIVO

> **Caso particular dos DOIS INSTRUMENTOS, e o mais caro:** `status` e
> `effectiveStatus` são duas medições da mesma pergunta, e discordam com
> frequência. 07/08/2026.

| | fonte | responde |
|---|---|---|
| **`status`** | o que o usuário CONFIGUROU (`ACTIVE`, `PAUSED`, `ARCHIVED`) | *"o que ele quis?"* |
| **`effectiveStatus`** | o que a Meta está de fato ENTREGANDO | *"está rodando?"* |

O caso que produziu a regra: `Retargeting 7d` tem **11,10x** de ROAS com
`status: ACTIVE` e `effectiveStatus: CAMPAIGN_PAUSED`. Um painel de Insights
filtrando por `status === "ACTIVE"` recomendaria **escalar a campanha que não
entrega** — exatamente a única que ele não deve recomendar.

> ⚠️ **Esta linha dizia "o melhor ROAS da tela" até 08/08/2026, e deixou de ser
> verdade** quando o `dev:campanhas` trouxe a `Black Friday 24 — Conversão`, que
> mede **17,59x veiculando**. Medido na tela: hoje a melhor da tela entrega, e
> por isso o 5º cartão do Insights (*"a melhor da tela não está entregando"*)
> **não aparece no dev** — corretamente, porque `insights.ts:170` exige
> `melhorParada > melhorVeiculando`.
>
> ⛔ **A regra não depende desse número.** O que a sustenta é as duas colunas
> discordarem, e elas discordam do mesmo jeito com qualquer ROAS. Corrigido aqui
> porque documentação que afirma um dado que o banco não diz mais é a família
> que esta base já pagou nove vezes — e a próxima pessoa iria procurar no dev um
> estado que não existe.

> ### ⛔ A REGRA
> **Decisão** (recomendar, alertar, ranquear, agir) → **`effectiveStatus`**.
> **Exibição do que o usuário escolheu** (o toggle, o que gravar na Graph API) →
> **`status`**.

### A varredura de 07/08/2026: **11 pontos, 10 defensáveis**

| Onde | Lê `status` para | |
|---|---|---|
| `api/ads/status/route.ts` · `AdsTable:357` | alternar / mostrar o configurado | ✅ é a pergunta certa |
| `veiculacao.ts` ×3 | **calcular a divergência** | ✅ precisa dos dois, por desenho |
| `rules/engine.ts` ×2 | "já pausada" / "já ativa" | ✅ evita chamada no-op à Graph API, que opera no configurado |
| `lib/ads/status.ts` ×2 · `useTraffikState:1172` | filtro **Ativas/Pausadas** | ⚠️ ambíguo — ver abaixo |

⚠️ **O filtro "Ativas" lista o CONFIGURADO**, incluindo o que não entrega. É o
que o Gerenciador da Meta faz, e é anterior a `4e6aa9e` — **medido, registrado,
NÃO consertado**.

> ### 🔴 QUEM FOR REABRIR AQUELE FILTRO PRECISA SABER DISTO
> **O Insights escolheu o EFETIVO de propósito**, e é a mesma ambiguidade. Se um
> dia alguém "unificar" os dois para eliminar a divergência, o lado que perde é
> o Insights — e o defeito volta no lugar onde ele custa dinheiro, porque lá o
> produto RECOMENDA em vez de listar.

# 🧾 FERRAMENTA QUE GERA RELATÓRIO SE VALIDA CONTRA UM BASELINE CONHECIDO

> **Ela reporta errado com a mesma confiança com que reporta certo.** Método,
> não caso — registrado em 07/08/2026.

Ao apertar a regra do `docs:estado` para ele parar de contar tabela explicativa,
o **DASHBOARD despencou de 29 ✅ para 6**, em silêncio. A causa era boba (a
tabela maior daquela seção usa `| Elemento | |` e a regra exigia
`| Elemento | Status |`), mas o número errado **já tinha sido escrito no
`CLAUDE.md`** antes de alguém olhar.

Nada denunciava: o script rodou sem erro, imprimiu `✓ regenerado — 8 telas`, e
`6` é um número perfeitamente plausível para uma tela.

> ### ⛔ O QUE PEGOU
> Comparar a saída com a **versão anterior conhecida**:
> ```bash
> git show <commit-antes-da-mudança>:CLAUDE.md | sed -n '/^| Tela |/,/^$/p'
> ```
> As sete seções que eu **não** havia tocado tinham de sair idênticas. A única
> que mudou era a única que devia mudar.

**A pergunta que generaliza:** *que parte desta saída eu sei que NÃO deveria
mudar?* Se a resposta for "nenhuma", não há como validar a ferramenta — e aí o
relatório é uma afirmação sem testemunha.

⚠️ E prefira **ancorar no que já é convenção** a inventar marcador novo. O
cabeçalho `| Elemento |` já existia nas 15 tabelas; um marcador novo valeria só
para quem lembrasse de pôr, e a tabela sem ele voltaria a contar errado — em
silêncio, de novo.

# 📐 DOIS INSTRUMENTOS NÃO SE COMPARAM — a razão entre eles não é conversão

> **A regra:** antes de pôr dois números na mesma geometria — mesma escala,
> mesma linha, mesma razão, mesma barra —, pergunte **se eles vêm do mesmo
> instrumento**. Se não vierem, a razão entre eles não mede um fenômeno do
> negócio: mede a **CONCORDÂNCIA ENTRE DOIS SISTEMAS DE MEDIÇÃO**.
>
> Formulação do dono, 07/08/2026. Nasceu no funil e **não é regra do funil**.

O caso que a produziu: `Cliques` vem do `DailyAdMetric` (a **Meta**) e `Sessões`
vem da nossa tabela `Click` (**nosso script**). Postos na mesma fita, a queda de
97,1% entre os dois lia como abandono de comprador. Não era: era instalação.

⚠️ **E o denominador ainda é pior do que parecia.** O campo sincronizado é o
`clicks` da Meta — TODOS os cliques no anúncio, não só os de link: reação,
comentário, compartilhamento, toque no nome da página, "ver mais". Ou seja, os
dois instrumentos nem contam o mesmo TIPO de evento.

| Pergunta | |
|---|---|
| ✅ mede um fenômeno | as duas pontas saem da MESMA fonte |
| 🔴 mede concordância | cada ponta sai de um sistema diferente |

### Onde ela reaparece nesta base — e a próxima é o GERENCIADOR

| Par | Instrumento A | Instrumento B |
|---|---|---|
| **ROAS / CPA / ROI** | `spend` da **Meta** | receita do **gateway** |
| Funil `Cliques → Sessões` | `clicks` da Meta | nossa tabela `Click` |
| Taxa de aprovação | gateway | gateway ✅ mesmo instrumento |
| Funil `ICs → Vendas Inic.` | derivado da venda | a venda ⚠️ pior: tautologia |

🔴 **O ROAS é o número mais usado da ferramenta e é um par de instrumentos
diferentes.** Ele não é "errado" por isso — é o padrão do mercado —, mas toda
afirmação construída em cima dele herda a discordância, e o painel de Insights
do Gerenciador vai construir afirmações em cima dele.

> ### ⛔ O QUE FAZER, JÁ QUE NÃO DÁ PARA NÃO COMPARAR
> Não é proibir a razão — é **declarar a base**. Onde a discordância for grande
> e mensurável, o produto mostra a cobertura ao lado do número, como o funil
> passou a fazer. O erro não é dividir; é dividir **em silêncio**.

⚠️ **O sintoma é sempre o mesmo:** a razão fica extrema (perto de 0 ou de ∞) e
ninguém consegue explicar por quê olhando o negócio. Quando isso acontecer, a
primeira pergunta não é "o cálculo está certo?" — é **"esses dois números vêm do
mesmo lugar?"**.

# 🐛 BUG CONHECIDO: o ROAS do DASHBOARD mistura populações

> **Medido em 07/08/2026 contra o banco de dev. Decisão do dono: NÃO ALTERAR o
> cálculo no redesign.** É a primeira aplicação da regra do topo deste arquivo.

`metrics.ts:729` faz `revenue / spend`, e as duas pontas vêm de populações
diferentes:

| | |
|---|---|
| numerador | **todas** as vendas aprovadas — organico, Google, TikTok, Meta |
| denominador | `DailyAdMetric.spend`, que é **só Meta** |

### O número medido

| origem | vendas | receita |
|---|---|---|
| organico | 3 | R$ 1.044,28 |
| google | 7 | R$ 795,32 |
| **facebook** | **11** | **R$ 566,56** |
| tiktok | 4 | R$ 424,99 |

```
ROAS que a tela mostra  (TUDO / gasto Meta) ... 3,54x
ROAS real da Meta       (Meta / gasto Meta) ... 0,71x
```

🔴 **Inflação de 5×, e ela CRUZA O 1,0x** — a linha entre "o anúncio se paga" e
"o anúncio dá prejuízo". A tela diz 3,54x enquanto a campanha perde dinheiro.

⚠️ **O tamanho do erro é propriedade da CONTA, não do código:** ele é
proporcional a quanto da receita do cliente **não** vem da Meta. Numa conta que
só roda Meta, some. Numa com metade orgânica, dobra.

> ### ✅ A DECISÃO: declarar a base, não mexer na conta
> O número fica. A tela passa a dizer o que ele cobre, exatamente como o funil
> declara a cobertura de rastreamento:
>
> ```
> ROAS 3,54x
> receita de todos os canais ÷ gasto da Meta
> ```
>
> Sem cor de alarme e sem juízo — só qual população está em cima e qual embaixo.
> **O usuário não pode ler um número sem saber o que ele mede.**
>
> 🔜 **Reabrir quando a segunda plataforma existir.** Hoje "gasto" e "Meta" são
> sinônimos nesta base, e é isso que torna o erro invisível.

### ⛔ O ROAS POR CAMPANHA ESTÁ CERTO — não "unifique" os dois

`overview.ts:393` divide a receita **atribuída àquela campanha** pelo gasto
**daquela campanha**. Mesma população nos dois lados. É ele que alimenta a
tabela do Gerenciador e os 4 cartões de `Insights`.

⚠️ **Os dois ROAS têm o mesmo nome e contratos diferentes, de propósito.**
Quem um dia "unificar" para eliminar a duplicação vai reintroduzir a mistura no
lugar onde ela é mais cara — o Insights faz *recomendação*, não só exibe número.

# 🔤 O BUG QUE NASCEU DE UMA AMBIGUIDADE DE NOME, não de lógica

> **O primeiro desta base.** 07/08/2026. Registrado porque o modo de falha não
> se parece com nenhum dos outros: o código estava logicamente correto em cada
> linha, e mesmo assim desenhava errado.

`FitaFunil` tinha `inicioDaFita`. Em português isso é **"onde a fita começa"** —
e essa frase tem duas leituras que em pixels são lugares diferentes:

| leitura | valor |
|---|---|
| o **centro** da primeira etapa desenhada | `x` de `Sessões` |
| a **borda** da área onde a fita é plotada | limite entre as colunas |

Enquanto só existia uma delas, o nome servia. No instante em que a fita passou a
nascer na BORDA, o identificador antigo continuou existindo com a outra
semântica — e a largura da faixa de cobertura, que ainda o usava, passou a
correr **por baixo da fita**.

⚠️ **Nenhuma ferramenta podia pegar:** os dois são `number`, os dois são
coordenadas x válidas, e a conta `inicioDaFita - MARGEM_X * 2` continuou
compilando e produzindo um número plausível. Só a tela mostrou.

> ### ⛔ A REGRA
> **Quando um conceito ganhar uma segunda encarnação, RENOMEIE a primeira no
> mesmo commit.** Não basta criar o nome novo ao lado: o nome antigo, que antes
> era exato, vira ambíguo no instante em que o segundo existe — e todo chamador
> dele passa a estar apostando numa das duas leituras sem dizer qual.
>
> Hoje são `inicioDaFita` (centro da etapa) e `inicioDaPlotagem` (borda da
> área), com a distinção escrita na linha que usa cada um.

⚠️ É primo do `?? 0` e do empurrãozinho de 2px: os três compilam, os três
parecem cuidado, e os três só aparecem na tela. A diferença é que este não tem
nem uma linha suspeita para procurar — **a linha errada é idêntica à certa.**

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

---

# 🚧 MODO DE TRABALHO ATÉ AS DEZ TELAS EXISTIREM — 07/08/2026

> **Decisão do dono, depois de TRÊS sessões seguidas em que a preparação
> consumiu a sessão inteira e nenhuma tela nasceu.**

**Cada sessão constrói UMA TELA, do começo ao fim.** Descoberta que aparecer no
caminho e **não bloquear a tela** vira uma linha em *ACHADOS ADIADOS*, abaixo, e
o trabalho segue. Não investiga, não mede, não varre.

### ⛔ Só estas três coisas param a tela

| | |
|---|---|
| 1 | **defeito que impede a tela de funcionar** |
| 2 | **dado que não existe** e é preciso para desenhar |
| 3 | **duas tentativas sem resolver** — aí para e avisa |

> ### 🔴 O QUE ISTO **NÃO** MUDA
> **A regra de medir antes de afirmar continua inteira.** Nada aqui autoriza
> reportar como feito o que não foi visto, nem dizer que algo funciona sem
> exercer. O que muda é o que fazer **depois de medir**: registrar em vez de
> perseguir.
>
> Medir custa minutos; perseguir custa a sessão. Foi perseguir que gastou as
> três.

⚠️ E a lista abaixo **não é lixo**. Ela é varrida quando as dez telas existirem
— um item nela é trabalho decidido e adiado, não trabalho esquecido. Cada linha
leva o que foi MEDIDO, para ninguém ter de medir de novo.

## 📋 ACHADOS ADIADOS

| Achado | O que já se sabe |
|---|---|
| **Filtro `Ativas` lê o status CONFIGURADO** | `lib/ads/status.ts:32` e `useTraffikState:1172`. Lista campanha que não entrega. É o que o Gerenciador da Meta faz, e é anterior a `4e6aa9e`. ⛔ O Insights escolheu o EFETIVO de propósito — quem unificar os dois reintroduz o defeito onde ele recomenda |
| **Varredura de comentários que afirmam efeito** | 5 casos documentados, o resto nunca varrido. O `grep` inicial é por verbo no presente descrevendo o que o código faz |
| **`docs:estado`: seção com 2 tabelas que perde 1** | a guarda só pega quem perde TODAS. Cobrir exigiria saber quantas cada seção deve ter — lista à mão, que envelhece |
| **Largura mínima / viewport estreito** | o `resize_window` do MCP mentiu duas vezes. Bloqueio de AMBIENTE, não de código |
| **4 views legadas de Integrações** | `Anuncios` 322 · `Pixel` 1.181 · `UTMs` 397 · `Webhooks` 532. Não auditadas de propósito: vão ser deletadas |
| **`PixelView` com 2 `elapsed()` crus** | linhas 272 e 294. Morre na reescrita daquela tela |
| **Ramos que o seed do dev nunca percorre** | 6 suspeitas medidas e anotadas na seção 🌗. Nenhuma investigada |
| **`Sale.platform` NULL nas 35** | o dev só exercita um gateway |
| **O 5º cartão do Insights nunca foi visto DISPARANDO** | ele exige `melhorParada > melhorVeiculando` (`insights.ts:170`), e no dev a melhor entrega (Black Friday 17,59x × Retargeting 11,10x pausada). ⛔ **Não force com período** — os dois lados estão em `test:gerenciador`, então está provado; falta só a evidência de tela |
| **`espelho`/`detectores`/`ambiente` NULOS nos 35 `PixelEvent` do dev** | por isso o diagnóstico não sai de `script-antigo` e a coluna de espelho só diz *não informado*. Os estados `ok` e `divergente` exigem script instalado reportando detectores |

---

# 📌 ESTADO DA SESSÃO — 08/08/2026 (o Gerenciador nasceu)

> **A mais nova. Se contradisser qualquer coisa acima, ela vence.**
>
> ⛔ **NADA FOI PARA O GITHUB.** `main` intacta; tudo é commit LOCAL em
> `redesign/dashboard`. O push é decisão do dono, e ele não a tomou.

## ✅ A QUARTA TELA EXISTE — Gerenciador / Campanhas

Construída na madrugada de 07→08/08 e **commitada em 08/08**. As três seções
anteriores que a chamavam de "próximo" foram corrigidas no mesmo commit — elas
afirmavam o oposto do repositório, que é a família que a sessão inteira de 07/08
registrou.

| | |
|---|---|
| `views/gerenciador/GerenciadorScreen.tsx` | **925 linhas**, do zero |
| `tk/` | `TabelaAds` · `BarraSelecao` · `Paginacao` · `PainelInsights` · `Abas` · `ModalNovaCampanha` |
| `lib/ads/` | `insights.ts` 181 · `apresentacao.ts` 82 · `objetivos.ts` 38 |
| `overview.ts` | **+118** — `SerieDaCampanha`, `AdSetRow`/`AdRow`, séries diárias por campanha |
| deletados | `AdsManagerView` · `AdsTable` · `AdsActionBar` · `NovaCampanhaModal` — o arquivo antigo é DELETADO, não editado |
| `globals.css` | o CSS do Bloco 6 (`.ads-table`, `.ads-aba`, colunas presas) saiu inteiro |
| `test:gerenciador` | **18 asserções**, e ele entrou no `npm test` no MESMO commit |

## 👁️ A TELA FOI VISTA — em parte, e o `04` registra QUAL parte

O commit `c9bcc0e` foi **rede**, com a verificação visual declarada pendente na
própria mensagem. Depois dele veio a passada no navegador, e ela mudou o `04` de
**0 ✅ / 15 ❌** para **16 ✅ / 1 ❌ / 4 🔧**.

⛔ **`tsc` limpo + lint 0 erros + 18 asserções verdes NÃO respondem "como
ficou"** — foi esse conjunto que deixou passar 3 dos 4 primitivos da Fase 2 com
defeito visível. E de fato: **o único bug real da tela só apareceu clicando.**

> ### 🔎 O `04` DESTA TELA GANHOU UMA CONVENÇÃO — leia antes de preencher outra
> **✅ = eu vi na tela.** **Linha em branco = construída e NÃO VISTA.** Em branco
> ela fica FORA da contagem do `docs:estado`, em vez de entrar como feita.
>
> Três linhas seguem em branco de propósito — **tema claro, largura estreita,
> hover/tooltips** —, e são a passada que o dono faz na mão. Outras carregam ⚠️
> dizendo o que dentro delas não foi exercido (o `Exportar` não foi clicado, o
> modal de nova campanha não foi aberto, a reticência da paginação não apareceu
> com 10 campanhas).

## 🐛 O BUG QUE SÓ O CLIQUE MOSTRA: a barra de seleção movia a tabela

A `BarraSelecao` ficava **no fluxo**, acima da tabela. Ao aparecer com a primeira
marcação ela empurrava tudo abaixo dela **36px — uma altura de linha exata**.
Quem marcava a linha 1 e mirava o checkbox da linha 2 **acertava a linha 1 de
novo**, porque a tabela descia no intervalo entre o olho e o clique.

Aconteceu comigo na primeira tentativa, e eu levei um screenshot para entender.

> ### ⛔ RESERVAR A ALTURA SERIA O CONSERTO ERRADO, e vale escrever por quê
> A barra existe em ~1% das visitas — é o motivo de ela não ser permanente, e
> está no cabeçalho de `BarraSelecao`. Reservar o vão faria do espaço vazio o
> estado NORMAL da tela: o mesmo defeito do controle inerte, pago em pixel.
>
> Hoje ela é camada `absolute` sobre a região da tabela (`pointer-events: none`
> na camada, `auto` na barra — senão a própria camada comeria o clique dos
> checkboxes que a alimentam), com a barra `sticky` para continuar alcançável
> numa tabela longa. Flutuando, ela troca o tinte translúcido por fundo OPACO,
> borda e sombra.

### A asserção não mede pixel, e o limite está escrito nela

O que o dono pediu é geométrico: *"com a barra visível, o topo da primeira linha
está na mesma coordenada de quando ela está oculta"*. **Não há motor de layout
aqui** — `renderToStaticMarkup` devolve markup, o jsdom não calcula posição.

⛔ E a versão óbvia seria pior que ausente: simular as duas alturas em JS é
reescrever o componente já consertado sem o defeito, com os dois lados iguais
**por construção** — a armadilha do `test:blocos-vazios`.

A saída foi a mesma daquele: atacar a CAUSA. Cinco asserções novas, e as duas
que sustentam a coordenada são *"a barra é irmã DEPOIS da tabela"* e *"a camada
que a segura é `absolute`"* — que por definição do CSS não desloca irmão.
**Provado pelo lado negativo:** trocando `absolute` por `relative`, a suíte sai
com 1 falha, nomeada.

⚠️ E uma das cinco existe por um erro meu: eu escrevi `--tk-surface-raised` e
`--tk-shadow-pop`, **que não existem**. Os dois compilam, passam no lint e caem
no fallback — cor errada, sombra nenhuma, nada acusa. **Token é casamento de
string com o CSS**, e agora tem asserção.

## 🌞 A PASSADA VISUAL — tema claro e hover passam; largura estreita, não

Medido em 08/08/2026, e os números foram para o `04`:

| | |
|---|---|
| **Tema claro** | página `rgb(248,250,252)` × card branco. **1,05:1** de preenchimento, e quem separa é **borda 1px + sombra** — as duas aplicadas. Texto **17,85:1** |
| **Hover de linha** | `rgb(240,241,243)` sob o mouse × `rgb(255,255,255)` na vizinha |
| **Tooltips dos `ⓘ`** | abrem, e a última linha **declara a procedência**: `Vem do Facebook` · `Calculado a partir dos dois` |
| **Largura estreita** | ⛔ **não verificada.** `resize_window` mentiu pela **terceira** vez |

## 🔒 O ESTADO DO GIT AO FECHAR — conferido, não presumido

| | |
|---|---|
| `origin/main` | **`4e6aa9e`** — o ponto de corte de 05/08/2026, intacto |
| `redesign/dashboard` no remoto | **não existe** (`git ls-remote --heads` devolve vazio) |
| commits locais à frente da `main` | **75** |
| árvore de trabalho | limpa |

⛔ **NADA foi para o GitHub.** Os três commits de hoje são `c9bcc0e` (a tela),
`a2a037e` (a barra flutuante + o `04`) e `bc03b87` (a passada visual). O push é
decisão do dono, e ele não a tomou.

## ➡️ PRÓXIMO: UTM & SNIPPETS, a sétima — e as DUAS coisas que ela herda

Ordem do dono. Precedência de leitura: **`06` acabamento · `04` conteúdo · `03`
estrutura**. Referências: a **07** é o UTM Builder, a **08** são os Snippets.

Duas abas — **UTM Builder** (três colunas: formulário · URL gerada com chips por
parâmetro · histórico + modelos favoritos) e **Snippets** (mestre-detalhe, com
prévia de código com destaque de sintaxe). A tela é **promovida a área de
primeiro nível**.

> ### ✅ A URL É MONTADA POR FUNÇÃO PURA TESTADA — `lib/utm/construir.ts`
> Não por concatenação no JSX. Feito em 11/08/2026, com `test:utm-url`.
>
> ⚠️ **O `[object Object]` NÃO estava mais aberto**, e este bloco dizia que sim.
> Conferido por `grep` em `src/` antes de escrever a tela: as três únicas menções
> eram documentais (este arquivo, o `03` e o `04`). Ele vivia no gerador de link
> antigo do `useTraffikState`, que saiu na faxina de 05/08 — ou seja, **morreu por
> acidente, junto do nav morto**, e ninguém registrou.
>
> A regra continua inteira porque ela agora **previne** em vez de consertar: o
> guarda é de RUNTIME (`valorDeTexto`), porque `tsc` não vê o valor atravessar a
> fronteira do formulário, do modelo salvo ou de um `JSON.parse`. E a asserção
> dele **passa um objeto de verdade** — senão seria guarda que nunca disparou.

### 1️⃣ A largura estreita segue devendo — e a sequência que destrava

**O Gerenciador fechou com essa linha EM BRANCO no `04`**, de propósito. O
`resize_window` mentiu pela **terceira vez** em 08/08: reportou sucesso e deixou
`innerWidth` em 2560, igual a `screen.availWidth` — o indício de janela
maximizada.

> ### ⛔ A ORDEM, e ela já custou duas sessões
> 1. **a aba `299372384` está VIVA** — e precisa continuar viva;
> 2. o dono **desmaximiza a janela que a contém**;
> 3. **só então** o `resize_window` passa a valer — e ainda assim se confere o
>    `innerWidth` por um segundo caminho.
>
> ⚠️ **Se aquela aba fechar, o grupo do MCP é auto-removido** e o
> `tabs_context_mcp{createIfEmpty:true}` da próxima sessão cria um grupo novo
> **na janela maximizada**. O problema volta inteiro.

⚠️ E a dívida agora é de **duas** telas, não uma: o Gerenciador e o que a sétima
produzir. Ela não encolhe sozinha.

### 2️⃣ `UtmsView` é a ÚLTIMA legada servindo rota — e o que ela carrega precisa sobreviver

**397 linhas**, e ela **morre nesta tela**. Estado conferido em 08/08:

| Rota | |
|---|---|
| `(app)/integracoes/utms/page.tsx` | **renderiza** `<UtmsView workspaceId={v.workspaceAtiva} />` |
| `dashboard/utm/page.tsx` | só `redirect` — a rota antiga de primeiro nível **já é casca** |

Ou seja: **promover a primeiro nível é trabalho NOVO**, não religar rota que já
existe.

> ### 🔴 A RESTRIÇÃO QUE NÃO PODE SE PERDER NA REESCRITA
> O comentário da página de hoje diz por que a prop existe:
>
> > *"O script de UTM é POR ÁREA (embute o `WS`). Sem a prop, trocar de área
> > deixava na tela o script da área anterior — e ele é feito para ser copiado e
> > instalado, então o erro vira instalação errada, não só número velho."*
>
> É a regra **"tela stale que ENTREGA artefato é armadilha"**, e ela vale em
> dobro aqui: **as duas abas da tela nova entregam texto que vai para o site do
> cliente** — a URL do Builder e o snippet. Componente que não recebe a área
> ativa não produz número velho; produz instalação errada, permanente, na
> página de outra pessoa.
>
> ⚠️ A assinatura do defeito está registrada: componente cliente + server action
> escopada por área + chamada **sem o argumento** + `useEffect` com deps `[]`.

⚠️ As outras três legadas de Integrações (`Anuncios` 322 · `Pixel` 1.181 ·
`Webhooks` 532) **continuam de pé e não auditadas de propósito** — vão ser
reescritas, e auditar o que será deletado é trabalho que não sobrevive.

# 🔬 `getComputedStyle` SEM REPINTURA CONFIRMADA MEDE O QUE ESTAVA, NÃO O QUE ESTÁ

> **Registrado em 08/08/2026 porque quase virou um bug INVENTADO num arquivo
> correto** — e essa é uma categoria nova nesta base. Todas as outras entradas
> aqui são sobre defeito que passou despercebido; esta é sobre **defeito
> relatado onde não havia**.

Eu li duas vezes a linha sob o mouse como **branco puro contra linha branca**,
contraste **1,000:1**, e ia reportar *"o hover é invisível no tema claro"*.
Cheguei a rastrear a causa até `color-mix` com `var()` e a montar a teoria de
que a regra degenerava para o segundo termo.

**Não se sustentou.** Numa releitura com repintura forçada, a mesma célula mediu
`oklch(0.958558 …)` = `rgb(240,241,243)` — o cinza correto. O branco não
reproduz.

> ### ⛔ A REGRA
> **Depois de `hover` (ou qualquer mudança de estado) por ferramenta, force uma
> repintura e confirme antes de ler.** Dois `requestAnimationFrame` encadeados,
> ou uma escrita que invalide o estilo. Ler logo depois do evento devolve o
> valor ANTERIOR com a mesma cara de medição.

⚠️ **O sinal de alerta é a teoria ficar boa cedo demais.** Eu tinha uma
explicação elegante — `var()` dentro de `color-mix` — e ela estava errada. Numa
base que registra tudo, uma teoria bem escrita sobre um defeito inexistente
custa mais que o defeito: ela vira seção, alguém a lê depois e "conserta" código
que estava certo.

⚠️ E é primo direto do **`resize_window`**: nos dois casos a ferramenta devolve
algo com aparência de resultado, e a disciplina é a mesma — **medir o efeito
por um segundo caminho**, não confiar no retorno.

## ✅ O `docs:estado` PAROU DE FICAR VERMELHO SOZINHO

O bloco gerado carregava `Última geração: DD/MM/AAAA`. Como o conteúdo só muda
quando o `04` muda, **a data era a única parte capaz de mudar sozinha**: à
meia-noite o `--conferir` acusava "desatualizado" e o `npm test` ficava vermelho
sem ninguém ter tocado em nada.

A correção de 07/08 (UTC → dia de São Paulo) tratou o SINTOMA: consertou a janela
das 21h e deixou a origem em pé — o carimbo passou a virar às 00h em vez das 21h.
**O carimbo foi removido.** Sem valor que se mexe sozinho, não há o que reconferir.

> ### ⛔ NÃO REPONHA A DATA
> Suíte que fica vermelha sozinha **para de ser sinal**. Em uma semana todo mundo
> lê o vermelho como ruído — e aí ela não denuncia mais o dia em que algo quebrar
> de verdade. É o alarme que grita sem motivo envenenando a única ferramenta que
> diz se algo quebrou.
>
> Quem responde *"de quando é esta geração?"* é `git log -1 -- CLAUDE.md`, que
> não pode divergir do arquivo. Documentação que **LÊ** o valor não envelhece; a
> que o **AFIRMA**, sim.

⚠️ **Validado contra baseline**, como a regra do gerador de relatório manda: a
regeneração mudou **exatamente uma linha** — a do carimbo. As 8 telas saíram
idênticas.


---

# 📌 ESTADO DA SESSÃO — 11/08/2026 (UTM & Snippets, a sétima tela)

> **A mais nova. Se contradisser qualquer coisa acima, ela vence.**
>
> ⛔ **NADA FOI PARA O GITHUB.** `main` intacta em `4e6aa9e`; tudo é commit LOCAL
> em `redesign/dashboard`. O push é decisão do dono, e ele não a tomou.

## ✅ A SÉTIMA TELA EXISTE — e a ÚLTIMA legada que servia rota morreu

| | |
|---|---|
| `views/utm/UtmSnippetsScreen.tsx` | a tela, do zero |
| `lib/utm/construir.ts` | montagem da URL, **função pura** |
| `lib/utm/armazem.ts` | `ArmazemUtm` — interface + implementação em memória |
| `lib/utm/inventario.ts` | o inventário REAL de snippets |
| `tk/CodigoDestacado.tsx` | tokenizer próprio: JS · HTML · JSON |
| deletados | `UtmsView` (397 linhas) e `dashboard/utm/page.tsx` |
| rota | `/dashboard/utm`, **primeiro nível**. `integracoes/utms` virou redirect |
| testes | `test:utm-url` 14 · `test:destaque` 22 · `test:utm-tela` 21 — **os três no `npm test` no MESMO commit** |

`04`: de **0 ✅ / 23 ❌** para **21 ✅ / 0 ❌ / 9 🔧**. Uma linha em branco (largura
estreita). Validado contra baseline: as 7 outras telas saíram idênticas.

## 🟡 MODELOS E HISTÓRICO NÃO SÃO GUARDADOS — e a tela DIZ isso

Não existe tabela: conferido nos 24 modelos do `schema.prisma`. Decisão do dono
(opção **B**): construir contra a interface `ArmazemUtm`, implementação em
memória, estado vazio honesto — *os modelos funcionam nesta sessão e ainda não
são guardados*. A migration entra numa **sessão só de schema**, junto do
`ocorreEm` da despesa única.

⛔ `localStorage` foi RECUSADO, e o motivo é o que decide: modelo favorito é
configuração que o usuário **acredita** ter salvo. Some na outra máquina sem
avisar — a tela confirma o salvamento e o produto não guardou.

> ### ⛔ AO LIGAR O BANCO, `persiste` VIRA `true` E A FRASE SOME SOZINHA
> O aviso é `if (armazemUtm.persiste) return null;`. Escrever a frase à mão a
> teria transformado em segunda fonte de verdade — e no dia da tabela a tela
> continuaria dizendo que não guarda. **Documentação que LÊ o valor não
> envelhece.** Há asserção sobre isso no `test:utm-tela`.

## ⛔ O TOGGLE NÃO É UNIFORME — 3 de 7, e isso é a decisão

Os 3 snippets de pixel têm `PixelConfig.enabled` **e** `togglePixel()`. Os 4 de
UTM não têm coluna nenhuma: quatro toggles ali seriam controle inerte.

No lugar deles vai selo **medido** por `cliquesComArea`: `Instalado` /
`Não detectado`. ⚠️ E `não detectado` **não é** `quebrado` — área sem tráfego dá
o mesmo zero que script mal instalado, e a tooltip escreve a ambiguidade.

## 🧾 O INVENTÁRIO DE SNIPPETS É O NOSSO, NÃO O DA REFERÊNCIA

Sete, em quatro famílias **geradas**: rastreamento de UTM (o único `porArea`),
back redirect, 3 formatos de parâmetro de URL, 1 por pixel.

Saíram juntos, por dependerem de multiusuário ou de população única:
`Biblioteca pública`, `Templates`, `Atividade recente` com autor, `Tags`, e o KPI
`Execuções (30d)` — que somaria `PixelEvent` com `Click`, **dois instrumentos num
número só**. Ficaram 3 KPIs. Decisão do dono: dois números com o nome do
instrumento cada, ou nenhum. Foi nenhum.

## 🎨 O TOKENIZER: a saída segura é SEM COR, nunca colorida ERRADO

Sem dependência nova — o código realçado é gerado por nós, o vocabulário é
fechado. O contrato é uma INVARIANTE, não uma lista de casos:

> **concatenar o texto de todos os tokens devolve a entrada, caractere por caractere.**

✅ **Provado pelo lado negativo:** plantando uma perda de UM caractere nos
comentários, a suíte sai com **7 falhas** — e o fuzz (300 entradas, semente fixa
7) nomeia a entrada exata. Restaurado, 22 verdes.

⚠️ O realce vive sobre painel de código, e os `--tk-on-tint-*` foram calibrados
sobre TINGIMENTO. Por isso o contraste foi **medido na tela**, não presumido.

## 🔬 O QUE FOI MEDIDO, E O QUE NÃO FOI

| | |
|---|---|
| Tema claro | ✅ comentário **4,70:1** · palavra-chave **5,58** · número **5,66** · cadeia **5,69** · texto **16,90**, sobre painel `rgb(246,249,252)` |
| Tema escuro | ✅ **visto** e legível nos cinco papéis — ⚠️ **números não medidos** |
| Fluxo do Builder | ✅ preencher → `Gerar URL` → histórico → `Salvar modelo` → favoritos |
| Largura estreita | ⛔ **não verificada** |

### ⚠️ O renderer congelou DUAS vezes no `Runtime.evaluate`

Na medição do escuro, e a segunda com script leve (90 nós, não 642). Regra das
duas tentativas: encerrei a medição por JS. **Screenshot continuou funcionando** —
foi por ele que o escuro ficou ✅ como *visto*, e não como *medido*. As duas
afirmações são diferentes, e o `04` as separa.

### ⚠️ A largura estreita agora deve em TRÊS telas

A aba `299372384` da sessão passada **não existe mais** — o grupo do MCP nasceu
com a `299375179`. A sequência (aba viva → dono desmaximiza → só então
`resize_window`) não teve como ser tentada, e eu **não gastei tentativa**.

🔎 **A aba `299375179` ficou ABERTA de propósito**, em `/dashboard/utm`. Se o
dono desmaximizar a janela que a contém, a próxima sessão destrava as três.

## 🐛 OS DOIS DEFEITOS DESTA SESSÃO — os dois só a tela mostrou

| | |
|---|---|
| **placeholders vazios** | 4 dos 6 campos saíram `Ex:` e mais nada. Eu derivava o exemplo da frase de ajuda por fatia de string, e as frases não têm todas a mesma forma. `tsc` e lint verdes |
| **guarda medindo PROSA** | a asserção sobre o estado de carregamento reprovou pelo **comentário do próprio arquivo**, que cita o nome do símbolo para explicar por que ele não existe |

> ### ⛔ TEXTO DERIVADO DE OUTRO TEXTO POR CIRURGIA DE STRING NÃO É *LER O VALOR*
> A regra *documentação que LÊ o valor não envelhece* vale para o MESMO valor em
> dois lugares. Arrancar um pedaço de uma frase escrita para OUTRO fim produz
> informação **diferente** — e ela falha em silêncio em todo caso que não casa
> com o formato presumido. Hoje há `EXEMPLO_UTM`, texto próprio.

> ### ⛔ GUARDA POR CASAMENTO DE TEXTO MIRA SINTAXE, NUNCA PALAVRA SOLTA
> Um arquivo que documenta por que um símbolo NÃO existe contém o nome dele. A
> guarda passou a mirar a DECLARAÇÃO, e leva junto a linha de base do derivado —
> senão ela passaria também com os dois ausentes.

## ♻️ UMA EXTRAÇÃO EM CÓDIGO CONGELADO — declarada, não escondida

O mapeamento `PixelConfigDTO → PixelScriptConfig` vivia inline na `PixelView`
(congelada, anterior a `4e6aa9e`) e passou a ser preciso também aqui. Virou
`scriptDoPixel()`, em `lib/pixel/script.ts`, **sem mudar uma linha do que ele
calcula** — a `PixelView` chama a mesma coisa, de outro lugar.

⚠️ Não é conserto de defeito: é a regra dos dois lugares que fazem a mesma conta.
Duas cópias divergiriam, e a divergência aqui faz **cada tela mostrar um script
diferente do que está instalado no site do cliente**.

## ➡️ PRÓXIMO: Integrações › Pixel/Eventos

Ordem do dono. `PixelView`, **1.181 linhas** — a maior view legada que resta.
Ela já herda três coisas desta sessão: `scriptDoPixel()` como fonte única (com o
cabeçalho pedindo para não reinlinar), o tokenizador de sintaxe, e o prazo dos
dois `elapsed()` crus das linhas 272 e 294.

### 🔬 A RESTRIÇÃO DO ARTEFATO ALI É **DUPLA**, e as duas metades medem coisas diferentes

> **Medido em 11/08/2026, a pedido do dono, antes de escrever a asserção.** A
> premissa dele estava certa: o pixel pertence a uma área, e isso muda a conta.

| | O que foi medido |
|---|---|
| `PixelConfig.workspaceId` | **existe** (`schema.prisma:1023`). NULO = sem dono, aparece na Principal |
| `listPixels(workspaceId)` | **recorta por área**, via `escopoDeConfig` |
| o script embute a ÁREA? | ⛔ **NÃO.** `grep -cE 'var WS\|workspaceId'` em `lib/pixel/script.ts` → **0** |
| o script embute o quê? | `var CONFIG = "<PixelConfig.id>"` — **1** ocorrência |
| e o script de UTM, para contraste | embute `var WS` — **1**. Por isso lá a área muda o CONTEÚDO |

**Conclusão: são DUAS asserções, e nenhuma cobre a outra.**

| # | O que provar | Por que a outra não cobre |
|---|---|---|
| 1 | trocar de **PIXEL** troca o CONTEÚDO do script | é o `configId` que muda o texto |
| 2 | trocar de **ÁREA** troca a LISTA de pixels alcançáveis | o conteúdo de um pixel **não** muda com a área — só a visibilidade dele |

> ### 🔴 O MODO DE FALHA AQUI NÃO É O MESMO DO UTM — e é por isso que a asserção muda
> No UTM, tela stale entrega o script **com a área errada dentro**: conteúdo
> errado. Aqui, tela stale entrega um script **correto, de um pixel que não
> pertence à área ativa** — o artefato está certo e o CONTEXTO está errado.
>
> O usuário instala o pixel da operação A na página da operação B. Nada no
> arquivo denuncia, porque o arquivo é válido. Só o Gerenciador de Eventos da
> Meta mostraria, semanas depois, evento chegando na conta errada.

### ⚠️ A ASSIMETRIA DA PRINCIPAL PODE FAZER A ASSERÇÃO 2 PASSAR POR ACIDENTE

`escopoDeConfig` **não é simétrico** (`areas/escopoConfig.ts`):

```
Principal (isDefault) → OR [ workspaceId = principal.id , workspaceId = NULL ]   ← catch-all
área secundária       → workspaceId = <id>                                        ← estrito
```

Então `Área B → Principal` **acrescenta** os órfãos, e `Principal → Área B` pode
não tirar nada se não houver órfão. Uma fixture com **um** pixel só faria a
asserção 2 passar sem exercer o recorte.

⛔ A fixture precisa de **pelo menos três**: um da área A, um da área B e um com
`workspaceId` NULO — e a asserção compara as listas nas duas direções, não só o
tamanho de uma delas.

### 🔜 Depois dela

**Criativos** (imagem 9) e **Login** (imagens 10 e 11) fecham as dez. `Regras`
(21 ❌) segue sendo a maior dívida isolada.

⚠️ **As três legadas de Integrações continuam de pé e NÃO auditadas de
propósito**: `Anuncios` 322 · `Pixel` 1.181 · `Webhooks` 532. Elas morrem na
reescrita delas.

## 🧩 O ACABAMENTO DE FECHAMENTO — 11/08/2026, mesma sessão

Três decisões do dono depois da primeira entrega da tela.

### 1 · `scriptDoPixel()` é FONTE ÚNICA, e está escrito nele

A extração fica. O cabeçalho da função agora é endereçado a **quem for
reescrever a `PixelView`** — que é a próxima tela — e diz para não reinlinar as
doze linhas de volta, com o motivo: a divergência ali não produz número errado,
produz **duas telas mostrando um script diferente do que está instalado no site
do cliente**. O usuário confere numa, copia da outra, e as duas parecem certas.

⚠️ Extração sem mudar o que se calcula **não é conserto de comportamento** — é a
regra dos DTOs: move, não altera. Por isso ela não fere o congelamento.

### 2 · O vão do Builder — a decisão foi INVERTIDA na mesma sessão

A tabela de Snippets **não** entra na aba do Builder (decisão do dono): a
referência a coloca lá porque a tela dela tem duas colunas; a nossa tem três, e
a tabela traz prévia de código.

⚠️ **Eu fechei o vão com `alignItems: stretch` e o dono mandou reverter, depois
de olhar o print.** O bloco abaixo é a regra que a reversão produziu, e ela vale
muito além desta tela. A versão `stretch` NÃO está descrita aqui como opção viva:
proibição que muda é apagada, não mantida ao lado do que vale hoje.

A regra que a reversão produziu virou seção própria — procure por
**VÃO DENTRO DE UM CARD PROMETE CONTEÚDO**, acima. Ela saiu daqui de propósito:
ordem do dono, porque decide qualquer vão das cinco telas que faltam, e regra
transversal presa dentro do relato de uma tela é regra que a próxima pessoa não
acha.

✅ **Medido na tela:** alturas `539 / 304 / 539`, fundos `713 / 478 / 713`. O vão
interno do cartão do meio caiu de ~130px para **16px** — só o `gap`.

⚠️ É a mesma decisão do `alignSelf: start` do bloco vazio do Dashboard, e o
argumento é o do dono: **alinhamento é estética da linha; espaço morto é a tela
afirmando que ali cabia algo.**

### 3 · O aviso de sessão saiu de dentro da área que rola

> ### 🔴 ROLAGEM QUE SÓ EXISTE QUANDO O VIZINHO É ALTO É ROLAGEM POR ACIDENTE
> A primeira versão tirava a altura do grid (`flex: 1` numa coluna esticada). Ao
> voltar para `alignItems: start` ela **sumiu em silêncio** — e com ela sumiria a
> razão de o aviso estar fora da área rolável, deixando a estrutura correta e
> inerte.
>
> Hoje o teto é **da lista** (`maxHeight: 260`), não da coluna: ela dispara pelo
> próprio conteúdo, e o histórico guarda até 12 entradas. É a família da
> *proteção por TIMING, não por ESTRUTURA*, na camada de layout — o que segurava
> era a altura do vizinho, e vizinho não é contrato.

Os modelos passaram a rolar por dentro do cartão, e o `AvisoDeSessao` ficou
**fora** da rolagem. Se descesse com a lista, o usuário com muitos modelos nunca
veria a declaração de que nada é guardado — e é exatamente ele quem mais precisa
dela.

`04`: **22 ✅ / 0 ❌ / 10 🔧**. Validado contra baseline: só a linha de UTM mudou.

---

# 📌 ESTADO DA SESSÃO — 11/08/2026 (parte 2: a gaveta do Pixel)

> **A mais nova.** ⛔ **NADA FOI PARA O GITHUB.** `main` em `4e6aa9e`, **83
> commits locais**, branch ausente no remoto.

## ✅ RESOLVIDO EM 11/08 (parte 3): a gaveta ganhou consumidor

> ⚠️ **O bloco abaixo descreve o estado do MEIO da sessão de 11/08 e ficou
> como registro.** A `PixelScreen` existe, serve a rota e foi vista no
> navegador — ver a seção de **11/08 (parte 3)**, no fim do arquivo. Não leia o
> que segue como estado atual.

## 🗃️ (registro) A GAVETA NÃO TINHA CONSUMIDOR

`GavetaPixel.tsx` está pronta, com `tsc` limpo, lint 0 e 17 asserções verdes —
e **nenhum arquivo de produção a importa.** Não existe `PixelScreen`, a rota
`/integracoes/pixel` ainda serve a `PixelView` antiga, e a gaveta nova **nunca**
foi aberta num navegador.

Isto é exatamente a família que este arquivo documenta desde sempre: *passa no
build com a coisa desligada*. Está registrado aqui em vez de descrito como
entrega porque a diferença importa — **`tsc`, lint e teste não perguntam se
alguém chama, e nenhum deles responde "como ficou".**

⚠️ **Não conclua que a gaveta está errada.** Conclua que ela está NÃO VERIFICADA
VISUALMENTE, que é o mesmo estado em que o Gerenciador foi commitado em 08/08 —
e lá a passada seguinte achou o único bug real da tela.

## ✅ O que ficou pronto

| | |
|---|---|
| `04`, seção **PIXEL & EVENTOS** | **31 itens, todos ❌.** Seção nova: o `docs:estado` conta **9 telas**. Baseline validado — as 8 anteriores idênticas |
| `lib/pixel/formulario.ts` | o preset saiu do componente e virou **redutor puro** |
| `views/pixel/GavetaPixel.tsx` | a gaveta, com as 3 perguntas + avançado + script |
| `test:pixel-preset` | **17 asserções**, no `npm test` no mesmo commit |

## 🎯 A DECISÃO ESTRUTURAL — e é o que vale a sessão

O acoplamento mais caro do produto vivia num handler de `.tsx`: `responderPreset`
reescrevia **o mapa de donos** e **o `temPixelNativo`** na mesma linha, e essa
simultaneidade é a proteção contra a Meta contar conversão em dobro.

> **Proteção que mora dentro de um componente é proteção que nenhum teste
> alcança.** Hoje as transições são funções puras em `lib/pixel/formulario.ts`.

⚠️ **MOVE, não correção.** Não muda uma linha do que a `PixelView` calculava.

### A asserção olha o ARTEFATO, não o campo

Comparar `form.temPixelNativo` com `form.donos` provaria só que dois campos do
mesmo objeto concordam — quase uma tautologia. O que importa é que o **script
instalado no site** muda junto com o que o servidor vai decidir. Então o lado do
espelho é lido do texto que `scriptDoPixel` gera (`var NATIVO`).

✅ **Provado pelo lado negativo duas vezes:** mexer no campo à mão produz o par
divergente (a asserção documenta o estado errado para ele ser reconhecível), e
plantar `...f, temPixelNativo: false` na gaveta faz a guarda reprovar **nomeando
a linha**.

> ### ⛔ A GUARDA ERROU NA PRIMEIRA VERSÃO — e o modo de erro é o de sempre
> Ela proibia `temPixelNativo:\s*(true|false)` e **reprovou a chamada LEGÍTIMA**
> `responderPreset(f, { temPixelNativo: true })`.
>
> **Mirar a sintaxe do ERRADO não basta quando o CERTO a contém.** É a terceira
> vez nesta sessão que uma guarda por casamento de texto pega o alvo errado (a
> outra mediu prosa de comentário). Hoje ela verifica **por linha** que toda
> atribuição está dentro do redutor.

## 🕳️ O QUE FICA DEVENDO — e nada disso é surpresa

| | |
|---|---|
| **`PixelScreen`** (mestre + diagnóstico) | ⛔ não começou. É o que dá consumidor à gaveta |
| **Lista de eventos** | ⛔ não começou. Aprovada, especificada no `04`, **paginada e com janela** |
| **A `PixelView` (1.181) segue de pé** | ela ainda serve a rota. Morre quando a tela nova existir |
| Passada visual da gaveta | ⛔ **nunca aberta** |
| Largura estreita | ⛔ deve em três telas |

## ➡️ PRÓXIMO — a ordem é do dono, e o motivo dela está na linha 2

| # | | |
|---|---|---|
| 1 | **`PixelScreen`** | tira a gaveta do estado inerte. Mestre com a lista de pixels, selo de diagnóstico por pixel (`conferirSnippet` já devolve os 4 estados) e a gaveta ligada |
| 2 | **Passada visual da gaveta** | 🔴 **é onde o defeito vai aparecer.** Enquanto a tela não existir, a gaveta é afirmação sem testemunha |
| 3 | **Lista de eventos** | `PixelEvent` por `pixelConfigId` (conferido: **é escrito**, `api/pixel/event/route.ts:197`). **Paginada e com janela**, pelo índice `[userId, event, timestamp]` |
| 4 | **A asserção do `checkoutProprio`** | 101 linhas que decidem detecção de IC, e ninguém verifica |
| 5 | **A `PixelView` morre** | e os dois `elapsed()` crus (272 e 294) com ela |

⚠️ **A retenção do `PixelEvent` continua devendo** (dívida nº 4). A lista pode
tornar a dívida visível — não pode agravá-la.

⚠️ **`trechoUrl` e `checkoutProprio` já foram REUSADOS pela gaveta**, então eles
não morrem com a view antiga. `checkoutProprio` continua **sem teste** — e a
asserção que falta é a que o dono pediu: 101 linhas que decidem detecção de IC e
ninguém verifica.


---

# 📌 ESTADO DA SESSÃO — 11/08/2026 (parte 3: PIXEL & EVENTOS, a oitava tela)

> **A mais nova. Se contradisser qualquer coisa acima, ela vence.**
>
> ⛔ **NADA FOI PARA O GITHUB.** `main` em `4e6aa9e`, branch ausente no remoto.

## ✅ A GAVETA TEM CONSUMIDOR — e a passada visual achou o que o build não acha

A seção anterior abria com *"a gaveta está pronta e NÃO TEM CONSUMIDOR"*. Deixou
de ser verdade: existe `PixelScreen`, ela serve a rota, e a `PixelView` (1.181
linhas) **foi deletada** — com os dois `elapsed()` crus das linhas 272 e 294.

| | |
|---|---|
| `views/pixel/PixelScreen.tsx` | mestre · diagnóstico POR EVENTO · lista de eventos |
| `lib/pixel/eventos.ts` | janela, vocabulário e os **três** motivos de lista vazia |
| `lib/actions/pixelEvents.ts` | listagem paginada + diagnóstico em lote |
| `tk/Gaveta.tsx` | a camada lateral do sistema novo |
| `lib/areas/escopoWhere.ts` | MOVE do `where` da área para fora do módulo que importa o prisma |
| deletados | `PixelView` (1.181 linhas) |
| testes | `test:pixel-tela` **25** · `test:checkout-proprio` **18** — os dois no `npm test` no MESMO commit |

`04`: de **0 ✅ / 31 ❌** para **28 ✅ / 0 ❌ / 1 🔧**. Validado contra baseline: as
8 outras telas saíram idênticas.

## 🐛 O QUE SÓ A TELA MOSTROU — quatro, e o primeiro é do SHELL

| | |
|---|---|
| 🔴 **o título da gaveta saía CORTADO AO MEIO** | a faixa de ambiente é `z-index` 200 e toda camada flutuante é 70 |
| aviso **duplicado** | com o trecho de URL vazio, o `erro` do campo e o `grau: "vazio"` do analisador diziam a mesma coisa, em duas caixas coladas |
| tabela em **ilhas** | 4 colunas curtas espalhadas por `width:100%`, com vãos de 200px |
| o script **não tinha COPIAR** | um bloco de código feito para ser colado no site, e sem botão |

### 🩼 A ALTURA DA FAIXA ERA UM NÚMERO ESCRITO À MÃO — e já estava errado

`ALTURA_FAIXA_AMBIENTE = 26`. A faixa pinta **27,8px**. O conteúdo do shell já
ficava 1,8px por baixo dela, e ninguém tinha visto — o comentário da constante
**já nomeava o modo de falha** (*"dois valores escritos à mão é como o rodapé do
rail voltaria a ser cortado"*), e ele aconteceu com um **terceiro** consumidor
que ninguém previu: as camadas flutuantes.

Hoje a altura é **MEDIDA** (`ResizeObserver` na própria faixa) e vai para
`--tk-faixa-topo`, que o shell, o rail e a `tk/Gaveta` leem. `0px` é o padrão
certo: em produção não há faixa.

> ⛔ **Não reponha o número.** Nenhuma constante estaria certa: a faixa quebra em
> duas linhas em viewport estreito. E quem precisa dela é um portal para o
> `<body>`, que não herda nada do shell — variável na raiz do documento é o
> único canal.

⚠️ **`ui/Drawer` e `ui/Modal` continuam com o defeito** — eles também são
`z-index` 70. Não foram tocados: são anteriores a `4e6aa9e` e morrem à medida que
as telas são reescritas. Se aparecer gaveta legada com o título cortado em
desenvolvimento, é isto, e a correção é uma linha
(`top: var(--tk-faixa-topo, 0px)`).

## ✅ O PRESET FOI EXERCIDO NA TELA, não só no teste

Responder *"Não, só a Trackhub vai enviar"* virou, no artefato, **no mesmo
clique**:

```
var NATIVO  = true          →  false
var ALHEIOS = ["PageView"]  →  []
```

E voltar para *"Sim"* devolveu os dois. É a proteção contra contagem dobrada
funcionando de ponta a ponta — do rádio ao texto que vai para o site do cliente.

✅ **O aviso vermelho também foi visto disparando**: `temPixelNativo` com o
`PageView` reatribuído à Trackhub à mão pinta *"esta combinação conta a visita
duas vezes"*, e o selo vira `Ajustado à mão`, com o `↩ voltar ao padrão` ao lado.

## 🔧 A COLUNA `origem` SAIU DA TABELA — medido, não decidido no gosto

O evento de checkout criado pelo webhook do gateway
(`webhook/checkoutEvent.ts:151`) **não grava `pixelConfigId`**. Conferido nos
dois lados: no código (o `create` não tem o campo) e no banco de dev (**0
linhas** com prefixo `gw:` e configuração).

Uma lista POR PIXEL é, portanto, **do navegador por construção** — e uma coluna
com um único valor possível não informa: ela ocupa largura afirmando que existe
uma distinção. No lugar dela entrou **`Página`**, que responde *onde* o evento
disparou e já vinha no DTO, invisível dentro de um `title`.

⚠️ O campo `origem` continua no DTO, derivado do prefixo `gw:`. Se o webhook um
dia carimbar o pixel, a coluna volta sem conta nova.

## 🌗 O QUE O SEED DO DEV NÃO CONSEGUE MOSTRAR — medido, e é um ACHADO

`seed-dev` cria `PixelConfig` **sem `MetaPixel` e sem `PixelEventRule`** (0 e 0,
medidos). As consequências na tela são todas honestas e todas cegas:

| | |
|---|---|
| `0 pixels da Meta` em todo pixel | o fan-out nunca é exercido com N > 1 |
| **todo evento aparece `desligado`** no diagnóstico | não há regra ligada para ver o estado bom |
| `espelho`, `detectores` e `ambiente` **NULOS** nas 35 linhas | a coluna de espelho só sabe dizer *não informado* |

⚠️ É a família **"o seed produz estado INCOMPLETO"**: o ramo exercido funciona, e
o outro nunca foi percorrido.

## 🔬 AS DUAS METADES DA RESTRIÇÃO DO ARTEFATO, provadas separadas

| # | O que o teste prova | Como |
|---|---|---|
| 1 | trocar de **PIXEL** troca o CONTEÚDO do script | `var CONFIG` muda — e o mesmo pixel produz o mesmo script, que é o controle negativo |
| 2 | trocar de **ÁREA** troca a LISTA alcançável | fixture de **três**: área A, área B e um órfão |

A 2 exigiu tirar o `where` de dentro de `escopoDeConfig`: aquele módulo importa o
`prisma`, e **importar já lança sem `DATABASE_URL`**. `lib/areas/escopoWhere.ts`
é um MOVE — nem uma vírgula do que era produzido mudou — e agora a assimetria da
Principal (`OR [id, NULL]`, catch-all) é exercível por teste puro.

> ### ⛔ COM UM PIXEL SÓ, A ASSERÇÃO 2 PASSA SEM EXERCER NADA
> Indo de uma área secundária para a Principal a lista só **cresce**; no sentido
> inverso ela pode não encolher se não houver órfão. A asserção compara os dois
> sentidos e afirma o que cada lista **perdeu**, não o tamanho dela.

## 🔤 QUARTA VEZ: guarda por texto medindo PROSA

A guarda das deps do efeito ancorou em `listPixels(workspaceId)` — e casou com o
**cabeçalho do próprio arquivo**, que cita a chamada para explicar por que ela
precisa da área. Dali em diante ela achou a lista de deps do efeito ERRADO (o dos
eventos) e reprovou por um motivo que não existia.

A âncora virou `Promise.all([listPixels(workspaceId)`, que só o código tem.
**Provado pelo lado negativo**: com deps `[versao]` a suíte sai com 1 falha,
nomeada.

## 🔬 DUAS VEZES QUASE REPORTEI DEFEITO QUE NÃO EXISTIA

Vale mais que os defeitos achados, porque esta base já pagou por *teoria boa
demais*:

| O que eu ia reportar | O que era |
|---|---|
| *"criar pixel não atualiza a lista"* | o screenshot foi tirado antes de a busca voltar. O pixel estava lá |
| *"o tema claro não chega ao conteúdo"* | o **screenshot** mostrava quadro velho. Medido: `body` `rgb(248,250,252)`, card e célula de tabela em **branco puro** |

⚠️ **O segundo custou duas tentativas e um `Runtime.evaluate` congelado.** É o
primo do `resize_window` e do `getComputedStyle` sem repintura: a ferramenta
devolve algo com **aparência de resultado**. Screenshot desta base **não é prova
de cor** — a prova é medir, e é por isso que o `04` separa *visto* de *medido*.

## ⏳ O QUE FICA DEVENDO

| | |
|---|---|
| **Largura estreita** | ⛔ segue devendo, agora em **quatro** telas |
| Estado vazio da lista de pixels | construído, **não visto** — o dev sempre teve pixel |
| O botão `copiar` do script | nasceu **depois** da passada e não foi visto |
| `divergente` e `ok` do diagnóstico | 2 dos 4 estados vistos; os outros exigem script instalado de verdade |
| Filtro por tipo de evento | ligado, **não exercido** — o dev só tem `InitiateCheckout` |
| Índice por `pixelConfigId` | **não existe**. A consulta entra pelo `[userId, event, timestamp]`. Criar é migration, e migration não entra em commit de tela |
| **Retenção do `PixelEvent`** | 🔴 continua devendo (dívida nº 4). A tela **não agrava**: janela validada no servidor + paginação |

## ➡️ PRÓXIMO

**Criativos** (imagem 9) e **Login** (imagens 10 e 11) fecham as dez. `Regras`
(21 ❌) segue sendo a maior dívida isolada.

⚠️ **Duas legadas de Integrações continuam de pé e não auditadas de propósito**:
`Anuncios` 322 · `Webhooks` 532. Elas morrem na reescrita delas — e a de Webhooks
herda a regra do **artefato válido de contexto errado** inteira, porque a URL do
webhook é exatamente isso.


---

# 🫥 O DEFEITO ACIDENTALMENTE INVISÍVEL — a "proteção acidental" AO CONTRÁRIO

> **Leitura do dono, 11/08/2026, sobre a faixa de ambiente.** É família nova, e
> ela explica um tipo de defeito que passada visual nenhuma pega.

O `padding-top` do shell era a constante `ALTURA_FAIXA_AMBIENTE = 26`. A faixa
pinta **27,8px**. Ou seja: **o conteúdo do painel inteiro ficava 1,8px por baixo
dela, em TODAS as telas, desde 06/08** — e **seis passadas visuais não pegaram**.

Não pegaram porque não havia o que pegar: nada encostava naquela borda. O
primeiro elemento de cada tela começa depois de um `padding` generoso, então os
1,8px caíam em espaço vazio. O defeito existia, era mensurável, e **não tinha
como se manifestar**.

Ele só apareceu quando uma camada nova chegou ao topo — a `tk/Gaveta`, que
começa em `y=0` e põe o TÍTULO ali. Aí o mesmo erro de 1,8px virou um título
cortado ao meio, porque a camada é `z-index` 70 e a faixa é 200.

> ### 🔴 É A "PROTEÇÃO ACIDENTAL", COM O SINAL TROCADO
>
> | | |
> |---|---|
> | **proteção acidental** | o código está errado e **funciona** por uma circunstância que ninguém escreveu |
> | **defeito acidentalmente invisível** | o código está errado e **não aparece** por uma circunstância que ninguém escreveu |
>
> Nos dois, o que decide é uma propriedade não declarada — e ela some no primeiro
> commit que não a conhece. A diferença é só quem paga: na primeira, quem escreve
> o commit seguinte; na segunda, **quem escrever o commit seguinte também**, mas
> depois de a coisa ter estado errada esse tempo todo sem ninguém saber.

⛔ **Passada visual não pega defeito que não encosta em nada.** Ela responde *"como
ficou?"*, e a resposta era "ficou bem" — estava. O que pega é a pergunta do outro
lado: **"que valor deveria ser igual a este, e é?"**. `26` × `27,8` é uma
comparação, não uma olhada.

> ### ⛔ A PERGUNTA QUE ELA MUDA — e ela vale nas cinco telas que faltam
>
> Fechar uma tela deixou de ser só *"como ficou?"*. A segunda pergunta é:
>
> > **"que valor deveria ser IGUAL a este — e é?"**
>
> A primeira é uma olhada; a segunda é uma **comparação**, e só ela pega o que
> não encosta em nada. `26` × `27,8` não tinha como aparecer numa passada visual.
>
> O que perguntar, concretamente, antes de fechar qualquer tela:
>
> | Onde | A pergunta |
> |---|---|
> | número que casa com medida pintada | altura de barra fixa, `top` de sticky, `scroll-margin`, altura de cabeçalho — **alguém mediu, ou alguém escreveu?** |
> | dois lugares que mostram o mesmo dado | o card e a tabela, o KPI e a soma das linhas — **batem?** |
> | token citado em dois arquivos | nome de cookie, nome de variável CSS, chave de `Record` — **um LÊ o outro, ou os dois AFIRMAM?** |
> | constante que espelha o schema | a interface do motor de regras, o `select` do Prisma — **a coluna nova entrou nos dois?** |
>
> ⚠️ E o corolário incomoda: **"seis passadas visuais não pegaram" não é
> evidência de que está certo.** É evidência de que nada encostou ali ainda.

⚠️ **A regra que sai daqui:** todo número que existe para CASAR com uma medida
pintada (altura de barra fixa, offset de sticky, `scroll-margin`, altura de
cabeçalho de tabela) é a mesma família do empurrãozinho de 2px — e a saída é a
mesma: **ler o valor, não afirmá-lo**. Hoje a faixa é medida por
`ResizeObserver` e vive em `--tk-faixa-topo`.

---

# 📌 ESTADO DA SESSÃO — 11/08/2026 (parte 4: o seed do pixel e o fechamento)

> **A mais nova.** ⛔ **NADA FOI PARA O GITHUB.** `main` em `4e6aa9e`, branch
> ausente no remoto.

## ✅ O SEED PAROU DE PRODUZIR ESTADO INCOMPLETO

`seed-dev` criava `PixelConfig` **e mais nada**: zero `MetaPixel`, zero
`PixelEventRule`. É a mesma família do `n % 2` do BOLETO — **o gerador entregando
exatamente o estado que impede de avaliar a tela**.

| | Antes | Agora |
|---|---|---|
| pixels da Meta | `0` nos dois | **2** no pixel A (um COM token, outro sem) · 1 no B |
| regras | nenhuma | 4 em cada, e elas **DIVERGEM** entre os dois pixels |
| estados por evento visíveis | 1 (`desligado`) | **4** |

`scripts/pixel-dev.mjs` (`npm run dev:pixel`) é **idempotente** (provado rodando
duas vezes: 2/4/1 e 1/4/0 nos dois casos) e **o `seed-dev` importa a mesma
função** — uma cópia lá dentro faria o banco RECRIADO e o banco COMPLETADO
mostrarem telas diferentes.

⚠️ **`seed:dev` passou a rodar com `tsx`**, porque o token é encriptado com o
`encryptSecret` do app. Valor cru ali seria estado falso que só apareceria no dia
em que alguém decriptasse — e pareceria bug de criptografia. **Não executei o
`seed:dev`** (recriar o banco mataria a sessão do dono); o que ficou provado é
que a cadeia de import roda sob `tsx`, pelo `dev:pixel`.

### 👁️ Os dois estados que faltavam, VISTOS

| | |
|---|---|
| **fan-out** | `2 pixels da Meta` no mestre, e na gaveta os DOIS estados do campo de token lado a lado: *"Já cadastrado — deixe em branco"* e *"Sem ele, só o navegador envia"* |
| **ligado e recebendo** | `InitiateCheckout` sem o `· desligado`, com `21 · 6 dias atrás` |
| **ligado e NUNCA recebido** | o `Lead` do pixel B, em âmbar — numa regra de verdade, não só no `PageView` |
| **desligado** | `AddToCart` e `Purchase` do pixel B, esmaecidos, com `—` |

⚠️ **O que continua fora de alcance no dev:** `espelho`, `detectores` e
`ambiente` são NULOS nas 35 linhas de `PixelEvent`. Por isso o diagnóstico não
sai de `script-antigo` e a coluna de espelho só sabe dizer *não informado* — os
estados `ok` e `divergente` exigem um script instalado de verdade reportando
detectores.

## 🐛 UM DEFEITO NO PRÓPRIO SCRIPT NOVO, e ele era MUDO

A checagem de "fui executado ou fui importado" estava escrita à mão:

```js
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`)
```

No Windows o Node usa `file:///C:/...` — **três barras**. A comparação dava
falso, e o script **saía sem imprimir nada e com código 0**, que é
indistinguível de *"rodou e não havia o que fazer"*. Hoje é
`pathToFileURL(process.argv[1]).href`.

⚠️ Ele só foi percebido porque **o script IMPRIME o que gerou** e a saída veio
vazia. Um gerador silencioso teria "passado".

## 🔴 ACHADO ADIADO NOVO — e ele NÃO é dívida comum

**Toda camada flutuante do legado está com o título cortado**, hoje:
`ui/Drawer` e `ui/Modal` são `z-index` 70 e a faixa de ambiente é 200. São **8
arquivos** que abrem uma dessas duas camadas — e **dois deles são telas NOVAS**
(`VisaoGeralScreen` e o `ModalNovaCampanha` do Gerenciador), que usam o overlay
legado.

> ### ⚠️ CORREÇÃO DE SEVERIDADE — medido, não presumido
> O pedido foi para registrar como **"defeito visível em produção"**. **Ele não
> é**, e a linha que decide é `dbEnv.ts:56`:
>
> ```ts
> avisar: !conhecido.producao
> ```
>
> A faixa aparece quando o banco **não** é a produção. Em produção ela não
> existe, `--tk-faixa-topo` fica `0px` e nada é cortado.
>
> **O que é verdade:** o defeito atinge **todo ambiente que mostra a faixa** —
> desenvolvimento, `localhost`, ref desconhecido e URL não identificada. Ou
> seja: **toda sessão de trabalho, todo dia**, e nenhuma sessão de usuário.
>
> ⛔ Registrar "produção" mandaria o próximo a correr atrás de um sintoma que
> nenhum usuário tem — e, pior, faria a fila inteira ser priorizada por um número
> errado.

**A correção é de uma linha por camada**, no `globals.css`:
`top: var(--tk-faixa-topo, 0px)` em `.drawer-backdrop` e `.modal-backdrop`. Não
foi feita porque as duas são anteriores a `4e6aa9e` — **decisão confirmada pelo
dono**. Quando for feita, o `0px` de padrão garante que produção não muda.

## ➡️ PRÓXIMA: Integrações › Webhooks

`WebhooksView`, **532 linhas**. Depois dela sobram **Criativos, Login, Taxas,
Áreas e Notificações** — todas menores que qualquer uma das seis já feitas.

> ### 🔴 WEBHOOKS HERDA A REGRA DO ARTEFATO INTEIRA — e na forma mais cara
> A URL do webhook é **artefato válido de contexto errado** em estado puro: ela
> é colada no painel do gateway do cliente. Uma URL de outra área é um endereço
> perfeitamente funcional, que aceita o payload e credita a venda na operação
> errada — e nada, em lugar nenhum, dá erro.
>
> ⚠️ E ali a fixture precisa das duas formas, como no Pixel: trocar de WEBHOOK
> muda o token dentro da URL (conteúdo), trocar de ÁREA muda a LISTA de webhooks
> alcançáveis (contexto). `Webhook.workspaceId` existe e NULO = sem dono, então a
> assimetria da Principal vale igual.


---

# 📌 ESTADO DA SESSÃO — 11/08/2026 (parte 5: o conserto do legado e o preparo de Webhooks)

> **A mais nova.** ⛔ **NADA FOI PARA O GITHUB.** `main` em `4e6aa9e`, branch
> ausente no remoto.

## ✅ AS CAMADAS LEGADAS FORAM CONSERTADAS — e eram DUAS linhas, não oito

O pedido supunha 8 arquivos. **Não é**: os 8 são os CONSUMIDORES. O `top` mora
na classe, e as classes são duas, no `globals.css`:

| | |
|---|---|
| `.drawer-backdrop` (`z-index` 70) | ✅ `top: var(--tk-faixa-topo, 0px)` |
| `.modal-backdrop` (`z-index` 80) | ✅ idem |

⚠️ **`.dialog-backdrop` ficou de fora de propósito.** Ela é a camada antiga que
**não porta para o `<body>`**, está documentada como "não usar em código novo", e
**nenhum `.tsx` a usa**. Consertar CSS morto acrescenta uma linha que ninguém
executa e faz parecer que há três camadas vivas.

### 👁️ Verificado na tela, nos dois tipos

| | |
|---|---|
| **Drawer legado** (`RuleDrawer`, em Regras) | ✅ *"Nova regra"* aparece **inteira**, abaixo da faixa. Era este o caso real: gaveta é de altura cheia e o título fica em `y=0` |
| **Modal legado** (`ModalNovaCampanha`) | ✅ abre centralizado — ele **nunca** encostava no topo. A linha o protege só quando o painel for mais alto que a viewport e a rolagem levar o topo para lá |

🔎 E a conferência mostrou, de quebra, **a razão de a `tk/Gaveta` existir**: o
anel de foco do campo dentro do `RuleDrawer` sai **roxo**, e não azul. O portal
para o `<body>` está fora da ponte `.tk-tema`, então o legado resolve
`--color-accent` para o valor antigo. É o mesmo diagnóstico, agora com evidência
visual.

## 🕳️ ACHADO NOVO, de graça: `.route-progress` é CSS ÓRFÃO

Uma barra de progresso de rota, `position: fixed; top: 0; height: 2px;
z-index: 60` — com **zero consumidores** (`grep` em `src/` só acha o próprio
`globals.css`). Ela não foi consertada nem removida: é CSS morto, e mexer nele
agora misturaria faxina com o assunto do commit.

⚠️ Vale registrar por dois motivos: ela é **mais um caso da família "existe e
ninguém consome"**, e — se um dia alguém a ligar — ela nasce **invisível em
desenvolvimento**, porque `z-index: 60` está sob a faixa (200) e `top: 0` cai
exatamente debaixo dela. Quem a religar vai jurar que ela não funciona.

## 🔎 WEBHOOKS — o que já está MEDIDO, para a próxima sessão não remedir

| Pergunta | Resposta, com a linha |
|---|---|
| o escopo tem o mesmo catch-all? | ✅ **sim** — `listWebhooks` chama o **mesmo `escopoDeConfig`** (`actions/webhooks.ts:101`), e o comentário da linha 91 já diz *"na Principal a lista inclui os de `workspaceId` NULO"* |
| então a fixture precisa de três? | ✅ **precisa** — área A, área B e um **órfão**. Com um só, a asserção de área passa sem exercer o recorte, exatamente como no Pixel |
| o que o artefato carrega dentro? | o **token**: `/api/webhook/sale/<token>`, e a Kirvano tem URL própria (`/api/webhook/kirvano?id=`, `webhooks.ts:49`) — são **duas formas de URL**, e as duas precisam entrar na asserção |

> ### 🔴 WEBHOOKS É A FORMA MAIS CARA DO ARTEFATO DE CONTEXTO ERRADO
> Pior que o Pixel, e o dono nomeou por quê: **quem cola a URL é uma terceira
> parte que a gente não vê** — o painel do gateway. A URL de outra área é um
> endereço perfeitamente funcional: aceita o payload, responde 200, credita a
> venda **na operação errada**.
>
> ⚠️ **E o sintoma não se parece com erro.** Ele aparece como *venda faltando*
> numa área e *venda a mais* em outra — dois números plausíveis, em telas
> diferentes, sem nada que os ligue. Não há log, não há alerta, não há 4xx.

## ➡️ PRÓXIMA: Integrações › Webhooks

`WebhooksView`, **532 linhas** — a penúltima legada que serve rota. Depois dela
sobram **Criativos, Login, Taxas, Áreas e Notificações**, as cinco menores.

⛔ Antes de codificar, as três perguntas de sempre — e mais a nova:
**"que valor deveria ser IGUAL a este, e é?"**

---

---

# ⏭️⏮️ SELO DE ESTADO FALA DO FUTURO. CONTADOR FALA DO PASSADO.

> **Formulação do dono, 11/08/2026, sobre o achado mais grave do redesign.**
> Nasceu em Webhooks e **não é regra de Webhooks** — ela decide todo lugar em
> que um selo e um número dividem a mesma linha.

| | Responde | Fonte |
|---|---|---|
| **selo de estado** | *"vai aceitar a próxima?"* | a CONFIGURAÇÃO de agora |
| **contador** | *"aceitou quantas?"* | o HISTÓRICO |

> ## Os dois podem discordar sem nenhum estar errado — e **esconder a discordância é o defeito**.

### O caso que produziu a regra

A tela antiga de Webhooks mostrava o selo verde **"Ativado"** num webhook que o
servidor recusava com **401** em toda venda. Pior: a mensagem do 401
(`gateways/autenticar.ts:75`) manda o usuário *"editar o webhook na aba
Integrações › Webhooks"* — **a tela estava contradizendo a mensagem de erro que
apontava para ela mesma.**

Hoje o mesmo webhook mostra `recusando vendas` **e** `14 vendas recebidas`, lado
a lado. As duas afirmações são verdadeiras, e é a coexistência delas que informa:
*já funcionou, e parou de funcionar*.

> ### ⛔ A PERGUNTA, ANTES DE ESCOLHER O QUE O SELO MOSTRA
> **"Este selo descreve o que aconteceu, ou o que vai acontecer?"**
>
> Se ele deriva do histórico (`eventCount > 0` → "ativo"), ele **não é selo de
> estado** — é o contador com outra roupa, e a redundância custa a única linha
> em que caberia a informação que falta.

⚠️ **O modo de falha é sempre para o lado tranquilizador**, porque o histórico
costuma ser bom e a configuração é que quebrou. Um selo derivado do passado
**nunca** consegue dizer "isto vai falhar" — ele só sabe dizer que já deu certo.

⚠️ **Onde reaparece nesta base:** conta de anúncio (`status` × `effectiveStatus`,
que é a mesma regra com outros nomes), pixel (`enabled` × eventos recebidos),
credencial de API (`revoked` × `lastUsedAt`), perfil da Meta (token válido ×
última sincronização). Em todos, um lado é configuração e o outro é histórico.

---

# 🪦 ANTES DE DELETAR UM ÓRFÃO, PERGUNTE O QUE ELE **FAZIA** — não se é usado

> **Formulação do dono, 11/08/2026, e ela é o CONTRAPESO de dez sessões
> deletando código morto.** Sem ela, a disciplina de faxina desta base vira uma
> máquina de apagar comportamento.

> ## Efeito colateral necessário não tem CONSUMIDOR — tem CONSEQUÊNCIA. O lint não distingue os dois.

O caso: `segredoInicial`, no `useTraffikState`. Depois de deletar a
`WebhooksView`, o lint o apontou como `assigned a value but never used`, junto
de outros cinco símbolos genuinamente mortos. Ele **gerava a chave de segurança
da Cakto**.

| Se eu tivesse apagado | |
|---|---|
| `tsc`, lint, build, 33 asserções | ✅ todos verdes |
| o webhook da Cakto | nasceria com `secret` NULO |
| a Cakto é `exigir: true` | **toda venda voltaria 401** |
| o sintoma do lado de cá | *"nenhuma venda chegando"* — indistinguível de *"ninguém comprou"* |

### As duas perguntas, e por que a segunda é outra

| Pergunta | O que ela acha |
|---|---|
| *"alguém importa isto?"* | o `grep` responde. Acha código **inerte** |
| **"o que este símbolo FAZIA?"** | só a leitura responde. Acha comportamento **desalojado** |

Código inerte pode ser apagado com segurança porque ninguém dependia dele.
Comportamento desalojado **tinha um dono que morreu**, e apagá-lo é remover o
efeito sem remover a necessidade dele.

> ### ⛔ A REGRA
> **Todo símbolo que o lint marcar como órfão depois de uma deleção passa por
> uma leitura, não só por um `grep`.** E a saída, quando ele FAZIA alguma coisa,
> não é mantê-lo onde está — é **mudá-lo de casa junto com o dono novo**.
>
> `segredoInicial` não voltou ao hook: virou `precisaGerar` + `geradas` dentro
> da `GavetaWebhook`, que é quem hoje precisa da chave.

⚠️ **É a irmã da regra da constante de texto** (*"ao remover uma tela, procure
as constantes dela — alguma descreve comportamento que MUDOU?"*). Aquela protege
contra reintroduzir o bug; esta protege contra apagar o conserto. As duas se
respondem lendo, e nenhuma se responde com `grep`.

⚠️ **O sinal de alerta é o símbolo ter um NOME DE AÇÃO** — `gerarX`, `iniciarY`,
`garantirZ`, `segredoInicial`. Órfão cosmético costuma se chamar `LABEL_X` ou
`corDoY`. Um órfão cujo nome é um verbo quase sempre fazia alguma coisa.

---

# 🔤 GUARDA QUE CONFERE CÓDIGO MIRA **DECLARAÇÃO OU CHAMADA**, NUNCA TEXTO LIVRE

> **Já é padrão: SEIS ocorrências.** Quatro registradas antes, duas em 11/08.
> Registrado como regra operacional porque a causa é sempre a mesma.

> ## Comentário e microcópia citam o símbolo **justamente para explicá-lo**. É por isso que a guarda os acha primeiro.

O arquivo que documenta por que algo existe contém o nome daquilo — e costuma
contê-lo **antes** do código, no cabeçalho. Então `indexOf`, `includes` e
qualquer `grep` por substring acham a PROSA e param ali.

| # | A guarda | O que ela pegou |
|---|---|---|
| 5 | `indexOf("listWebhooks(workspaceId)")` | o **cabeçalho do arquivo**, que cita a chamada para explicar por que ela precisa da área |
| 6 | filtro por nome de gateway | a **continuação de um bloco de comentário** — linha que não começa com asterisco |

> ### ⛔ AS TRÊS SAÍDAS, nesta ordem
>
> | | |
> |---|---|
> | 1 | **Leve a SINTAXE junto.** `listWebhooks(workspaceId)\n      .then` — prosa não tem `.then`. `const [carregando,` — prosa não tem a declaração |
> | 2 | **APAGUE os comentários antes de medir**, preservando as quebras de linha para o número reportado continuar sendo o do arquivo |
> | 3 | **Confira por LINHA**, exigindo que a linha contenha também o caminho autorizado — e reporte QUAL linha |
>
> ⛔ Filtrar linha que "começa com `*`" **não basta**: um bloco `/* … */` de
> várias linhas tem continuações que não começam com nada. Foi assim que a 6ª
> caiu.

### ⚠️ E o CRLF fecha a armadilha por baixo

**402 arquivos versionados estão em CRLF**, e a árvore de trabalho continua assim
de propósito. Toda âncora multilinha com `\n` — inclusive as três saídas acima —
**falha nesses arquivos, e falha em silêncio**: devolve "não achei" com a mesma
cara de "está tudo certo".

> ### 🔴 O QUE TRANSFORMOU O SILÊNCIO EM FALHA NOMEADA FOI A LINHA DE BASE
> ```js
> const i = TELA.indexOf("listWebhooks(workspaceId)\n      .then");
> assert.ok(i > 0, "linha de base: a chamada não existe no CÓDIGO");
> ```
> Sem essa linha, a guarda seguiria adiante com `i = -1`, mediria uma janela
> vazia e **passaria**. Ela é o que separa *"conferi e está certo"* de *"não
> consegui conferir"* — e as duas são o mesmo resultado para quem lê o rodapé.
>
> **Normalize a quebra na leitura** (`.replace(/\r\n/g, "\n")`) **e leve a linha
> de base junto.** As duas coisas, sempre: a primeira evita a falha, a segunda a
> denuncia quando ela acontecer por outro motivo.

# 🎨 O CANVAS 1×1 PRECISA SER LIMPO — a receita desta base tinha um buraco

> **Registrado em 11/08/2026 porque eu quase reportei um contraste de 1,01:1
> que não existia.** É a segunda entrada da categoria *defeito relatado onde não
> havia*, e desta vez a culpa é da TÉCNICA, não da leitura.

O `CLAUDE.md` prescreve *"rasterizar num canvas 1×1"* para medir cor, porque
`getComputedStyle` devolve `lab(...)`/`oklch(...)` neste projeto e comparar
string de cor não mede nada. A receita está certa e **incompleta**.

Eu pintei os dois valores — texto e fundo — **no mesmo canvas, sem limpar**. O
fundo era `oklch(… / 0.14)`, ou seja **translúcido**: ele foi composto **sobre a
cor do texto** que eu tinha acabado de pintar.

| | |
|---|---|
| o que eu li | texto `rgb(197,0,18)` sobre fundo `rgb(199,5,20)` → **1,01:1** |
| o que era | texto `rgb(197,0,18)` sobre `rgb(249,224,224)` → **4,96:1**, passa no AA |

> ### 🔴 O SINAL DE ALERTA É OS DOIS NÚMEROS SEREM QUASE IGUAIS
> Duas cores de papéis opostos que medem quase a mesma coisa não são um
> contraste ruim — são a **assinatura de uma composição acidental**. Contraste
> ruim de verdade vem de tokens distantes com luminância parecida, não de dois
> valores separados por 2 pontos em cada canal.

> ### ⛔ A RECEITA COMPLETA
> **Cor translúcida só pode ser medida SOBRE o fundo real que estará por baixo
> dela.** Pinte o backdrop primeiro, a cor por cima, e leia — e para a cor do
> TEXTO use um canvas limpo, porque ela não compõe com nada.
>
> ```js
> const rgb = (css, sobre) => {
>   const c = document.createElement("canvas"); c.width = c.height = 1;
>   const x = c.getContext("2d");
>   if (sobre) { x.fillStyle = sobre; x.fillRect(0, 0, 1, 1); }  // o backdrop REAL
>   x.fillStyle = css; x.fillRect(0, 0, 1, 1);                    // e só então a cor
>   const d = x.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]];
> };
> ```

⚠️ **E `fillStyle` ACEITA `lab()`/`oklch()`** — conferido. A primeira teoria que
me ocorreu foi que ele recusava e mantinha o valor anterior; era elegante e
errada. *O sinal de alerta é a teoria ficar boa cedo demais* — terceira vez.

---

# 📌 ESTADO DA SESSÃO — 11/08/2026 (parte 6: WEBHOOKS, a nona tela)

> **A mais nova. Se contradisser qualquer coisa acima, ela vence.**
>
> ⛔ **NADA FOI PARA O GITHUB.** `main` em `4e6aa9e`, branch ausente no remoto.

## ✅ A NONA TELA EXISTE — e a `WebhooksView` (532 linhas) morreu

| | |
|---|---|
| `views/webhooks/WebhooksScreen.tsx` · `GavetaWebhook.tsx` | a tela e a gaveta |
| `lib/webhooks/estado.ts` | os 5 estados e os 2 motivos de vazio, **puro** |
| `lib/webhooks/retencao.ts` | **MOVE** dos prazos de purga para fora da rota do cron |
| `tk/CampoCopiavel.tsx` · `tk/useCopiar.ts` | o segundo é MOVE do UTM |
| `tk/Input` ganhou `mono` | valor comparado caractere a caractere pede fonte mono |
| `scripts/webhook-dev.mjs` (`npm run dev:webhook`) | o seed parou de produzir estado inválido |
| testes | `test:webhooks-tela` **33**, no `npm test` no MESMO commit |

`04`: seção **nova**, de **0 ✅ / 24 ❌** para **18 ✅ / 0 ❌ / 6 🔧**. O
`docs:estado` conta **10 telas**. Baseline validado: as 9 outras idênticas.

## 🐛 O DEFEITO QUE A TELA ANTIGA PINTAVA DE VERDE

`autenticar()` (`gateways/autenticar.ts:75`) recusa com **401** quando o gateway
exige chave e não há nenhuma — e a mensagem dele manda o usuário *"editar o
webhook na aba Integrações › Webhooks"*, que é **esta tela**. A `WebhooksView`
mostrava esse webhook com o selo **"Ativado"**.

**Medido no dev:** os DOIS estavam assim, com **25 `WebhookLog` REJEITADO** de
KIRVANO provando. ✅ Não é conta nova — `hasSecret` já vinha no DTO e
`auth.exigir` já está no registro. É apresentação.

⚠️ **O selo fala do FUTURO; o número ao lado, do passado.** O webhook que recusa
mostra `14 vendas recebidas` **e** `recusando vendas`, os dois verdadeiros.

## 🔑 O QUE QUASE SE PERDEU, e o modo de falha era mudo

`segredoInicial`, no `useTraffikState`, gerava a chave da Cakto. O **lint** o
marcou como órfão depois da deleção — e ele **não era código morto, era
comportamento**: sem ele o webhook da Cakto nasce com `secret` NULO, a Cakto é
`exigir: true`, e **toda venda volta 401**.

> ⛔ É a regra *"ao remover uma tela, procure as constantes dela"* pagando a
> conta. A pergunta que salvou não foi "isto é usado?" — foi **"o que este
> símbolo FAZIA?"**.

## 🧹 A faxina que a deleção obrigou — e o `listRules()` de novo

**36 acessores** do hook ficaram órfãos. Saíram, e com eles a
`listApiCredentials()` que o **layout rodava em todo carregamento de página**
para alimentar ninguém — o mesmo defeito do `listRules()` de 05/08. **−144
linhas** no monolito (`useTraffikState`).

## 🔤 QUINTA E SEXTA VEZ: guarda por texto medindo PROSA

| | |
|---|---|
| `indexOf("listWebhooks(workspaceId)")` | achou **o comentário do cabeçalho**, que cita a chamada para explicar por que ela precisa da área |
| filtro de nome de gateway | reprovou pela **continuação de um bloco de comentário**, que não começa com asterisco |

E as âncoras multilinha ainda falhavam por **CRLF** — a armadilha dos 402
arquivos. **Só a asserção de LINHA DE BASE transformou o silêncio em falha
nomeada.** Hoje as leituras normalizam a quebra, e o filtro **apaga** comentário
antes de medir em vez de filtrar por linha.

✅ **Provado pelo lado negativo:** plantando `listWebhooks()` e deps `[versao]`,
a suíte sai com 2 falhas nomeadas.

## 🌱 `dev:webhook` — o seed produzia estado INCOMPLETO **e INVÁLIDO**

| | antes | agora |
|---|---|---|
| `eventCount` / `lastEventAt` | **0 e NULO** nos dois, com 43 e 14 `Sale` apontando | derivados das vendas |
| `secret` | **NULO nos dois** — na Kirvano, recusa tudo | um com, um **sem, de propósito** |
| gateways distintos | 1 | 2 |

⚠️ **100% dos webhooks do dev estavam em erro e NENHUM no estado normal.**
Idempotente, provado rodando duas vezes. A Cakto que ele cria exercita duas
coisas **nunca vistas**: a segunda forma de URL (`/api/webhook/sale/`) e a
exibição da chave gerada por nós.

## 👁️ O que foi VISTO, e o que não

| | |
|---|---|
| 3 dos 5 estados na mesma tela | `recebendo` · `recusando` · `mudo` |
| os 2 estados vazios da lista de entregas | `nunca-recebeu` e `purgado` |
| os 2 fluxos de chave (de 3) | o gerado (Cakto) e o que pede (Kirvano) |
| não-regeração da chave | **medida na tela**: reclicar e ir-e-voltar devolvem o mesmo UUID |
| contraste da caixa de alerta | **medido**: 4,96:1 no tema claro |
| tema escuro | ✅ **visto**, ⚠️ números não medidos |
| ⛔ largura estreita | **não verificada** — agora deve em **cinco** telas |

⚠️ **Duas vezes o screenshot quase produziu falso positivo** (um "/" que era "7",
um esqueleto que era carregamento). Nas duas, medir o DOM resolveu. Screenshot
desta base não é prova.

## 📋 ACHADOS ADIADOS — três novos

| Achado | O que já se sabe |
|---|---|
| **`ApiCredential.workspaceId` tem leitores e ZERO escritores** | 🔗 **o MESMO defeito do `Sale.apiCredentialId`, uma camada acima — e provavelmente serão resolvidos juntos.** Ver o bloco próprio abaixo |
| **A `PixelScreen` rolou o próprio interruptor inline** | `PixelScreen:205-225` desenha um botão com `role="switch"` à mão, enquanto `tk/Controles` exporta `Switch`. É a segunda aparência de interruptor da base. A `WebhooksScreen` usa o primitivo |
| **`.route-progress` continua CSS órfão** | achado na sessão passada, não tocado. Se alguém o religar, nasce invisível: `z-index: 60` sob a faixa (200), e `top: 0` cai debaixo dela |

> ### 🔴 O `ApiCredential.workspaceId` É O `Sale.apiCredentialId` DE NOVO — a
> ### camada de cima do MESMO buraco
>
> **Medido em 11/08/2026. Congelado: os dois arquivos são de `9f9dfa9`, 24/07.**
>
> | | `Sale.apiCredentialId` (achado em 05/08) | `ApiCredential.workspaceId` (agora) |
> |---|---|---|
> | leitores | **6** (`precedencia`, `metrics`, `overview`, `creatives`, `exclusao`, `notifications`) | **2** (`areas/atribuicao.ts:37`, `areas/exclusao.ts:350`) |
> | escritores | **0** — corrigido para as próximas | **0** — `createApiCredential()` não grava área nenhuma |
> | o que nunca dispara | o passo 4 da precedência não sabia QUAL credencial | o passo 4 não sabe DE QUEM ela é |
>
> ⚠️ **Consertar só um dos dois não resolve nada.** Com a venda carimbada e a
> credencial órfã, o passo 4 acha a credencial e ela não reivindica área — o
> ramo continua caindo na Principal, agora por outro motivo. Foi por isso que
> este ficou registrado com aquele: **a cadeia só funciona inteira.**
>
> ⛔ E há uma pergunta de PRODUTO antes da de código, que é do dono: *a chave de
> API pertence a uma área, ou à conta?* Hoje o comportamento real é "à conta", e
> a tela nova **declara** isso. Se a resposta for "à área", a `WebhooksScreen`
> passa a recortar a lista e a frase sai — mas aí é mudança de comportamento,
> item a item, e não passagem de commit de tela.

## ➡️ PRÓXIMA

Sobram **Criativos** (imagem 9), **Login** (10 e 11), **Taxas**, **Áreas** e
**Notificações**. `Regras` (21 ❌) segue sendo a maior dívida isolada.

⚠️ **`AnunciosView` (322) é a ÚLTIMA legada de Integrações servindo rota.** Ela
morre na reescrita dela.

---

# 🖼️ ARTEFATO DE TERCEIRO QUE **EXPIRA** — a quarta forma, e ela não dá erro

> **Medida em 12/08/2026, na tela de Criativos.** As três formas anteriores
> falam do que NÓS entregamos. Esta fala do que **outro sistema** nos empresta —
> e o modo de falha é diferente das três.

| Forma | Como falha |
|---|---|
| conteúdo errado | o artefato carrega o contexto errado dentro de si |
| contexto errado | o artefato é válido e é de outro dono |
| **expira** | 🔴 o artefato **era** válido, e deixou de ser — sem ninguém tocar em nada |

### O caso, e os números

`Creative.thumbnailUrl` é gravado direto do `thumbnail_url` da Graph API, sem
cópia nossa. Medido no backup de produção de 01/08, nos **13 de 13** criativos
reais da conta do dono:

| | |
|---|---|
| resolução | **`_p64x64` em 13 de 13** — é ícone, não miniatura |
| expiração (parâmetro `oe=`, hex unix) | de **34h** a **4,5 dias** após o sync |
| `imageUrl` (a imagem grande) | existe em **1 de 13**; os outros 12 são vídeo |
| em 12/08 | **as treze vencidas havia uma semana** |

> ## O estado NORMAL desta tela em produção é a imagem não carregar. Não é caso de borda — é o caso comum.

### ⛔ E o `<img>` sem `onError` transforma isso em quadrado vazio MUDO

A tela antiga tinha exatamente isso. Nada no código estava errado; nada no build
acusava; e a tela ficou assim por tempo indeterminado, porque **ninguém abre a
tela de Criativos quatro dias depois do último sync com a intenção de conferir
uma imagem.**

> ### ⛔ AS DUAS REGRAS QUE FICAM
>
> **1. Todo `<img>` com URL de terceiro leva `onError`.** Sem ele o fracasso é
> um buraco que não se explica. E o fallback **não é um retângulo cinza** — um
> retângulo vazio AFIRMA "carregando", e nada está carregando. Ele desenha
> conteúdo de verdade e declara a causa.
>
> **2. "Tentei e falhou" e "nunca houve URL" são fatos DIFERENTES**, e o selo só
> aparece no primeiro. É a distinção central deste projeto (`—` × `0`) na camada
> de imagem: colapsar as duas faz a tela afirmar que a Meta recusou algo que ela
> nunca mandou.

⚠️ **A pergunta que generaliza:** *este recurso é NOSSO, ou é um empréstimo com
prazo?* URL assinada, token de terceiro, link pré-assinado de storage, sessão
OAuth — todos têm a mesma forma. O que decide não é se o valor está certo hoje;
é se ele continua certo amanhã sem ninguém fazer nada.

---

# 🎚️ TESTE QUE CONSTRÓI A PRÓPRIA ENTRADA NÃO VERIFICA O RECORTE QUE O PRODUTO USA

> **Formulação do dono, 12/08/2026, sobre o achado da rodada.** É a família do
> gerador vista pelo outro lado — e o outro lado é o mais difícil de enxergar,
> porque **a suíte fica verde e ela tem razão de ficar**.

> ## As 20 asserções estavam certas. Elas simplesmente não olham para o mesmo lugar que a tela.

O caso: `criativos-dev` plantava a queda de CTR como **degrau na metade** dos 14
dias. A tela abre em **Últimos 7 dias** — a janela inteira caía do mesmo lado do
degrau. Resultado: **`Em queda 0`** com quatro criativos plantados em queda, e
`Em queda` é a aba que justifica a tela existir.

| | |
|---|---|
| o que a suíte dizia | ✅ **20 verdes**, seis delas sobre a tendência |
| por que ela não podia pegar | as asserções montam **metades sintéticas** (`metade(10_000, 300)`) e passam direto para a função |
| o que elas nunca perguntam | *"que janela a TELA pede, e o efeito aparece dentro dela?"* |
| quem pegou | a **passada visual**, no primeiro screenshot |

### 🔁 É primo do "teste que estraga o banco" — AO CONTRÁRIO

| | |
|---|---|
| **teste que estraga o banco** | escreve estado que ninguém liga a ele, e a próxima pessoa conclui sobre o PRODUTO |
| **teste que constrói a entrada** | 🔴 **não estraga nada.** Ele só não olha para o mesmo lugar |

O primeiro deixa rastro; alguém acaba tropeçando nele. O segundo é
**perfeitamente limpo e perfeitamente cego** — não há sintoma, não há resíduo,
não há nada para tropeçar. A cobertura é real para a função e **inexistente para
o caminho**, e nada na saída distingue as duas.

⚠️ E não é caso de "escrever mais asserções": a fixture sintética é o que torna o
teste puro, rápido e determinístico. **O defeito não está no teste — está em
confiar que ele responde uma pergunta que ele não faz.**

> ### ⛔ AS DUAS REGRAS
>
> **1. Todo dado sintético com dimensão temporal é exercitável na JANELA PADRÃO
> da tela que o consome** — e a forma que garante isso é a **rampa**, não o
> degrau: com variação gradual, qualquer recorte largo o bastante vê a
> inclinação. Degrau só aparece para quem enquadra exatamente em cima dele.
>
> **2. Quando a fixture do teste não é o dado do produto, a verificação do
> RECORTE é a passada visual** — e ela deixa de ser conferência de acabamento
> para virar a única testemunha daquele caminho. Não é opcional na tela em que o
> recorte carrega a informação.
>
> A pergunta, ao semear série temporal: *qual período a tela abre — e o efeito
> que estou plantando aparece DENTRO dele?*

⚠️ Prima do `n % 2` do BOLETO e do `splitPipe` com id não numérico. A diferença é
que naqueles o estado gerado estava **errado**; aqui ele estava **correto** — só
invisível pelo enquadramento. Estado errado alguém desconfia; estado certo fora
de quadro, não.

---

# 🎚️ O SEED PRECISA CONVERSAR COM A JANELA PADRÃO DA TELA

> **12/08/2026, e é uma armadilha NOVA dentro da família do gerador** — o seed
> não produziu estado errado nem incompleto. Produziu estado **certo na janela
> errada**.

`criativos-dev` aplicava a tendência de queda como **degrau na metade** dos 14
dias: os 7 mais recentes com o fator, os 7 antigos sem. A tela abre em **Últimos
7 dias**. Ou seja: a janela inteira caía do mesmo lado do degrau, sem contraste
nenhum dentro dela.

**Resultado na tela: `Em queda 0`**, com quatro criativos plantados em queda — e
`Em queda` é a aba que justifica a tela existir.

| | |
|---|---|
| o que o teste dizia | ✅ 20 asserções verdes, incluindo seis sobre a tendência |
| por que ele não pegou | as asserções montam **metades sintéticas** e não sabem que janela a tela pede |
| quem pegou | a **passada visual**, no primeiro screenshot |

> ### ⛔ A REGRA
> **Todo dado sintético com dimensão temporal precisa ser exercitável na JANELA
> PADRÃO da tela que o consome** — e a forma que garante isso é a **rampa**, não
> o degrau: com variação gradual, qualquer recorte suficientemente largo vê a
> inclinação. Degrau só é visível para quem enquadra exatamente em cima dele.
>
> A pergunta, ao semear série temporal: *qual período a tela abre — e o efeito
> que estou plantando aparece DENTRO dele?*

⚠️ É prima do `n % 2` do BOLETO e do `splitPipe` com id não numérico: nas três, o
gerador entrega o estado que impede de ver o que se ia verificar. A diferença é
que aqui o estado estava **correto** — só invisível pelo enquadramento.

---

# 📌 ESTADO DA SESSÃO — 12/08/2026 (CRIATIVOS, a décima tela)

> **A mais nova. Se contradisser qualquer coisa acima, ela vence.**
>
> ⛔ **NADA FOI PARA O GITHUB.** `main` em `4e6aa9e`, branch ausente no remoto.

## ✅ A DÉCIMA TELA EXISTE — e a `CreativesView` morreu

| | |
|---|---|
| `views/criativos/CriativosScreen.tsx` | a tela: 6 KPIs · 4 abas · alternador grade/tabela · paginação |
| `lib/ads/criativos.ts` | **puro** — tendência, veiculação, KPIs, abas. Não importa o prisma, de propósito |
| `tk/PreviaCriativo` · `tk/CardCriativo` · `tk/TabelaCriativos` | os três componentes novos |
| `lib/ads/creatives.ts` | **+ADITIVO**: `status`, `effectiveStatus`, `impressions`, `clicks`, `cpc`, `conversao`, `anterior`, `recente`. Nenhum campo existente mudou de valor |
| `scripts/criativos-dev.mjs` (`npm run dev:criativos`) | o seed que faltava |
| deletados | `CreativesView` (81) e `ImageSlot` |
| testes | `test:criativos` **20 asserções**, no `npm test` no MESMO commit |

`04`: de **0 ✅ / 13 ❌** para **12 ✅ / 0 ❌ / 3 🔧**. Baseline validado: as 9
outras telas saíram idênticas.

## 🔴 O DEV NÃO TINHA CRIATIVO NENHUM — e mais duas camadas

Medido antes de escrever uma linha:

| | dev, antes |
|---|---|
| `Creative` | **0 linhas** — e `computeCreatives` filtra `creative: { isNot: null }` |
| `utmContent` (venda e clique) | **NULL nas 47 vendas** → todo ROAS por criativo seria `—` |
| `DailyAdMetric` | **1 dia por anúncio** → `Em queda` sem duas metades |

Três camadas, e **cada uma sozinha já esvaziava a tela**. `dev:criativos` é
idempotente (provado em três execuções: 38/19 estável) e planta divergência nos
cinco eixos — mídia, formato, tendência, medição e atribuição.

⚠️ **O carimbo de UTM não era idempotente na primeira versão**: numerava só os
`IS NULL`, então cada execução consumia parte dos 19 que ficavam de fora. Em três
execuções o estado "sem atribuição" desapareceria. Hoje a numeração corre sobre
a população inteira, e `n % 3` é propriedade fixa do clique.

## 🐛 O QUE SÓ A TELA MOSTROU — três, e o primeiro é grave

| | |
|---|---|
| 🔴 **`Em queda 0`** com 4 plantados | o degrau do seed × a janela de 7 dias. Seção própria acima |
| **título do mundo antigo** | *"Ranking de Criativos · Os anúncios com melhor performance hoje"* — e as duas metades ficaram falsas: não é ranking (o recorte de maior valor é o de PIOR desempenho), e "hoje" contradizia o seletor de período logo abaixo, que abre em 7 dias |
| coluna `Criativo` engolindo a folga | ~400px de vazio entre o nome e `Estado` a 1568px. As colunas numéricas viraram `fr` com piso |

## 🔬 DUAS VEZES QUASE REPORTEI DEFEITO QUE NÃO EXISTIA — de novo

| O que eu ia reportar | O que era |
|---|---|
| *"há DOIS conjuntos de abas no DOM, o segundo zerado"* | marcador de Suspense do **streaming SSR** (`DIV#S:0[hidden]`, 0×0, inerte). **O Gerenciador tem os mesmos 4** — tela fechada em 08/08. Pré-existente do shell |
| *"o selo de indisponível não aparece"* | ele aparece **7 vezes**, exatamente nos de URL expirada. O screenshot a 1568px o comprime a ponto de sumir |

⚠️ Nos dois, medir o DOM resolveu. **Screenshot desta base não é prova** — é a
terceira sessão seguida em que isso se confirma.

## 👁️ O que foi VISTO, e o que foi MEDIDO

| | |
|---|---|
| fallback da miniatura | ✅ **7 selos** `pré-visualização indisponível`, e 3 imagens carregando ao lado |
| aba `Em queda` | ✅ card com pílula `↓ 23% CTR`, critério declarado acima da lista |
| grade e tabela | ✅ as duas, com a MESMA lista filtrada e ordenada |
| tema claro | ✅ **medido**: card branco puro · nome **17,85:1** · apoio e cabeçalho **4,97:1** · ROAS **5,17:1** |
| tema escuro | ✅ **visto** — ⚠️ números não medidos |
| ⛔ largura estreita | **não verificada** — agora deve em **seis** telas |

⚠️ O `Runtime.evaluate` congelou **uma vez** (script de ~25 linhas). Quebrado em
pedaços menores, funcionou. Mesmo sintoma de 11/08.

## 📋 ACHADOS ADIADOS — dois novos

| Achado | O que já se sabe |
|---|---|
| 🔎 **`valor ? fmt : "—"` — VARREDURA, ver o bloco abaixo** | achado em `useTraffikState`; **quase certamente há mais** |
| **A imagem sintética do seed vaza texto para fora do SVG** | cosmético, e é do `criativos-dev`, não da tela. O `<text>` a 34px estoura em nome longo |

> ### 🔎 VARREDURA PENDENTE: `valor ? fmt : "—"` — a distinção central colapsada por um `?`
>
> **Achado em 12/08/2026, e registrado como VARREDURA porque um caso não é o
> problema — o padrão é.**
>
> A linha que o denunciou vivia no mapa de apresentação dos criativos, no
> `useTraffikState`:
>
> ```ts
> ctrLabel: c.ctr ? pct(c.ctr) : "—"
> ```
>
> **`0` é falsy.** Um criativo com impressão e nenhum clique tem CTR **medido**
> de 0% — e a tela dizia `—`, que nesta base significa *"não foi medido"*. É a
> distinção central do projeto (`ausência de observação` × `observação de zero`)
> desfeita por um caractere.
>
> | O que o usuário lia | O que era |
> |---|---|
> | `—` "não temos esse dado" | **temos**: 12.500 impressões e zero cliques |
>
> ⚠️ **Aquela linha específica já morreu** — o mapa inteiro saiu na reescrita da
> tela, e a `CardCriativo` formata por `=== null`. **Não é conserto de
> congelado.** Ela está aqui como *evidência de que o padrão existe*, não como
> pendência daquele arquivo.
>
> #### Por que é caro, e por que nenhuma ferramenta pega
>
> `tsc`, lint e build passam: o tipo é `number | null`, o ternário é válido, a
> string sai formatada. O número resultante é **plausível**, e o erro é sempre
> na direção que **esconde uma medição real** — o oposto do que uma ferramenta
> de tráfego deve fazer com o único zero que importa (zero clique, zero venda,
> zero conversão são exatamente os valores que exigem ação).
>
> #### Como varrer — e o TAMANHO já está medido
>
> ```bash
> grep -rnE '\? [a-zA-Z_.]+\(' src/ --include=*.ts --include=*.tsx | grep -F ': "—"'
> grep -rnE '(\|\||\?\?) *"—"' src/ --include=*.ts --include=*.tsx
> ```
>
> Rodado em 12/08/2026: **7 ternários** e **17 `||`/`??`**. ⚠️ Os `??` são
> seguros por construção (`??` não dispara em `0`) — o alvo real são os `||` e os
> ternários, e os `||` achados estão todos em `design-system` e `actions/rules`,
> sobre **string**, onde vazio e ausente são a mesma coisa.
>
> > ### 🔑 O DISCRIMINADOR, e ele economiza a varredura inteira
> >
> > **Guardar o DENOMINADOR por veracidade está CERTO. Guardar o RESULTADO está
> > errado.**
> >
> > | | |
> > |---|---|
> > | `spd ? roasFmt(rev / spd) : "—"` | ✅ gasto zero **é** denominador ausente — o `—` é a resposta correta |
> > | `c.ctr ? pct(c.ctr) : "—"` | 🔴 o CTR **já é o resultado**, e `0` dele é medição |
> >
> > Os três de `useTraffikState:1122-1124` (`ctrLabel`, `cpaLabel`, `roasLabel`)
> > guardam o denominador e **estão corretos** — conferidos em 12/08. Não os
> > "conserte".
>
> ⛔ O `grep` acha candidatos, não defeitos. A pergunta por ocorrência é uma só:
> *o que está sendo testado é o denominador ou o valor final?* — e, se for o
> valor final, *`0` é alcançável e significa medição?*
>
> ⚠️ Os primos entram na mesma varredura: `valor && <X/>`, `if (!total)`,
> `Math.max(0, x) || padrao`. Todos colapsam `0` com ausência pela mesma porta.
>
> ⚠️ **A varredura de comentários que afirmam efeito continua na fila também** —
> são duas varreduras distintas, e esta é mais barata: o `grep` é preciso e a
> conferência é uma pergunta binária por linha.

## 🧩 O FECHAMENTO — três coisas, por ordem do dono

| | |
|---|---|
| **o caso do seed virou seção própria** | *TESTE QUE CONSTRÓI A PRÓPRIA ENTRADA NÃO VERIFICA O RECORTE QUE O PRODUTO USA*, acima. Ela saiu do relato desta tela de propósito: é regra transversal, e regra transversal presa dentro do relato de uma tela é regra que a próxima pessoa não acha |
| **o `valor ? fmt : "—"` virou VARREDURA** | com o tamanho medido (7 ternários · 17 `\|\|`/`??`) e o **discriminador** que economiza a varredura: guardar o DENOMINADOR por veracidade está certo, guardar o RESULTADO está errado |
| **"sem imagem é o caso comum" foi para o CÓDIGO** | duas vezes no `PreviaCriativo`: no cabeçalho, como título, e **dentro do ramo do fallback** — que é onde alguém editando seria tentado a encolhê-lo |

> ### ⛔ POR QUE O AVISO DA MINIATURA PRECISOU IR NO RAMO, e não só no cabeçalho
> Quem abre o arquivo para "melhorar a prévia" lê o JSX, não o bloco de 40 linhas
> no topo. E a leitura natural de *"a imagem não carregou"* é **caso raro, trate
> discreto** — encolher o bloco, apagar o selo, pôr um cinza neutro. Cada um
> desses movimentos parece polimento e é a tela mentindo sobre a própria condição
> normal: **12 de 13 criativos não têm imagem grande em lugar nenhum.**
>
> É a mesma mecânica de *COMENTÁRIO QUE PROÍBE É O MAIS PERIGOSO DE TODOS*, pelo
> avesso — lá o ⛔ envelhecido autorizava desfazer o conserto; aqui o ⛔ está no
> ponto exato em que o desfazer começaria.

## 🔴 ESTE ARQUIVO ESTÁ EM 263 KB — 1,75× o limite que ele próprio documenta

**Medido em 12/08/2026, ao fechar a sessão.** Não é observação de arrumação: se
o limite de 150 KB citado na seção do MAPA ainda valer, **2.244 das 5.024 linhas
— 45% do arquivo — estão depois do corte**, e o que cai fora inclui:

| |
|---|
| `MODO DE TRABALHO ATÉ AS DEZ TELAS EXISTIREM` — o modo de operação desta fase inteira |
| `ACHADOS ADIADOS` — **inclusive a varredura registrada hoje** |
| `DENOMINADOR ZERO`, `DESPESA RECORRENTE`, e ~12 regras nomeadas |
| **todo ESTADO DA SESSÃO de 08/08 em diante — inclusive este** |

> ### ⚠️ O QUE EU NÃO SEI, e não vou fingir que sei
> **Nesta sessão o conteúdo chegou completo** — eu li até a seção de 11/08 parte
> 6, que é a última. Ou seja: **ou o limite de 150 KB mudou, ou a frase do MAPA
> está velha.** Não tenho como distinguir os dois daqui, e afirmar que houve
> truncamento seria inventar uma medição.
>
> O que é **fato medido**: 263 KB, 1,75× o número escrito neste arquivo, e a
> curva é de crescimento — 05/08 reorganizou vindo de 548 KB, e em uma semana
> voltou a metade do caminho.

🔴 **A ironia é o que torna isto urgente:** as três coisas que o dono pediu para
registrar hoje — o caso do seed, a varredura do `? :` e o aviso da miniatura —
moram **todas** na metade de baixo. Um arquivo de regras que não chega é pior
que regra não escrita: ele produz a crença de que está registrado.

⛔ **Não reorganizei.** Mover seção é o tipo de mudança que precisa da decisão de
quem lê o arquivo todo dia, e fazê-la no fim de um commit de tela é exatamente o
que este arquivo proíbe. **A decisão é do dono**, e o caminho já existe: o MAPA
manda o que é temático para `docs/`, e os ESTADO DA SESSÃO antigos para
`docs/historico/`.

## ➡️ PRÓXIMA

Sobram **Login** (imagens 10 e 11), **Taxas**, **Áreas** e **Notificações**.
`Regras` (21 ❌) segue sendo a maior dívida isolada.

⚠️ **`AnunciosView` (322) é a ÚLTIMA legada de Integrações servindo rota.**

⚠️ E **antes de qualquer tela nova, decida o tamanho deste arquivo** — ver a
seção acima. Cada sessão acrescenta ~200 linhas na ponta de baixo, que é
justamente a metade em risco.

---

# 🖌️ O QUE O **NAVEGADOR** PINTA NÃO APARECE EM `getComputedStyle` — e é o par que faltava

> **12/08/2026, na tela de entrada.** Esta base repete, com razão, que
> *screenshot não é prova de cor* — três sessões seguidas quase produziram
> defeito inventado por ler pixel comprimido. Esta seção é o **contraexemplo que
> completa o par**, e sem ela a regra anterior vira cegueira.

O autopreenchimento do Chrome pinta o campo de branco. No tema escuro, quem tem
a senha salva via **dois retângulos brancos dentro do cartão escuro**. E:

| Instrumento | O que respondeu |
|---|---|
| `getComputedStyle(input).backgroundColor` | `transparent` — o valor DECLARADO, que está certo |
| o screenshot | 🔴 o defeito, imediatamente |

O navegador pinta `-internal-light-dark(...)` no pseudo-estado `:-webkit-autofill`
sem que isso apareça no estilo computado. **Medir o estilo declarado não acha, e
não vai achar nunca** — não é limitação da técnica do canvas 1×1, é que o valor
não está no CSSOM.

> ### ⛔ AS DUAS METADES, e cada uma cobre o furo da outra
>
> | | Serve para | Falha em |
> |---|---|---|
> | **medir o DOM** | cor, contraste, geometria, estado | o que o navegador pinta por conta própria |
> | **olhar a tela** | o que o navegador pinta por conta própria | ler valor de cor com precisão |
>
> A regra não é "screenshot não vale". É: **screenshot LEVANTA a hipótese,
> medição CONFIRMA — e quando a medição não alcança, diga que não alcança em vez
> de concluir que não há defeito.**

⚠️ **E o caso é o COMUM, não o de borda.** A tela de entrada é justamente onde o
gerenciador de senhas age. Uma tela que só fica certa para quem nunca salvou a
senha está errada para quase todo mundo que volta — mesma leitura de *"sem
imagem é o caso comum"* nos Criativos.

⚠️ **Outros pseudo-estados com a mesma propriedade**, e nenhum foi varrido:
`::-webkit-search-cancel-button`, `::-webkit-calendar-picker-indicator`,
`:-internal-autofill-selected`, o `accent-color` padrão de `checkbox`/`radio`
nativo, e a barra de rolagem. Todos são pintados pelo agente do usuário.

---

# 📌 ESTADO DA SESSÃO — 12/08/2026 (parte 2: LOGIN, a décima primeira tela)

> **A mais nova. Se contradisser qualquer coisa acima, ela vence.**
>
> ⛔ **NADA FOI PARA O GITHUB.** `main` em `4e6aa9e`, branch ausente no remoto.

## ✅ A TELA DE ENTRADA EXISTE — e as duas legadas de auth morreram

| | |
|---|---|
| `components/auth/TelaAuth.tsx` | a moldura, e o lugar onde mora a ponte |
| `components/auth/PainelMarca.tsx` | badge · headline · apoio · três provas · arco · rodapé |
| `components/auth/PreviaProduto.tsx` | o retrato do painel, com a nav REAL |
| `components/auth/FormularioAuth.tsx` | o cartão, nos dois modos |
| `components/auth/MarcaAuth.tsx` | logotipo por tema, pelo MESMO caminho do `Rail` |
| `lib/auth/conteudo.ts` | o texto como DADO puro — para poder ser conferido |
| `tk/Input` ganhou `revelavel` | o olho da senha, com `aria-label` que muda e `aria-pressed` |
| `globals.css` | `.tk-auth` / `.tk-auth-marca`, em `@layer components` |
| deletados | `AuthShell.tsx` (53) e `AuthForm.tsx` (79) |
| testes | `test:login` **22 asserções**, no `npm test` no MESMO commit |

`04`: seção de **0 ✅ / 19 ❌** para **14 ✅ / 0 ❌ / 5 🔧**. Baseline validado: as
9 outras telas saíram idênticas.

## 🔴 A PONTE FOI A PERGUNTA CERTA — e a medição diz que sim, ela era necessária

Esta é a **única tela fora do shell**, e é o `AppShell` que aplica `.tk-tema` nas
outras vinte e uma rotas. Medido no navegador:

```
--color-accent no <body>          rgb(109, 95, 224)   <- ROXO do legado
--color-accent na raiz .tk-auth   rgb( 37, 99, 235)   <- = --tk-primary
font-family  no <body>            Inter
font-family  na raiz .tk-auth     Instrument Sans
```

Sem a classe, três regras GLOBAIS continuariam roxas — `a { color }`,
`:focus-visible { outline }` e `::selection`, as três lendo `--color-accent`.
**Numa tela de formulário o alcance é máximo**: o anel de foco é o principal
sinal de navegação por teclado e está em todo campo. É o mesmo defeito do
`RuleDrawer` legado de 11/08.

✅ **Verificado pelo EFEITO, não só pelo token:** olho da senha focado →
`outlineColor` `rgb(37,99,235)`, 2px. `test:login` reprova se a classe sumir da
raiz — e a guarda mede o MARKUP, não o arquivo.

⚠️ Quando a ponte morrer, ela morre para as duas de uma vez: é a mesma classe.

## ⛔ TRÊS CONTROLES SEM BACKEND — medidos antes de desenhar, decididos pelo dono

| Controle | O que existe | Decisão de 12/08 |
|---|---|---|
| Google · Meta · Apple | **nada.** `src/auth.ts` tem só `Credentials` | ⛔ **FORA**, e o divisor `ou continue com` saiu junto |
| Lembrar de mim | **nada.** `strategy: "jwt"` sem `maxAge` | desenhado, **inerte** |
| Esqueci minha senha | **nada.** sem rota, sem tabela, sem e-mail | desenhado, **inerte** |

⚠️ Eu declarei o custo dos dois inertes antes; o dono manteve. **O "Esqueci
minha senha" não é link morto**: é `<button>` que revela *"A redefinição de senha
por e-mail ainda não está disponível."* Inerte continua inerte — o que muda é que
o fracasso fica legível para quem está trancado do lado de fora.

⚠️ `/api/auth/facebook` **não** é login: é OAuth da Marketing API, para conectar
conta de anúncio depois de entrar. Não confunda ao reabrir isto.

## ✅ A LARGURA ESTREITA FOI PAGA — a primeira das dez, e sem `resize_window`

A dívida estava em **seis telas** porque o `resize_window` mentiu quatro vezes.
Aqui ela caiu exercitando o **CÓDIGO** em vez do tamanho:

| O que | Como | Resultado |
|---|---|---|
| o painel some | limiar do `@media` a 3000px, temporário | uma coluna, **0 de 171** vazando, sem rolagem horizontal |
| nada estoura | `.tk-auth` apertada por JS a 360 / 390 / 430 / 768px | **0 vazando** nas quatro |
| defeito achado | cartão a 340px | `Lembrar de mim` quebrava e encostava no vizinho -> `flexWrap`. Reconferido: empilhou, 0 de 42 vazando |

⛔ **O limiar foi restaurado a 1024px**, conferido por `grep`.

> ### 🔑 O MÉTODO GENERALIZA, e é o que destrava as outras cinco
> **Quando não dá para encolher a janela, encolha o CONTÊINER.** `elemento.style.width`
> + contar descendentes que vazam do `getBoundingClientRect()` dele mede a mesma
> propriedade — "nada estoura" —, não depende da ferramenta que mente, e ainda
> **nomeia quem vazou**. Para o que depende de `@media`, mexer no limiar
> temporariamente exercita o ramo sem tocar no viewport.
>
> ⚠️ O que este método NÃO cobre: `100vw`/`100dvh`, `@container` ancorado em
> outro elemento, e o teclado virtual do telefone. Para o resto, ele basta.

## 🐛 O DEFEITO QUE SÓ O SCREENSHOT ACHOU

O autofill do Chrome pintando o campo de branco no tema escuro — regra própria
acima. Corrigido com `-webkit-box-shadow` interno, **escopado em `.tk-auth`**.

## 👁️ O que foi VISTO e o que foi MEDIDO

| | |
|---|---|
| os dois temas | ✅ **vistos E medidos** — 9 pares de contraste em cada, todos ≥ 4,5:1 |
| `/login` e `/signup` | ✅ os dois, com o painel esquerdo idêntico |
| o olho da senha | ✅ **exercido**: `password` -> `text`, rótulo e `aria-pressed` acompanham |
| `Esqueci minha senha` | ✅ **exercido**: revela a frase, `aria-expanded` acompanha |
| largura estreita | ✅ **paga** |
| ⛔ o CTA enviando de verdade | **não exercido** — exigiria criar conta ou errar senha de propósito no banco de dev |
| ⛔ o estado de erro do formulário | **não visto**: só aparece com credencial errada |

## ⚠️ EU SUSPENDI O GUARD DE SESSÃO PARA VER A TELA — e restaurei

A sessão de dev do Chrome está logada, então `/login` redireciona para
`/dashboard` (o guard funcionando). Suspendi o redirect nas duas páginas,
percorri a tela, e **restaurei** — provado por `grep` (nenhum vestígio) **e pelo
efeito**: `/login` volta a cair em `/dashboard`.

⛔ A alternativa era deslogar a sessão do dono, que este arquivo proíbe.

## ➡️ PRÓXIMA

Sobram **Taxas**, **Áreas** e **Notificações** — as três menores. Aí as doze
telas existem e **o `.tk-tema` pode morrer**.

`Regras` (21 ❌) segue sendo a maior dívida isolada, e `AnunciosView` (322) é a
última legada de Integrações servindo rota.

⚠️ **Este arquivo continua crescendo** — ver a seção de 12/08 parte 1, que mediu
263 KB. Esta sessão acrescentou ~180 linhas na ponta de baixo, que é a metade em
risco. **A decisão sobre o tamanho é sua e continua aberta.**

---

# 📐 A VARREDURA DE LARGURA ESTREITA NAS CINCO — agendada, com estimativa

> **Decisão do dono, 12/08/2026.** O método nasceu no Login e destrava
> Gerenciador · UTM · Pixel · Webhooks · Criativos. **Roda DEPOIS de Taxas,
> Áreas e Notificações** — mas não deixa crescer para dez.

## O método, em duas linhas

**Quando não dá para encolher a janela, encolha o CONTÊINER.**

```js
raiz.style.width = w + 'px';
const base = raiz.getBoundingClientRect();
[...raiz.querySelectorAll('*')].filter(e => {
  const r = e.getBoundingClientRect();
  return r.width > 0 && (r.right > base.right + 1 || r.left < base.left - 1);
});                       // ← e ele NOMEIA quem vazou, não só conta
```

Para o que depende de `@media`, elevar o limiar temporariamente exercita o ramo
estreito sem tocar no viewport. ⚠️ Restaure o limiar e confira por `grep`.

⛔ **O que o método NÃO cobre:** `100vw`/`100dvh`, `@container` ancorado em outro
elemento, e o teclado virtual do telefone.

## ⏱️ ESTIMATIVA: **UMA sessão para as cinco** — e o que a sustenta

Não é chute. Conferido estaticamente em 12/08, **sem rodar a varredura**:

| Evidência | Medida |
|---|---|
| `TabelaAds` · `TabelaCampanhas` · `TabelaCriativos` já declaram `overflow-x`/`minWidth` | **5 · 3 · 6** ocorrências |
| telas com `gridTemplateColumns` em **px fixo** (o que estoura de verdade) | **0** |

Ou seja: a parte que eu esperava ser cara — as ~20 colunas do Gerenciador —
**provavelmente já rola dentro do próprio contêiner**, que é exatamente o que o
requisito pede. A varredura deve ser **pesada em medição e leve em conserto**.

⚠️ **Gerenciador é a que pode surpreender**, e é a única. Se ela custar mais que
as outras quatro somadas, eu paro e aviso em vez de encadear — regra das duas
tentativas.

> ### ⛔ E A ESTIMATIVA TEM DE PODER FALHAR
> Ela vale **enquanto as duas linhas da tabela acima continuarem verdadeiras**.
> Uma tela nova com coluna em px fixo derruba a estimativa, não só o número.
> Reconfira as duas antes de agendar.

---

# 📌 ACHADOS ADIADOS — acrescentados em 12/08/2026 (LOGIN)

| Achado | O que já se sabe |
|---|---|
| 🔴 **O envio real e o estado de ERRO do formulário de login nunca foram exercidos** | ver o bloco próprio abaixo |
| **Autofill do Chrome em TODO formulário da base** | corrigido só em `.tk-auth`. O mesmo `-webkit-autofill` branco atinge Taxas, Áreas, Regras e todo `Input` do sistema novo. Consertar no primitivo é uma regra de CSS — mas muda a aparência de 21 rotas, e isso não entra em commit de tela |
| **`Input.revelavel` é o segundo controle de senha da base?** | não varri. `grep type="password"` antes de assumir que é o único |

> ### 🔴 O CAMINHO NÃO EXERCIDO É JUSTAMENTE O DO FRACASSO
>
> **Formulação do dono, 12/08/2026, e ela é mais forte que "falta testar".**
>
> O que ficou sem exercer no Login não é um caminho qualquer: é **o único que o
> usuário percorre quando algo dá errado**. Quem acerta a senha vê a tela por
> dois segundos e vai embora; quem erra fica ali, lendo.
>
> | Caminho | Estado |
> |---|---|
> | CTA enviando de verdade | ⛔ nunca exercido |
> | `state.error` desenhado (credencial inválida) | ⛔ nunca visto |
> | o giro do `carregando` durante o envio | ⛔ nunca visto |
>
> ⚠️ **Não exercer foi a decisão CERTA**, e o dono confirmou: exercer exigiria
> criar conta ou errar senha de propósito **no banco de dev** — escrita em tabela
> de dado de negócio para testar, que é a regra nº 1 do incidente de 29/07.
>
> ⛔ **E a saída NÃO é "testar direto no banco".** É montar a fixture: o
> `FormularioAuth` recebe a ação por prop, então uma passada visual pode passar
> uma ação falsa que devolve `{ error: "E-mail ou senha inválidos." }` e desenhar
> os três estados sem tocar em linha nenhuma. **A prop existe desde o primeiro
> commit da tela** — falta só usá-la.
>
> ⚠️ O `test:login` cobre a ESTRUTURA do erro (`role="alert"`, o par
> `aria-describedby`/`aria-invalid` do `Input`). O que falta é *como ficou*, e
> isso nenhuma asserção responde.

---

# 🔌 CAPACIDADE SEM CONTROLE — o avesso do controle inerte

> **Achado em 12/08/2026, na tela de Taxas.** Esta base tem dez registros sobre
> **controle que não controla nada**. Este é o espelho: **capacidade completa,
> testada, e nenhum controle que a alcance.**

| | O que existe | Como se descobre |
|---|---|---|
| **controle inerte** | o botão, e nada atrás dele | usando o produto — o usuário clica e nada acontece |
| **capacidade sem controle** | a lógica inteira, e nenhum botão | 🔴 **não se descobre.** Ninguém sente falta do que nunca viu |

O caso: `rateio.ts` respeita `DIARIA · SEMANAL · MENSAL · ANUAL` desde 06/08 —
função pura, com teste, consumida por `financeiro.ts`. E **a tela nunca deixou
escolher**: `addDespesa(nome, valor)` recebe dois argumentos e passa
`recurrence: "MENSAL"` fixo no código.

Consequência: ninguém usando o produto conseguia cadastrar uma despesa anual. A
correção do rateio — que mudou o Lucro em produção e teve mensagem escrita para
os testadores — entregou quatro frequências das quais **uma só era alcançável**.

> ### 🔴 E O `@default(UNICA)` DO SCHEMA É INALCANÇÁVEL PELO APP
> Todo caminho de criação passa frequência explícita (`?? "MENSAL"` na ação,
> `"MENSAL"` fixo no hook). Ou seja: o default do banco descreve um
> comportamento que **nenhum usuário jamais obteve**.
>
> Eu havia reportado o oposto — *"quem só preenche valor e salva cai em UNICA"* —
> inferindo do schema em vez de seguir os chamadores. O dono repetiu a premissa
> ao pedir o aviso, e **medir antes de codificar** foi o que impediu a tela de
> nascer resolvendo um problema que não existe.

> ### ⛔ A PERGUNTA QUE ACHA OS OUTROS CASOS
> Não é *"todo botão faz alguma coisa?"* — essa acha o inerte. É:
>
> > **"Todo ramo que o servidor sabe executar tem alguém que consegue pedir?"**
>
> Ela se responde indo da CAPACIDADE para a TELA, e não o contrário. O `grep` que
> serve é pelos valores de um enum: se o código trata cinco e a tela oferece um,
> os outros quatro são capacidade sem controle.

⚠️ **Candidatos nesta base, não investigados:** `ExpenseCalc` (`FIXO` só é
alcançável em alguns grupos), `PaymentMethod` na taxa de gateway, e os tipos de
`AutomationRule`. Todos são enum tratado no servidor.

---

# 📌 ESTADO DA SESSÃO — 12/08/2026 (parte 3: TAXAS, a décima segunda tela)

> **A mais nova. Se contradisser qualquer coisa acima, ela vence.**
>
> ⛔ **NADA FOI PARA O GITHUB.** `main` em `4e6aa9e`, branch ausente no remoto.

## ✅ A TELA EXISTE — e a `FeesView` (723 linhas) morreu

| | |
|---|---|
| `lib/taxas/apresentacao.ts` | a LINGUAGEM: incidência, grupos, frequências, o aviso. **Puro** |
| `views/taxas/SecaoTaxas.tsx` | os cinco grupos + a moldura. ⛔ **sem server action**, e é por isso que o teste renderiza |
| `views/taxas/TaxasScreen.tsx` | compõe as duas seções; é quem importa as ações |
| `useTraffikState` | +3 acessores: `despesasCruas`, `criarDespesa`, `removerDespesa`/`editarDespesa` |
| `scripts/taxas-dev.mjs` (`npm run dev:taxas`) | o seed que faltava |
| deletados | `FeesView` (723 linhas) |
| testes | `test:taxas` **21 asserções**, no `npm test` no MESMO commit |

`04`: seção **nova**, **15 ✅ / 0 ❌ / 2 🔧**. O `docs:estado` conta **11 telas**.
Baseline validado: as 10 anteriores idênticas.

## 🎯 AS TRÊS COISAS QUE O DONO PEDIU, E COMO CADA UMA FICOU

### 1 · A hierarquia — `Configuração da conta` × `Taxas e despesas`

Imposto sobre anúncios e fuso **ficam**, com os dois motivos do dono escritos no
cabeçalho da tela: o imposto entra no break-even, e o fuso decide o que é "hoje"
em todo o produto. O que muda é que agora são **duas seções nomeadas**, não seis
cartões empilhados — que era o motivo de eles parecerem fora de lugar.

### 2 · `calc × paymentMethod` resolvido com LINGUAGEM

Cada linha diz sobre O QUE incide, e a frase é derivada por função pura:

```
R$ 2,50 por venda no Pix        ← FIXO, restrito a uma forma
3,5% sobre toda venda           ← PERCENTUAL, global
R$ 6.000,00 por ano             ← recorrente, com período
R$ 300,00 — sem período         ← UNICA: a ausência é NOMEADA
```

⛔ Uma função, não quatro templates no JSX. O `sobre toda venda` não é enfeite —
é o contraste explícito com o `no Pix`, e sem ele a linha global não afirma nada.

### 3 · O aviso da despesa única — e o pedido teve de ser invertido

> **A premissa do pedido não se sustentava**, e medir antes de codificar foi o
> que evitou construir contra um problema inexistente. Ver a seção
> *CAPACIDADE SEM CONTROLE*, acima.

Não havia seletor de frequência **nenhum**. Decisão do dono: entra com as
**quatro que contam**, `UNICA` fora, padrão `MENSAL` — que é exatamente o que o
código já fazia, então **nada muda para quem não mexer nele** (`test:taxas` prova
a igualdade com o fallback de `createExpense`).

O aviso ficou, na lista, e aparece **porque existe linha `UNICA`** — não por
interação. ✅ Visto na tela, em âmbar, dizendo o quê e o porquê.

🔜 **Marcado 🔧 REVISÍVEL com gatilho: ele SAI no dia da migration do `ocorreEm`.**

## 🔴 A LINHA VERMELHA, e a guarda que passou com a porta aberta

`Expense.workspaceId` NULO = **vale para TODAS as áreas**. As duas asserções que
o dono exigiu são estruturais e estão em `test:taxas`.

> ### ⛔ NA PRIMEIRA VERSÃO, A GUARDA DE EDIÇÃO NÃO PEGAVA NADA
> Ela procurava `Pick<ExpenseDTO, "amount" | "name" | "active">` — e o `Pick`
> continua lá quando alguém **anexa** `& { workspaceId?: string | null }`.
> Descoberto ao provar pelo lado negativo: **dos três defeitos plantados, esse
> foi o único que escapou.**
>
> Hoje ela afirma duas coisas: que o `Pick` é o de três campos **e** que a
> assinatura não menciona `workspaceId`. A primeira mede a presença do certo; só
> a segunda mede a ausência do errado. **Sétima ocorrência** da família.

## 🐛 DOIS ERROS MEUS, os dois de MEDIÇÃO

| | |
|---|---|
| **"0 linhas em `Expense`"** no cabeçalho do seed | **FALSO** — inferi de uma tela que abriu vazia em vez de consultar. O real: **5 despesas, todas `DESPESA_RECORRENTE`, todas `workspaceId` NULO**. Corrigido no arquivo |
| **contraste 17,85 nos três papéis** | assinatura de seletor errado, não de contraste. Os `querySelector` pegaram wrappers que herdam `text-text`. Refeito mirando as classes, com a contagem de achados como linha de base |

⚠️ O primeiro é o mais grave, porque virou **texto afirmativo num cabeçalho de
arquivo** — a família que este projeto já pagou nove vezes. O que o denunciou foi
a tela mostrando despesas que o script não havia criado.

## ✅ LARGURA ESTREITA — a segunda tela a pagar

`0 de 311` descendentes vazando a 360 · 390 · 430 · 768px. O método de Login
funcionou sem adaptação.

## 👁️ O que foi VISTO e o que foi MEDIDO

| | |
|---|---|
| os dois temas | ✅ **vistos E medidos** — aviso 4,95 / 6,17 · fora 5,02 / 7,85 · incidência 4,97 / 5,20 |
| as 8 formas da frase de incidência | ✅ na tela, com o seed |
| o seletor de frequência | ✅ visto, `Por mês` por padrão |
| o aviso de `UNICA` | ✅ visto disparando, com duas linhas `UNICA` no banco |
| ⛔ adicionar/remover pelo clique | **não exercidos** — escreveriam no banco de dev |
| ⛔ o aviso de fuso divergente | **não visto** — exigiria trocar o fuso do sistema operacional |

## 📋 ACHADOS ADIADOS — dois novos

| Achado | O que já se sabe |
|---|---|
| **Enum tratado no servidor × oferecido na tela** | a varredura de *capacidade sem controle*. Candidatos: `ExpenseCalc`, `PaymentMethod` na taxa de gateway, tipos de `AutomationRule` |
| ~~`addDespesa`/`addTax`/… ficaram órfãos?~~ | ✅ **VARRIDO em 12/08.** Os **cinco** (com `addGateway`) estavam órfãos e foram deletados — mas só DEPOIS de repor os seletores, para a conversão do sentinela `__TODAS__`→`null` migrar em vez de sumir. Saíram junto `newTaxName`/`newTaxPct`/`onNewTaxName`/`onNewTaxPct`, `linhasPercentuais`, `coproducaoExpenses` e `custoProdutoExpenses` |
| 🔴🔴 **EM QUANTAS OUTRAS TELAS EU REMOVI CAMINHO DE ESCRITA?** | **PRIORIDADE ALTA**, pedido do dono em 12/08. Nove telas reescritas, e a família *"apresenta o que não consegue criar"* é **a única que nenhuma ferramenta desta base pega** — nem o teste do cinza (compara estrutura), nem o `04` (confere o que é EXIBIDO), nem `tsc`/lint/build. ⚠️ O método está escrito na seção própria: `git show` da tela deletada, `grep` pelos `add*`/`set*`/`create*` que ela chamava, e conferir que cada ARGUMENTO tem origem na tela nova. O sinal barato é helper com parâmetro que ninguém mais passa |

## ➡️ PRÓXIMA

Sobram **Áreas** (618 linhas, com fluxo destrutivo) e **Notificações** (130).
Aí as doze telas existem e **o `.tk-tema` pode morrer** — e a varredura de
largura estreita nas cinco entra logo depois, com estimativa de **uma sessão**.

`Regras` (21 ❌) segue sendo a maior dívida isolada, e `AnunciosView` (322) é a
última legada de Integrações servindo rota.

---

# 🪞 A TELA NOVA APRESENTA ESTADO QUE ELA NÃO CONSEGUE CRIAR

> **Formulação do dono, 12/08/2026.** É família nova, e é **o inverso do
> controle inerte**: lá o controle existe e não faz nada; aqui o **efeito existe
> e não há controle**.

> ## Ao reescrever uma tela, a conferência não é "mostra tudo que a antiga mostrava". É **"cria tudo que a antiga criava"**.

### Por que ela é invisível — e por que o teste do cinza não pega

A regressão não quebra nada. A LEITURA continua perfeita:

| | |
|---|---|
| a lista desenha | `R$ 2,50 por venda no Pix` — certo, bonito, e a frase até foi escrita nesta sessão |
| o formulário cria | só `3,5% sobre toda venda` |
| o que denuncia | 🔴 **nada.** Nenhum erro, nenhum número errado, nenhum estado vazio |

O teste do cinza compara ESTRUTURA. O `04` confere CONTEÚDO EXIBIDO. As duas
ferramentas olham o que a tela mostra — e a tela mostra tudo, porque os dados
antigos continuam lá. **O que sumiu foi o caminho de escrita**, e ele só é
percebido por quem for cadastrar um caso que não existia no banco.

### O caso que produziu a regra

Na tela de Taxas, a reescrita de 12/08 removeu **dois** seletores que a
`FeesView` tinha:

| Campo | A tela antiga | A primeira versão da nova |
|---|---|---|
| `Expense.calc` (R$ × %) | seletor em 3 dos 5 grupos | ⛔ cravado `PERCENTUAL` |
| `Expense.paymentMethod` | seletor no gateway (5 opções) | ⛔ nunca enviado → `null` |

⚠️ **A ironia é o que fixa a lição:** eu escrevi, no mesmo commit, a função pura
que distingue `R$ 2,50 por venda no Pix` de `3,5% sobre toda venda` — e removi as
duas únicas formas de criar a primeira. Só o seed conseguia produzi-la.

⚠️ E o `TODAS_AS_FORMAS` já documentava a mesma família, no `financeiro.ts`:
*"O suporte a taxa global sempre existiu — a tela é que não tinha como
produzi-lo."* A frase estava escrita e não impediu a repetição, porque descrevia
UM caso em vez de nomear o padrão.

> ### ⛔ A CONFERÊNCIA QUE FICA, ao reescrever qualquer tela
>
> **Para cada campo que a tela LÊ, existe caminho para ESCREVÊ-LO?**
>
> Ela se responde comparando os dois lados, e o `git show` da tela deletada é o
> instrumento: `grep` pelos `add*`/`set*`/`create*` que a antiga chamava, e
> confira que cada argumento que ela passava tem origem na nova.
>
> ⚠️ O sinal barato: um helper do hook que recebe um parâmetro **e a tela nova
> não passa nenhum**. Foi assim que os três `calc` apareceram — os helpers
> tinham `calc: "PERCENTUAL" | "FIXO" = "PERCENTUAL"` na assinatura, e ninguém
> mais passava o argumento.

---

# 💀 `@default` DE SCHEMA QUE NENHUM CAMINHO ALCANÇA NÃO É PADRÃO — É DECLARAÇÃO MORTA

> **Dois casos medidos em 12/08/2026, e o dono mandou registrá-los como um só.**
> Vai junto na sessão de migration, com o `ocorreEm`.

| Coluna | `@default` | O que TODO caminho passa | Concorda? |
|---|---|---|---|
| `Expense.recurrence` | `UNICA` | `"MENSAL"` (`??` na ação, fixo no hook) | 🔴 **não** |
| `Expense.calc` | `PERCENTUAL` | `PERCENTUAL` em 4 grupos, **`FIXO`** em despesa fixa | ⚠️ parcial |

Nenhum dos dois defaults é alcançável pelo app: toda criação passa valor
explícito. Ou seja, **eles não descrevem comportamento nenhum**.

> ### 🔴 O CUSTO NÃO É TÉCNICO — É DE LEITURA
> O schema é o primeiro lugar onde alguém vai entender o produto. Um
> `@default(UNICA)` diz *"despesa sem frequência declarada é única"* — e isso
> nunca aconteceu com nenhuma linha. Quem lê sai com um modelo mental errado, e
> **age sobre ele**: foi exatamente o que aconteceu comigo, que reportei "quem
> só preenche valor cai em UNICA" lendo o schema em vez de seguir os chamadores.
>
> ⛔ A correção não é remover o default (a coluna é `NOT NULL`, precisa de um).
> É **fazê-lo concordar com o caminho real** — ou, onde não houver um único
> caminho, escrever no `///` do schema que o default é inalcançável e por quê.

⚠️ **A pergunta que generaliza:** para cada `@default` do schema, existe um
caminho que o exercita? Se todo `create` passa o campo, o default é documentação
— e documentação que afirma um comportamento inexistente é a família que este
projeto já pagou nove vezes.

---

# 📌 ESTADO DA SESSÃO — 12/08/2026 (parte 4: ÁREAS, construída e NÃO VISTA)

> ⛔ **NADA FOI PARA O GITHUB.** `main` em `4e6aa9e`, branch ausente no remoto.

## ⚠️ A TELA EXISTE E NÃO FOI VISTA — a sessão de dev expirou

`Não autenticado` no log do servidor. Não há como eu entrar (senha é do dono,
e digitar senha não é coisa que eu faça). **A seção do `04` está com a coluna em
BRANCO**, que pela convenção significa *construída e não verificada* — e em
branco ela fica fora da contagem em vez de entrar como feita.

⛔ **Não marque ✅ sem abrir a tela.** Metade da lista é layout, e foi a passada
visual que achou o único bug do Gerenciador, os três de Login e os dois de Taxas.

## ✅ O que ficou pronto

| | |
|---|---|
| `views/areas/AreasScreen.tsx` · `GavetaArea.tsx` · `GavetaExcluir.tsx` | a tela, com a `tk/Gaveta` no lugar do `ui/Drawer` legado |
| `lib/areas/consequencia.ts` | **puro** — o que a exclusão PROMOVE, seguindo a opção selecionada |
| `lib/areas/apresentacao.ts` | paleta, campos de recorte, resumo que diz o EFEITO |
| deletados | `AreasView` (618) e `ExcluirAreaDialog` |
| testes | `test:areas-tela` **21 asserções**, no `npm test` no MESMO commit |

## 🔑 A CONFERÊNCIA DE ESCRITA VIROU ASSERÇÃO — e é o que vale a sessão

A família *"a tela nova apresenta o que não consegue criar"* é a única que
nenhuma ferramenta desta base pega. Agora ela tem uma:

> `test:areas-tela` **lê do próprio `actions/workspaces.ts`** os campos que
> `updateWorkspace` persiste, e exige que cada um tenha origem no `aoSalvar` do
> formulário.

⛔ A lista é LIDA, nunca copiada — cópia à mão envelheceria no primeiro campo
novo, em silêncio, que é a família que a guarda existe para fechar.

✅ **Provado com a regressão EXATA de Taxas:** removendo `pixelConfigIds` do
envio, a suíte reprova **nomeando o campo**.

⚠️ **Este é o modelo para a varredura das nove telas.** Ela deixou de ser uma
leitura manual e passou a ser uma asserção por tela — muito mais barata.

## 🔴 A confirmação da exclusão

Contagem real, buscada ANTES de o diálogo abrir. E o texto **segue a escolha**:
com os padrões (`regras`/`despesas` em `excluir`) **não há promoção nenhuma** e o
bloco de alarme não aparece — alarme que grita sem motivo envenena o único sinal
que existe.

⛔ **A exclusão NÃO foi exercitada**, por decisão do dono. Os quatro casos que
precisariam ser exercidos estão listados no `04`, e o primeiro (`regras: "mover"`
com regra ATIVA) é o único que **volta a agir sozinho** depois do teste.

## ✅ A PASSADA VISUAL FOI FEITA — 14 ✅ / 2 🔧, e três itens EM BRANCO

O dono logou e a tela foi percorrida nos dois temas. Contraste medido: nome
**17,85 / 16,11**, descrição e resumo **4,97 / 5,20**. Largura estreita: **0 de
47** vazando a 360 · 390 · 430 · 768px.

✅ **O caminho de escrita foi exercido NA TELA**, não só por asserção: criei
`Operação Black` pela gaveta com nome, descrição, cor, 1 conta, 1 webhook e 1
produto, e o cartão voltou dizendo `1 conta · 1 webhook · 1 produto`.

## 🔴 O ACHADO: DOIS MECANISMOS PARA A MESMA RELAÇÃO, E ELES NÃO CONVERSAM

| | Lê / escreve |
|---|---|
| `preverExclusaoDaArea` | `AdAccount.workspaceId` · `Webhook.workspaceId` · `PixelConfig.workspaceId` (`exclusao.ts:101-103`) |
| o formulário de Áreas | `Workspace.accountIds` · `webhookIds` · `pixelConfigIds` |

**Observado na tela:** marquei 1 conta e 1 webhook, o cartão confirma, e o
diálogo de exclusão **não mostrou seletor de destino nenhum** — para ele, a área
não tem conta nem webhook.

⛔ **CONGELADO** (anterior a `4e6aa9e`): medido, registrado, não consertado.

🔑 **E isto reenquadra o `pixelConfigIds`:** ele não é coluna órfã solitária — é
**um lado inteiro de um par**. A pergunta certa deixa de ser "remover o
controle?" e passa a ser **"qual dos dois lados é a relação de verdade?"**.

⚠️ Por isso três itens do diálogo ficaram EM BRANCO: com a relação partida, a
área criada não tem regras nem despesas do ponto de vista da prévia, e a
**promoção de escopo não teve como disparar na tela**. Ela está testada como
função pura, e **não vista**.

## 🐛 O defeito que só a tela mostrou

**A cor gravada não estava na paleta** — a Principal do dev tem `#8B5CF6`, e o
seletor abria com nenhuma selecionada. ⚠️ É o MESMO defeito que eu já havia
previsto no seletor de fuso de Taxas e não apliquei aqui: prova de que aquela
nota descrevia UM caso em vez de nomear o padrão. Hoje o padrão está escrito:
**seletor de valor fechado precisa admitir o valor já gravado.**

## ➡️ PRÓXIMA

**Notificações** (130 linhas, 11 caminhos de escrita) — com a conferência de
escrita como ASSERÇÃO, no modelo de `test:areas-tela`. Aí as doze telas existem
e o `.tk-tema` pode morrer.

Depois: a mesma asserção nas nove já feitas, e a varredura de largura estreita
nas cinco que faltam (estimativa: uma sessão).

---

# 🕳️ NEGAÇÃO SOBRE STRING VAZIA SEMPRE PASSA — e componente que porta some do `renderToStaticMarkup`

> **12/08/2026, na tela de Áreas.** Vai junto do padrão da LINHA DE BASE, porque
> é a forma dele que mais engana: aqui não havia âncora errada nem CRLF. **O
> componente simplesmente não existia no markup.**

`tk/Gaveta`, `Drawer`, `Modal` e a paleta ⌘K portam para o `<body>` com
`createPortal`. Sem DOM, `renderToStaticMarkup` devolve **string vazia** — é a
mesma "proteção por ESTRUTURA" que impede o `elapsed()` de quebrar a hidratação,
e ela é boa. O problema é o que acontece com as asserções:

```js
const html = renderToStaticMarkup(<GavetaExcluir … />);   // ""
assert.ok(!/para confirmar/.test(html));                   // ✅ PASSA
```

> ## O teste afirma que o diálogo NÃO tem confirmação por digitação. Ele tem — só não foi desenhado.

| Forma da asserção | Com markup vazio |
|---|---|
| `assert.ok(html.includes("X"))` | ❌ falha — **e é a boa** |
| `assert.ok(!html.includes("X"))` | 🔴 **passa, afirmando o contrário do verdadeiro** |
| `assert.equal(conta(html, "X"), 0)` | 🔴 passa |

⚠️ Quatro asserções deste arquivo estavam assim, e **o que denunciou foi a linha
de base** (`assert.ok(html.length > 1200)`). Sem ela, três teriam ficado verdes
para sempre — e uma delas alegava cobrir a confirmação de um fluxo IRREVERSÍVEL.

> ### ⛔ AS DUAS REGRAS
>
> **1. Toda asserção de NEGAÇÃO sobre markup exige a linha de base que prova que
> houve markup.** É a mesma regra do `=== 0` com coleção vazia, na camada de
> render.
>
> **2. Antes de escrever teste de componente, pergunte se ele PORTA.** O `grep`
> é por `createPortal` / `useOverlay` na cadeia de imports. Se portar, ele não
> renderiza em `renderToStaticMarkup`, e o teste tem de mudar de forma —
> guardas de texto com o limite escrito, ou um DOM de verdade.

⚠️ **O sinal barato:** o comprimento do markup. Meça uma vez, no começo do
arquivo; ele custa uma linha e responde "houve o que examinar?" para todas as
asserções que vêm depois.

---

# 🔗🔗 DUAS RELAÇÕES PARALELAS PARA A MESMA COISA, SEM CONVERSA ENTRE ELAS

> ## 🔴 PRIORIDADE ALTA — e **não é dívida de modelagem**: é a confirmação de um fluxo IRREVERSÍVEL podendo silenciar.

**Medido e OBSERVADO NA TELA em 12/08/2026**, na reescrita de Áreas. Código
congelado (anterior a `4e6aa9e`): medido, registrado, **não consertado**.

| | Lê / escreve |
|---|---|
| `preverExclusaoDaArea` | `AdAccount.workspaceId` · `Webhook.workspaceId` · `PixelConfig.workspaceId` (`exclusao.ts:101-103`) |
| o formulário de Áreas | `Workspace.accountIds` · `webhookIds` · `pixelConfigIds` |

**São dois vínculos paralelos para a mesma relação**, e eles não se enxergam.
Observado: marquei 1 conta e 1 webhook, o cartão confirmou `1 conta · 1 webhook`,
e o diálogo de exclusão **não mostrou seletor de destino nenhum** — para ele,
aquela área estava vazia.

### 🔴 A CONSEQUÊNCIA QUE MUDA A SEVERIDADE

O diálogo de exclusão existe para dizer **o que a exclusão PROMOVE**:

> *"Esta área tem N despesas e M regras. Ao excluí-la, elas passam a valer para
> TODAS as áreas."*

Se a prévia enxerga uma área **vazia**, esse aviso **não dispara**. Numa conta
real com `Expense.workspaceId` ou `AutomationRule.workspaceId` preenchidos por
outro caminho, o usuário confirma uma exclusão irreversível **sem ver o único
aviso que o diálogo existe para dar** — e a regra sobrevivente volta a agir
sozinha, com dinheiro real.

⛔ **Não é "o `pixelConfigIds` está órfão".** Ele é **um lado inteiro de um par**,
e a pergunta certa não é *"remover o controle?"* — é:

> **Qual dos dois vínculos é a relação de verdade?**

Um dos dois lados está errado, e escolher sem medir é escolher no escuro.

⚠️ **O que já se sabe, medido:** as duas relações têm consumidores. O lado
`<Recurso>.workspaceId` alimenta a prévia da exclusão e a precedência de área; o
lado `Workspace.*Ids` alimenta a tela de Áreas e parte de `actions/workspaces.ts`.
**Nenhum dos dois é dispensável sem medir quem depende de qual.**

---

# 🌉 O `.tk-tema` NÃO PODE MORRER AINDA — medido, e o bloqueio é o SHELL

> **12/08/2026.** A remoção estava aprovada para o fechamento das doze telas. A
> medição diz que não dá, e o motivo é maior que as duas telas legadas.

| O que ainda depende | Medido |
|---|---|
| `RulesView` + `RuleDrawer` | servem `/dashboard/regras` e consomem `--color-*`. **`Regras` nunca foi reescrita** — 21 ❌ no `04` |
| `AnunciosView` | serve `/dashboard/integracoes/anuncios` e consome `--color-*` |
| 🔴 **o SHELL NOVO importa do sistema ANTIGO** | ver a varredura completa abaixo |

## 🔎 A VARREDURA COMPLETA — pergunta do dono, e ela mudou o tamanho do trabalho

**Medido em 12/08/2026.** A primeira resposta foi *"é só o `Icone`, 10
consumidores"*. Contando direito, e incluindo tudo que `tk/` importa de
`dashboard/`:

| Importado por `tk/` | Consumidores | Carrega `--color-*`? |
|---|---|---|
| `ui/Icone` | **12** | 🔴 **sim** (`Icone.tsx:172-173`) |
| `ui/Modal` | **3** | 🔴 **sim** — `BarraEdicao`, `BarraSelecao`, `ModalNovaCampanha` |
| `ui/useOverlay` | 2 | ✅ não — é hook, sem cor |
| `ui/useTamanho` | 1 | ✅ não |
| `useTraffikState` · `TraffikContext` | 1 cada | ✅ não — é estado |

> ## São DOIS arquivos, não um. E o `Modal` só apareceu porque a pergunta foi "o que mais?", não "o Icone é o único?".

⚠️ **É a meta-regra do topo se provando de novo:** a primeira formulação
(*"migrar o `Icone` resolve"*) descrevia UM caso. A pergunta que generaliza —
**"quantos outros componentes de `tk/` importam de `dashboard/ui/`?"** — é uma
linha de `grep`, e achou 60% a mais de trabalho:

```bash
grep -rhoE 'from "@/components/dashboard/[a-zA-Z/]+"' src/components/tk/ | sort | uniq -c | sort -rn
```

⚠️ E os dois hooks NÃO entram: eles não carregam cor. O critério do passo 1 não
é "importa do antigo", é **"importa do antigo E lê `--color-*`"**.

> ## Ou seja: remover a ponte pintaria de ROXO os ícones do próprio shell novo — o rail, a paleta ⌘K, o sino, a paginação.

⛔ **O bloqueio não é "faltam duas telas legadas".** É que o sistema novo
**consome um componente do sistema antigo**, e ninguém tinha medido isso.

### 🔜 A ORDEM QUE DESTRAVA, e ela é curta

1. **Migrar `ui/Icone` E `ui/Modal`** para `--tk-*` (ou criar os equivalentes em
   `tk/`). São DOIS arquivos, e juntos liberam os 15 consumidores novos.
2. Reescrever **Regras** (a maior dívida isolada) e **Anúncios** (322 linhas).
3. Só então remover a ponte — com o `test:contraste` e uma passada visual nas
   rotas legadas antes e depois.

⚠️ **O passo 1 é barato e independente dos outros dois.** Ele não remove a
ponte, mas tira o shell novo de dentro dela — que é a parte que hoje torna a
remoção impossível de avaliar.

---

# 📌 ESTADO DA SESSÃO — 12/08/2026 (parte 5: NOTIFICAÇÕES, e as doze existem)

> ⛔ **NADA FOI PARA O GITHUB.** `main` em `4e6aa9e`, branch ausente no remoto.

## ✅ AS DOZE TELAS EXISTEM

`NotificationsView` (130) morreu. `views/notificacoes/NotificacoesScreen.tsx` +
`lib/notificacoes/apresentacao.ts` (puro) no lugar. `test:notificacoes` com **12
asserções**, no `npm test` no MESMO commit.

`04`: seção nova, **11 ✅**, dois itens em branco. O `docs:estado` conta **13
telas**. Baseline validado: as 12 anteriores idênticas.

## 🔑 A CONFERÊNCIA DE ESCRITA, PELA SEGUNDA VEZ COMO ASSERÇÃO

`test:notificacoes` cruza `CAMPOS_ESCRITOS` da tela com o
`NotificationSettingsDTO` lido do arquivo da ação, e exige **igualdade nos dois
sentidos**. Provado pelo lado negativo: removendo `showValue`, a suíte nomeia o
campo.

⚠️ **É o modelo pronto para as nove telas antigas.** Duas telas, duas formas da
mesma guarda: em Áreas ela lê o `data:` do `update`; aqui ela lê o `interface`
do DTO. O que as duas têm em comum é **ler o servidor em vez de copiá-lo**.

## 🐛 O `tsc` ACHOU ANTES DE MIM: `notif` ≠ `NotificationSettingsDTO`

`v.notif` é modelo de TELA e **não tem os quatro horários** — eles saem dele para
virar a lista `reports`, e no lugar entra um `preview` que o DTO não tem. Eu
tratei os dois como o mesmo, e o compilador recusou.

A tela passou a consumir `v.notifCru`. ⚠️ Mesma classe do `despesasCruas`:
**derivado de tela não serve para escrever**, porque foi moldado para o que a
tela ANTIGA desenhava.

## ⏳ O QUE FICA DEVENDO

| | |
|---|---|
| tema escuro de Notificações | **visto, não medido** — o `Runtime.evaluate` congelou duas vezes |
| os dois avisos condicionais | não vistos disparando: ligá-los exigiria desligar as configurações reais do dono no dev |
| `.tk-tema` | 🔴 **não pode morrer ainda** — ver a seção própria acima |

## ➡️ O QUE SOBRA PARA O PROJETO FECHAR

1. **Migrar `ui/Icone` (12 consumidores) e `ui/Modal` (3)** para `--tk-*` —
   dois arquivos, e eles tiram o shell novo de dentro da ponte.
2. **Varredura de largura estreita** nas cinco — estimativa de uma sessão.
3. **Conferência de escrita** nas nove — agora com o modelo pronto.
4. `Regras` (21 ❌) e `AnunciosView` (322), as duas legadas que restam.
5. A sessão de **migration**: `ocorreEm` + os dois `@default` mortos.

---

# 🧾 RECEITA: A CONFERÊNCIA DE ESCRITA COMO ASSERÇÃO

> **Duas formas, mesmo princípio.** Escritas em 12/08/2026, em Áreas e em
> Notificações. **A próxima tela escolhe a forma pela do arquivo, não
> reinventa.**

Ela fecha a família *A TELA NOVA APRESENTA ESTADO QUE ELA NÃO CONSEGUE CRIAR* —
a única que nenhuma outra ferramenta desta base pega: o teste do cinza compara
ESTRUTURA, o `04` confere o que é EXIBIDO, e `tsc`/lint/build não perguntam se
existe caminho de escrita.

## O princípio, e é ele que torna a receita reaproveitável

> ## Ela **LÊ O SERVIDOR** em vez de copiá-lo. Uma lista escrita no teste envelhece no primeiro campo novo — em silêncio, que é a própria família que a guarda existe para fechar.

## Forma A — a ação monta um `data:` condicional

Quando o servidor grava campo a campo (`...(input.X !== undefined ? { X } : {})`),
como em `updateWorkspace`:

```js
const persistidos = [...ACOES.matchAll(/\.\.\.\(input\.(\w+) !== undefined \?/g)].map((m) => m[1]);
assert.ok(persistidos.length >= 8, "linha de base: a âncora quebrou");

const envio = EDITOR.slice(EDITOR.indexOf("await aoSalvar({"), …);
assert.deepEqual(persistidos.filter((c) => !new RegExp(`\b${c}\b`).test(envio)), []);
```

## Forma B — a ação aceita um `Partial<DTO>`

Quando o patch é o DTO inteiro, como em `updateNotificationSettings`:

```js
const doDTO = [...corpoDaInterface.matchAll(/^\s{2}(\w+)\??:/gm)].map((m) => m[1]);
assert.deepEqual(doDTO.filter((c) => !naTela.includes(c)), []);   // some em silêncio
assert.deepEqual(naTela.filter((c) => !doDTO.includes(c)), []);   // descartado em silêncio
```

## ⛔ OS DOIS SENTIDOS, e é a parte que importa

| Direção | O que acontece se faltar |
|---|---|
| campo no **servidor** e não na tela | o controle some, **a leitura continua certa**, e ninguém nota — é a regressão de Taxas |
| campo na **tela** e não no servidor | o patch é **descartado em silêncio**, e a tela mostra o valor que ela mesma inventou |

⚠️ A primeira é a que já aconteceu. A segunda é pior de diagnosticar: a tela
fica coerente consigo mesma e discorda do banco só depois de um recarregamento.

## ⚠️ E o par que decide qual forma usar

Antes de escrever a guarda, abra a ação e veja **como ela recebe o patch**. Se
for `Partial<DTO>` → forma B. Se montar `data:` campo a campo → forma A. Errar a
forma faz a âncora não casar, e âncora que não casa **devolve "não achei" com a
mesma cara de "está tudo certo"** — por isso as duas levam LINHA DE BASE.

⚠️ **Prova as duas pelo lado negativo removendo UM campo da tela.** A suíte tem
de reprovar **nomeando o campo**; se ela só disser "falhou", a mensagem não serve
para quem for consertar.

---

# 📌 ESTADO DA SESSÃO — 12/08/2026 (parte 6: encerramento)

> ⛔ **NADA FOI PARA O GITHUB.** Conferido: `origin/main` em **`4e6aa9e`**,
> `redesign/dashboard` **ausente no remoto**, árvore limpa.

## ✅ AS DOZE TELAS EXISTEM

Dashboard · Shell · Integrações › Visão geral · Gerenciador · UTM & Snippets ·
Pixel/Eventos · Webhooks · Criativos · Login · Taxas · Áreas · Notificações.

`docs:estado` conta **13 seções** no `04` (as doze mais o SHELL).

## 🔑 O ACHADO DA SESSÃO: o shell novo importa do sistema antigo

E a pergunta que generaliza mudou o tamanho do trabalho: **não é um arquivo, são
dois** — `ui/Icone` (12 consumidores) e `ui/Modal` (3). O `Modal` só apareceu
porque a pergunta foi *"o que mais?"*, e não *"o `Icone` é o único?"*.

⚠️ Terceira vez nesta sessão que a meta-regra do topo se prova: a formulação
inicial descrevia um caso, e o `grep` que generaliza achou 60% a mais.

## ➡️ A ORDEM DO QUE FALTA — decidida pelo dono

| # | | |
|---|---|---|
| 1 | **Migrar `ui/Icone` e `ui/Modal`** para `--tk-*` | barato e independente. Tira o shell de dentro da ponte |
| 2 | **Largura estreita nas cinco** | método do contêiner. Estimativa: **uma sessão**; se virar três, avisar antes |
| 3 | **Conferência de escrita nas nove** | com a RECEITA acima — a tela escolhe a forma pela da ação |
| 4 | **Regras** (21 ❌) e **Anúncios** (322) | as duas últimas legadas servindo rota |
| 5 | **Sessão de schema** | `ocorreEm` · os dois `@default` mortos · o **par partido** (`Workspace.accountIds` × `AdAccount.workspaceId`) · `ApiCredential.workspaceId` |
| 6 | **O `.tk-tema` morre** | só depois de 1 e 4, com `test:contraste` e passada visual antes e depois |

---

# 📌 ESTADO DA SESSÃO — 12/08/2026 (fechamento)

> ⛔ **NADA FOI PARA O GITHUB.** `origin/main` em **`4e6aa9e`**,
> `redesign/dashboard` **ausente no remoto**, árvore limpa.

## ✅ O QUE ESTA SESSÃO ENTREGOU

| | |
|---|---|
| **4 telas** | Login · Taxas · Áreas · Notificações — **as doze existem** |
| **4 suítes novas** | `test:login` 22 · `test:taxas` 28 · `test:areas-tela` 21 · `test:notificacoes` 12 |
| **1 regressão corrigida** | os dois seletores que a reescrita de Taxas tinha removido |
| **1 seed novo** | `dev:taxas`, idempotente |
| deletados | `AuthShell` · `AuthForm` · `FeesView` · `AreasView` · `ExcluirAreaDialog` · `NotificationsView` + 5 helpers órfãos do hook |

## 🔑 AS TRÊS COISAS QUE SOBREVIVEM A ESTA SESSÃO

Não são as telas — são as ferramentas:

| | |
|---|---|
| **A META-REGRA**, no topo | registre o PADRÃO e o sinal barato. O teste é objetivo: grep, pergunta ou medição. Narrativa reprova |
| **A FORMA DA PERGUNTA** | *"o X é o único?"* confirma; *"o que mais tem a propriedade?"* procura. Três achados desta sessão vieram da segunda forma |
| **A RECEITA DA CONFERÊNCIA DE ESCRITA** | duas formas, ambas LENDO o servidor. Fecha a única família que nenhuma outra ferramenta desta base pega |

## 🐛 O QUE ESTA SESSÃO ACHOU E NÃO CONSERTOU (congelado)

| | Severidade |
|---|---|
| **o par partido** — `Workspace.*Ids` × `<Recurso>.workspaceId` | 🔴 **alta**: a prévia vê a área vazia e o aviso de promoção de escopo não dispara num fluxo IRREVERSÍVEL |
| **a ponte não pode morrer** — `ui/Icone` (12) e `ui/Modal` (3) | 🔴 remover pintaria de roxo o shell novo |
| os dois `@default` mortos | ⚠️ mentem para quem lê o schema |

## 🐛 E O QUE ELA ACHOU EM CÓDIGO NOVO, E CONSERTOU

Autofill branco no tema escuro · headline quebrando errado · painel sem altura ·
rótulo truncado na prévia · `Lembrar de mim` colidindo a 340px · cartões de
Taxas esticando 1380px · cor gravada fora da paleta · cartões de Notificações
encolhendo. **Nenhum deles apareceria sem abrir a tela.**

## ⏳ O QUE FICA DEVENDO

- tema escuro de Notificações: **visto, não medido** (renderer congelou 2×)
- os dois avisos condicionais de Notificações: **não vistos disparando**
- a exclusão de área: **construída, não exercitada** — por decisão do dono
- envio real e estado de erro do Login: **não exercidos**

## ➡️ A ORDEM, decidida pelo dono

1. `ui/Icone` + `ui/Modal` → `--tk-*`  2. largura estreita nas cinco
3. conferência de escrita nas nove     4. Regras + Anúncios
5. sessão de schema                    6. o `.tk-tema` morre
