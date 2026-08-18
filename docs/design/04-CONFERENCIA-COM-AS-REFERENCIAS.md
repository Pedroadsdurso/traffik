# 04 — CONFERÊNCIA COM AS REFERÊNCIAS

> **A regra:** a imagem de referência é o padrão. Um elemento só sai dela, ou entra sem estar nela, se estiver marcado 🔧 neste documento — o que significa decisão explícita do dono do produto.
>
> Este documento tem precedência sobre o `03-ARQUITETURA-DE-TELAS.md` em qualquer divergência. O `03` descreve estrutura; este descreve o inventário do que precisa existir.

**Legenda**

| | |
|---|---|
| ✅ | já está no plano ou já foi feito |
| ❌ | está na referência e **não** estava no plano — entra |
| 🔧 | diverge da referência por **decisão do dono**, com o motivo |

**Decisões tomadas que valem para tudo:**

1. **Sub-navegação na sidebar vence abas horizontais.** Onde a referência mostra abas na página para trocar de seção (`Todas / Meta Ads / Google Ads`), usamos filhos expansíveis na sidebar. Abas **dentro** de um painel de detalhe continuam existindo (ex.: `Visão geral / Configurações / Sincronização / Logs`) — essas não são navegação, são detalhe.
2. **Mesclagem no Dashboard:** tudo da imagem 1 **mais** o que já construímos.
3. **Heatmap e break-even ficam**, mesmo não estando nas referências.

---

## SHELL — sidebar e header

Referências: todas as 11 imagens. **✅ FEITO em 06/08/2026.** Os 4 arquivos antigos
(`Sidebar` 173 · `Header` 122 · `DashboardShell` 125 · `integracoes/layout` 43 =
**463 linhas**) foram **deletados**, não editados. Reescrito em 9 arquivos novos
em `components/tk/`.

### Sidebar

| Elemento | Status |
|---|---|
| Logo no topo | ✅ **feito** — wordmark expandido, símbolo quando colapsado |
| Botão de recolher (`«` / `Recolher`) — colapsa para ícones | ✅ **feito** — 236px → 60px, estado em `localStorage`. 🔧 botão explícito, **não** hover: o `01` pede hover, o `04` vence, e abrir sozinho ao passar o mouse de raspão é pior |
| Grupos rotulados na navegação | ✅ **feito** — colapsado o rótulo vira um traço, senão os 3 grupos viram um bloco só |
| Item ativo com **fundo sólido** e marcador, não só cor de texto | ✅ **feito** — tingimento + barra de 2px + `aria-current` |
| Item pai expansível com filhos inline e filho ativo marcado | ✅ **feito** — 🔧 o pai da seção aberta fica com **barra e cor, sem preenchimento**; o preenchimento marca a PÁGINA, e ela é uma. Com os dois preenchidos, "Integrações" e "Webhooks" ficavam idênticos |
| Badge de contagem no item (Notificações `3`) | ✅ **feito** — lê o mesmo `notifUnread` do sino; colapsado vira um ponto |
| Rodapé: seletor de área de trabalho | ✅ **feito** — saiu do topo. "Gerenciar áreas" mora dentro dele |
| Rodapé: bloco de perfil — avatar, nome, e-mail, menu `⋮` | ✅ **feito** |
| Rodapé: **medidor de plano e uso de eventos** (`Pro · 1.250 / 5.000` com barra) | ⛔ **FORA — não há backend.** `grep -iE "plan\|billing\|subscription\|quota\|usage"` no `schema.prisma` devolve 4 acertos e os quatro são `PENDING_BILLING_INFO`, status de conta da Meta. Registrado no CLAUDE.md |
| Ícone próprio por item de menu | ✅ **feito** |

> 🔧 **Saiu o card "Conta de anúncios"** (`Conectado · 2 contas`) que existia no rodapé
> antigo. Não está em nenhuma referência, e a informação **não se perdeu**: o rodapé de
> estado do Dashboard já diz `Integrações · 2 contas conectadas · 2 com erro`, com o
> detalhe do erro que o selo não tinha.

### Header

| Elemento | Status |
|---|---|
| Busca global central com `⌘K` | ✅ **feito** — 🔧 **paleta própria, sem `cmdk`.** Decisão de 06/08: a dependência não estava instalada, o estilo por atributo `[cmdk-*]` briga com a fronteira "arquivo é Tailwind ou é `sx()`", e o peer dep no React 19 era risco por ~180 linhas. Grupos **Telas · Campanhas · Criativos · Integrações**; setas navegam, Enter abre, Esc fecha, foco preso, ⌘K/Ctrl+K de qualquer tela |
| Título da tela + linha de apoio à esquerda | ✅ **feito** — 🔧 o `01` §9 manda REMOVER o título; o `04` vence e ele fica. O rail colapsado não tem rótulo nenhum, e o subtítulo é a única frase que diz o que a tela faz |
| Seletor de período no header | 🔧 **fica na faixa de filtros** — ver nota |
| Botão `Filtros` | ✅ **feito** — 🔧 **só existe na tela que tem faixa de filtros**, e isso é verificado em execução: a tela REGISTRA a faixa (`useRegistrarFaixaDeFiltros`) e o header só desenha o botão se alguém registrou. Provado pelo lado negativo: no Gerenciador o botão não existe |
| `Central de ajuda` com ícone `?` | ✅ **feito — só atalhos de teclado.** Hoje ⌘K é o único, e o painel tem um item por isso, não por preguiça. 🔧 **Não** é índice de "o que cada tela faz" (doc que ninguém lê e envelhece sozinha), e 🔧 **não** leva link para tela fora do menu — ver a pendência abaixo. Guia de verdade entra aqui quando existir |
| Sino de notificações com badge numérico | ✅ **feito** |
| Alternador de tema | ✅ **feito** |
| Avatar com dropdown `⌄` | ✅ **feito** — mesmo componente do rodapé do rail, duas aparências. 🔧 só itens com destino real (Áreas, Taxas, Sair): não existe tela de perfil, e item que promete tela inexistente é affordance mentindo |
| Indicador `Ao vivo` | ✅ **feito** — 🔧 discreto |

**Nota sobre o seletor de período:** nas referências ele fica no header. No nosso Dashboard ele está na faixa de filtros abaixo do título, junto de Conta / Produto / Fonte — o que é melhor, porque nossos filtros são quatro e não caberiam no header. **Mantém como está.** 🔧

### Global

| Elemento | Status |
|---|---|
| Cartão `Precisa de ajuda?` no rodapé das telas, com link para guia | 🔧 **FORA — não há guia para onde levar.** A Central de ajuda foi reduzida a atalhos de teclado por decisão de 06/08, com o motivo escrito: índice de "o que cada tela faz" é doc que ninguém lê e envelhece sozinha. Um cartão que promete um guia inexistente é affordance mentindo — a mesma regra que matou a interação do globo e a prop `aoVerTodos`. **Volta quando o guia existir**, e aí é rodapé de cada tela, não do shell |
| Barra flutuante de ícones no canto inferior direito | ✅ **não era nossa.** Varredura de `position:fixed` em `src/` e no `globals.css`: os 4 acertos são backdrop de modal, barra de progresso do topo e dois overlays. Nada ancorado naquele canto — é extensão do navegador do usuário. **Nada a remover** |

### 🔜 PENDÊNCIAS do shell — trabalho adiado, não decisão de escopo

| | Item |
|---|---|
| 🔜 | **`Integrações › Visão geral` fora dos filhos da sidebar.** A tela não existe (`integracoes/page.tsx` é `redirect` para `anuncios`), e item de menu que promete uma tela e entrega outra é affordance mentindo. Entra como **PRIMEIRO filho** quando a Visão geral for construída, no passo de Integrações. Os filhos hoje são **Anúncios · Webhooks · UTMs · Pixel/Eventos** |
| ⏳ | **`Integrações › Testes` está fora da navegação de propósito, com prazo.** Saiu do rail pelo `03`; o link de socorro que existia na Central de ajuda **foi removido** em 06/08 por decisão do dono — tela inteira acessível só por dentro de um popover de **atalhos** é PIOR que tela fora do menu: parece disponível e não é encontrável. ⛔ Não religue aquele link. Ela **continua achável pela paleta ⌘K** ("testes"), que é busca global e não esconderijo. **Morre no passo de Integrações** — não agora, para não deletar 911 linhas no meio da entrega de outra tela |

---

## 🔁 OS TRÊS 🔧 REVISÍVEIS — e os dez que NÃO são

> **Dos 13 🔧 do Dashboard, só três têm gatilho objetivo de volta.** Os outros
> dez são decisões permanentes.
>
> ⛔ **Um 🔧 sem gatilho nesta lista não se reabre porque alguém olhou a
> referência e achou diferente.** A referência é o padrão; a divergência já foi
> julgada, e o motivo está escrito. Reabrir exige argumento novo sobre o
> PRODUTO, não sobre a imagem.

| 🔧 | Gatilho de volta | Onde |
|---|---|---|
| **Ícone da plataforma** em Top campanhas | existir a **segunda plataforma** de anúncio | seção abaixo |
| **Sub-rótulo `Google Ads`** sob o nome da campanha (`06` §14.4) | idem — hoje diria "Meta Ads" em toda linha | seção abaixo |
| **Ícone da plataforma por linha** no Gerenciador | idem | CAMPANHAS |
| **Painel `Distribuição por plataforma`** | idem | CAMPANHAS |
| **`Plataforma`** no subtítulo `Objetivo \| Plataforma` | idem | CAMPANHAS |
| **Medidor de plano e uso** no rodapé do rail | existir **backend de cobrança** (`plan`/`quota` no schema) | SHELL |

> ### 📐 OS CINCO DE PLATAFORMA SÃO **UM** 🔧, EM CINCO LUGARES
>
> Acrescentados em 07/08/2026. Estavam separados porque nasceram em telas
> diferentes, e separados eles convidam a ser reabertos um a um — cada um
> parecendo pequeno demais para valer o argumento.
>
> **O gatilho é o mesmo e é objetivo: a segunda plataforma de anúncio existir no
> schema.** Enquanto "gasto" e "Meta" forem sinônimos nesta base, os cinco dizem
> "Meta Ads" em toda linha, que é uma coluna inteira sem informação.
>
> ⛔ E quando o gatilho disparar, **os cinco voltam juntos** — meia coluna de
> plataforma é pior que nenhuma.

**Os treze permanentes**, em uma linha cada: pílula de variação · hachura no
Gasto · Receita em destaque e não verde · Segmented no cabeçalho · folga e raio
no heatmap e na rosca · sem `Ver todos` nos Alertas · sem `Gasto` no seletor do
heatmap · sem régua Alta/Baixa · sem count-up · cor do funil sem laranja ·
**"Sessões" no lugar de "Vis. Página"** · **"não medido" no trecho de ICs** ·
**`Cliques` fora da geometria da fita** (4 etapas onde a referência tem 5).

### 🔧 O FUNIL diverge da referência `16` em TRÊS pontos, e os três por DADO

> Registrados em 07/08/2026. Nenhum é estética: nos três, seguir a referência
> faria a tela afirmar algo que a nossa medição não sustenta.

**1. A etapa 2 chama `Sessões`, não `Vis. Página`.**

A referência conta *pageview*. Nós contamos **sessão**: o `pixel.js` guarda com
`sessionStorage` e grava uma linha de `Click` por sessão, então quem navega por
cinco páginas conta **um**. O rótulo segue o dado.

⚠️ O nome errado aqui não é cosmético — o gestor **divide por ele**. Número
certo com nome errado é pior que a ausência. E a `fonte` no hook já dizia a
verdade (`"1 por sessão"`) enquanto o rótulo ao lado prometia outra coisa:
**quando os dois discordam, o errado é o que promete mais.**

**2. O trecho `ICs → Vendas Inic.` pode sair hachurado, dizendo `não medido`.**

A referência desenha todo trecho como medição. Aqui `Click.checkoutAt` tem dois
escritores — o pixel do navegador e **o webhook do gateway** —, e o segundo é
derivado da venda: toda venda produz um IC. Numa conta sem o pixel instalado,
`ICs === Vendas Iniciadas` **por construção**, e o trecho desenharia 100% de
conversão.

É a mentira mais lisonjeira que o bloco conseguiria contar: *"meu checkout
converte tudo"*, quando a etapa está só repetindo a seguinte. Mesma distinção do
denominador zero (`0,00x` ≠ `—`) e da célula do heatmap, agora em etapa de funil.

| Estado | O que a tela faz |
|---|---|
| ICs do navegador **= 0** | hachura no trecho + pílula `não medido` + tooltip dizendo que a etapa repete Vendas Iniciadas |
| **misto** | linha sob o número: `35 ICs · 11 do navegador` |
| tudo do navegador | nada de especial — é medição inteira |

⛔ **A etapa nunca some.** Etapa que desaparece muda a forma do funil em
silêncio, e a forma é o que a pessoa compara entre períodos.

**3. `Cliques` fica FORA da geometria da fita — nossa fita tem 4 etapas onde a
referência tem 5 na mesma geometria.**

Ele continua sendo etapa: nome em cima, número embaixo, na coluna da esquerda.
O que sai é a participação na ESCALA. No lugar da perda entrou uma **faixa de
cobertura** acima da fita — *"2,9% dos cliques rastreados · 1.185 perdidos"*.

São duas razões independentes, e a segunda é a mais forte:

**(a) A perda ali não é comportamento — é instrumentação.** Quem clicou no
anúncio e não virou sessão **não desistiu, não foi visto**: bloqueador, redirect
que come a UTM, snippet ausente. Chamar de abandono manda otimizar a oferta
quando o problema é a instalação. Somar as duas naturezas na mesma escala faz a
instrumentação quebrada **engolir a figura do comportamento**.

**(b) 🔴 São DOIS SISTEMAS DE MEDIÇÃO DIFERENTES na mesma geometria.** `Cliques`
vem do `DailyAdMetric` **da Meta**; `Sessões` vem da **nossa tabela `Click`**.
Comparar os dois pela espessura sempre foi comparação torta — a razão entre eles
não mede uma conversão, mede a concordância entre dois instrumentos. Separar a
cobertura da fita separa **"nosso funil"** de **"nossa perda de rastreamento"**,
que são coisas diferentes e não pertencem à mesma figura.

> #### A medição que fechou a decisão
> Amplitude de espessura das 4 etapas finais, por cobertura de rastreamento,
> medida com `calcularFluxo` (o código de produção):
>
> | cobertura | com `Cliques` na escala | sem |
> |---|---|---|
> | 2,9% (dev / instalação quebrada) | **0,8px** | 105,6px |
> | 20% | 21,3px | 106,6px |
> | 50% | 53,3px | 106,7px |
> | 80% | 85,4px | 106,7px |
> | 95% | 101,4px | 106,7px |
>
> ⛔ **Com `Cliques` na escala, a legibilidade da figura vira função da qualidade
> da INSTALAÇÃO.** O bloco fica legível para quem não tem problema e desmonta
> para quem tem — exatamente quem mais precisa lê-lo. A coluna da direita é plana
> porque a forma passou a reportar só comportamento.

⚠️ A pergunta que originou isto era *"em produção, com ICs de navegador reais, a
queda se distribui o suficiente?"*. **Ela não depende do dado, e por isso não foi
respondida com seed:** a escala é `Cliques`, e toda etapa depois de `Sessões` é
limitada por `Sessões`. IC de navegador só mexe na etapa de ICs, que já vive
dentro da faixa de 2,9% — nenhuma redistribuição rio abaixo levanta a figura.

Cada um tem o motivo no ponto do documento onde aparece, e nenhum depende de
algo que possa passar a existir.

---

