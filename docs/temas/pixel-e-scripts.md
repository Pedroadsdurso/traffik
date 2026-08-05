# Pixel, CAPI e scripts instaláveis

> Leia ao mexer no pixel, na CAPI, no `eventId`/dedup, nos detectores, no
> ambiente de teste, ou nos scripts que o cliente cola no site dele.

> ⬆️ **Regras que valem sempre** (PROCEDIMENTO, ordem de migration, guarda de
> escrita em produção, padrões nomeados, estado atual e fila) estão no
> **`CLAUDE.md`** na raiz. Este arquivo é o detalhe de um tema.

---

## 🌐 URL pública nos scripts gerados

Os scripts que o usuário instala **rodam no site dele**, então `window.location.origin`
ali é o domínio do cliente, não o nosso. Ambos os geradores (pixel e UTM) usam
**`getPublicAppUrl()`** (`src/lib/appUrl.ts`), que lê `NEXT_PUBLIC_APP_URL`.

- `NEXT_PUBLIC_APP_URL` precisa ser lida como **literal** (`process.env.NEXT_PUBLIC_APP_URL`)
  — o Next substitui a expressão inteira em build; desestruturar `process.env` quebra.
- Sem a env var, cai em `window.location.origin` para não travar o dev — por isso a
  UI **mostra a URL resolvida** nas abas Pixel e UTMs e **avisa em amarelo** quando é
  `localhost`, deixando o erro visível antes de instalar no site.

> Desde a mudança para loader (abaixo), a URL entra no `src` da tag `<script>` e o
> runtime **deriva a API do próprio `src`** — regenerar o snippet continua necessário
> se o domínio mudar, mas o `apiBase` nunca fica dessincronizado do arquivo servido.

---

## 📦 Scripts instaláveis: INLINE, e por que voltamos atrás

> ### ⛔ NÃO transformar os scripts em loader de novo (decisão de 28/07/2026)
> Durante um dia inteiro os scripts viraram um **loader** de uma linha + runtime
> hospedado (`public/t.js`, `public/px.js`, minificados com terser). O snippet caiu
> de 5.800 para 743 bytes, mas a mudança **quebrou instalações em produção** e o
> usuário mandou reverter. Tudo isso foi desfeito: `src/scripts/`, `public/t.js`,
> `public/px.js`, `scripts/build-scripts.mjs`, o terser, os headers de cache do
> `next.config.ts` e o componente de dois formatos.
>
> **O que ficou:** `utmScript()` e `pixelScript()` devolvem o **código completo,
> autocontido**, para colar no `<head>`. Uma opção, um botão "Copiar script", sem
> loader e sem arquivo hospedado. `public/pixel.js` voltou a ser a fonte original
> da v1 (instalações antigas continuam funcionando).
>
> **Por que o ganho de tamanho não compensou:** o snippet é copiado uma vez e vive
> no HTML do cliente; os ~3 KB não são o gargalo. O custo real foi a dependência de
> rede (o arquivo pode não carregar, ficar em cache velho, ou o campo onde o
> snippet é colado tratar as tags `<script>` de forma diferente). Autocontido não
> tem nenhuma dessas falhas — cola e funciona.
>
> ⚠️ O `Cache-Control` de 5 min chegou a esconder um bug real durante o diagnóstico:
> o navegador servia o `px.js` antigo (`stale-while-revalidate`) enquanto o servidor
> já tinha o novo. Com script inline esse problema deixa de existir.

### O que o script de pixel inline dispara

| Evento | Quando | Configurável? |
|---|---|---|
| `PageView` | todo carregamento de página | **sempre ativo** — não é regra |
| `Lead` | submit de qualquer formulário | toggle |
| `AddToCart` | clique em elemento com cara de carrinho | toggle |
| `InitiateCheckout` | ver modos abaixo | toggle + modo |

> **`PageView` não passa por `PixelEventRule`** e por isso **não exigiu migration**:
> o enum `PixelEventType` continua com LEAD/ADD_TO_CART/INITIATE_CHECKOUT/PURCHASE.
> Em `/api/pixel/event` ele é aceito sem consulta de regra (`isPageView`), e
> `CapiEventName` ganhou `"PageView"`. Se um dia virar configurável, aí sim precisa
> de enum novo + migration.
>
> ⚠️ **PageView dispara a cada pageview**, então o feed enche mais rápido que antes.
> É diferente do "Clique" do `t.js`, que é **uma vez por sessão**.

## 🛒 CHECKOUT PRÓPRIO: caminho pronto na gaveta do Pixel — ✅ FEITO (05/08/2026)

Os 5 requisitos entregues. `lib/pixel/trechoUrl.ts` (puro, 17 asserções) e
`lib/pixel/checkoutProprio.ts` (os passos e o código do desenvolvedor).

| # | Entregue |
|---|---|
| 1 | Regra já em `contém URL`, campo em destaque, **exemplos clicáveis** (`/checkout`, `/finalizar`, `/pagamento`) |
| 2 | URL inteira → extrai o caminho; trecho largo → recusa no Salvar |
| 3 | Aviso âmbar: **o mesmo script vai nas DUAS páginas** |
| 4 | Passos com código pronto para o desenvolvedor (`click_id` + `customer_ip`) |
| 5 | **Estado por evento** em `SnippetCheckDTO.porEvento` |

> ### 🔴 A trava do Salvar cobria só o VAZIO — e não era o único jeito de casar com tudo
> `/` e `meusite.com` produzem exatamente o mesmo estrago que a string vazia,
> porque `location.href` **sempre contém o host**. Quem digitasse o domínio
> salvava e toda visita virava checkout iniciado, em silêncio. Hoje
> `analisarTrecho` classifica em `ok · corrigido · largo · vazio`, e os dois
> últimos bloqueiam.

