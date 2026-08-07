# 06 — LINGUAGEM VISUAL

> Este documento existe porque "faça bonito e moderno" não vira código. As quatro referências têm uma linguagem específica e mensurável. Aqui ela está em números.
>
> Vale para **todos os blocos**, sem exceção. Um bloco que não seguir isto está incompleto, não é uma variação de estilo.

---

## ⚖️ PRECEDÊNCIA — quando este documento e a imagem 1 discordam

**Elas discordam, e vai voltar a acontecer nas outras nove telas.** Em 07/08/2026
apareceram três divergências numa sessão só: célula de heatmap (colada na imagem
1, com folga aqui), segmento de rosca (ponta reta lá, arredondada aqui) e ponto
de série. A regra que resolve as três:

| Assunto | Quem vence | Por quê |
|---|---|---|
| **Acabamento** — raio, folga, sombra, textura, movimento, curva | **este documento (`06`)** | veio das referências mais novas (12–15) e é mais específico |
| **Conteúdo e estrutura** — que blocos existem, o que cada um mostra, onde fica | **imagem 1 e o `04`** | a imagem é o inventário; este documento não fala de conteúdo |

⛔ **Não é "o mais novo vence".** É um recorte por ASSUNTO: a imagem 1 continua
sendo a autoridade sobre *o que existe na tela*, e este documento sobre *como
aquilo é desenhado*. Uma divergência de acabamento resolvida pela imagem 1
reintroduz o aspecto cru que este documento existe para tirar; uma divergência de
conteúdo resolvida por aqui inventa bloco que ninguém pediu.

⚠️ E toda divergência resolvida vai **anotada no componente**, com os dois lados.
Sem isso a próxima pessoa lê a imagem 1, acha que o código está errado, e
"corrige" de volta.

---

## ONDE ESTÃO AS QUATRO REFERÊNCIAS — e por que o número é duplo

Elas chegaram ao repositório em 07/08/2026, com nome de download (`preview
(1).webp`). Renomeadas para o padrão do `04`, que numera por posição na pasta.

| Este documento diz | Arquivo | Matiz |
|---|---|---|
| **referência 1** | `referencias/12-linguagem-1-emprestimos-claro.webp` | multicor (é a exceção — ver §10) |
| **referência 2** | `referencias/13-linguagem-2-acru-claro.webp` | verde |
| **referência 3** | `referencias/14-linguagem-3-veselty-claro.webp` | laranja |
| **referência 4** | `referencias/15-linguagem-4-insighta-escuro.webp` | roxo |

⚠️ **O nome carrega os DOIS números de propósito.** A pasta é do `04` e conta
01…15; este documento conta 1…4. Sem o `linguagem-N` no meio, "referência 4"
apontaria para `04-campanhas-claro.png`, que é outra coisa — e o erro seria mudo,
porque as duas são imagens plausíveis de dashboard.

---

## O QUE AS QUATRO REFERÊNCIAS TÊM EM COMUM

Antes das medidas, o que realmente as separa do que temos hoje:

1. **Um matiz de destaque, e só um.** Roxo, laranja, verde — cada produto escolhe um e o repete. Todo o resto é neutro. Não é paleta variada; é disciplina.
2. **O número é o herói.** Grande, pesado, e a variação vem numa **pílula colorida ao lado**, não em texto pequeno embaixo.
3. **Nada tem canto vivo.** Card, barra, célula de heatmap, segmento de rosca — tudo tem raio, inclusive as pontas das barras.
4. **Preenchimento com desvanecimento.** Área de gráfico nunca é cor chapada: é gradiente que some para baixo.
5. **Respiro.** O conteúdo não encosta na borda em lugar nenhum.
6. **Textura carrega significado.** Duas das referências usam hachura listrada para a série secundária — resolve "duas séries" sem inventar uma segunda cor.

---

## 1. CARTÃO

| Propriedade | Valor |
|---|---|
| Raio | **16px** (hoje provavelmente 8–12) |
| Padding interno | **20px** em blocos normais, **24px** nos heros |
| Borda | 1px, cor neutra a ~8% de opacidade — presença, não traço |
| Fundo | um degrau acima do fundo da página, nunca igual |
| Elevação | sombra ampla e fraca: `0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.06)`. No tema escuro, mais fraca ainda |
| Espaço entre cartões | **16px** |

**Cabeçalho do cartão:** rótulo pequeno (13px, peso 500, cor neutra apagada) à esquerda; controles à direita. Título e conteúdo separados por **16px**, nunca colados.

