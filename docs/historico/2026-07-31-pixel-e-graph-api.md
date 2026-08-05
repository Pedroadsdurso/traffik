# Histórico — 2026-07-31-pixel-e-graph-api

> Registro de sessão, mantido inteiro. Não é regra e não precisa estar
> carregado a cada sessão — mas é onde está o "por que ficou assim" de
> cada decisão do período, e várias delas voltaram a importar.

> ⬆️ **Regras que valem sempre** (PROCEDIMENTO, ordem de migration, guarda de
> escrita em produção, padrões nomeados, estado atual e fila) estão no
> **`CLAUDE.md`** na raiz. Este arquivo é o detalhe de um tema.

---

## 🚦 (histórico) fila de UX: (e) e (a) fechados (31/07/2026, 5ª parte)

### O que ficou pronto

**(e) Espaço mal aproveitado — as duas telas que faltavam.**
`TestesView` (era `max-width:920px`) e `NotificationsView` (era `680px`) adotaram
o padrão de 2 colunas de Webhooks/UTMs/Taxas/Pixel.

Em Testes a divisão é **semântica, não a lista cortada ao meio**:

| Coluna | Cards | O que têm em comum |
|---|---|---|
| **Como está agora** | Checklist · Espelho · Teste de Webhook | só **leem** o que já aconteceu — e são os que crescem sem teto (20 logs, detalhamento por evento) |
| **Testar agora** | Teste de Pixel · Teste de Tracking · Testar um aviso de venda | você fornece algo e a resposta vem do serviço de verdade |

Em Notificações os toggles viraram **ladrilhos numa grade**, e esse é o ponto:
sem isso, alargar a tela só esticaria cada linha (rótulo à esquerda,
interruptor à direita, um metro de nada no meio — o defeito que a `FeesView`
corrigiu). Em grade, alargar **acomoda mais itens por linha**.

> ⚠️ **`min-width:0` nas colunas não é enfeite.** Item de grid nasce com mínimo
> = conteúdo, e a coluna esquerda de Testes guarda o `<pre>` do payload cru.
> Medido com 3 avisos reais contendo uma URL de 250 caracteres sem espaço:
> **transbordo 0 em todas as larguras de 1600 a 420**, e `document.scrollWidth`
> nunca passou do viewport. Colapsa para 1 coluna em ~864px.
>
> ⚠️ `resize_window`/`resize_page` **não pegam com a janela do Chrome
> maximizada** — falham em silêncio (a captura muda de escala e parece que
> funcionou). A varredura de larguras foi feita constringindo o container, que
> é equivalente para layout que só depende de `auto-fit`/`minmax`. Se precisar
> de viewport real, restaure a janela antes.

**(a) Microcópia — as 9 telas nunca auditadas, lidas uma a uma.**
Limpas, nada a fazer: nova campanha, coluna de veiculação, aviso de snippet,
card de espelho. Os módulos de rótulo (`veiculacao.ts`, `espelho.ts`,
`detectores.ts`) já estavam escritos em consequência.

O que estava errado:

| Achado | Onde |
|---|---|
| 🔴 **Plural entre parênteses, 9×** — incluindo *"Isto marca 1 item(ns) como excluídos"* no diálogo de EXCLUSÃO em massa | `AdsActionBar` (2) · Checklist (4) · ação em massa · sync · runRules · testador |
| **Crase renderizada literal** — `` `secret` `` e `` `postbackUrl` `` apareciam com as crases na gaveta | `REGISTRO` (Cakto, OnyxPag) |
| **Nome interno na tela** — "o **motor** recusa" (3×), "TODAS as **entidades** do escopo", "orçamento atual da **entidade**" | Regras |
| **"payload" e "corpo cru"** — já estavam na lista de fora junto com POST/endpoint/cabeçalho | aba Testes |
| **"Nenhum pixel com token da CAPI"** — sobreviveu à troca que o resto do produto já fez para "conectado" | Checklist |

> ### ⛔ O parêntese não é só feiúra: ele esconde erro de concordância
> *"1 item(ns) como excluídos"* está errado em número **e** em gênero, na tela
> mais perigosa do produto (a Meta não desfaz exclusão). O `plural()` sozinho
> não bastava — o nome do nível tem gênero, então `NOME_DO_NIVEL` guarda
> `{ um, varios, genero }` e a frase concorda. Conferido na tela nos quatro
> casos: "1 campanha … excluída", "2 campanhas … excluídas", "2 anúncios …
> excluídos".
>
> `NOME_DO_NIVEL` mora em `AdsActionBar` (casa do tipo `Nivel`) e o
> `AdsManagerView` **importa de lá** em vez de manter a segunda cópia — os dois
> nomeiam os mesmos níveis, e duas listas para a mesma pergunta divergem.

**Deixados de propósito:** `NEXT_PUBLIC_APP_URL` no aviso de URL local (só
aparece em dev, e só quem faz o deploy pode agir), `</head>`, "Contém CSS"
(dentro do avançado) e o bloco de código das Credenciais de API (já endereçado
a "quem cuida do seu site").

### ⚠️ NÃO exercitado na tela — verificado só por código

| Item | Por que ficou assim |
|---|---|
| Ramo **"Falta conectar"** do card de pixel | exige um `PixelConfig` com `MetaPixel` cadastrado **e sem token**; os do dev têm zero pixels da Meta, então caem no outro ramo |
| **"N campanhas atualizadas"** (resultado da ação em massa) | executar exigiria escrita real na Graph API |
| **Resumo do sync** (`N erros`) e **`runRules`** (`N regras avaliadas`) | idem — dependem de chamada externa que não foi disparada |

