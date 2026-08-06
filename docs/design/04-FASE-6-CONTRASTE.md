# Fase 6 — o que o TEMA CLARO já deve, medido na Fase 1

> ## ✅ FEITA em 05/08/2026 — as cinco foram CORRIGIDAS
>
> A Fase 6 subiu na fila e foi executada **antes da Fase 2**, por decisão do
> usuário: 3 das 7 telas de referência são de tema claro, então ele não é modo
> secundário, e um primitivo que nasce certo só no escuro é o padrão do detector
> congelado — quebraria no claro meses depois, sem nada acusar.
>
> | Token | era | é | pior fundo antes | agora |
> |---|---|---|---|---|
> | `text-muted` | `#94A3B8` | **`#637184`** | 2.34:1 | **4.56:1** |
> | `text-secondary` | `#64748B` | **`#505F75`** | 4.34:1 | **5.91:1** |
> | `warning` | `#D97706` | **`#AA5B00`** | 2.91:1 | **4.57:1** |
> | `success` | `#16A34A` | **`#008136`** | 3.01:1 | **4.56:1** |
> | `danger` | `#DC2626` | **`#D92223`** | 4.41:1 | **4.56:1** |
>
> As cinco **saíram de `ACEITOS`** no `scripts/teste-contraste.mjs`. Não há mais
> exceção de tema claro para elas caírem: se alguma reaparecer, é regressão.
>
> ⚠️ **O custo é real e foi aceito:** no tema claro o âmbar deixa de ser vivo e o
> verde deixa de ser brilhante. O matiz é o mesmo; o croma só desceu o que a gama
> do sRGB obrigou — não existe verde ou âmbar ao mesmo tempo escuro e saturado em
> sRGB. Não é calibragem tímida, é o que 4.5:1 sobre branco permite.
>
> ### 🔴 As DUAS previsões deste documento que estavam ERRADAS
>
> Ambas só apareceram ao medir. Seguir o plano escrito aqui teria produzido uma
> correção que não corrige e uma que inverte a hierarquia.
>
> **1. "Escurecer o `surface-hover` salva os dois marginais" — é ao contrário.**
> Fundo mais escuro *reduz* o contraste de texto escuro; é exatamente por isso que
> `text-secondary` e `danger` reprovavam sobre `surface-hover` (`#F1F5F9`) e
> passavam sobre `surface` (`#FFFFFF`). O que ajudaria seria **clarear**, e medido
> custa caro demais:
>
> | `surface-hover` | text-secondary | danger | distinção do `surface` (#FFF) |
> |---|---|---|---|
> | `#F1F5F9` (hoje) | 4.34 | 4.41 | 1.096:1 |
> | `#F5F8FB` | 4.46 | 4.53 | 1.066:1 |
> | `#F7F9FC` | 4.51 | 4.58 | 1.055:1 |
>
> O hover teria de quase sumir. Rejeitado — os dois textos desceram, e desceram
> pouco (`danger` mudou 0.008 de luminosidade).
>
> **2. A hierarquia do claro NÃO CABIA — e isto muda a forma da correção.**
> `text-muted` precisava ir a L **0.5427** para chegar a 4.5:1. Só que
> `text-secondary` valia L **0.5544**: corrigir o muted sozinho o deixaria **mais
> forte que o secondary**, invertendo os dois níveis em silêncio — cada um
> passando no teste, e a escada de leitura de cabeça para baixo.
>
> Então o secondary desceu junto, para o lugar que o próprio sistema já definia:
> o degrau entre secondary e muted no tema **escuro** é 0.0607 de L. O claro
> passou a usar o mesmo degrau (0.5427 − 0.0607 = 0.4820), e a diferença
> percebida entre os dois níveis ficou igual nos dois temas.
>
> É a mesma forma do achado "um azul só não pode ser texto E fundo de botão":
> **corrigir um token isolado quando o vizinho define o significado dele produz um
> número certo e um sistema errado.**
>
> ### O que continua valendo deste documento
>
> As **duas exceções do tema escuro** (`primary` 4.12 e `danger` 4.03 sobre
> `surface-hover`) seguem em `ACEITOS`, com piso, por decisão de 05/08/2026. Não
> foram tocadas. E a regra do `accent` (§ "o par não existe") segue de pé — a
> verificação dela agora tem lugar: o Badge da Fase 2 não expõe prop de cor de
> texto, e não existe tom de canal nele.

---


> Escrito em 05/08/2026, no fim da Fase 1, **antes** de a Fase 6 começar. O
> motivo de existir agora e não lá: estes números já foram levantados uma vez, e
> sem um registro alguém os "descobre" de novo daqui a cinco fases e gasta a
> sessão inteira achando que achou um bug. Não é bug — é dívida datada, aceita
> com a decisão de 05/08/2026.
>
> Rode `npm run test:contraste` para o número de hoje. Ele lê o `globals.css`, e
> **estas sete linhas estão registradas em `ACEITOS`, com piso**: elas não
> reprovam, mas se qualquer uma PIORAR o teste volta a sair com código 1.

---

## As cinco do tema claro

Todas são texto sobre fundo, e todas reprovam o AA (4.5:1). O pior fundo de cada
uma está na coluna da direita.

| Token | Hoje | Uso | Onde dói |
|---|---|---|---|
| `text-muted` | **2.34:1** | placeholder, metadado, desabilitado | os quatro fundos |
| `warning` | **2.91:1** | limite de orçamento, atenção, pendente | os quatro fundos |
| `success` | **3.01:1** | lucro, variação favorável | os quatro fundos |
| `text-secondary` | **4.34:1** | rótulo e texto de apoio | só sobre `surface-hover` |
| `danger` | **4.41:1** | prejuízo, erro | só sobre `surface-hover` |

### O que já se sabe sobre como corrigir

- **`text-muted` (2.34:1) é o mais grave, e é um erro de simetria.** No claro ele
  vale `#94A3B8` e o `text-secondary` vale `#64748B` — ou seja, os dois valores
  do tema escuro **trocados**. A troca está certa em intenção (no claro, mais
  claro = mais fraco), mas `#94A3B8` sobre branco não chega perto de AA. A
  correção provavelmente é descer os dois um degrau na rampa slate, e não trocar
  a rampa.

- **`success` e `warning` precisam do mesmo tratamento que o `warning` já
  recebeu.** O âmbar já tinha descido de `#F59E0B` para `#D97706` na
  especificação, justamente por reprovar sobre branco — e ainda não bastou. O
  verde `#16A34A` nunca desceu. Os dois são **texto** (um número de lucro, um
  aviso de teto), não enfeite.

- **`text-secondary` e `danger` reprovam só sobre `surface-hover`.** São os dois
  marginais do claro. Podem sair de graça se o `surface-hover` do claro
  (`#F1F5F9`) escurecer um pouco — o que resolveria os dois de uma vez sem
  mexer em cor de texto nenhuma. **Meça antes de mexer nos tokens de texto.**

---

## As duas do tema ESCURO que ficaram (decisão, não pendência)

| Token | Hoje | Por que fica |
|---|---|---|
| `primary` sobre `surface-hover` | 4.12:1 | marginal; mexer mudaria a identidade por pouco ganho |
| `danger` sobre `surface`/`surface-hover` | 4.03:1 | idem — e hover não é onde se lê texto longo |

Decisão do usuário em 05/08/2026. **Não "corrija" na Fase 6 achando que passou
batido.** Se for reabrir, reabra de propósito.

---

## O que NÃO está nesta lista, e por quê

### `accent` como texto — o par não existe

O teste media `accent` como cor de texto e ele reprovava feio no claro
(**2.22:1**, `#06B6D4` sobre branco). O par foi **removido**, e a remoção é uma
decisão de sistema, não um jeito de deixar o teste verde:

> ⛔ **`accent` não é cor de texto.** Ele é série primária de gráfico, indicador
> de dado ao vivo e seleção — objeto gráfico, cujo critério é 3:1 (WCAG 1.4.11).
> Quando houver rótulo SOBRE um preenchimento de accent, a cor é
> `--tk-on-accent` (7.35:1 no claro, 10.77:1 no escuro), nunca `text` ou
> `background` escolhidos na hora.

⚠️ **Esta regra tem de estar escrita porque o tema escuro não a força.** Lá o
accent rende 9.33:1 como texto e passaria despercebido. Quem o usasse como cor de
texto na Fase 4 veria tudo certo no escuro e quebraria o claro — e o defeito só
apareceria quando alguém trocasse de tema. É o padrão do detector congelado.

**A verificação da Fase 6 é essa:** varrer os componentes das Fases 2 a 5
procurando `text-accent` / `color: var(--tk-accent)` em texto. Se aparecer, ou o
uso está errado ou esta regra está errada — e as duas coisas precisam de decisão,
não de um ajuste de token.

### `text` sobre `primary` — o par também não existe

Media-se `text` (quase preto no claro) sobre o azul do botão: 2.66:1. Ninguém
desenha um botão azul com rótulo quase preto. O par certo é `on-primary` sobre
`primary-solid`, que rende **5.17:1** no claro e **4.94:1** no escuro.

Ver a nota de contraste no `globals.css` para por que o botão sólido ganhou
tokens próprios: **um azul só não pode ser texto E fundo de botão** — o teto de
luminância exigido por um é menor que o piso exigido pelo outro, e o intervalo é
literalmente vazio.

---

## Também em aberto para a Fase 2, não para a Fase 6

**O CTA com `--tk-gradient-brand` não tem cor de rótulo.** O gradiente vai de
azul (`#2563EB`) a ciano (`#22D3EE`), e nenhuma cor de texto atravessa os dois
extremos: rótulo claro morre no ciano, rótulo escuro morre no azul. Decidir ao
desenhar o botão, na Fase 2 — não invente rótulo em gradiente antes disso.