> ### ⛔ Corrige no `onBlur`, nunca a cada tecla
> Normalizar enquanto a pessoa digita reescreveria o texto debaixo do cursor.
> E colar a URL da barra de endereço é o gesto NATURAL de quem está olhando o
> próprio checkout — recusar ali transformaria um acerto de intenção num erro
> de formulário.

> ### 🎯 `porEvento` é o que impede a próxima versão do bug do IC morto
> A gaveta dizia "último evento recebido há 5min" — verdade, era o PageView —
> enquanto o IC não disparava havia semanas. **Um agregado esconde justamente
> o evento que parou.** Só alarma o evento LIGADO e nunca recebido; desligado
> sem registro é o esperado.
>
> ⚠️ Conta só o que veio do NAVEGADOR (`gw:` fora): o IC criado pelo webhook
> provaria que o gateway avisa, não que o script funciona — e é o script que
> esta tela existe para conferir.

> ### ⛔ O campo é `click_id`, NUNCA `sck`
> O parser lê os dois, mas só o primeiro vira `matchClick`. Mandar em `sck`
> grava a string e **não casa clique nenhum**, sem erro em lugar nenhum.

⚠️ **Não verificado no ESTREITO** — ver a nota do item (d): a aba do grupo MCP
vive na própria janela, que continua maximizada.

---

## 🛒 CHECKOUT PRÓPRIO — decisões de 01/08/2026

O usuário está construindo uma **página de vendas com checkout próprio** sobre a
OnyxPag. Isso muda três coisas em relação a um gateway hospedado, e as três já
morderam em outro contexto.

### ⛔ O Purchase é do WEBHOOK, e só dele. Nunca `fbq('track','Purchase')` na /obrigado.

**Decisão do usuário, 01/08/2026.** Vale para qualquer checkout próprio, não só
este. Hoje o nosso script **não dispara Purchase** (a rota `/api/pixel/event`
rejeita: `EVENT_MAP` só tem Lead/AddToCart/InitiateCheckout, mais o PageView) —
quem dispara é `dispatchPurchaseEvents(saleId)` quando a venda entra APROVADA.

Pôr um Purchase de navegador na página de obrigado cria o **segundo caminho sem
`event_id` compartilhado**, e a Meta conta 2. É exatamente o padrão da Kirvano
que foi resolvido em 31/07 — recriado num contexto novo.

> ### 🔴 E aqui NÃO dá para coordenar, só particionar
> Com a Kirvano a partição foi escolha; aqui é a única opção. Purchase não passa
> pelo `/api/pixel/event`, então não existe caminho para os dois lados
> compartilharem o mesmo `eid`. Ou o webhook envia, ou o navegador envia.

**Os três motivos de o dono ser o webhook, na ordem em que pesam:**

| | |
|---|---|
| 1 | 🔴 **PIX pago depois.** O comprador gera o PIX, fecha a aba e paga dois dias depois — **nunca volta à /obrigado**. Só o webhook sabe que a venda existiu. É o motivo decisivo |
| 2 | A /obrigado dispara na **chegada**, não no pagamento. Purchase por PIX apenas gerado é faturamento que pode nunca existir |
| 3 | Server-side atravessa bloqueador de anúncios e leva o `user_data` que montamos (`fbc`/`fbp`, e-mail e telefone com hash) |

> ⚠️ Se um dia o navegador tiver de ser o dono, o caminho é a gaveta do Pixel →
> Purchase = **"O pixel da sua página"**, que faz a Traffik parar de enviar.
> **Nunca os dois** — ver `lib/pixel/donos.ts`.

### 🔗 A OnyxPag não tem via de atribuição — mas o checkout é DELE

`REGISTRO` declara: sem `click_id` ecoado, sem `fbc`/`fbp`, sem IP do comprador.
Venda dela entra sem campanha, sem criativo e sem país. **Num checkout hospedado
isso é limitação do gateway; num checkout próprio é uma escolha de quem monta a
página**, porque a API aceita `tracking`/`metadata` na criação da cobrança.

> ### 🔴 O campo é `click_id`, NÃO `sck`
> O parser lê os dois, mas em destinos diferentes, e só um alimenta o match:
>
> ```ts
> clickId: toStr(pick(trk, ["click_id", "clickId", "trk_click_id"]), 191),  // ← vira o match
> utm: { sck: toStr(pick(trk, ["sck", "client_reference_id", "xcode"]), 191) } // ← texto livre
> ```
>
> `ingestSale` chama `matchClick(userId, data.clickId, …)` — **`utm.sck` não
> entra**. Mandar o click_id em `sck` grava a string e **não casa clique
> nenhum**, sem erro em lugar nenhum. Foi o conselho errado dado numa primeira
> resposta desta sessão, corrigido ao ler o `ingestSale`.

`rastreio(d)` mescla `{...d, ...d.metadata, ...d.tracking}`, então **mandar em
`tracking` e `metadata` ao mesmo tempo é gratuito** e aumenta a chance de um dos
dois voltar no webhook.

> ⚠️ **A doc da OnyxPag NÃO promete devolver `tracking` no webhook.** O parser é
> defensivo. Mandar é necessário e **não é suficiente** — só um payload real
> responde. Confira com `npm run venda:inspecionar -- --gateway ONYXPAG` depois
> da primeira venda: se `clickId` vier nulo com o campo enviado, ela não devolve
> e a atribuição terá de vir por outra via.

### 🧪 `npm run pixel:duplicados` — por que o mesmo evento virou duas linhas