## 🔌 OS 🔧 QUE TÊM A MESMA CAUSA — a ferramenta é MONO-PLATAFORMA hoje

> Agrupados em 07/08/2026 por decisão do dono. **Eles voltam JUNTOS no dia em que
> existir a segunda plataforma**, e é por isso que ficam numa lista só: revistos
> separadamente, cada um pareceria uma decisão de estética.

| Onde | O que sai | Por quê |
|---|---|---|
| Top campanhas — **ícone da plataforma** por linha | 🔧 fora | não há ativo de marca de terceiro nesta base |
| Top campanhas — **sub-rótulo `Google Ads` sob o nome** (`06` §14.4) | 🔧 fora | diria **"Meta Ads" em todas as linhas** — uma coluna de ruído idêntico. E trazê-lo exigiria campo novo em `metrics.ts`, que é fora da apresentação |
| Integrações — **cards por plataforma** | 🔧 fora | mesma causa |

⚠️ **O critério de volta é objetivo:** quando a segunda plataforma existir, o
sub-rótulo passa a DISTINGUIR linhas em vez de repetir. Enquanto só houver Meta,
ele é ruído — e ruído idêntico em toda linha é pior que ausência, porque ocupa a
coluna que a informação usaria.

---

## DASHBOARD — mesclagem

Referência: imagem 1. **Decisão: tudo da imagem 1 + tudo que já construímos.**

> ### ✅ `metrics.ts` FECHADO em 06/08/2026 — só o modo de edição falta
>
> Dos 6 itens que faltavam para bater com a imagem 1, **4 estão feitos**, 1 saiu
> 🔧 com motivo e 1 é impossível hoje. **Tudo o que resta é o modo de edição** —
> que não está em referência nenhuma e é inteiramente seu.

### O que já está de pé

| Elemento | |
|---|---|
| 4 KPIs hero com sparkline e variação | ✅ feito |
| …com a variação em **pílula** ao lado do número | 🔧 **diverge da imagem 1, e de propósito.** Na referência a variação é texto colorido solto (`↑ 18,6% vs período anterior`). O `06` §2 pede cápsula, e é o item 1 da ordem de aplicação dele. Feito em 07/08 |
| **Hachura na série de Gasto** (Receita × Gasto) | 🔧 **NÃO EXISTE na imagem 1** — lá as duas séries são linhas lisas, roxa e cinza. Entrou em 07/08 por **acessibilidade, não estética**: no teste do cinza as duas se distinguiam só pelo preenchimento de área, e "por pouco" (WCAG 1.4.1). Com a listra o Gasto tem textura, que sobrevive ao cinza, ao P&B e ao daltonismo. Decisão do dono, com o motivo medido |
| **Controle do cabeçalho: `Segmented`, não dropdown com chevron** | 🔧 **diverge da imagem 1 por INTERAÇÃO, não por estética.** Lá `Diário ⌄`, `Ver todas ⌄` e `Receita ⌄` são todos dropdown. Aqui, controle de até 3 lentes FIXAS fica com as opções à vista: esconder duas opções atrás de um clique custa uma interação para não ganhar nada. Da 4ª opção em diante, ou em lista que cresce (conta, produto), é `Select` com chevron — e aí a referência está certa. A CAIXA não diverge: mesma altura, mesmo raio. Regra no `06` §14.1 |
| **Receita na cor de destaque, não em verde** | 🔧 **a imagem 1 concorda** — lá a Receita é ROXA (o matiz de destaque daquele produto) e o Gasto é cinza. O nosso é que estava fora: usava `success`. Corrigido em 07/08; a regra virou seção do CLAUDE.md |
| Faixa compacta com os KPIs secundários | ✅ feito — 🔧 não está na referência, fica |
| Receita vs Gasto com seletor Diário/Semanal | ✅ feito |
| Canais (donut, com fallback de canal único) | ✅ feito |
| Alertas com ícone de severidade e tempo relativo | ✅ feito |
| Rodapé de estado com 4 blocos | ✅ feito |
| Saudação com nome e horário | ✅ feito — 🔧 pedido seu |
| Vendas por país: globo + ranking | ✅ feito — 🔧 **não existe em nenhuma referência**, pedido seu |
| Estados vazios que explicam a causa e linkam a solução | ✅ feito — 🔧 não visível em mockup, fica |
| **Alerta de token da Meta expirando** | ✅ **06/08** — 🔧 **não está na referência.** Token vencendo em silêncio para a sincronização inteira; 13 linhas, porque `lib/integracoes/token.ts` nasceu puro prevendo este segundo consumidor |

### O que faltava para bater com a imagem 1

| Elemento | Status |
|---|---|
| **Break-even** no gráfico Receita vs Gasto | ✅ **06/08.** Linha tracejada, com `(estimado pelo período)` na legenda e a explicação no tooltip |
| **Top Campanhas** | ✅ **06/08.** Receita · Gasto · Vendas · ROAS, na **janela do Dashboard** |
| …com ícone da plataforma | 🔧 **fora.** Não há ativo de marca de terceiro nesta base — mesmo motivo de Integrações |
| …com badge de status e menu `⋮` | 🔧 **fora.** Status de campanha é do Gerenciador, que é onde se age; `⋮` sem menu seria controle inerte |
| …com link `Ver todas` | ✅ o Gerenciador **é** o "ver todas" — e ele já está no rail |
| **Performance por hora** — heatmap hora × dia com seletor de métrica | ✅ **06/08.** Receita · Vendas · Lucro |
| …com `Gasto` no seletor | 🔧 **IMPOSSÍVEL, não é escopo.** `DailyAdMetric` é diária e a Meta não reporta gasto por hora — o valor seria o total do dia lançado às 00h. Mesmo motivo do `gastoNaSerie` |
| …com escala lateral `Alta / Baixa` | 🔧 **substituída por algo mais honesto.** Uma régua de gradiente não distingue **célula vazia de célula zero**, que é a informação principal do bloco. O rodapé diz o denominador (`Média de até 5 semanas`) e a hachura marca o não observado |
| Link `Ver todos` no painel de Alertas + contador `+2 alertas` | ✅ **já existia** — o `+ N alerta` aparece quando passa de 3 |
| Sparkline no card de Lucro | ✅ — ⚠️ esta linha dizia ❌ *"a série `lucroLiquido` não existe no servidor"* até 07/08/2026. **Ela existe** (`metrics.ts:1274`) e o card a desenha desde então; o ❌ era documentação envelhecida. A série sai vazia na granularidade HORÁRIA de propósito: `DailyAdMetric` não tem hora, e o lucro por hora viria com o gasto do dia inteiro no balde das 00h |
| Ícone em caixa colorida ao lado de cada KPI | 🔧 **fora do Dashboard, de propósito.** Aparece nas imagens 8 e 9 (Snippets e Criativos), **não na imagem 1**. Aplicar onde a referência mostra: consistência com a referência vence consistência interna |

### Modo de edição — 🔧 inteiramente seu, não está nas referências

**É tudo o que falta.** O catálogo agora está completo — foi por isso que a ordem
foi invertida: Top Campanhas e heatmap precisavam existir antes, senão o catálogo
nasceria e teria de ser revisitado para acrescentá-los.

**✅ FECHADO em 07/08/2026.** Era o último item do Dashboard.

| Elemento | |
|---|---|
| Botão `Editar painel` | ✅ |
| Três zonas com contorno e **a REGRA no rótulo** | ✅ — "Principais — sempre 4", "Resumo — até 8", "Painéis" |
| Zona 1 — hero: exatamente 4, escolha de quais e ordem | ✅ |
| Zona 2 — faixa: quantidade e ordem livres, máx. 8 | ✅ |
| Zona 3 — painéis: reordenar, ocultar, larguras declaradas | ✅ — grade de **12 colunas** com encaixe, todas as larguras inteiras |
| Painel lateral `Métricas disponíveis` / `Painéis disponíveis` | ✅ `CatalogoLateral` |
| `Salvar` · `Cancelar` · `Redefinir configurações` | ✅ `BarraEdicao` |
| **Migração dos layouts salvos** | ✅ — `test:migrar-layout`, 41 asserções. 🔴 Achou de quebra o defeito que **anulava o Salvar**: `loadDashboardLayouts` passava o envelope v2 por `sanitizeLayout`, que recusa o que não é array — salvar parecia funcionar e o arranjo sumia no recarregamento |
| Arrasto entre posições | ✅ — substituiu o clique |
| Alça de altura | ✅ — `minHeight`, nunca `grid-row: span`: piso, não teto |
| Aviso `N colunas livres` por linha | ✅ 🔧 não está em referência nenhuma |
| Catálogo completo de blocos | ✅ — **nenhum item sem destino.** Os dezesseis são de `paineis` e todos têm zona; as métricas vão para Principais ou Resumo |
| `BreakdownPanel` único parametrizado por dimensão | ✅ — absorveu Fontes, Produtos, Pagamentos e Posicionamento |

> ### 🔴 ESTRUTURAL = NÃO PODE SER **OCULTADO**. Nada além disso.
>
> **Correção do dono, 07/08/2026.** Esta seção dizia o contrário — que os quatro
> ficavam FORA do catálogo, numa zona "Sempre visíveis" — e a definição errada
> tinha consequência de layout: *"não removível"* virou *"não redimensionável"*.
>
> O sintoma foi `Vendas por país` ocupando a tela de ponta a ponta, sem alça,
> sem como mexer. Um bloco que o usuário não pode esconder continua sendo um
> bloco que ele arruma.
>
> | Estrutural garante | Estrutural NÃO garante |
> |---|---|
> | estar sempre na lista de painéis | posição |
> | não ter ✕ | largura |
> | | altura |
>
> Os quatro (`receita-gasto`, `alertas`, `paises`, `rodape`) estão no catálogo,
> na zona Painéis, com `colMin` e `colPadrao` próprios. O que os marca é uma
> string: `estrutural`, a frase que vai para a tooltip do selo `Fixo`.
>
> ⚠️ **A garantia é a REPOSIÇÃO, não a ausência do botão.** `reporEstruturais`
> devolve os quatro em todo layout lido — a ausência do ✕ cobre o usuário de
> hoje, não um salvo gravado por versão anterior nem o arrasto de volta para o
> catálogo. A guarda de verdade está no hook e na migração.
>
> ⛔ A zona **"Sempre visíveis" foi REMOVIDA**. Ela mostrava quatro molduras
> vazias, porque o conteúdo estava em JSX fixo noutro ponto da tela.

> ### ⚠️ O que o modo de edição NÃO faz, de propósito
>
> - **Não anima a entrada dos blocos.** Fora dele os blocos entram escalonados
>   (`06` §11); ali eles entram e saem a cada arrasto, e reanimar cada mudança
>   seria um piscar constante.
> - **Não tem arrasto ENTRE zonas.** As regras de zona são diferentes (hero são
>   exatamente 4; faixa aceita até 8), e um item arrastado para uma zona que não
>   o aceita precisaria ser recusado no meio do gesto.

---

## INTEGRAÇÕES

Referências: imagens 3, 5 e 6. É a tela com mais material de referência e a mais rica.

> ### ✅ COMMITS 1 E 2 ENTREGUES — 06/08/2026.
>
> ### 🔜 E O ESCOPO CRESCEU DUAS TELAS
> `PixelView` (1.181) e `WebhooksView` (532) **sobreviveram**, e viram as telas
> próprias de `/integracoes/pixel` e `/integracoes/webhooks`. O motivo é de
> hierarquia: **o painel é POR INTEGRAÇÃO, essas views são POR USUÁRIO.**
> Deletá-las agora deixaria três rotas do menu sem tela. Entram depois de
> UTM & Snippets.
>
> ### O commit 1 foi estrutura, o 2 foi conteúdo de aba.
>
> O passo foi dividido em dois de propósito: reacomodar as 1.700 linhas da
> `PixelView` + `WebhooksView` dentro de um painel de 45% junto com a estrutura
> nova misturaria dois trabalhos e dois motivos de revisão. **As abas
> `Configurações / Sincronização / Logs / Webhooks` são o commit 2.**
>
> ### 🔴 A DIVERGÊNCIA DE FUNDO ENTRE AS REFERÊNCIAS E O PRODUTO
>
> As três imagens descrevem um produto **multi-plataforma**: catálogo de 15
> integrações, abas por rede de anúncios, cards de Google Ads, TikTok, Stripe,
> RD Station, Microsoft Ads, Taboola, GTM.
>
> **Esta ferramenta integra Meta e gateways brasileiros, e mais nada.** As
> "integrações" reais são `1 AdProfile + N Webhooks + N PixelConfigs` — três
> naturezas diferentes, não 15 linhas homogêneas.
>
> Reproduzir o catálogo literal produziria **cinco cards mentindo lado a lado**:
> card de plataforma que não conecta é botão que não faz nada, em escala. Quando
> Google Ads existir, ele entra sozinho — o inventário monta a partir do que há.

### Sub-navegação (imagem 3)

| Elemento | Status |
|---|---|
| `Visão geral · Anúncios · Webhooks · UTMs · Pixel/Eventos` | ✅ **Visão geral entrou como primeiro filho.** 🔧 sidebar em vez de abas horizontais, decisão do dono |
| Aba `Testes` | ⛔ **A tela foi DELETADA** (911 linhas + `TestadorPayloadCard`, 244, que só ela importava). Saiu também da paleta ⌘K: link para rota inexistente é 404 com cara de recurso |

### Visão geral

| Elemento | Status |
|---|---|
| Faixa de estado: `Conectadas` · `Com erro` · `Inativas` · `Total` | ✅ |
| Cards com ícone em caixa e linha de contexto | ✅ |
| `+1 este mês` no card Total | 🔧 **REMOVIDO.** Numa base com 1 perfil e 2 webhooks diria "+0" quase sempre. Número que nunca muda num card de estado ensina a não olhar o card |
| **Cada card é FILTRO clicável** | ✅ **acrescentado** — não estava na referência. Card de contagem que não leva à lista obriga o usuário a reproduzir o filtro à mão logo abaixo |
| Filtro de texto | ✅ |
| `Status: Todos` + `Ordenar: Recentes` | 🔧 o Status virou os cards da faixa (mesma função, menos controle). Ordenar não entrou: com 5 itens não ordena nada |
| Tabela: INTEGRAÇÃO · CATEGORIA · STATUS · ÚLTIMA SINCRONIZAÇÃO | ✅ |
| Ícone real de cada plataforma na linha | 🔧 **fora.** Não há ativo de marca de gateway nesta base, e o `/marca/` só tem a nossa. Buscar logotipo de terceiro é decisão de produto, não de layout |
| Badge de categoria | ✅ derivado do TIPO (`Anúncios`, `Webhooks`, `Pixel`) |
| Categorias semânticas (`Pagamentos`, `Leads`, `Conversões`) | 🔧 **não existem.** `Webhook.platform` guarda o GATEWAY, não classificação. Selo que não separa nada |
| Linha selecionada com borda e destaque persistente | ✅ borda ESQUERDA + fundo — fundo sozinho some no tema claro |
| Paginação `Mostrando 1 a N de M` + `‹ 1 2 ›` | ✅ |
| `+ Nova integração` | ✅ |
| **Painel de detalhe** persistente à direita | ✅ |
| Painel: cabeçalho com nome, subtítulo, badge de status | ✅ |
| Painel: ícone da plataforma e `⋮` | 🔧 ícone pelo mesmo motivo da linha; `⋮` sem menu seria controle inerte |
| Painel: abas `Configurações / Sincronização / Logs` | ✅ **commit 2** — e são POR ITEM: "Logs" só aparece para webhook, o único tipo com fluxo de log |
| Aba `Webhooks` | 🔧 **fora.** Para uma integração de webhook a aba seria ela mesma; o perfil da Meta não tem webhook associado |
| Aba `Visão geral` dentro do painel | 🔧 redundante — o painel inteiro já é a visão geral do item |
| Painel: descrição em caixa | ✅ vira a caixa de MOTIVO quando há erro; sem erro não há texto a inventar |
| Painel: grade de metadados | ✅ Conta, Tipo, contagens, Conectada em, Fuso |
| Metadado `Moeda` | 🔧 é da CONTA, não do perfil, e contas do mesmo perfil podem ter moedas diferentes. Aparece no bloco de Contas |
| Ícone por campo na grade | 🔧 seis ícones decorativos numa grade de texto — ruído sem função |
| Painel: `Dados sincronizados` — 6 itens ✓ | 🔧 **fora.** Seriam seis ✓ fixos, iguais para toda conta: não medimos por-tipo o que sincronizou. Seis marcas de confirmação que confirmam nada |
| Painel: `Desconectar` com confirmação | ✅ nomeia o que se perde **e o que NÃO se perde** (histórico fica) |
| Painel: `Testar conexão` | 🔧 **virou `Testar e sincronizar`.** `/api/sync/manual` ESCREVE no banco; um botão que diz "testar" e grava é affordance mentindo. Só aparece no perfil da Meta — em webhook e pixel não há o que testar sem evento real, e controle desabilitado sem explicação é pior que ausência |