Os três são troca de texto coberta por `tsc`/`build`, mas nenhum foi visto
renderizado. O diálogo de exclusão, esse sim, foi aberto e **cancelado** nos
dois níveis para conferir a concordância.

### 📋 Ordem da próxima sessão (decidida pelo usuário)

1. **(f) Camada didática** — estados vazios que ensinam + indicador de progresso
   de configuração.
2. **(g) Regras em duas regiões** — ver a fila de UX. Prioridade acima do (f)
   *no valor*, mas o usuário escolheu fazer (f) primeiro.
3. **(d) Responsividade / varredura de condicionais** — **por último e em sessão
   própria**: exige semear dados que ativem cada caminho condicional.

### Verificação desta sessão

`tsc`, `lint` e `build` limpos. Suítes afetadas: `test:analise-regra` 32/0 ·
`test:detectores` 56/0 · `test:espelho` 39/0 · `test:veiculacao` 40/0 ·
`test:gateways` 45/0. Os 3 `WebhookLog` semeados para testar o `<pre>` foram
removidos **por id coletado na criação**.

---

## 🚦 (histórico) gaveta do Pixel simplificada (31/07/2026, 4ª parte)

**Commitado em `cf19351` e já no `origin/main`** (a nota de "sem commit" acima
era da própria sessão que escreveu isto, e envelheceu).

> ✅ **`20260731090000_pixel_config_setup` ESTÁ APLICADA em produção** —
> confirmado pelo usuário em 01/08/2026: `37 migrations found · No pending
> migrations to apply`. Ele rodou o `migrate deploy` na própria sessão em que o
> aviso foi escrito. **Não há pendência de migration.**
>
> ⚠️ O aviso anterior dizia "continua marcada como PENDENTE" e estava
> **errado** — ninguém tinha verificado, e "não verificado por mim" virou "não
> aplicado" na escrita. É o mesmo modo de falha do "nenhuma escrita real foi
> exercida", que também nasceu de uma afirmação plausível e não checada.
> **Antes de registrar algo como pendente, pergunte — o usuário opera o sistema.**

A gaveta expunha o **mecanismo** em vez de resolver: ~10 blocos, e só o "Quem
envia cada evento" eram **5 linhas × 4 opções = 20 decisões** que exigem entender
deduplicação da Meta. Hoje são **8 controles** no caminho padrão.

> ### ⛔ Quando o caso é o mesmo para quase todos, a ferramenta RESOLVE
> O usuário desta ferramenta é infoprodutor: pixel do Facebook na página,
> checkout hospedado pelo gateway. Uma pergunta que ele não consegue responder
> sem estudar o mecanismo não é configuração — é transferência de problema.
>
> **Uma pergunta** ("o código do Facebook está instalado nesta página?") define
> os 5 donos. O resto tem padrão sensato e vive em "Configuração avançada".

### 🔴 Dois achados que a simplificação desenterrou — e a corrigem

**Achado 1 — `eventOwners` também é ASSADO no script, e a assinatura v1 não
cobria.** `pixelScript()` embute `var ALHEIOS = [...]`, mas a assinatura só
cobria `lead`/`addToCart`/`ic`. Mudar o dono de um evento gerava script defasado
**que o aviso de ontem não pegava** — e uma direção recria o bug que a 2ª parte
consertou:

| Passo | O que acontece |
|---|---|
| Dono do `PageView` vai de "pixel da página" para "Traffik" | |
| Servidor (decide **ao vivo**) | passa a mandar PageView à CAPI |
| Script instalado (`ALHEIOS` **congelado**) | continua sem espelhar |
| Pixel nativo | segue disparando o dele, sem `eid` |
| **Resultado** | CAPI sem par + nativo sozinho = **a Meta conta 2 de novo** |

E a gaveta antiga convidava a isso: a nota do PageView dizia *"Escolha Traffik só
se você NÃO tiver o pixel do Facebook na página"*, e quem clicava sem reinstalar
caía exatamente aí. **Assinatura v2** cobre donos + pixel nativo.

**Achado 2 — `sem-fbq` misturava um erro com uma configuração legítima.** Quem
**não tem** pixel nativo — caso válido, em que a CAPI é o único caminho — ganhava
10s de espera, `console.warn` e `sem-fbq` gravado **em toda visita**: alarme
vermelho permanente numa instalação correta. Agora o script recebe
`var NATIVO = false` e devolve **`sem-nativo`**, estado de tom neutro.

> ⚠️ Os dois achados são a **mesma raiz** que o preset resolve: o dono do evento
> (lido AO VIVO pelo servidor) e o comportamento do script (ASSADO no snippet)
> moravam em lugares diferentes e podiam discordar. Uma resposta, os dois lados
> coerentes por construção.

### Assinatura v2 — subir a versão NÃO acusa todo mundo

> ### ⛔ Comparar só os campos que a versão instalada CONHECE
> Um script v1 pode estar perfeitamente correto: ele só não sabe reportar "quem
> envia cada evento". Marcá-lo como divergente pintaria de âmbar a gaveta de todo
> usuário no dia do deploy, para a maioria sem nada errado — e **aviso que
> aparece sempre vira ruído que se aprende a ignorar**.
>
> `lerAssinatura` aceita 5 partes (v1) e 7 (v2); o que a v1 não tem volta `null`
> e sai da comparação. `avisoDeVersao()` devolve uma **nota cinza** — não
> divergência — dizendo *"se você mudou 'quem envia' depois de instalar, recole"*.
> Ela some sozinha na primeira reinstalação.