Somente leitura, recortado por `userId`. Confere se o índice único existe (a
`20260731040000` já falhou uma vez em produção), agrupa por *mesma ação*
(usuário + pixel + evento + url + fbclid) e lista os últimos eventos com os
**ingredientes do `eid` lado a lado**, dizendo qual divergiu.

```js
eid(nome) = nome + "-" + hash([CONFIG, nome, location.href, fbclid, Math.floor(Date.now()/10000)])
```

| Divergiu | Causa | De quem é |
|---|---|---|
| `url` | `location.href` mudou entre os POSTs (o Next normaliza query, assenta o router) | da página |
| `fbclid` | o cookie ainda não tinha sido lido na 1ª chamada | da página |
| **só o balde** | 🔴 `Math.floor(Date.now()/10000)` é **balde fixo, não janela deslizante** | **nosso** |

> ### 🐛 O AGRUPAMENTO tinha o mesmo defeito que o aviso — corrigido em 01/08
> A 1ª versão agrupava por (usuário, pixel, evento, url, fbclid) na **janela
> inteira** e chamava tudo de duplicata. Isso juntava **todos os PageView da
> mesma URL em 180 minutos**, e quem está construindo o site recarrega dezenas
> de vezes: ele acusou "CAUSA 3" em eventos a **17, 22 e 40 segundos** de
> distância — recarregamentos legítimos.
>
> Eu tinha corrigido exatamente isso no aviso linha a linha (janela de 30 s) e
> **deixei passar no agrupamento**. Hoje usa `lag()` sobre pares CONSECUTIVOS a
> até 5 s (`--segundos`), que é a única distância em que "mesmo carregamento" é
> explicação possível.
>
> ### ⛔ REGRA: ao endurecer um alarme, procure as OUTRAS SAÍDAS do mesmo módulo
> Um módulo de diagnóstico quase sempre tem mais de um caminho até a tela. Este
> tinha dois — o agrupamento e o aviso linha a linha — e eu corrigi **um**.
> A saída não corrigida continuou afirmando o oposto da corrigida, e é a que o
> usuário leu primeiro.
>
> **É a mesma família do `origem-venda.mjs`**, que separava por dono na
> *exibição* e somava o banco inteiro no *cálculo*: dois caminhos para a mesma
> pergunta, um deles arrumado. Nos dois casos a parte correta deu **falsa
> garantia** — quem viu a separação/janela funcionando não desconfiou da outra.
>
> E é a mesma família do bypass de webhook: endurecer `/api/webhook/kirvano` e
> deixar `/api/webhook/sale/[token]` aceitando a mesma credencial.
>
> **Ao corrigir um limiar, uma janela, um filtro ou uma autenticação: `grep` o
> módulo inteiro pelo mesmo conceito antes de fechar.** Corrigir uma saída de
> duas é pior que não corrigir nenhuma.
>
> ⚠️ E a regra de sempre: diagnóstico que acusa comportamento normal é pior que
> nenhum — ele treina a ignorar o alarme que importa.

### ✅ AS DUAS CAUSAS EXISTEM — medidas em produção, e o gerador foi reescrito

Com o script corrigido, o usuário achou as duas em dados reais:

| Causa | Evidência |
|---|---|
| **1** | `04:42:31.602 /checkout?qty=1` × `04:42:31.606 /checkout?product=snow-foam-sgt-9939&qty=1` — **4 ms**, `location.href` mudou no mesmo carregamento |
| **3** | `04:46:29.591` (balde 178555958) × `04:46:30.512` (balde 178555959) — **921 ms**, mesma URL, cruzou a fronteira |

**`eid()` foi reescrito** (`lib/pixel/script.ts`): saiu `location.href`, saiu o
`fbclid`, saiu o balde fixo. Entrou uma **ÂNCORA por carregamento** —
`Math.random() + Date.now()`, gerada uma vez — mais `location.pathname`.

> ### ⛔ A âncora é POR EVENTO, nunca global
> | | `PageView` | `Lead` · `AddToCart` · `InitiateCheckout` |
> |---|---|---|
> | Quem dispara | o carregamento | o usuário |
> | Dois disparos no mesmo load | a **mesma visita** contada 2× | podem ser **duas intenções reais** |
> | Logo | deduplica SEMPRE (só âncora) | deduplica só se quase simultâneos |
>
> `PageView` usa `[CONFIG, nome, pathname, ANCORA]` — sem tempo nenhum. Os de
> ação acrescentam o instante, mas com **janela DESLIZANTE de 1 s ancorada no
> primeiro disparo** (`ultimoDeAcao`), nunca um balde fixo — é a fronteira que
> criava o bug. Deduplicar dois cliques em "comprar" separados por segundos
> apagaria uma intenção real do funil.

> ⚠️ **`location.href` → `location.pathname`, e não "remover a URL".** O
> `pathname` preserva a distinção entre rotas de uma SPA, que é o motivo de a
> URL estar na chave. Foi a **querystring** que mudou nos dois POSTs medidos, e
> o `pathname` era o mesmo (`/checkout`).
>
> ### ⚠️ LIMITAÇÃO CONHECIDA: PageView some quando só a QUERY distingue a página
> Numa SPA que dispare `PageView` duas vezes no mesmo carregamento para o mesmo
> `pathname`, mudando **só a querystring**, os dois viram **um evento só**.
>
> Hoje é o lado certo de errar — foi exatamente essa mudança de query que
> produziu a causa 1, e o caso comum é ruído, não navegação. Mas o dia em que
> isso morde é previsível: **uma página em que a query É a navegação** — filtro
> de catálogo (`/produtos?categoria=x` → `?categoria=y`), paginação, busca. Ali
> o segundo PageView é legítimo e vai **sumir em silêncio**.
>
> **O sintoma será "PageView faltando", nunca um erro.** Se aparecer, o conserto
> não é voltar ao `location.href` (isso ressuscita a causa 1): é acrescentar um
> contador de PageView por carregamento à chave — o que dedupica o POST repetido
> e preserva a navegação, ao custo de um estado a mais no script.
>
> ⚠️ Vale só para `PageView`. Os eventos de ação já têm o instante na chave.
>
> ⚠️ **O `fbclid` saiu da chave** porque a âncora já distingue visitantes: dois
> navegadores nunca compartilham âncora. Era ele a causa 2.

