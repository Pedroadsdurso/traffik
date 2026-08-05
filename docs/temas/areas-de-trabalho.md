# Áreas de Trabalho — precedência, escopo e exclusão

> Leia ao mexer em qualquer coisa que recorte dado por área: métrica, tela de
> configuração, exclusão. A regra da precedência (conta vence webhook) e o
> catch-all da Principal moram aqui.

> ⬆️ **Regras que valem sempre** (PROCEDIMENTO, ordem de migration, guarda de
> escrita em produção, padrões nomeados, estado atual e fila) estão no
> **`CLAUDE.md`** na raiz. Este arquivo é o detalhe de um tema.

---

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
