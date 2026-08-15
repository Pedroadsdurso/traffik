/**
 * OS ALERTAS DO DASHBOARD — os cinco originais, o sexto que faltava, e o
 * SÉTIMO, que existia e tinha perdido o consumidor.
 *
 * ⚠️ O sétimo (`faltam-taxas`, §6b) não é recurso novo: `faltamTaxas` era de
 * 30/07 e ficou **dois dias e meio sem ninguém** depois que a reescrita de
 * Taxas deletou a `FeesView`. A §6c existe porque o campo que o alimenta é
 * OPCIONAL — esquecer de passá-lo o apagaria em silêncio, que é o estado do
 * qual ele acabou de sair.
 *
 * 🔴 NENHUM DELES TINHA ASSERÇÃO ATÉ 14/08/2026
 *
 * Medido: `grep` por `dadosDosBlocos`, `gasto-sem-conversao` e `roi-caiu` em
 * `scripts/teste-*.mjs` devolvia **zero arquivos**. Os cinco nasciam dentro de
 * um `React.useMemo` num `.tsx` — inalcançáveis por teste, pela mesma razão
 * estrutural que deixava a `composicaoDoNoDeICs` descoberta.
 *
 * ## ⛔ ESTE ARQUIVO É A PROVA DE QUE A EXTRAÇÃO NÃO PERDEU NADA
 *
 * A ordem pedida pelo dono era: teste primeiro, extrair depois, e o mesmo teste
 * passando prova que nenhum alerta sumiu. **O primeiro passo era impossível** —
 * o construtor estava dentro do `useMemo` e não havia como chamá-lo.
 *
 * O que substitui a prova, e é mais forte que "passou":
 *
 *   1. o `git diff` do commit mostra o corpo saindo do `useMemo` e entrando no
 *      módulo **idêntico**;
 *   2. este arquivo exercita **os cinco ids originais**, um a um, e afirma que
 *      cada um dispara na sua condição E some fora dela.
 *
 * ⚠️ Um alerta que só se sabe disparar não está coberto: o par (dispara / não
 * dispara) é o que separa "existe" de "existe e é condicional".
 */

import assert from "node:assert/strict";
import { montarAlertas } from "@/lib/dashboard/alertas";

let n = 0;
const ok = (nome, cond, extra) => {
  assert.ok(cond, nome + (extra ? " — " + extra : ""));
  console.log("  ✓ " + nome + (extra ? " — " + extra : ""));
  n++;
};

const brl = (x) => "R$ " + x.toFixed(2).replace(".", ",");
const AGORA = Date.UTC(2026, 7, 14, 12, 0, 0);

/** Uma entrada SEM nenhum alerta — a linha de base de todos os pares. */
const limpa = (o = {}) => ({
  fbConnected: true,
  perfisCrus: [],
  adProfiles: [],
  roi: { value: "1,20x", delta: 5 },
  chartSerie: { spend: [10, 20], revenue: [50, 60] },
  agora: AGORA,
  brl,
  ...o,
});

const ids = (e) => montarAlertas(e).map((a) => a.id);

console.log("\nOs alertas do Dashboard");

/* ⛔ LINHA DE BASE DE TODO O ARQUIVO: a entrada limpa não produz alerta nenhum.
   Sem ela, cada asserção de "dispara" passaria num construtor que alerta
   sempre — e cada "não dispara" passaria num que nunca alerta. */
ok("linha de base: entrada saudável não produz alerta nenhum", ids(limpa()).length === 0, JSON.stringify(ids(limpa())));

/* ═══ 1 · `sem-conta` ═══════════════════════════════════════════════════ */
{
  const com = ids(limpa({ fbConnected: false }));
  ok("1 · `sem-conta` dispara sem conta conectada", com.includes("sem-conta"), com.join(" · "));
  ok("1 · …e SOME com conta conectada", !ids(limpa({ fbConnected: true })).includes("sem-conta"));
  const a = montarAlertas(limpa({ fbConnected: false }))[0];
  ok("1 · leva href para onde resolver", a.href === "/dashboard/integracoes/anuncios", a.href);
  ok("1 · é `warning`, não crítico", a.severidade === "warning");
}