**`npm run test:eid` — 11 asserções, 0 falhas**, exercitando o script gerado num
DOM falso com relógio e URL controláveis: as duas causas reais reproduzidas
(mesmo id agora), **e os três casos legítimos que NÃO podem deduplicar** —
recarregar a página, mudar de rota na SPA, e dois cliques reais a 3 s.

> ⚠️ **O snippet vive no HTML do cliente.** Quem já instalou continua com o
> gerador antigo até recolar. Ids antigos e novos não colidem, então a mudança é
> segura em qualquer ordem.

### 🌐 AMBIENTE DE TESTE detectado sozinho — o usuário cola o snippet e pronto

**Migration `20260801000000_pixel_event_ambiente`** — `PixelEvent.ambiente`
nullable + índice `(userId, ambiente, timestamp)`. Aditiva, sem backfill: toda
linha antiga continua contando, então aplicar não muda número nenhum na tela.

> ### ⛔ EU RECUSEI ISSO ANTES, E ESTAVA ERRADO
> Meu argumento foi *"muita gente roda produção em `*.netlify.app`"* — e é
> verdade. Mas a proposta nunca foi `*.netlify.app`: era
> **`<hash>--<site>.netlify.app`**, que é um **formato RESERVADO** pela
> plataforma para deploy efêmero. O `--` é o separador que a Netlify usa; um
> domínio de produção não o tem. Eu conflatei "hospedeiro" com "formato" e
> recusei a coisa certa pelo motivo errado.
>
> **Ao recusar uma detecção por ser "heurística frágil", verifique se o que foi
> proposto é um formato garantido pela plataforma.** Palpite sobre o hospedeiro
> é frágil; formato reservado é contrato.

> ### 🔴 E o que tornou o risco aceitável foi MARCAR, não apagar
> A objeção real — perda silenciosa de conversão — morre quando o evento
> **continua gravado**. Ele sai do funil, não vai para a Meta, e a tela diz
> quantos foram. Se a detecção errar, o dado está lá, o número aparece e
> `npm run eventos:marcar -- --limpar --aplicar` desfaz. Erro visível e
> reversível em vez de irreversível e invisível.

**Zero configuração, por exigência do usuário.** Nada de `if` na página do
cliente, nada de declarar domínio, nada de ele saber que o problema existe.
`lib/pixel/ambiente.ts` classifica pelo **formato do host**:

| Ambiente | Formato |
|---|---|
| `preview` | `<algo>--<site>.netlify.app` · `*.netlify.live` · `<projeto>-git-<branch>.vercel.app` |
| `local` | `localhost` · `*.localhost` · `127.*` · `[::1]` · `*.local` · faixas privadas (10/172.16-31/192.168) |
| `tunel` | `*.ngrok*` · `*.loca.lt` · `*.trycloudflare.com` |

> ⚠️ **O preview de hash aleatório da Vercel NÃO entra.** `projeto-a1b2c3d4-escopo.vercel.app`
> tem o mesmo desenho de um projeto chamado `loja-verao-brasil`, e o falso
> positivo aqui tira evento real do funil **e da CAPI**. Só o `-git-`, que é
> reservado.
>
> ⚠️ **URL ausente ou ilegível → PRODUÇÃO**, nunca teste. O `InitiateCheckout`
> que nasce do webhook do gateway não tem URL; marcar por omissão o tiraria do
> funil.

**Ambiente efêmero não vai para a CAPI.** É o único efeito irreversível da
detecção — e é onde os formatos são mais inequívocos (nenhuma loja atende em
`localhost`). Um Purchase de localhost ensina a otimização a procurar ninguém:
o número na tela se conserta relendo o banco, o sinal entregue à Meta não.

**A linha na tela** fica no funil, ao lado do aviso de robô e pela mesma razão
(o rodapé daquele bloco é cortado na altura padrão do grid): *"N eventos de
teste fora do funil"*, com o detalhamento por ambiente no `title`. **Uma
detecção que silencia o que removeu é indistinguível de um bug que come
eventos.**

**`npm run eventos:marcar`** classifica o histórico — simula por padrão,
`ALLOW_PROD_WRITES`, `--email` obrigatório, imprime as duas listas (a que marca
e a que fica) e `--limpar --aplicar` desfaz.

> ⛔ Ele usa a **mesma `ambienteDaUrl()`** da ingestão. A 1ª versão tinha o
> padrão escrito em SQL (`url LIKE '%--%.netlify.app%'`) — duas implementações
> da mesma pergunta, que divergem no primeiro formato novo. O `eventos:limpar`
> que apagava foi **removido**: marcar é melhor em tudo.