### Saúde e plataformas (imagem 6)

| Elemento | Status |
|---|---|
| Painel `Saúde da integração` | ✅ **com 5 das 7 linhas** |
| API Meta · Pixel · Webhook · CAPI · Token de acesso | ✅ todos derivados de dado real |
| `Conversões Offline` | 🔧 **a ferramenta não faz isso.** Zero ocorrências no código e no schema |
| `Permissões 100%` | 🔧 **não guardamos os scopes do token.** Exigiria consultar a Graph API |
| **`Tokens expiram em N dias`** em cor de atenção | ✅ **e é o item de maior valor da tela** — ver abaixo |
| Bloco de plataforma em destaque com contas/campanhas/pixels | ✅ no painel de detalhe |
| …com `business managers` | 🔧 **NÃO EXISTE.** Nem model, nem campo, nem chamada — `grep -i business` no schema devolve zero |
| `Plataformas conectadas` — cards com contagem e status | ✅ **só o que está conectado** |
| Cards de Google/TikTok/Stripe/Taboola | 🔧 ver a divergência de fundo, acima |
| `Contas conectadas` com Campanhas / Pixels / status | ✅ |
| …com coluna `BM` | 🔧 mesmo motivo |
| Badge `Principal` na conta primária | 🔧 **não há conceito de conta principal** nesta base. Todas as contas de um perfil são pares |
| `Ver todas as N contas ⌄` | ✅ |
| Painel `Atividade recente` | ✅ **união de 3 fontes** (`WebhookLog` + `Notification` + falha de sync), ordenada por tempo. LIMIT 20, sem paginação — o `WebhookLog` não tem retenção |

> ### 🔴 O TOKEN — por que este item justifica a tela sozinho
>
> Token de Marketing API vencendo em silêncio para a sincronização inteira: o
> gasto congela, o ROAS passa a mentir por omissão, e o motor de regras decide
> com dado velho.
>
> O dado **já existia e já era escrito** (`AdProfile.tokenExpiresAt`, no callback
> do OAuth) e o `/api/cron/manutencao` **já notificava**. O que faltava era
> aparecer na TELA — notificação se perde.
>
> **São TRÊS estados, e o terceiro é o mais perigoso:**
>
> | Estado | Texto |
> |---|---|
> | vencido | "Token expirado há N dias" |
> | vence | "Expira em N dias" |
> | **`null`** | **"Data de expiração desconhecida"** |
>
> `null` é *"não sabemos quando expira"*, **nunca** *"não expira"*. São perfis
> conectados antes de a coluna existir — os mais antigos da base, logo os mais
> prováveis de já estarem vencidos. Um "—" discreto ali faria o mais perigoso
> parecer o mais inofensivo.
>
> A derivação vive em `lib/integracoes/token.ts`, **pura e sem React**, porque o
> alerta de token pendente no `metrics.ts` do Dashboard vai usar a mesma conta.
> Duas implementações da mesma conta divergem sempre.

Nossos gateways brasileiros entram no mesmo padrão de `Plataformas conectadas` —
e entram **pelo webhook cadastrado**, não por um catálogo fixo.

---

## ANÚNCIOS

> ### ⛔ SEM IMAGEM DE REFERÊNCIA — a terceira tela do redesign nessa situação
>
> Como WEBHOOKS e PIXEL & EVENTOS, esta seção foi **escrita a partir do que a
> `AnunciosView` (322 linhas) já faz**, mais o histórico de entregas — não
> conferida contra print. As imagens 3, 5 e 6 são todas a *Visão geral*.
>
> Seção **nova**, e não um apêndice de INTEGRAÇÕES: misturar a contagem
> esconderia o que falta nesta tela. O `docs:estado` passa a contar **14 telas**.
>
> ⛔ **Todos os itens nascem ❌, não em branco.** A convenção da linha em
> branco é *"construída e NÃO VISTA"* — ela tira o item da contagem. Aqui a
> tela **não existe**, e usar branco mostraria `0 | — | —` na tabela de
> estado: nada feito e **nada faltando**, que é o oposto da verdade.

> ### 🔑 O PAINEL DE INTEGRAÇÕES › VISÃO GERAL É POR INTEGRAÇÃO. ANÚNCIOS É POR PERFIL
>
> O objeto que **conecta, expira e reconecta** é o **perfil**, não a conta. É a
> terceira da família por-usuário, junto de Pixel e Webhooks.
>
> **O motivo que decide é a ação, não a hierarquia:** reconectar é a coisa mais
> importante que se faz aqui, e ela pertence ao perfil. Numa lista achatada de
> contas não há onde pendurá-la — apareceria repetida em cada linha, ou fora de
> lugar num cabeçalho.
>
> ⚠️ Decisão do dono, 18/08/2026. Ela existia para Pixel e Webhooks e **faltava
> para esta tela** — e a ausência foi o que bloqueou a construção: o `04` tem
> precedência sobre todos, e uma tela sem inventário aqui seria especificação
> escrita por quem constrói.

> ### 🔴 O RECORTE POR ÁREA AQUI É INDIRETO — e isso vira CONTEÚDO, não problema
>
> `AdProfile` **não tem `workspaceId`**. O escopo entra nas CONTAS
> (`adAccounts: { where }`), e o perfil some por consequência de ficar sem
> nenhuma (`perfisNoEscopo`, medido em `test:perfis-area`).
>
> **Duas consequências, e as duas são informação que a tela deve DIZER:**
>
> | o que acontece | o que a tela diz |
> |---|---|
> | o perfil aparece com um SUBCONJUNTO das contas dele | **`3 de 8 contas nesta área`** — o resto declarado, não escondido |
> | um perfil sem NENHUMA conta nesta área **não aparece** | precisa estar dito em algum lugar, senão o usuário procura um perfil que sabe ter conectado |
>
> ⛔ Numa lista achatada de contas, as de outra área **simplesmente somem** e
> ninguém sabe que existem. A vitrine de perfis é o que torna a ausência
> declarável — e é o segundo motivo de ela ser a forma certa.

### Vitrine — a lista de perfis conectados

| Elemento | Status |
|---|---|
| Card por perfil, com avatar, nome e e-mail | ❌ |
| **`N de M contas nesta área`** — o recorte declarado no próprio card | ❌ |
| Aviso quando um perfil conectado **não aparece** por não ter conta nesta área | ❌ |
| Contagem de contas com rastreamento ligado (`trackedCount` / `accountCount`) | ❌ |
| Selo de estado do TOKEN (válido · expira em N dias · vencido · desconhecido) | ❌ |
| `Reconectar` — a ação principal da tela, no PERFIL | ❌ |
| `Desconectar`, com confirmação que nomeia o que se perde e o que NÃO se perde | ❌ |
| `Sincronizar` do perfil, e o estado `jaSincronizando` quando a reserva é negada | ❌ |
| `Adicionar perfil` / `Conectar Facebook Ads` no estado vazio | ❌ |
| Estado vazio dizendo o que se perde sem perfil (sem gasto, sem ROAS, sem ROI) | ❌ |

### Contas de um perfil

| Elemento | Status |
|---|---|
| Expandir o card revela as contas DA ÁREA ATIVA | ❌ |
| Nome, `fbAccountId` e moeda de cada conta | ❌ |
| Interruptor de rastreamento por conta (`toggleTracking`), pelo primitivo `tk/Controles` | ❌ |
| `Ativar todas` / `Rastrear` em massa, no nível do perfil | ❌ |
| Selo de status da conta, com **`Status não informado`** distinto de `Desabilitada` | ❌ |
| `Sincronizar` de UMA conta, com a mensagem de resultado ao lado | ❌ |
| Indicador de **busca de histórico** na primeira sincronização (`buscandoHistorico`) | ❌ |

### Erros e espera — o que a tela antiga já fazia bem

| Elemento | Status |
|---|---|
| Erro de sincronização POR CONTA, com o tom do `erroMeta.ts` respeitado | ❌ |
| ⛔ Erro do PERFIL não repetido em cada conta (`mesmoErroDoPerfil`) | ❌ |
| Contador de falhas seguidas e rótulo de espera do backoff (`esperaLabel`) | ❌ |
| Erro CRU disponível, sem poluir o card (`erroCru`) | ❌ |
| `erroDescoberta` do perfil — explica `accountStatus` nulo em massa | ❌ |

> ### ⚠️ O QUE **NÃO** ENTRA, e o motivo de cada um
>
> | | |
> |---|---|
> | catálogo multi-plataforma (Google, TikTok, Stripe…) | 🔧 a ferramenta é **mono-plataforma** hoje — mesma causa dos 🔧 de INTEGRAÇÕES |
> | criar/editar conta de anúncio | não somos o Gerenciador da Meta; a conta nasce lá |
> | mover conta entre áreas | é a tela de **Áreas de Trabalho**, e o vínculo é `AdAccount.workspaceId` |

> ### 🔗 O QUE ELA HERDA, já medido
>
> - **`perfisNoEscopo`** (`lib/facebook/perfis.ts`) já extraído e asserido —
>   `test:perfis-area`, 15 asserções, com as **quatro** formas de fixture.
> - **`jaSincronizando`** já tem contrato e leitor; a tela nova precisa mantê-lo.
> - ⚠️ **`v.adProfiles` NÃO fica órfão** ao deletar a `AnunciosView`: a
>   `VisaoGeralScreen` e o `AppShell` também o leem. Ver o registro no CLAUDE.md.

## REGRAS

Referência: imagem 2. Tela inteiramente nova.

| Elemento | Status |
|---|---|
| Cabeçalho: `‹ Voltar`, nome da regra, badge `Ativa` com ponto | ❌ |
| Subtítulo `Criada em … · Atualizada há …` | ❌ |
| `Modo de teste` (toggle) · `Mais opções ⋯` · `Salvar regra ⌄` | ❌ |
| **Paleta** à esquerda com abas `Gatilhos / Condições / Ações` | ❌ |
| Item da paleta: ícone, nome, uma linha de descrição | ❌ |
| `+ Solicitar novo gatilho — Não encontrou o que precisa?` | ❌ |
| **Canvas** com fundo pontilhado | ❌ |
| Controles: `− 100% +` · ajustar à tela · desfazer · refazer | ❌ |
| Indicador `✓ Validação` com dropdown | ❌ |
| Nó de gatilho, condição, ação e fim — visuais distintos | ❌ |
| Nó de condição com operador `E` entre as linhas e chips de valor | ❌ |
| Ramificação com rótulos `Sim` (positivo) e `Não` (negativo) | ❌ |
| Botão `+` **na aresta**, entre nós | ❌ |
| Nó selecionado com borda destacada | ❌ |
| **Inspector** à direita: `Propriedades do componente` + `ID: cond_1` | ❌ |
| Inspector: operador lógico, lista de condições com `🗑` por linha | ❌ |
| Inspector: `+ Adicionar condição` | ❌ |
| Inspector: `Se verdadeiro (Sim)` / `Se falso (Não)` | ❌ |
| Inspector: seção `Informações` recolhível — criado, atualizado, executada N vezes, taxa de sucesso | ❌ |
| Inspector: `🗑 Excluir componente` | ❌ |
| Rodapé: `Execuções (7 dias)` · `Taxa de sucesso` · `Última execução` · `Ver logs de execução` | ❌ |

Biblioteca: `@xyflow/react`, importação dinâmica.

---

## CAMPANHAS / GERENCIADOR

Referência: imagem 4.

> ### 🔎 O QUE ESTA COLUNA SIGNIFICA, DEPOIS DE 08/08/2026
>
> **✅ = eu vi na tela**, no tema escuro, a 2560px, contra o banco de dev — não
> "o código existe". **Linha em branco = construída e NÃO VISTA**, e ela é de
> propósito: o `docs:estado` só conta linha com marcador, então o item fica fora
> da contagem em vez de entrar como feito.
>
> ⛔ **Escrever ✅ no que não foi visto é o defeito que este documento existe
> para impedir** — foi assim que 3 dos 4 primitivos da Fase 2 passaram verdes
> com defeito visível. As brancas fecham quando o dono terminar a passada de
> tema claro, largura estreita e hover.

