# Geolocalização — IP, países, bot e anonimização

> Leia ao mexer em país de venda/clique, extração de IP, marcação de bot, ou
> na purga de IP. A ordem dos passos aqui é inegociável: o hash é
> irreversível e destrói a fonte dos passos anteriores.

> ⬆️ **Regras que valem sempre** (PROCEDIMENTO, ordem de migration, guarda de
> escrita em produção, padrões nomeados, estado atual e fila) estão no
> **`CLAUDE.md`** na raiz. Este arquivo é o detalhe de um tema.

---

## 🌐 IP do visitante e `PROXIES_CONFIAVEIS` (30/07/2026)

`src/lib/geo/clientIp.ts` é a **única** função que decide o IP do visitante.
Havia **três** cópias (`/api/track/click`, `/api/pixel/event`,
`webhook/ingestSale`), todas com `x-forwarded-for.split(",")[0]`.

> ### 🔴 `split(",")[0]` é confiar no CLIENTE
> `X-Forwarded-For` é um header comum: qualquer um manda
> `X-Forwarded-For: 8.8.8.8`. O proxy **acrescenta** o IP real ao **FIM** da
> cadeia — o começo é o que o cliente inventou.
>
> ```
> X-Forwarded-For: <mentira>, <real>, <proxy1>, <proxy2>
>                   ↑ nunca               ↑ N proxies nossos
> ```
>
> Conta-se da **direita**, pulando `PROXIES_CONFIAVEIS`.
>
> ⚠️ E numa VPS atrás de nginx **sem** XFF, o IP visto é `127.0.0.1` — todo
> visitante viraria "não identificado", e o sintoma só apareceria depois da
> migração, com tráfego real já perdido.

### Qual valor usar

| Ambiente | `PROXIES_CONFIAVEIS` |
|---|---|
| Vercel | **1** (a borda acrescenta um salto) |
| VPS + nginx/Caddy | **1** (com `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for`) |
| Cloudflare + nginx | **2** — mas o `cf-connecting-ip` já resolve sozinho |
| Sem proxy nenhum | **0** |

**Não deduza: use `GET /api/diagnostico/ip`.** Ele mostra o que cada valor
produziria com os headers daquela requisição; a linha cujo IP for o seu é a
configuração certa.

> ### 🔒 A rota é DESLIGADA por padrão — procedimento de uso
> 1. Defina **`DIAGNOSTICO_IP=1`** no ambiente e faça o redeploy/restart.
> 2. Abra `/api/diagnostico/ip` **logado**, compare com o seu IP público real e
>    anote o valor certo de `PROXIES_CONFIAVEIS`.
> 3. **Remova a variável** e faça o redeploy. A rota volta a responder 404.
>
> Sem a variável ela responde **404, não 403** — o 403 confirmaria que a rota
> existe; o 404 é indistinguível de uma rota que nunca foi escrita.
>
> ⚠️ Exigir sessão **não bastava**: a rota ecoa os headers de proxy do ambiente,
> e uma superfície de diagnóstico não deve ficar de pé em produção só porque tem
> senha — é infraestrutura exposta o tempo todo para servir a um uso de minutos.
> Falha FECHADA, como o `cronAuth` e os webhooks.

> ⚠️ A rota **não adivinha sozinha**, de propósito. A heurística óbvia — contar
> IPs privados no fim da cadeia — funciona na VPS e **falha na Vercel**, onde a
> borda tem IP público. Palpite que acerta num ambiente e erra no outro é pior
> que nenhum.
>
> ⚠️ **Errar para MAIS aceita IP forjado. Errar para MENOS grava o IP do
> proxy** e todo visitante vira o mesmo endereço.

**`npm run test:ip` — 27 asserções**: Vercel, VPS+nginx (XFF e X-Real-IP),
Cloudflare+nginx, conexão direta, tentativas de forjar, IPv4 com porta, IPv6 com
colchetes, CGNAT, `unknown`, e `PROXIES_CONFIAVEIS=2`.

## 🌍 GEOLOCALIZAÇÃO — ESTADO ATUAL (30/07/2026, sessão 2)

### ✅ LIGADA — passos 1 e 2 feitos

A base deixou de ser inerte: `/api/track/click` e a ingestão de venda resolvem o
país e gravam em `Click.country` / `Sale.country`. **O backfill do histórico
ainda não rodou em produção** — é o único passo manual que sobrou antes do
passo 3.

| | Onde | O que faz |
|---|---|---|
| ✅ | `/api/track/click` | `resolverPais(header, ip)` — aqui quem requisita **é** o visitante |
| ✅ | `webhook/ingestSale.ts` | `paisDaVenda()` — 4 fontes, **nenhuma delas o IP da conexão** |
| ✅ | `matchClick` | passou a devolver o país do clique casado, 3ª fonte da venda |
| ✅ | `npm run geo:backfill` | simula por padrão; `--aplicar` escreve. Idempotente |
| ⏳ | produção | **rodar o backfill** (ver o roteiro abaixo) |

> ### 🔴 O IP DA CONEXÃO DE UM WEBHOOK NÃO É O COMPRADOR
> Quem abre a conexão num webhook é o servidor do gateway. Passar esse IP — ou o
> `x-vercel-ip-country` daquela requisição — para `resolverPais()` carimbaria
> **toda venda** com o país do datacenter da Kirvano. Seria um país real, com
> vendas reais, e nada denunciaria o erro. Por isso `resolverPais()` só é chamada
> no `/api/track/click`, e a venda usa `paisDaVenda()`, nesta ordem:
>
> | # | Fonte | Por quê |
> |---|---|---|
> | 1 | `country` do payload, **se já for ISO-2** | o gateway conhece o comprador |
> | 2 | IP **do payload** (`buyer_ip`, `customer.ip`) | é o IP do comprador |
> | 3 | País do clique casado | o visitante falou direto conosco naquele momento |
> | 4 | `country` cru do payload | último recurso, para não sumir do ranking |
>
> ⚠️ **`normalizarPais()` recusa o que não é ISO-2.** Gateways mandam `"Brasil"`,
> `"BRA"`, `"brazil"` — e um `"BRASIL"` gravado na coluna não casa com nada no
> mapa nem no ranking, virando país fantasma. Recusar é o que deixa a resolução
> por IP assumir, que acerta.
>
> ⚠️ **O `country` do CORPO não vence o servidor** no `/api/track/click`: o corpo
> vem do navegador e é forjável. Nenhum script envia esse campo hoje, mas a ordem
> tinha de estar certa antes de algum passar a enviar.