> ### 🐛 A autoconferência pegou um bug NO PRÓPRIO VERIFICADOR
> Depois do `--aplicar` ele comparou o funil com o previsto e acusou
> `previsto 10, obtido 12`. A marcação estava certa; a **conferência** é que
> contava sem `AND ambiente IS NULL` — lia as linhas recém-marcadas, que
> continuam no banco justamente porque não apagamos nada.
>
> É o argumento a favor de toda verificação pós-escrita: ela falhou onde
> deveria, e o erro era dela. Sem ela, o script teria dito "pronto" e ninguém
> saberia se o funil mudou.

### 🔁 Previews que só se revelam EM CONJUNTO — regra de REPETIÇÃO

O preview de hash aleatório da Vercel ficou de fora de `FORMATOS` porque
`<projeto>-<hash>-<escopo>.vercel.app` é indistinguível, **numa URL sozinha**,
de um projeto legítimo com hífens. O dado real do usuário trouxe o
contrapadrão:

```
moldes-ahuhuv5fb-noahvivaryder3s-projects.vercel.app
moldes-ralhb1gzf-noahvivaryder3s-projects.vercel.app
moldes-ppxn74d34-noahvivaryder3s-projects.vercel.app
moldes-4i5mg0sx2-noahvivaryder3s-projects.vercel.app
```

**Quatro** hosts, mesmo prefixo, mesmo escopo, diferindo só num segmento do
meio. Nenhum site de produção tem quatro domínios assim. **O sinal não é o
formato de UMA url — é a repetição.**

> ### ⛔ ISTO NÃO RODA NA INGESTÃO, E NÃO PODE RODAR
> A classificação de um evento depende da EXISTÊNCIA de outros. No primeiro
> POST não há repetição para observar, então:
> 1. **não dá para cortar o envio à CAPI com esta regra** — a decisão é tomada
>    antes de a evidência existir;
> 2. os primeiros eventos de uma família nunca seriam marcados ao vivo.
>
> É regra **retroativa**, e o lugar dela é o `eventos:marcar`, que mostra o que
> vai fazer e **espera aprovação**. É a confirmação que torna uma regra ambígua
> segura: um falso positivo é pego pelo usuário, não pela produção. Por isso ela
> sai numa **seção separada** da lista de formatos reservados — misturar faria a
> confiança de uma emprestar credibilidade à outra. `--sem-repeticao` pula.

**O teste decisivo NÃO é "alfanumérico curto".** `cliente1`, `cliente2`,
`cliente3` passariam nisso e um multi-tenant legítimo seria marcado. O que
separa os dois é o **prefixo comum**: hashes de verdade não compartilham começo
(`a`/`r`/`p`/`4`), `cliente1..3` compartilham sete caracteres. `pareceHashes()`
exige `[a-z0-9]{6,14}`, ao menos um dígito, e **prefixo comum ≤ 1**.

Mais: mínimo de **3 hosts**, e só segmentos do MEIO (o primeiro é o projeto, o
último carrega o domínio).

### 🌐 `example.com` — é RFC, não palpite

Investigado: **não vem de código nosso** — as únicas ocorrências de
`example.com` no repositório são e-mails em fixtures, e o testador de payload
nunca grava `PixelEvent`. Origem provável: requisição manual do próprio usuário
ao endpoint público.

Entrou em `FORMATOS` mesmo assim, e por um motivo forte: **RFC 2606 e RFC 6761
RESERVAM** `example.com/.org/.net`, `.test`, `.invalid` e `.example` — a IANA
garante que nunca são delegados. Não existe loja ali. É contrato, como os
formatos de plataforma.

> ⚠️ `example.com.br` e `meuexample.com` **não casam** — são domínios reais e
> delegáveis. Estão no teste.

> 💡 **Como saber se um evento veio de script instalado ou de curl:** o script
> manda `espelho` e `det` em todo POST. Linha com os dois NULOS não veio de um
> navegador com o snippet — veio de requisição manual.

**Testado:** `npm run test:ambiente` — **46 asserções**, a maioria do lado
*"NÃO é teste"*: `sigmatoolsd.netlify.app` (produção do usuário),
`minha-loja.netlify.app`, `loja-verao-brasil.vercel.app`,
`loja.netlify.app/promo--relampago` (o `--` depois do domínio),
`localhost.minhaloja.com`. E ponta a ponta no banco de DEV com as URLs reais:
os 4 de preview/localhost marcados, os 3 de produção intactos, funil 12 → 10,
`--limpar` desfazendo. Linhas removidas por id depois.

> ### ⏳ ORDEM DE DEPLOY
> `npx prisma migrate deploy` na produção **e só então** o push. O código novo
> faz `SELECT` de `ambiente` em toda carga do dashboard.
>
> Depois do deploy, opcionalmente:
> `npm run eventos:marcar -- --url '<conn>' --email <você>` (simula primeiro).

### 🔴 O conserto da causa 3, se ela se confirmar (histórico — CONFIRMOU)
> Duas chamadas a 1 ms de distância caem em baldes diferentes sempre que cruzam
> uma fronteira de 10 s. A probabilidade é baixa (≈ Δt/10000) e **não é zero** —
> e é sistemática, não aleatória: todo usuário com dois POSTs por carregamento
> a pega eventualmente.
>
> **A correção NÃO é aumentar o balde** — isso só dilui o problema e passa a
> juntar ações genuinamente distintas (dois cliques reais em "comprar" viram um
> evento só). O tempo tem de **sair da chave**: o id passa a derivar de uma
> âncora estável do carregamento, gerada uma vez e reusada.
>
> Um `sessionStorage`/variável de módulo com um id por *pageview*
> (`CONFIG + nome + pageviewId`) resolve as três causas de uma vez: sobrevive ao
> `location.href` mudando, não depende do `fbclid` já estar lido e não tem
> fronteira para cruzar. **Custo:** o mesmo evento disparado de propósito duas
> vezes na mesma página passa a deduplicar — o que para `PageView` é certo e
> para `InitiateCheckout` **não é** (dois cliques reais em "comprar" são duas
> intenções). Então a âncora tem de ser por evento, não global: `PageView` usa a
> do carregamento; os de ação continuam precisando de um discriminador.
>
> ⚠️ **Não implemente antes de o script dizer que é a causa 3.** As causas 1 e 2
> são muito mais prováveis e não exigem mexer no gerador.