| Elemento | Status |
|---|---|
| 5 KPIs com sparkline: Gasto, Receita, Lucro, ROI, Conversões | ✅ os cinco, com sparkline. 🔧 **`ROI` virou `ROAS`** no hero — o ROI de mídia é COLUNA da tabela, e os dois com o mesmo nome foi o que o `overview.ts` já proibiu |
| Painel `Status das campanhas` — donut com Ativas / Pausadas / Rascunhos e % | ✅ visto: Ativas 50,0% (6) · Pausadas 25,0% (3) · Arquivadas 16,7% (2) · Sem status 8,3% (1), total 12. 🔧 **sem a fatia `Rascunhos`** — ver abaixo |
| Abas `Todas / Ativas / Pausadas / Rascunhos / Arquivadas` | ✅ as quatro. 🔧 **sem a aba `Rascunhos`** — ver abaixo |
| `Agrupar por: Campanha ⌄` | ✅ |
| `⤓ Exportar` | ✅ na tela — ⚠️ **não clicado**, o arquivo gerado não foi conferido |
| `+ Nova campanha` | ✅ na tela — ⚠️ **modal não aberto** |
| Busca + `Plataforma` + `Status` + `Objetivo` + `Mais filtros` | 🔧 **o conjunto mudou:** Busca ✅ · `Objetivo` ✅ (só aparece com mais de um) · `Status` são as ABAS · `Plataforma` está 🔧 fora (mono-plataforma) · `Mais filtros` virou `Colunas`, que é a pergunta real com 19 delas |
| Tabela com **checkbox de seleção múltipla** | ✅ exercido: marca, barra aparece, cabeçalho vai a indeterminado, `Limpar seleção` |
| Cabeçalhos com ícone `ⓘ` de ajuda nas colunas ambíguas | ✅ o ⓘ está em toda coluna, com a linha `Cada coluna diz na ajuda de onde vem o número — e por que ele pode divergir da Meta`. ⚠️ **o CONTEÚDO do tooltip não foi lido** — é a passada de hover do dono |
| Nome da campanha como link + subtítulo `Objetivo \| Plataforma` | ✅ nome + objetivo por baixo. 🔧 **duas divergências:** `Plataforma` diria "Meta Ads" em toda linha, e o nome **não é link** — a hierarquia é expansão inline (chevron `›`), que é o que o `03` manda |
| Ícone da plataforma por linha | 🔧 **FORA** — plataforma única |
| Badge de status colorido por estado | ✅ visto nos cinco: `Veiculando` · `Pausado` · `Falta pagamento` · `Em análise` · `Campanha pausada` |
| Coluna de Lucro em cor de valor positivo | ✅ e nos dois sentidos — `R$ 1.777,33` verde, `R$ −196,00` vermelho |
| Linhas de rascunho com `—` nas métricas e ação `▷` | ✅ conferido **no DOM, não a olho**: `[DEV] Rascunho Importado` tem `—` em Veiculação/Gasto/Lucro/ROAS, cada um com `title` PRÓPRIO, e `R$ 0,00` só em Faturamento (`fonte: "nosso"` — medição de verdade). 🔧 **o `—` FICA, o "rascunho" SAI** — ver abaixo |
| Ações por linha: gráfico + `⋮` | ❌ **não construído.** As ações moram na barra de seleção (`Ativar` · `Pausar` · `Mais ações`), e o `⋮` por linha duplicaria isso com um alvo de 17px |
| **Painel `Insights`** com 4 cartões: melhor campanha, maior volume, menor custo por conversão, atenção necessária | ✅ os quatro na tela. 🔧 **há um 5º, condicional** — *"a melhor da tela não está entregando"*. ⚠️ **não visto disparando**: ele exige `melhorParada > melhorVeiculando`, e no dev de hoje a melhor entrega (17,59x). Os dois lados estão em `test:gerenciador` |
| Painel `Distribuição por plataforma` com barra e valor | 🔧 **FORA** — ver abaixo |
| Paginação `‹ 1 2 3 … 6 ›` + `10 por página ⌄` + `Mostrando 1 a 7 de 40` | ✅ os três, com `Mostrando 1 a 10 de 10 campanhas`. ⚠️ **a reticência não foi vista** — 10 campanhas dão uma página só; ela tem teste próprio |
| Conjuntos de colunas nomeados + colunas congeladas | ✅ **medido**, não estimado: 4 conjuntos (`Performance`/`Custo`/`Conversão`/`Tudo`, cada um com uma PERGUNTA de apoio), 19 colunas em `Tudo`, 3 congeladas (`sticky`, `left` 0/40/92), cabeçalho `sticky` no topo, borda por `box-shadow`. **`document.body` não rola na horizontal** — 2290px de conteúdo numa caixa de 1942px |
| **Selo `não sincronizado` na linha** + fatia condicional no donut | ✅ os dois, e a frase que os liga: *"1 campanha nunca sincronizou — os números da Meta não existem para ela."* |
| **Barra de seleção FLUTUANTE** | 🔧 **nosso, e nasceu de um bug medido na tela:** no fluxo ela empurrava a tabela 36px e fazia errar a 2ª linha marcada. Hoje é camada `absolute` sobre a tabela. Guarda em `test:gerenciador`, provada pelo lado negativo |
| Tema claro | ✅ **medido:** página `rgb(248,250,252)` × card branco. O preenchimento sozinho dá **1,05:1**, e não é defeito — quem separa é **borda 1px + sombra**, e as duas estão aplicadas (o override de `--tk-shadow-card` no claro, que já nasceu morto uma vez por especificidade, segue de pé). Texto da tabela **17,85:1** |
| Hover de linha + tooltips dos `ⓘ` | ✅ **medido.** Hover: `rgb(240,241,243)` sob o mouse contra `rgb(255,255,255)` na linha vizinha. Tooltips abrem e **declaram a procedência na última linha** — `Gasto` → *"Vem do Facebook"*; `ROAS` → *"Faturamento ÷ Gasto · Calculado a partir dos dois"*. É a regra dos dois instrumentos coluna a coluna |
| Largura estreita | ⏳ **NÃO VISTO** — e continua em branco de propósito. `resize_window` reportou sucesso e não redimensionou pela **terceira** vez: `innerWidth` ficou em 2560, igual a `screen.availWidth`. Bloqueio de AMBIENTE |

### 🔧 `RASCUNHOS` SAI — e `UNKNOWN` **não** vira aba

> Decisão do dono, 07/08/2026, depois da medição.

**Não temos o conceito.** `EntityStatus` tem cinco valores — `ACTIVE`, `PAUSED`,
`ARCHIVED`, `DELETED`, `UNKNOWN` — e nenhum é rascunho. `veiculacao.ts` mapeia 12
`effective_status` da Meta e nenhum é rascunho. O filtro do `overview.ts` oferece
`todos | ativo | pausado`. Três itens da referência caem por isso: a aba, a fatia
do donut e as linhas com `▷`.

⛔ **E `UNKNOWN` não ocupa o lugar vago.** Em produção o `sync.ts` escreve
`status` em toda campanha, então `UNKNOWN` é raro — **aba que fica vazia para
todo mundo é controle inerte com outro nome.** O que ele vira:

| | |
|---|---|
| **estado na linha** | selo `não sincronizado`, ao lado do status |
| **fatia do donut** | **condicional** — aparece só se houver, some se não houver |

É o padrão da linha de bots no funil: o elemento existe quando o caso existe, e
não deixa `0 não sincronizados` como ruído permanente.

### ✅ O `—` das linhas de rascunho SOBREVIVE, colado num estado que é real

O que a referência resolve com "rascunho" nós temos de resolver com a distinção
central do projeto: **campanha sem nenhuma `DailyAdMetric` na janela**.

> ⚠️ A tabela abaixo é EXPLICATIVA, não inventário — e por isso não usa os
> glifos de status. O `docs:estado` conta a primeira marca de **qualquer** linha
> de tabela desta seção, então um ✅ ilustrativo aqui vira "um item feito" no
> `CLAUDE.md`. Aconteceu ao escrever isto.

| | hoje | na tela nova |
|---|---|---|
| ROAS de campanha sem gasto | `—`, correto (o `div()` de `ads/metrics.ts` já acerta) | `—` |
| **Gasto** de campanha sem gasto | **`R$ 0,00`** — a afirmação errada | **`—`** |

`R$ 0,00` afirma "sincronizou e não gastou"; a campanha nunca sincronizada não
sustenta essa afirmação.

⛔ **O CÁLCULO NÃO MUDA.** `sumAds` continua reduzindo a partir de `{spend: 0}`,
e ele é anterior à branch (`overview.ts`, antes de `4e6aa9e`). Quem distingue é a
APRESENTAÇÃO — mesma solução da linha de base do ROAS: conta intocada, tela
honesta.

### 🔧 `Distribuição por plataforma` — o motivo NÃO é "somos mono-plataforma"

Medido na imagem 4: `Google Ads 58% · R$ 29.892,44`, `Meta Ads 32% · R$ 16.505,12`,
`TikTok Ads 10% · R$ 5.220,58`. **A soma é R$ 51.618,14 — exatamente o KPI
`Gasto`.** O painel é *gasto por plataforma de anúncio*, e temos uma só.

⚠️ **A coisa parecida que sabemos medir é outra, e já está em outra tela.** As
quatro `utmSource` do banco (`organico`, `google`, `facebook`, `tiktok`) são
**origem de tráfego** medida pelo NOSSO rastreamento, e o que elas sustentam é
*receita por origem* — outro instrumento e outra grandeza (`06`/CLAUDE.md, DOIS
INSTRUMENTOS). Vesti-la com o nome do item da referência seria a razão entre
sistemas de medição diferentes passando por conversão.

⛔ **E o painel de origem de tráfego também não entra**, mesmo sendo mensurável:
`Fontes de tráfego` já o mostra no Dashboard. Terceira forma de dizer a mesma
coisa é o argumento que matou o globo colorido.

> ### 📌 CORREÇÃO DE REGISTRO — este item estava `❌`, não `🔧`
> O `CLAUDE.md` de 07/08 afirmava que ele estava *"🔧 fora por a ferramenta ser
> mono-plataforma"*. **Estava `❌`** — ou seja, era item **nunca julgado**, não
> item com motivo escrito. A diferença importa: um `❌` é trabalho pendente e
> cobra explicação no fim da tela; um `🔧` já foi decidido. Passa a `🔧` agora,
> com o motivo acima.

---

## UTM & SNIPPETS

Referências: imagens 7 e 8. Vira área de primeiro nível — **construída em
11/08/2026**, rota `/dashboard/utm`. A `UtmsView` (397 linhas) foi DELETADA.

> ### 🔎 A CONVENÇÃO DAS LINHAS EM BRANCO VALE AQUI TAMBÉM
> **✅ = eu vi na tela.** **Linha em branco = construída e NÃO VISTA** — e em
> branco ela fica FORA da contagem do `docs:estado`, em vez de entrar como feita.
>
> Nesta tela sobrou **uma** em branco: a largura estreita. E há um ⚠️ sobre o que
> dentro de uma linha ✅ não foi exercido.

### UTM Builder (imagem 7)

| Elemento | Status |
|---|---|
| Abas `UTM Builder` / `Snippets` | ✅ |
| A tabela de Snippets DENTRO da aba Builder | 🔧 **separamos porque o nosso Builder é mais denso que o da referência**: três colunas, contra as duas dela. A tabela tem 7 linhas e prévia de código — empilhada sob um Builder de três colunas, ela empurraria o próprio detalhe para fora da tela |
| Borda de baixo IRREGULAR na fileira do Builder | ✅ 🔧 nosso, e é o INVERSO do que ficou por meio commit. Cada cartão termina onde o conteúdo dele termina. **Medido:** `713 / 478 / 713` |
| `⤒ Importar` + `+ Novo UTM ⌄` | 🔧 nada a importar (não há persistência) e a página INTEIRA é o "novo UTM" — os dois seriam controles inertes |
| Formulário: Fonte, Mídia, Campanha, Termo, Conteúdo, ID da campanha | ✅ |
| Ícone da plataforma dentro do campo Fonte | ✅ ⚠️ só onde temos ARTE (facebook e os 5 gateways). Google e TikTok não têm arquivo, e o monograma do `LogoGateway` pareceria logotipo quebrado |
| `🗑 Limpar campos` + `🔗 Gerar URL` | ✅ |
| Painel `URL gerada` com badge `● Válida` | ✅ vistos `Válida` e `Incompleta` |
| URL em fonte mono com botão copiar | ✅ ⚠️ o **clique de copiar não foi exercido** |
| `Visualização` — **um chip colorido por parâmetro** | ✅ 6 chaves, 6 dos 7 pares `--tk-tint-*`/`--tk-on-tint-*`. Nenhum token novo |
| `Salvar como modelo` com campo e botão | ✅ exercido |
| `Histórico recente` — hora, ícone da plataforma, `fonte / mídia`, campanha | ✅ exercido. 🔧 sem ícone de plataforma: só temos arte para uma das três da referência |
| `Modelos favoritos` — com marcador de favorito e `⋮` | ✅ exercido. 🔧 o `⋮` é botão de excluir direto: com **uma** ação, menu é clique a mais para esconder o que cabia |
| Cartão `Como usar UTMs e Snippets` com `Ver guia completo ↗` | ✅ 🔧 o botão vai para Integrações. **Não existe guia** — link para página inexistente é affordance mentindo |
| Montagem da URL por função pura testada (mata o `[object Object]`) | ✅ `lib/utm/construir.ts` + `test:utm-url` (14 asserções) |
| Modelos e histórico com PERSISTÊNCIA | 🔧 memória de sessão atrás de `ArmazemUtm`. Não há tabela — decisão do dono: migration em sessão própria. A tela DECLARA o limite, e a frase deriva de `armazemUtm.persiste` |

### Snippets (imagem 8)

| Elemento | Status |
|---|---|
| Abas `Meus snippets` / `Biblioteca pública` / `Templates` | 🔧 exigem conteúdo compartilhado entre contas, que não existe. Aba única |
| 4 KPIs com ícone em caixa: total, utilizados em N contas, execuções 30d, atualizados 30d | 🔧 **três**, não quatro. `Execuções (30d)` somaria `PixelEvent` com `Click` — dois instrumentos num número só; `Atualizados (30d)` precisa de data por snippet, e os gerados sob demanda não têm |
| Busca + `Todas as categorias` + `Filtros` | ✅ busca e categorias. 🔧 `Filtros`: com 7 linhas não há terceiro eixo para filtrar |
| Tabela: NOME (com ID) · CATEGORIA · TIPO · USADO EM · ATUALIZADO (com autor) · **toggle ativo** · `⋮` | ✅ nome, categoria, tipo, usado em, estado. 🔧 sem ID (nossos snippets não têm id de usuário), sem ATUALIZADO, sem autor (conta única) |
| **O toggle só onde ele CONTROLA algo** | ✅ 🔧 nosso. Os 3 de pixel têm `enabled` + `togglePixel`; os 4 de UTM não têm coluna — 4 toggles inertes seriam o defeito que esta base remove há dez sessões. No lugar, selo MEDIDO (`instalado` / `não detectado`, por `cliquesComArea`) |
| Colunas ordenáveis com indicador | 🔧 7 linhas de ordem fixa e significativa (UTM → anúncio → pixel) |
| Painel de detalhe: cabeçalho com `Editar` / `Duplicar` / `Mais ações ⌄` | 🔧 snippet GERADO não se edita nem se duplica — quem muda o conteúdo é a configuração do pixel, em Integrações. Botão que edita artefato gerado produziria divergência com o instalado |
| Painel: `Visão geral` — tipo, categoria, criado, atualizado, usado em, status | ✅ 🔧 sem `criado`/`atualizado`, pelo mesmo motivo do KPI |
| Painel: **`Prévia do código` com destaque de sintaxe** + `⧉ Copiar` | ✅ tokenizer próprio (`CodigoDestacado`), JS/HTML/JSON. ⚠️ o **clique de copiar não foi exercido** |
| Painel: `Tags` com chips e `+` | 🔧 não há onde guardar tag |
| `Atividade recente` — com nome do autor (`por João Silva`) | 🔧 conta única e sem log de alteração de snippet |
| `Templates populares` com botão `Usar template` | 🔧 "popular" exige agregação entre contas |
| **O aviso da ÁREA no snippet que a embute** | ✅ 🔧 nosso. Só `Rastreamento de visitas` é `porArea`, e ele carrega o aviso do que acontece se for copiado com a área errada |

### O que foi MEDIDO na tela

| Elemento | Status |
|---|---|
| Tema claro | ✅ contraste do código sobre painel `rgb(246,249,252)`: comentário **4,70:1** · palavra-chave **5,58:1** · número **5,66:1** · cadeia **5,69:1** · texto **16,90:1**. Todos ≥ 4,5:1 |
| Tema escuro | ✅ visto e legível nos cinco papéis. ⚠️ os **números** não foram medidos: o renderer congelou duas vezes no `Runtime.evaluate`, e a regra das duas tentativas encerrou a medição |
| Fluxo completo do Builder | ✅ preencher → `Gerar URL` → histórico → `Salvar modelo` → modelos favoritos, exercidos na tela |
| Largura estreita | |

**Nota sobre o vão do Builder — a decisão foi INVERTIDA em 11/08/2026.** Não
existe arranjo com zero vão: a altura da fileira é a da coluna mais alta. O que
se escolhe é ONDE ele fica, e a regra do dono decide:

> **Vão DENTRO de um card promete conteúdo. Vão FORA não promete nada.**

Com `stretch`, os ~130px caíam entre a `Visualização` e o `Salvar como modelo`,
cercados de conteúdo dos dois lados — e liam como se a visualização devesse
continuar até ali. Com `start`, o mesmo vão vira ausência, que é honesta.

