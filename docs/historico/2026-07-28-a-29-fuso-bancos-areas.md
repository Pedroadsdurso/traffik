# Histórico — 2026-07-28-a-29-fuso-bancos-areas

> Registro de sessão, mantido inteiro. Não é regra e não precisa estar
> carregado a cada sessão — mas é onde está o "por que ficou assim" de
> cada decisão do período, e várias delas voltaram a importar.

> ⬆️ **Regras que valem sempre** (PROCEDIMENTO, ordem de migration, guarda de
> escrita em produção, padrões nomeados, estado atual e fila) estão no
> **`CLAUDE.md`** na raiz. Este arquivo é o detalhe de um tema.

---

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

- ~~**Nav morto no `useTraffikState`**~~ → ✅ **FEITO em 05/08/2026** (−283 linhas). A faxina levou o nav por estado, o gerador de link/snippet antigo, o `ruleForm` e o `EditDashboardDrawer` inalcançável. Ver a seção própria.
- **Bloco 8 (Regras)** — único bloco do roteiro v2 ainda não feito.
- **`DashboardLayout.workspaceId` continua nullable.** O NOT NULL só entra depois que a produção estiver rodando este código — ver a lição da `20260728120000`.
- **Colunas do Gerenciador que a Meta tem e nós não** — lista levantada e aguardando escolha: Alcance, Frequência, Objetivo, Estratégia de lance, Início/Término (todas já no banco), mais Cliques no link e Entrega detalhada (exigem sync novo).
