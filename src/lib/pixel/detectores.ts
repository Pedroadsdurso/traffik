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
  /**
   * Há pixel nativo da Meta na página? Decide se o script espelha no `fbq`.
   *
   * 🔴 Entrou na v2 porque a v1 **não cobria o que o script realmente assa**.
   */
  nativo: boolean;
  /**
   * Dono de cada evento, já resolvido (sem herdar padrão na hora da comparação).
   *
   * ### 🔴 Este campo é o buraco que a v1 tinha
   *
   * `pixelScript()` embute `var ALHEIOS = [...]` a partir de `eventOwners`, mas a
   * assinatura v1 cobria só `lead`/`addToCart`/`ic`. Mudar o dono de um evento
   * gerava script defasado **que o aviso de divergência não pegava** — e uma
   * direção específica recria o bug que este trabalho todo existe para consertar:
   *
   * | Passo | O que acontece |
   * |---|---|
   * | Dono do `PageView` vai de "pixel da página" para "Trackhub" | |
   * | Servidor (decide **ao vivo**) | passa a mandar PageView à CAPI |
   * | Script instalado (`ALHEIOS` **congelado**) | continua sem espelhar |
   * | Pixel nativo da página | segue disparando o dele, sem `eid` |
   * | **Resultado** | CAPI sem par + nativo sozinho = **a Meta conta 2 de novo** |
   */
  donos: Record<string, string>;
}

/**
 * Versão do formato.
 *
 * ⚠️ **Campo novo no que o script assa PRECISA entrar aqui** — senão a assinatura
 * passa a dizer "igual" para snippets que já não são, e o diagnóstico vira teatro.
 *
 * ⚠️ Subir a versão **não** transforma todo script instalado em "divergente": a
 * comparação usa só os campos que a versão reportada conhece. Ver
 * `diferencasDeDetectores` e `avisoDeVersao`.
 */
const VERSAO = "v3";

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

/**
 * Ordem fixa dos eventos no hash dos donos — mudá-la invalida toda assinatura.
 *
 * > ### 🔴 `Purchase` saiu daqui na v3, e a razão é o que este módulo mede
 * > A assinatura existe para responder **"o script instalado se comporta como a
 * > configuração salva?"**. O `Purchase` nunca sai do script: ele é server-side,
 * > disparado pelo webhook. Trocar o dono dele mudava o hash e a gaveta mandava
 * > **regerar e recolar o snippet à toa** — e aviso que às vezes mente treina o
 * > usuário a ignorar todos, inclusive os certos.
 * >
 * > ⚠️ Só entra aqui o que o script REALMENTE assa e usa. Se um dia o
 * > `Purchase` passar a sair do navegador, ele volta — junto com um bump de
 * > versão.
 */
const ORDEM_EVENTOS = ["PageView", "Lead", "AddToCart", "InitiateCheckout"];

function hashDonos(donos: Record<string, string>): string {
  return fnv36(ORDEM_EVENTOS.map((e) => `${e}=${donos[e] ?? "?"}`).join(";"));
}

/** Assinatura estável do que um script gerado consegue detectar. */
export function assinaturaDetectores(d: Detectores): string {
  return [
    VERSAO,
    `l${d.lead ? 1 : 0}`,
    `a${d.addToCart ? 1 : 0}`,
    `i${d.ic ?? "off"}`,
    `v${fnv36(normalizarValor(d.ic, d.icValor))}`,
    `n${d.nativo ? 1 : 0}`,
    `d${hashDonos(d.donos)}`,
  ].join(".");
}

export interface AssinaturaLida {
  versao: string;
  lead: boolean;
  addToCart: boolean;
  ic: string | null;
  hashValor: string;
  /** Só na v2 em diante. `null` = o script não sabe reportar isto. */
  nativo: boolean | null;
  hashDonos: string | null;
}

/**
 * Lê uma assinatura reportada. Formato irreconhecível → `null`.
 *
 * ⚠️ Aceita **v1 (5 partes) e v2 (7 partes)**. Um script antigo continua legível
 * naquilo que ele conhece; os campos que ele nunca soube reportar voltam `null`,
 * e a comparação os ignora em vez de acusar divergência inventada.
 */