⚖️ **A exceção é o `Gerador`, e ela tem critério, não gosto:** o vão dele tem
CHÃO — a barra `Limpar campos` / `Gerar URL` fica embaixo —, então lê como rodapé
de formulário. Ele é o único com `alignSelf: stretch`. Medido: `539 / 304 / 539`,
e o vão interno do cartão do meio caiu de ~130px para **16px** (só o `gap`).

**Nota:** o inventário de snippets é o REAL — 4 famílias de código **gerado**
(rastreamento de UTM, back redirect, 3 formatos de parâmetro de URL, 1 por
pixel). Não existe modelo `Snippet` no `schema.prisma`. Inventar trechos avulsos
para bater com o print seria conteúdo que ninguém escreveu, sobre snippets que
não são instalados em lugar nenhum.

---

## PIXEL & EVENTOS

> ### ⛔ A PRIMEIRA TELA DO REDESIGN SEM REFERÊNCIA E SEM INVENTÁRIO PRÉVIO
>
> **Não há imagem.** A 03, a 05 e a 06 são todas a *Visão geral* de Integrações.
> Esta seção foi ESCRITA a partir do que a `PixelView` (1.181 linhas) já fazia,
> mais a lista de eventos aprovada em 11/08/2026 — não conferida contra print.
>
> Seção **nova**, e não um apêndice de INTEGRAÇÕES: decisão do dono. Misturar a
> contagem esconderia o que falta nesta tela, que é o defeito que a convenção da
> linha em branco existe para evitar. O `docs:estado` passa a contar **9 telas**.

> ### 🔴 ESTA TELA CONFIGURA O QUE É MEDIDO — as outras nove só mostram
> Um dono de evento errado **conta conversão em dobro**, e a pessoa otimiza
> campanha em cima disso por semanas. O critério de aceite aqui não é "parece
> com a referência" (não há), é: **cada controle diz o que MUDA quando ele
> muda** — não o rótulo do campo, o efeito.

> ### ✅ CONSTRUÍDA EM 11/08/2026 — e a convenção da linha em branco vale aqui
>
> **✅ = eu vi na tela.** **Linha em branco = construída e NÃO VISTA** (fica FORA
> da contagem do `docs:estado`, em vez de entrar como feita).
>
> A passada visual foi feita no tema ESCURO, com dado real do banco de dev. O
> tema claro foi **medido** (`body` `rgb(248,250,252)`, card e célula de tabela
> em branco puro) e **visto** em cartões e na gaveta de exclusão.
>
> ✅ **O SEED FOI CORRIGIDO NA MESMA SESSÃO** — ele criava
> `PixelConfig` **sem `MetaPixel` e sem `PixelEventRule`** (medido: 0 e 0), e por
> isso todo evento aparecia como *desligado* e o fan-out nunca passava de zero.
> Hoje o pixel A tem **2 pixels da Meta** (um com token, outro sem) e o `Lead` do
> pixel B fica **ligado e nunca recebido** — os quatro estados por evento numa
> tela só. `npm run dev:pixel`.
>
> ⚠️ **O que continua fora de alcance:** os 35 `PixelEvent` têm `espelho`,
> `detectores` e `ambiente` **NULOS**, então a coluna de espelho só sabe dizer
> *não informado*, e o diagnóstico não sai de `script-antigo`.

### Mestre — a lista de pixels

| Elemento | Status |
|---|---|
| Lista de pixels da área, com nome e `N` pixels da Meta | ✅ |
| Selo de estado por pixel (`enabled`) + toggle real | ✅ `togglePixel`, exercido |
| Selo do DIAGNÓSTICO por pixel (`ok` · `divergente` · `script-antigo` · `sem-dados`) | ✅ ⚠️ **2 dos 4 vistos** — `script-antigo` e `sem-dados`; os outros dois exigem `detectores` de um script instalado de verdade |
| `+ Novo pixel` · Editar · Excluir | ✅ os três exercidos, com criação e exclusão indo ao banco |
| Estado vazio honesto quando a área não tem pixel | ⚠️ construído, **não visto** — o dev sempre teve pixel |

### Gaveta · O PRESET — a proteção contra contagem dobrada

> ### ⛔ ISTO NÃO PODE SE PERDER NA REESCRITA, E É O ITEM DE MAIOR RISCO DA TELA
> As três perguntas de `lib/pixel/preset.ts` substituem **20 decisões** que
> exigem entender deduplicação da Meta. E elas não são açúcar: a resposta amarra
> **o dono de cada evento** (lido AO VIVO pelo servidor) **e o espelho no `fbq`**
> (ASSADO no snippet). Separados, divergem — e a divergência conta conversão em
> dobro num sentido e produz alarme falso no outro.
>
> ✅ **EXERCIDO NA TELA, não só no teste** (11/08/2026): responder *"Não, só a
> Trackhub vai enviar"* virou `var NATIVO` de `true` para `false` **e**
> `var ALHEIOS` de `["PageView"]` para `[]` — os dois lados, no artefato, no
> mesmo clique. Voltar para *"Sim"* devolveu os dois.

| Elemento | Status |
|---|---|
| Pergunta 1 — *o código do Facebook está na sua página?* (`temPixelNativo`) | ✅ |
| Pergunta 2 — *alguém mais já avisa o Facebook da venda?* (`outroEnviaPurchase`) | ✅ com o aviso citando **o gateway conectado** pelo nome |
| Pergunta 3 — *onde o comprador paga?* (`ondeSePaga`) | ✅ aparece indentada sob o checkbox que a torna útil |
| **Cada pergunta declara O EFEITO, não o rótulo** — quem dispara, e o que acontece se os dois dispararem | ✅ |
| A pergunta 3 NÃO é gravada no `setup` — é derivada da regra de IC | ✅ `presetDoForm` |
| `contem_url` EXIGE o trecho, e a gaveta recusa vazio | ✅ campo em erro + botão desabilitado + o motivo escrito no rodapé |
| Analisador do trecho de URL, com exemplos | ✅ 🐛 **e ele mostrava o MESMO aviso duas vezes** com o campo vazio — corrigido na passada |

### Gaveta · AVANÇADO — quem envia cada evento

| Elemento | Status |
|---|---|
| Mapa de donos por evento (5 eventos × `traffik`/`navegador`/`gateway`/`ninguem`) | ✅ |
| Selo `definido pelas suas respostas` × `ajustado à mão` | ✅ vira âmbar no primeiro ajuste |
| `↩ voltar ao padrão` quando foi ajustado à mão | ✅ aparece junto do selo ⚠️ **não clicado** |
| **O aviso do que o ajuste manual CUSTA**, por combinação | ✅ 🔴 **visto disparando**: `temPixelNativo` + `PageView` na Trackhub pinta o aviso vermelho de contagem dobrada |

### Gaveta · Envio das vendas e checkout próprio

| Elemento | Status |
|---|---|
| `sendMode` · `valueMode` · `fixedValue` · `targetProduct` do Purchase | ✅ ⚠️ `VALOR_FIXO` não exercido |
| Passos do checkout próprio, para o desenvolvedor | ✅ e agora **com teste** — `test:checkout-proprio`, 18 asserções |
| N pixels da Meta por pixel nosso (fan-out), com apelido e token | ✅ **visto com dois**, e os DOIS estados do campo de token lado a lado: `Já cadastrado — deixe em branco` e `Sem ele, só o navegador envia` |

### Script para instalar

| Elemento | Status |
|---|---|
| Prévia do código com destaque de sintaxe + copiar | ⚠️ a prévia foi vista; o botão `copiar` nasceu **depois** da passada e **não foi visto** |
| Geração por `scriptDoPixel()` — **fonte única** | ✅ e o `test:pixel-tela` prova que trocar de pixel troca o CONTEÚDO |
| Onde colar | ✅ *"antes de `</head>`; recole depois de salvar"* |

### Diagnóstico — o script instalado bate com a configuração?

| Elemento | Status |
|---|---|
| Os 4 estados, e `sem-dados` **nunca** pintado como `ok` | ✅ com asserção estática sobre o tom |
| Estado POR EVENTO, não agregado | ✅ os **quatro** estados vistos juntos: ligado **e recebendo** (`14 · 6 dias atrás`), ligado e **nunca recebido**, `desligado` com `—`, e o `PageView` que não passa por regra |
| Carimbo de tempo via `<Desde>` | ✅ **os dois `elapsed()` crus morreram com a `PixelView`** |

### Lista de EVENTOS — o que a navegação promete e a tela não entregava

| Elemento | Status |
|---|---|
| Lista de `PixelEvent` do pixel selecionado | ✅ 16 linhas reais no dev |
| Colunas: evento · quando · origem · espelho · `eventId` | 🔧 **`origem` saiu, `Página` entrou** — ver a medição abaixo |
| **Nasce PAGINADA e com janela de tempo** | ✅ e a janela é validada **no servidor**, contra lista fechada |
| Filtro por tipo de evento | ✅ desenhado e ligado ⚠️ **não exercido** (o dev só tem `InitiateCheckout`) |
| Estado do espelho por linha (`ok` · `alheio` · `sem-fbq` · `erro`) | ✅ ⚠️ **só `não informado` no dev** — a coluna é NULA nas 35 linhas |
| Estado vazio distinguindo *sem evento* de *sem pixel instalado* | ✅ os **três** motivos, com textos diferentes e asserção sobre isso |

> ### 🔧 POR QUE A COLUNA `origem` VIROU `Página` — medido, não decidido no gosto
>
> O evento criado pelo webhook do gateway (`webhook/checkoutEvent.ts:151`)
> **não grava `pixelConfigId`**. Conferido nos dois lados: no código (o `create`
> não tem o campo) e no banco de dev (**0 linhas** com prefixo `gw:` E
> configuração). Uma lista POR PIXEL é, portanto, do navegador **por
> construção**.
>
> Uma coluna com um único valor possível não informa — ela ocupa a largura
> afirmando que há uma distinção. `Página` põe ali o dado que existe e responde
> *onde* o evento disparou; ele já vinha no DTO e só existia no `title`,
> invisível para quem não passa o mouse.
>
> ⚠️ O campo `origem` **continua no DTO**, derivado do prefixo `gw:`. Se um dia o
> webhook passar a carimbar o pixel, a coluna volta sem precisar de conta nova —
> e a tela já desenha o selo `gateway` quando ele aparece.

> ### ⚠️ A DÍVIDA Nº 4 FICA VISÍVEL, E ISSO FOI ACEITO — mas ela não pode AGRAVAR
> `PixelEvent` tem o mesmo desenho do `WebhookLog`: **sem retenção e sem purga**.
> Mostrá-la numa tela não cria o problema, mas uma listagem sem paginação e sem
> janela **transformaria** a dívida em consulta que piora com o tempo.
>
> Decisão do dono: **a lista nasce paginada e com janela**. Não é purga — é não
> agravar. **A retenção continua devendo**, e continua na lista de dívidas.
>
> ⚠️ **E não existe índice por `pixelConfigId`** (conferido no `schema.prisma`).
> A consulta entra pelo `[userId, event, timestamp]` e filtra o pixel dentro do
> recorte. Criar o índice é migration, e migration não entra em commit de tela.

### 🔎 ACHADO DA PREPARAÇÃO — medido, NÃO consertado

Percorrendo `preset.ts` × `script.ts` para desenhar a gaveta:

O script assa **duas** coisas que vêm de fontes diferentes — `ALHEIOS` (dos
`eventOwners`) e `NATIVO` (do `setup.temPixelNativo`). O preset produz as duas
juntas, coerentes por construção. **A seção avançada muda só a primeira.**

Combinação alcançável: `temPixelNativo: true` com `PageView` reatribuído à
Trackhub à mão. O código-base da Meta dispara `fbq('track','PageView')` **sem
`event_id`**, a nossa CAPI dispara com — e não há como casar os dois.

⛔ **NÃO consertado**: é comportamento anterior a `4e6aa9e`, e `seguePreset()` já
marca o estado como *ajustado à mão*. O que a tela nova faz é **dizer o custo
junto do controle**, que é design e não lógica.

---
## WEBHOOKS

> ### ⛔ SEM IMAGEM DE REFERÊNCIA — a segunda tela do redesign nessa situação
>
> A 03, a 05 e a 06 são todas a *Visão geral* de Integrações. Esta seção foi
> ESCRITA a partir do que a `WebhooksView` (532 linhas) já fazia, mais o
> histórico de entregas — não conferida contra print.
>
> Seção **nova**, e não um apêndice de INTEGRAÇÕES: misturar a contagem
> esconderia o que falta nesta tela. O `docs:estado` passa a contar **10 telas**.

> ### 🔴 O ARTEFATO DAQUI É COLADO POR UMA TERCEIRA PARTE QUE NÃO VEMOS
>
> É a forma mais cara do **artefato válido de contexto errado** em toda a
> ferramenta. A URL do webhook vai para o painel do gateway do cliente, e uma
> URL da área errada **não dá erro em lugar nenhum**: aceita o payload, responde
> 200 e credita a venda na operação errada.
>
> ⚠️ E o sintoma não se parece com defeito. Ele aparece como **venda faltando
> numa área e venda a mais em outra** — dois números plausíveis, em telas
> diferentes, sem log, sem alerta, sem 4xx e sem nada que os ligue.

> ### ✅ CONSTRUÍDA EM 11/08/2026 — e a convenção da linha em branco vale aqui
>
> **✅ = eu vi na tela.** **Linha em branco = construída e NÃO VISTA** (fica FORA
> da contagem do `docs:estado`, em vez de entrar como feita).

### Mestre — a lista de webhooks da área

| Elemento | Status |
|---|---|
| Lista dos webhooks da ÁREA ATIVA, com logo, nome e gateway | ✅ |
| **Selo de estado**, e são CINCO (`recusando` · `desligado` · `esperando` · `mudo` · `recebendo`) | ✅ ⚠️ **3 dos 5 vistos** na mesma tela — `recebendo`, `recusando` e `mudo`. `esperando` foi visto antes do `dev:webhook`; `desligado` não |
| **`recusando` — o estado que a tela antiga não tinha** | ✅ 🔴 ver abaixo |
| Total de vendas recebidas AO LADO do selo, não no lugar dele | ✅ **e é o caso que prova a decisão**: o webhook `recusando` mostra `14 vendas recebidas` — passado e futuro verdadeiros ao mesmo tempo |
| Interruptor real (`toggleWebhook`), pelo primitivo `tk/Controles` | ✅ desenhado nos três; ⚠️ **não clicado** |
| `Conectar gateway` · Editar · Excluir | ✅ `Conectar gateway` abre a gaveta; ⚠️ Editar e Excluir **não exercidos** |
| Estado vazio dizendo o que se perde sem webhook (faturamento, ROAS e funil vazios com a campanha rodando) | |

> ### 🔴 `recusando` — 🐛 O DEFEITO QUE A TELA ANTIGA ESCONDIA
>
> `autenticar()` (`gateways/autenticar.ts:75`) devolve **401** quando o gateway
> exige chave e não há nenhuma cadastrada — e a mensagem dele manda o usuário
> *"editar o webhook na aba Integrações › Webhooks"*, que é **esta tela**. A
> `WebhooksView` mostrava esse mesmo webhook com o selo verde de **"Ativado"**.
>
> **Medido no banco de dev em 11/08/2026:** os **dois** webhooks estão nesse
> estado (`secret` NULO, Kirvano `exigir: true`), e há **25 `WebhookLog`
> REJEITADO** de gateway KIRVANO provando que é isso mesmo.
>
> ⚠️ O usuário não tem como descobrir sozinho: quem vê o 401 é o painel do
> gateway, que é de outra empresa. Do lado de cá o sintoma é *nenhuma venda
> chegando*, indistinguível de *ninguém comprou*.
>
> ✅ **Não é conta nova.** `hasSecret` já vinha no DTO e `auth.exigir` já está no
> registro — a tela deixou de esconder o que o servidor já decide. É
> apresentação, e por isso não fere o congelamento.