/* ═══ 2 · `token-<id>` — a falha MAIS CARA, e ela é muda ════════════════ */
{
  const vencido = new Date(AGORA - 86_400_000).toISOString();
  const longe = new Date(AGORA + 400 * 86_400_000).toISOString();

  const com = ids(limpa({ perfisCrus: [{ id: "p1", name: "Perfil A", tokenExpiresAt: vencido }] }));
  ok("2 · `token-p1` dispara com token vencido", com.includes("token-p1"), com.join(" · "));
  ok(
    "2 · …e SOME com token longe do vencimento",
    !ids(limpa({ perfisCrus: [{ id: "p1", name: "Perfil A", tokenExpiresAt: longe }] })).includes("token-p1"),
  );

  /* ⚠️ `desconhecido` (data nula) ENTRA — são os perfis anteriores à coluna, os
     mais antigos, logo os mais prováveis de já estarem vencidos. É o caso mais
     perigoso, e a asserção existe para ele não ser "consertado" para fora. */
  ok(
    "2 · ⚠️ token DESCONHECIDO (data nula) também alerta",
    ids(limpa({ perfisCrus: [{ id: "p9", name: "Antigo", tokenExpiresAt: null }] })).includes("token-p9"),
  );

  /* Um por perfil, e o id carrega o perfil — senão dois perfis colidiriam. */
  const dois = ids(
    limpa({
      perfisCrus: [
        { id: "p1", name: "A", tokenExpiresAt: vencido },
        { id: "p2", name: "B", tokenExpiresAt: vencido },
      ],
    }),
  );
  ok("2 · um alerta POR PERFIL, com id distinto", dois.includes("token-p1") && dois.includes("token-p2"), dois.join(" · "));

  /* Vencido é `danger`; a expirar é `warning`. A distinção é o que impede o
     painel de tratar "vence em 20 dias" como emergência. */
  const sev = montarAlertas(limpa({ perfisCrus: [{ id: "p1", name: "A", tokenExpiresAt: vencido }] }))[0].severidade;
  ok("2 · token VENCIDO é `danger`", sev === "danger", sev);
}

/* ═══ 3 · `conta-<id>` — erro de sincronização ══════════════════════════ */
{
  const perfil = (tom) => [{ accounts: [{ id: "c1", name: "Conta 1", erroSync: { tom, mensagem: "Token inválido", acao: "Reconecte" } }] }];
  const com = ids(limpa({ adProfiles: perfil("erro") }));
  ok("3 · `conta-c1` dispara com erro de sync", com.includes("conta-c1"), com.join(" · "));
  ok("3 · …e SOME sem erro", !ids(limpa({ adProfiles: [{ accounts: [{ id: "c1", name: "C", erroSync: null }] }] })).includes("conta-c1"));

  /* ⛔ O TOM vem do `erroMeta.ts` e é RESPEITADO — marcar tudo como crítico
     encheria o painel de vermelho por rate limit, que passa sozinho. */
  const a = montarAlertas(limpa({ adProfiles: perfil("erro") }))[0];
  const b = montarAlertas(limpa({ adProfiles: perfil("aviso") }))[0];
  ok("3 · tom `erro` → `danger`", a.severidade === "danger", a.severidade);
  ok("3 · ⛔ tom `aviso` → `warning`, não crítico", b.severidade === "warning", b.severidade);
}