> ### ⚠️ O upsert monotônico não pode APAGAR o país
> A "gerada" pode chegar sem clique casado e a "paga" já com ele — ou o inverso.
> O `updateMany` só grava `country` quando tem um, pelo mesmo motivo do `clickId`:
> sobrescrever com `null` apagaria o país já descoberto.

### 🧪 Verificado ponta a ponta (dev server + banco de dev) — 17 asserções, 0 falhas

| Caso | Resultado |
|---|---|
| IP brasileiro, 1 proxy | `BR` |
| **XFF forjado** (`8.8.8.8` na frente da cadeia) | `BR` — a mentira do cliente foi ignorada |
| `x-vercel-ip-country: PT` (atalho) | `PT` |
| Corpo forjando `country=US`, IP irlandês | `IE` — o servidor vence |
| IPv6 | `null` — nunca país errado |
| **Venda sem fonte, conexão de `8.8.8.8`** | `null` — **o IP do gateway NÃO virou US** |
| Venda com IP do comprador no payload | `BR` |
| Venda com `"Brasil"` + IP holandês | `NL` — texto livre recusado |
| Venda com `"pt"` no payload + IP `BR` | `PT` — payload ISO-2 vence |
| Venda casada por `click_id` | herdou o `IE` do clique |
| Pendente com país → aprovada **sem** país | continua `PT` |
| Pendente sem país → aprovada com IP `BR` | virou `BR` |
| Backfill: 2ª passada | **0 resolvidos** (idempotente) |

Dados de teste removidos por id depois (7 vendas, 5 cliques, 1 webhook, 2 eventos,
9 logs, 9 notificações órfãs — a `Notification.saleId` é `SetNull`, então elas
**não** somem com a venda). `tsc`, `lint` e `next build` limpos.

### ✅ Backfill APLICADO em produção (30/07/2026)

| | Antes | Depois |
|---|---|---|
| Cliques com país | 0 | **237** — BR 147 · US 65 · IE 25 |
| Vendas com país | 2 | **15** (todas pelo IP do comprador no payload) |
| Vendas irrecuperáveis | — | **11** (sem IP nenhum no payload) |

O backfill IPv4 e o IPv6 acabaram rodando **num único `--aplicar`**, porque a
execução IPv4 anterior tinha ficado só na simulação. **Não deu diferença: o
script é idempotente** (`UPDATE … AND country IS NULL`), então a passada única
com a base completa resolveu os dois de uma vez.

> ⚠️ As 11 vendas sem IP são **perda definitiva**, não pendência. Nenhum passo
> futuro as recupera — o payload daquelas vendas nunca teve IP do comprador.

### 🔌 REQUISITO DE TODA INTEGRAÇÃO DE GATEWAY NOVA

> ### 🔴 Pergunte SEMPRE: este gateway manda o IP do comprador no payload?
>
> É a diferença entre geolocalização **medida** e **estimada**, e ela não
> aparece na tela sozinha — o número fica plausível dos dois jeitos.
>
> | O gateway manda IP? | O que acontece |
> |---|---|
> | **Sim** (Kirvano) | `Sale.country` vem do IP real do comprador. Confiável. |
> | **Não** | A venda cai no **fallback do clique** — e 55,6% dos cliques passam pelo datacenter da Meta, então o país é palpite |
>
> Ao integrar um gateway, cheque no payload real as chaves que
> `normalizeSale` procura: `ip` · `buyer_ip` · `customer.ip` · `ip_address`. Se
> nenhuma vier, **registre aqui** — e considere pedir o campo ao gateway, que
> costuma existir e só não vir por padrão.
>
> ⚠️ **Zero vendas dependem do fallback hoje.** Isso é propriedade da **Kirvano**,
> não do nosso desenho. Não escreva código assumindo que `Sale.country` é sempre
> confiável.

**A ferramenta detecta sozinha.** `computeDashboard` conta, por país, quantas
vendas herdaram o país do clique em vez de trazer o próprio (`byCountry[].estimadas`),
e o ranking marca com um chip **âmbar "estimado"**, com o motivo no `title`.
Nenhuma migration foi necessária: `Sale.country` nulo + `Click.country` presente
**é** a assinatura do fallback.

| Gateway | Manda IP do comprador? | Verificado em |
|---|---|---|
| **Kirvano** | ✅ sim (`customer.ip`) | 30/07/2026, 15 vendas reais |
| **Cakto** | 🔴 **não** — capacidade declarada `ipDoComprador: false` | 31/07/2026, **PIX real pago**. É o primeiro gateway cuja geografia depende do clique |
| **OnyxPag** | 🔴 **não** — e também não manda `fbc`, `fbp` nem `click_id` | 31/07/2026, pela documentação. Sem nenhuma via de atribuição: a venda entra sem campanha e sem país |
| Hotmart | ❓ não integrado | — |
| Kiwify | ❓ não integrado | — |
| Cartpanda | ❓ não integrado | — |
| Chave de API (`/api/webhook/ingest`) | ⚠️ depende de quem envia | documentar no "Como usar" |

### 📋 Como rodar o backfill em PRODUÇÃO

```bash
# 1. BACKUP primeiro — o passo 3 é irreversível e o Supabase Free não tem PITR
npm run backup -- --url '<connection string de produção>'

# 2. SIMULE (não escreve nada) e leia os números
npm run geo:backfill -- --url '<connection string de produção>'

# 3. Só depois de conferir:
ALLOW_PROD_WRITES=EU_QUERO_MESMO_ESCREVER_EM_PRODUCAO \
  npm run geo:backfill -- --url '<connection string de produção>' --aplicar
```

- **Sem `--aplicar` é só leitura.** Imprime quantos resolveu, por qual fonte, e
  quantos ficaram sem país **com o motivo** (sem IP · IP privado · IPv6 · IPv4
  fora da base). É esse relatório que diz se o resultado faz sentido.
- **Cliques primeiro, vendas depois** — a 3ª fonte da venda é o país do clique,
  que acabou de ser preenchido. Na ordem inversa quase nada herdaria.
- **Idempotente**: o `UPDATE` tem `AND country IS NULL`, então rodar duas vezes
  não mexe no que já foi resolvido.
- A trava exige a autorização por extenso porque escreve em produção — e com
  `--url` o script **reescreve `process.env.DATABASE_URL` antes de chamar o
  guard**, senão a trava avaliaria o banco errado e liberaria indevidamente.

