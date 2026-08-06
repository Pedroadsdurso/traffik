# Fase 1 — decisões de arquitetura tomadas ANTES de escrever o CSS

> Escrito em 05/08/2026, durante a Fase 1. As quatro primeiras foram **provadas
> contra este código**, não deduzidas do roteiro — e são o que evita que a
> fundação nasça brigando com as 21 telas que ainda usam o sistema antigo.

---

## 1. 🔴 O problema central: quatro nomes de token COLIDEM com os legados

O `globals.css` de hoje declara, em `:root, [data-theme="dark"]`, entre outros:

| Legado | Valor hoje | Token novo de mesmo nome | Valor novo |
|---|---|---|---|
| `--color-surface` | `#232532` | `surface` | `#151D2D` |
| `--color-text` | `#e9e9ed` | `text` | `#F8FAFC` |
| `--color-border` | branco a 16% | `border` | `#243044` |
| **`--color-accent`** | **`#9184d9` (roxo)** | **`accent`** | **`#22D3EE` (ciano)** |

As três primeiras são quase equivalentes. **A quarta é uma inversão de
significado:** o `--color-accent` legado é o que hoje pinta botão, link, item
ativo e foco — ou seja, ele é o `primary` do sistema novo. No sistema novo,
`accent` é ciano e é **proibido** em botão e em navegação.

Redefinir `--color-accent` para o azul faria a aplicação inteira virar azul num
commit — e as rampas `--color-accent-100..900` continuariam roxas, porque são
outra variável. O resultado não seria "o redesign começou": seria uma tela com
botão azul e selo roxo, sem ninguém ter olhado nenhuma das 21 rotas.

## 2. ✅ A saída: `@theme inline` isola os dois sistemas — e isso foi TESTADO

Os tokens novos vivem sob o prefixo **`--tk-*`**. O `@theme` do Tailwind 4 os
mapeia por referência:

```css
@theme inline {
  --color-surface: var(--tk-surface);
}
```

**O que o `inline` muda, medido rodando o PostCSS contra este projeto:**

```
.bg-surface { background-color: var(--tk-surface); }   ← e NÃO var(--color-surface)
```

Sem o `inline`, o utilitário sairia como `var(--color-surface)` — que o bloco
legado, por vir **depois** do `@import "tailwindcss"` no arquivo, sobrescreve
para `#232532`. Ou seja: **sem o `inline`, todo utilitário novo pintaria com a
cor antiga, em silêncio.** É o modo de falha preferido desta base — plausível,
errado, e sem `tsc`/`lint`/`build` acusar.

Com o `inline`, os dois sistemas convivem sem se tocar:

| Quem consome | Resolve para |
|---|---|
| Código legado: `var(--color-surface)` | `#232532` (legado, intacto) |
| Componente novo: `class="bg-surface"` | `var(--tk-surface)` (novo) |

> ⚠️ O `@theme inline` **ainda emite** `--color-surface: var(--tk-surface)` em
> `:root`. Ele é inofensivo aqui só porque o bloco legado vem depois no arquivo e
> vence pela ordem da cascata. **Mover o bloco legado para antes do `@import`
> inverteria isso e trocaria a cor de todas as telas antigas.** Não mova.

## 3. Nomes de utilitário — duas divergências do roteiro, com motivo

| Roteiro | Aqui | Por quê |
|---|---|---|
| `text-secondary` | **`text-text-secondary`** | ver abaixo |
| `tailwind.config.ts` | **`@theme` no CSS** | Tailwind 4 é configurado por CSS; **não existe `tailwind.config.ts` neste projeto** e criar um seria uma segunda fonte de verdade |

**Sobre `text-secondary`:** para o utilitário se chamar assim, o token teria de
ser `--color-secondary` — e aí `bg-secondary` passaria a existir e a significar
"fundo com a cor do texto de apoio", que é errado. Pior: `.text-muted` **já é uma
classe legada do `globals.css`**, usada em ~20 arquivos; um utilitário homônimo
gerado pelo Tailwind colidiria com ela e o vencedor seria decidido pela ordem do
arquivo. Os tokens ficam `--color-text`, `--color-text-secondary`,
`--color-text-muted`, e os utilitários saem `text-text-secondary`. Verboso e
inequívoco — e uma via só, nunca duas.

## 4. A fonte do body NÃO muda nesta fase