### ⚠️ `listTestablePixels` — defeito de ROTULAGEM, não de staleness

`where: { userId }`, sem escopo de área: o seletor do Teste de Pixel lista os
pixels de **todas** as áreas, rotulados só como `nome (N pixels da Meta)`, sem
dizer de qual área cada um é.

**Não é a família da `UtmsView`, e a distinção decide a prioridade:**

| | UtmsView | Teste de Pixel |
|---|---|---|
| A lista está errada? | sim — **stale** | não — global, sempre completa |
| Quem escolhe | ninguém: você copia o que está na tela | **você**, num dropdown |
| O erro persiste? | sim, no site do cliente | não, é um evento de teste |

O único jeito de errar é confundir dois pixels **pelo nome**. Consequência: um
Purchase de teste de R$ 1 na CAPI do pixel errado — chato, não permanente.

**Fica sem subir na fila** (decisão do usuário, 01/08/2026: hoje há uma área só
com pixel, então o risco não existe). O conserto, quando vier, é de uma linha:
mostrar a área no rótulo, ou escopar a consulta.

### ➖ `AddPaymentInfo` não é nosso

Não está em `EVENTOS_DO_PIXEL` nem no `EVENT_MAP` — `/api/pixel/event`
responderia **400**. Se ele aparece disparando com valor numa página, é o `fbq`
do próprio usuário ou a biblioteca do checkout. Nós não emitimos nem
registramos. **Sem ação.**

---

## 🔒 PROTEÇÃO PREVENTIVA: padrão aprovado bloqueia na ingestão (01/08/2026)

Fecha a assimetria: a Netlify era **preventiva** (formato reservado), a Vercel
era **retroativa** (regra de repetição) — então todo preview novo dela já tinha
ido para a CAPI antes de qualquer coisa marcá-lo.

**Migration `20260801010000`** — `User.testHostPatterns` (Json, nullable).

Ao APROVAR uma família (`eventos:marcar --aplicar`), o padrão
`moldes-*-noahvivaryder3s-projects.vercel.app` é guardado e passa a valer **na
ingestão**, como os formatos.

> ### 🔴 Aprovar amplia o ALCANCE, nunca afrouxa o teste
> Casar o molde **não basta**: `casaPadrao` ainda exige que o segmento variável
> pareça hash. `moldes-producao-noahvivaryder3s-projects.vercel.app` casa o
> desenho e **não bloqueia**, porque `producao` é palavra.
>
> É o critério "errar para o lado seguro" aplicado: bloquear é irreversível (o
> evento não vai para a CAPI e não volta), então a aprovação estende o alcance
> de uma regra que continua rigorosa. Ela exige, cumulativamente: mesmo número
> de segmentos, todos os fixos idênticos, **exatamente um** curinga, ele **no
> meio** (nunca no primeiro nem no último, que carregam projeto e domínio), e o
> teste de hash.

> ### ⛔ A ordem é CONTRATO primeiro, escolha depois
> `FORMATOS` decide antes da lista aprovada. Se um dia discordarem, quem manda é
> o contrato de plataforma — a lista do usuário só age sobre o que sobrou.

> ### ⚠️ Custo zero no caminho quente
> Os padrões viajam no **mesmo `include`** do `PixelConfig` que a rota já fazia
> (`user: { select: { testHostPatterns: true } }`). Nenhuma ida extra ao banco
> num endpoint público que roda em toda visita. Foi por isso que virou coluna
> Json em `User`, e não tabela.

> ### 🔴 A REVERSÃO MORA NA TELA, não no SQL
> **Integrações › Testes › "Endereços que não contam como visita"** lista os
> padrões aprovados com botão Remover. Uma regra de bloqueio que só saísse por
> SQL seria irreversível na prática — e irreversível é exatamente o que ela não
> pode ser. O card **só aparece quando há padrão**: nada a gerenciar = nada na
> tela.

**Testado:** `npm run test:ambiente` — **58 asserções**. As 12 novas são quase
todas RECUSAS: segmento que é palavra, outro escopo, outro projeto, segmentos a
mais, produção do mesmo projeto, domínio próprio, lista vazia.

**E exercitado AO VIVO** contra `/api/pixel/event` (dev), com o padrão guardado:

| POST | Resposta |
|---|---|
| host **novo** do padrão | `{"registrado":true,"enviado":false,"motivo":"ambiente de teste","ambiente":"preview"}` |
| `moldes.tiarosi.online` | não caiu na regra de ambiente |
| `moldes-**producao**-…` | não caiu na regra de ambiente |
| `sigmatoolsd.netlify.app` | não caiu na regra de ambiente |

> 🐛 **O primeiro probe deu 500** — o dev server rodava com um cliente Prisma
> gerado ANTES da coluna existir. Não era bug de código (`tsc` e `build`
> passavam); era processo velho. **Depois de `prisma generate`, reinicie o dev
> server antes de sondar** — senão o 500 parece regressão e não é.

---

## ✅✅ DEDUP CONFIRMADA NO GERENCIADOR DE EVENTOS DA META (31/07/2026)

**O usuário confirmou: o `InitiateCheckout` aparece como *"enviado por API de
Conversões e navegador"*, numa entrada ÚNICA.**

