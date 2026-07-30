/**
 * Asserções de `lib/bots/classificar.ts`.
 *
 * ⚠️ Os user agents daqui são **reais**, copiados do backup de produção de
 * 30/07/2026. É o que faz o teste valer: um caso inventado prova que o regex
 * funciona; um caso real prova que ele funciona no tráfego DESTE produto.
 *
 * A metade que mais importa é a dos **humanos** — o custo de um falso positivo
 * (pessoa marcada como robô) é uma venda que some das métricas.
 */
import { classificarUserAgent, PADROES } from "@/lib/bots/classificar";

let ok = 0;
let falhas = 0;
function eq(nome, obtido, esperado) {
  if (obtido === esperado) {
    ok++;
    console.log(`  \x1b[32m✓\x1b[0m ${nome} — ${JSON.stringify(obtido)}`);
  } else {
    falhas++;
    console.log(`  \x1b[31m✗\x1b[0m ${nome}\n      obtido:   ${JSON.stringify(obtido)}\n      esperado: ${JSON.stringify(esperado)}`);
  }
}
const ehBot = (ua) => classificarUserAgent(ua).bot;
const motivo = (ua) => classificarUserAgent(ua).motivo;

console.log(`\n\x1b[1m${PADROES.length} padrões na lista\x1b[0m`);

console.log("\n\x1b[1mROBÔS — user agents REAIS da produção\x1b[0m");
eq(
  "crawler de anúncios da Meta (17 ocorrências reais)",
  motivo("meta-externalads/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)"),
  "Crawler da Meta (anúncios)",
);
eq(
  "MESMO crawler disfarçado dentro de um UA de Chrome",
  motivo(
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 (compatible; meta-externalads/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler))",
  ),
  "Crawler da Meta (anúncios)",
);
eq(
  "e dentro de um UA de iPhone",
  ehBot(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1 (compatible; meta-externalads/1.1)",
  ),
  true,
);
eq(
  "HeadlessChrome (18 ocorrências reais)",
  motivo("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.0 Safari/537.36"),
  "Navegador automatizado",
);
eq(
  "Chrome-Lighthouse (2 ocorrências reais)",
  motivo("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Chrome-Lighthouse"),
  "Auditoria de site",
);
eq("curl (2 ocorrências reais)", motivo("curl/8.21.0"), "Ferramenta de linha de comando");

