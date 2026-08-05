/**
 * Gerador do script de pixel próprio da Traffik (Bloco 12). É um JS
 * autocontido que o usuário cola no <head>: escuta os eventos configurados na
 * página e reporta ao nosso backend (`/api/pixel/event`), que repassa à
 * Conversions API dos pixels da Meta cadastrados. Purchase é server-side (via
 * webhook), então não entra aqui.
 */

import { assinaturaDetectores } from "./detectores";
import { EVENTOS_DO_PIXEL, donoDoEvento, traffikEnvia } from "./donos";

export interface PixelScriptConfig {
  configId: string;
  /** `PixelConfig.eventOwners` cru. Ausente = tudo da Traffik. */
  eventOwners?: unknown;
  /**
   * Há pixel nativo da Meta na página? Ausente = sim (comportamento anterior).
   *
   * 🔴 `false` faz o script **não espelhar e não esperar**. Sem isso, quem não
   * tem pixel nativo — configuração legítima, em que a CAPI é o único caminho —
   * ganhava 10s de espera, um `console.warn` e um `sem-fbq` gravado **em todo
   * evento**: alarme vermelho permanente numa instalação correta.
   */
  temPixelNativo?: boolean;
  apiBase: string;
  lead: boolean;
  addToCart: boolean;
  initiateCheckout: {
    enabled: boolean;
    type?: "clique_checkout" | "contem_texto" | "contem_css" | "contem_url";
    value?: string;
  };
}

/** Domínios de checkout usados quando a regra por clique não lista os do usuário. */
const CHECKOUT_PADRAO = [
  "pay.kirvano.com",
  "hotmart",
  "cartpanda",
  "kiwify",
  "monetizze",
  "cakto",
  // Genéricos, no fim: cobrem gateway que ainda não está na lista.
  "pay.",
  "checkout",
];

/**
 * Tipo de detecção quando a regra gravada não diz qual é.
 *
 * > ### 🔴 O PADRÃO PRECISA SER MATERIALIZADO NO SCRIPT, não só na assinatura
 * >
 * > `rulesFromForm` só grava `detection` quando há **valor**, e o valor vazio é
 * > justamente a configuração recomendada ("vazio já cobre Kirvano, Cakto,
 * > Hotmart…"). Então o caso comum chegava aqui como `type: undefined`, e o
 * > script saía com `var IC = { type: "", value: "" }` — que **não casa com
 * > nenhum ramo** do `if` lá embaixo. Resultado: todo pixel criado com os
 * > padrões nunca disparou InitiateCheckout pelo clique.
 * >
 * > ⚠️ E o diagnóstico dizia **"ok"**. `conferirSnippet` e `assinatura()`
 * > aplicavam os dois o mesmo `?? "clique_checkout"` ao calcular o hash, então
 * > as duas pontas concordavam sobre um tipo que o script **não tinha**. Um
 * > default aplicado no verificador e não no verificado torna o verificador
 * > cego exatamente ao que ele existe para pegar.
 * >
 * > Por isso `tipoDeIC()` é o único lugar que resolve o padrão, e tudo —
 * > o `IC`, a lista de domínios e a assinatura — deriva dela. Não há como as
 * > três discordarem.
 */
export const TIPO_IC_PADRAO = "clique_checkout";

/** O tipo que ESTE script vai usar de fato. `null` quando o evento está desligado. */
function tipoDeIC(ic: PixelScriptConfig["initiateCheckout"]): string | null {
  return ic.enabled ? (ic.type || TIPO_IC_PADRAO) : null;
}

