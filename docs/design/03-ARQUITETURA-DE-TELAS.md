# 03 — ARQUITETURA DE TELAS

> Este documento é o que faltava. O `01-PROMPT-MASTER.md` especificou **cor, tipografia e espaçamento** com detalhe cirúrgico e especificou **estrutura** em duas linhas. O resultado previsível: os tokens foram aplicados em cima do JSX que já existia e a ferramenta ficou igual, em outra cor.
>
> Aqui não há um único hexadecimal. Este documento trata só de **o que existe na tela, onde, e em que relação**. Ele tem precedência sobre o master em qualquer conflito de layout.

---

## REGRA ZERO

**Nenhuma tela redesenhada pode reaproveitar o componente de layout da tela antiga.**

Na prática, para cada tela da lista abaixo:

- O arquivo antigo da página é **deletado**, não editado.
- A página nova é escrita do zero contra os componentes do design system.
- É proibido abrir o arquivo antigo para "aproveitar a estrutura". Abra-o apenas para listar **quais dados** a tela consome — nunca para copiar como eles eram exibidos.
- Se ao final o diff mostrar `className` alterado em cima de uma árvore JSX preservada, a tela foi reprovada e refeita.

Lógica de dados, hooks, chamadas de API e cálculo permanecem. **A camada de apresentação é jogada fora.**

---

## O TESTE DO CINZA

O critério de aceite de toda tela, e ele é objetivo:

> Tire um print da tela antiga e da tela nova. Passe as duas para escala de cinza. Se, sem cor nenhuma, as duas forem reconhecíveis como a mesma tela, **o trabalho não foi feito.**

Estrutura é o que sobrevive à dessaturação: quantos blocos, de que tamanho, em que arranjo, com que profundidade de navegação. Cor não sobrevive. Se a única coisa que muda é o que morre no cinza, não houve redesign.

Cada PR de tela deve vir com os dois prints em cinza, lado a lado, na descrição.

---

## O VOCABULÁRIO QUE A FERRAMENTA NÃO TEM

Hoje a ferramenta inteira conhece **um** padrão de layout: card empilhado em grade. Toda tela é uma pilha de retângulos do mesmo peso. É por isso que Dashboard, Integrações e Taxas parecem a mesma tela — porque estruturalmente são.

Sete padrões precisam existir. Eles vão em `/design-system` antes de qualquer tela ser tocada.

### 1. Mestre-detalhe (`SplitView`)
Lista à esquerda (≈55%), painel de detalhe à direita (≈45%), seleção persistente. O item selecionado tem marcador de borda esquerda. O painel direito tem **abas próprias** e ações destrutivas no rodapé.
Substitui: toda tela que hoje é "lista de cards que abrem modal".

### 2. Faixa de estado (`StatusStrip`)
Quatro a cinco números de **estado do sistema** no topo da tela — não de desempenho. `Conectadas 12 · Com erro 2 · Inativas 1 · Total 15`. Cada um é filtro clicável que aplica à lista abaixo.
É diferente de `MetricCard`: mede saúde, não dinheiro, e não tem sparkline.

### 3. Navegação de dois níveis (`NavGroup` expansível)
Item de menu que abre filhos inline, com o filho ativo marcado. `Integrações` deixa de ser uma página e vira uma seção com cinco páginas dentro.
Sem isso, cada área nova vira mais uma linha na lista plana até a sidebar ter vinte itens.

### 4. Canvas de nós (`FlowCanvas`)
Três colunas: paleta de componentes à esquerda com abas, canvas com nós conectados no centro, painel de propriedades do nó selecionado à direita. Zoom, ajustar à tela, desfazer/refazer, botão `+` entre nós, ramificação com rótulo `Sim` / `Não`, rodapé com telemetria de execução.

### 5. Painel de propriedades (`InspectorPanel`)
Coluna fixa à direita que edita **o que estiver selecionado**, com o ID do objeto visível no topo. Salva no objeto, não em um formulário separado.

