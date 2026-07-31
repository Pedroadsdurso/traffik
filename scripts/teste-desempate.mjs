/**
 * Asserções de `lib/geo/desempate.ts` — país quando o IP contradiz a campanha.
 *
 * Os user agents são **reais**, do backup de produção de 30/07/2026: são os
 * mesmos 29 cliques que resolviam para fora do Brasil sendo brasileiros.
 */
import {
  localeDoUserAgent,
  operadoraDoUserAgent,
  paisDoFuso,
  regiaoDoLocale,
  regioesDoAcceptLanguage,
  resolverPaisDoClique,
} from "@/lib/geo/desempate";

let ok = 0;
let falhas = 0;
function eq(nome, obtido, esperado) {
  const a = JSON.stringify(obtido);
  const b = JSON.stringify(esperado);
  if (a === b) {
    ok++;
    console.log(`  \x1b[32m✓\x1b[0m ${nome} — ${a}`);
  } else {
    falhas++;
    console.log(`  \x1b[31m✗\x1b[0m ${nome}\n      obtido:   ${a}\n      esperado: ${b}`);
  }
}

// User agents REAIS da produção.
const UA_VIVO =
  "[FBAN/FB4A;FBAV/570.0.0.24.72;FBBV/1017250573;FBDM/{density=2.8125,width=1080,height=2408};FBLC/pt_PT;FBRV/0;FBCR/VIVO;FBMF/samsung;FBBD/samsung;FBPN/com.facebook.katana]";
const UA_INSTA_BR =
  "Instagram 439.0.0.35.60 (iPhone15,4; iOS 26_5_2; pt_BR; pt; scale=3.00; 1179x2556; 1021301964) AppleWebKit/420+";
const UA_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36";
const UA_CLARO = "[FBAN/FB4A;FBAV/570.0.0.24.72;FBLC/pt_BR;FBCR/CLARO;FBMF/motorola]";

console.log("\n\x1b[1mExtração de sinais\x1b[0m");
eq("operadora VIVO", operadoraDoUserAgent(UA_VIVO), "VIVO");
eq("operadora CLARO", operadoraDoUserAgent(UA_CLARO), "CLARO");
eq("sem FBCR", operadoraDoUserAgent(UA_CHROME), null);
eq("locale do app do Facebook (FBLC)", localeDoUserAgent(UA_VIVO), "pt_PT");
eq("locale do Instagram (solto)", localeDoUserAgent(UA_INSTA_BR), "pt_BR");
eq("região de pt_BR", regiaoDoLocale("pt_BR"), "BR");
eq("região de pt-BR", regiaoDoLocale("pt-BR"), "BR");
eq("idioma sem região", regiaoDoLocale("pt"), null);
eq("Accept-Language com pesos", regioesDoAcceptLanguage("pt-BR,pt;q=0.9,en-US;q=0.8"), ["BR", "US"]);
eq("Accept-Language ordena por q", regioesDoAcceptLanguage("en-US;q=0.5,pt-BR;q=0.9"), ["BR", "US"]);
eq("Accept-Language só com idiomas", regioesDoAcceptLanguage("pt,en"), []);
eq("Accept-Language ausente", regioesDoAcceptLanguage(null), []);

console.log("\n\x1b[1mSEM contradição — o IP vence e nada mais é consultado\x1b[0m");
eq(
  "campanha mundial (lista vazia)",
  resolverPaisDoClique({ paisDoIp: "US", paisesDaCampanha: [], userAgent: UA_VIVO }),
  { pais: "US", fonte: "ip" },
);
eq(
  "IP compatível com a campanha",
  resolverPaisDoClique({ paisDoIp: "BR", paisesDaCampanha: ["BR", "MX"], userAgent: UA_VIVO }),
  { pais: "BR", fonte: "ip" },
);
eq(
  "americano REAL comprando pelo Instagram numa campanha que roda US",
  resolverPaisDoClique({ paisDoIp: "US", paisesDaCampanha: ["US", "CA"], userAgent: UA_INSTA_BR }),
  { pais: "US", fonte: "ip" },
);

console.log("\n\x1b[1m🔴 COM contradição — o caso que motivou tudo\x1b[0m");
eq(
  "campanha só BR, IP diz US → campanha decide sozinha",
  resolverPaisDoClique({ paisDoIp: "US", paisesDaCampanha: ["BR"], userAgent: UA_INSTA_BR }),
  { pais: "BR", fonte: "campanha" },
);
eq(
  "campanha BR+MX, IP diz IE, operadora VIVO → carrier decide",
  resolverPaisDoClique({ paisDoIp: "IE", paisesDaCampanha: ["BR", "MX"], userAgent: UA_VIVO }),
  { pais: "BR", fonte: "carrier" },
);
eq(
  "campanha BR+MX, IP diz US, Accept-Language pt-BR → idioma decide",
  resolverPaisDoClique({
    paisDoIp: "US",
    paisesDaCampanha: ["BR", "MX"],
    userAgent: UA_CHROME,
    acceptLanguage: "pt-BR,pt;q=0.9",
  }),
  { pais: "BR", fonte: "idioma" },
);
eq(
  "campanha BR+MX, IP diz US, só o locale do UA → locale decide (sinal fraco)",
  resolverPaisDoClique({ paisDoIp: "US", paisesDaCampanha: ["BR", "MX"], userAgent: UA_INSTA_BR }),
  { pais: "BR", fonte: "locale" },
);