> ⚠️ **O backfill lê o IP do comprador de dentro do `Sale.rawPayload`.** É
> exatamente esse campo que o passo 3 vai limpar — daí a ordem ser inegociável.

### ✅ Pronto e testado desde a sessão anterior

- **Extração de IP única e testável** (`lib/geo/clientIp.ts`), cobrindo Vercel,
  VPS+nginx e Cloudflare. Substituiu **três** cópias de
  `x-forwarded-for.split(",")[0]`, que pega o valor que o CLIENTE controla.
- **Base `user-country`**: 290.457 faixas · 251 países · 1,4 MB binários ·
  **PDDL-1.0** (domínio público, sem exigir conta). Artefato **commitado**.
- **`npm run geo:atualizar`** regenera o artefato (rotina mensal).
- **`resolverPais()`** funcionando: header da plataforma como **atalho**, base
  local como **caminho principal** — sem o header o resultado é **idêntico**.
- **`/api/diagnostico/ip`** protegida por `DIAGNOSTICO_IP` (**404** sem a
  variável — 404 e não 403, para nem confirmar que a rota existe).
- **186 asserções em 6 suítes, 0 falhas** (`pais` 30 · `ip` 27 · `telefone` 28 ·
  `financeiro` 42 · `periodo` 33 · `areas` 26).

### ⏳ ORDEM DOS PASSOS — revisada em 30/07/2026 (sessão 2)

| | Passo | Estado |
|---|---|---|
| 1 | Chamar `resolverPais()` nas rotas | ✅ feito |
| 2 | Backfill IPv4 do histórico | ✅ script pronto · **usuário rodou** |
| 3 | **IPv6 na base** + cobertura mundial do mapa | ✅ feito nesta sessão |
| 4 | Rodar o backfill de novo (recupera as vendas IPv6) | ✅ **aplicado — 237 cliques · 15 vendas** |
| 5 | Marcação de bot (`Click.bot`) | ✅ **feito — tem MIGRATION, ver ordem de deploy** |
| 6 | Correção do navegador embutido de app | ✅ **feito — tem MIGRATION** |
| 7B | **Purga progressiva do `Click.ip`** + retenção do `WebhookLog` | ✅ **feito** — sem migration |
| 7A | **Limpeza do IP nos payloads** | ⏸️ **ADIADO** — depende da arquitetura de parsers |

> ### 🔴🔴 O HASH DO IP É O ÚLTIMO PASSO, E DEPENDE DE TODOS OS ANTERIORES
>
> Ele é **irreversível**: destrói a única fonte de que os passos 2, 3 e 6
> dependem. Cada passo anterior que ficar para depois dele fica para **nunca**.
>
> A ordem já quase se inverteu uma vez: o plano original era anonimizar logo
> depois do backfill IPv4, e isso teria congelado **50% das vendas sem país**
> — todas IPv6, todas brasileiras, incluindo uma aprovada. O que salvou foi
> medir antes de executar.
>
> **Antes do passo 7, confirme que estão resolvidos:**
> - [ ] Backfill rodado **depois** do IPv6, com a contagem conferida
> - [x] Bot marcado ✅ (usa `userAgent`, que o hash **não** apaga)
> - [x] Navegador de app resolvido ✅ — e a solução escolhida **não usa o IP**
>       para detectar datacenter, então o hash deixou de ter essa dependência.
>       Se tivéssemos ido pela base de ASN, o passo 7 ficaria bloqueado para
>       sempre: comparar com faixas exige o IP legível.
>
> **E exige backup imediatamente antes:**
> ```bash
> npm run backup -- --url '<connection string de produção>'
> ```

## 🌐 IPv6 e cobertura mundial do mapa (30/07/2026, sessão 2)

### Por que o IPv6 deixou de ser opcional

Medido no backup de produção: **100% das vendas sem país eram IPv6** — 14 de 14,
todas do bloco `2804:29b8::/32` (LACNIC/Brasil), **incluindo a única venda
aprovada** entre elas. E **0 cliques eram IPv6**.

Não é coincidência: o clique chega pelo navegador (o site é servido em IPv4),
mas o gateway registra o IP do comprador na rede móvel ou de casa, onde o IPv6
já é padrão no Brasil. **A tabela `Sale` é IPv6; a `Click` é IPv4.**

| | Antes | Depois |
|---|---|---|
| Vendas com país (backup real) | 2 de 26 | **15 de 26** |
| Cliques com país | 237 | 237 (já eram IPv4) |

### O prefixo é truncado em 64 bits

| Prefixo | Entradas | Faixas perdidas | Binário |
|---|---|---|---|
| **64 (escolhido)** | 329.970 | 12.417 (4,5%) | **2,84 MB** |
| 56 | 262.590 | 87.061 (32%) | 2,00 MB |
| 48 | 240.242 | 104.720 (38%) | 1,60 MB |

Os cortes menores economizam pouco e descartam um terço das faixas. As 4,5%
perdidas em 64 são alocações mais específicas — cliente único, que herda o país
do bloco que o contém, quase sempre correto.

> ### ⚠️ Nada de BigInt no caminho quente
> `ipv6ParaPrefixo()` devolve **dois `number` de 32 bits** (`alto`, `baixo`), e a
> busca binária compara lexicograficamente. BigInt aloca no heap a cada
> operação, e isto roda em toda requisição de clique e em toda venda. O gerador
> usa BigInt — ele roda uma vez por mês, na sua máquina.

> ### ⚠️ IPv4-mapeado (`::ffff:1.2.3.4`) tem desvio próprio
> É um IPv4 escrito em notação IPv6: a base de IPv6 **não** o cobre, a de IPv4
> sim. Sem o desvio em `paisDoIp`, todo cliente atrás de um proxy dual-stack
> cairia em "não identificado".

> ### ⚠️ `*` seguido de `/` FECHA O COMENTÁRIO
> Escrever `**/64**` num bloco `/** … */` quebrou o gerador e depois o `pais.ts`
> com `SyntaxError`. Nos comentários deste projeto, prefixo IPv6 se escreve
> **sem barra** ("truncado em 64 bits").

> ### 🔒 A guarda de 256 países não é teórica
> O índice do país é um `Uint8`. Com IPv4 e IPv6 compartilhando a tabela, o total
> subiu de **251 para 252** — a 4 de estourar e dar a volta em silêncio,
> mapeando um país para outro. O gerador **aborta** acima de 256 e diz para
> trocar por `Uint16Array`.

### 💰 O artefato de 5,7 MB — custo MEDIDO, não estimado

