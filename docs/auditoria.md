# Auditoria pré-redesign — 05/08/2026

> **Fase 0, Parte A.** Nenhum arquivo foi modificado para produzir este documento.
>
> Escopo: `src/` inteiro, exceto `src/generated/` (cliente Prisma gerado).
> **204 arquivos** `.ts`/`.tsx`/`.css` analisados.

---

## 0. Os números que importam

| Métrica | Valor | Vira o quê |
|---|---|---|
| **Cores hardcoded** | **310** | é a métrica que vai a **zero** na Fase 1 |
| Tamanhos de fonte distintos | **19** | vira a escala de 8 níveis da seção 7 |
| Rotas (`page`/`layout`) | 21 | |
| Componentes em `src/components/` | 53 | |
| Ocorrências de "Traffik" | 136 | mas **só 29 são texto de tela** — ver §8 |
| Maior arquivo de UI | `useTraffikState.ts`, **1.953 linhas** | |
| Maior view | `PixelView.tsx`, **1.182 linhas** | |

> ⚠️ **310 é o número de partida.** Ele inclui as 94 do `globals.css`, que são a
> definição dos tokens atuais e vão ser **substituídas**, não removidas. O número
> que precisa ir a zero é o de fora do `globals.css`: **216**.

---

## 1. Árvore de rotas

21 arquivos de rota. Todas dinâmicas (`ƒ`) — nenhuma estática.

```
(auth)/login/page.tsx                        · (auth)/signup/page.tsx
dashboard/layout.tsx                         guard de sessão
dashboard/(app)/layout.tsx            168 L  busca ~11 conjuntos de dado em Promise.all
dashboard/(app)/page.tsx                     Dashboard
dashboard/(app)/gerenciador/page.tsx         Gerenciador de Anúncios
dashboard/(app)/criativos/page.tsx           Criativos
dashboard/(app)/regras/page.tsx              Regras
dashboard/(app)/notificacoes/page.tsx        Notificações
dashboard/(app)/taxas/page.tsx               Taxas e Despesas
dashboard/(app)/areas/page.tsx               Áreas de Trabalho
dashboard/(app)/integracoes/layout.tsx       5 sub-abas
dashboard/(app)/integracoes/{anuncios,webhooks,utms,pixel,testes}/page.tsx
dashboard/test-checkout/page.tsx             FORA do grupo (app) — sem shell
dashboard/{facebook,utm}/page.tsx            redirects de rota antiga
```

> As páginas de rota são **finas de propósito** (a maioria com menos de 15 linhas):
> `"use client"; const v = useTraffik(); return <XView v={v} />`. O conteúdo vive
> nas views. **Isso ajuda o redesign:** trocar a tela é trocar a view, não a rota.

---

## 2. Inventário de componentes

**Nenhum shadcn/ui. Nenhum Radix. Nenhum `class-variance-authority`.**
As 53 peças são **100% próprias**, estilizadas com o helper `sx()` (string CSS →
objeto de style) + variáveis CSS. Tailwind 4 está instalado e é usado "só como
base".

### Os primitivos (`ui/`) — 20 arquivos, e são o alvo da Fase 2

| Componente | Linhas | Usos | Nota |
|---|---|---|---|
| `Icone.tsx` | 213 | **88** | mapa de ~60 ícones `lucide-react` em 24×24 |
| `Select.tsx` | 192 | **60** | combobox próprio, com busca a partir de 8 itens |
| `Drawer.tsx` | 122 | 36 | gaveta lateral + `CampoCopiavel` |
| `Checkbox.tsx` | 88 | 31 | |
| `InfoTip.tsx` | 243 | 29 | tooltip ⓘ com fórmula |
| `Secao.tsx` | 77 | 29 | cabeçalho de seção com selo |
| `Modal.tsx` | 79 | 26 | |
| `useOverlay.ts` | — | 4 | 🔴 **preservar o comportamento** — ver §9 |
| `DateRangePicker.tsx` | ~380 | 4 | calendário de intervalo |
| `chartKit.tsx` | ~200 | — | `ChartTooltip`, `ChartEmpty`, `Sparkline`, `Delta` |
| `AreaChart` `BarChart` `Donut` `Funnel` `CountryMap` | ~1.400 somados | — | **SVG à mão, não Recharts** |
| `ListaSelecionavel` `LogoGateway` `SnippetBox` `FiltroPeriodo` `WorkspaceSelect` `BannerPendencias` | — | — | |

> 🔴 **Recharts está no `package.json` e quase não é usado.** Os cinco gráficos
> são SVG escrito à mão. A Fase 4 pede "tema de gráficos Recharts em um único
> arquivo" — isso é **reescrita de gráfico**, não retematização. Ver §9.

### As views — 7 acima de 400 linhas