/* ═══ 4 · `roi-caiu` — e o limiar de −20% ═══════════════════════════════ */
{
  ok("4 · `roi-caiu` dispara com queda de 25%", ids(limpa({ roi: { value: "0,80x", delta: -25 } })).includes("roi-caiu"));
  ok("4 · …e SOME com queda de 10%", !ids(limpa({ roi: { value: "1,0x", delta: -10 } })).includes("roi-caiu"));
  /* ⛔ A fronteira é ESTRITA: exatamente −20 NÃO dispara. */
  ok("4 · ⛔ exatamente −20% NÃO dispara (fronteira estrita)", !ids(limpa({ roi: { value: "1,0x", delta: -20 } })).includes("roi-caiu"));
  ok("4 · −20,1% dispara", ids(limpa({ roi: { value: "1,0x", delta: -20.1 } })).includes("roi-caiu"));
  /* ⛔ `delta: null` é "a métrica não compara" — NÃO é queda. */
  ok("4 · ⛔ `delta: null` não vira alerta (não medido ≠ ruim)", !ids(limpa({ roi: { value: "—", delta: null } })).includes("roi-caiu"));
  ok("4 · `roi: null` idem", !ids(limpa({ roi: null })).includes("roi-caiu"));
}

/* ═══ 5 · `gasto-sem-conversao` — o que mais custa dinheiro ═════════════ */
{
  const com = ids(limpa({ chartSerie: { spend: [100, 50], revenue: [0, 0] } }));
  ok("5 · dispara com gasto e receita zero", com.includes("gasto-sem-conversao"), com.join(" · "));
  ok("5 · …e SOME com alguma receita", !ids(limpa({ chartSerie: { spend: [100], revenue: [1] } })).includes("gasto-sem-conversao"));
  /* ⛔ Sem gasto NENHUM não é alerta — é conta parada, e alarmar ali seria
     alarme que grita sem motivo em toda conta nova. */
  ok("5 · ⛔ sem gasto nenhum NÃO alerta", !ids(limpa({ chartSerie: { spend: [0, 0], revenue: [0, 0] } })).includes("gasto-sem-conversao"));
  const a = montarAlertas(limpa({ chartSerie: { spend: [100], revenue: [0] } }))[0];
  ok("5 · é `danger`", a.severidade === "danger");
  ok("5 · o detalhe traz o VALOR gasto", a.detalhe.includes("100"), a.detalhe);
}

/* ═══ 6 · `donos-<id>` — o alerta LIGADO em 14/08/2026 ══════════════════ */
{
  const px = (corrompidos) => [{ id: "px1", name: "Pixel Loja", donosCorrompidos: corrompidos }];

  const com = ids(limpa({ pixels: px([{ chave: "Purchase", bruto: "1", assumido: "traffik" }]) }));
  ok("6 · `donos-px1` dispara com dono ilegível", com.includes("donos-px1"), com.join(" · "));
  ok("6 · …e SOME com configuração legível", !ids(limpa({ pixels: px([]) })).includes("donos-px1"));
  ok("6 · sem pixels, nada dispara", !ids(limpa()).some((i) => i.startsWith("donos-")));

  const a = montarAlertas(limpa({ pixels: px([{ chave: "Purchase", bruto: "1", assumido: "traffik" }]) }))[0];
  ok("6 · o título NOMEIA o pixel", a.titulo.includes("Pixel Loja"), a.titulo);
  ok("6 · o detalhe NOMEIA o evento e o dono assumido", a.detalhe.includes("Purchase") && a.detalhe.includes("traffik"), a.detalhe);
  ok("6 · e diz a consequência: a Meta conta em dobro", /dobro/i.test(a.detalhe));

  /* ⛔ UM POR PIXEL, não um por entrada — cinco chaves ilegíveis no mesmo pixel
     são um problema só, e cinco linhas iguais afogariam os outros alertas. */
  const cinco = px([
    { chave: "Purchase", bruto: "1", assumido: "traffik" },
    { chave: "Lead", bruto: "{}", assumido: "traffik" },
    { chave: "purchase", bruto: "gateway", assumido: "traffik" },
    { chave: "AddToCart", bruto: " x", assumido: "traffik" },
    { chave: "PageView", bruto: "9", assumido: "navegador" },
  ]);
  const lista = montarAlertas(limpa({ pixels: cinco }));
  ok("6 · ⛔ cinco corrupções no mesmo pixel viram UM alerta", lista.length === 1, lista.length + " alertas");
  ok("6 · …e o detalhe lista as CINCO", cinco[0].donosCorrompidos.every((d) => lista[0].detalhe.includes(d.chave)), lista[0].detalhe.slice(0, 90));
}