### Detalhe — o endereço

| Elemento | Status |
|---|---|
| **O que acontece com a PRÓXIMA venda**, em caixa tingida só quando exige ação | ✅ vermelha no `recusando`, âmbar no `mudo`, texto solto no `recebendo`. Contraste **medido**: 4,96:1 no claro |
| Endereço copiável, em fonte monoespaçada (`Input mono`) | ✅ ⚠️ o botão `Copiar` **não foi clicado** |
| A chave aparece **só quando é NOSSA** (`geradoPorNos`) | ✅ **os dois lados**: a Cakto mostra a chave, a Kirvano não |
| Grade de metadados: Gateway · Chave · Última venda · Criado em | ✅ |
| `Chave de segurança: Faltando` quando o gateway exige e não há | ✅ |
| Ícone real do gateway na linha e no detalhe | 🔧 há `LogoGateway`, que é monograma — logotipo de terceiro é decisão de produto |

### Detalhe — as entregas recebidas

| Elemento | Status |
|---|---|
| Histórico do `WebhookLog` DAQUELE webhook, com os QUATRO desfechos | |
| O **motivo** da recusa na linha, em linguagem de usuário | |
| Código HTTP e tempo relativo (`Desde`) | |
| Payload cru recolhido, com destaque de sintaxe | |
| Dois estados vazios distintos: `nunca-recebeu` × `purgado` | ✅ **os dois vistos** — `nunca-recebeu` antes do `dev:webhook`, `purgado` depois. 🔴 ver abaixo |
| Paginação | 🔧 **fora.** `listWebhookLogs` já é limitada a 100 no servidor, e a retenção é do cron. Uma tela sem janela AGRAVARIA a dívida nº 4; uma paginada sobre 25 linhas não resolve nada que exista |

> ### 🔴 "NENHUMA ENTREGA" ≠ "AS ENTREGAS FORAM APAGADAS"
>
> A distinção central deste projeto, na camada de LOG. A purga diária
> (`api/cron/manutencao`, agendada `0 4 * * *`) apaga log de sucesso em **30
> dias** e de falha em **90**. Um webhook que recebeu 43 vendas há seis meses
> mostra a lista vazia — e dizer *"nenhuma entrega ainda"* ali faria a tela
> afirmar que ele nunca funcionou, **sobre o webhook que mais funcionou**.
>
> Quem separa os dois é `eventCount`, que a purga não zera.
>
> ✅ **Os prazos são LIDOS, não afirmados**: `lib/webhooks/retencao.ts` é um MOVE
> das duas constantes para fora da rota do cron, e agora os dois lados leem o
> mesmo número. Copiá-lo faria a purga apagar em 30 dias com a tela prometendo 90.

### Chaves de API — a outra porta de entrada

| Elemento | Status |
|---|---|
| Lista de chaves com estado (ativa / revogada) e último uso | |
| Gerar · Revelar · Copiar · Revogar · Excluir | |
| A chave nova é **revelada de imediato** — ela só existe naquela resposta | |
| **A tela DIZ que as chaves valem para a conta inteira, não para a área** | ✅ 🔴 ver abaixo |
| Endereço de ingestão + exemplo de envio, **recolhidos** e em linguagem de usuário | |
| Modal separado para criar credencial | 🔧 **fora.** O único campo era o nome, e um diálogo de um campo para gerar uma chave que aparece na lista logo abaixo é uma etapa sem pergunta |

> ### 🔴 AS DUAS METADES DESTA TELA TÊM ESCOPOS DIFERENTES
>
> **Medido em 11/08/2026, NÃO corrigido.** `Webhook.workspaceId` existe e
> `listWebhooks` recorta por área (com a Principal catch-all).
> `listApiCredentials()` **não recebe área** e `createApiCredential()` **não
> grava nenhuma** — então `ApiCredential.workspaceId` tem leitores
> (`areas/atribuicao.ts`, `areas/exclusao.ts`) e **nenhum escritor** que o
> preencha com uma área de verdade.
>
> É a mesma forma do `Sale.apiCredentialId` (6 leitores, 0 escritores), uma
> camada acima: o passo 4 da precedência de área nunca distingue nada, porque
> toda credencial é órfã.
>
> ⛔ Os dois arquivos são de **`9f9dfa9`, 24/07/2026** — anteriores ao corte
> `4e6aa9e`. **Congelados.** O que a tela faz é DECLARAR o escopo de cada
> metade: postas lado a lado sem a frase, elas sugerem que se recortam do mesmo
> jeito, e só uma se recorta.

### A gaveta — conectar um gateway

| Elemento | Status |
|---|---|
| Grade de gateways do REGISTRO, com "em breve" nos inativos | ✅ Cakto · Kirvano · OnyxPag ativos; Hotmart e Kiwify em `em breve`, desabilitados |
| **Os TRÊS fluxos de chave**, cada um com a instrução certa | ✅ ⚠️ **2 dos 3 vistos** — o gerado (Cakto) e o que pede a chave (Kirvano). O sem-chave (OnyxPag) não foi aberto |
| A chave que NÓS geramos aparece para ser copiada | ✅ **e a não-regeração foi MEDIDA na tela**: reclicar no gateway já escolhido, e ir e voltar, devolvem o mesmo UUID. 🔴 ver abaixo |
| Passos de instalação vindos do `registro.instalacao` | ✅ com os dois passos de `atencao` em âmbar |
| Em branco na edição **MANTÉM** a chave — e o campo diz isso | ⚠️ construído, **não visto** — a gaveta de edição não foi aberta |
| Trocar a PLATAFORMA de um webhook existente não é oferecido | |
| ⛔ Nenhum nome de gateway cravado no código — guarda estática no teste | ✅ **a guarda PEGOU um**: `placeholder="Ex.: Kirvano"`, agora vindo do registro |

> ### 🔑 A GERAÇÃO DA CHAVE QUASE SE PERDEU NA REESCRITA
>
> Ela vivia em `segredoInicial`, no `useTraffikState`, e morreria junto da view
> antiga. Sem ela, um webhook da **Cakto** nasceria com `secret` NULO — e como a
> Cakto é `exigir: true`, **toda venda voltaria 401**, com o sintoma "nenhuma
> venda chegando" do lado de cá.
>
> ⚠️ Achado ao apagar o que o lint marcou como órfão: `segredoInicial` **não era
> código morto, era comportamento**. É a regra *"ao remover uma tela, procure as
> constantes dela e pergunte se alguma descreve comportamento"* pagando a conta.
>
> ⛔ **Uma por gateway, nunca regerada por clique.** O bug original está
> documentado: clicar de novo no gateway já selecionado gerava outra chave, e
> quem tivesse copiado a primeira levava para o painel do gateway uma chave que
> a ferramenta não guardaria.

### O que NÃO foi construído, e por quê

| Elemento | Status |
|---|---|
| Reenviar um payload recusado | 🔧 **fora.** `reentregaEventos` é capacidade do GATEWAY (a Kirvano reentrega sozinha). Um botão nosso teria de reprocessar o payload guardado, o que muda ingestão — comportamento congelado |
| Filtro por desfecho na lista de entregas | 🔧 **fora.** Com 25 linhas por webhook o filtro custa mais atenção do que economiza |
| Testador de payload (a `TestadorPayloadCard` da aba Testes) | 🔧 **fora.** Ela foi DELETADA com a aba Testes; ressuscitá-la aqui é decisão de produto, não de layout |

---
## CRIATIVOS

Referência: imagem 9.

**✅ FEITA em 12/08/2026.** `CreativesView` (81 linhas) e `ImageSlot` **deletados**.
Nascem `views/criativos/CriativosScreen.tsx`, `lib/ads/criativos.ts` (puro),
`tk/PreviaCriativo`, `tk/CardCriativo`, `tk/TabelaCriativos`. `test:criativos`
(20 asserções) entrou no `npm test` no MESMO commit.

> ### 🔎 CONVENÇÃO DESTA SEÇÃO — a mesma do Gerenciador
> **✅ = eu vi na tela.** **Linha em branco = construída e NÃO VISTA**, e em
> branco ela fica FORA da contagem do `docs:estado` em vez de entrar como feita.

| Elemento | Status |
|---|---|
| 6 KPIs com ícone em caixa colorida: total, CTR médio, CPC médio, taxa de conversão, ROAS médio, ativos | ✅ **feito** — 🔧 os seis com o MESMO tom (`primary`), não uma cor cada: §13 do `06` diz que quadrado tingido é decoração e **não classifica**; tingir cada um o faria parecer selo de estado. E "ativos" virou **`Entregando`**, que lê `effectiveStatus` — "ativo" é o configurado, e o configurado mente sobre entrega |
| `⤒ Importar` · `📁 Pastas` · `+ Novo criativo ⌄` | 🔧 **FORA — nenhum dos três tem backend.** Criativo nasce na Meta e chega pelo sync; não há criação nem importação por aqui. `Pastas`: **zero acertos** no `schema.prisma`. Botão que abre nada é affordance mentindo |
| Busca por nome ou ID com `⌘K` | ✅ **feito** — campo na faixa de filtros, casando nome do criativo **e** nome da campanha. 🔧 sem `⌘K` próprio: o `⌘K` é a paleta global do shell, e ela já lista criativos. Dois donos para o mesmo atalho é o defeito, não o recurso |
| Filtros: Plataforma (com ícone) · Campanha · Formato · Tipo de mídia · Status · `Filtros` | ✅ **feito** — Período · Ordenar por · Formato · Busca, na faixa registrada (o botão `Filtros` do header aparece porque a tela REGISTRA a faixa). 🔧 **Plataforma fora**: é um dos CINCO 🔧 de plataforma, com gatilho comum. 🔧 `Campanha` e `Status` fora: a busca já casa campanha, e as abas já recortam por estado — filtro que duplica aba é dois controles para a mesma pergunta |
| **Alternador grade / tabela** | ✅ **feito** — `Segmented`, porque são duas lentes FIXAS sobre o mesmo dado (§14.1). As duas visões consomem a MESMA lista já filtrada e ordenada |
| Abas com contador: `Todos` · `Análise` · `Testes A/B` · `Top performers` · `Em queda` · `Inativos` | ✅ **4 das 6 feitas** — 🔧 **`Testes A/B`, `Pastas` e `Análise` FORA**, decisão do dono de 12/08. As duas primeiras **não existem no schema** (medido); `Análise` não tem conteúdo especificado em documento nenhum. Aba com contador que abre vazia é controle inerte com outra roupa. ⚠️ As contagens somam mais que o total **de propósito**: são perguntas, não partição |
| Carrossel horizontal de miniaturas com seta `›` | 🔧 **virou GRADE que quebra linha**, não faixa que rola. O carrossel esconde item atrás de gesto e a tela tem alternador de visão — quem quer densidade clica em `Tabela`. Rolagem horizontal escondendo criativo em queda é o oposto do que a tela existe para fazer |
| Card: thumbnail, botão play, badge de plataforma, ponto de status | ✅ **feito** — play sobre vídeo, ponto de status no selo. 🔧 badge de plataforma fora (os cinco de plataforma). ⚠️ **thumbnail: ver o bloco abaixo** |
| Card: nome + badge de estado + `ROAS / CTR / CPA` no rodapé | ✅ **feito** — e mais a **pílula de tendência** (`↓ 23% CTR`), que a referência não tem e a aba `Em queda` exigia para se explicar |
| Tabela `Desempenho dos criativos` com miniatura na primeira coluna | ✅ **feito** — miniatura + nome + campanha na MESMA célula (§14.4), 9 colunas, `.tk-linha` sem borda entre linhas, números tabulares à direita, `ⓘ` por coluna declarando a PROCEDÊNCIA |
| Coluna CAMPANHA com prefixo de objetivo (`[CONV]`, `[TRÁFEGO]`) e status | 🔧 **sem coluna própria** — a campanha é sub-rótulo do criativo (§14.4), que é o mesmo raciocínio de economizar coluna. 🔧 prefixo de objetivo fora: ele qualifica a CAMPANHA, e esta tela é por criativo — repeti-lo em toda linha da mesma campanha é ruído |
| `Ordenar por: ROAS (maior) ⌄` + `⤓ Exportar` | ✅ **`Ordenar por` feito** (no servidor, para as duas visões). 🔧 **`Exportar` fora**: não existe em nenhuma outra tela desta base, e um exportador que só esta tela tem é inconsistência. Entra quando for decidido para todas |
| `Mostrar 20 ⌄` + `1-20 de 1.248` + paginação | ✅ **feito** — 🔧 **25 e não 20**: a divergência é do PRIMITIVO `Paginacao` (10/25/50/100), a mesma escada do Gerenciador e do Pixel. Um `20` só aqui faria a mesma lista paginar diferente de tela para tela |
| Tema claro | ✅ **medido** — card branco puro; nome **17,85:1**, apoio e cabeçalho **4,97:1**, ROAS em destaque **5,17:1**. Todos passam AA |
| Tema escuro | ✅ **visto** — grade e tabela legíveis. ⚠️ **números não medidos** |
| Largura estreita | |

> ### 🔴 A MINIATURA DA META EXPIRA EM ~4 DIAS E É 64×64 — medido, e muda a tela
>
> Medido em 12/08/2026 no backup de produção de 01/08, nos **13 de 13**
> criativos reais:
>
> | | |
> |---|---|
> | resolução do `thumbnailUrl` | **`_p64x64` em 13 de 13** — ícone, não miniatura de card |
> | expiração (`oe=`) | de **34h** a **4,5 dias** após o sync |
> | `imageUrl` (a imagem grande) | existe em **1 de 13** — os outros 12 são vídeo |
>
> Em 12/08 as treze estavam vencidas havia uma semana. **O estado normal desta
> tela em produção é a imagem não carregar** — não é caso de borda.
>
> ✅ **Decisão do dono, 12/08: fallback tipográfico + aviso.** A falha desenha o
> bloco com as iniciais e um selo `pré-visualização indisponível`; a ausência de
> URL desenha o bloco **sem** selo, porque não houve tentativa que falhasse.
> ⛔ **Nunca um retângulo cinza** — ele afirmaria "carregando", e nada está.
>
> 🔜 Resolver de verdade exige copiar a imagem para armazenamento nosso no
> sync — **backend novo**, fora do escopo do redesign.

---

## LOGIN

Referências: imagens 10 e 11 (claro e escuro).

> ### 🔎 CONVENÇÃO DESTA SEÇÃO — a mesma de CAMPANHAS
> **✅ = eu vi na tela.** Linha em branco = construída e NÃO VISTA. Nesta seção
> **não há linha em branco**: os dezenove itens foram percorridos no navegador em
> 12/08/2026, nos dois temas, e os contrastes foram MEDIDOS (não presumidos).

| Elemento | Status |
|---|---|
| Split-screen, marca à esquerda, formulário à direita | ✅ |
| Logo grande no topo esquerdo | ✅ |
| Badge `PLATAFORMA DE TRACKING E GESTÃO` | ✅ |
| Headline com **segunda linha em cor de destaque** | ✅ |
| Parágrafo de apoio em duas linhas | ✅ |
| Três provas com ícone: título + subtítulo | ✅ |
| **Preview da ferramenta** — mockup do dashboard com KPIs e gráfico | ✅ |
| Arco decorativo de fundo | ✅ |
| Rodapé esquerdo: `🔒 Dados criptografados e protegidos…` | ✅ |
| Cartão do formulário: `Bem-vindo de volta` + subtítulo | ✅ |
| Campos com ícone dentro (envelope, cadeado) | ✅ |
| Olho para revelar senha | ✅ |
| `Lembrar de mim` + `Esqueci minha senha` | 🔧 |
| Botão `Entrar →` em gradiente | 🔧 |
| Divisor `ou continue com` | 🔧 |
| Social: `Google` · `Meta` · `Apple` | 🔧 |
| `Ainda não tem uma conta? Criar conta` | ✅ |
| Rodapé com copyright | 🔧 |
| Espelhar tudo em `/signup` | ✅ |

