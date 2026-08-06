# PROMPT MASTER — Design System TrackHub

> **Como usar:** salve este arquivo como `CLAUDE.md` na raiz do repositório. O Claude Code lê automaticamente e passa a ter estas regras em toda sessão. Os prompts de execução, fase a fase, estão em `02-ROTEIRO.md`.

---

## 1. O produto

TrackHub é uma ferramenta de rastreamento e gestão de tráfego pago para o mercado brasileiro. Conecta contas de anúncio (Meta Ads, TikTok Ads, Google Ads) a gateways de pagamento brasileiros (Kirvano, Cakto, OnyxPag, Hotmart, Kiwify) e mostra, em tempo real, quanto entrou, quanto saiu e o que sobrou.

**Quem usa:** gestor de tráfego e infoprodutor. Fica com essa tela aberta 8 horas por dia, muitas vezes em dois monitores, decidindo escalar ou pausar campanha com dinheiro real em risco.

**A única pergunta que a interface precisa responder em menos de dois segundos:** estou ganhando ou perdendo dinheiro agora, e por causa de quê?

TrackHub **não é um dashboard de relatório — é uma mesa de operação.** A referência mental é um terminal financeiro com a disciplina visual do Raycast e do Linear. Densidade alta, leitura periférica, números com peso, cor usada com avareza para que o vermelho ainda queira dizer alguma coisa quando aparecer.

> **Renomeação:** o produto se chamava Traffik. Toda ocorrência do nome antigo — em componente, rota, texto de interface, metadado, título de aba, e-mail transacional, favicon e nome de pacote — passa a TrackHub. Ao encontrar o nome antigo em qualquer arquivo, trocar e reportar.

## 2. Stack

Next.js (App Router) + React + TypeScript · Tailwind CSS · shadcn/ui (Radix) · Recharts · lucide-react.

Não trocar de biblioteca. Todo o trabalho é reescrever a camada visual em cima dessa base.

## 3. O que está errado hoje (diagnóstico — não repetir nada disto)

1. **Escala tipográfica com buraco no meio.** Título de página em ~48px, e dentro dos cards tudo desaba para label 11px maiúscula + número. Não existe nível intermediário, então nada dentro do card tem hierarquia própria.
2. **Uma cor faz tudo.** O mesmo roxo é donut, funil, barra, sparkline, badge, botão primário e item ativo de menu. Uma cor que significa tudo não significa nada.
3. **Superfície única.** Todo card tem o mesmo fundo e a mesma borda de 1px. Um KPI de 90px de altura e um gráfico de 400px pesam visualmente igual.
4. **Densidade sem regra.** Seis KPIs esmagados em 2560px de largura enquanto a tela de Integrações fica 85% vazia. A tabela do Gerenciador tem ~20 colunas com cabeçalho de 10px, ilegível.
5. **Altura desperdiçada.** Header de ~90px com título gigante + faixa de filtros de ~60px = 150px consumidos antes do primeiro dado. Em tela widescreen, altura é o recurso escasso, não largura.
6. **Maiúscula em toda parte.** O estilo `11px uppercase letter-spacing` aparece em label de KPI, cabeçalho de tabela, título de seção e rótulo de filtro. Vira textura, deixa de ser sinal.
7. **Estados vazios mortos.** "Nenhuma chave criada ainda" em cinza, sem ação, no meio de uma tela em branco.
8. **Barra flutuante inferior direita** com dez ícones sem rótulo nem agrupamento.

## 4. Identidade de marca

Azul profundo para confiança e ação, ciano para o que está vivo. A marca vive no logo, na navegação e nos pontos onde o dado está chegando agora — nunca em grandes áreas de fundo.

**Gradiente oficial**

```css
--gradient-brand: linear-gradient(90deg, #2563EB 0%, #3B82F6 45%, #22D3EE 100%);
```

Aparece em: logotipo, CTA principal, indicador de estado ativo, barra de progresso. **Nunca como fundo de área grande** e nunca em mais de um elemento por tela.

Para preenchimento de área em gráfico, que precisa desvanecer verticalmente, use a derivação:

```css
--gradient-chart: linear-gradient(180deg,
  color-mix(in oklch, #22D3EE 38%, transparent) 0%,
  color-mix(in oklch, #3B82F6 14%, transparent) 55%,
  transparent 100%);
```

## 5. Paleta

Duas camadas: primitivos → tokens semânticos. Nenhum componente pode usar primitivo direto nem hexadecimal literal.

### Escuro (tema principal)

