# Regras de automação (Bloco 8) — o motor que age sozinho

> Leia antes de tocar em `rules/engine.ts`. Este é o único código da base que
> pausa campanha e altera orçamento de madrugada, sem ninguém olhando.

> ⬆️ **Regras que valem sempre** (PROCEDIMENTO, ordem de migration, guarda de
> escrita em produção, padrões nomeados, estado atual e fila) estão no
> **`CLAUDE.md`** na raiz. Este arquivo é o detalhe de um tema.

---

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