### Os cinco 🔧, com o motivo de cada um

| Item | Por que diverge |
|---|---|
| **Social: Google · Meta · Apple** | ⛔ **NÃO EXISTE BACKEND.** `src/auth.ts` tem UM provider: `Credentials`. Não há Google, Facebook Login nem Apple, nem no NextAuth nem no `package.json`. (O `/api/auth/facebook` é OAuth da **Marketing API**, para conectar conta de anúncio depois de entrar — não autentica ninguém.) Três botões que não fazem nada na tela de ENTRADA é o pior caso do controle inerte: quem clica em "Google" e não vê nada conclui que o produto está quebrado antes de conhecer o produto. **Decisão do dono, 12/08/2026** |
| **Divisor `ou continue com`** | sai junto — ele existe só para separar o que não existe |
| **`Lembrar de mim` + `Esqueci minha senha`** | **desenhados e INERTES, por decisão do dono em 12/08/2026**, com o custo declarado na hora. Medido: `auth.ts` usa `session: { strategy: "jwt" }` **sem `maxAge`** (o padrão vale para todo mundo, marcado ou não), e não há rota, tabela de token nem envio de e-mail para redefinição. Ligar o primeiro exigiria mexer no `auth.ts`, **congelado** (anterior a `4e6aa9e`). ⚠️ O "Esqueci minha senha" **não é link morto**: é `<button>` que revela *"A redefinição de senha por e-mail ainda não está disponível."* — inerte continua inerte, mas o fracasso fica legível para quem está trancado do lado de fora |
| **Botão `Entrar →` em gradiente** | o gradiente é **ANEL de 1,5px**, não preenchimento. Medido no cabeçalho de `tk/Button`: nenhuma cor de rótulo atravessa o gradiente inteiro — o rótulo claro cai a **1,73:1** no ciano e o escuro a 3,76:1 no azul. **É o mockup que não passa em AA**, não o componente. Medido nesta tela: rótulo do CTA a **5,17:1** (claro) e **4,94:1** (escuro) |
| **Rodapé com copyright** | **sem ano.** A referência diz `© 2024`. Um ano fixo vira mentira em 1º de janeiro; `new Date().getFullYear()` no servidor é a armadilha do `elapsed()` — na virada do ano o HTML sai com um ano, o cliente hidrata com outro e o React aborta a hidratação da árvore, que aqui é o formulário de login |

### O que foi MEDIDO na tela (não presumido)

| | Claro | Escuro |
|---|---|---|
| headline | **16,90:1** | **18,60:1** |
| parágrafo de apoio | 6,14 | 7,59 |
| badge (tingido, composto sobre o fundo real) | 4,72 | 6,05 |
| apoio das provas · rodapé de segurança | 4,70 | 6,00 |
| título do cartão | 17,85 | 16,11 |
| subtítulo do cartão | 4,97 | 5,20 |
| rótulo do CTA | 5,17 | 4,94 |
| `Esqueci minha senha` | — | 4,58 |
| cartão × fundo (separado por borda + sombra) | 1,06 | 1,15 |

### 🔴 A PONTE `.tk-tema` — a única tela FORA do shell, e a medição que prova

Esta é a única tela do produto sem `AppShell`, e é o `AppShell` que aplica
`.tk-tema` nas outras vinte e uma rotas. Medido no navegador em 12/08/2026:

```
--color-accent no <body>        rgb(109, 95, 224)   ← ROXO do sistema legado
--color-accent na raiz .tk-auth rgb( 37, 99, 235)   ← = --tk-primary
font-family no <body>           Inter
font-family na raiz .tk-auth    Instrument Sans
```

Sem a classe na raiz, três regras GLOBAIS do `globals.css` continuariam roxas,
porque as três leem `--color-accent`: `a { color }`, `:focus-visible { outline }`
e `::selection`. Numa tela de FORMULÁRIO o alcance é máximo — o anel de foco é o
principal sinal de navegação por teclado, e está em todo campo.

✅ **Verificado pelo efeito, não só pelo token:** com o olho da senha focado,
`outlineColor` = `rgb(37,99,235)`, 2px. O link `Criar conta` idem.

⚠️ É o mesmo defeito medido em 11/08 no `RuleDrawer` legado, que portava para o
`<body>` e saía com anel roxo. `test:login` reprova se a classe sumir da raiz.

### ✅ LARGURA ESTREITA — verificada, e é a PRIMEIRA das dez

O `resize_window` mentiu quatro vezes nesta base e a dívida se acumulou em seis
telas. Aqui ela foi paga **sem redimensionar a janela**, exercitando o CÓDIGO em
vez do tamanho — a mesma saída registrada para o clamp do popover:

| O que | Como | Resultado |
|---|---|---|
| o painel de marca some | limiar do `@media` elevado a 3000px temporariamente | `display: none`, uma coluna, **0 de 171** descendentes vazando, sem rolagem horizontal |
| nada estoura no telefone | `.tk-auth` apertada por JS a 360 · 390 · 430 · 768px | **0 vazando** nas quatro |
| 🐛 defeito achado e corrigido | cartão a 340px | `Lembrar de mim` quebrava em duas linhas e encostava no `Esqueci minha senha`. Com `flexWrap`, os dois empilham — reconferido: **empilhou, não colidem, 0 de 42 vazando** |

⚠️ O limiar foi **restaurado a 1024px** e o `grep` confere que não sobrou
vestígio.

### 🐛 O defeito que só a tela mostrou, e que `getComputedStyle` NÃO acha

**O autopreenchimento do Chrome pinta o campo de branco.** No tema escuro, quem
tem a senha salva via dois retângulos BRANCOS dentro do cartão escuro. O
navegador pinta `-internal-light-dark(...)` por cima do `bg-transparent` do
input, e `getComputedStyle` continua devolvendo `transparent` — **medir o estilo
declarado não acha isto.** Foi o screenshot que denunciou.

⚠️ E é o caso COMUM, não o de borda: a tela de entrada é justamente onde o
gerenciador de senhas age. Uma tela que só fica certa para quem nunca salvou a
senha está errada para quase todo mundo que volta.

Corrigido com `-webkit-box-shadow` interno + `-webkit-text-fill-color`,
**escopado em `.tk-auth`** — o mesmo defeito existe em todo formulário da base, e
consertar globalmente mudaria 21 rotas num commit de tela. Ver ACHADOS ADIADOS.

---

## TAXAS E DESPESAS

⛔ **NÃO HÁ IMAGEM DE REFERÊNCIA** para esta tela. O critério é o mesmo de
Pixel/Eventos e Webhooks: **`06` para acabamento, o que a tela já faz para
conteúdo.** Nenhum item aqui foi copiado de mockup — todos saem ou de uma regra
do `06`, ou de um comportamento que o produto já tinha e a tela antiga escondia.

> ### 🔎 CONVENÇÃO — a mesma de CAMPANHAS e LOGIN
> **✅ = eu vi na tela.** Linha em branco = construída e NÃO VISTA. Nesta seção
> não há linha em branco: os itens foram percorridos no navegador em 12/08/2026,
> nos dois temas, com o `dev:taxas` semeado, e os contrastes foram **MEDIDOS**.

| Elemento | Status |
|---|---|
| Duas seções nomeadas: `Configuração da conta` e `Taxas e despesas` | ✅ |
| Cartão de imposto sobre anúncios, com toggle e alíquota | ✅ |
| Cartão de fuso horário, com a hora atual como conferência | ✅ |
| Aviso de divergência entre fuso da conta e do aparelho | 🔧 |
| Cinco grupos de despesa, cada um com título e apoio | ✅ |
| **Frase de incidência por linha** — sobre O QUE a taxa incide | ✅ |
| Estado vazio que diz a CONSEQUÊNCIA, não a ausência | ✅ |
| **Seletor de frequência** — quatro opções, padrão `Por mês` | ✅ |
| **Seletor `Como incide`** — R$ × %, em 3 dos 5 grupos | ✅ |
| **Seletor de forma de pagamento** — no gateway, padrão `Todas as formas` | ✅ |
| **Aviso de consequência da despesa única** — o quê e o porquê | 🔧 |
| Marcador `fora do cálculo` na linha, em tom de atenção | ✅ |
| Ícone em recipiente quadrado neutro de 36px (`06` §13) | ✅ |
| Cartão com raio 16, sombra e borda (`06` §1) | ✅ |
| Hover de linha por `.tk-linha` (`06` §8) | ✅ |
| Remover despesa por botão de ícone com `aria-label` | ✅ |
| Largura máxima de leitura no formulário | ✅ |
| Tema claro e tema escuro | ✅ |
| Largura estreita | ✅ |

### Os dois 🔧, com o motivo

| Item | Por que diverge |
|---|---|
| **Aviso de fuso divergente** | ✅ existe e o comportamento foi **preservado inteiro** (inclusive a dispensa em `localStorage` **por fuso de aparelho** — quem dispensou em Lisboa e abre em São Paulo vê de novo). ⛔ **Não foi VISTO disparando**: exigiria trocar o fuso do sistema operacional da máquina. Está 🔧 e não ✅ porque a convenção desta seção é literal |
| **Aviso da despesa única** | 🔜 **REVISÍVEL, com gatilho escrito: ele SAI no dia da migration do `ocorreEm`.** Enquanto a despesa única não tiver data de ocorrência, ela não entra em cálculo nenhum, e a frase é verdade. Quando a coluna existir, a frase vira mentira e a linha `UNICA` volta ao seletor. ⚠️ É o único item desta tela com prazo — os outros são decisões, este é uma limitação declarada |

### 🔴 A DESCOBERTA QUE INVERTEU O PEDIDO — o seletor não existia

O pedido original era *"avise no momento em que `Única` for escolhida, e avise
também se a pessoa não tocar no campo, porque o padrão do banco é `UNICA`"`.

**Medido antes de codificar, e a premissa não se sustenta:**

```
createExpense()             recurrence: input.recurrence ?? "MENSAL"
useTraffikState.addDespesa  recurrence: "MENSAL"          ← fixo no código
```

O `@default(UNICA)` do schema é **inalcançável pelo app** — todo caminho de
criação passa frequência explícita. E a razão é que **não existia seletor de
frequência**: `addDespesa(nome, valor)` recebia dois argumentos.

> ## O rateio respeita `DIARIA · SEMANAL · MENSAL · ANUAL` desde 06/08. A capacidade existe inteira no servidor, testada — e a tela nunca deixou escolher.

É o **avesso do controle inerte**: capacidade sem controle. Ninguém usando a tela
de Taxas conseguia cadastrar uma despesa anual, e a única frequência possível era
mensal.

**Decisão do dono, 12/08/2026:** o seletor entra com as **quatro que contam**.
`UNICA` fica fora — oferecer uma opção que a própria tela desaconselha na linha
seguinte faria do aviso uma placa de "não use isto". O padrão é `MENSAL`, que é
**exatamente o que o código já fazia**: quem não mexer no seletor tem o mesmo
resultado de antes, e `test:taxas` prova a igualdade com o fallback da ação.

⚠️ E o aviso **não sumiu com a opção**. Ele aparece na lista quando existe uma
linha `UNICA` — que é o caso de quem já tem uma no banco, e são justamente as que
ninguém sabe que não contam.

### 🔴 A LINHA VERMELHA — `Expense.workspaceId` NULO amplia escopo

`NULO` naquela coluna **não é "sem dono": é "vale para TODAS as áreas"**. É uma
das duas linhas vermelhas da tabela do `CLAUDE.md`. Anular por descuido faz a
despesa de UMA operação ser descontada do lucro de TODAS — com número plausível
nas duas pontas, que é o que torna o defeito mudo.

`test:taxas` prova as duas pontas, e as duas são **estruturais**:

| | Como está garantido |
|---|---|
| **criar grava a área** | `createExpense` escreve `escopo.areaId \|\| null`, e a tela chama `v.criarDespesa`, que carrega `s.workspaceAtiva`. A guarda também proíbe a tela de chamar `createExpense` direto, o que pularia a área |
| **editar não zera** | o patch de `updateExpense` é `Pick<ExpenseDTO, "amount" \| "name" \| "active">`, e `ExpenseDTO` **sequer declara** `workspaceId` — não existe valor do tipo certo que carregue a anulação |

> ### ⛔ A GUARDA DE EDIÇÃO PASSOU COM A PORTA ABERTA NA PRIMEIRA VERSÃO
> Ela procurava o `Pick<...>` — e o `Pick` continua lá quando alguém **anexa**
> `& { workspaceId?: string \| null }` depois dele. Achado ao provar pelo lado
> negativo: dos três defeitos plantados, esse foi o único que escapou.
>
> Hoje ela afirma **duas** coisas: que o `Pick` é o de três campos, **e** que a
> assinatura não menciona `workspaceId` de forma nenhuma. A segunda é a que
> fecha a porta — a primeira sozinha mede a presença do certo, não a ausência do
> errado. É a sétima vez que uma guarda por texto desta base mira sintaxe que o
> caso CERTO também contém.

### O que foi MEDIDO na tela

| | Claro | Escuro |
|---|---|---|
| aviso sobre o tinte âmbar (composto sobre o fundo real) | **4,95:1** | **6,17:1** |
| linha `fora do cálculo` | 5,02 | 7,85 |
| frase de incidência | 4,97 | 5,20 |

⚠️ **A primeira medição saiu 17,85 nos três papéis** — três valores idênticos são
a assinatura de seletor errado, não de contraste ruim. Os `querySelector` haviam
pegado wrappers que herdam `text-text`. Refeita mirando as classes, com a
contagem de elementos achados junto (2 e 6) como linha de base.

### ✅ Largura estreita — a segunda tela a pagar

`.tk-auth`… não: aqui a raiz é a própria tela. Apertada por JS a **360 · 390 ·
430 · 768px**: **0 de 311** descendentes vazando nas quatro. Método registrado
no `CLAUDE.md` (encolher o CONTÊINER, não a janela).

### 🌱 O seed, e o erro de medição que ele carregava

`npm run dev:taxas` — idempotente, provado em três execuções.

⚠️ **A primeira versão do cabeçalho dele afirmava "0 linhas em `Expense`", e era
FALSO.** Eu inferi de uma tela que abriu vazia em vez de consultar o banco.
Corrigido no mesmo dia, ao ver na tela despesas que o script não havia criado.

O estado real, medido com `SELECT`: **5 despesas, todas `DESPESA_RECORRENTE`,
todas com `workspaceId` NULO**, cobrindo as cinco frequências — da sessão do
rateio de 06/08. O que **não existia** era linha nos outros quatro grupos: zero
taxa de gateway, zero imposto, zero coprodução, zero custo de produto.

🔴 **E é isso que deixava o entregável invisível.** A frase de incidência existe
para separar uma taxa FIXA restrita a uma forma de pagamento de uma PERCENTUAL
global — as duas são taxa de gateway, e o dev não tinha **nenhuma**. O conflito
que motivou a tela não tinha representante no único banco em que dá para olhar.

⚠️ É a forma mais enganosa da família do gerador: o estado existente **parecia
rico** — cinco linhas, cinco frequências, tudo plausível.

