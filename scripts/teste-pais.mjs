/**
 * Asserções de `lib/geo/pais.ts` — IP → país pela base local.
 *
 * Sem rede: consulta o artefato commitado. Os IPs abaixo são de blocos públicos
 * conhecidos e estáveis (DNS públicos, alocações de RIR), escolhidos por não
 * mudarem de país.
 */
import { ipv4ParaInt, paisDoHeader, paisDoIp, resolverPais } from "@/lib/geo/pais";
import { PAISES, TOTAL_FAIXAS } from "@/lib/geo/ipCountryData";

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

console.log(`\n\x1b[1mBase: ${TOTAL_FAIXAS.toLocaleString("pt-BR")} faixas · ${PAISES.length - 1} países\x1b[0m`);

console.log("\n\x1b[1mConversão de IPv4\x1b[0m");
eq("0.0.0.0", ipv4ParaInt("0.0.0.0"), 0);
eq("255.255.255.255", ipv4ParaInt("255.255.255.255"), 4294967295);
eq("1.2.3.4", ipv4ParaInt("1.2.3.4"), 16909060);
eq("octeto > 255 é inválido", ipv4ParaInt("1.2.3.256"), null);
eq("poucos octetos", ipv4ParaInt("1.2.3"), null);
eq("texto", ipv4ParaInt("a.b.c.d"), null);
eq("IPv6 não é IPv4", ipv4ParaInt("2001:db8::1"), null);

console.log("\n\x1b[1mIPs públicos conhecidos\x1b[0m");
eq("8.8.8.8 (Google DNS)", paisDoIp("8.8.8.8"), "US");
eq("1.1.1.1 (Cloudflare, bloco APNIC/AU)", paisDoIp("1.1.1.1"), "AU");
eq("208.67.222.222 (OpenDNS)", paisDoIp("208.67.222.222"), "US");
// Bloco do NIC.br — a alocação brasileira mais estável que existe.
eq("200.160.2.3 (registro.br)", paisDoIp("200.160.2.3"), "BR");
eq("200.219.130.1 (LACNIC/BR)", paisDoIp("200.219.130.1"), "BR");

console.log("\n\x1b[1mNão identificado — nunca chuta um país\x1b[0m");
eq("127.0.0.1 (loopback)", paisDoIp("127.0.0.1"), null);
eq("10.0.0.1 (rede privada)", paisDoIp("10.0.0.1"), null);
eq("192.168.1.1 (rede privada)", paisDoIp("192.168.1.1"), null);
eq("0.0.0.0", paisDoIp("0.0.0.0"), null);
eq("null", paisDoIp(null), null);
eq("string vazia", paisDoIp(""), null);
eq("lixo", paisDoIp("não-é-ip"), null);
eq("IPv6 devolve null (base é IPv4)", paisDoIp("2001:4860:4860::8888"), null);

console.log("\n\x1b[1mHeader da plataforma\x1b[0m");
const h = (mapa) => (n) => mapa[n] ?? null;
eq("x-vercel-ip-country", paisDoHeader(h({ "x-vercel-ip-country": "BR" })), "BR");
eq("cf-ipcountry", paisDoHeader(h({ "cf-ipcountry": "pt" })), "PT");
eq('"XX" da Cloudflare é desconhecido', paisDoHeader(h({ "cf-ipcountry": "XX" })), null);
eq('"T1" (Tor) é descartado', paisDoHeader(h({ "cf-ipcountry": "T1" })), null);
eq("sem header nenhum", paisDoHeader(h({})), null);

console.log("\n\x1b[1mresolverPais — header é ATALHO, não dependência\x1b[0m");
eq("com header, usa o header", resolverPais(h({ "x-vercel-ip-country": "PT" }), "8.8.8.8"), "PT");
// 🔴 O caso da migração para VPS: sem header nenhum, o resultado tem de ser o
// MESMO que a base local daria. É isto que garante que a migração não quebra.
eq("SEM header, cai na base local", resolverPais(h({}), "8.8.8.8"), "US");
eq("sem header e sem IP", resolverPais(h({}), null), null);
eq("header inválido cai na base", resolverPais(h({ "cf-ipcountry": "XX" }), "200.160.2.3"), "BR");

console.log("\n\x1b[1mBordas da cobertura\x1b[0m");
{
  // A busca binária tem de responder em qualquer ponto do espaço, sem estourar.
  let erros = 0;
  for (const ip of ["1.0.0.0", "223.255.255.255", "224.0.0.1", "255.255.255.254"]) {
    const r = paisDoIp(ip);
    if (r !== null && !/^[A-Z]{2}$/.test(r)) erros++;
  }
  eq("extremos devolvem país válido ou null, nunca lixo", erros, 0);
}

console.log(
  falhas === 0
    ? `\n\x1b[1m\x1b[32m${ok} asserções passaram, 0 falharam.\x1b[0m\n`
    : `\n\x1b[1m\x1b[31m${ok} passaram, ${falhas} FALHARAM.\x1b[0m\n`,
);
process.exit(falhas === 0 ? 0 : 1);
