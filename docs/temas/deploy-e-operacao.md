# Deploy, cron e operação

> Leia ao deployar, mexer em cron/agendador, trocar domínio, ou investigar
> produção fora do ar.

> ⬆️ **Regras que valem sempre** (PROCEDIMENTO, ordem de migration, guarda de
> escrita em produção, padrões nomeados, estado atual e fila) estão no
> **`CLAUDE.md`** na raiz. Este arquivo é o detalhe de um tema.

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

## 🌐 TRAFFIK → TRACKHUB: o nome trocou, o DOMÍNIO não (05/08/2026)

**Trocado:** 64 ocorrências de texto em 37 arquivos, pelo padrão `\bTraffik\b`
(sensível a maiúscula, com fronteira de palavra).

> ### ⛔ O padrão foi PROVADO antes de rodar, não presumido
> `\bTraffik\b` **não casa** dentro de `TraffikProvider` — depois do `k` vem
> `P`, os dois caracteres de palavra, então a fronteira não existe. E sendo
> sensível a maiúscula, `traffikPixel` e `traffik_track` ficam fora por
> construção.
>
> Verificado com as seis linhas antes de tocar em arquivo nenhum. Um `sed`
> ingênuo teria renomeado o cookie e quebrado **todo snippet instalado**.

**Intocado, de propósito:** `traffik_track`, `window.traffikPixel`,
`window.traffik`, `traffik_click_id`, `useTraffik`/`TraffikProvider`/
`TraffikView`/`TraffikContext`, `traffikEnvia`, os `.webp` das logos e as
colunas do banco.

> ⚠️ **A troca não invalida snippet instalado.** A assinatura (`detectores.ts`)
> é calculada sobre os detectores e os donos dos eventos — não sobre o
> comentário do cabeçalho. Foi verificado antes: mudar o texto **não** faz a
> gaveta acusar "script desatualizado".
>
> ⚠️ Durante a transição convivem dois nomes: o script já instalado diz
> `/*! Traffik Pixel */` e o novo diz `Trackhub`. Isso é esperado e some quando
> cada cliente recola.

### 🔴 O DOMÍNIO é outra migração, e é a cara

`NEXT_PUBLIC_APP_URL` viaja **assada dentro de cada snippet instalado** — o
`apiBase` é literal no código que está no site do cliente. Trocar o domínio
não é renomear: é **quebrar todo script instalado** até cada um recolar.

**O que a migração exigiria, na ordem:**

| # | Passo | Por quê |
|---|---|---|
| 1 | Domínio próprio (`app.trackhub.com.br`) apontando para a Vercel | hoje é `342dd-virid.vercel.app`, derivado do nome do projeto |
| 2 | **Os DOIS endereços respondendo** — o novo e o `.vercel.app` | o antigo continua recebendo clique e evento de todo script já instalado |
| 3 | `FACEBOOK_REDIRECT_URI` atualizado no app do Facebook | o OAuth recusa URI não registrada |
| 4 | `AUTH_URL` + `NEXT_PUBLIC_APP_URL` na Vercel, com **Redeploy** | env var só vale em build novo |
| 5 | Só então gerar snippet novo | quem não recolar segue no domínio velho, e funciona |
| 6 | Aposentar o antigo **quando `Click`/`PixelEvent` pararem de chegar por ele** | e não por data — é o tráfego que diz |

> ### ⛔ Não existe "prazo" para o passo 6, existe MEDIÇÃO
> Desligar o domínio antigo com script ainda apontando para lá mata o
> rastreamento **em silêncio**: o site do cliente continua no ar, o script
> continua rodando, e o POST simplesmente não chega. Nada na tela dele muda —
> só param de entrar cliques.
>
> A pergunta que libera o passo 6 é *"quantos eventos ainda chegaram pelo
> host antigo nos últimos 30 dias?"*, e ela **não tem resposta hoje**: não
> gravamos o host que atendeu. Se esta migração for acontecer, isso precisa
> ser instrumentado ANTES.

⚠️ O webhook tem o mesmo problema, e pior: a URL está colada no painel do
gateway do usuário, fora do nosso alcance. Ela **nunca** pode parar de
responder sem aviso — venda perdida não volta.

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