### 6. Galeria + tabela (`GalleryTable`)
Faixa de miniaturas navegável no topo com métricas por card, tabela densa do mesmo conjunto embaixo, alternador grade/tabela. As duas visões compartilham filtro e ordenação.

### 7. Barra de comando (`CommandBar`, ⌘K)
Busca global no header. Navega entre telas, campanhas, criativos e integrações. É o que torna a navegação de dois níveis suportável.

---

## TELA POR TELA

Formato: **hoje** → **passa a ser** → **o que reprova**.

---

### Dashboard

**Hoje:** doze `MetricCard` idênticos em duas fileiras de seis, todos com o mesmo peso. Funil de conversão ocupando meia largura e quase sempre vazio. Globo 3D ocupando a outra meia largura e quase sempre vazio. Atividade recente vazia. Taxa de aprovação como três barras. Vendas por dia no rodapé.

O problema não é estético: **doze números do mesmo tamanho não respondem a pergunta nenhuma.** A tela não diz se você está ganhando ou perdendo dinheiro — ela lista tudo e deixa você procurar.

**Passa a ser:**

```
┌─ Período  Conta  Produto  Fonte ──────────────  ⟳ 8s  Editar ─┐
├───────────────────────────────────────────────────────────────┤
│ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐       │
│ │ FATURAM.  │ │ GASTO     │ │ ROAS      │ │ LUCRO     │  ← 4  │
│ │ R$ ###    │ │ R$ ###    │ │ #,##x     │ │ R$ ###    │  KPIs │
│ │ ▁▃▅▇▅▃▁   │ │ ▁▃▅▇▅▃▁   │ │ ▁▃▅▇▅▃▁   │ │ ▁▃▅▇▅▃▁   │  hero │
│ │ ↑18,6%    │ │ ↓2,4%     │ │ ─── b.e.  │ │ ↑21,3%    │       │
│ └───────────┘ └───────────┘ └───────────┘ └───────────┘       │
├───────────────────────────────────────────────────────────────┤
│ Ticket · CTR · CPA · ARPU · Margem · Pendentes · Reembolsos   │ ← faixa
│  R$ ##    #%    R$ ##   R$ ##   ##%      R$ ##      #         │   compacta
├──────────────────────────────┬────────────┬───────────────────┤
│ RECEITA vs GASTO             │ CANAIS     │ ALERTAS           │
│ (com linha de break-even)    │ (donut)    │ ⚠ ROI abaixo…  2h │
│                              │            │ ✕ Gasto sem conv. │
│                              │            │ ℹ Integração off  │
├──────────────────────────────┴────────────┴───────────────────┤
│ TOP CAMPANHAS (tabela)        │ PERFORMANCE POR HORA (heatmap) │
│ nome · receita · gasto · ROI  │      Seg Ter Qua Qui Sex       │
│ ▸ ▸ ▸ ▸ ▸                     │ 00h  ░ ░ ▒ ▓ █                 │
├───────────────────────────────┴───────────────────────────────┤
│ Integrações 12 │ Regras 34 │ Taxas R$ ### │ Sync há 1 min     │ ← rodapé
└───────────────────────────────────────────────────────────────┘
```

Mudanças estruturais, nomeadas:

1. **Quatro KPIs hero com sparkline embutido**, não doze iguais. Os outros sete descem para uma faixa compacta de uma linha, sem sparkline, sem card.
2. **O globo 3D sai do Dashboard.** Ele consome um terço da tela para dizer "nenhuma venda com país identificado". Vira uma aba dentro de Relatórios, ou morre.
3. **Painel de Alertas** entra — é a única coisa na tela que exige ação. Hoje não existe.
4. **Top Campanhas** entra como tabela ranqueada com ação por linha.
5. **Heatmap hora × dia da semana** entra. É a visualização que um gestor de tráfego realmente usa e que nenhum concorrente tem bem feito.
6. **Funil sai da posição nobre.** Ele é diagnóstico, não monitoramento: vai para a metade inferior ou para tela própria.
7. **Rodapé de estado do sistema** — integrações, regras rodando, despesas do mês, última sincronização.