| | |
|---|---|
| `import` do módulo | 66 ms |
| 1ª consulta IPv4 (decodifica a base) | 3,3 ms |
| 1ª consulta IPv6 (decodifica a base) | 3,6 ms |
| **Cold start total** | **73 ms** |
| Consulta aquecida IPv4 | **0,18 µs** |
| Consulta aquecida IPv6 | **0,50 µs** |
| Bundle do servidor (`.next/server`) | **35 MB** — limite da Vercel é 250 MB |

- **O artefato fica num chunk próprio** (`chunks/src_lib_geo_pais_ts_*.js`,
  5,76 MB). Rota que não importa a base **não paga nada** — o dashboard, as
  notificações e o sync seguem iguais.
- **Nunca vai para o navegador.** Só rotas de API o importam.
- Os 66 ms do `import` foram medidos com type-stripping do `.ts`; no build de
  produção o parse é de `.js` já compilado, então o número real é **menor**.
- **73 ms uma vez por instância fria**, contra ~99 ms de UMA ida ao Supabase.
  Está na mesma ordem de grandeza de uma query — e a base não faz I/O nenhum.

### Cobertura por região (amostragem de 2.000 IPs por RIR)

| RIR | Cobertura IPv4 | IPv6 |
|---|---|---|
| LACNIC (América Latina) | **100,0%** | ✓ AR, BR |
| RIPE (Europa/Oriente Médio) | **100,0%** | ✓ DE, IE |
| ARIN (América do Norte) | 99,9% | ✓ US |
| APNIC (Ásia-Pacífico) | 99,3% | ✓ KR, IN, CN |
| **AFRINIC (África)** | **95,9%** | ✓ DZ, TZ |

**A única lacuna real é a África, com ~4% do espaço sem país.**

> ### ⚠️ Venda que a base não cobre aparece como "Não identificado" — nunca some
> Antes, `byCountry` fazia `if (!code) continue` e a venda sem país **sumia do
> bloco inteiro**. O ranking então dava a impressão de que 100% das vendas
> estavam geolocalizadas, e o único caso em que isso importa — a região que a
> base cobre mal — era o invisível.
>
> Hoje ela vira a entrada `code: ""`, mostrada como **"Não identificado"** com
> chip **"sem localização"**, e o `title` explica a cobertura por região
> (~100% na América Latina e na Europa, **~96% na África**).
>
> **Nunca chutar.** `paisDoIp` devolve `null` para bloco não coberto em vez de
> herdar o país da faixa anterior — é para isso que existem as entradas de
> "buraco" na cobertura contínua.

### O mapa saiu de 32 para 252 países

Os 32 eram "os que aparecem em infoproduto em português" — premissa errada para
uma ferramenta usada por quem roda oferta mundial: **o mercado novo era
justamente o invisível**. Hoje cobre os 193 membros da ONU + territórios com
tráfego próprio, e `npm run test:pais` **falha** se a base resolver um país que
o mapa não sabe desenhar. Paridade atual: **252 no mapa · 252 na base**.

- **A bandeira é CALCULADA** (`bandeiraDe`), pelos indicadores regionais Unicode.
  250 emojis literais num arquivo-fonte são convite a erro invisível — um emoji
  errado é indistinguível de um certo em code review.
- **`FX` e `AN` estão na tabela de propósito.** São códigos ISO **obsoletos**
  (França metropolitana; Antilhas Neerlandesas, dissolvidas em 2010) que a base
  de IP ainda emite para blocos antigos. Sem eles a venda seria geolocalizada e
  mesmo assim não apareceria.
- **País sem posição no mapa é MARCADO no ranking, nunca omitido** — chip "sem
  posição no mapa" com explicação no `title`. É a mesma regra do "Não
  identificado": o que some em silêncio é o que o usuário está procurando.

## 🤖 Marcação de bot (30/07/2026, passo 5) — MARCA, nunca bloqueia

**Migration `20260730180000_click_bot`** — `Click.bot` (`DEFAULT false`),
`Click.botMotivo`, e o índice `(userId, bot, timestamp)`. Aditiva.

> ### 🔴 ORDEM DE DEPLOY: migration → `bot:reclassificar` → push
> 1. `npx prisma migrate deploy` na produção
> 2. **`npm run bot:reclassificar -- --url '<conn>' --aplicar`**
> 3. `git push`
>
> ⚠️ **O passo 2 não é opcional.** A coluna nasce com `DEFAULT false`, então
> todo clique histórico nasce "não é bot" — errado para ~16,5% deles. Sem a
> reclassificação, a contagem na tela fica **zerada** e parece que o filtro não
> funciona, enquanto o funil segue inflado.

### ⛔ Marca, não bloqueia — e por quê

O `/api/track/click` **continua gravando tudo**. Só as métricas excluem
`bot: true`.

Bloquear significaria **não gravar**, e aí um falso positivo apaga um cliente
**sem deixar rastro** — não há como descobrir depois nem desfazer. Marcado, o
erro se corrige: `npm run bot:reclassificar` reavalia **todo** o histórico com a
lista nova, porque o `userAgent` continua no banco. É isso que torna a lista de
padrões editável sem medo.

### ⛔ PAÍS NUNCA É CRITÉRIO. IP DE DATACENTER TAMBÉM NÃO.

A suspeita inicial era de que os 90 cliques de US+IE fossem crawler — a Irlanda
é o datacenter europeu da Meta. A decomposição mostrou **37 bots e 53 pessoas
reais**, e as 2 únicas vendas que casaram com um clique vieram justamente dali.

**Neste produto, IP de datacenter da Meta é evidência de usuário REAL de rede
social** — 55,6% do tráfego humano vem do navegador embutido do app. Quase o
oposto de bot.

> ⚠️ Isso continua valendo quando a detecção de datacenter existir (passo 6):
> ela serve para corrigir o **país**, nunca para classificar bot.

**O único critério é o `userAgent`.**

### A lista de padrões

`lib/bots/classificar.ts` → `PADROES`, uma lista de `{ re, motivo }` lida de cima
para baixo. Acrescentar é **uma linha** + rodar o reclassificador.

> ### ⚠️ A ORDEM importa
> O crawler da Meta se anuncia **dentro** de um user agent de navegador comum
> (`Mozilla/5.0 (…) Chrome/145 (compatible; meta-externalads/1.1 …)`), então
> precisa ser testado antes de qualquer regra genérica.