### O eixo "⟳ muda o script × ⚡ vale na hora"

| ⟳ Exige recolar | ⚡ Vale na hora |
|---|---|
| A pergunta do preset | Nome |
| Início de checkout · Lead · Carrinho | ID do pixel e token da CAPI |
| Regra de detecção do IC | Purchase (ligar, modo, valor, produto) |
| **Quem envia cada evento** | Ativar/desativar o pixel |

> ### ⛔ O selo é da REGIÃO, nunca do campo
> Exigência do usuário, e é restrição de layout, não decoração: campo a campo
> seriam ~15 selos numa gaveta de 5 blocos. **Se um campo que muda o script for
> parar num bloco `hora`, o selo passa a mentir** — ao mover campo de lugar,
> confira em qual lado ele cai.

**Ordem:** dados do pixel → como é o seu site (preset + eventos) → **script** →
envio das vendas → avançado.

> ⚠️ O script fica **depois** do bloco que o determina, não antes (o usuário
> pediu antes e concordou com a inversão): script acima das causas significa que
> marcar "Lead" deixa o código silenciosamente velho — o defeito exato que este
> trabalho conserta. A leitura vira *"isto define o script; aqui está o script"*.
>
> ⚠️ **Na criação não há script**, e a tela diz isso: ele embute o
> `PixelConfig.id`, que só existe depois do primeiro save.

### O preset

| | Sim, tenho pixel nativo (padrão) | Não |
|---|---|---|
| `PageView` | **o pixel da página** | **Traffik** |
| Lead · AddToCart · IC · Purchase | Traffik | Traffik |
| Script | espelha no `fbq` | **não espelha, não espera, não avisa** |

> ⚠️ **Só o `PageView` inverte.** Os demais só saem do navegador se alguém chamar
> `fbq('track', …)` explicitamente — não há emissor automático concorrendo, e
> rebaixá-los perderia conversão em silêncio.
>
> ⚠️ **Responder de novo SOBRESCREVE ajuste manual**, de propósito: é um pedido
> explícito de "reconfigure para este caso". O caminho de volta é o
> **`↩ voltar ao padrão`**, que só aparece quando os donos divergem do preset
> (`seguePreset`).

### `PixelConfig.setup` — nulo é "ainda não perguntamos"

`lerPreset()` **infere** do dono do PageView. Como o padrão do projeto já é
`PageView: "navegador"`, **todo pixel existente infere "tem pixel nativo"** — que
é exatamente o comportamento em vigor. Só cai em `false` quem trocou o PageView
para Traffik na mão, e aí `false` é a leitura certa.

### O que ficou de fora, e por quê

- **A 2ª pergunta ("onde o comprador paga?") foi CORTADA** pelo usuário: o padrão
  `clique_checkout` já cobre os dois casos, e uma pergunta a menos é uma decisão
  a menos. A escolha da regra de detecção vive só no avançado.
- **Nenhuma capacidade se perdeu.** Os 4 donos por evento continuam ajustáveis —
  viraram 5 dropdowns em vez de 20 botões.
- O campo **"Tipo: Meta (Facebook)"** saiu: era um select de uma opção só.

### Verificação

`test:detectores` **56/0** · `test:espelho` **39/0** · `test:utm-venda` 25/0 ·
`test:match` 20/0 · `tsc`, `lint` e `build` limpos.

**Conferido na tela** (dev, `dev@exemplo.dev`): criação cabe em meia gaveta (8
controles); edição mostra o aviso âmbar de script defasado; responder "Não, só a
Traffik" **reescreveu o PageView de "O pixel da sua página" para "Traffik"**;
mudar Purchase para "Ninguém" fez aparecer o `↩ voltar ao padrão`; os selos
`⟳ muda o script` / `⚡ vale na hora` aparecem no cabeçalho de cada região.

> ⚠️ **Não exercitado:** salvar um pixel com o preset "Não" e conferir o script
> gerado com `NATIVO = false` **no navegador** — só em teste (DOM falso). E o
> `sem-nativo` nunca foi gravado por um script real.

---

## 🚦 (histórico) sessão de 31/07/2026 (3ª parte) — TUDO EM PRODUÇÃO

**Três itens fechados e no ar** (commit `9c97a25`), migrations aplicadas antes do
push, produção sondada 6× sem `500`. **E a dedup do pixel foi confirmada do lado
da Meta** — a última prova que faltava do trabalho da 2ª parte.

| | Item | Estado |
|---|---|---|
| 1 | Aviso de snippet defasado na gaveta do Pixel | ✅ em produção, conferido na tela |
| 2 | Leitor da coluna `espelho` (aba Testes) | ✅ em produção, conferido na tela |
| 3 | UTMs copiadas para `Sale` + backfill | ✅ em produção; **backfill ainda não rodado** |
| — | Dedup confirmada no Gerenciador de Eventos da Meta | ✅ entrada única, "API de Conversões e navegador" |