**Reprova se:** os KPIs continuarem todos do mesmo tamanho; o globo continuar acima da dobra; não existir painel de alertas.

---

### Regras — a mudança mais radical da lista

**Hoje:** formulário. "Se CPA > X nas últimas Y horas, então pausar."

**Passa a ser:** construtor de fluxo em canvas, arrasta e solta.

```
┌── Regra: Google Ads | Campanhas Brand   ● Ativa ──── [Teste ▢] [Salvar] ─┐
├──────────────┬────────────────────────────────┬─────────────────────────┤
│ COMPONENTES  │  − 100% +  ⛶  ↺ ↻    ✓ Válida  │ PROPRIEDADES  ID:cond_1 │
│ ─────────────│                                │ ────────────────────────│
│ Gatilhos ▸   │      ┌────────────────┐        │ Operador lógico         │
│ Condições    │      │ ⚡ Gatilho      │        │ [E (todas)         ▾]   │
│ Ações        │      │ Clique recebido│        │                         │
│              │      └───────┬────────┘        │ Condições               │
│ ┌──────────┐ │              +                 │ [utm_source ▾][contém▾] │
│ │⚡ Nova    │ │      ┌───────┴────────┐        │ [google              ]  │
│ │ campanha │ │      │ ◈ Condição      │        │ [utm_medium ▾][contém▾] │
│ └──────────┘ │      │ utm_source ⊃ go │        │ [cpc                 ]  │
│ ┌──────────┐ │      │       E         │        │ + Adicionar condição    │
│ │◉ Clique  │ │      │ utm_medium ⊃ cpc│        │                         │
│ │ recebido │ │      └──┬──────────┬───┘        │ Se verdadeiro (Sim)     │
│ └──────────┘ │     Sim │          │ Não        │ [Próxima ação      ▾]   │
│ ┌──────────┐ │    ┌────┴───┐  ┌───┴─────┐      │ Se falso (Não)          │
│ │◎ Conversão│ │    │ Definir│  │ Próxima │      │ [Próximo passo     ▾]   │
│ └──────────┘ │    │ canal  │  │ regra   │      │                         │
│      ⋮       │    └────┬───┘  └────┬────┘      │ Criado  12 mai 14:32    │
│              │    ┌────┴───┐  ┌────┴────┐      │ Executada  1.248 vezes  │
│ + Solicitar  │    │ Definir│  │⚑ Fim    │      │ Sucesso        98,7%    │
│   gatilho    │    │ custo  │  │não aplic│      │                         │
│              │    └────────┘  └─────────┘      │ 🗑 Excluir componente    │
├──────────────┴────────────────────────────────┴─────────────────────────┤
│ Execuções (7d) 1.248 │ Sucesso 98,7% │ Última há 2 min │ Ver logs        │
└──────────────────────────────────────────────────────────────────────────┘
```

O que isso exige que hoje não existe:

- Paleta de componentes com três abas — **Gatilhos, Condições, Ações** — cada item arrastável com nome e uma linha de descrição.
- Nós conectados com ramificação rotulada `Sim` / `Não`, e botão `+` **na aresta** para inserir passo no meio do fluxo.
- Painel de propriedades que edita o nó selecionado, com o ID do componente visível.
- Controles de canvas: zoom, ajustar à tela, desfazer, refazer, indicador de validação.
- **Modo de teste** — alternador que roda a regra sem executar as ações.
- Rodapé com telemetria real: execuções, taxa de sucesso, última execução, link para logs.
- Estado vazio que é um convite: canvas com um gatilho fantasma e "Arraste um gatilho para começar".

Biblioteca: React Flow (`@xyflow/react`). Não construa canvas na mão.

**Reprova se:** continuar sendo formulário com dropdowns empilhados.

---

### Integrações

**Hoje:** cards de plataforma empilhados, 85% de tela vazia, sem hierarquia.

**Passa a ser:** navegação de dois níveis + mestre-detalhe.

A sidebar ganha filhos sob `Integrações`: **Visão geral · Anúncios · Webhooks · UTMs · Pixel/Eventos**.

Na **Visão geral**:

```
┌ Conectadas 12 │ Com erro 2 │ Inativas 1 │ Total 15 ┐  ← faixa de estado
├──────────────────────────────────────────────────────────────────────┤
│ [Todas][Anúncios][Webhooks][UTMs][Pixel]  🔍 filtrar  Status▾ Ordem▾  │
├──────────────────────────────┬───────────────────────────────────────┤
│ ▸ Google Ads   ● há 2 min    │ ⬤ Google Ads          ● Conectada  ⋮  │
│   Meta Ads     ● há 8 min    │ Conta principal · ID 123-456-7890     │
│   TikTok Ads   ● há 15 min   │ ─────────────────────────────────────  │
│   Kirvano      ● há 1 min    │ [Visão geral][Config][Sync][Logs][WH] │
│   Cakto        ✕ há 3 horas  │                                       │
│   OnyxPag      ● há 12 min   │ Conta      Moeda     Fuso             │
│   Hotmart      ● há 5 min    │ Tipo       Criada em Última atualiz.   │
│   Kiwify       ○ há 25 dias  │ ─────────────────────────────────────  │
│                              │ DADOS SINCRONIZADOS                   │
│ 1–10 de 15    ◂ 1 2 ▸        │ ✓ Campanhas   ✓ Custos                │
│                              │ ✓ Conjuntos   ✓ Conversões            │
│                              │ ✓ Anúncios    ✓ Cliques e impressões  │
│                              │ ─────────────────────────────────────  │
│                              │ [Testar conexão]   [🗑 Desconectar]    │
└──────────────────────────────┴───────────────────────────────────────┘
```

Mais um painel que hoje não existe e que é específico do seu domínio: **Saúde da integração** — status por serviço (API Meta, Pixel, Webhook, CAPI, Conversões Offline, Permissões) e **quantos dias faltam para o token expirar**. Token de Marketing API vencendo em silêncio é a falha mais cara que essa ferramenta pode ter, e hoje nada na interface avisa.

**Reprova se:** continuar sendo cards empilhados sem painel de detalhe.

---

### UTM & Snippets — tela nova

Hoje o gerador de UTM está enterrado e os snippets que o cliente cola no site não têm tela própria. Vira uma área de primeiro nível com duas abas.

**UTM Builder** — três colunas:

```
┌ GERADOR ──────────┬ URL GERADA ──── ● Válida ┬ HISTÓRICO RECENTE ─┐
│ Fonte    Mídia    │ https://seu.com/checkout │ 15:42 facebook/cpc │
│ [face..] [cpc  ]  │ ?utm_source=facebook&…   │ 15:38 google/pmax  │
│ Campanha Termo    │                     [⧉]  │ 15:31 tiktok/cpc   │
│ [......] [......] │ ── Visualização ──       ├────────────────────┤
│ Conteúdo ID camp. │ (utm_source=facebook)    │ MODELOS FAVORITOS  │
│ [......] [......] │ (utm_medium=cpc)         │ ★ Facebook — Lanç. │
│                   │ (utm_campaign=lanc-pro)  │ ★ Google — PMax    │
│ [Limpar] [Gerar]  │ Salvar como modelo [   ] │ ★ TikTok — Oferta  │
└───────────────────┴──────────────────────────┴────────────────────┘
```

Cada parâmetro vira um **chip colorido** na visualização — o usuário vê a URL montando peça por peça. Modelos salvos e histórico são entidades reais no banco, não localStorage.

**Snippets** — mestre-detalhe: tabela (nome, categoria, tipo, usado em N contas, atualizado, toggle ativo) + painel com **prévia do código com destaque de sintaxe** e botão copiar. Isso substitui a caixa de texto crua de hoje.

E resolve o bug do `[object Object]` na origem: a URL passa a ser montada por uma função pura testada, não por concatenação no JSX.

---

### Criativos

**Hoje:** grade de miniaturas sem hierarquia, métrica pequena demais.

**Passa a ser:** `GalleryTable`.

