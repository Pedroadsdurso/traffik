# As 6 telas de referência × os tokens da Fase 1

> Escrito em 05/08/2026, quando o usuário mostrou as 6 imagens geradas a partir
> do roteiro. Elas passam a ser o alvo visual. Este arquivo é a conferência
> token a token — o que já bate, o que **contradiz a especificação escrita**, e o
> que não existe ainda.
>
> As imagens e o prompt master **discordam entre si** em dois pontos. Isso não é
> detalhe: os dois pontos foram decididos no prompt master **com justificativa
> explícita**, então seguir a imagem é reverter uma decisão. Precisa ser
> escolhido, não adivinhado.

---

## ✅ O que a Fase 1 já entrega e as imagens confirmam

| Nas imagens | Token |
|---|---|
| Fundo quase preto, cards um degrau acima, hover mais um | a escada `background` → `surface` → `surface-hover` |
| Azul em botão, link e item ativo do rail | `primary` / `primary-solid` |
| Ciano em série de gráfico e em "Ao vivo" | `accent` |
| Verde/vermelho nas variações, laranja em "Pausado" | `success` / `warning` / `danger` |
| Logo e CTA "Entrar" com gradiente azul→ciano | `--tk-gradient-brand` |
| Preenchimento de área do gráfico desvanecendo | `--tk-gradient-chart` |
| Título de página ~28px com subtítulo | `.text-display` (28/34) — bate exatamente |
| Números de KPI grandes e tabulares | `.text-metric-xl` |
| Cabeçalho de tabela em caixa alta pequena | `.text-micro` |
| Item ativo do rail: fundo tingido + barra azul à esquerda | previsto no roteiro §9 |
| Tema claro em duas das seis telas | os dois temas já existem |

O tema claro aparecer em 2 de 6 telas **sobe a prioridade da Fase 6**: ele não é
um modo secundário, é metade da vitrine.

---

## 🔴 Conflito 1 — as cores de canal, e a justificativa que se perde

**Na imagem do Dashboard**, o donut "Canais" usa:

| Canal | Na imagem | No prompt master §5 |
|---|---|---|
| Google Ads | **azul** | `#FB923C` laranja |
| Meta Ads | **azul mais escuro** | `#818CF8` índigo |
| TikTok Ads | **ciano** | `#F472B6` rosa |
| Outros | **roxo** | `#64748B` cinza |

O prompt master não só define outras cores — ele **explica por que**:

> *"Meta não é azul e TikTok não é ciano, mesmo sendo essas as cores das marcas:
> azul é `primary` e ciano é `accent` neste sistema. Uma série de Meta em azul
> seria lida como estado ativo da interface, e uma de TikTok em ciano seria lida
> como dado ao vivo."*

A imagem é bonita justamente **porque** usa a rampa da marca — o donut fica
coeso. O custo é que a coesão vem de apagar a fronteira entre "onde eu clico" e
"o que está acontecendo", que é a regra dura do sistema.

**Precisa de decisão.** As opções, honestamente:

| | Consequência |
|---|---|
| **A. Manter a especificação** (índigo/rosa/laranja/cinza) | as telas ficam menos coesas que as imagens; a fronteira azul/ciano sobrevive |
| **B. Seguir a imagem** (rampa da marca) | visual igual ao mockup; `primary` e `accent` deixam de significar só interface, e a regra dura cai |
| **C. Meio-termo** | canais na rampa **só dentro de gráfico**, nunca em selo ou ícone de linha de tabela — mantém a fronteira onde ela é lida como controle |

Eu recomendaria **C**, mas é chamada sua: a regra é do prompt master, não minha.

⚠️ O que **não** dá é decidir isso na Fase 4, quando os gráficos forem
retematizados. Lá o custo já é reescrever série por série.

## 🔴 Conflito 2 — roxo aparece nas imagens e não existe na paleta

Selos de "Analytics" (imagem Snippets) e a fatia "Outros" do donut são **roxos**.
Não há token roxo no sistema — e o roxo era exatamente a cor do design **antigo**
(`--color-accent: #9184d9`), que o redesign está saindo de cima.

Se o roxo entrar, entra como **cor de categoria**, com nome próprio, e nunca
como interface. Se não entrar, os selos de categoria precisam de outra família.

## 🔴 Conflito 3 — o selo tingido não passa em AA, e ele está em TODA tela

Cada KPI das imagens tem um quadradinho de ícone com fundo tingido, e cada selo
(Pixel, CAPI, Ativo, Pausado) é texto colorido sobre o mesmo tom tingido. É o
padrão mais repetido das seis telas.

Medido — **cor pura sobre o próprio tingimento, composto sobre `surface`**:

| | 10% | 14% | 18% |
|---|---|---|---|
| primary · escuro | 4.05 | **3.83** | 3.62 |
| danger · escuro | 4.10 | **3.93** | 3.74 |
| primary · claro | 4.50 | **4.25** | 4.01 |
| danger · claro | 4.14 | **3.88** | 3.64 |
| accent · claro | 2.21 | **2.13** | 2.06 |
| success · claro | 2.95 | **2.82** | 2.69 |
| warning · claro | 2.86 | **2.74** | 2.63 |