> ⏳ **Único passo pendente, e não é urgente:** `npm run backfill:utms` (simula
> por padrão). Nada apaga `Click` automaticamente, então a janela dele **não está
> fechando** — ao contrário da do `backfill:platform`, que perde história a cada
> gateway removido.
>
> ```powershell
> npm run backup -- --url '<conn>'          # sempre antes
> npm run backfill:utms -- --url '<conn>'   # SIMULA
> ```

> ⚠️ **O aviso de snippet vai dizer "versão anterior" em produção, e está certo:**
> os snippets instalados hoje não sabem reportar a assinatura. Some quando o
> usuário regerar e reinstalar. Pelo mesmo motivo, boa parte do histórico do card
> de espelho aparece como "não informado" — o que interessa é o que entra daqui
> para frente.

### 1. ✅ Aviso de snippet defasado na gaveta do Pixel

`src/lib/pixel/detectores.ts` — o script **assina** o que ele detecta no momento
em que é gerado (`var DET = "v1.l1.a0.icontem_texto.v1rljein"`), manda a
assinatura no POST de todo evento, e a gaveta compara com o `PixelEventRule` ao
vivo. Migration `…070000` (`PixelEvent.detectores`).

> ### 🔴 As duas direções NÃO são simétricas, e a tela diz qual é qual
> | Na gaveta | No script instalado | O que acontece |
> |---|---|---|
> | Lead **ligado** | `LEAD=false` | 🔴 **nenhum evento sai, e nada denuncia** |
> | Lead desligado | `LEAD=true` | o evento sai e o servidor recusa com `regra desabilitada` — barulhento, tudo bem |
>
> Por isso `diferencasDeDetectores` tem frases diferentes para cada direção.
> Uma frase só ("os detectores divergem") esconderia qual delas custa conversão.

**Quatro estados, e `sem-dados` NÃO é `ok`:**

| Estado | Quando |
|---|---|
| `ok` | a assinatura reportada bate com a regra ao vivo |
| `divergente` | 🔴 discordam; as frases dizem em quê e o que fazer |
| `script-antigo` | está rodando, mas é anterior a este diagnóstico |
| `sem-dados` | nenhum evento chegou — **não afirmamos nada** |

Ausência de evento pode ser script não instalado, site sem tráfego ou script
quebrado, e não distinguimos os três. Dizer "tudo certo" ali seria o mesmo
silêncio que o diagnóstico existe para acabar.

> ⚠️ **Decide pelo evento mais recente VINDO DO SCRIPT**, não pela última
> assinatura já vista: um script reinstalado numa versão anterior tem de aparecer
> como antigo, e não como a assinatura boa da semana passada. Eventos com
> `eventId` começando em `gw:` são do webhook do gateway
> (`webhook/checkoutEvent.ts`) e nunca têm detector.

> ⚠️ **A checagem é recarregada DEPOIS de salvar.** Salvar muda o que a
> ferramenta espera do script; um resultado calculado antes viraria afirmação
> sobre a configuração anterior — pior que nenhuma, porque parece confirmação.

> ⚠️ **Normalização é o que impede alarme falso.** `"pay.kirvano.com, hotmart"` e
> `"pay.kirvano.com,hotmart"` dão a MESMA assinatura, porque
> `dominiosCheckout()` já apara e passa para minúsculas. Mas **seletor CSS não é
> normalizado** — `.btnCheckout` ≠ `.btncheckout` de verdade. Um aviso que às
> vezes mente treina o usuário a ignorar todos.

> ⚠️ **A rota aceita qualquer string curta em `det`**, de propósito. Validar
> contra o formato ATUAL transformaria snippet velho em snippet invisível — que é
> exatamente o caso que a coluna existe para exibir. O teto de 120 caracteres é só
> para a rota pública não escrever texto ilimitado.

**Campo novo no detector precisa entrar na assinatura** — senão ela passa a dizer
"igual" para snippets que já não são.

### 2. ✅ Leitor da coluna `espelho` (a dívida da sessão anterior)

Card **"Espelho no pixel da sua página"** em Integrações › Testes, entre o Teste
de Pixel e o de Webhook. Pílulas com a contagem por situação, aviso âmbar só
quando há problema real, e detalhamento por evento.

`src/lib/pixel/espelho.ts` é a fonte única de rótulo, tom e texto de ajuda —
**não pode morar em `actions/diagnostics.ts`**, que é `"use server"`: lá todo
export vira endpoint e um array exportado quebra o build.

> ⚠️ **`nulo` NÃO é falha**, e a distinção é o que dá valor ao resto. Cobre dois
> casos legítimos: evento de script anterior à coluna, e evento criado pelo
> SERVIDOR (o `InitiateCheckout` que nasce do webhook do gateway — esse nunca
> passa por navegador nenhum). Sem separá-lo, todo o histórico apareceria como
> espelho quebrado e o número que importa (`sem-fbq`) se perderia no meio.
>
> ⚠️ **O aviso âmbar só aparece com problema.** Alerta permanente vira ruído que
> se aprende a ignorar — inclusive quando muda de texto.

### 3. ✅ UTMs copiadas para `Sale` — migration `…080000`

`utmSource`/`utmMedium`/`utmCampaign`/`utmContent`/`utmTerm`/`fbclid`, gravados na
ingestão a partir do clique casado. Mesma classe do `Sale.platform`.

