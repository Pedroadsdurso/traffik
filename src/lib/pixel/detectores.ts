/**
 * # O detector fica CONGELADO no snippet instalado
 *
 * `pixelScript()` **assa** os detectores no código gerado:
 *
 * ```js
 * var LEAD = false;
 * if (LEAD) document.addEventListener("submit", …);
 * ```
 *
 * O servidor, por outro lado, consulta `PixelEventRule` **ao vivo** em toda
 * requisição. As duas pontas divergem no instante em que alguém mexe na gaveta
 * sem reinstalar o script — e as duas direções NÃO são simétricas:
 *
 * | Na gaveta | No script instalado | O que acontece |
 * |---|---|---|
 * | Lead **ligado** | `LEAD=false` | 🔴 **nenhum evento sai, e nada denuncia** |
 * | Lead desligado | `LEAD=true` | o evento sai e o servidor recusa com `regra desabilitada` — barulhento, tudo bem |
 *
 * A primeira linha é o problema: a tela mostra a regra ligada, o funil não
 * cresce, e o único jeito de descobrir é abrir o DevTools na página do cliente.
 * **Com clientes isso não escala** — não dá para depurar o site de cada um.
 *
 * ## A assinatura
 *
 * O script já reporta pelo POST em todo evento. Basta ele mandar junto **o que
 * ele tem ligado**, e o servidor comparar com a regra ao vivo. Esta é a fonte
 * única do formato: quem gera o script e quem confere a divergência chamam a
 * MESMA função, então elas não têm como divergir por conta própria.
 *
 * > ⚠️ **A comparação é de STRING, e é por isso que ela é confiável.** Qualquer
 * > campo novo que entre no detector precisa entrar aqui também — senão a
 * > assinatura passa a dizer "igual" para snippets que já não são.
 */

export interface Detectores {
  lead: boolean;
  addToCart: boolean;
  /** Tipo da regra de Initiate Checkout; `null` quando o evento está desligado. */
  ic: string | null;
  /** Valor da regra (texto, seletor CSS, domínios). Entra na assinatura por hash. */
  icValor: string | null;
}

/** Versão do formato. Muda quando um campo novo entra — snippet velho vira divergente. */
const VERSAO = "v1";

/**
 * FNV-1a em base36 — o MESMO algoritmo do `eid()` do script.
 *
 * O valor da regra entra por hash em vez de literal: um seletor CSS ou uma lista
 * de domínios deixaria a assinatura longa e cheia de caracteres que precisariam
 * de escape ao virar string dentro do JS gerado.
 */
export function fnv36(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(36);
}

/**
 * Normaliza o valor antes do hash.
 *
 * ⚠️ Sem isto, trocar `"pay.kirvano.com, hotmart"` por `"pay.kirvano.com,hotmart"`
 * produziria "script desatualizado" para um script que se comporta exatamente
 * igual — e **aviso que às vezes mente treina o usuário a ignorar todos**.
 * A normalização espelha o que o script realmente faz com o valor:
 * `dominiosCheckout()` já divide por vírgula, apara e passa para minúsculas.
 */
function normalizarValor(tipo: string | null, valor: string | null): string {
  if (!tipo) return "";
  const v = (valor ?? "").trim();
  if (tipo === "clique_checkout") {
    return v
      .toLowerCase()
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean)
      .join(",");
  }
  return v;
}

/** Assinatura estável do que um script gerado consegue detectar. */
export function assinaturaDetectores(d: Detectores): string {
  return [
    VERSAO,
    `l${d.lead ? 1 : 0}`,
    `a${d.addToCart ? 1 : 0}`,
    `i${d.ic ?? "off"}`,
    `v${fnv36(normalizarValor(d.ic, d.icValor))}`,
  ].join(".");
}

export interface AssinaturaLida {
  versao: string;
  lead: boolean;
  addToCart: boolean;
  ic: string | null;
  hashValor: string;
}

/** Lê uma assinatura reportada. Formato irreconhecível → `null`. */
export function lerAssinatura(s: string): AssinaturaLida | null {
  const p = s.split(".");
  if (p.length !== 5) return null;
  const [versao, l, a, i, v] = p as [string, string, string, string, string];
  if (!versao || l[0] !== "l" || a[0] !== "a" || i[0] !== "i" || v[0] !== "v") return null;
  const ic = i.slice(1);
  return {
    versao,
    lead: l[1] === "1",
    addToCart: a[1] === "1",
    ic: ic === "off" ? null : ic,
    hashValor: v.slice(1),
  };
}

const NOME_IC: Record<string, string> = {
  clique_checkout: "clique no link de checkout",
  contem_texto: "contém texto",
  contem_css: "contém CSS",
  contem_url: "contém URL da página",
};

const nomeIc = (t: string | null) => (t ? (NOME_IC[t] ?? t) : "desligado");

/**
 * O que mudou entre o script instalado e a configuração salva, em frases que
 * dizem a CONSEQUÊNCIA.
 *
 * ⚠️ As duas direções aparecem, com textos diferentes de propósito: "ligado aqui
 * e desligado lá" é perda silenciosa de evento; o contrário é só ruído recusado
 * pelo servidor. Tratar as duas com a mesma frase esconderia qual delas custa
 * conversão.
 */
export function diferencasDeDetectores(instalado: string, esperado: string): string[] {
  if (instalado === esperado) return [];

  const inst = lerAssinatura(instalado);
  const esp = lerAssinatura(esperado);
  if (!inst || !esp) {
    return ["O script instalado é de uma versão anterior e não sabe informar o que detecta."];
  }
  if (inst.versao !== esp.versao) {
    return ["O script instalado foi gerado por uma versão anterior da ferramenta."];
  }

  const out: string[] = [];
  const par = (nome: string, ligadoAqui: boolean, ligadoLa: boolean, oQueEleFaz: string) => {
    if (ligadoAqui === ligadoLa) return;
    out.push(
      ligadoAqui
        ? `${nome} está ligado aqui, mas o script instalado não ${oQueEleFaz} — nenhum evento chega.`
        : `${nome} está desligado aqui, mas o script instalado ainda dispara — os eventos chegam e são recusados.`,
    );
  };

  par("Lead", esp.lead, inst.lead, "escuta o envio de formulários");
  par("Add To Cart", esp.addToCart, inst.addToCart, "escuta os cliques de carrinho");

  if (esp.ic !== inst.ic) {
    out.push(
      `A regra de Initiate Checkout aqui é “${nomeIc(esp.ic)}”; o script instalado usa “${nomeIc(inst.ic)}”.`,
    );
  } else if (esp.hashValor !== inst.hashValor) {
    out.push("O valor da regra de Initiate Checkout mudou depois que este script foi gerado.");
  }

  // Assinaturas diferentes sem diferença explicável: campo novo que o `par`
  // acima ainda não cobre. Dizer "está desatualizado" é verdade e é acionável;
  // ficar calado com as strings diferentes seria o modo de falha que este
  // módulo existe para evitar.
  if (out.length === 0) out.push("O script instalado não corresponde à configuração salva.");
  return out;
}