O `next/font` registra Instrument Sans e JetBrains Mono e expõe `--font-sans` /
`--font-mono` no `<html>`. Mas o `body` continua em `var(--font-body)` (Inter).

Trocar a fonte do body reflui **todas as 21 rotas** de uma vez, num dashboard
denso, sem que ninguém tenha olhado nenhuma delas — é "tocar em tela existente"
pela porta dos fundos. Quem consome as fontes novas nesta fase é só o
`/design-system`. **A troca do body é da Fase 3**, junto com o shell que a
verifica.

## 5. O teste de contraste lê o CSS, não uma cópia dos hexadecimais

A conversão OKLCH→sRGB existe para que o teste afira **o valor que a página
pinta**, e não os hexadecimais que ficam no comentário ao lado. Se as duas coisas
divergirem um dia, quem tem de estar certo é o CSS — e o teste **denuncia a
divergência** em vez de escolher em silêncio.

> ⚠️ **Correção sobre o arquivo:** a conta mora em **`src/lib/cor.ts`**, e não em
> `scripts/cor.mjs` como esta seção dizia antes. O motivo é a regra "duas
> implementações da mesma conta divergem sempre": são **dois** consumidores —
> `scripts/teste-contraste.mjs` e a própria página `/design-system`, que exibe as
> razões na tela. Em `scripts/`, a página teria de reimplementar a conta, e as
> duas passariam a poder discordar sem ninguém perceber. Os testes já importam do
> `src/` pelo `alias-loader.mjs`; foi só usar o caminho que já existia.

---

## 6. 🔴 O OKLCH que eu escrevo NÃO é o que o navegador recebe

Descoberto ao conferir o bundle, não deduzido: o **Lightning CSS** (o
transformador do Next) transpila `oklch()` em duas saídas —

```css
:root, [data-theme="dark"] { --tk-surface: #151d2d; }              /* fallback */
@supports (color: lab(0% 0 0)) {
  :root, [data-theme="dark"] { --tk-surface: lab(10.6025% .398137 -12.0584); }
}
```

No Chrome vale o ramo do `lab()`. Isso tem duas consequências práticas:

1. **`getComputedStyle` devolve `lab(...)`, nunca `oklch(...)`.** A primeira
   versão da `/design-system` parseava `oklch` e teria exibido "não resolveu" em
   todos os tokens. Hoje ela **rasteriza num canvas de 1×1**: o pixel é o que a
   tela pinta, seja qual for a sintaxe que o navegador aceite.
2. **Comparar strings de cor não mede nada.** `lab(...)` e `rgb(...)` nunca são
   iguais como texto, então a verificação de isolação passaria **sempre**, por
   diferença de formato, sem nunca ter olhado a cor. É a regra "uma asserção
   precisa poder falhar pelo motivo que ela alega medir".

✅ **Conferido:** os 21 hexadecimais que o Lightning CSS emitiu batem com os que
`lib/cor.ts` calcula a partir do OKLCH — **0 divergências**. As duas conversões
concordam, o que também valida a que o teste de contraste usa.

## 7. O `<html>` herda a fonte nova; o `<body>` NÃO

Efeito colateral do `@theme inline` que vale registrar, porque parece um
descumprimento da §4 e não é. O `@theme` mapeia `--font-sans: var(--tk-font-sans)`,
e o preflight do Tailwind aplica `html { font-family: var(--default-font-family) }`,
que resolve para `--font-sans`. Então:

| Elemento | Fonte |
|---|---|
| `<html>` | Instrument Sans |
| **`<body>` e tudo dentro dele** | **Inter** (`var(--font-body)`, intocado) |

Medido no navegador: `getComputedStyle(document.body).fontFamily` →
`Inter, system-ui, sans-serif`. Como todo conteúdo mora dentro do `body`, **nada
na tela mudou de fonte**. A troca continua sendo da Fase 3.

---

## Estado da Fase 1 ao fim desta sessão

Nenhuma tela existente foi alterada — é o critério da própria fase, e a
arquitetura da §2 é o que o torna verificável em vez de otimista. **Verificado no
navegador**, na `/dashboard` real, e não só no build:

| O que se checou | Resultado |
|---|---|
| `--color-bg`, `--color-surface`, `--color-text`, `--color-accent`, `--color-accent-500` | os 5 legados **idênticos** ao que eram |
| fonte do `body` | `Inter, system-ui, sans-serif` |
| tamanho e fundo do `body` | `15px` · `#161826` |
| `data-density` vazando para outras rotas | **não** (o efeito limpa na saída) |
| `bg-surface` × legado, em pixel | `#151D2D` × `#232532` — isolados |

