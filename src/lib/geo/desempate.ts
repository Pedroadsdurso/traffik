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
 * | 3 | **Fuso horário do navegador** | forte | diz ONDE a pessoa está, não que idioma ela fala |
 * | 4 | `Accept-Language` | média | header da requisição, com pesos |
 * | 5 | locale do user agent (`pt_BR`) | fraca | é o idioma do APARELHO |
 *
 * ⚠️ **O fuso vem ANTES do idioma de propósito.** Os dois são configuração do
 * aparelho, mas medem coisas diferentes: um brasileiro morando em Portugal
 * mantém `pt_BR` no idioma e tem `Europe/Lisbon` no relógio. O fuso acompanha
 * **onde a pessoa está**, que é exatamente a pergunta. O idioma acompanha de
 * onde ela veio.
 *
 * ⚠️ O locale é o mais fraco de propósito: brasileiro morando fora mantém
 * `pt_BR`, e celular configurado em inglês no Brasil mostra `en_US`. Ele só é
 * consultado quando os anteriores não resolveram, e mesmo assim precisa
 * sobreviver à interseção.
 *
 * ## ⚠️ `es-419` devolve `null`, e isso está certo
 *
 * `es-419` é o espanhol "da América Latina" — o `419` é um código de **grupo de
 * região** (M.49), não um país. `regiaoDoLocale` exige duas LETRAS, então ele
 * não casa e nenhum candidato é produzido. É o mesmo tratamento dado a
 * `country_groups` na segmentação da campanha: expandir "LATAM" para 20 países
 * tornaria a interseção tão larga que nunca sobraria um só — um desempate que
 * nunca dispara é pior que desempate ausente, porque parece estar funcionando.
 *
 * Na prática ele não custa nada: `es-419` é comum em Android da região, mas
 * quem manda `es-419` quase sempre manda também o fuso, que resolve melhor.
 */

/** De onde veio o país. Vai para `Click.countrySource` e para a tela. */
export type FontePais =
  | "ip"
  | "campanha"
  | "carrier"
  | "fuso"
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
  /** `Intl.DateTimeFormat().resolvedOptions().timeZone` — `America/Lima`. */
  timezone?: string | null;
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
  // A Telefónica é a dona da marca Movistar; o `FBCR/` às vezes traz a razão
  // social em vez da marca comercial. Mesmo conjunto, para não perder o sinal.
  TELEFONICA: ["AR", "CL", "CO", "PE", "EC", "UY", "VE", "MX", "ES"],
  TELCEL: ["MX"],
  ENTEL: ["CL", "PE", "BO"],
  TIGO: ["CO", "PY", "BO", "GT", "SV", "HN", "NI"],
  PERSONAL: ["AR", "PY"],
  WOM: ["CL", "CO"],
  BITEL: ["PE"],
  ANTEL: ["UY"],
  DIGITEL: ["VE"],
  MOVILNET: ["VE"],
  // A AT&T opera no México e nos EUA. Ambígua sozinha — e é justamente por isso
  // que ela entra como CONJUNTO: numa campanha que roda só MX, resolve.
  ATT: ["MX", "US"],
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
  // ⚠️ O `&` faz parte do nome de operadora ("AT&T"). Sem ele na classe, a
  // captura parava em "AT" e o casamento falhava em silêncio — pego pelo teste.
  const m = /FBCR\/([A-Za-z0-9 &_.-]+)/.exec(ua ?? "");
  if (!m) return null;
  // "VIVO", "vivo br", "Claro_BR" → chave canônica.
  const bruto = m[1]!.trim().toUpperCase().replace(/[_.-]/g, " ");
  for (const nome of Object.keys(OPERADORAS)) {
    if (bruto === nome || bruto.startsWith(nome + " ") || bruto.includes(" " + nome)) return nome;
  }
  // ⚠️ Segunda passada sem pontuação nenhuma: a AT&T chega como `AT&T` e o `&`
  // não é separador, então ela não casaria com a chave `ATT` acima. Compactar
  // resolve sem afrouxar o casamento das outras (a comparação segue sendo por
  // igualdade ou por limite de palavra na 1ª passada).
  const compacto = bruto.replace(/[^A-Z0-9]/g, "");
  return Object.keys(OPERADORAS).find((nome) => compacto === nome) ?? null;
}

/**
 * Fuso IANA → país.
 *
 * ## Por que uma tabela PARCIAL é segura aqui
 *
 * A objeção histórica a usar o fuso era que converter zona→país exigiria as
 * ~400 zonas IANA, e que uma tabela incompleta funcionaria para alguns países e
 * não para outros. **Isso vale para quem usa o fuso como AFIRMAÇÃO.** Aqui ele
 * é um conjunto candidato que ainda precisa sobreviver à interseção com a
 * segmentação da campanha — exatamente como a operadora.
 *
 * Zona ausente da tabela produz **nenhum candidato** e o resolvedor cai para o
 * sinal seguinte. Ou seja: o pior caso de uma entrada faltando é o
 * comportamento que já existia antes desta tabela. Acrescentar é uma linha.
 *
 * ⚠️ **Nunca mapeie uma zona para mais de um país.** Zona IANA é definida
 * justamente por ter história de offset única dentro de um país; se aparecer um
 * caso ambíguo, ele deve ficar de FORA da tabela, não virar um palpite.
 */