> ### ⚠️ Conservador de propósito
> Um bot que escapa infla a contagem em alguns por cento. **Um humano marcado
> como bot some das métricas e leva a decisão de mídia junto.** Na dúvida, fora.
>
> - **User agent AUSENTE não é bot.** Extensão de privacidade e configuração
>   corporativa suprimem o header.
> - **WebView (`; wv)`) não é bot** — é o padrão do app do Instagram no Android.
> - `\bbot\b` tem limites de palavra: sem eles, "Abbott" num nome de aparelho
>   viraria robô.
> - **`\brobot\b` é padrão SEPARADO**: o `\b` de `bot` **não** casa dentro de
>   "Robot" (o `o` anterior é caractere de palavra). Um teste com
>   `SomeCompany Robot/1.0` passava batido — foi assim que a lacuna apareceu.

### Onde o bot é excluído — e onde NÃO é

| Consulta | Exclui bot? | Por quê |
|---|---|---|
| `metrics.ts` — cliques do funil e do feed | ✅ | é métrica |
| `ads/overview.ts` — "Cliq. atr." e IC | ✅ | é métrica |
| `matchClick` — casar venda por IP | ✅ | robô não compra; a venda herdaria o país do datacenter dele |
| `diagnostics.ts` — "script de UTM detectado" | ❌ | a pergunta é *"o script está instalado?"*. Um crawler que disparou o script **prova** que sim |
| `utm.ts` — cliques carimbados por área | ❌ | idem: é sobre instalação, não sobre tráfego |
| `areas/exclusao.ts` | ❌ | atribuição e exclusão precisam ver **todas** as linhas |

### Conferência na tela (exigência do usuário)

O funil mostra **"N acessos de robô removidos"**, com o detalhamento por motivo
no `title`. Sem isso, "removemos os bots" seria uma afirmação a aceitar no
escuro — o número existe para o usuário julgar se o filtro exagera ou falha.

> ### ⚠️ Fica no TOPO do funil, não no rodapé — ver o caso confirmado abaixo

## 🔐 Passo 7 — anonimização do IP: DUAS FASES, e a ordem inverteu

