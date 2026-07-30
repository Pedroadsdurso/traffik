/**
 * # Desempate de país quando o IP contradiz a campanha
 *
 * ## O problema que isto resolve
 *
 * **55,6% do tráfego humano deste produto vem do navegador embutido do
 * Instagram e do Facebook**, que sai pela infraestrutura da Meta. Um brasileiro
 * comprando pelo Instagram chega com IP de um datacenter nos EUA ou na Irlanda.
 * Medido em produção: 29 de 198 cliques humanos resolviam para fora do Brasil
 * sendo brasileiros — com `pt_BR` no user agent e, em 8 deles, `FBCR/VIVO`.
 *
 * ## ⛔ NÃO detectamos datacenter. Usamos a SEGMENTAÇÃO DA CAMPANHA.
 *
 * A alternativa considerada era manter uma base de faixas de IP da Meta (ASN) e
 * só desempatar quando o IP caísse nela. **Descartada**, e o motivo decisivo não
 * foi custo:
 *
 * > A segmentação é o que o anunciante **configurou**, não uma inferência. Se a
 * > campanha só roda BR e MX e o IP diz US, o IP está errado **independente do
 * > motivo** — datacenter, VPN, proxy corporativo ou base desatualizada. A
 * > detecção de datacenter resolveria *um* motivo; a segmentação resolve todos.
 *
 * E o caso que a detecção protegeria — IP residencial legítimo sendo
 * sobrescrito — não existe: um IP residencial legítimo **não contradiz** a
 * segmentação da própria campanha que trouxe aquele visitante.
 *
 * ## Como cada sinal é usado: CONJUNTO, nunca afirmação
 *
 * Nenhum sinal aqui nomeia um país sozinho. Cada um produz o **conjunto de
 * países possíveis**, que é intersectado com a segmentação. **Só resolve quando
 * sobra exatamente um.**
 *
 * Isso importa porque operadora não é global: "Claro" opera em BR, AR, CL, CO,
 * PE, entre outros. Dizer `CLARO → BR` seria chutar. Mas `CLARO ∩ {BR, MX}` =
 * `{BR}` resolve com honestidade, e `CLARO ∩ {BR, AR}` não resolve — e aí a
 * resposta certa é **incerto**, não um palpite.
 *
 * ## Ordem dos sinais
 *
 * | # | Sinal | Força | Por quê |
 * |---|---|---|---|
 * | 1 | Segmentação com **um país só** | máxima | não precisa de mais nada |
 * | 2 | `FBCR/<operadora>` | forte | operadora é geográfica por natureza |
 * | 3 | `Accept-Language` | média | header da requisição, com pesos |
 * | 4 | locale do user agent (`pt_BR`) | fraca | é o idioma do APARELHO |
 *
 * ⚠️ O locale é o mais fraco de propósito: brasileiro morando fora mantém
 * `pt_BR`, e celular configurado em inglês no Brasil mostra `en_US`. Ele só é
 * consultado quando os anteriores não resolveram, e mesmo assim precisa
 * sobreviver à interseção.
 */

/** De onde veio o país. Vai para `Click.countrySource` e para a tela. */
export type FontePais =
  | "ip"
  | "campanha"
  | "carrier"
  | "idioma"
  | "locale"
  | "header"
  | "incerto";

export interface Resolucao {
  pais: string | null;
  fonte: FontePais;
}

export interface SinaisDoClique {
  /** País que a base de IP devolveu. `null` se não resolveu. */
  paisDoIp: string | null;
  /** Países da segmentação (união dos conjuntos da campanha). Vazio = mundial. */
  paisesDaCampanha: readonly string[];
  userAgent?: string | null;
  acceptLanguage?: string | null;
}

/**
 * Operadora → países em que ela opera.
 *
 * ⚠️ **Cada entrada é um CONJUNTO, e várias têm mais de um país.** Claro, Movistar
 * e Vodafone operam em dezenas de países; mapeá-las para um só seria inventar
 * precisão que o dado não tem. Quem transforma conjunto em resposta é a
 * interseção com a segmentação da campanha.
 *
 * Cobre as operadoras que aparecem em `FBCR/` no tráfego de anúncio da Meta em
 * português e espanhol. Acrescentar é uma linha.
 */
const OPERADORAS: Record<string, readonly string[]> = {
  // Brasil — as únicas que são inequívocas por si só.
  VIVO: ["BR"],
  TIM: ["BR", "IT"], // TIM Brasil e Telecom Italia
  OI: ["BR"],
  NEXTEL: ["BR", "MX", "AR", "CL", "PE"],
  ALGAR: ["BR"],
  // América Latina — quase todas multipaís.
  CLARO: ["BR", "AR", "CL", "CO", "PE", "EC", "UY", "PY", "GT", "SV", "HN", "NI", "CR", "PA", "DO"],
  MOVISTAR: ["AR", "CL", "CO", "PE", "EC", "UY", "VE", "MX", "ES"],
  TELCEL: ["MX"],
  ENTEL: ["CL", "PE", "BO"],
  TIGO: ["CO", "PY", "BO", "GT", "SV", "HN", "NI"],
  PERSONAL: ["AR", "PY"],
  // Europa.
  MEO: ["PT"],
  NOS: ["PT"],
  VODAFONE: ["PT", "ES", "IT", "DE", "GB", "IE", "GR", "RO", "NL"],
  ORANGE: ["FR", "ES", "PL", "RO", "BE"],
};