const PAIS_DO_FUSO: Record<string, string> = {
  // ── Brasil ──
  "america/sao_paulo": "BR", "america/bahia": "BR", "america/fortaleza": "BR",
  "america/recife": "BR", "america/belem": "BR", "america/manaus": "BR",
  "america/cuiaba": "BR", "america/campo_grande": "BR", "america/porto_velho": "BR",
  "america/rio_branco": "BR", "america/boa_vista": "BR", "america/santarem": "BR",
  "america/maceio": "BR", "america/araguaina": "BR", "america/eirunepe": "BR",
  "america/noronha": "BR",
  // ── Hispano-América ──
  "america/santiago": "CL", "america/punta_arenas": "CL", "pacific/easter": "CL",
  "america/lima": "PE",
  "america/bogota": "CO",
  "america/caracas": "VE",
  "america/guayaquil": "EC", "pacific/galapagos": "EC",
  "america/la_paz": "BO",
  "america/asuncion": "PY",
  "america/montevideo": "UY",
  "america/mexico_city": "MX", "america/cancun": "MX", "america/merida": "MX",
  "america/monterrey": "MX", "america/matamoros": "MX", "america/chihuahua": "MX",
  "america/hermosillo": "MX", "america/mazatlan": "MX", "america/tijuana": "MX",
  "america/ojinaga": "MX", "america/bahia_banderas": "MX",
  "america/panama": "PA", "america/costa_rica": "CR", "america/guatemala": "GT",
  "america/el_salvador": "SV", "america/tegucigalpa": "HN", "america/managua": "NI",
  "america/santo_domingo": "DO", "america/havana": "CU", "america/puerto_rico": "PR",
  "america/port-au-prince": "HT", "america/jamaica": "JM",
  // ── América do Norte ──
  "america/new_york": "US", "america/chicago": "US", "america/denver": "US",
  "america/los_angeles": "US", "america/phoenix": "US", "america/anchorage": "US",
  "america/detroit": "US", "america/boise": "US", "america/juneau": "US",
  "pacific/honolulu": "US",
  "america/toronto": "CA", "america/vancouver": "CA", "america/edmonton": "CA",
  "america/winnipeg": "CA", "america/halifax": "CA", "america/st_johns": "CA",
  "america/regina": "CA",
  // ── Europa ──
  "europe/lisbon": "PT", "atlantic/madeira": "PT", "atlantic/azores": "PT",
  "europe/madrid": "ES", "atlantic/canary": "ES", "africa/ceuta": "ES",
  "europe/rome": "IT", "europe/paris": "FR", "europe/berlin": "DE",
  "europe/london": "GB", "europe/dublin": "IE", "europe/amsterdam": "NL",
  "europe/brussels": "BE", "europe/zurich": "CH", "europe/vienna": "AT",
  "europe/warsaw": "PL", "europe/bucharest": "RO", "europe/athens": "GR",
  "europe/stockholm": "SE", "europe/oslo": "NO", "europe/copenhagen": "DK",
  "europe/helsinki": "FI", "europe/prague": "CZ", "europe/budapest": "HU",
  "europe/moscow": "RU", "europe/kyiv": "UA", "europe/kiev": "UA",
  // ── Resto do mundo, os de maior tráfego ──
  "asia/tokyo": "JP", "asia/shanghai": "CN", "asia/kolkata": "IN",
  "asia/calcutta": "IN", "asia/seoul": "KR", "asia/manila": "PH",
  "asia/jakarta": "ID", "asia/bangkok": "TH", "asia/dubai": "AE",
  "asia/jerusalem": "IL", "australia/sydney": "AU", "australia/melbourne": "AU",
  "africa/lagos": "NG", "africa/johannesburg": "ZA", "africa/cairo": "EG",
  "africa/nairobi": "KE", "africa/casablanca": "MA", "africa/luanda": "AO",
  "africa/maputo": "MZ",
};

/**
 * Zonas cujo país se decide pelo PREFIXO — a IANA agrupa as subdivisões de um
 * mesmo país sob um segundo nível (`America/Argentina/Cordoba`), e listar as 12
 * argentinas uma a uma envelheceria a cada revisão do banco de dados de fusos.
 */
const PREFIXO_DO_FUSO: readonly (readonly [string, string])[] = [
  ["america/argentina/", "AR"],
  ["america/indiana/", "US"],
  ["america/kentucky/", "US"],
  ["america/north_dakota/", "US"],
];

/** `America/Lima` → `PE`. `null` quando a zona não está na tabela. */
export function paisDoFuso(tz: string | null | undefined): string | null {
  const k = (tz ?? "").trim().toLowerCase().replace(/\\/g, "/");
  if (!k) return null;
  if (PAIS_DO_FUSO[k]) return PAIS_DO_FUSO[k]!;
  const pref = PREFIXO_DO_FUSO.find(([p]) => k.startsWith(p));
  return pref ? pref[1] : null;
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

  // 3. Fuso do navegador — sinal GEOGRÁFICO, ao contrário dos dois seguintes,
  //    que são linguísticos. Vem antes do idioma porque mede onde a pessoa
  //    ESTÁ, e não de onde ela veio. Zona fora da tabela devolve null e o
  //    resolvedor segue — a tabela parcial nunca piora o resultado.
  const fuso = paisDoFuso(s.timezone);
  if (fuso && campanha.includes(fuso)) return { pais: fuso, fonte: "fuso" };

  // 4. Accept-Language — na ordem de preferência declarada pelo navegador.
  for (const r of regioesDoAcceptLanguage(s.acceptLanguage)) {
    if (campanha.includes(r)) return { pais: r, fonte: "idioma" };
  }

  // 5. Locale do user agent — o mais fraco: é o idioma do APARELHO.
  const loc = regiaoDoLocale(localeDoUserAgent(s.userAgent));
  if (loc && campanha.includes(loc)) return { pais: loc, fonte: "locale" };

  // Nada resolveu. O IP é conhecidamente errado, então não volta.
  return { pais: null, fonte: "incerto" };
}