console.log("\n\x1b[1m⛔ NÃO CHUTA — o contrato mais importante\x1b[0m");
eq(
  "operadora MULTIPAÍS que não desempata (Claro em BR e AR)",
  resolverPaisDoClique({ paisDoIp: "US", paisesDaCampanha: ["BR", "AR"], userAgent: UA_CLARO, acceptLanguage: null }).fonte,
  // O locale do UA é pt_BR e ainda está na campanha, então ele resolve DEPOIS
  // do carrier falhar. O que importa é que o carrier NÃO decidiu sozinho.
  "locale",
);
eq(
  "nada resolve → incerto, e o país do IP NÃO volta",
  resolverPaisDoClique({ paisDoIp: "US", paisesDaCampanha: ["BR", "MX"], userAgent: UA_CHROME }),
  { pais: null, fonte: "incerto" },
);
eq(
  "locale fora da campanha não é usado",
  resolverPaisDoClique({ paisDoIp: "US", paisesDaCampanha: ["MX", "CO"], userAgent: UA_INSTA_BR }),
  { pais: null, fonte: "incerto" },
);
eq(
  "sem IP e sem campanha → incerto",
  resolverPaisDoClique({ paisDoIp: null, paisesDaCampanha: [], userAgent: UA_CHROME }),
  { pais: null, fonte: "incerto" },
);
eq(
  "sem IP mas campanha de um país só → campanha decide",
  resolverPaisDoClique({ paisDoIp: null, paisesDaCampanha: ["BR"], userAgent: UA_CHROME }),
  { pais: "BR", fonte: "campanha" },
);

console.log("\n\x1b[1mBordas\x1b[0m");
eq(
  "países da campanha em minúsculas são normalizados",
  resolverPaisDoClique({ paisDoIp: "br", paisesDaCampanha: ["br", "mx"], userAgent: null }),
  { pais: "BR", fonte: "ip" },
);
eq(
  "Accept-Language vence o locale do UA quando ambos servem",
  resolverPaisDoClique({
    paisDoIp: "US",
    paisesDaCampanha: ["MX", "BR"],
    userAgent: UA_INSTA_BR, // locale pt_BR
    acceptLanguage: "es-MX",
  }).fonte,
  "idioma",
);
eq(
  "carrier vence Accept-Language",
  resolverPaisDoClique({
    paisDoIp: "US",
    paisesDaCampanha: ["BR", "MX"],
    userAgent: UA_VIVO,
    acceptLanguage: "es-MX",
  }).fonte,
  "carrier",
);

// ─────────────────────────────────────────────────────────────────────────────
// FUSO HORÁRIO como sinal (31/07/2026) e as operadoras LATAM que faltavam.
// ─────────────────────────────────────────────────────────────────────────────

const UA_ATT = "[FBAN/FB4A;FBAV/570.0.0.24.72;FBLC/es_MX;FBCR/AT&T;FBMF/motorola]";
const UA_WOM = "[FBAN/FB4A;FBAV/570.0.0.24.72;FBLC/es_CL;FBCR/WOM;FBMF/xiaomi]";
const UA_BITEL = "[FBAN/FB4A;FBAV/570.0.0.24.72;FBLC/es_PE;FBCR/BITEL;FBMF/samsung]";
const UA_TELEFONICA = "[FBAN/FB4A;FBAV/570.0.0.24.72;FBLC/es_AR;FBCR/TELEFONICA;FBMF/samsung]";

console.log("\n\x1b[1mFuso IANA → país\x1b[0m");
eq("America/Lima", paisDoFuso("America/Lima"), "PE");
eq("America/Bogota", paisDoFuso("America/Bogota"), "CO");
eq("America/Sao_Paulo", paisDoFuso("America/Sao_Paulo"), "BR");
eq("prefixo America/Argentina/*", paisDoFuso("America/Argentina/Cordoba"), "AR");
eq("prefixo America/Indiana/*", paisDoFuso("America/Indiana/Knox"), "US");
eq("caixa não importa", paisDoFuso("america/LIMA"), "PE");
eq("zona fora da tabela → null (cai para o sinal seguinte)", paisDoFuso("Antarctica/Troll"), null);
eq("zona ausente", paisDoFuso(null), null);
eq("string vazia", paisDoFuso("  "), null);