console.log("\n\x1b[1mROBÔS — outros conhecidos\x1b[0m");
eq("facebookexternalhit", ehBot("facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"), true);
eq("Googlebot", ehBot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"), true);
eq("bingbot", ehBot("Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)"), true);
eq("AhrefsBot", ehBot("Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)"), true);
eq("python-requests", ehBot("python-requests/2.31.0"), true);
eq("Go http client", ehBot("Go-http-client/2.0"), true);
eq("Postman", ehBot("PostmanRuntime/7.36.0"), true);
eq("wget", ehBot("Wget/1.21.3"), true);
eq("WhatsApp (pré-visualização de link)", ehBot("WhatsApp/2.23.20.0"), true);

console.log("\n\x1b[1m🔴 HUMANOS — user agents REAIS que NÃO podem virar bot\x1b[0m");
// ⚠️ Estes vinham de IP dos EUA e da Irlanda e foram suspeitos de ser crawler.
// São pessoas reais: `pt_BR` e a operadora VIVO no user agent.
eq(
  "Instagram no iPhone, pt_BR (IP resolvia US)",
  ehBot("Instagram 439.0.0.35.60 (iPhone15,4; iOS 26_5_2; pt_BR; pt; scale=3.00; 1179x2556; 1021301964) AppleWebKit/420+"),
  false,
);
eq(
  "Instagram no Android, pt_BR",
  ehBot("Instagram 438.0.0.28.88 Android (34/14; 450dpi; 1080x2408; samsung; SM-M236B; m23xq; qcom; pt_BR; 1017398461)"),
  false,
);
eq(
  "app do Facebook com operadora VIVO (IP resolvia IE)",
  ehBot(
    "[FBAN/FB4A;FBAV/570.0.0.24.72;FBBV/1017250573;FBDM/{density=2.8125,width=1080,height=2408};FBLC/pt_PT;FBRV/0;FBCR/VIVO;FBMF/samsung;FBBD/samsung;FBPN/com.facebook.katana]",
  ),
  false,
);
eq(
  "Facebook no iOS (FBAN/FBIOS)",
  ehBot(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 26_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/23D8133 Safari/604.1 [FBAN/FBIOS;FBAV/565.0.0.61.70;FBBV/1;FBDV/iPhone14,5]",
  ),
  false,
);
eq(
  "WebView de Android (`; wv)`) — o padrão do app do Instagram",
  ehBot(
    "Mozilla/5.0 (Linux; Android 16; SM-A566E Build/BP4A.251205.006; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.175 Mobile Safari/537.36",
  ),
  false,
);
eq("Chrome de desktop", ehBot("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36"), false);
eq("Safari de iPhone", ehBot("Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1"), false);
eq("Edge", ehBot("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 Edg/150.0.0.0"), false);

console.log("\n\x1b[1mArmadilhas de regex\x1b[0m");
// A razão de `\bbot\b` ter limites de palavra e de `curl/` exigir a barra.
eq("nome de aparelho contendo 'bot' (Abbott)", ehBot("Mozilla/5.0 (Linux; Android 14; Abbott X1) AppleWebKit/537.36 Chrome/150.0.0.0 Mobile Safari/537.36"), false);
eq("'curly' não é curl", ehBot("Mozilla/5.0 (Linux; Android 13; Curly Phone) Chrome/150.0.0.0 Mobile Safari/537.36"), false);
// "robotics" contém "bot" e "robot" como substring, mas nenhum como PALAVRA —
// os limites `\b` impedem. É nome de produto, não declaração de robô.
eq("'robotics' num user agent de app NÃO é bot", ehBot("[FBAN/FB4A;FBAV/570.0.0.24.72;FBBD/robotics]"), false);
// ⚠️ Esta asserção achou uma lacuna real: `\bbot\b` NÃO casa dentro de "Robot",
// porque o `o` anterior é caractere de palavra. Precisou de `\brobot\b` próprio.
eq("'Robot' como palavra inteira É bot", ehBot("SomeCompany Robot/1.0"), true);
eq("motivo do 'Robot'", motivo("SomeCompany Robot/1.0"), "Robô declarado");

console.log("\n\x1b[1mBordas\x1b[0m");
eq("user agent ausente NÃO é bot", ehBot(null), false);
eq("string vazia NÃO é bot", ehBot(""), false);
eq("só espaços NÃO é bot", ehBot("   "), false);
eq("undefined NÃO é bot", ehBot(undefined), false);
eq("motivo é null quando não é bot", motivo("Mozilla/5.0 (Windows NT 10.0) Chrome/150 Safari/537.36"), null);
{
  // Nenhum motivo pode ser string vazia — ele vai para a coluna e para a tela.
  const vazios = PADROES.filter((p) => !p.motivo || !p.motivo.trim()).length;
  eq("todo padrão tem motivo preenchido", vazios, 0);
}
{
  // A ORDEM importa: o crawler da Meta precisa vencer os genéricos.
  const iMeta = PADROES.findIndex((p) => p.re.test("meta-externalads/1.1"));
  const iGenerico = PADROES.findIndex((p) => p.re.source.includes("\\bbot\\b"));
  eq("crawler da Meta é testado ANTES do padrão genérico", iMeta < iGenerico, true);
}

console.log(
  falhas === 0
    ? `\n\x1b[1m\x1b[32m${ok} asserções passaram, 0 falharam.\x1b[0m\n`
    : `\n\x1b[1m\x1b[31m${ok} passaram, ${falhas} FALHARAM.\x1b[0m\n`,
);
process.exit(falhas === 0 ? 0 : 1);