---

## 7b. ⚠️ "Densidade" já significa OUTRA COISA nesta base

Achado ao abrir a Fase 2, e precisa ser resolvido **antes** de qualquer primitivo
consumir a variável errada. Existem dois conceitos com o mesmo nome:

| | `[data-density]` (Fase 1) | `useDensidade.ts` (já existia) |
|---|---|---|
| O que é | **preferência do usuário**, global | **adaptação ao tamanho do bloco** |
| Valores | `compact` / `default` / `comfortable` | `xs` / `sm` / `md` |
| Quem decide | a pessoa, na barra de contexto | um `ResizeObserver` no próprio bloco |
| Por que existe | conforto de leitura | o grid é redimensionável, e nenhum breakpoint de JANELA descreve o espaço de um bloco |

Os dois são legítimos e **não se substituem**: um bloco estreito precisa
simplificar mesmo que o usuário tenha pedido "confortável". Mas com o mesmo nome,
a chance de alguém ler um e aplicar o outro é alta — e o erro seria silencioso,
porque as duas coisas mexem em tamanho.

**Decisão para a Fase 2:** o `useDensidade` passa a se chamar pelo que ele mede —
o espaço do bloco —, e "densidade" fica reservado para a preferência do usuário.
Renomeação de código nosso, sem contrato externo, o que a §1 dos critérios já
permite.

---

## 8. Contraste: as correções aprovadas, e por que o botão ganhou tokens

Aprovado em 05/08/2026, **depois** do relatório. Duas correções, três recusas
deliberadas e uma reclassificação.

### ✅ Corrigido — `primary` não podia ser as duas coisas

O rótulo do botão rendia **3.52:1**. A saída não foi escolher entre clarear o
rótulo ou escurecer o azul: **nenhuma das duas resolve sozinha**, e dá para
provar em três linhas —

| exigência | luminância |
|---|---|
| rótulo `#F8FAFC` legível EM CIMA dele | ≤ **0.1730** |
| legível COMO texto sobre `background` | ≥ **0.1928** |
| legível COMO texto sobre `surface` | ≥ **0.2302** |

O teto é menor que o piso: **o intervalo é vazio.** Daí os tokens novos —
`primary-solid` (#2563EB) + `on-primary` → **4.94:1**, e `primary` fica sendo a
cor de texto/link/ícone/estado ativo, onde já rendia 4.59–5.29:1. Nenhum matiz
novo entrou: os dois valores já eram do sistema.

⚠️ **Consequência para a Fase 2:** `bg-primary` **não é botão**. Quem usar
`bg-primary` com rótulo claro reintroduz o 3.52:1 — e o teste reprova, porque o
par medido passou a ser `on-primary` × `primary-solid`.

### ✅ Corrigido — `text-muted`

`#64748B` → `#8090A8` (OKLCH L 0.5544 → 0.6500, croma e matiz intactos).
Reprovava nos **quatro** fundos (3.18–4.09); hoje rende 4.67–6.00 e continua
visivelmente abaixo do `text-secondary`.

### ⛔ Reclassificado — `accent` não é cor de texto

Ele reprovava a 2.22:1 no claro **como texto**, e o par não existe: accent é
série de gráfico, dado ao vivo e seleção — objeto gráfico, critério 3:1. Saiu da
lista de texto do teste, e o rótulo sobre um preenchimento de accent passou a ter
token próprio (`on-accent`: 10.77:1 no escuro, 7.35:1 no claro).

⚠️ **A regra precisou virar texto escrito porque o tema escuro não a força** — lá
accent rende 9.33:1 e passaria despercebido. É o padrão do detector congelado.

### O teste virou um portão que ainda pode falhar

As 7 reprovações restantes (2 marginais do escuro + 5 do claro, que são escopo da
Fase 6) moram em **`ACEITOS`, cada uma com o piso que tinha quando foi aceita**.
Elas não reprovam — mas se **piorarem**, o teste volta a sair com código 1.
Verificado escurecendo o `danger` de propósito: a exceção deixa de valer e a
reprovação aparece. Sem o piso, "aceito" viraria "esse token pode ser qualquer
coisa".