---

## ÁREAS DE TRABALHO

⛔ **NÃO HÁ IMAGEM DE REFERÊNCIA.** Critério de Pixel/Eventos, Webhooks e Taxas:
`06` para acabamento, o que a tela faz para conteúdo.

> ### 🔎 CONVENÇÃO — a mesma de CAMPANHAS, LOGIN e TAXAS
> **✅ = eu vi na tela.** Linha em branco = construída e NÃO VISTA. Percorrida
> em 12/08/2026, nos dois temas, com uma segunda área criada **pela própria
> tela** — o que exercitou o caminho de escrita de ponta a ponta.

| Elemento | Status |
|---|---|
| Lista de áreas em cartões, com cor, nome e descrição | ✅ |
| Selo `Principal` | ✅ |
| Selo `Arquivada` | |
| **Resumo do recorte** — diz o EFEITO, não a contagem crua | ✅ |
| Botões editar · duplicar · excluir por linha | ✅ |
| ⛔ A Principal NÃO tem botão de excluir | ✅ |
| Gaveta de criar/editar, na `tk/Gaveta` | ✅ |
| Paleta de cor, com anel no selecionado | ✅ |
| Listas de contas · webhooks · pixels, com rolagem | ✅ |
| **Chips livres** de produtos e fontes de tráfego | ✅ |
| Interruptor de arquivar — ausente na Principal | ✅ |
| **Conflito de conta** — a gaveta NÃO fecha, e oferece autorizar | |
| Gaveta de exclusão, com destino por grupo | 🔧 |
| 🔴 **Consequência de PROMOÇÃO de escopo, com contagem real** | |
| Bloco de PERDA, separado do de promoção | |
| Confirmação por digitação do nome | ✅ |
| Grupo vazio não desenha seletor | ✅ |
| Tema claro e tema escuro | ✅ |
| Largura estreita | ✅ |
| `pixelConfigIds` — controle mantido | 🔧 |

### ✅ O CAMINHO DE ESCRITA, EXERCIDO NA TELA — melhor que qualquer asserção

Criei `Operação Black` pela gaveta: nome, descrição, cor, 1 conta, 1 webhook e
1 produto. O cartão voltou dizendo **`1 conta · 1 webhook · 1 produto`**. Ou
seja, os campos não só chegam ao servidor — eles voltam.

### 🔴 O ACHADO: SÃO DOIS MECANISMOS PARA A MESMA RELAÇÃO, E ELES NÃO CONVERSAM

**Medido em 12/08/2026, e observado na tela — que é a evidência mais forte.**

| | Lê / escreve |
|---|---|
| `preverExclusaoDaArea` | `AdAccount.workspaceId` · `Webhook.workspaceId` · `PixelConfig.workspaceId` (`exclusao.ts:101-103`) |
| o formulário de Áreas | `Workspace.accountIds` · `webhookIds` · `pixelConfigIds` |

O que aconteceu na tela: marquei 1 conta e 1 webhook, o cartão confirma
`1 conta · 1 webhook`, e o **diálogo de exclusão não mostrou seletor de destino
nenhum** — porque, do ponto de vista dele, a área não tem conta nem webhook.

⛔ **Código CONGELADO** (anterior a `4e6aa9e`): medido, registrado, **não
consertado**. E isto reenquadra o `pixelConfigIds`: ele não é uma coluna órfã
solitária — é **um lado inteiro de um par**, e a pergunta certa não é "remover o
controle?", é **"qual dos dois lados é a relação de verdade?"**.

⚠️ Por isso três itens do diálogo ficaram EM BRANCO: com a relação partida, a
área que criei não tem regras nem despesas do ponto de vista da prévia, então a
**promoção de escopo não teve como disparar**. Ela está testada em
`test:areas-tela` (a função pura), e **não vista**.

### 🐛 O defeito que só a tela mostrou

**A cor gravada não estava na paleta.** A Principal do dev tem `#8B5CF6` — roxo
do sistema antigo —, e o seletor abria com NENHUMA cor selecionada: a tela
afirmando que a área não tem cor enquanto o ponto ao lado a desenhava.

⚠️ **É o mesmo defeito que eu já havia previsto no seletor de fuso da tela de
Taxas** (*"o fuso GRAVADO entra na lista mesmo fora do catálogo"*) e não apliquei
aqui — prova de que aquela nota descrevia UM caso em vez de nomear o padrão. O
padrão é: **seletor de valor fechado precisa admitir o valor já gravado, senão
ele mente sobre o estado atual.**

### O que foi MEDIDO

| | Claro | Escuro |
|---|---|---|
| nome da área | **17,85:1** | **16,11:1** |
| descrição · resumo do recorte | 4,97 | 5,20 |

**Largura estreita:** `0 de 47` descendentes vazando a 360 · 390 · 430 · 768px.

### 🔧 O único item que já tem decisão: `pixelConfigIds`

**NÃO VERIFICADO, e é diferente de ✅.** Mantido porque o campo persiste
(`updateWorkspace` o grava), **sem consumidor conhecido** — medido em
12/08/2026: **0 referências** fora de `actions/workspaces.ts`.

⛔ **A decisão do dono foi manter**, e o argumento é o desta mesma sessão:
remover o controle de um campo que persiste é a regressão que a tela de Taxas
acabou de cometer, e *"zero leitores hoje"* não é *"ninguém depende"*.

🔜 **E o achado adiado é o inverso do óbvio:** não *"remover o controle"*, e sim
**descobrir por que gravamos algo que ninguém lê**. Um dos dois lados está
errado, e remover o controle escolheria um lado sem medir.

### ✅ A CONFERÊNCIA DE ESCRITA — feita na hora, e automatizada

A família *"a tela nova apresenta estado que ela mesma não consegue criar"* é a
única que nenhuma ferramenta desta base pega. Aqui ela virou asserção:
`test:areas-tela` **lê do próprio `actions/workspaces.ts`** a lista de campos que
`updateWorkspace` persiste e exige que cada um tenha origem no `aoSalvar` do
formulário.

| Campo | Persiste | Tem origem na tela |
|---|---|---|
| `name` · `color` · `description` · `archived` | ✅ | ✅ |
| `accountIds` · `webhookIds` · `pixelConfigIds` | ✅ | ✅ |
| `products` · `sources` | ✅ | ✅ |
| `moverContas` | ⚠️ não é coluna — é AUTORIZAÇÃO (`liberarContas`) | ✅ |

⛔ A lista é LIDA do servidor, nunca copiada: uma cópia à mão envelheceria no
primeiro campo novo, e envelheceria em silêncio — que é exatamente a família que
esta guarda existe para fechar.

✅ **Provado pelo lado negativo com a regressão EXATA:** removendo
`pixelConfigIds` do envio, a suíte reprova **nomeando o campo**.

### 🔴 A EXCLUSÃO DIZ O QUE **PROMOVE**, não só o que apaga

`AutomationRule.workspaceId` e `Expense.workspaceId` NULOS significam **GLOBAL**,
e `onDelete: SetNull` ali não é estado neutro — é promoção de escopo. Foi assim
que excluir uma área transformou *"pause as campanhas desta operação"* em
*"pause as de TODAS as contas"*, com a regra ainda ativa.

A contagem é **real**, vinda de `preverExclusaoDaArea`, buscada **antes** de o
diálogo aparecer:

> **2 regras passam para a área Principal** — elas não estão limitadas a contas
> específicas, então passam a agir sobre TODAS as campanhas de lá.
>
> **1 dessas regras está ATIVA** e volta a rodar sozinha — pausando campanhas ou
> mexendo em orçamento, com dinheiro real.

⚠️ **E o texto segue a OPÇÃO SELECIONADA.** Os padrões de `OpcoesExclusao` já são
os seguros (`regras` e `despesas` nascem em `excluir`), então **na configuração
padrão não há promoção nenhuma e o bloco de alarme não aparece** — alarmar ali
seria alarme que grita sem motivo, e isso envenena o único sinal que existe.

⚠️ Apagar a conta declara a perda do **histórico de gasto**, não só da conta: o
cascade derruba `DailyAdMetric`, que é a base de ROAS, ROI e CPA de todos os
períodos.

### ⛔ A EXCLUSÃO NÃO FOI EXERCITADA — e não deve ser sozinha

Escrita destrutiva em tabela de dado de negócio, irreversível. **Decisão do
dono:** construir o fluxo e a confirmação; exercitar só junto, numa área
descartável.

O que precisaria ser exercitado, quando for:

| | |
|---|---|
| 1 | `regras: "mover"` numa área com regra ATIVA — e conferir no banco que ela ficou com `workspaceId` NULO **e ativa** |
| 2 | `contas: "remover"` — e conferir que `DailyAdMetric` foi junto |
| 3 | `apagarDados: true` — a contagem que o diálogo mostrou bate com o que sumiu? |
| 4 | nome digitado errado → o servidor recusa com `nome-nao-confere` |

⚠️ O item 1 é o único que **volta a agir sozinho** depois do teste. Ele exige
desligar a regra antes, ou aceitar que ela rode.

### O limite do teste, escrito nele

A `tk/Gaveta` porta para o `<body>` com `createPortal`, então
`renderToStaticMarkup` devolve **vazio** — é a mesma "proteção por ESTRUTURA" do
`Popover`. As asserções sobre o diálogo são guardas de TEXTO, e **não respondem
"como ficou"**.

⚠️ Descoberto ao escrever o arquivo: quatro asserções mediam markup de zero
caracteres, e **foi a linha de base que denunciou**. Sem ela,
`!/para confirmar/.test("")` passaria — o teste afirmando que o diálogo não tem
confirmação por digitação quando ele apenas não havia sido desenhado.

---

## NOTIFICAÇÕES

⛔ **NÃO HÁ IMAGEM DE REFERÊNCIA.** Critério de Pixel/Eventos, Webhooks, Taxas e
Áreas: `06` para acabamento, o que a tela faz para conteúdo.

| Elemento | Status |
|---|---|
| Duas seções: `Notificações de venda` e `Resumo por horário` | ✅ |
| Ícone em recipiente quadrado neutro (`06` §13) | ✅ |
| `Quando avisar` — venda aprovada e pendente | ✅ |
| ⚠️ `Venda pendente` declara que o dinheiro pode NÃO entrar | ✅ |
| `O que mostrar` — quatro campos do conteúdo | ✅ |
| Quatro horários de resumo, em grade | ✅ |
| Seletor de padrão, com a explicação do escolhido embaixo | ✅ |
| **Aviso quando nenhum horário está ligado** | |
| **Aviso quando nenhum alerta de venda está ligado** | |
| Declaração de que o horário segue o fuso da CONTA | ✅ |
| Tema claro | ✅ |
| Tema escuro | ✅ visto, ⚠️ **não medido** |
| Largura estreita | ✅ |

### ✅ A CONFERÊNCIA DE ESCRITA — os onze campos, cruzados com o DTO

`test:notificacoes` lê os campos do `NotificationSettingsDTO` **do próprio
arquivo da ação** e exige que o conjunto seja **igual** ao que a tela escreve —
nem a mais, nem a menos. As duas direções importam:

| | O que aconteceria |
|---|---|
| campo no servidor e não na tela | o interruptor some, a leitura continua certa, ninguém nota — a regressão de Taxas |
| campo na tela e não no servidor | o patch é descartado em silêncio, e a tela mostra o valor que ela mesma inventou |

✅ **Provado pelo lado negativo:** removendo `showValue` da lista da tela, a
suíte reprova nomeando o campo.

### 🐛 O que o `tsc` achou antes de mim

**`v.notif` não tem os quatro horários.** Ele é modelo de TELA: os `report08…23`
saem dele para virar a lista `reports`, com um `toggle` por horário, e no lugar
deles entra um `preview` que o DTO não tem. Ou seja, **`notif` e
`NotificationSettingsDTO` são formas diferentes**, e eu tratei os dois como o
mesmo.

Quem denunciou foi o compilador, ao recusar `notif` onde o DTO era esperado. A
tela passou a consumir `v.notifCru` — o DTO inteiro, com os onze campos.

⚠️ É a mesma classe do `despesasCruas` em Taxas: **derivado de tela não serve
para escrever**, porque ele foi moldado para o que a tela antiga desenhava.

### O que foi MEDIDO

| | Claro |
|---|---|
| título da seção | **17,85:1** |
| apoio | 4,97 |

**Largura estreita:** `0 de 102` descendentes vazando a 360 · 390 · 430 · 768px.

⚠️ O tema escuro foi **visto** e não medido: o `Runtime.evaluate` congelou o
renderer duas vezes seguidas, e a regra das duas tentativas manda parar.

### Os dois itens em branco

Os dois avisos condicionais (nenhum horário ligado · nenhum alerta de venda
ligado) **não foram vistos disparando** — o dev tem `23h` ligado e os dois
alertas de venda ligados. Estão testados como função pura (`nenhumHorarioLigado`)
e o texto está afirmado por guarda, mas **como ficam na tela ninguém viu**.

⛔ Ligá-los exigiria desligar as configurações reais do dono no banco de dev.

---

## O QUE ESTÁ NAS REFERÊNCIAS E NÃO EXISTE NO PRODUTO

Backend novo, não redesign. **Nenhum destes tem prazo até decisão explícita.**

| Área | Aparece em |
|---|---|
| `Campanhas` separada de `Anúncios` | imagens 1, 4, 5, 6 |
| `Relatórios` | imagens 1, 5 |
| `Conversões` | imagens 5, 6 |
| `Públicos` | imagens 5, 6 |
| `Fontes` | imagem 5 |
| `Ofertas` | (imagem trackhub anterior) |
| `Logs` | imagens 6, 7 |
| `Resumo` (separado de Dashboard) | imagens 6, 7 |
| `Equipe` — multiusuário | imagens 6, 7 |
| `Planos & Cobrança` | imagens 6, 7 |
| `Métricas` | imagem 5 |
| Biblioteca pública de snippets | imagem 8 |
| **Testes A/B em criativos** | imagem 9 — ⛔ **medido em 12/08:** zero acertos de `folder\|pasta\|abtest\|experiment\|split.?test` no `schema.prisma` |
| **Pastas de criativos** | imagem 9 — idem |

> ### ⚠️ ESTE DOCUMENTO SE CONTRADIZIA SOBRE OS DOIS ACIMA — resolvido em 12/08
>
> A seção CRIATIVOS dizia *"provavelmente não existem no backend. Mesma regra:
> **construa**, e se não houver dado, estado vazio honesto"* — cinquenta linhas
> antes desta tabela, que diz *"backend novo, não redesign. **Nenhum destes tem
> prazo até decisão explícita**"*.
>
> **Vale esta tabela.** Decisão do dono, 12/08/2026: as duas ficam 🔧 fora, junto
> de `Análise`. O "provavelmente" virou medição, e aba com contador que abre
> vazia é a mesma classe do controle inerte — o produto afirmando ter algo que
> não tem.
>
> ⛔ A frase antiga foi **apagada**, não mantida ao lado da nova: proibição (ou
> permissão) que muda vira ordem para desfazer. Ver *"COMENTÁRIO QUE PROÍBE É O
> MAIS PERIGOSO DE TODOS"*, no `CLAUDE.md`.

---

## COMO USAR ESTE DOCUMENTO

Ao terminar cada tela, o Claude Code preenche a coluna de status desta lista e devolve. Um item ❌ que continue ❌ ao fim da tela é trabalho não feito, não é decisão — a menos que vire 🔧 com um motivo escrito e aprovado.

O teste do cinza continua valendo. Este documento é o complemento: o cinza prova que a **estrutura** mudou; esta lista prova que o **conteúdo** está completo.