/* ═══ 6b · `faltam-taxas` — o aviso RELIGADO em 14/08/2026 ════════

   `faltamTaxas` nasceu em `8b9b162` (30/07) e perdeu o último consumidor em
   `9608704` (12/08), quando a reescrita de Taxas deletou a `FeesView`. O
   `precedencia.ts` a documenta como A mitigação de um risco que ele pinta de
   vermelho, e termina em: **"Se o aviso sair, o risco volta inteiro."**

   ⚠️ O que ele denuncia não é um erro — é uma AUSÊNCIA que faz o número mentir
   PARA CIMA. Sem a taxa do gateway, o Lucro do painel é maior que o dinheiro
   que entrou na conta, e nada na tela sugere que falta algo. */
{
  const QUATRO = ["TAXA_GATEWAY", "COPRODUCAO", "IMPOSTO", "CUSTO_PRODUTO"];
  const comTipos = (tipos, o = {}) => limpa({ tiposDeDespesa: tipos, ...o });

  ok(
    "6b · `faltam-taxas` dispara com os quatro custos ausentes",
    ids(comTipos([])).includes("faltam-taxas"),
    ids(comTipos([])).join(" · "),
  );
  ok(
    "6b · …e SOME com os quatro cadastrados",
    !ids(comTipos(QUATRO)).includes("faltam-taxas"),
  );

  /* ⚠️ O campo é OPCIONAL: quem não tem despesa para informar não alerta.
     Isso mantém a linha de base do arquivo em zero — e é por isso que a §6c
     confere que a tela PASSA o campo. Sem ela, esquecer de passar apagaria o
     alerta em silêncio, que é o controle inerte de novo. */
  ok("6b · sem o campo, nada dispara", !ids(limpa()).includes("faltam-taxas"));

  /* ⛔ O PORTÃO É A RECEITA — e este é o par que o justifica.
     Os quatro descontos incidem sobre venda: sem faturamento no período eles
     valeriam ZERO, e o Lucro não está inflado por nada. A MESMA entrada, só
     mudando a receita, liga e desliga o alerta. */
  const semReceita = comTipos([], { chartSerie: { spend: [10, 20], revenue: [0, 0] } });
  const comReceita = comTipos([], { chartSerie: { spend: [10, 20], revenue: [0, 50] } });
  ok(
    "6b · ⛔ sem receita no período NAO alerta — não há o que inflar",
    !ids(semReceita).includes("faltam-taxas"),
    "alertar aqui gritaria em toda conta nova",
  );
  ok(
    "6b · …e a MESMA entrada com receita alerta",
    ids(comReceita).includes("faltam-taxas"),
    "← o par prova que quem decide é a receita, não outra coisa",
  );

  /* UM alerta com a lista dentro, nunca quatro — mesmo motivo do `donos-`. */
  const so = montarAlertas(comTipos([])).filter((a) => a.id === "faltam-taxas");
  ok("6b · ⛔ quatro ausências viram UM alerta", so.length === 1, so.length + " alertas");
  ok(
    "6b · …e o detalhe lista as QUATRO",
    ["gateway", "coprodução", "imposto", "custo de produto"].every((r) => so[0].detalhe.includes(r)),
    so[0].detalhe,
  );
  ok("6b · e diz a consequência: o Lucro aparece MAIOR", /maior do que é/.test(so[0].detalhe));
  ok("6b · leva para a tela de Taxas", so[0].href === "/dashboard/taxas", so[0].href);

  /* A ausência de UM só também dispara, e o título muda de número.
     ⚠️ O imposto é o caso nomeado no `precedencia.ts`. */
  const soImposto = montarAlertas(comTipos(["TAXA_GATEWAY", "COPRODUCAO", "CUSTO_PRODUTO"]))
    .filter((a) => a.id === "faltam-taxas");
  ok("6b · faltando SÓ o imposto, dispara igual", soImposto.length === 1);
  ok("6b · …e o título nomeia o que falta", /imposto/.test(soImposto[0].titulo), soImposto[0].titulo);
  ok("6b · …sem dizer \"4 custos\"", !/\d+ custos/.test(soImposto[0].titulo));

  /* Tipo fora dos quatro descontos não conta como nenhum deles — uma despesa
     recorrente cadastrada não substitui a taxa do gateway. */
  ok(
    "6b · `DESPESA_RECORRENTE` não cala o aviso",
    ids(comTipos(["DESPESA_RECORRENTE"])).includes("faltam-taxas"),
    "ela não é um dos quatro descontos do Líquido",
  );
}