---

## 2. O NÚMERO E A VARIAÇÃO

Isto é o que mais muda a percepção de "profissional", e é barato.

```
  Faturamento                          ← 13px, peso 500, neutro apagado
  R$ 3.636,47   ┃ ↑ 18,6% ┃            ← 32px, peso 600, tracking -0.02em
                                          pílula ao LADO, não embaixo
  vs. período anterior                 ← 12px, neutro apagado
```

**A pílula de variação:**
- Altura 22px, raio **11px** (cápsula completa), padding lateral 8px
- Fundo: cor semântica a 12% de opacidade. Texto: a cor cheia
- Seta ↑ / ↓ dentro da pílula, 12px
- Positivo = cor de lucro · negativo = cor de prejuízo · sem comparação = pílula neutra com "—"

Hoje a variação é texto solto embaixo. Na pílula ela vira um objeto, e é a diferença mais visível entre o nosso KPI e o das referências.

**Número grande:** use fonte tabular. Sem ela, o valor "pula" quando muda no tempo real.

---

## 3. SÉRIES TEMPORAIS (Receita × Gasto, Vendas por dia, sparklines)

| Propriedade | Valor |
|---|---|
| Curva | **monotônica suavizada**, nunca polilinha de vértices duros |
| Traço | 2,5px, ponta arredondada (`stroke-linecap: round`) |
| Área sob a linha | gradiente da cor da série a **18%** no topo até **0%** embaixo |
| Grade | só linhas horizontais, 1px, neutro a 6%. Sem grade vertical |
| Eixo | sem linha de eixo. Só os rótulos |
| Pontos | **depende da densidade** — ver abaixo |

**O PONTO DEPENDE DA DENSIDADE — e não é meio-termo entre as duas opções.**

```
até ~15 pontos  →  VISÍVEIS
acima de 15     →  só no hover
```

> ⚠️ Este parágrafo dizia *"invisíveis por padrão; aparecem no hover"*, e **estava
> errado**. Corrigido em 07/08/2026, por decisão do dono.

O motivo é o do projeto inteiro: **o ponto existe para mostrar ONDE houve
observação.** Com três pontos — que é o dado real de hoje — uma linha lisa parece
medição contínua e esconde que só existem três dias medidos. Com trinta, os
pontos viram ruído e a própria linha já mostra a densidade.

⛔ Não confunda com o marcador de hover. O ponto diz *"houve medição aqui"*; o
marcador diz *"você está olhando para este"*. São perguntas diferentes, e por
isso o marcador aparece nas duas faixas de densidade.

**Série secundária com hachura.** É o achado das referências 2 e 3: o Gasto não precisa de uma segunda cor competindo com a Receita. Ele vira **listra diagonal a 45°** em neutro, sobre fundo transparente. A Receita fica sólida com gradiente, o Gasto fica texturizado. Duas séries, um matiz, zero ambiguidade — e respeita a regra de cor do master.

**O marcador de hover** (referências 3 e 4, e é o detalhe que mais parece caro):
- Linha vertical fina atravessando a área toda
- Uma **alça vertical arredondada** (cápsula de 8px de largura, raio total) sobre a linha, na cor de destaque
- **Pílula flutuante** acima com o valor, fundo sólido escuro, raio 8px, sombra
- Tudo isso segue o cursor com transição de ~120ms

---

## 4. BARRAS (Vendas por horário, Lucro por horário, Vendas por dia)

- **Raio 6px no topo**, ou raio total se a barra for fina. Nunca canto vivo.
- Largura da barra: 60% do passo; 40% de folga.
- Barra de valor negativo desce do zero, com o mesmo raio na base.
- Hover: a barra clareia e a pílula com o valor aparece acima.
- Barra de valor zero: risco de 2px na linha do zero, não ausência total. "Mediu e deu zero" é diferente de "não mediu".

---

## 5. ROSCA (Canais, Status)

| Propriedade | Valor |
|---|---|
| Espessura | 14% do raio — anel fino, não pizza grossa |
| Pontas do segmento | **arredondadas** |
| Folga entre segmentos | 2° de espaço |
| Centro | número grande + rótulo pequeno, centralizados |
| Legenda | à direita, em coluna: ponto colorido · nome · valor · % |

---

## 6. MEDIDOR RADIAL (Taxa de aprovação)

