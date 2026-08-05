/**
 * # Checkout próprio: o que só o desenvolvedor da página pode fazer
 *
 * O script resolve o InitiateCheckout. Ele **não** resolve a atribuição da
 * venda: quem cria a cobrança no gateway é o site, e é lá que o `click_id` e o
 * IP do comprador precisam entrar.
 *
 * Sem isso a venda entra **sem campanha, sem criativo e sem país** — e continua
 * aparecendo no faturamento, o que é exatamente o que impede alguém de
 * perceber. É o mesmo estado das vendas da OnyxPag hoje.
 *
 * ## ⚠️ Quem lê este texto é o DESENVOLVEDOR do site, não o usuário da
 * ## ferramenta
 *
 * Então ele não pode pressupor nada: nem que a pessoa sabe o que é um clique
 * rastreado, nem o que a ferramenta faz. Cada passo diz o que fazer e o que
 * acontece se ficar de fora.
 */

/**
 * ⛔ O campo é `click_id`, **NUNCA `sck`**.
 *
 * O parser lê os dois, mas em destinos diferentes: só o `click_id` vira o
 * `matchClick`. Mandar em `sck` grava a string e **não casa clique nenhum** —
 * sem erro em lugar nenhum, com a venda entrando sem campanha.
 */
export const CAMPO_CLICK_ID = "click_id";

export interface PassoDeIntegracao {
  titulo: string;
  /** O que acontece se este passo ficar de fora. */
  semIsso: string;
  codigo?: string;
  /** Linha extra em âmbar, quando há uma armadilha específica. */
  atencao?: string;
}

/**
 * O trecho que lê o identificador do clique no navegador.
 *
 * ⚠️ Lê do cookie **e** da querystring: o cookie é o caminho normal, mas na
 * primeira visita o script pode ainda não tê-lo gravado quando o checkout
 * abre em outra aba. A querystring cobre esse caso.
 */
const LER_CLICK_ID = `// Identificador do clique — o script de rastreamento grava no cookie.
function traffikClickId() {
  var m = document.cookie.match(/(?:^|;\\s*)traffik_track=([^;]+)/);
  if (m) {
    try {
      var dados = JSON.parse(decodeURIComponent(m[1]));
      if (dados && dados.click_id) return dados.click_id;
    } catch (e) {}
  }
  // Recém-chegado: o cookie pode ainda não existir, mas o id veio na URL.
  return new URLSearchParams(location.search).get("click_id") || null;
}`;

const ENVIAR = `var clickId = traffikClickId();

// ⚠️ Vai nos DOIS campos de propósito: gateways diferentes devolvem um ou
// outro no webhook, e mandar nos dois não custa nada.
var corpo = {
  // ...os campos que você já manda (valor, produto, comprador)
  tracking: { click_id: clickId },
  metadata: { click_id: clickId },
};`;

export const PASSOS_CHECKOUT_PROPRIO: PassoDeIntegracao[] = [
  {
    titulo: "1. Instale o script nas DUAS páginas",
    semIsso:
      "Sem ele na página de pagamento, o início de checkout nunca é registrado — o funil mostra visita e venda, e nada no meio.",
    atencao:
      "É o mesmo script, sem alteração: na página de vendas e na de pagamento.",
  },
  {
    titulo: "2. Mande o identificador do clique ao criar a cobrança",
    semIsso:
      "A venda entra sem campanha e sem criativo. Ela aparece no faturamento normalmente, então o problema só é notado quando alguém compara o total com a soma das campanhas.",
    codigo: `${LER_CLICK_ID}\n\n${ENVIAR}`,
    atencao:
      "Se a cobrança é criada no seu servidor, este valor precisa viajar do navegador até lá — leia no front e envie junto no seu próprio POST.",
  },
  {
    titulo: "3. Mande o IP de quem está comprando",
    semIsso:
      "A venda entra sem país. O mapa e o ranking por país ficam incompletos, e a correspondência com o Facebook piora.",
    codigo: `// No SERVIDOR, ao criar a cobrança. Nunca leia isto do navegador:
// o cliente pode escrever qualquer coisa ali.
//
// Atrás de proxy (nginx, Cloudflare, Vercel), o IP real é o ÚLTIMO da
// cadeia do X-Forwarded-For, não o primeiro — o começo é o que o cliente
// mandou e pode ser inventado.
const ip = (req.headers["x-forwarded-for"] || "").split(",").map(s => s.trim()).filter(Boolean).pop()
        || req.socket.remoteAddress;

corpo.customer_ip = ip;`,
    atencao:
      "O IP tem de sair do seu servidor. Lido no navegador, ele é forjável e o país sai errado.",
  },
];
