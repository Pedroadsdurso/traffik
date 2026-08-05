# Histórico — 2026-08-01-ux-e-ambiente

> Registro de sessão, mantido inteiro. Não é regra e não precisa estar
> carregado a cada sessão — mas é onde está o "por que ficou assim" de
> cada decisão do período, e várias delas voltaram a importar.

> ⬆️ **Regras que valem sempre** (PROCEDIMENTO, ordem de migration, guarda de
> escrita em produção, padrões nomeados, estado atual e fila) estão no
> **`CLAUDE.md`** na raiz. Este arquivo é o detalhe de um tema.

---

## 🚦 (histórico) fila de UX: (f) e (g) fechados (01/08/2026)

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
