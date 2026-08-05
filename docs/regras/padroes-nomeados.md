# Padrões nomeados — as armadilhas que já custaram caro

> O CLAUDE.md tem a tabela-resumo com uma linha por padrão. Este arquivo tem
> o caso completo de cada um: o sintoma, a causa raiz e por que a correção
> óbvia estava errada.

> ⬆️ **Regras que valem sempre** (PROCEDIMENTO, ordem de migration, guarda de
> escrita em produção, padrões nomeados, estado atual e fila) estão no
> **`CLAUDE.md`** na raiz. Este arquivo é o detalhe de um tema.

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