Só `accent`, `success` e `warning` **no tema escuro** passam (5.4 a 7.7). Todo o
resto reprova — e no tema claro reprova feio.

**A causa é estrutural, não de calibragem:** quando o texto e o fundo são a mesma
cor, aumentar a saturação do fundo não separa os dois. Nenhuma porcentagem
resolve — a coluna de 10% já mostra que baixar o tingimento quase não move o
número.

A saída é o texto do selo **não** ser a mesma cor do tingimento: um degrau mais
claro no escuro, mais escuro no claro. Isso é um par de tokens novo por cor
semântica (`success` / `success-texto`), e é fundação — **pertence à Fase 1**,
não à Fase 2, porque todo primitivo da Fase 2 vai consumi-lo.

---

---

# ✅ AS DECISÕES — tomadas pelo usuário em 05/08/2026

Os três conflitos acima foram resolvidos, e a resolução está **no `globals.css`,
junto do token**, não só aqui. Documento é onde se explica; o CSS é onde alguém
lê antes de usar.

## Conflito 1 → **opção C, o meio-termo**

Canais **podem** usar a rampa da marca **dentro da área de plotagem e na legenda**
de um gráfico. Fora dali — selo, pill, ponto de status, ícone de linha de tabela,
texto, borda — **não**, e o canal se identifica por nome ou logotipo.

O motivo da fronteira ficar exatamente aí: azul e ciano significam "onde eu
clico" e "o que está acontecendo agora". Dentro do gráfico a cor é o próprio
dado e não há affordance por perto para confundir. Fora dele, a cor é lida como
controle — e é justamente ali que a distinção precisa sobreviver.

✅ **Exercido:** o `Badge` da Fase 2 **não tem tom de canal**, e a ausência está
escrita no arquivo como regra, não como lacuna.

## Conflito 2 → **o roxo entra, com nome próprio e eixo próprio**

`--tk-category` (`#8B5CF6`). Ele responde a uma pergunta que nenhum token
respondia:

| pergunta | dono |
|---|---|
| onde eu clico | `primary` (azul) |
| o que está acontecendo | `accent` (ciano) |
| como está indo | `success` / `warning` / `danger` |
| **que TIPO de coisa é** | **`category` (roxo)** ← o eixo novo |

⛔ Em botão, link, navegação, foco ou estado ativo é **erro** — e um erro que se
disfarça de acerto, porque `#9184d9` era o `--color-accent` do design **antigo**.
Roxo em botão aqui não pareceria uma cor nova: pareceria que o redesign não
aconteceu. `#8B5CF6` é mais saturado e mais frio que o lavanda legado, de
propósito.

## Conflito 3 → **par de tokens na Fase 1, como fundação**

`--tk-tint-*` (fundo) + `--tk-on-tint-*` (texto), sete tons × dois temas. O texto
é um degrau mais claro no escuro e mais escuro no claro, até passar 4.5:1 **sobre
o próprio tingimento, medido nos quatro fundos** — o mesmo selo aparece em card,
em linha de tabela e na barra de contexto.

Ficou na Fase 1 (e não na 2) porque Badge, Card, Button e o KPI da Fase 4
consomem os mesmos dois tokens. Nascendo dentro do Badge, os outros três
chegariam com a cor pura e reprovando.

O pior par era `accent` no claro, a **1.97:1**. Hoje o pior de todos é 4.55:1.

✅ **Exercido e travado:** `npm run test:contraste` mede os 7 tons × 4 fundos × 2
temas, e **lê do CSS** qual token é tingido e a que porcentagem. Verificado que
reprova nos dois sentidos: pôr a cor pura de volta no rótulo → saída 1; mudar o
tingimento de 14% para 45% no CSS → saída 1.

## Conflito 4 (novo, achado ao desenhar o Button) → **o gradiente não preenche botão**

Estava em aberto desde a Fase 1 ("decidir ao desenhar o botão"). A medição fecha:

| rótulo | `#2563EB` (início) | `#3B82F6` (meio) | `#22D3EE` (fim) |
|---|---|---|---|
| claro `#F8FAFC` | 4.94 | **3.52** | **1.73** |
| escuro `#090D14` | **3.76** | 5.29 | 10.77 |

Nenhuma cor atravessa os dois extremos — e o **meio** do gradiente já entrega
3.52:1 ao rótulo claro, que é exatamente o número que a Fase 1 corrigiu. Encurtar
o gradiente não resolve: ele reprova antes de chegar ao ciano.

**Saída:** a variante `cta` põe o gradiente num **anel de 1,5px** e mantém o
interior em `primary-solid`. A assinatura da marca aparece e o rótulo nunca
encosta no ciano. A tela de referência mostra o CTA "Entrar" preenchido de
gradiente — **é o mockup que não passa em AA**, não o componente.

## O logo nas telas → **TrackHub, sempre**