console.log("\n\x1b[1mOperadoras que faltavam\x1b[0m");
eq("WOM", operadoraDoUserAgent(UA_WOM), "WOM");
eq("BITEL", operadoraDoUserAgent(UA_BITEL), "BITEL");
eq("TELEFONICA (razão social da Movistar)", operadoraDoUserAgent(UA_TELEFONICA), "TELEFONICA");
// ⚠️ O `&` não é separador, então "AT&T" só casa na 2ª passada, que compacta.
eq("AT&T casa apesar do &", operadoraDoUserAgent(UA_ATT), "ATT");
eq(
  "AT&T é MX+US — resolve só quando a campanha desfaz a ambiguidade",
  resolverPaisDoClique({ paisDoIp: "IE", paisesDaCampanha: ["MX", "BR"], userAgent: UA_ATT }),
  { pais: "MX", fonte: "carrier" },
);
eq(
  "AT&T em campanha MX+US NÃO resolve pelo carrier",
  resolverPaisDoClique({ paisDoIp: "IE", paisesDaCampanha: ["MX", "US"], userAgent: UA_ATT }).fonte,
  "locale", // cai para o FBLC/es_MX
);

console.log("\n\x1b[1mO fuso desempatando LATAM\x1b[0m");
eq(
  "campanha AR+PE+CO, IP dos EUA, relógio em Lima → PE",
  resolverPaisDoClique({
    paisDoIp: "US",
    paisesDaCampanha: ["AR", "PE", "CO"],
    userAgent: UA_CHROME,
    timezone: "America/Lima",
  }),
  { pais: "PE", fonte: "fuso" },
);
eq(
  "brasileiro em Portugal: fuso VENCE o idioma (pt_BR)",
  resolverPaisDoClique({
    paisDoIp: "US",
    paisesDaCampanha: ["BR", "PT"],
    userAgent: UA_INSTA_BR, // locale pt_BR
    acceptLanguage: "pt-BR,pt;q=0.9",
    timezone: "Europe/Lisbon",
  }),
  { pais: "PT", fonte: "fuso" },
);
eq(
  "operadora VENCE o fuso (rede é mais difícil de divergir que relógio)",
  resolverPaisDoClique({
    paisDoIp: "US",
    paisesDaCampanha: ["BR", "MX"],
    userAgent: UA_VIVO,
    timezone: "America/Mexico_City",
  }).fonte,
  "carrier",
);
eq(
  "país único continua vencendo tudo, inclusive o fuso",
  resolverPaisDoClique({
    paisDoIp: "US",
    paisesDaCampanha: ["PE"],
    timezone: "America/Bogota",
  }),
  { pais: "PE", fonte: "campanha" },
);
eq(
  "fuso FORA da campanha não resolve — cai para o idioma",
  resolverPaisDoClique({
    paisDoIp: "US",
    paisesDaCampanha: ["AR", "CO"],
    timezone: "America/Lima", // PE não está na campanha
    acceptLanguage: "es-CO",
  }),
  { pais: "CO", fonte: "idioma" },
);
eq(
  "zona desconhecida não atrapalha — segue para o idioma",
  resolverPaisDoClique({
    paisDoIp: "US",
    paisesDaCampanha: ["AR", "CO"],
    timezone: "Antarctica/Troll",
    acceptLanguage: "es-AR",
  }),
  { pais: "AR", fonte: "idioma" },
);
eq(
  "sem fuso, sem idioma e sem locale → incerto (o IP errado NÃO volta)",
  resolverPaisDoClique({
    paisDoIp: "US",
    paisesDaCampanha: ["AR", "CO"],
    userAgent: UA_CHROME,
    timezone: null,
  }),
  { pais: null, fonte: "incerto" },
);

console.log("\n\x1b[1mes-419: grupo de região, não país\x1b[0m");
eq("regiaoDoLocale('es-419')", regiaoDoLocale("es-419"), null);
eq("Accept-Language 'es-419' não produz região", regioesDoAcceptLanguage("es-419,es;q=0.9"), []);
eq(
  "es-419 não desempata, mas o fuso junto resolve",
  resolverPaisDoClique({
    paisDoIp: "US",
    paisesDaCampanha: ["PE", "CO"],
    acceptLanguage: "es-419,es;q=0.9",
    timezone: "America/Bogota",
  }),
  { pais: "CO", fonte: "fuso" },
);

console.log(
  falhas === 0
    ? `\n\x1b[1m\x1b[32m${ok} asserções passaram, 0 falharam.\x1b[0m\n`
    : `\n\x1b[1m\x1b[31m${ok} passaram, ${falhas} FALHARAM.\x1b[0m\n`,
);
process.exit(falhas === 0 ? 0 : 1);