Isto fecha o ciclo que começou com **"1 venda real, o Gerenciador de Anúncios
marcando 2"**. A Meta estava contando cada conversão duas vezes e otimizando as
campanhas com sinal inflado — dinheiro real, sem erro e sem log em lugar nenhum.

> ### 🔴 A EVIDÊNCIA É DO LADO DA META, e é isso que a torna conclusiva
> Tudo que tínhamos até aqui provava o NOSSO lado: o `eid` no formato
> `InitiateCheckout-90whss` só sai do nosso `eid()`, o único ponto que chama
> `fbq('track', …, {eventID})` é o `espelhar()`, e o par não pode divergir por
> construção (o `track()` calcula o id UMA vez e entrega a mesma variável ao
> espelho e ao payload).
>
> **Nada disso prova que a META juntou os dois.** Só o Gerenciador de Eventos
> responde isso, e a resposta é binária: uma entrada marcada "API de Conversões e
> navegador" = juntou; duas entradas separadas = não juntou. Foi a segunda ponta
> que faltava, e ela não tinha substituto do nosso lado.
>
> ⚠️ **Não confunda com o `sent: 1` da nossa resposta.** Ele diz que a CAPI
> aceitou o evento, não que ela o casou com o do navegador. Era exatamente essa
> confusão que mantinha o bug invisível: a nossa CAPI respondia `sent: 1` o tempo
> todo enquanto a Meta contava dois.

### Estado final, evento a evento

| Evento | Situação |
|---|---|
| ✅ `PageView` | 1 requisição `/tr`, **sem `eid`**, dono é o pixel da página. Sem duplicação — é a partição funcionando, não coordenação |
| ✅ `InitiateCheckout` | espelho disparando, **dedup confirmada na Meta** |
| ⬜ `Lead` | toggle desligado; o usuário não tem formulário no funil atual |
| ➖ `AddToCart` | **não se aplica** — checkout hospedado pelo gateway, sem carrinho |

> ⚠️ **`AddToCart` saiu da lista de pendências, mas o detector dele continua sem
> nunca ter rodado.** A heurística é fixa (regex de "carrinho"/"comprar" no texto
> ou na classe) e nunca foi exercitada contra uma página real. Não é dívida deste
> usuário — o funil dele não tem carrinho —, mas **é dívida do produto**: no dia
> em que alguém com carrinho ligar o toggle, essa regex será exercitada pela
> primeira vez em produção.
>
> ⚠️ O mesmo vale para `Lead`, em menor grau: o caminho existe e passa nos testes
> em DOM falso (`npm run test:espelho`), mas nunca disparou num formulário real.

---

## 📞 Telefone em E.164 antes do hash da CAPI

`capi.ts` fazia `phone.replace(/\D/g, "")` — tirava a pontuação e **deixava o
número sem DDI**. `(11) 98765-4321` virava `11987654321`, enquanto a Meta espera
`5511987654321`. O SHA-256 dos dois é diferente, então **o telefone nunca casava
com ninguém**: um sinal de correspondência perdido em toda venda.

Não é privacidade — é **qualidade de match**, que alimenta otimização de campanha
e público semelhante.

`lib/facebook/telefone.ts` desambigua por COMPRIMENTO, porque no Brasil o DDI
(`55`) colide com um DDD válido (55, Santa Maria/RS):

| Dígitos | Leitura |
|---|---|
| 10 | DDD + fixo → prefixa `55` |
| 11 | DDD + celular → prefixa `55` |
| 12–13 começando em 55 | já tem DDI |

⚠️ `55987654321` é **DDD 55 + celular**, não DDI — número nacional brasileiro tem
no mínimo 10 dígitos.

✅ **Validado contra o formato REAL da Kirvano**, confirmado pelo usuário em
30/07/2026 de venda real: **`+55 (33) 98875-6674`**. O `+` inicial declara que o
número já é internacional, então os dígitos são usados como estão
(`5533988756674`) sem inferir DDI. O teste cobre também o mesmo número **sem o
`+`** e **sem o DDI**, que são os caminhos que dependem da desambiguação por
comprimento.

**O que a CAPI envia hoje** (auditado): `email`, `phone` e `country` com
**SHA-256** ✅; `client_ip_address` e `client_user_agent` em texto claro —
**exigência da Meta**, que recusa esses dois hasheados. Nome do comprador **não
é enviado**.

---

## 🔴 O FUNIL É DO RASTREAMENTO; O PIXEL É DESPACHANTE (05/08/2026)

Relatado: dois checkouts para a MESMA jornada na Atividade Recente.

```
Venda pendente · Direto · R$ 92,81 · 31s
Checkout · Gateway ·                 31s
Checkout · Pixel · sigmatools.shop/ · 2min
Clique · Direto ·                    2min
```

### A causa: `fbclid` era a chave de jornada, e ela não existe em tráfego direto

A dedup existia em DOIS lugares, e os dois chaveavam nela:

| Onde | Como era | Em tráfego direto |
|---|---|---|
| `checkoutEvent.ts` | `if (fbclid) { …procura o evento do navegador em 6h… }` | 🔴 o bloco inteiro era **pulado** |
| `metrics.ts` (funil) | chave `fbclid \|\| eventId \|\| row:id` | 🔴 caía no `eventId`, que é `InitiateCheckout-<hash>` no navegador e `gw:<pedido>` no gateway — **diferentes por construção** |

> ### ⛔ Não era janela curta demais. Era CHAVE AUSENTE.
> `fbclid` só existe para tráfego de anúncio do Facebook. Aumentar a janela de 6h
> não consertaria nada — não havia o que comparar.