/* ═══ 6c · A TELA PASSA O CAMPO — e filtra `active` ══════════════

   ⛔ Sem esta seção o alerta seria "implementado e desligado": o campo é
   opcional, então esquecer de passá-lo o apaga sem nada acusar — que é
   exatamente o estado do qual ele acabou de sair.

   ⚠️ As âncoras miram SINTAXE e o arquivo é lido com a quebra normalizada:
   402 arquivos desta base estão em CRLF, e âncora multilinha com `
` falha
   neles em silêncio. */
{
  const { readFileSync } = await import("node:fs");
  const TELA = readFileSync("src/components/dashboard/dadosDosBlocos.tsx", "utf8").replace(/\r\n/g, "\n");

  const i = TELA.indexOf("tiposDeDespesa:");
  ok("6c · linha de base: a tela MENCIONA o campo", i > 0, "âncora em " + i);

  ok(
    "6c · a tela PASSA `tiposDeDespesa` para o construtor",
    /tiposDeDespesa:\s*\(v\.despesasCruas/.test(TELA),
    "sem isso o alerta nasce desligado e nada acusa",
  );
  ok(
    "6c · ⛔ e filtra `active` — `metrics.ts` desconta só as ativas",
    /\.filter\(\(d\) => d\.active\)/.test(TELA),
    "uma taxa DESLIGADA calaria o aviso sem ser descontada",
  );
  ok(
    "6c · e `despesasCruas` está nas deps do `useMemo`",
    /v\.despesasCruas, agora\]/.test(TELA),
    "sem ela o alerta congelaria no primeiro valor",
  );
}