/** `pt_BR`, `pt-BR`, `en_US` → a REGIÃO (`BR`, `US`). `null` sem região. */
export function regiaoDoLocale(v: string | null | undefined): string | null {
  const m = /^[a-z]{2,3}[_-]([A-Za-z]{2})\b/.exec((v ?? "").trim());
  return m ? m[1]!.toUpperCase() : null;
}

/**
 * Regiões de um `Accept-Language`, em ordem de preferência declarada.
 *
 * `pt-BR,pt;q=0.9,en-US;q=0.8` → `["BR", "US"]`. Entradas sem região (`pt`,
 * `en`) são ignoradas: elas dizem o idioma, não o lugar.
 */
export function regioesDoAcceptLanguage(v: string | null | undefined): string[] {
  if (!v) return [];
  const itens = v
    .split(",")
    .map((p) => {
      const [tag, ...params] = p.trim().split(";");
      const q = params.find((x) => x.trim().startsWith("q="));
      return { tag: tag ?? "", q: q ? Number(q.split("=")[1]) || 0 : 1 };
    })
    .filter((x) => x.tag)
    .sort((a, b) => b.q - a.q);
  const out: string[] = [];
  for (const { tag } of itens) {
    const r = regiaoDoLocale(tag);
    if (r && !out.includes(r)) out.push(r);
  }
  return out;
}

/** Operadora declarada em `FBCR/` no user agent do app da Meta. */
export function operadoraDoUserAgent(ua: string | null | undefined): string | null {
  const m = /FBCR\/([A-Za-z0-9 _.-]+)/.exec(ua ?? "");
  if (!m) return null;
  // "VIVO", "vivo br", "Claro_BR" → chave canônica.
  const bruto = m[1]!.trim().toUpperCase().replace(/[_.-]/g, " ");
  for (const nome of Object.keys(OPERADORAS)) {
    if (bruto === nome || bruto.startsWith(nome + " ") || bruto.includes(" " + nome)) return nome;
  }
  return null;
}

/** Locale embutido no user agent do app da Meta (`FBLC/pt_BR`) ou do Instagram. */
export function localeDoUserAgent(ua: string | null | undefined): string | null {
  const s = ua ?? "";
  const fblc = /FBLC\/([a-zA-Z]{2}[_-][a-zA-Z]{2})/.exec(s);
  if (fblc) return fblc[1]!;
  // Instagram: "...; pt_BR; pt; scale=3.00; ..."
  const solto = /;\s*([a-z]{2}_[A-Z]{2})\s*;/.exec(s);
  return solto ? solto[1]! : null;
}

/** Interseção preservando a ordem do primeiro conjunto. */
function intersecao(a: readonly string[], b: readonly string[]): string[] {
  const setB = new Set(b.map((x) => x.toUpperCase()));
  return a.map((x) => x.toUpperCase()).filter((x) => setB.has(x));
}

/**
 * Resolve o país de um clique.
 *
 * ## O contrato
 *
 * - **Sem contradição** (campanha mundial, ou o IP está entre os países da
 *   campanha) → devolve o país do IP, fonte `ip`. Nenhum sinal fraco é
 *   consultado: não há por que adivinhar quando a medida é coerente.
 * - **Com contradição** → o país do IP é **descartado**, porque é sabidamente
 *   errado, e entram os sinais em ordem.
 * - **Nada resolve** → `{ pais: null, fonte: "incerto" }`. **Nunca chuta.**
 *
 * ⚠️ Devolver `null` é melhor que devolver o país do IP quando ele contradiz a
 * campanha: o valor do IP é *conhecidamente* errado, e gravá-lo produziria um
 * número plausível e falso no mapa. `null` vira "Não identificado" na tela, que
 * é uma afirmação verdadeira.
 */
export function resolverPaisDoClique(s: SinaisDoClique): Resolucao {
  const campanha = s.paisesDaCampanha.map((c) => c.trim().toUpperCase()).filter(Boolean);
  const ip = s.paisDoIp?.trim().toUpperCase() || null;

  // Sem segmentação = campanha mundial (ou ainda não sincronizada). Não há o que
  // contradizer: lista vazia vale para todos, como toda dimensão deste projeto.
  if (campanha.length === 0) {
    return ip ? { pais: ip, fonte: "ip" } : { pais: null, fonte: "incerto" };
  }

  // IP compatível com a segmentação: é a medida, e ela concorda. Fim.
  if (ip && campanha.includes(ip)) return { pais: ip, fonte: "ip" };

  // ── Daqui para baixo o IP contradiz a campanha (ou não resolveu) ──

  // 1. Um país só na segmentação: não há ambiguidade a desempatar.
  if (campanha.length === 1) return { pais: campanha[0]!, fonte: "campanha" };

  // 2. Operadora — sinal forte, mas quase sempre multipaís. Só vale se a
  //    interseção com a campanha sobrar exatamente um.
  const op = operadoraDoUserAgent(s.userAgent);
  if (op) {
    const cand = intersecao(OPERADORAS[op] ?? [], campanha);
    if (cand.length === 1) return { pais: cand[0]!, fonte: "carrier" };
  }

  // 3. Accept-Language — na ordem de preferência declarada pelo navegador.
  for (const r of regioesDoAcceptLanguage(s.acceptLanguage)) {
    if (campanha.includes(r)) return { pais: r, fonte: "idioma" };
  }

  // 4. Locale do user agent — o mais fraco: é o idioma do APARELHO.
  const loc = regiaoDoLocale(localeDoUserAgent(s.userAgent));
  if (loc && campanha.includes(loc)) return { pais: loc, fonte: "locale" };

  // Nada resolveu. O IP é conhecidamente errado, então não volta.
  return { pais: null, fonte: "incerto" };
}