function jsStr(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Eventos que a Traffik NÃO envia — o espelho no `fbq` os ignora.
 *
 * ⚠️ Só o ESPELHO. O `track()` continua mandando o POST para nós, porque o
 * funil e o Dashboard contam do nosso banco: escolher "meu gateway" para o
 * InitiateCheckout não pode apagar uma etapa inteira do funil como efeito
 * colateral invisível de uma decisão sobre pixel.
 */
/**
 * ⚠️ `Purchase` fica de FORA da lista, sempre.
 *
 * O script nunca o dispara — ele é server-side, sai do `dispatchPixel` no
 * webhook, e `/api/pixel/event` recusa `Purchase` explicitamente. Incluí-lo aqui
 * não mudava comportamento nenhum e **mudava a string assada no snippet**, o que
 * fazia trocar o dono do Purchase pedir "regere e recole o script" à toa.
 */
function eventosAlheios(donos: unknown): string[] {
  return EVENTOS_DO_PIXEL.filter((e) => e !== "Purchase" && !traffikEnvia(donos, e));
}

/**
 * Assinatura do que ESTE script consegue detectar, assada no código gerado.
 *
 * 🔴 Os detectores são literais no snippet (`var LEAD = false;`), enquanto o
 * servidor lê `PixelEventRule` ao vivo. Sem esta assinatura viajando de volta em
 * todo evento, "a regra está ligada e o script instalado é velho" não produz
 * evento nenhum e **nada denuncia**. Ver `lib/pixel/detectores.ts`.
 */
function assinatura(cfg: PixelScriptConfig): string {
  return assinaturaDetectores({
    lead: cfg.lead,
    addToCart: cfg.addToCart,
    // ⚠️ A MESMA função que decide o `IC` do script. Ver `tipoDeIC`: quando o
    // padrão era aplicado só aqui, a assinatura descrevia um script que não
    // existia e o diagnóstico dizia "ok" para um detector morto.
    ic: tipoDeIC(cfg.initiateCheckout),
    icValor: cfg.initiateCheckout.value ?? null,
    nativo: cfg.temPixelNativo !== false,
    // ⚠️ Resolvido AQUI, com o padrão já aplicado. Guardar o mapa cru faria
    // "ausente" e "explicitamente no padrão" gerarem assinaturas diferentes para
    // scripts idênticos — alarme falso puro.
    donos: Object.fromEntries(
      EVENTOS_DO_PIXEL.map((e) => [e, donoDoEvento(cfg.eventOwners, e)]),
    ),
  });
}

/** Lista de domínios da regra por clique; vazio cai nos padrões. */
function dominiosCheckout(ic: PixelScriptConfig["initiateCheckout"]): string[] {
  // Pelo tipo RESOLVIDO: com o tipo cru, a regra recomendada (clique + valor
  // vazio) chegava aqui como `undefined` e devolvia lista vazia — o script saía
  // com `CHECKOUT = []` e nenhum link casava.
  if (tipoDeIC(ic) !== "clique_checkout") return [];
  const doUsuario = (ic.value ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  return doUsuario.length ? doUsuario : CHECKOUT_PADRAO;
}

export function pixelScript(cfg: PixelScriptConfig): string {
  const ic = cfg.initiateCheckout;
  const tipoIC = tipoDeIC(ic);
  return `/*! Traffik Pixel — cole antes de </head> */
(function () {
  "use strict";
  var CONFIG = "${jsStr(cfg.configId)}";
  var API = "${jsStr(cfg.apiBase.replace(/\/+$/, ""))}";
  var LEAD = ${cfg.lead};
  var ADD_TO_CART = ${cfg.addToCart};
  var IC = ${tipoIC ? `{ type: "${jsStr(tipoIC)}", value: "${jsStr(ic.value || "")}" }` : "null"};
  var CHECKOUT = ${JSON.stringify(dominiosCheckout(ic))};
  // Eventos cujo dono NÃO é a Traffik. Só afeta o espelho no pixel nativo:
  // o POST para nós continua, porque o funil e o Dashboard contam do nosso
  // banco e não podem perder uma etapa por causa de uma escolha de pixel.
  var ALHEIOS = ${JSON.stringify(eventosAlheios(cfg.eventOwners))};
  // O que ESTE snippet detecta, congelado no momento em que ele foi gerado.
  // Viaja em todo evento para a gaveta poder dizer "o script instalado está
  // desatualizado" — ver lib/pixel/detectores.ts.
  var DET = "${jsStr(assinatura(cfg))}";
  // Há pixel nativo da Meta nesta página? Sem ele não existe o que espelhar —
  // esperar por um \`fbq\` que nunca vem produziria alarme numa instalação certa.
  var NATIVO = ${cfg.temPixelNativo !== false};

  function fbclid() {
    try {
      if (window.traffik && typeof window.traffik.getData === "function") { var d = window.traffik.getData(); if (d && d.fbclid) return d.fbclid; }
      var m = document.cookie.match(/traffik_track\\s*=\\s*([^;]+)/);
      if (m) { var j = JSON.parse(decodeURIComponent(m[1])); if (j.fbclid) return j.fbclid; }
      var q = new URLSearchParams(location.search); return q.get("fbclid");
    } catch (e) { return null; }
  }
  // Hash estável (FNV-1a) — só para derivar um id curto e reproduzível.
  function hash(s) {
    var h = 2166136261, i;
    for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return h.toString(36);
  }
  /**
   * ÂNCORA DO CARREGAMENTO — um valor por pageview, gerado uma vez.
   *
   * Substitui os três ingredientes instáveis que o id usava antes
   * (\`location.href\`, \`fbclid\` e um balde fixo de tempo). Medido em produção
   * em 01/08/2026, os três divergiam de verdade entre dois POSTs do MESMO
   * carregamento — e id diferente é linha duplicada no banco e evento contado
   * duas vezes na Meta.
   */
  var ANCORA = Math.random().toString(36).slice(2) + Date.now().toString(36);
  var ultimoDeAcao = {};
  var JANELA_ACAO_MS = 1000;
  /**
   * Id do evento — DETERMINÍSTICO, e a âncora NÃO é global: é por evento.
   *
   * ## Por que o desenho é diferente para PageView e para os de ação
   *
   * | | PageView | Lead · AddToCart · InitiateCheckout |
   * |---|---|---|
   * | Quem dispara | o carregamento | o usuário |
   * | Dois disparos no mesmo load significam | **a mesma visita** contada 2× | podem ser **duas intenções reais** |
   * | Logo | deduplicar SEMPRE | deduplicar só se forem quase simultâneos |
   *
   * Deduplicar dois cliques em "comprar" separados por segundos apagaria uma
   * intenção real do funil. Deduplicar dois PageView do mesmo load é
   * exatamente o que se quer.
   *
   * ## O que saiu da chave, e por quê
   *
   * - **\`location.href\` → \`location.pathname\`.** Medido: o mesmo load
   *   POSTou \`/checkout?qty=1\` e, 4 ms depois, \`/checkout?product=…&qty=1\`.
   *   O caminho não muda; a querystring, sim. Manter o \`pathname\` preserva a
   *   distinção entre rotas de uma SPA, que é o motivo de ele existir na chave.
   * - **\`fbclid\` saiu.** Se o cookie ainda não foi lido na 1ª chamada e já foi
   *   na 2ª, o id muda. A âncora já distingue visitantes — dois navegadores
   *   nunca compartilham âncora.
   * - **O balde de 10 s saiu.** Era \`Math.floor(Date.now()/10000)\`: FIXO, não
   *   deslizante. Duas chamadas a 921 ms de distância caíram em baldes
   *   diferentes só por cruzarem a fronteira (visto em produção).
   *
   * ⛔ **Aumentar o balde não era conserto** — só dilui a probabilidade e passa
   * a juntar ações genuinamente distintas. O tempo tinha de SAIR da chave.
   *
   * ⚠️ Limite aceito: numa SPA que dispare PageView duas vezes para o MESMO
   * \`pathname\` no mesmo carregamento (só a query mudando), os dois viram um.
   * É o preço de consertar a causa 1, e é o lado certo de errar.
   */
  function eid(name) {
    if (name === "PageView") return name + "-" + hash([CONFIG, name, location.pathname, ANCORA].join("|"));
    // Eventos de AÇÃO: janela DESLIZANTE, ancorada no primeiro disparo — nunca
    // um balde fixo, que é o que criava a fronteira.
    var agora = Date.now(), u = ultimoDeAcao[name];
    if (u && agora - u.t <= JANELA_ACAO_MS) return u.id;
    var id = name + "-" + hash([CONFIG, name, location.pathname, ANCORA, agora].join("|"));
    ultimoDeAcao[name] = { id: id, t: agora };
    return id;
  }

  function enviar(payload) {
    try {
      fetch(API + "/api/pixel/event", { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(payload), keepalive: true, mode: "cors" }).catch(function () {});
    } catch (e) {}
  }
  function aviso(msg) {
    try { if (window.console && window.console.warn) window.console.warn("[Traffik Pixel] " + msg); } catch (e) {}
  }
  // Conta ao servidor o que aconteceu com o espelho DEPOIS que o evento já foi
  // gravado. \`somenteEspelho\` faz a rota atualizar a linha e parar — sem gravar
  // de novo e sem reenviar para a CAPI.
  function relatar(event, id, estado) {
    enviar({ pixelConfigId: CONFIG, event: event, eventId: id, espelho: estado, somenteEspelho: true });
  }

  /**
   * Espelho no pixel NATIVO da Meta, com o MESMO event_id.
   *
   * ⛔ É isto que faz a deduplicação existir. Sem o espelho, o pixel do
   * navegador manda o evento com um id dele e nós mandamos pela CAPI com o
   * nosso — a Meta recebe dois eventos sem nada em comum e **conta os dois**,
   * inflando o sinal que otimiza a campanha. Dinheiro real, sem erro e sem log.
   *
   * ### 🐛 A guarda silenciosa que custou uma sessão inteira (31/07/2026)
   *
   * Isto já existia como \`if (typeof fbq === "function") …\` dentro de um
   * \`try/catch\` vazio. Quando o snippet está colado ANTES do código da Meta no
   * \`<head>\` — e ele roda \`track("PageView")\` de forma síncrona, no parse —
   * \`fbq\` ainda não existe: a guarda retornava, **sem log nenhum**, e o
   * PageView era contado em dobro pela Meta desde então.
   *
   * Duas correções, e as duas importam:
   *
   * 1. **Não depender da ordem.** Sem \`fbq\`, o espelho entra numa fila e sai
   *    assim que ele aparecer — sondagem de PASSO_MS, com teto em ESPERA_MS.
   * 2. **Não falhar calado.** Estourou o teto: \`console.warn\` com o que fazer,
   *    e \`espelho: "sem-fbq"\` gravado no evento. Sem isso, um \`Lead\` ou um
   *    \`InitiateCheckout\` que parasse de espelhar seria invisível.
   *
   * > ### ⛔ NUNCA definir \`window.fbq\` nós mesmos para "garantir" que existe
   * > O código-base da Meta começa com \`if (f.fbq) return;\`. Um stub nosso faria
   * > o snippet do usuário **abortar inteiro** — o pixel dele nunca inicializaria,
   * > e o estrago seria muito maior que o evento que queríamos espelhar.
   * > Nós nos alinhamos ao pixel que já está lá; não instalamos o de ninguém.
   */
  var ESPERA_MS = 10000, PASSO_MS = 200;
  var fila = [], relogio = null, inicio = 0;

  function temFbq() { return typeof window.fbq === "function"; }
  function atirar(event, id) { window.fbq("track", event, {}, { eventID: id }); }
  function parar() { if (relogio) { clearInterval(relogio); relogio = null; } }

  function drenar() {
    var pend = fila; fila = []; parar();
    for (var i = 0; i < pend.length; i++) {
      try { atirar(pend[i].e, pend[i].id); relatar(pend[i].e, pend[i].id, "adiado-ok"); }
      catch (err) { aviso("falha ao espelhar " + pend[i].e + ": " + err); relatar(pend[i].e, pend[i].id, "erro"); }
    }
  }

  function desistir() {
    var pend = fila; fila = []; parar();
    aviso(
      "o pixel do Facebook (fbq) nao apareceu em " + (ESPERA_MS / 1000) + "s. " +
      "Estes eventos foram so para o servidor, sem par no navegador, e a Meta pode conta-los em dobro: " +
      pend.map(function (p) { return p.e; }).join(", ") + ". " +
      "Confira se o codigo do Facebook esta nesta pagina — e, se estiver, cole o script da Traffik DEPOIS dele."
    );
    for (var i = 0; i < pend.length; i++) relatar(pend[i].e, pend[i].id, "sem-fbq");
  }

  function aguardar() {
    if (relogio) return;
    inicio = Date.now();
    relogio = setInterval(function () {
      if (temFbq()) drenar();
      else if (Date.now() - inicio >= ESPERA_MS) desistir();
    }, PASSO_MS);
  }

  function espelhar(event, id) {
    if (ALHEIOS.indexOf(event) > -1) return "alheio"; // o dono deste evento e outro
    // Sem pixel nativo declarado: nao ha o que espelhar, e insistir geraria
    // 10s de espera + aviso no console em TODA visita de uma instalacao correta.
    // "sem-nativo" e neutro; "sem-fbq" e vermelho, e os dois nao sao a mesma coisa.
    if (!NATIVO) return "sem-nativo";
    if (temFbq()) {
      try { atirar(event, id); return "ok"; }
      catch (err) { aviso("falha ao espelhar " + event + ": " + err); return "erro"; }
    }
    fila.push({ e: event, id: id });
    aguardar();
    return "adiado";
  }

  function track(event, extra) {
    var id = eid(event);
    // ⚠️ O espelho vem ANTES do payload: o estado dele viaja junto do evento, e
    // é o que permite responder "os espelhos estao saindo?" sem abrir o console.
    var espelho = espelhar(event, id);
    var payload = { pixelConfigId: CONFIG, event: event, eventId: id, url: location.href, fbclid: fbclid(), espelho: espelho, det: DET };
    if (extra) for (var k in extra) payload[k] = extra[k];
    enviar(payload);
  }
  window.traffikPixel = { track: track };

  // PageView: sempre ativo, dispara a cada carregamento de página. Não depende
  // de regra — é o evento base do pixel.
  track("PageView");

  // Lead: dispara ao enviar qualquer formulário.
  if (LEAD) document.addEventListener("submit", function () { track("Lead"); }, true);

  // AddToCart: clique em elementos com cara de carrinho.
  if (ADD_TO_CART) document.addEventListener("click", function (e) {
    var el = e.target; while (el && el !== document.body) {
      var t = (el.textContent || "").toLowerCase(), c = (el.className || "") + " " + (el.id || "");
      if (/adicionar ao carrinho|add to cart|comprar/.test(t) || /cart|carrinho/i.test(c)) { track("AddToCart"); return; }
      el = el.parentElement;
    }
  }, true);

  // InitiateCheckout conforme a regra de detecção.
  if (IC) {
    if (IC.type === "clique_checkout") {
      // Padrão: clique num link que leva ao checkout, capturado AQUI, na página
      // de vendas. É o único modo que funciona com checkout hospedado pelo
      // gateway (pay.kirvano.com e afins), onde não dá para instalar script.
      document.addEventListener("click", function (e) {
        var el = e.target, href = "";
        // Sobe até o <a>: o clique costuma cair num <span>/<img> dentro do link.
        while (el && el !== document.body) {
          if (el.tagName === "A" && el.getAttribute("href")) { href = el.getAttribute("href"); break; }
          el = el.parentElement;
        }
        if (!href) return;
        var alvo = href.toLowerCase();
        for (var i = 0; i < CHECKOUT.length; i++) {
          if (alvo.indexOf(CHECKOUT[i]) > -1) { track("InitiateCheckout", { destino: href.slice(0, 500) }); return; }
        }
      }, true);
    } else if (IC.type === "contem_url") {
      // \`IC.value &&\` NAO e defensividade a toa: "".indexOf("") e 0, entao um
      // valor vazio faria TODA visita virar InitiateCheckout e inflar o topo do
      // funil — o oposto exato da falha silenciosa do tipo vazio, e igualmente
      // mudo. Sem trecho de URL, a regra nao dispara.
      if (IC.value && location.href.indexOf(IC.value) > -1) track("InitiateCheckout");
    } else if (IC.value) {
      document.addEventListener("click", function (e) {
        var el = e.target; while (el && el !== document.body) {
          if (IC.type === "contem_texto" && (el.textContent || "").toLowerCase().indexOf(IC.value.toLowerCase()) > -1) { track("InitiateCheckout"); return; }
          if (IC.type === "contem_css") { try { if (el.matches(IC.value.charAt(0) === "." || IC.value.charAt(0) === "#" ? IC.value : "." + IC.value)) { track("InitiateCheckout"); return; } } catch (err) {} }
          el = el.parentElement;
        }
      }, true);
    }
  }
})();
`;
}