> ### ⛔ PRECEDÊNCIA: a cadeia `Sale → Click` VENCE a cópia — confirmado
> A preferência do usuário está certa e virou `lib/vendas/utmsDaVenda.ts`, o
> único ponto que decide isso. Três razões:
>
> 1. **É o caminho já exercido.** `ads/overview.ts`, `ads/creatives.ts` e
>    `areas/precedencia.ts` leem do `Click` há meses, contra dado real.
> 2. **Duas fontes para a mesma pergunta divergem sempre** — foi assim que a tela
>    de Áreas passou a dizer "Sem webhook" para uma área com webhook vinculado.
> 3. **A cópia é seguro, não índice.** Ela existe para o dia em que o clique
>    sumir; enquanto ele estiver lá, ele manda.
>
> ⚠️ Enquanto o clique existir, **as duas respondem igual** — a cópia é feita a
> partir dele e um `Click` nunca muda de UTM. A precedência só passa a importar
> quando o clique é apagado, o que hoje só acontece por "apagar dados" na
> exclusão de área, atrás de duas travas. **É por isso que ela é barata: não muda
> número nenhum hoje.**
>
> ⚠️ **Nunca mescla.** Campanha do clique + criativo da cópia produziria uma
> atribuição que não existiu em lugar nenhum. E o clique vence quando **tem algo a
> dizer**, não pela mera existência: um clique de tráfego direto não pode calar
> uma cópia herdada de um clique anterior mais forte.

> ### 🔴 Os UTMs viajam no MESMO `updateMany` do `clickId`
> Sob a MESMA guarda de precedência de fonte. Numa instrução separada, um match
> mais fraco poderia trocar a campanha sem trocar o clique, e a cópia passaria a
> descrever outro visitante. Escreve **inclusive os nulos**: a cópia descreve o
> clique para o qual a venda aponta AGORA.

> ### ⚠️ A armadilha do `select`, de novo — e desta vez com teste
> `matchClick` precisa **selecionar** as seis colunas. Fora do `select` elas
> chegam `undefined`, a venda nasce sem campanha e **nenhum `tsc`/`lint`/`build`
> acusa** — é a armadilha do `pedidoId`. O `select` virou constante única
> (`CAMPOS`) usada pelas três vias de match, e `test:utm-venda` chama o
> `matchClick` de verdade contra o banco para provar que os valores chegam.

**`npm run backfill:utms`** — simula por padrão. Idempotente de verdade: o `WHERE`
exige as seis colunas da venda nulas **e** o clique com ao menos uma preenchida.
Sem a segunda metade, toda venda de tráfego direto seria reescrita com nulos a
cada passada e a 2ª execução reportaria linhas tocadas.

> ✅ **A verificação que o usuário pediu é MEDIDA, não prometida.** Depois do
> `--aplicar` o script compara `country`/`countrySource` **linha a linha** e falha
> se qualquer um mudou; depois roda a 2ª passada e falha se ela tocar em algo.
> Exercitado contra o banco de dev: 8 vendas, país idêntico em 8, 2ª passada 0.
>
> ⚠️ O relatório é **recortado por dono** (`userId`), como manda a regra do
> `origem-venda.mjs`: um script que soma o banco inteiro está medindo outra coisa.