Decidido em 30/07/2026, **nada implementado ainda**. O plano original ("hashear o
IP e limpar os payloads") não sobreviveu à investigação: hashear o `Click.ip`
quebraria a CAPI, e limpar os payloads mataria o reprocessamento de vendas.

### 🔴 O achado que mudou o plano: `Click.ip` alimenta a CAPI EM TEXTO CLARO

`dispatchPixel.ts` passa `sale.click?.ip` para `capi.ts`, que faz
`userData.client_ip_address = input.clientIp` — **sem hash, de propósito**: a
Meta **recusa** `client_ip_address` e `client_user_agent` hasheados. São os dois
únicos campos que vão em claro.

Hashear o `Click.ip` faria toda venda enviar um hash onde a Meta espera um IP.
Ela **não rejeita a chamada** — degrada em silêncio a qualidade de
correspondência de todo `Purchase`, que é o sinal que alimenta a otimização das
campanhas. **Dinheiro real, sem erro, sem log.**

> ⚠️ **São TRÊS consumidores de `Click.ip`, não um.** Um levantamento que só
> olhasse o `matchClick` teria concluído que o hash era seguro.
>
> | Consumidor | Uso | Sobrevive ao hash? |
> |---|---|---|
> | `matchClick` | igualdade no `where` | ✅ se os dois lados forem hasheados |
> | `dispatchPixel` → CAPI | valor literal enviado à Meta | 🔴 **não** |
> | `/api/pixel/event` → CAPI | usa `ipDaRequisicao(req)`, não o banco | ✅ não afetado |

### A decisão: purga PROGRESSIVA (opção 3 de 3)

Descartadas: **(1)** não hashear nada (privacidade fica parcial) e **(2)** hashear
e aceitar perder a CAPI.

> **Contra a (2), o argumento do usuário:** trocaria um ganho invisível
> (privacidade que ninguém audita) por uma perda invisível (otimização
> degradando sem erro). Duas coisas que ninguém mede, uma delas custando
> dinheiro.
>
> **A favor da (3):** os dois usos do IP têm **PRAZO**. Passado ele, o IP em
> claro não serve para nada — só fica guardado.

### FASE B — purga progressiva ✅ IMPLEMENTADA (30/07/2026)

`src/lib/geo/anonimizarIp.ts` · guarda em `capi.ts` · `matchClick` tolerante ·
`/api/cron/manutencao` estendido · `npm run ip:simular` · `npm run test:match`.
**Sem migration** — só usa colunas que já existem.

> ### 🔴 A rota `/api/cron/manutencao` JÁ EXISTIA e NUNCA foi agendada
> Criada em 28/07/2026 (commit `ec9891c`) com retenção de `WebhookLog` e aviso
> de token vencendo — e **não estava no `.github/workflows/cron.yml`**. Rodou
> zero vezes. O CLAUDE.md listava a retenção como dívida aberta; ela estava
> escrita e inerte.
>
> **É o mesmo modo de falha da base de países antes do passo 1, e da terceira
> vez que ele aparece nesta sessão.** Agendada agora, diariamente às 04h UTC
> (01h em Brasília) — horário de baixo tráfego porque ela ESCREVE.
>
> ⚠️ **Ao criar rota de cron, agende no mesmo commit.** Uma rota sem agendamento
> não falha, não avisa e parece pronta.

**Retenção do `WebhookLog` passou de 90 fixos para diferenciada** (30 dias para
`PROCESSADO`, 90 para falha/órfão): o log de sucesso é redundante com
`Sale.rawPayload`; o de falha é a única cópia.

**Retenção: 7 dias.** Três prazos se somam e o maior manda:

| Prazo | Duração |
|---|---|
| Match por IP (`IP_WINDOW_MS`) | 12 h |
| Atribuição da Meta | **7 dias por clique** (padrão) + 1 dia por visualização |
| IP residencial continuar sendo da mesma pessoa | dias (rotação de IP dinâmico) |

> ⚠️ A janela da Meta é **configurável por conjunto** (`attribution_spec`), e as
> janelas de 28 dias foram removidas em 2021. **Melhoria futura registrada:**
> derivar a retenção da maior janela configurada nos conjuntos, em vez de fixar
> 7 dias — o campo vem do mesmo `GET /adsets` que já fazemos. Decisão do
> usuário: **não vale o trabalho antes de haver volume.**

**Cron: `/api/cron/manutencao`, diário e novo.** Não pendura nos três existentes
(`sync-facebook`, `run-rules`, `reports`) — eles têm ritmo e modo de falha
próprios. E aproveita para fechar a dívida da retenção do `WebhookLog`.

**Duas guardas, dois propósitos:**

| Guarda | Onde | Para quê |
|---|---|---|
| Prefixo no valor (padrão do `trkenc.v1.`) | script de purga | **idempotência** — não re-hashear |
| `ehIpValido()` | `capi.ts` | **a CAPI só envia o que PARECE um IP** |

> ⚠️ O `ehIpValido` é a guarda que importa: um SHA-256 tem 64 hexadecimais e
> nunca passa nela. Protege contra o hash **e** contra qualquer outro lixo que
> apareça no campo.

**Venda que chega depois da purga do clique dela:** o match por IP não é
afetado (janela de 12 h × retenção de 7 dias — nem é exercido). O match direto
por `click_id` **não tem limite de tempo**, então essa venda perde o
`client_ip_address` na CAPI.

> ⚠️ **Isso é o comportamento CORRETO, não um custo aceito.** Um IP de 7+ dias
> provavelmente já não é daquela pessoa. Enviá-lo não seria sinal fraco, seria
> sinal **errado**, apontando para outro assinante. **Omitir é melhor que mentir.**

**Retenção do `WebhookLog` — diferenciada:**

| Status | Retenção | Por quê |
|---|---|---|
| `PROCESSADO` | 30 dias | o payload **já está duplicado** em `Sale.rawPayload` |
| `REJEITADO` · `ERRO` · `RECEBIDO` órfão | **90 dias** | é a **única cópia**, e são os que se depura |

Log de sucesso é redundante; log de falha é o produto. E as falhas sem dono
(chave inválida, token desconhecido) **nem aparecem na interface** — depurar
"meu gateway manda e não chega" com o suporte do gateway leva semanas.
`RECEBIDO` que nunca fechou = processamento estourou no meio; tratado como
`ERRO`.

**Teste de regressão — `npm run test:match`, 20 asserções.** O bloco 5 executa
**a própria consulta da purga** contra linhas semeadas com data no passado:
clique de 10 dias vira hash, de 2 dias fica intacto, já anonimizado não é
re-hasheado, 2ª passada não mexe em nada, **o país não é tocado**, o purgado é
recusado pela CAPI e ainda casa no match.

> ⚠️ Esse bloco foi acrescentado depois de o usuário perguntar se a purga tinha
> sido testada de verdade. **Não tinha** — só a função pura e o `matchClick`. A
> consulta nunca havia rodado contra linha nenhuma, e a simulação em produção dá
> 0 porque todos os cliques estão dentro da retenção. Ver o PROCEDIMENTO no topo.

Os quatro casos exigidos:

1. Clique com IP conhecido → venda com o mesmo IP, **sem `click_id`** →
   `matchMethod === "ip"` e o `clickId` certo
2. IP diferente → `matchMethod === "none"`
3. **Clique já purgado (IP em hash)** → venda com IP em claro → **o match ainda
   casa**, porque os dois lados passam pela mesma função
4. E o par do 3: a CAPI daquela venda **omite** `client_ip_address`

> ⚠️ **O caso 2 é o que dá valor ao teste.** Sem ele, um `where` quebrado que
> casasse com qualquer clique passaria despercebido.

⚠️ O teste **duplica** o `where` do `matchClick` em SQL, como a `geo:sonda`
duplica a extração do `sync.ts`. Se importasse a função, um bug nela passaria
por "tudo certo". Escreve no banco de DEV, passa pelo `guard-db` e limpa por id.

**`npm run ip:simular`** — só leitura, **sem `--aplicar` de propósito**: quem
escreve é o cron, com teto de 5.000 por execução. Uma segunda porta para uma
operação irreversível seria uma a mais do que o necessário. Mostra quantos IPs
seriam anonimizados, quantos ficam legíveis, quantas vendas perderiam
`client_ip_address`, **em quais chaves o IP aparece dentro dos payloads** (é
assim que se descobre o nome que um gateway novo usa) e a contagem de país
resolvido — que tem de ser idêntica antes e depois.

### FASE A — limpeza do IP nos payloads: ⏸️ ADIADA

> ### ⛔ PRÉ-CONDIÇÃO: a arquitetura de parsers de gateway estar ESTÁVEL
> O usuário está integrando a **Cakto** e depois muitos outros gateways, com uma
> arquitetura universal de parsers construída em cima dos payloads guardados.
>
> **Se um parser tiver bug e for preciso reprocessar as vendas com a correção, o
> payload cru é a ÚNICA fonte.** Limpar antes disso queima essa ponte.
>
> Só depois de a arquitetura estar estável e não haver mais nada a reprocessar.

**E na versão cirúrgica, não na total.** Remover **apenas o campo de IP** de
dentro do payload atende a privacidade sem perder o reprocessamento. Duas
escolhas de projeto separam funcionar de sabotar:

- **Substituir o valor, não apagar a chave** (`"ip": "[ip removido]"`). Um parser
  testado contra payload histórico pode assumir que a chave existe; apagá-la
  muda a **forma** do payload e faz depurar contra um formato que nunca chegou.
- **Achar por chave conhecida + varredura por valor.** A lista de chaves sai do
  `normalizeSale` (fonte única), mas gateway novo usa nome novo e o IP escaparia
  em silêncio. A varredura pega o desconhecido; a simulação **lista as chaves
  onde encontrou**, e é assim que o nome que a Cakto usa entra na lista.

> ⚠️ **A varredura por valor tem de ser só de IPv4.** O `ehIpValido` aceita IPv6
> por uma regra frouxa (`[0-9a-f:]+` com um `::`), e **`"10:30"` passa nela** —
> um horário no payload viraria "IP removido".

### 🔴 Restrição para a arquitetura de parsers — vale JÁ, não depois

`ingestSale` recalcula `paisDaVenda` a cada ingestão, e a **2ª fonte é o IP do
payload**. Reprocessar uma venda com o IP removido faria o país recalculado
**piorar** — cairia para o país do clique ou para o texto cru.

**O reprocessamento PRECISA preservar `country`/`countrySource` quando já não
são nulos.** Isso independe da Fase A: sem essa regra, um reprocessamento
"inofensivo" degrada geolocalização já resolvida.

### Checklist antes de autorizar qualquer escrita

| | Item | Estado |
|---|---|---|
| ✅ | País resolvido nas rotas | feito |
| ✅ | Backfill do país aplicado | 237 cliques · 15 vendas |
| ✅ | IPv6 na base | feito |
| ✅ | Bots marcados | 39 de 237 |
| ⏳ | **Desempate comprovado pela `geo:sonda`** | a fazer |
| ⏳ | Backup imediatamente antes | `npm run backup -- --url '<conn>'` |
| ⏳ | Simulação antes do `--aplicar` | com os números conferíveis abaixo |

**A simulação tem de mostrar:** quantos `Click.ip` seriam hasheados (e quantos
já estão), quantos `Sale.rawPayload` e `WebhookLog.payloadRaw` contêm IP e **em
quais chaves**, e a **contagem de `Click.country`/`Sale.country` não-nulos antes
e depois — que tem de ser idêntica.** País já resolvido não pode ser tocado.


## 🔴 ACHADO: o navegador embutido do app da Meta falseia a geolocalização

**Medido no backup de produção (30/07/2026). Diagnóstico feito, solução NÃO
implementada** — ver o passo 6 da ordem.

O navegador embutido do Instagram e do Facebook roteia pela infraestrutura da
Meta. O IP que chega até nós é o de um **datacenter da Meta**, não o do
visitante. Isso não é caso de borda neste produto: **é o caminho principal.**

| | Cliques | % dos humanos |
|---|---|---|
| Instagram (app) | 70 | 35,4% |
| Facebook (app) | 40 | 20,2% |
| **Total em navegador embutido** | **110** | **55,6%** |

De 198 cliques humanos (237 menos 39 bots), **29 resolveram para fora do Brasil**
sendo brasileiros — com `pt_BR` no user agent e, em 8 deles, **`FBCR/VIVO`**, a
operadora Vivo.

> ### ⚠️ Foi por pouco que isto não virou "filtrar os gringos"
> A suspeita inicial era de que os 90 cliques US+IE fossem todos crawler. A
> decomposição mostrou **37 bots e 53 pessoas reais** — e as 2 únicas vendas que
> casaram com um clique vieram justamente do navegador do app. Filtrar por país
> teria apagado compradores.
>
> **Regra que fica: país NUNCA é critério de filtragem.** Critério é `userAgent`
> e origem de datacenter.

### ✅ Onde o problema NÃO está: as vendas

Verificado no backup, e é melhor do que se temia:

| Fonte do país da venda | Vendas |
|---|---|
| IP do comprador no payload (fonte confiável) | 15 |
| **Só o país do clique casado (exposto ao erro)** | **0** |
| Sem fonte nenhuma | 11 |

**Nenhuma venda depende hoje do fallback para o clique**, porque a Kirvano manda
o IP do comprador em todo payload — e esse IP é o real dele, não o da Meta.
O globo de "Vendas por país" **não está contaminado**.

> ⚠️ **Isso é uma propriedade da Kirvano, não do desenho.** Um gateway que não
> mande o IP do comprador faz toda venda dele cair no país do clique — e aí o
> erro entra no globo. `metrics.ts` faz `s.country ?? s.click?.country`.

**O que está errado é a geografia do CLIQUE**: "Vendas por país" está certo, mas
qualquer análise de *visitas* por país está inflando US/IE e subnotificando o
país real.

### ✅ RESOLVIDO no passo 6 (30/07/2026) — pela SEGMENTAÇÃO, não por datacenter

**Migration `20260730200000_geo_desempate`** — `AdSet.geoCountries`,
`Click.countrySource`, `Click.acceptLanguage`, `Click.timezone`,
`Sale.countrySource`. Tudo aditivo, tudo com default.

> ### ⛔ NÃO detectamos datacenter. Decisão do usuário, e o motivo não foi custo.
> A alternativa era manter uma base de faixas de IP da Meta (ASN). Descartada:
>
> **A segmentação é o que o anunciante CONFIGUROU, não uma inferência.** Se a
> campanha só roda BR e MX e o IP diz US, o IP está errado **independente do
> motivo** — datacenter, VPN, proxy corporativo ou base desatualizada. A
> detecção de datacenter resolveria *um* motivo; a segmentação resolve todos.
>
> E o caso que a detecção protegeria — IP residencial legítimo sobrescrito — não
> existe: um IP residencial legítimo **não contradiz** a segmentação da própria
> campanha que trouxe aquele visitante.
>
> ⚠️ **Efeito colateral decisivo:** o hash do IP (passo 7) deixou de depender
> disto. Pela base de ASN, o passo 7 ficaria bloqueado **para sempre** —
> comparar IP com faixas exige o IP legível.

### Cada sinal produz um CONJUNTO, nunca uma afirmação

Nenhum sinal nomeia um país sozinho. Cada um devolve os países possíveis, que
são **intersectados com a segmentação**. Só resolve quando sobra exatamente um.

Isso importa porque operadora não é global: **"Claro" opera em BR, AR, CL, CO,
PE** e mais. Dizer `CLARO → BR` seria chutar. Mas `CLARO ∩ {BR, MX}` = `{BR}`
resolve com honestidade, e `CLARO ∩ {BR, AR}` **não resolve** — e aí a resposta
certa é incerto.

| # | Sinal | Força | Ressalva |
|---|---|---|---|
| 1 | Segmentação com **um país só** | máxima | não precisa de mais nada |
| 2 | `FBCR/<operadora>` | forte | quase sempre multipaís |
| 3 | `Accept-Language` | média | header com pesos — vale para o script JÁ instalado |
| 4 | locale do user agent (`pt_BR`) | fraca | é o idioma do APARELHO |

> ### ⛔ Sem contradição, NADA disso roda
> Campanha mundial (lista vazia) ou IP compatível com a segmentação → devolve o
> país do IP e pronto. Não há por que adivinhar quando a medida é coerente. Um
> **americano real** comprando pelo Instagram numa campanha que roda US continua
> `US`.

> ### ⛔ Nada resolveu = INCERTO. O país do IP NÃO volta.
> Quando o IP contradiz a campanha ele é **sabidamente errado** — devolvê-lo
> produziria um número plausível e falso no mapa. `null` vira "Não identificado"
> na tela, que é uma afirmação verdadeira.

### Custo na Graph API: ZERO chamadas a mais

`targeting{geo_locations}` é **campo do AdSet**, e `syncAdSets` já faz
`GET /{account}/adsets?fields=…`. É um campo a mais numa requisição que já
acontece. Sob demanda seria uma requisição por clique, dentro de uma rota que
hoje só escreve no banco — e cliques chegam às dezenas por minuto.

> ⚠️ **Não basta ler `countries`.** Campanha segmentada por cidade ou região não
> preenche `countries` — o país vem DENTRO de cada item (`cities[].country`).
> Ler só `countries` faria toda campanha local parecer mundial, que é exatamente
> o caso em que o desempate mais importa.
>
> ⚠️ **`country_groups` NÃO é expandido** de propósito. Expandir "europe" para 44
> países tornaria a interseção tão larga que nunca sobraria um país só —
> desempate que nunca dispara é pior que desempate ausente, porque parece que
> está funcionando.
>
> ⚠️ **União dos conjuntos, não interseção.** Se um conjunto roda BR e outro MX,
> a campanha alcança os dois. Interseção devolveria vazio e nada desempataria.

### `countrySource` — a procedência de cada país

`ip · campanha · carrier · idioma · locale · header · incerto` no clique;
`payload · ip · clique · payload_cru` na venda. Sem isso não há como auditar nem
como a tela dizer "isto é estimativa".

**O ranking já usa:** país cuja fonte não é `payload` nem `ip` conta como
**estimada** e ganha o chip âmbar. Medida é `payload`/`ip`; o resto é inferência.

### Sinais coletados agora, usados depois

- **`Accept-Language`** — já em uso no desempate. É header, então **vale para o
  script já instalado**, sem reinstalação.
- **`Click.timezone`** — `Intl.DateTimeFormat().resolvedOptions().timeZone`.
  Sinal **geográfico direto** (`America/Sao_Paulo`), mais forte que o locale, e
  **ainda não usado**: converter fuso→país exige uma tabela de ~400 zonas, e uma
  tabela parcial funcionaria para alguns países e não para outros — pior que
  nenhuma, num produto mundial. Coletado agora porque não dá para voltar no
  tempo. **Só chega de quem reinstalar o script.**

> ⚠️ O `tz` vai dentro de `try/catch` no `t.js`: `Intl` pode faltar em navegador
> antigo, e um erro ali pararia o rastreamento inteiro por um campo opcional.

**Testado:** `npm run test:desempate` — **27 asserções** com os user agents reais
dos 29 cliques que resolviam errado. Cobre: sem contradição o IP vence;
americano real não é sobrescrito; campanha de um país decide sozinha; carrier,
idioma e locale na ordem certa; **operadora multipaís não decide sozinha**; e
nada-resolve devolve `incerto` sem trazer o IP de volta.

### ⚠️ Não feito no passo 6

- **Backfill do `countrySource` histórico.** Cliques e vendas já gravados ficam
  com a coluna NULA — não dá para reconstruir a procedência de uma decisão já
  tomada. O ranking trata NULO como "não estimada", que é o comportamento antigo.
- **Reprocessar cliques antigos com a segmentação.** Exigiria refazer a resolução
  de 237 cliques com dados de campanha que só existirão após o próximo sync
  completo. Avaliar depois de `geoCountries` estar populado.
- **🔴 Nenhuma resposta REAL da Graph API foi observada.** O campo `targeting`
  entrou numa chamada de leitura já existente, mas o formato real não foi visto.

### 🔬 `npm run geo:sonda` — obrigatória ANTES do passo 7

```bash
npm run geo:sonda -- --url '<connection string de produção>'
npm run geo:sonda -- --url '<conn>' --cru   # despeja o JSON completo
```

**Só leitura** (`GET` na Graph API + `SELECT`). Custo: **1 chamada por conta
rastreada**.

> ### ⛔ Ela chama a GRAPH API, e não é firula
> Ler o banco responde *"está vazio?"*. Só a resposta crua responde a pergunta
> que importa: **vazio porque a campanha é mundial, ou vazio porque o campo não
> veio?** As duas produzem exatamente a mesma linha no banco — e uma delas
> significa que o desempate está morto.
>
> É a lição do passo 1: a base de países ficou pronta, testada e commitada uma
> sessão inteira **sem ser consultada por ninguém**, e só descobrimos por acaso.

O que ela reporta: conjuntos com segmentação × vazios, média de países,
`country_groups` não expandidos (com os nomes), quantos usam `cities`/`regions`
— e **um exemplo real da resposta**, mais um exemplo de segmentação por cidade
para confirmar que o país sai de `cities[].country`.

**Vereditos:**

| Saída | Significa |
|---|---|
| Todos sem `targeting` | 🔴 **o campo não vem. Desempate INERTE. NÃO avance para o passo 7** |
| Campo vem, nenhuma restrição de país | 🟡 correto — campanha mundial não desempata |
| N conjuntos com país extraível | ✅ funcionando |
| Graph OK mas banco vazio | ⚠️ o sync ainda não rodou com o código novo |

> ⚠️ A sonda **duplica** a extração de `paisesDaSegmentacao`. É de propósito: se
> ela importasse a do `sync.ts`, um bug lá apareceria como "tudo certo" aqui. A
> cópia é a testemunha independente — se divergirem, a sonda mente.


### 📌 Decisões registradas

- **A base local é o caminho PRINCIPAL; o header da Vercel é só atalho**, porque
  o produto vai migrar para **VPS dedicada**. Nada pode depender do header para
  funcionar — senão a migração quebra a geolocalização e o sintoma só aparece
  com tráfego real já perdido.
- **`PROXIES_CONFIAVEIS`**: errar para **MAIS** aceita IP forjado; errar para
  **MENOS** grava o IP do proxy e todo visitante vira o mesmo endereço. Tabela
  por ambiente documentada na seção "IP do visitante".
- **MaxMind e IP2Location LITE exigem cadastro** e estão descartados. O
  `geo-whois-asn-country` que chegou a ser cogitado **não existe mais**: o
  repositório deixou de usar WHOIS de RIR porque as AUPs proíbem mapeamento
  geográfico.
- **Cobertura contínua** no artefato: buracos do espaço IPv4 são entradas
  explícitas para "desconhecido". 5 bytes por entrada em vez de 9, e um IP em
  bloco reservado não herda o país da faixa anterior.
- **IPv4 apenas.** IPv6 devolve `null` (não identificado), nunca país errado.

### ⚠️ Pendência conhecida

`/api/diagnostico/ip` manipula `process.env.PROXIES_CONFIAVEIS` para simular
cada valor e restaura no `finally`. Em serverless é seguro (uma requisição por
instância); **numa VPS com concorrência, duas chamadas simultâneas poderiam se
atrapalhar** por um instante. Não afeta o `/api/track/click` — o efeito seria um
número errado na própria página de diagnóstico. **Ajustar para receber o valor
por parâmetro em vez de mexer no ambiente.**