| View | Linhas | O que faz demais |
|---|---|---|
| `PixelView.tsx` | **1.182** | formulário, preset, script, diagnóstico e lista, tudo num arquivo |
| `TestesView.tsx` | 912 | 6 cards de diagnóstico independentes |
| `rules/RuleDrawer.tsx` | 801 | 4 seções + construtor de condições + prévia |
| `FeesView.tsx` | 692 | 5 blocos de despesa + fuso + imposto |
| `AreasView.tsx` | 619 | |
| `WebhooksView.tsx` | 533 | grade de gateways + credenciais de API |
| `AdsManagerView.tsx` | 491 | 4 abas + drill-down + filtros |

**Zero componentes com uso externo nulo** — a faxina de 05/08 já removeu os
inertes (`EditDashboardDrawer`, `Icon.tsx`).

---

## 3. Cores hardcoded — 310

### Por arquivo (os 8 maiores)

| Qtd | Arquivo |
|---|---|
| **94** | `src/app/globals.css` ← definição dos tokens atuais; será substituída |
| 29 | `ui/CountryMap.tsx` |
| 22 | `views/integracoes/TestesView.tsx` |
| 16 | `ui/chartKit.tsx` |
| 15 | `views/integracoes/PixelView.tsx` |
| 13 | `views/rules/RuleDrawer.tsx` |
| 11 | `BlockContent.tsx` |
| 10 | `ui/Funnel.tsx` |

### As 10 mais repetidas — e elas contam a história do diagnóstico

| Qtd | Valor | O que é |
|---|---|---|
| 36 | `#fbbf24` | âmbar de aviso |
| 33 | `#f87171` | vermelho de erro |
| 17 | `#f59e0b` | **outro** âmbar |
| 13 | `#ef4444` | **outro** vermelho |
| 11 | `#4ade80` | verde |
| 10 | `#a78bfa` | roxo da marca antiga |
| 7 | `#6d5fe0` | **outro** roxo |
| 6 | `#94a3b8` | cinza de texto |
| 5 | `#7c6ce0` | **um terceiro** roxo |
| 4 | `#0f172a` | quase-preto |

> 🔴 **Dois âmbares, dois vermelhos e TRÊS roxos.** Não é só "cor escrita à mão":
> é o mesmo significado com valores diferentes, escolhidos em momentos diferentes.
> É a evidência numérica do problema nº 2 do diagnóstico ("uma cor faz tudo") —
> agravado por ela não ser nem sempre a mesma cor.

---

## 4. Tamanhos de fonte — 19 valores distintos

Os `font-size` aparecem dentro de strings `sx("font-size:12px;...")`, não em
classes. Os mais frequentes são `12px`, `11px` e `13px` — coerente com o
diagnóstico: **a interface vive entre 11 e 13px, e salta direto para o número do
KPI**, sem nível intermediário.

**Vira a escala de 8 níveis da seção 7.** O nível que hoje não existe é o
`title` (15/20, peso 600) — título de card.

---

## 5. Componentes duplicados ou quase iguais

| # | O quê | Situação |
|---|---|---|
| 1 | **`FiltroPeriodo` × `DateRangePicker`** | o primeiro embrulha o segundo; no redesign os dois viram um controle de período na barra de contexto |
| 2 | **`AreaChart` × `BarChart` × `Sparkline`** | três desenhos de série temporal, três implementações de eixo/escala. Viram um só sob o tema Recharts |
| 3 | **`Donut` × `Funnel`** | não são duplicados, mas dividem escala/legenda/tooltip copiados |
| 4 | **`Modal` × `Drawer`** | mesmo `useOverlay`, mesma trava de foco, dois arquivos. Correto manter separados (semânticas diferentes), mas o corpo pode ser compartilhado |
| 5 | **`Secao` × cabeçalho local da `PixelView`** | a `PixelView` tem um `Secao` local de 3 linhas que mapeia para o compartilhado — resíduo de extração |
| 6 | **`ChartEmpty` × `EmptyState` (não existe)** | há estado vazio de gráfico, mas não há `EmptyState` genérico. A Fase 4 cria |

---

## 6. Onde vive o filtro global — 🔴 hoje NÃO está na URL

**`grep useSearchParams src/components/` retorna vazio.**

Os filtros são estado React em `useTraffikState` (`dashPeriod`, `dashAccount`,
`dashProduct`, `dashSource`, `dashFrom`, `dashTo`), providos via
`TraffikContext` a partir do `DashboardShell`.

Consequências, todas relevantes para a Fase 3:

- **Recarregar a página perde o filtro.** O período volta para "Hoje".
- **A URL não é compartilhável.** Não há como mandar "olha este recorte".
- **Trocar de tela preserva** (o contexto sobrevive à navegação entre rotas
  irmãs), então a Fase 3 não perde isso — ganha o resto.