Uma das telas de referência escreve "traffik". É erro do mockup. O produto é
**TrackHub** em toda a interface. `traffik` é só o nome do diretório e do
repositório, e não deve vazar para tela nenhuma, nem para microcópia, nem para
`<title>`.

## O criador de regras → **fora do redesign**

É funcionalidade nova, com motor próprio, tabelas próprias e risco de envenenar
atribuição em silêncio — não é linguagem visual. Registrado como especificação
em **`docs/design/06-CRIADOR-DE-REGRAS.md`** e **não implementado**. Do redesign
entra só a linguagem visual da tela (canvas, nós, conectores), e só quando o
usuário decidir construir o motor.

---

# 🔴 O que só a TELA pegou — 3 defeitos que passaram no build

Registrado em 05/08/2026, ao abrir a `/design-system` no navegador. A sessão
anterior tinha verificado os primitivos pelo CSS emitido e pelo teste de
contraste, e concluído — corretamente — que **o contraste estava provado e o
arranjo visual não**. Os três defeitos abaixo estavam nos quatro primitivos
"prontos". `tsc`, `eslint`, `build` e `test:contraste` passavam nos três.

| # | Defeito | Como estava na tela | Causa |
|---|---|---|---|
| 1 | **CTA com 30px de gradiente cru** | o "Entrar" tinha barras de gradiente nas laterais e anel nenhum em cima/embaixo | `padding` inline `0 14px` **vencendo** a classe `p-[1.5px]` da variante |
| 2 | **"Carregando" idêntico a "desabilitado"** | o botão "Sincronizando" ficava igual ao "Indisponível" | `carregando` liga o `disabled`, que arrasta o `disabled:opacity-45` |
| 3 | **Botão de ícone VAZIO** | 32px de nada; `textContent` string vazia | `apenasIcone` descartava o `children`, e o ícone só entrava por `iconeInicio` |

**O padrão comum:** os três são de LAYOUT ou de ESTADO VISUAL, e nenhuma
ferramenta desta base pergunta "como isto ficou". O #1 é particularmente do tipo
que esta base coleciona — duas fontes para o mesmo `padding`, uma vencendo a
outra em silêncio, exatamente como o `@theme inline` teria feito com as cores se
não tivesse sido medido.

O #2 é o mais interessante como decisão: *carregando* e *desabilitado* são
estados **opostos** (um está trabalhando, o outro não vai funcionar) e estavam
pintados igual. O `disabled` do HTML continua sendo o jeito certo de bloquear o
clique — o que mudou é que a opacidade volta ao normal e quem comunica a espera é
o giro mais o `cursor: wait`.

## E um quarto, no próprio teste de contraste

O extrator de tingimentos lia **os comentários do CSS como se fossem
declarações**. O `globals.css` documenta o fallback do `color-mix` mostrando o
CSS que o Lightning emite, e aquele exemplo entrava na medição:
`--tk-tint-danger` aparecia duas vezes e o teste anunciava "8 tons" onde há 7.

Inofensivo desta vez, porque o exemplo é igual ao código real. O caso geral não
é: um comentário com um valor ANTIGO faria o teste **aprovar uma cor que a página
não pinta** — que é precisamente o que aquele arquivo existe para impedir.

Hoje os comentários **multilinha** saem antes de qualquer extração. Os de uma
linha ficam de propósito: é deles que a conferência cruzada tira o hexadecimal, e
apagar todos trocaria o bug por uma asserção morta.

---

## O fallback do `color-mix` agora AVISA

Decisão mantida (o `color-mix` fica), com a asserção que faltava. O teste mede o
caminho de fallback e imprime o resultado **em toda execução**:

> `14 de 14 selos ficariam ABAIXO de 4.5:1 — o pior é 1.00:1 (accent, tema escuro).`

**1.00:1 é texto literalmente invisível** — no tema escuro o `on-tint-accent` é
igual à cor pura, então sem `color-mix` o rótulo fica exatamente da cor do fundo.
Era pior do que "ilegível", e ninguém sabia porque nada media.

Não reprova de propósito: reprovar obrigaria a largar o `color-mix`, que é a
decisão contrária à tomada. O valor é a visibilidade — se alguém mexer nos tons e
o fallback piorar, o número muda à vista de quem rodar o teste.

Junto veio uma asserção que **falha alto**: todo `--tk-tint-X` precisa de
`--tk-on-tint-X` nos **dois** temas. O erro provável ali não é errar um valor, é
acrescentar um tom e escrever só metade dele.

---

## O que NÃO conflita, só ainda não existe

- **Ícone dentro de quadrado tingido com raio ~8px** nos KPIs — componente, Fase 4.
- **Linha de tabela com miniatura** (criativos) é bem mais alta que os 36px da
  densidade compacta. É variante de linha com mídia, não conflito de token.
- **Heatmap "Performance por hora"** em rampa de azul — precisa de uma escala
  sequencial, que a paleta não tem. Fase 4.
- **Busca com `⌘K`** e rail que recolhe: já previstos no roteiro §9.