| Token | Hex | Uso |
|---|---|---|
| `background` | `#090D14` | fundo raiz da aplicação |
| `background-alt` | `#0F1724` | rail lateral, barra de contexto |
| `surface` | `#151D2D` | card, painel |
| `surface-hover` | `#1C2639` | hover, cabeçalho de tabela, input |
| `border` | `#243044` | contorno e separador |
| `primary` | `#3B82F6` | botão, link, navegação, estado ativo |
| `primary-hover` | `#2563EB` | — |
| `accent` | `#22D3EE` | série primária de gráfico, dado ao vivo, seleção |
| `success` | `#22C55E` | lucro, variação favorável |
| `warning` | `#F59E0B` | limite de orçamento, atenção, pendente |
| `danger` | `#EF4444` | prejuízo, variação desfavorável, erro |
| `text` | `#F8FAFC` | número, título |
| `text-secondary` | `#94A3B8` | rótulo, texto de apoio |
| `text-muted` | `#64748B` | placeholder, metadado, desabilitado |

**Camada de overlay** (popover, dropdown, modal): `surface-hover` com borda `border` e sombra. É a única superfície que carrega sombra.

### Claro (funcional, mesmos nomes de token)

| Token | Hex |
|---|---|
| `background` | `#F6F9FC` |
| `background-alt` | `#FFFFFF` |
| `surface` | `#FFFFFF` |
| `surface-hover` | `#F1F5F9` |
| `border` | `#E2E8F0` |
| `primary` | `#2563EB` |
| `primary-hover` | `#1D4ED8` |
| `accent` | `#06B6D4` |
| `success` | `#16A34A` |
| `warning` | `#D97706` |
| `danger` | `#DC2626` |
| `text` | `#0F172A` |
| `text-secondary` | `#64748B` |
| `text-muted` | `#94A3B8` |

> Dois ajustes em relação à especificação enviada, ambos por contraste em fundo branco: `warning` desce de `#F59E0B` para `#D97706` (o âmbar original rende 2.1:1 sobre branco e reprova AA em qualquer texto), e `text-muted` ganha o valor `#94A3B8`, que não constava. No tema escuro o âmbar original é mantido.

### Cores de canal

Exclusivas para séries de gráfico e identificação de plataforma. Proibidas em qualquer outro contexto.

| Canal | Hex |
|---|---|
| Meta | `#818CF8` |
| TikTok | `#F472B6` |
| Google | `#FB923C` |
| Outros | `#64748B` |

> Por que Meta não é azul e TikTok não é ciano, mesmo sendo essas as cores das marcas: azul é `primary` e ciano é `accent` neste sistema. Uma série de Meta em azul seria lida como estado ativo da interface, e uma de TikTok em ciano seria lida como dado ao vivo. Os canais foram deslocados para índigo, rosa e laranja, que ficam fora da faixa da marca e continuam distinguíveis entre si em daltonismo do tipo deuteranopia. Consequência: **`warning` nunca aparece como série de gráfico**, para que o laranja do Google não seja ambíguo.

### Regras de proporção

**80% neutro** — fundos, cards, bordas, tabelas, todo texto de dado.
**15% azul** — botão, link, navegação, estado ativo, foco.
**5% ciano** — série primária de gráfico, indicador ao vivo, seleção, destaque.

As cores semânticas (success, warning, danger) ficam fora dessa conta: elas não decoram, elas informam, e aparecem exatamente quando o dado exige.

**Regra dura:** `primary` não aparece dentro de gráfico nem de célula de tabela. `accent` não aparece em botão nem em item de navegação. Se essa fronteira for cruzada, o usuário perde a capacidade de distinguir "onde eu clico" de "o que está acontecendo".

## 6. Assinaturas

Duas, e apenas duas. Uma estrutural e uma atmosférica.

### 6.1 Linha de break-even (estrutural)

Gestor de tráfego não decide olhando valor absoluto. Decide olhando se está acima ou abaixo do ponto de equilíbrio.

Todo gráfico temporal de ROAS, CPA ou Lucro carrega uma **linha horizontal tracejada de break-even** (`ReferenceLine` do Recharts). A área acima da linha é preenchida com `success` a 12% de opacidade; abaixo, com `danger` a 12%. A linha usa `border` com traço `4 4` e rótulo `micro` na ponta direita.

Onde o valor é escalar e não série temporal — KPI, célula de tabela — a mesma lógica vira `<BreakEvenBar>`: barra de 3px sob o número, com entalhe marcando o equilíbrio, preenchida em `success` ou `danger` conforme o lado.

O break-even é configurável por produto na tela de Taxas e Despesas, e deriva do custo real do produto mais taxas de gateway.

### 6.2 Glow de Live Data (atmosférica)

