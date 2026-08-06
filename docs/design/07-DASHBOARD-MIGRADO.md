# Dashboard migrado — a primeira tela real do redesign

> 05/08/2026. A ordem do roteiro mudou por decisão do usuário: a Fase 2 parou com
> 10 primitivos e o trabalho passou a ser **tela**, não fundação. Este é o
> registro da primeira migração de verdade.

---

## 🌉 `.tk-tema` — a ponte, e por que ela existe apesar da Fase 1

A Fase 1 foi construída inteira para que os dois sistemas de token **não se
tocassem**. Esta ponte faz o contrário: dentro dela, os tokens legados
(`--color-*`) resolvem para os valores novos (`--tk-*`).

Não é contradição — é o alvo que mudou. Enquanto o destino era a
`/design-system`, o isolamento era o que se queria. O destino agora é a tela, e o
Dashboard é feito, em boa parte, de componentes compartilhados que ainda não
foram migrados: os **seis gráficos** (`AreaChart`, `Donut`, `Funnel`,
`CountryMap`, `BarChart`, `chartKit`), `Icone`, `InfoTip`, `FiltroPeriodo`. Todos
leem `--color-accent`, que é **roxo**.

Migrar os cards e deixar os gráficos roxos dentro deles produziria a tela do
aviso da Fase 1 ao contrário: *"card azul e gráfico roxo"*.

### ⚠️ A ponte MENTE sobre o progresso, se for confundida com o fim

Quem está dentro dela ganha as **cores** novas e continua com o espaçamento, o
raio e a tipografia antigos até ser reescrito. O jeito de saber se um componente
foi migrado de verdade é ele consumir `--tk-*` ou os primitivos de
`components/tk/` — **nunca "está com a cor certa"**.

### A inversão, resolvida no único lugar onde ela cabia

```css
--color-accent: var(--tk-primary);   /* NÃO var(--tk-accent) */
```

O `--color-accent` legado é quem pinta botão, link, item ativo e foco — ele é o
`primary` do sistema novo. Mapear `accent → accent` pintaria **toda affordance de
ciano** e quebraria a regra dura do sistema numa linha só.

A rampa `--color-accent-100..900` também foi mapeada, e é o que impede o
"botão azul e selo roxo" previsto na Fase 1: o uso real dela nesta base é quase
todo *fundo tingido + texto por cima* (`.tag-accent`, `.opcao-logo`,
`.bloco-alca`, o avatar do rail), então os dois degraus que importam viraram o
**par do selo tingido**, que é medido em AA.

### Ela alcança as 21 rotas — e isso foi escolhido

O shell é um só. Painel com moldura nova e conteúdo antigo tem costura; com
moldura **antiga** e uma tela nova por dentro, a costura é pior — a moldura é o
que se vê primeiro. As outras rotas ficam "cor nova, layout antigo" até serem
migradas uma a uma. Conferido na `/dashboard/taxas`: nada quebrou.

---

## O que foi migrado de verdade (consome `--tk-*` ou primitivo)

| Peça | O que mudou |
|---|---|
| `DashboardShell` | raiz recebe `.tk-tema`; respiro do conteúdo |
| `Sidebar` | `bg-background-alt` (a moldura fica um degrau ABAIXO do card, senão o rail some dentro da tela), item ativo com selo tingido **+ barra à esquerda + `aria-current`**, selo de conexão via `Badge`, avatar tingido |
| `Header` | `.text-display` no lugar do `h1` de 42px, "Ao vivo" virou `Badge tom="accent"` com o glow, contador de não-lidas saiu de `accent` para `danger` |
| `DashboardView` | barra de filtros em `surface`+`border`+raio novo, botões viraram `Button` (com `carregando` de verdade), selos viraram `Badge` |
| `BlockContent` | envelope de bloco deixou a classe `.card` legada, kicker roxo virou `text-micro text-text-secondary`, número do KPI na fonte/peso do sistema **e escalando com `--tk-escala-dado`** |
| `Sidebar` / `AuthShell` | wordmark passou a apontar para `/marca/` — ver abaixo |

### ⚠️ O número do KPI responde a DOIS eixos, e os dois são legítimos

`densidade` (`xs`/`sm`/`md`) mede o **bloco**, por `ResizeObserver`;
`--tk-escala-dado` é a **preferência do usuário**. Um bloco estreito precisa
encolher mesmo que a pessoa tenha pedido "confortável" — é a distinção da
§7b de `03-FASE-1-DECISOES.md`, e agora ela está exercida em código.

---

## 🔴 O wordmark dizia "Traffik" — e o certo já existia, sem consumidor

Achado ao abrir a tela, não ao ler o código. O rail servia
`/logos/traffik-*.webp`, que desenha **"Traffik"** na paleta antiga. O ativo
certo — **"track hub"**, na rampa azul do sistema novo — já estava em
`public/marca/`, gerado por `npm run marca:gerar` e commitado desde `4e6aa9e`,
**apontado por ninguém**.

É o sétimo caso do padrão "pronto não é exercido" desta base, e o mais visível de
todos: era a primeira coisa da tela, e três sessões de redesign passaram por cima
dele sem ver, porque nenhuma delas abriu a ferramenta.

### ⚠️ A convenção de nome INVERTEU entre as duas pastas

| Pasta | O sufixo significa | `claro` = |
|---|---|---|
| `/logos/` (antigo) | a cor das **letras** | letras claras → para fundo escuro |
| `/marca/` (gerado) | o **tema** servido | para o tema claro → letras escuras |

Trocar um pelo outro dá logotipo invisível: letra escura sobre fundo quase preto.
Hoje o mapeamento é direto — `theme === "light" ? wordmark-claro : wordmark-escuro`.

---

## O que NÃO foi tocado, de propósito

- **Lógica, cálculo e schema.** Nenhum. As mudanças são de apresentação.
- **A cor da Área de Trabalho** no seletor do rail é **dado do usuário**
  (`Workspace.color`), não design. Ela aparece roxa hoje porque a área "Principal"
  tem essa cor gravada — mexer nisso seria escrever no banco.
- **Os seis gráficos por dentro.** Eles herdam as cores pela ponte; retematizar
  série por série é a Fase 4.
- **As duas exceções de contraste do tema escuro**, que seguem em `ACEITOS`.

## O que fica para a próxima tela

Os primitivos que faltam — **Tabela, Tabs, Toast, Combobox, DropdownMenu,
ScrollArea** — nascem quando a tela pedir. O Gerenciador de Anúncios é quem vai
pedir a Tabela, e é a candidata natural à próxima migração: é a tela mais densa
da ferramenta e a que mais sofre com os 19 tamanhos de fonte da base antiga.
