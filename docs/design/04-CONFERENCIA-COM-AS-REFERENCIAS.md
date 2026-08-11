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
| As três colunas do Builder terminando juntas | ✅ 🔧 nosso. `alignItems: stretch` + a barra de ação afundando para o rodapé de cada cartão. **Medido:** as três em `bottom: 661`. ⚠️ Troca a borda serrilhada por vão DENTRO dos dois primeiros cartões — ver a nota |
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

**Nota sobre o vão do Builder:** não existe arranjo com zero vão — a altura da
fileira é a da coluna mais alta, e as três têm conteúdos de tamanhos diferentes.
O que se escolhe é ONDE o vão fica. Com `start` ele ficava FORA, na borda de
baixo serrilhada; com `stretch` ele fica DENTRO, acima da barra de ação, que é o
lugar em que ele se lê como rodapé de formulário em vez de bloco inacabado.

**Nota:** o inventário de snippets é o REAL — 4 famílias de código **gerado**
(rastreamento de UTM, back redirect, 3 formatos de parâmetro de URL, 1 por
pixel). Não existe modelo `Snippet` no `schema.prisma`. Inventar trechos avulsos
para bater com o print seria conteúdo que ninguém escreveu, sobre snippets que
não são instalados em lugar nenhum.

---

## CRIATIVOS

Referência: imagem 9.

| Elemento | Status |
|---|---|
| 6 KPIs com ícone em caixa colorida: total, CTR médio, CPC médio, taxa de conversão, ROAS médio, ativos | ❌ |
| `⤒ Importar` · `📁 Pastas` · `+ Novo criativo ⌄` | ❌ |
| Busca por nome ou ID com `⌘K` | ❌ |
| Filtros: Plataforma (com ícone) · Campanha · Formato · Tipo de mídia · Status · `Filtros` | ❌ |
| **Alternador grade / tabela** | ❌ |
| Abas com contador: `Todos 1.248` · `Análise` (badge `Novo`) · `Testes A/B 23` · `Top performers` · `Em queda` · `Inativos 936` | ❌ |
| Carrossel horizontal de miniaturas com seta `›` | ❌ |
| Card: thumbnail, botão play, badge de plataforma, ponto de status | ❌ |
| Card: nome + badge de estado + `ROAS / CTR / CPA` no rodapé | ❌ |
| Tabela `Desempenho dos criativos` com miniatura na primeira coluna | ❌ |
| Coluna CAMPANHA com prefixo de objetivo (`[CONV]`, `[TRÁFEGO]`) e status | ❌ |
| `Ordenar por: ROAS (maior) ⌄` + `⤓ Exportar` | ❌ |
| `Mostrar 20 ⌄` + `1-20 de 1.248` + paginação | ❌ |

`Testes A/B` e `Pastas` provavelmente não existem no backend. Mesma regra: construa, e se não houver dado, estado vazio honesto.

---

## LOGIN

Referências: imagens 10 e 11 (claro e escuro).

| Elemento | Status |
|---|---|
| Split-screen, marca à esquerda, formulário à direita | ❌ |
| Logo grande no topo esquerdo | ❌ |
| Badge `PLATAFORMA DE TRACKING E GESTÃO` | ❌ |
| Headline com **segunda linha em cor de destaque** | ❌ |
| Parágrafo de apoio em duas linhas | ❌ |
| Três provas com ícone: título + subtítulo | ❌ |
| **Preview da ferramenta** — mockup do dashboard com KPIs e gráfico | ❌ |
| Arco decorativo de fundo | ❌ |
| Rodapé esquerdo: `🔒 Dados criptografados e protegidos…` | ❌ |
| Cartão do formulário: `Bem-vindo de volta` + subtítulo | ❌ |
| Campos com ícone dentro (envelope, cadeado) | ❌ |
| Olho para revelar senha | ❌ |
| `Lembrar de mim` + `Esqueci minha senha` | ❌ |
| Botão `Entrar →` em gradiente | ❌ |
| Divisor `ou continue com` | ❌ |
| Social: `Google` · `Meta` · `Apple` | ❌ |
| `Ainda não tem uma conta? Criar conta` | ❌ |
| Rodapé com copyright | ❌ |
| Espelhar tudo em `/signup` | ❌ |

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
| Testes A/B em criativos | imagem 9 |
| Pastas de criativos | imagem 9 |

---

## COMO USAR ESTE DOCUMENTO

Ao terminar cada tela, o Claude Code preenche a coluna de status desta lista e devolve. Um item ❌ que continue ❌ ao fim da tela é trabalho não feito, não é decisão — a menos que vire 🔧 com um motivo escrito e aprovado.

O teste do cinza continua valendo. Este documento é o complemento: o cinza prova que a **estrutura** mudou; esta lista prova que o **conteúdo** está completo.