Brilho sutil em ciano, exclusivo de elementos que representam dado chegando em tempo real. É o que faz a plataforma parecer viva sem virar enfeite.

```css
--glow-live:
  0 0 0 1px color-mix(in oklch, #22D3EE 22%, transparent),
  0 0 14px -3px color-mix(in oklch, #22D3EE 38%, transparent);
```

**Lista fechada de onde pode aparecer.** Qualquer uso fora desta lista é erro:

1. `LiveIndicator` — ponto pulsante de sincronização ativa
2. Linha de evento entrando na Atividade Recente, nos primeiros 2 segundos
3. Card de webhook no momento em que dispara
4. Card de regra durante a execução
5. Indicador de CAPI enviando evento
6. Linha selecionada de tabela (variante sem pulso, só o anel)

Intensidade máxima 40% de opacidade. Nunca em elemento estático. Nunca em card inteiro que não represente dado vivo. `prefers-reduced-motion: reduce` remove o pulso e mantém apenas o anel.

## 7. Tipografia

- **UI, títulos, rótulos:** `Instrument Sans` (Google Fonts). Estreita, boa cor de texto em corpo pequeno, e não é Inter — que é o default de todo dashboard.
- **Números em grade, IDs, timestamps, códigos:** `JetBrains Mono`. Alinhamento vertical perfeito numa tabela de 20 colunas e a voz de terminal que a ferramenta merece.
- **KPI hero:** `Instrument Sans` com `font-variant-numeric: tabular-nums`. Mono em corpo 30px fica largo demais.

| Token | Tamanho/Altura | Peso | Uso |
|---|---|---|---|
| `display` | 28/34, `-0.02em` | 600 | título de página (desce de 48) |
| `metric-xl` | 30/34, tabular | 600 | número principal de KPI |
| `metric-md` | 20/26, tabular | 600 | número secundário |
| `title` | 15/20 | 600 | **título de card — o nível que falta hoje** |
| `body` | 14/20 | 400 | texto corrente |
| `label` | 13/18 | 500 | rótulo de campo e de KPI |
| `caption` | 12/16 | 400 | apoio, metadado |
| `micro` | 11/14, `+0.04em`, maiúscula | 500 | **restrito** |

**Regra dura:** `micro` maiúscula só existe em dois lugares — cabeçalho de tabela e eyebrow de seção. Rótulo de KPI e de filtro passam a `label` em caixa de frase. Isso sozinho resolve metade do problema visual atual.

## 8. Espaçamento, raio, elevação, movimento

Base 4px. Padding de card: 16px compacto, 20px padrão. Gap de grid: 12px compacto, 16px padrão.

Raio: `6px` controles · `10px` cards · `14px` painéis e modais · `999px` pills.

Elevação em tema escuro se faz com **cor, não com sombra**: `background` → `surface` → `surface-hover`. Sombra existe apenas em overlay (popover, dropdown, modal, toast): `0 8px 24px -4px rgb(0 0 0 / .55)`.

Movimento padrão `150ms cubic-bezier(.2,0,0,1)`. Só três momentos merecem animação: pulso do `LiveIndicator`, hover de linha de tabela, entrada de painel lateral. Sem número contando, sem gráfico redesenhando a cada render, sem parallax. `prefers-reduced-motion: reduce` desliga tudo.

## 9. Arquitetura de navegação (reconstruída do zero)

**Rail lateral, 56px, expande para 240px.** Só ícone em repouso com rótulo em tooltip; expande no hover e pode ser fixado, com estado em `localStorage`. Fundo `background-alt`. Topo: logo TrackHub com o gradiente da marca. Abaixo: seletor de área. Meio: navegação. Rodapé: conta e perfil.

Item ativo: barra de 2px em `primary` na borda esquerda, fundo `surface-hover`, texto `text`. Nunca fundo azul sólido.

**Barra de contexto, 48px, no lugar do header.** Funde o que hoje são duas faixas: nome da tela à esquerda em `title`, filtros globais no centro (período, conta, produto, fonte), `LiveIndicator` com timestamp de última sincronização à direita, junto de notificações, tema e densidade. Devolve cerca de 100px de altura útil em todas as telas. **O título de página de 48px é removido** — consome altura e não informa nada que o item ativo do rail já não informe.

**Filtros globais na URL** como query params, via hook `useGlobalFilters`. Trocar de tela preserva. A URL é compartilhável.

**Command palette (`⌘K` / `Ctrl+K`).** Navegar entre telas, pular direto para campanha ou criativo pelo nome, trocar período, executar ações rápidas. Agrupada por seção, com atalho visível à direita de cada item. Para quem usa a ferramenta o dia inteiro, substitui metade da navegação por mouse.