A referência 4 tem a melhor versão disto: o arco é feito de **barras individuais arredondadas**, não de um traço contínuo. Cada barra é um "passo" e as preenchidas ganham a cor de destaque; as vazias ficam neutras.

- Arco de 180° a 240°, aberto embaixo
- 24 a 32 barras, raio total nas pontas, 3px de folga entre elas
- Número grande no centro, rótulo pequeno abaixo
- É mais legível que barra de progresso reta para uma taxa, e resolve o bloco de aprovação sem inventar fita.

---

## 7. HEATMAP (Quando compram)

- Célula com **raio 4px** e **3px de folga** entre células. Grade colada é o que mais faz o nosso parecer cru.
- Célula sem observação: **hachura diagonal** neutra (já implementado, mantém).
- Célula com observação e valor zero: preenchimento no tom mais baixo, visível.
- Legenda em faixa de chips no topo, não régua vertical.
- Hover: a célula ganha contorno de 2px na cor de destaque e a pílula aparece.

---

## 8. TABELAS E LISTAS (Top campanhas, Produtos, Fontes, Pagamentos)

- Linhas com **48px de altura**, sem borda entre elas — separação por espaço e por hover.
- Hover: fundo neutro a 4%, raio 8px, cobrindo a linha inteira.
- Barra de proporção **atrás do texto**, não numa coluna própria: fundo da linha preenchido até o percentual, a 10% de opacidade. É o que a referência 4 faz na lista de audiência, e economiza uma coluna.
- Números alinhados à direita, fonte tabular.
- Rodapé do bloco com "Ver todos →" em 13px na cor de destaque.

---

## 9. O FUNIL

Ver a especificação de fluxo com perdas explícitas já acordada. Sobre acabamento:

- Faixas com curva de Bézier suave, nunca polígono de segmentos retos.
- Fluxo que continua: cor de destaque com gradiente ao longo do percurso.
- Faixa de perda: neutro a 25%, com o rótulo fora da faixa.
- Cabeçalho com **três números grandes** lado a lado, como na referência 1 (`27.8K Opened Request · 67% Engaged · 24% EOI Sent`). Não uma frase corrida.

---

## 10. COR — a regra que reconcilia tudo

As referências parecem coloridas, mas cada uma usa **um matiz só**. Roxo na 4, laranja na 3, verde na 2. Todo o resto é neutro.

Para o TrackHub:

| Papel | Uso |
|---|---|
| **Destaque (azul de marca)** | série principal, elemento ativo, arco preenchido, pílula de hover |
| **Neutro** | série secundária (com hachura), grade, rótulo, faixa de perda, barra vazia |
| **Lucro / prejuízo / atenção** | **exclusivamente** em pílula de variação, valor de lucro e alerta |
| **Cor de canal** | só na rosca de Canais e no ícone de plataforma |

O que faz parecer moderno não é ter muitas cores. É ter **uma**, e usá-la com intenção.

**Nunca:** gradiente arco-íris em área de dado. Na referência 1 ele é decoração num dashboard de crédito; aqui a cor significa dinheiro.

---

## 11. MOVIMENTO

- Transição de entrada dos blocos: 200ms, deslocamento de 4px para cima, escalonado em 30ms por bloco.
- Troca de filtro: o número faz **crossfade de ~150ms** — nunca *count-up*. As
  **séries** transicionam o caminho normalmente.

  > ### ⛔ COUNT-UP ESTÁ PROIBIDO, e este parágrafo pedia por ele até 07/08/2026
  >
  > Contar de `R$ 0` até `R$ 3.636` exibe `R$ 1.200`, `R$ 2.400` e uma dezena de
  > valores **que nunca foram verdade**. Quem bate o olho no meio da animação lê
  > um número errado — e numa ferramenta em que o número **é** o produto, isso é
  > a tela afirmando o que não mediu.
  >
  > O crossfade não tem esse problema: em qualquer instante o que está na tela é
  > **ou o valor antigo, ou o novo**. Nunca um terceiro que ninguém calculou.
  >
  > ⚠️ **E a distinção com a série é real, não uma exceção de conveniência.** Uma
  > linha que se move não afirma valor pontual — ela mostra forma. Um número
  > afirma. Por isso o caminho pode transicionar e o dígito não.
  >
  > ⛔ Não "implemente o que faltou" aqui. A ausência é a decisão.
- Hover: 120ms.
- Respeite `prefers-reduced-motion`: sem deslocamento, sem escalonamento. (Não
  há contagem a suprimir — ver acima.)