/* ═══ 7 · A COMPOSIÇÃO — os seis convivem, e a ordem é de chegada ═══════ */
{
  const tudo = limpa({
    fbConnected: false,
    perfisCrus: [{ id: "p1", name: "A", tokenExpiresAt: new Date(AGORA - 86_400_000).toISOString() }],
    adProfiles: [{ accounts: [{ id: "c1", name: "C", erroSync: { tom: "erro", mensagem: "x", acao: null } }] }],
    roi: { value: "0,5x", delta: -50 },
    chartSerie: { spend: [100], revenue: [0] },
    pixels: [{ id: "px1", name: "P", donosCorrompidos: [{ chave: "Purchase", bruto: "1", assumido: "traffik" }] }],
  });
  const lista = ids(tudo);
  ok("7 · os SEIS disparam juntos", lista.length === 6, lista.join(" · "));
  ok(
    "7 · ⛔ os cinco ids ORIGINAIS sobreviveram à extração",
    ["sem-conta", "token-p1", "conta-c1", "roi-caiu", "gasto-sem-conversao"].every((i) => lista.includes(i)),
    "← é esta a prova de que o move não perdeu nada",
  );
  ok("7 · nenhum id se repete", new Set(lista).size === lista.length);

  /* ⛔ `faltam-taxas` e `gasto-sem-conversao` são MUTUAMENTE EXCLUSIVOS por
     construção: um exige receita > 0, o outro exige receita === 0. Não é
     coincidência da fixture — é a resposta certa. Sem venda no período os
     quatro descontos valeriam zero, então o que importa é o gasto sem
     conversão; avisar de taxa ali seria ruído em cima do alerta que custa
     dinheiro. Por isso os SEIS, e não sete, nesta composição. */
  const comTaxas = ids({ ...tudo, tiposDeDespesa: [] });
  ok(
    "7 · ⛔ com receita ZERO, `faltam-taxas` não entra nem passando o campo",
    !comTaxas.includes("faltam-taxas") && comTaxas.includes("gasto-sem-conversao"),
    comTaxas.join(" · "),
  );
  const comVenda = ids({ ...tudo, tiposDeDespesa: [], chartSerie: { spend: [100], revenue: [50] } });
  ok(
    "7 · …e com receita a troca é EXATA: um sai, o outro entra",
    comVenda.includes("faltam-taxas") && !comVenda.includes("gasto-sem-conversao") && comVenda.length === lista.length,
    comVenda.join(" · "),
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * 8 · PLANTIO — passar `Date.now()` em vez do `agora` recebido
 *
 * É o "conserto" de quem acha o parâmetro desnecessário. E aqui ele não produz
 * número errado: produz **divergência de hidratação**, e o React aborta a
 * árvore — o efeito visível é a NAVEGAÇÃO parar, não o texto mudar.
 * ═════════════════════════════════════════════════════════════════════ */
{
  const quaseVencido = new Date(AGORA + 3 * 86_400_000).toISOString();
  const perfis = [{ id: "p1", name: "A", tokenExpiresAt: quaseVencido }];

  const noServidor = ids(limpa({ perfisCrus: perfis, agora: AGORA }));
  /* O mesmo dado, "hidratado" 5 dias depois — o token já venceu. */
  const noCliente = ids(limpa({ perfisCrus: perfis, agora: AGORA + 5 * 86_400_000 }));

  /* ⛔ Esta asserção já passou `true` literal numa versão minha — e `true` não
     pode falhar, que é o defeito que este arquivo inteiro existe para não
     cometer. Hoje ela afirma que os DOIS instantes produzem o mesmo alerta
     (o id não muda), para a divergência de severidade abaixo ser sobre a mesma
     linha e não sobre duas listas diferentes. */
  ok(
    "PLANTIO: os dois instantes produzem o MESMO alerta",
    noServidor.length === 1 && noServidor.join() === noCliente.join(),
    noServidor.join(",") + " vs " + noCliente.join(","),
  );
  const sevA = montarAlertas(limpa({ perfisCrus: perfis, agora: AGORA }))[0]?.severidade;
  const sevB = montarAlertas(limpa({ perfisCrus: perfis, agora: AGORA + 5 * 86_400_000 }))[0]?.severidade;
  ok(
    "PLANTIO: `warning` no servidor vira `danger` no cliente",
    sevA !== sevB,
    sevA + " → " + sevB + "  ← com `Date.now()` interno, os dois HTMLs divergiriam",
  );
  ok(
    "⛔ e por isso `agora` é PARÂMETRO: o construtor é determinístico",
    montarAlertas(limpa({ perfisCrus: perfis, agora: AGORA }))[0].severidade === sevA,
    "mesma entrada, mesma saída",
  );
}

console.log("\n\x1b[32m" + n + " asserções, 0 falha(s).\x1b[0m");
console.log("   denominador: 7 alertas, cada um com o par dispara/não-dispara\n");