**A barra flutuante de dez ícones no canto inferior direito é removida.** O que for útil migra para a command palette ou para a barra de contexto.

**Densidade** é preferência global em três níveis (compacto / padrão / confortável), alterando altura de linha, padding de card e escala de fonte de dado. Padrão: compacto.

## 10. Inventário de componentes

**Primitivos** (reestilizar os do shadcn, não recriar): Button, Input, Select, Combobox, Switch, Checkbox, Radio, Badge, Card, Tooltip, Popover, Dropdown, Tabs, Sheet, Dialog, Toast, Skeleton, Separator, ScrollArea.

**De domínio** (novos, e é onde está o valor real):

| Componente | Responsabilidade |
|---|---|
| `MetricCard` | rótulo, número, delta, sparkline, `BreakEvenBar`, tooltip com a fórmula |
| `DeltaValue` | variação com seta e cor, **com semântica invertível**: em Gasto e CPA, cair é bom e portanto verde |
| `BreakEvenBar` | barra escalar com entalhe de equilíbrio |
| `DataTable` | coluna fixa à esquerda, densidade, ordenação, seleção, rodapé de totais fixo, seletor de colunas, estado vazio |
| `ChannelBadge` | plataforma com ícone e cor de canal |
| `StatusPill` | ativo / pausado / pendente / erro |
| `FunnelChart` | funil com queda percentual por etapa e destaque do maior vazamento |
| `SourceAttribution` | os pontos "vem do Facebook / medido pela TrackHub / calculado" — hoje é legenda solta, vira componente com tooltip explicando a divergência |
| `AlertCard` | alerta acionável com severidade e ação direta |
| `CreativeCard` | miniatura de criativo com métricas e ranking |
| `RuleBuilder` | editor de regra em nós (Quando → E → Então) |
| `EmptyState` | ilustração, uma frase de direção e um botão |
| `CommandPalette` | ⌘K |
| `LiveIndicator` | ponto pulsante com glow de Live Data e timestamp |

## 11. Voz da interface

Português do Brasil, frase em caixa baixa, verbo ativo, sem ponto final em rótulo.

Nomear pelo que o usuário controla, não pela implementação: *"Recebimento de vendas"*, não *"Configuração de webhook"*.

O botão diz o que acontece: **Salvar regra**, não *Enviar*. A confirmação usa a mesma palavra: *Regra salva*.

Erro explica o que houve e como resolver, sem pedir desculpa e sem vaguidão. Ruim: *"Erro ao carregar dados"*. Bom: *"A conta CA 2 MARIA não sincroniza desde 14h. Reconectar conta"*.

Tela vazia é convite para agir, nunca constatação de ausência. Ruim: *"Nenhuma chave criada ainda"*. Bom: *"Conecte seu gateway para as vendas chegarem aqui em tempo real"* + botão + link para o passo a passo.

Termos do ofício se mantêm — ROAS, CPA, CTR, ICs, escalar — porque são o vocabulário real do usuário. O que precisa de explicação ganha tooltip com a fórmula, não uma renomeação didática.

## 12. Piso de qualidade

- Contraste AA: 4.5:1 em texto corrente, 3:1 em texto grande e em elemento gráfico portador de informação.
- Cor nunca é o único portador de significado: variação leva seta, status leva ícone, série leva rótulo.
- Foco visível por teclado em todo elemento interativo, em `primary` com offset de 2px.
- Toda tabela navegável por teclado; toda modal com trap de foco e fechamento por `Esc`.
- Todo estado assíncrono com os quatro casos desenhados: carregando (skeleton no formato do conteúdo real, nunca spinner de tela cheia), vazio, erro, sucesso.
- Funciona de 1280px a 2560px. Conteúdo limitado a 1600px em telas ultrawide, para o KPI não esticar até virar faixa.
- Zero cor hexadecimal escrita direto em componente. Tudo por token.
- Zero ocorrência do nome "Traffik" em qualquer arquivo.

## 13. Como trabalhar neste repositório

- Uma fase por branch, uma fase por PR. Não emendar fases.
- Não alterar lógica de dados, chamada de API, cálculo de métrica ou schema. Este trabalho é exclusivamente camada visual e estrutura de layout. Se um cálculo parecer errado, anotar e seguir.
- Antes de criar componente, procurar se já existe. Reestilizar vence recriar.
- Ao terminar cada fase, rodar `npx tsc --noEmit` e o build. Reportar diff de contagem de cores hardcoded.
- Ao final de cada fase, listar em uma frase cada decisão tomada que não estava especificada aqui.