---

## 12. TEMA CLARO

Não é o escuro invertido:

- Fundo da página cinza levíssimo, **cartão branco** — é o que dá a separação nas referências 2 e 3.
- Sombra mais visível que no escuro (é ela que separa o cartão do fundo).
- Hachura em neutro escuro sobre branco.
- Gradiente de área começa em 12%, não 18% — no claro ele pesa mais.

---

## 📏 MEDIDA QUE PRECISA MANTER PROPORÇÃO NÃO NASCE EM PIXEL

> Regra transversal, e não uma seção de bloco. Ela já apareceu **três vezes** em
> 07/08/2026, sempre com o mesmo formato: um valor fixo em px que estava certo no
> tamanho em que foi escrito e errado em todos os outros.

| Onde | Em pixel daria | O que se usa |
|---|---|---|
| Hachura do Gasto | `patternUnits="objectBoundingBox"` faz o passo da listra **escalar com a área** — a mesma textura com densidades diferentes em dois dias | `userSpaceOnUse` |
| Folga entre barras | `gap` fixo: com 7 dias as barras engordam e a folga some; com 90, o contrário | 40% do **passo**, por dentro do slot |
| Largura da barra do medidor | fixa, as barras se tocam num medidor pequeno e se espalham num grande | comprimento do arco × ocupação |

**A pergunta, antes de escrever qualquer número em px:** *este valor precisa
parecer o mesmo em tamanhos diferentes, ou precisa SER o mesmo?* Espessura de
traço e raio de canto precisam SER; folga, passo e densidade de textura precisam
PARECER — e essas saem de uma fração do contêiner, nunca de um px.

⚠️ O sintoma é sempre o mesmo e é fácil de não ver: **fica bom no tamanho em que
você olhou.** Só aparece quando alguém redimensiona o bloco — que no Dashboard é
o modo de edição, ou seja, o usuário.

---

## 13. ÍCONE EM RECIPIENTE TINGIDO

> Acrescentado em 07/08/2026, por decisão do dono. Estava na **imagem 1** e não
> em nenhuma das doze seções — era detalhe solto de uma referência, que é
> exatamente como um item de acabamento se perde.

Ícone nunca aparece solto sobre o fundo do cartão: ele mora num recipiente
tingido. **São duas formas, e a diferença carrega significado.**

| Forma | Onde | Tingimento | Tamanho |
|---|---|---|---|
| **Círculo** | linha de lista com severidade (Alertas) | pela **severidade** — âmbar, vermelho, azul | 28px, ícone 15px |
| **Quadrado arredondado** (raio 10px) | bloco de estado, cabeçalho de seção | **neutro** | 36px, ícone 18px |

**A regra por trás:** círculo é para o que **classifica uma linha** — ele responde
"que tipo de coisa é esta?", e por isso é tingido pela categoria. Quadrado é para
o que **ilustra um bloco** — decoração honesta, sem afirmar nada, e por isso é
neutro.

⛔ **Quadrado tingido por categoria é o erro a evitar**: parece um selo de estado
e não é. Se o ícone precisa dizer "está com erro", ele é círculo e está numa
linha, não num bloco.

⚠️ O tingimento usa `--tk-tint-*` com o texto em `--tk-on-tint-*`, sempre o par
do mesmo tom. Cor pura sobre tingimento é o par de 3,55:1 que esses tokens
existem para não deixar acontecer.

---

## 14. OS CINCO DA VARREDURA DA IMAGEM 1

> Achados em 07/08/2026 percorrendo a imagem 1 atrás de acabamento que as doze
> seções não cobriam. Todos entram, por decisão do dono.

### 14.1 Controle do cabeçalho do cartão — **UM só**

`Diário ⌄` · `Ver todas ⌄` · `Receita ⌄` são o **mesmo objeto** na imagem 1:
mesma caixa, mesma altura, mesmo chevron, alinhado à direita na linha do título.

Hoje temos **três tratamentos** para isso — `Segmented`, `Segmented` e nada. É o
problema-raiz nº 2 (duas implementações da mesma coisa divergem sempre)
aparecendo na camada de apresentação.

| | |
|---|---|
| Altura | `--tk-altura-controle` |
| Raio | `--tk-radius-controle` |
| Borda | 1px neutra · fundo `surface` |
| Chevron | 14px, `text-muted`, à direita |

### ⚖️ Segmented ou Select? Pela LENTE, não pela estética