export function lerAssinatura(s: string): AssinaturaLida | null {
  const p = s.split(".");
  if (p.length !== 5 && p.length !== 7) return null;
  const [versao, l, a, i, v, n, d] = p;
  if (!versao || !l || !a || !i || !v) return null;
  if (l[0] !== "l" || a[0] !== "a" || i[0] !== "i" || v[0] !== "v") return null;
  const temExtras = p.length === 7 && n?.[0] === "n" && d?.[0] === "d";
  const ic = i.slice(1);
  return {
    versao,
    lead: l[1] === "1",
    addToCart: a[1] === "1",
    ic: ic === "off" ? null : ic,
    hashValor: v.slice(1),
    nativo: temExtras ? n!.slice(1) === "1" : null,
    hashDonos: temExtras ? d!.slice(1) : null,
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

  // ⚠️ Campos que a versão INSTALADA não sabe reportar ficam de fora da
  // comparação. Acusar divergência num campo que aquele script nunca conheceu
  // seria alarme falso — e alarme que às vezes mente treina o usuário a ignorar
  // todos, inclusive os certos. Quem cobre esse caso é `avisoDeVersao`.
  if (inst.nativo !== null && esp.nativo !== null && inst.nativo !== esp.nativo) {
    out.push(
      esp.nativo
        ? "Você respondeu que TEM o pixel do Facebook na página, mas o script instalado não espelha os eventos nele — a Meta pode contar as conversões em dobro."
        : "Você respondeu que NÃO tem o pixel do Facebook na página, mas o script instalado fica esperando por ele em toda visita.",
    );
  }
  // ⚠️ O hash dos donos só é comparável DENTRO da mesma versão: a v3 tirou o
  // `Purchase` da conta (ver `ORDEM_EVENTOS`), então um script v2 reporta um
  // hash calculado sobre outro conjunto de eventos. Compará-los acusaria
  // divergência em 100% dos scripts v2 instalados, inclusive nos corretos —
  // exatamente o alarme falso que este módulo existe para não produzir.
  if (
    inst.versao === esp.versao &&
    inst.hashDonos !== null &&
    esp.hashDonos !== null &&
    inst.hashDonos !== esp.hashDonos
  ) {
    out.push(
      "Quem envia cada evento mudou depois que este script foi gerado — e essa escolha também fica gravada nele.",
    );
  }

  // Assinaturas diferentes sem diferença explicável: campo novo que os testes
  // acima ainda não cobrem. Dizer "está desatualizado" é verdade e é acionável;
  // ficar calado com as strings diferentes seria o modo de falha que este
  // módulo existe para evitar.
  //
  // ⚠️ Só quando as duas versões são a MESMA. Entre versões diferentes, string
  // diferente é o esperado (campos a mais), e quem fala disso é `avisoDeVersao`.
  if (out.length === 0 && inst.versao === esp.versao) {
    out.push("O script instalado não corresponde à configuração salva.");
  }
  return out;
}

/**
 * O que a versão do script instalado NÃO permite verificar.
 *
 * > ### ⛔ Isto é NOTA, não divergência
 * > Um script v1 pode estar perfeitamente correto: ele só não sabe reportar
 * > "quem envia cada evento". Marcá-lo como divergente pintaria de âmbar a
 * > gaveta de todo usuário no dia do deploy, para a maioria sem nada errado —
 * > e um aviso que aparece sempre vira ruído que se aprende a ignorar.
 * >
 * > A nota diz o que fazer **se** a condição se aplicar, e some sozinha na
 * > primeira reinstalação.
 */
export function avisoDeVersao(instalado: string): string | null {
  const inst = lerAssinatura(instalado);
  if (!inst || inst.hashDonos !== null) return null;
  return (
    "Este script é anterior ao registro de “quem envia cada evento”, então não dá para conferir " +
    "essa parte. Se você mudou isso depois de instalar, copie o script de novo."
  );
}