**A coluna tem leitor**: `npm run venda:inspecionar` mostra Campanha/Criativo/
Fonte resolvidos por `utmsDaVenda` e diz **de onde a resposta veio** ("respondido
pelo CLIQUE (a fonte)" × "pela CÓPIA na venda (o clique sumiu)"), avisando quando
falta cópia.

> 🐛 **Achado de quebra:** o `SELECT s.*, c."utmCampaign", c.fbclid` do inspetor
> passou a ter **nome de coluna repetido** — `Sale` agora tem `utmCampaign` e
> `fbclid` próprios, e no objeto de linha do `pg` o último vence. O inspetor
> mostraria o clique achando que mostra a venda. As colunas do clique foram
> aliasadas. **Toda consulta que faz `s.*` + join no `Click` tem esse risco.**

> ### ⚠️ O que NÃO foi feito, de propósito
> **A atribuição não usa a cópia como fallback.** Ela só dispararia com o clique
> apagado — que hoje não acontece sozinho — e ligá-la mudaria números (venda hoje
> não atribuível passaria a ser) sem gatilho que justifique. `utmsDaVenda` está
> pronto para quando fizer sentido: é uma linha.

### Verificação

| | |
|---|---|
| `npm run test:detectores` | **28 asserções, 0 falhas** (puro) |
| `npm run test:utm-venda` | **25 asserções, 0 falhas** (banco de DEV) |
| `npm run test:espelho` · `test:match` · `test:gateways` | 30 · 20 · 45, todos passando |
| `tsc --noEmit` · `lint` · `next build` | limpos |
| **Na tela** | as duas telas conferidas no navegador — ver abaixo |

**Conferido na tela** (dev, `dev@exemplo.dev`, dados semeados e removidos por id):

- gaveta do Pixel, pixel divergente → aviso âmbar com **as duas frases**
  ("Lead está ligado aqui, mas o script instalado não escuta o envio de
  formulários — nenhum evento chega." e "A regra de Initiate Checkout aqui é
  'contém texto'; o script instalado usa 'desligado'."), mais a instrução de
  regerar e o "Último evento recebido 5min atrás";
- gaveta do outro pixel → "✓ O script instalado no seu site corresponde a esta
  configuração.";
- aba Testes → `11 saiu junto · 3 saiu depois de esperar · 4 o pixel da página
  nunca apareceu · 1 erro ao espelhar · 8 outro dono envia · 8 não informado`,
  com o bloco âmbar só para os dois problemas e o detalhamento por evento.

### 📋 A FILA

1. **FILA DE UX — o próximo trabalho, com REAUDITORIA ANTES de executar.**
   Decisão do usuário: ela é grande demais para dividir sessão, e a lista
   envelhece (3b e 3c já estavam feitos quando a fila dizia que não). As telas
   criadas desde a última apuração — gaveta da Cakto, nova campanha, drill-down,
   coluna de veiculação, testar condição, dono do pixel, e agora o aviso de
   snippet e o card de espelho — **nunca foram auditadas** quanto à linguagem.
   Devolver com FEITO / PARCIAL / NÃO FEITO e uma recomendação de ordem.
   ⚠️ Vale a regra permanente: **simplifique jargão de PROGRAMAÇÃO, nunca de
   TRÁFEGO**, e confira `lib/explicacoes.ts` antes de "adicionar tooltip".
2. **Evento de TESTE da Cakto conta como venda real** — bloqueado até o usuário
   reativar a Cakto (precisa do payload real).
3. Import/export do Bloco 8; faxina do nav morto no `useTraffikState` +
   `EditDashboardDrawer` inalcançável.

### O que o usuário ainda deve

Nada. ✅ **A dedup foi confirmada do lado da Meta** — ver a seção abaixo. Os dois
itens que estavam aqui saíram: um foi verificado, o outro não se aplica ao funil.

## 🚦 (histórico) fechamento da sessão de 31/07/2026 (2ª parte)

Tudo commitado e no `origin/main` até **`0fa68d1`**. As migrations
`20260731030000_sale_platform`, `…040000_pixel_event_dedup`,
`…050000_pixel_event_owners` e **`…060000_pixel_event_espelho`** estão
**aplicadas em produção**.

### ✅ O ESPELHO NO `fbq` NUNCA TINHA RODADO — corrigido e VERIFICADO em produção

A sessão anterior entregou o espelho (`057c06e`) e ele **nunca disparou uma vez**.
Sonda do usuário no navegador: **uma única** requisição para `facebook.com/tr`,
**sem `eid`**, enquanto a nossa CAPI respondia `sent: 1`. A Meta recebia dois
PageView sem nada em comum e contava os dois — desde o commit que "consertou" a
dedup.

**Causa:** a guarda `if (typeof window.fbq === "function")` dentro de um
`try/catch` vazio. O snippet é um IIFE inline e roda `track("PageView")` de forma
**síncrona, no parse**; colado ANTES do código da Meta no `<head>`, o `fbq` ainda
não existe. A guarda retornava **sem log nenhum**.

> ### 🔴 É o SÉTIMO caso do PROCEDIMENTO, e o mais sutil até agora
> Os anteriores eram código nunca chamado. Este **era chamado**, na hora certa,
> com os argumentos certos — e desistia na primeira linha. `tsc`, `lint`, `build`
> e os testes passavam. O que denunciou foi o usuário abrir o DevTools.
>
> **Guarda de compatibilidade (`if (typeof X === "function")`) precisa de ramo
> `else`.** Ela existe justamente para o caso em que a dependência falta — que é
> o caso que ninguém vai observar se ela for calada.

**Duas correções, e as duas importam:**

| | O quê |
|---|---|
| **Tolerar a ordem** | sem `fbq`, o espelho entra numa **fila** e sai assim que ele aparece — sondagem de 200 ms, teto de 10 s. O `event_id` é capturado no `track()` e viaja na fila: recalcular quebraria o par, porque o `eid` tem janela de 10 s |
| **Não falhar calado** | estourou o teto → `console.warn` dizendo **quais eventos** e o que fazer, e **`PixelEvent.espelho`** gravado (`ok` · `adiado` · `adiado-ok` · `sem-fbq` · `erro` · `alheio`) |

O estado viaja no próprio POST do evento. Quando só se resolve depois, um segundo
POST com **`somenteEspelho: true`** atualiza a coluna e **para** — não grava linha
nova e **não reenvia para a CAPI**, que duplicaria o envio server-side.

> ⛔ **Descartado esperar `load`/`DOMContentLoaded`:** falha justamente com código
> da Meta injetado por GTM *depois* do marco, e não tem sinal de fracasso. A
> sondagem tem prazo, e vencido o prazo ela **relata**.
>
> ⛔ **NUNCA definir `window.fbq` nós mesmos** para "garantir" que existe. O
> código-base da Meta começa com `if (f.fbq) return;` — um stub nosso faria o
> snippet do usuário **abortar inteiro**, e o pixel dele nunca inicializaria.

### 🔴 `PageView` passou a ser do pixel NATIVO por padrão

O código-base da Meta termina em `fbq('track','PageView')`: dispara em todo
carregamento, **sem `event_id`**, e não há como fazê-lo ir com um.

> ### ⛔ O espelho NÃO resolve o PageView — a conta prova
> | | requisições `/tr` | a Meta conta |
> |---|---|---|
> | Sem espelho | 1 (automática, sem `eid`) | automática + CAPI sem par = **2** |
> | Com espelho | 2 (automática + espelho `eid=X`) | automática + [espelho ⟷ CAPI] = **2** |
>
> O espelho casa com a **nossa** CAPI; o automático continua sozinho. **Dá 2 nos
> dois casos.** Como nenhum dos dois lados cede, quem cede somos nós.

`PADRAO_DO_EVENTO` (em `donos.ts`) põe `PageView` em **`navegador`**; os demais
seguem em `traffik`, onde não existe segundo emissor automático e rebaixar
perderia conversão em silêncio.

⚠️ **Isto MUDA o comportamento de quem já tinha pixel cadastrado**, e é o
objetivo — essas contas contavam visita em dobro. Quem **não** tem pixel nativo
na página escolhe "Traffik" na gaveta e volta ao envio server-side.

O valor **`navegador`** é novo (eram 3 donos, agora 4). "Meu gateway" apontava
para o lugar errado no PageView: ali o outro emissor é o pixel da **própria
página do usuário**, não o checkout — e um rótulo que aponta para o lugar errado
manda procurar o problema onde ele não está. Cada opção agora traz a consequência
escrita embaixo (`EXPLICACAO_DONO`), e o PageView tem aviso âmbar fixo
(`NOTA_DO_EVENTO`).

### ✅ Verificado em produção pelo usuário, no navegador

| Evento | Resultado |
|---|---|
| **PageView** | 1 requisição `/tr` sem `eid`; POST devolveu `{"enviado":false,"motivo":"outro dono"}` — **sem duplicação** |
| **InitiateCheckout** | 🎯 **o espelho disparou**: `eid=InitiateCheckout-90whss` e `-9uvavo` em dois cliques a 31 s de distância (ids diferentes = correto, são duas ações reais) |
| **Lead** | não disparou — **toggle desligado na gaveta**, comportamento correto (ver abaixo) |
| **AddToCart** | ainda não exercitado |

`npm run test:espelho` — **30 asserções, 0 falhas**. Exercita o script gerado num
DOM falso: `new Function` valida a sintaxe da template string, `fbq` presente
espelha na hora, `fbq` ausente enfileira e sai quando ele aparece, `fbq` que nunca
vem gera warn + relato, e o padrão novo deixa PageView como `alheio` **mas ainda
registrado no nosso banco**.

> ### 🔎 O formato do `eid` já é prova de que o espelho rodou
> `InitiateCheckout-90whss` (nome + hash base36) só sai do nosso `eid()`, e o
> **único** ponto do projeto que chama `fbq('track', …, {eventID})` é o
> `espelhar()`. O pixel nativo não produz essa forma; o do gateway produzia UUID.
>
> E o par não pode divergir **por construção**: `track()` calcula `id` uma vez e
> entrega a MESMA variável ao espelho e ao `payload.eventId`. Não são dois
> cálculos.
>
> ⚠️ O que nada disso prova é se a **Meta** juntou os dois. Só o Gerenciador de
> Eventos responde: uma linha marcada **"Navegador e Servidor"**, não duas.

### 🔴 ACHADO: o detector fica CONGELADO no snippet instalado

`LEAD`, `ADD_TO_CART` e a regra de `IC` são **assados no script na geração**
(`var LEAD = false;` → `if (LEAD) document.addEventListener(...)`), enquanto o
servidor consulta `PixelEventRule` **ao vivo**. As duas pontas divergem, e uma
das direções é silenciosa:

| Gaveta | Script instalado | Resultado |
|---|---|---|
| Lead **ligado** | `LEAD=false` (snippet velho) | 🔴 **nenhum evento, e nada denuncia** |
| Lead desligado | `LEAD=true` | evento sai do navegador, servidor recusa com `regra desabilitada` — barulhento, tudo bem |

**Ligar o toggle na gaveta não conserta sozinho — tem de regerar e reinstalar.**
É a mesma classe de tudo nesta sessão: configuração numa ponta, comportamento
congelado na outra.

> ⚠️ **Com clientes isso deixa de ser inconveniente e vira impossível** — não dá
> para abrir o DevTools na página de cada um para descobrir que o script está
> velho. Virou o **item 1 da fila**.

**Diagnóstico enquanto o aviso não existe** (do mais barato ao mais caro):
1. abrir a gaveta e olhar o toggle;
2. no console do DevTools, `getEventListeners(document).submit` → `undefined`
   significa `LEAD=false` no script instalado (sem efeito colateral);
3. `window.traffikPixel.track("Lead")` — a resposta do POST separa os dois casos:
   `{"skipped":"regra desabilitada"}` = regra off; `{"sent":1}` = **divergência**.
   ⚠️ Este manda um Lead **real** para a Meta.

### 📌 (histórico) o que a 1ª parte da sessão entregou

**Confirmado em produção pelo usuário: 1 venda real, o Gerenciador de Anúncios
marcando 2.** A Meta vinha contando cada conversão duas vezes e otimizando as
campanhas com sinal inflado. Três coisas foram feitas:

| | O quê |
|---|---|
| **`eventId` determinístico** | era `nome + Date.now() + Math.random()` — id novo a cada chamada, dedup impossível por construção. Hoje deriva de pixel + evento + página + visitante + janela de 10s (FNV-1a) |
| **Espelho no `fbq`** | 🔴 o código **nunca tocava em `fbq`**. Mandávamos `event_id` à CAPI e nunca dizíamos ao pixel do navegador para usar o mesmo. **Tornar o id determinístico sozinho NÃO consertaria** — dedup exige que a mesma parte dispare os dois lados |
| **Seletor de dono por evento** | `lib/pixel/donos.ts`, consultado pelos TRÊS caminhos de envio. Padrão **Traffik em tudo** |

> ### 🔴 A KIRVANO NÃO TEM CAPI PRÓPRIA — verificado no Gerenciador de Eventos
> Aparece **uma única** integração de API de Conversões, e ela é a nossa. Só o
> pixel de navegador dela dispara.
>
> **Então ela não pode ser dona de evento nenhum.** Delegar o Purchase a ela
> trocaria um envio server-side por um de navegador, e perderia as três coisas
> que importam: resistência a ad blocker, disparo só em venda **aprovada** (o
> dela dispara na página de obrigado, antes de o PIX ser pago) e o `user_data`
> que montamos (`fbc`/`fbp` reais, e-mail e telefone com hash).
>
> ⚠️ **O `eid` do gateway NÃO é derivável.** É um UUID gerado no navegador dele
> (`InitiateCheckout-ff7d1800-…`) e **não aparece em campo nenhum do webhook** —
> verificado nos 167 payloads reais, onde `sale_id` e `checkout_id` são códigos
> de 8 caracteres. Por isso a ausência de duplicata vem de **partição** (um dono
> por evento), nunca de coordenação.

⚠️ **O snippet vive no HTML do cliente.** A correção só chega por reinstalação.

### ⚠️ O QUE AINDA NÃO FOI VERIFICADO

| | Item | Por que ficou assim |
|---|---|---|
| ✅ | ~~**A dedup no Gerenciador de Eventos da Meta**~~ | **CONFIRMADA em 31/07/2026** — entrada única, "API de Conversões e navegador". Ver a seção da 3ª parte |
| ➖ | **`AddToCart`** | **não se aplica** ao funil do usuário (checkout hospedado, sem carrinho). O detector — heurística fixa de "carrinho"/"comprar" — segue sem nunca ter rodado numa página real |
| ⚠️ | **O bloco "Quem envia cada evento" com 4 opções** | a gaveta foi aberta (o toggle de Lead foi conferido), mas o bloco reescrito nesta sessão **não foi olhado na tela** |
| ⚠️ | **O globo** | corrigido em `47e2523`; vale reconferir zoom máximo e marcador cruzando a borda |

### 🔴 Dívida criada nesta sessão

**`PixelEvent.espelho` tem escritor e NENHUM leitor na tela.** É o padrão que o
PROCEDIMENTO existe para pegar, registrado de propósito em vez de deixar passar.
Hoje só responde por SQL:

```sql
SELECT event, COALESCE(espelho,'(nulo)') AS espelho, count(*)
FROM "PixelEvent"
WHERE "userId" = '<id>' AND timestamp > now() - interval '7 days'
GROUP BY 1,2 ORDER BY 1,2;
```

⚠️ `NULL` = evento gravado por script anterior à coluna, ou pelo caminho
server-side. **Não é "falhou"** — sem essa distinção todo evento histórico
apareceria como espelho quebrado.

### 📋 A FILA

**Os itens 1 e 2 são da mesma família: tornar visível o que hoje só se descobre
por teste manual.** Ordem definida pelo usuário em 31/07/2026.

1. **Aviso de snippet defasado na gaveta do Pixel.** O detector fica congelado no
   script instalado (ver o achado acima), e a divergência silenciosa — regra
   ligada, script velho — não produz evento nenhum e nada denuncia.
   **Com clientes isso é inviável de diagnosticar**: não dá para abrir o DevTools
   na página de cada um.
   > 💡 **O caminho já está pronto**: o script **já reporta pelo POST** de todo
   > evento. Basta mandar junto quais detectores ele tem ligados
   > (`lead`/`addToCart`/`ic` + o tipo da regra) e comparar com o
   > `PixelEventRule` ao vivo. A gaveta então avisa "o script instalado está
   > desatualizado — regere e reinstale".
2. **Leitor da coluna `espelho` na aba Testes.** Algo como
   *"espelhos nos últimos 7 dias: 412 ok · 3 sem-fbq"*, com o detalhamento por
   evento. É o que fecha a dívida acima.
3. **Cópia dos UTMs para `Sale`.** Mesma classe do `Sale.platform`: hoje a
   campanha de uma venda só existe via `sale.click.utmCampaign`, e `clickId` é
   `SetNull`. A janela de backfill **não está fechando** (nada apaga `Click`
   automaticamente), então é barato e não urgente.
   ⚠️ Decidir a precedência antes de codar — a preferência do usuário é
   **continuar usando a cadeia `Sale → Click` enquanto o clique existir**, com a
   cópia só como fallback.
4. **Reauditoria da fila de UX** — 3a corrigido, 3b/3c já feitos, **3d e 3f
   pendentes**, 3e a verificar. ⚠️ A fila envelhece: as telas criadas desde então
   (gaveta da Cakto, nova campanha, drill-down, coluna de veiculação, testar
   condição, dono do pixel) **não foram auditadas** quanto à linguagem.

Dívidas antigas que continuam: nav morto no `useTraffikState`,
`EditDashboardDrawer` inalcançável, import/export do Bloco 8.

> ⚠️ **O dia 31/07 passou de US$ 560 em uso de API somando as duas partes.** Ele
> cobriu segurança de credenciais, `Sale.platform`, limpeza de dado de teste em
> produção, o globo, o desempate por fuso e o pixel inteiro — do `eventId`
> determinístico até o espelho comprovadamente disparando em produção.
> **Comece a próxima com contexto limpo.**