```
até 3 opções, FIXAS              →  Segmented, opções visíveis
4 ou mais, ou lista que CRESCE   →  Select com chevron
```

🔧 **A referência usa chevron em tudo, e nós divergimos — por INTERAÇÃO, não por
estética.** Um controle de 2 ou 3 lentes fixas (Diário/Semanal ·
Receita/Vendas/Lucro) não ganha nada escondido atrás de um clique: custa uma
interação para mostrar o que caberia na tela. Já uma lista que cresce — conta de
anúncio, produto — não cabe numa fileira de botões, e aí o chevron é o certo.

A distinção é a mesma que o `Segmented` já documentava: ele troca a **lente**
sobre o mesmo dado; o `Select` escolhe um **valor** de uma lista.

⚠️ **O que NÃO diverge é a caixa.** Os dois têm a mesma altura
(`--tk-altura-controle`), o mesmo raio e o mesmo alinhamento no cabeçalho. A
divergência é de forma do controle, não de métrica.

⛔ **Faça este primeiro dos cinco.** Ele toca três cartões e some com uma
inconsistência em vez de acrescentar um enfeite.

### 14.2 Dois controles de lista, com papéis diferentes

Na imagem 1 a lista de Alertas tem **dois**, e a distinção é por POSIÇÃO:

| Controle | Onde | O que faz |
|---|---|---|
| `Ver todos` | **cabeçalho**, à direita do título | **navega** para outra tela |
| `+ 2 alertas ⌄` | **rodapé**, centrado, com chevron | **expande no lugar** |

⛔ Que a referência os separe por posição é desenho, não acaso. Trocar um pelo
outro promete navegação e entrega expansão — ou o contrário. **Respeite os dois
lugares.**

### 14.3 Carimbo de tempo relativo

À direita da linha, alinhado à **primeira linha do texto** — não centrado
verticalmente. `há 2h`, `há 3h`, `há 1d`, em `text-caption text-muted`.

⚠️ Sempre via `components/tk/Desde.tsx`. `elapsed()` renderizado no servidor mata
a hidratação da árvore inteira — ver o 4º caso do PROCEDIMENTO no `CLAUDE.md`.

### 14.4 Sub-rótulo na célula

`Black Friday 24` com `Google Ads` embaixo, na mesma célula: `text-label` no
principal, `text-caption text-muted` no apoio, sem espaço entre as linhas além do
`line-height`.

Serve para qualificar sem gastar coluna — é o mesmo raciocínio da barra atrás do
texto (§8).

### 14.5 Par valor + qualificador colorido

Repetido quatro vezes no rodapé de estado: `12 Conectadas` + `2 Com erro` em
vermelho · `34` + `2 Em execução` em âmbar · `R$ 18.742,33` + `+12,4%` em verde.

O valor é neutro e grande; o qualificador é pequeno e **só ele** recebe cor
semântica. ⚠️ E a cor obedece a regra do `CLAUDE.md`: só entra em cor semântica o
que É a grandeza semântica. `2 Com erro` é estado, então pode; `12 Conectadas` é
contagem, então não.

---

## ORDEM DE APLICAÇÃO

O que dá mais resultado por linha escrita:

| # | Item | Por quê |
|---|---|---|
| 1 | Pílula de variação nos 4 heros | maior mudança de percepção, menor custo |
| 2 | Raio, padding e sombra do cartão | atinge todos os blocos de uma vez |
| 3 | Curva suave + gradiente de área | as séries são o que mais ocupa a tela |
| 4 | Raio nas barras e nas células do heatmap | remove o aspecto cru |
| 5 | Hachura na série secundária | resolve Receita × Gasto sem segunda cor |
| 6 | Marcador de hover com pílula | é o detalhe que mais parece caro |
| 7 | Barra de proporção atrás do texto nas listas | economiza coluna e moderniza |
| 8 | Medidor radial na aprovação | resolve o bloco mais fraco |
| 9 | Rosca com pontas arredondadas | |
| 10 | Movimento | por último, é o mais fácil de exagerar |

---

## CRITÉRIO DE ACEITE

O teste do cinza continua provando estrutura. Este documento pede outro teste:

> Coloque um print do bloco ao lado do bloco equivalente na referência. Se o nosso parecer um protótipo e o deles um produto, liste qual das doze seções acima não foi aplicada.

E a regra de sempre: nada declarado como feito sem ter sido visto na tela, nos dois temas.