### O `click_id` sempre esteve disponível, e era jogado no lixo

O `t.js` grava `{click_id, fbclid, utm_*}` no cookie `traffik_track`. O `px.js`
lia **esse mesmo cookie** e extraía só o `fbclid`, descartando o `click_id` que
estava do lado.

### A separação, e por que ela torna duplicar IMPOSSÍVEL

**Migration `20260805200000_checkout_na_jornada`** (aditiva): `Click.checkoutAt`,
`Click.checkoutSource`, `PixelEvent.clickId`.

| Responsabilidade | Dono |
|---|---|
| Funil (clique, visita, **checkout**) | **`Click` — o rastreamento** |
| Despachar `IC`/`Purchase`/`Lead`/`AddToCart` para a Meta | **o pixel** |

As duas fontes agora escrevem na **mesma linha** (`Click.checkoutAt`). Não há
janela de dedup para acertar nem chave para faltar — é o mesmo princípio do
upsert monotônico de vendas: **quem resolve o conflito é o banco**.

- `/api/pixel/event` resolve a jornada com **`matchClick`** (`click_id` → `fbclid`
  → IP), a MESMA função das vendas. Reusá-la é o que impede as duas resoluções de
  divergirem — e o caminho por **IP** cobre quem ainda não recolou o snippet.
- `checkoutEvent.ts` marca via `sale.clickId`.

> ### ⚠️ Vence o instante MAIS ANTIGO
> O clique no botão vem antes de o gateway gerar o PIX. Se o webhook
> sobrescrevesse, a etapa andaria para a frente no tempo e, num período curto,
> sairia da janela em que a visita que a gerou está.

> ### ⚠️ `PixelEvent` NÃO deixou de existir — deixou de ser fonte do funil
> Ele é o registro do que foi **despachado**, com `espelho`, `detectores` e
> `ambiente`, e é disso que o diagnóstico da gaveta vive. `Lead`, `AddToCart` e
> `PageView` continuam saindo dele no feed: são eventos de pixel, não etapas de
> funil.

> ### ⚠️ Checkout SEM jornada continua contando
> Venda que não casou clique nenhum (comprador que nunca passou pelo script) vira
> `PixelEvent` com `gw:<pedido>` e é **somada** ao funil. As duas populações são
> disjuntas. Sem isso, o checkout de quem não é rastreável desapareceria — e é
> justamente o número que denuncia rastreamento não instalado.

### O que MELHOROU de quebra

- **O Gerenciador perdeu uma consulta ao banco** e ganhou precisão: o IC era
  atribuído por `fbclid → Click → UTM`, com `if (!e.fbclid) continue`. Todo
  checkout de tráfego direto **nunca chegava à coluna IC nem ao CPI**. Agora o
  clique já traz `checkoutAt` e os UTMs na mesma linha.
- O feed credita **quem detectou** (`Pixel` ou `Gateway`), o que permite ver na
  tela se o detector do script está vivo.

⚠️ **O número do funil VAI MUDAR:** sobe onde havia tráfego direto perdido, desce
onde havia duplicata. É correção, não regressão — mas é visível.

⚠️ **Histórico não foi reprocessado.** `PixelEvent` antigo fica com `clickId`
nulo, então conta como "sem jornada" — o total histórico não se perde, mas as
duplicatas que já existem continuam lá. Um backfill só recuperaria a metade do
gateway (`gw:<pedido>` → `Sale` → `clickId`); o evento do navegador em tráfego
direto não tem como ser religado, porque `PixelEvent` não guarda IP.

## 🔴 O DETECTOR DE CHECKOUT ERA CEGO A BOTÃO QUE NÃO É `<a href>`

O testador usa **Cakto**, recolou o snippet, e o `InitiateCheckout` não aparecia.

**O domínio não era o problema:** `pay.cakto.com.br` casa com `cakto`, que está em
`CHECKOUT_PADRAO`. E o tipo resolvido é `clique_checkout`, o padrão correto.

O detector subia a árvore procurando **só `<a>` com `href`**. Construtor de página
moderno raramente entrega isso: o botão de compra costuma ser `<button>`, um `<a>`
sem `href`, `href="#"` com navegação por JS, ou `<div data-href>`. Em todos esses
casos `href` ficava vazio, o `return` acontecia, e **nada era registrado nem
logado**.

Hoje vale qualquer atributo que CARREGUE uma URL: `href`, `data-href`, `data-url`,
`data-link`, `action` — descartando `#` e `javascript:`, que não são destino.

> ### ⛔ Ampliar de ONDE a URL vem não afrouxa QUAL URL conta
> O teste do domínio é o mesmo. Metade das asserções de `test:checkout-detector`
> é do lado *"NÃO deve disparar"* justamente para impedir que a correção vire um
> detector que dispara em tudo — inclusive a que prova que **texto "comprar"
> sozinho não basta**.

**`VERSAO` do detector foi para `v4`**, porque as duas mudanças (mandar `click_id`,
ver botão sem `<a>`) são invisíveis na assinatura. Sem subir a versão, um snippet
`v3` continuaria reportando "✓ corresponde" enquanto duplica checkout e não vê o
botão. A gaveta agora pede para recolar.

**Testes:** `npm run test:checkout-jornada` (14 asserções, banco de DEV — as duas
ordens de chegada, o feed com UMA linha, e o CONTROLE de que jornadas diferentes
não fundem) · `npm run test:checkout-detector` (17, puro — exercita o script
GERADO num DOM falso; falsificabilidade verificada reintroduzindo o `<a href>`:
4 asserções ficam vermelhas).