- Seis KPIs de topo próprios da tela: total de criativos, CTR médio, CPC médio, taxa de conversão, ROAS médio, ativos.
- Abas que são **perguntas de gestor**, não filtros genéricos: `Todos` · `Análise` · `Testes A/B` · `Top performers` · **`Em queda`** · `Inativos`. "Em queda" é a aba que justifica a tela existir — criativo saturando é o que custa dinheiro.
- Faixa de miniaturas: thumbnail com play, badge de plataforma, ponto de status, e **ROAS / CTR / CPA no rodapé de cada card**.
- Tabela densa embaixo, mesmo conjunto, com miniatura na primeira coluna.
- Alternador grade/tabela.

---

### Gerenciador de Anúncios

**Hoje:** ~20 colunas com cabeçalho de 10px, ilegível por definição.

**Passa a ser:**

- **Conjuntos de colunas nomeados**: `Performance` · `Custo` · `Conversão` · `Tudo`, com escolha personalizada persistida por usuário.
- **Nome e status congelados à esquerda**, resto rola horizontalmente.
- Hierarquia conta → campanha → conjunto → anúncio por expansão inline, não por troca de aba.
- **Painel lateral de Insights** que hoje não existe: melhor campanha, maior volume de conversões, menor custo por conversão, e "N campanhas com ROI abaixo de 1,5x". É a tela dizendo o que ela achou, em vez de esperar você achar.
- Seleção múltipla com barra de ações em lote.

---

### Login

Split-screen: metade esquerda com a marca, proposta de valor, três provas curtas e um preview da ferramenta; metade direita com o formulário e login social (Google, Meta, Apple).

Não é vaidade — é a primeira tela que um testador vê, e hoje ela não comunica o que o produto faz.

---

## O QUE MORRE

- **Globo 3D no Dashboard.** Um terço da tela para um estado vazio.
- **Barra flutuante inferior direita** com dez ícones sem rótulo. O conteúdo dela vai para a barra de comando (⌘K) ou para a sidebar.
- **Aba Testes.** Já decidido.
- **A grade de doze KPIs iguais.**

---

## SEQUÊNCIA

| # | Entrega | Por quê nesta ordem |
|---|---|---|
| 0 | Os sete padrões de layout em `/design-system`, com dados falsos | Sem eles toda tela volta a ser card empilhado |
| 1 | Navegação de dois níveis + ⌘K | O shell precisa suportar as telas novas |
| 2 | Dashboard | Mais usada, e é a prova de que a estrutura mudou |
| 3 | Integrações (mestre-detalhe + saúde) | Valida o padrão 1 e 2 num caso real |
| 4 | Regras (canvas) | Maior risco técnico, isolado |
| 5 | Gerenciador | Depende de tabela madura |
| 6 | UTM & Snippets | Tela nova, sem legado |
| 7 | Criativos | |
| 8 | Login | |

---

## PROMPT DE ABERTURA

Cole isto **antes** de qualquer tela:

```
Leia 03-ARQUITETURA-DE-TELAS.md. Ele tem precedência sobre o
01-PROMPT-MASTER.md em qualquer conflito de layout.

Antes de escrever código, faça o seguinte e pare para minha confirmação:

1. Para cada uma das 8 telas listadas, me diga em uma tabela: qual arquivo
   de página existe hoje, quantas linhas tem, e quais dos sete padrões de
   layout novos ela vai usar.

2. Me diga quais desses sete padrões NÃO existem no código hoje, nem em
   forma aproximada. Espero que sejam os sete.

3. Implemente os sete em /design-system com dados falsos realistas em
   reais, incluindo estado vazio e estado de erro. Nenhuma tela é tocada
   antes disso.

REGRA ZERO: quando chegarmos às telas, o arquivo antigo da página é
deletado, não editado. Você pode abri-lo para listar QUAIS DADOS a tela
consome. Não pode abri-lo para reaproveitar como esses dados eram
exibidos.

Ao fim de cada tela, me entregue os dois prints — antes e depois — em
escala de cinza. Se as duas forem reconhecíveis como a mesma tela sem cor,
a tela é refeita.

Não me diga que está pronto. Me mostre.
```