- ⚠️ **A ÁREA já viaja na URL**, mas só nas chamadas de API (`?ws=<id>`), não na
  URL do navegador. `filtrosDaArea`/`mapa.areaValida` valida posse no servidor.
  **O `useGlobalFilters` da Fase 3 precisa preservar esse contrato** — a área vai
  como id e o servidor resolve; nunca as listas de filtro pela URL, senão o
  cliente forja o escopo.

> Decisão deliberada e documentada: o período **não é persistido** ("é filtro de
> sessão, não preferência"). Levá-lo para a URL muda isso — e é o que a Fase 3
> pede. Vale confirmar que é intencional.

---

## 7. Os 10 maiores arquivos

| Linhas | Arquivo | O que faz demais |
|---|---|---|
| 1.953 | `useTraffikState.ts` | **todo** o estado do dashboard: polling de 4 rotas, derivação de KPI, gráficos, feed, áreas, sync manual |
| 1.182 | `views/integracoes/PixelView.tsx` | form + preset + script + diagnóstico + lista |
| 912 | `views/integracoes/TestesView.tsx` | 6 diagnósticos independentes num arquivo |
| 801 | `views/rules/RuleDrawer.tsx` | 4 regiões + construtor de condições + prévia |
| ~760 | `lib/dashboard/metrics.ts` | (lógica, fora do escopo visual) |
| 692 | `views/FeesView.tsx` | 5 blocos de despesa + fuso + imposto de anúncio |
| 619 | `views/AreasView.tsx` | cards + gaveta + exclusão |
| 533 | `views/integracoes/WebhooksView.tsx` | grade de gateway + credenciais |
| 491 | `views/AdsManagerView.tsx` | 4 abas + drill-down + ações em massa |
| 471 | `views/areas/ExcluirAreaDialog.tsx` | prévia + 6 grupos de escolha + confirmação |

---

## 8. "Traffik" — 136 ocorrências, e a maioria NÃO deve ser trocada

A renomeação de **texto** já foi feita em 05/08/2026 (commit `b8e2722`: 64
ocorrências em 37 arquivos, padrão `\bTraffik\b`). O que sobrou é, por categoria:

| Qtd | Categoria | Trocar? |
|---|---|---|
| **73** | **Tipo/hook interno** — `useTraffik`, `TraffikContext`, `TraffikProvider`, `TraffikView`, `TraffikState` | ✅ **sim** — é código nosso, nenhum contrato externo depende |
| **27** | 🔴 **IDENTIFICADOR EMITIDO** — `traffik_track` (cookie), `window.traffikPixel`, `window.traffik`, `traffik_click_id`, `traffikEnvia` | ⛔ **NÃO** — ver abaixo |
| 29 | Texto em string | ⚠️ conferir um a um: parte é rótulo de tela (trocar), parte é nome de cookie dentro de string (não) |
| 4 | Comentário | ✅ sim |
| 2 | Outro | ⚠️ conferir |

> ### ⛔ Os 27 identificadores NÃO podem ser trocados
> **Regra permanente deste projeto: nenhum identificador já emitido muda de
> significado.** O cookie `traffik_track` e o global `window.traffikPixel` estão
> **no HTML dos sites dos clientes**, dentro de snippets já colados. Renomeá-los
> quebra todo rastreamento instalado, em silêncio — o site continua no ar, o
> script continua rodando, e o dado para de chegar.
>
> O critério de aceite do roteiro (*"`grep -ri traffik` retorna vazio"*) **não é
> alcançável sem quebrar produção**, e não deve ser perseguido. O alvo correto é:
> zero ocorrências em **texto de interface, metadado, nome de pacote e nome de
> componente**.
>
> ⚠️ E o `\bTraffik\b` sensível a maiúscula é o que protege isso: `traffikPixel`
> e `traffik_track` ficam fora por construção (minúsculas + sem fronteira de
> palavra). **Não troque o padrão por um case-insensitive.**

---

## 9. Os 5 problemas estruturais que mais vão atrapalhar — em ordem

### 1. 🔴 `useTraffikState` é um monolito de 1.953 linhas que TODA tela consome

Um único hook faz polling de 4 rotas, deriva KPIs, monta gráficos, feed, áreas e
sync. Ele é provido por contexto e **18 arquivos dependem dele**.

**Por que atrapalha:** a Fase 5 reconstrói tela por tela, mas toda tela puxa o
mesmo objeto gigante. Trocar a forma de um dado para a tela nova mexe no hook, e
o hook serve as outras seis telas ao mesmo tempo. **Uma tela por PR fica difícil
de isolar.**

**Sugestão:** na Fase 3, ao criar o shell, extrair do hook apenas o que o shell
precisa (filtros globais → `useGlobalFilters`, área ativa, live/sync). Deixar o
resto intacto. Cada tela da Fase 5 então consome o hook antigo **ou** um seletor
próprio, sem obrigar refatoração global.

### 2. 🔴 Os gráficos são SVG à mão, não Recharts

`AreaChart`, `BarChart`, `Donut`, `Funnel` e `CountryMap` são ~1.400 linhas de SVG
com escala, eixo e tooltip escritos à mão. O `CountryMap` usa `d3-geo` e uma base
de paths pré-computada de 53 KB.

**Por que atrapalha:** a Fase 4 pede "tema de gráficos Recharts em um único
arquivo" e `BreakEvenChart` como envelope de `AreaChart`/`LineChart` do Recharts.
Isso é **reescrever cinco gráficos**, não retematizar. É a maior fatia de trabalho
não-óbvia do roteiro.

⚠️ E o `CountryMap` tem um motivo registrado para não usar biblioteca:
`react-simple-maps` só suporta React ≤18 e aqui é 19. **Não é candidato a
Recharts** — é um globo ortográfico, não um gráfico cartesiano.

### 3. 🔴 `sx()` + CSS vars é uma fundação incompatível com utilitários Tailwind

Todo estilo é `sx("font-size:12px;color:var(--color-text)")` → objeto `style`
inline. O roteiro assume classes utilitárias (`bg-surface`, `text-secondary`).

**Por que atrapalha:** estilo inline **vence** classe utilitária na cascata. Uma
tela meio-migrada tem `sx()` sobrescrevendo Tailwind de forma imprevisível.

**Sugestão:** a Fase 2 decide isto de uma vez — ou os primitivos novos são 100%
Tailwind (e o `sx()` desaparece deles), ou o `sx()` fica e os tokens são
consumidos por `var()`. **Misturar nos dois sentidos no mesmo componente é o pior
caminho.** Recomendo Tailwind nos componentes novos e `sx()` só no que ainda não
foi migrado, com a fronteira sendo o arquivo inteiro, nunca o elemento.

### 4. ⚠️ Três roxos, dois âmbares e dois vermelhos para os mesmos significados

Ver §3. Não é só dívida de token: são **decisões diferentes tomadas em momentos
diferentes** para a mesma coisa. Ao mapear para os tokens novos, `#fbbf24` e
`#f59e0b` viram os dois `warning` — e é preciso conferir se algum dos dois
significava outra coisa.

### 5. ⚠️ O filtro global não está na URL, e o período não é persistido de propósito

Ver §6. A Fase 3 muda os dois comportamentos. O da URL é ganho puro; o da
persistência do período **contraria uma decisão deliberada** ("filtro de sessão,
não preferência"). Vale confirmar antes.

---

## 10. O que PRESERVAR — comportamento pago a caro

Não é dívida. É correção que já custou sessão para achar, e o redesign não pode
perder:

| O quê | Por quê |
|---|---|
| 🔴 **`useOverlay`: `onClose` em ref, deps `[aberta]`** | devolver `onClose` às dependências fazia **toda gaveta e modal perder o foco a cada tecla** |
| 🔴 **`useOverlay`: portal no `<body>`** | overlay é `position:fixed`, e qualquer ancestral com `transform` (o `.page-enter`) vira o bloco de contenção — a gaveta abria achatada |
| **`Drawer`/`Modal`: `width: min(Npx, 100%)`** | provado em 430/390/360/320px, 0 de 63 descendentes vazando |
| **Campo de formulário mora na VIEW, não no hook** | cada tecla no hook re-renderiza o dashboard inteiro |
| **`useTamanho` com callback ref + nó em estado** | com `useRef` + deps `[]` o observer nunca anexa quando o gráfico abre vazio |
| **`min-height: 0` em item de flex que precisa ceder** | era a causa do rodapé do funil invisível por semanas |
| **`lib/explicacoes.ts`** | catálogo de tooltips com fórmula e fonte — a Fase 4 pede isso e **já existe** |
| **`ui/Icone` em 24×24** | a convergência de ícones já foi feita; 88 usos |

---

## 11. Duas perguntas que preciso responder antes da Fase 1

1. **`sx()` sai ou fica?** (§9.3) — decide a forma de todo componente das Fases 2
   a 5. Recomendo: Tailwind nos novos, `sx()` só no não-migrado, fronteira por
   arquivo.
2. **Gráficos: Recharts de verdade?** (§9.2) — são 5 gráficos e ~1.400 linhas. O
   `CountryMap` fica fora de qualquer jeito. Recomendo: Recharts para série
   temporal (`AreaChart`, `BarChart`, `Sparkline`, `BreakEvenChart`) e manter
   `Donut`, `Funnel` e `CountryMap` como SVG próprio, retematizados por token.
