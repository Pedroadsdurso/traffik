/**
 * Asserções de `lib/geo/pais.ts` — IP → país pela base local.
 *
 * Sem rede: consulta o artefato commitado. Os IPs abaixo são de blocos públicos
 * conhecidos e estáveis (DNS públicos, alocações de RIR), escolhidos por não
 * mudarem de país.
 */
import { ipv4ParaInt, ipv6ParaPrefixo, paisDoHeader, paisDoIp, resolverPais } from "@/lib/geo/pais";
import { PAISES, TOTAL_FAIXAS, TOTAL_FAIXAS6 } from "@/lib/geo/ipCountryData";
import { PAIS, bandeiraDe, temPosicao } from "@/lib/countries";

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

console.log(
  `\n\x1b[1mBase: ${TOTAL_FAIXAS.toLocaleString("pt-BR")} faixas IPv4 · ` +
    `${TOTAL_FAIXAS6.toLocaleString("pt-BR")} IPv6 · ${PAISES.length - 1} países\x1b[0m`,
);

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
// ⚠️ Esta asserção já exigiu `null` aqui, quando a base era só IPv4. Desde que o
// IPv6 entrou (30/07/2026) o comportamento certo é resolver — ver o bloco "IPv6".
eq("IPv6 agora resolve, não devolve null", paisDoIp("2001:4860:4860::8888"), "US");

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
  let resolvidos = 0;
  for (const ip of ["1.0.0.0", "223.255.255.255", "224.0.0.1", "255.255.255.254"]) {
    const r = paisDoIp(ip);
    if (r !== null) resolvidos++;
    if (r !== null && !/^[A-Z]{2}$/.test(r)) erros++;
  }
  /**
   * ⛔ `erros === 0` é verdade também quando a base devolve `null` para TUDO —
   * e "base inerte" é um estado que este projeto já viveu (ela ficou pronta,
   * testada e commitada uma sessão inteira sem ser consultada por ninguém).
   * Sem esta linha, a asserção abaixo passaria justamente nesse caso.
   */
  eq("ao menos um extremo é resolvido (a base não está inerte)", resolvidos > 0, true);
  eq("extremos devolvem país válido ou null, nunca lixo", erros, 0);
}

console.log("\n\x1b[1mIPv6 — conversão do prefixo de 64 bits\x1b[0m");
const p6 = (ip) => JSON.stringify(ipv6ParaPrefixo(ip));
eq("forma cheia", p6("2001:0db8:0000:0000:1:2:3:4"), JSON.stringify({ alto: 0x20010db8, baixo: 0 }));
eq("comprimida com ::", p6("2001:db8::1"), JSON.stringify({ alto: 0x20010db8, baixo: 0 }));
eq("só o prefixo importa — sufixo ignorado", p6("2804:29b8:504c:13a8:ffff:ffff:ffff:ffff"), p6("2804:29b8:504c:13a8::"));
eq("zona de escopo descartada", p6("fe80::1%eth0"), JSON.stringify({ alto: 0xfe800000, baixo: 0 }));
eq("maiúsculas", p6("2001:DB8::1"), JSON.stringify({ alto: 0x20010db8, baixo: 0 }));
eq("as duas metades não se misturam", p6("0000:0000:ffff:ffff::"), JSON.stringify({ alto: 0, baixo: 0xffffffff }));
eq("grupo hexadecimal inválido", ipv6ParaPrefixo("2001:zzzz::1"), null);
eq("dois :: é inválido", ipv6ParaPrefixo("2001::db8::1"), null);
eq("grupos de menos sem ::", ipv6ParaPrefixo("2001:db8:1:2:3:4"), null);

console.log("\n\x1b[1mIPv6 — país\x1b[0m");
// 2804::/16 é a alocação IPv6 do LACNIC para o Brasil. O bloco 2804:29b8::/32
// é o das vendas reais que ficaram sem país até esta base cobrir IPv6.
eq("2804:29b8:504c:13a8::1 (venda real, LACNIC/BR)", paisDoIp("2804:29b8:504c:13a8::1"), "BR");
eq("2804:14d::1 (LACNIC/BR)", paisDoIp("2804:14d::1"), "BR");
eq("2001:4860:4860::8888 (Google DNS)", paisDoIp("2001:4860:4860::8888"), "US");
eq("2606:4700:4700::1111 (Cloudflare)", paisDoIp("2606:4700:4700::1111"), "US");
eq("IPv4-mapeado cai na base IPv4", paisDoIp("::ffff:200.160.2.3"), "BR");
eq("IPv4-mapeado dos EUA", paisDoIp("::ffff:8.8.8.8"), "US");
eq("loopback IPv6 não tem país", paisDoIp("::1"), null);
eq("IPv6 lixo devolve null", paisDoIp("nao:eh:ip"), null);
{
  // O prefixo de 64 bits é o que decide: dois IPs no mesmo bloco dão o mesmo país.
  const a = paisDoIp("2804:29b8:504c:13a8:1111:2222:3333:4444");
  const b = paisDoIp("2804:29b8:504c:13a8:9999:8888:7777:6666");
  eq("mesmo prefixo → mesmo país", a === b && a === "BR", true);
}
{
  let erros = 0;
  for (const ip of ["::", "::1", "2001:db8::", "ffff:ffff:ffff:ffff::", "2804::", "fe80::1", "2000::"]) {
    const r = paisDoIp(ip);
    if (r !== null && !/^[A-Z]{2}$/.test(r)) erros++;
  }
  eq("IPv6 devolve país válido ou null, nunca lixo", erros, 0);
}

console.log("\n\x1b[1mCobertura do mapa × base de IP\x1b[0m");
{
  // ⛔ Todo país que a base sabe RESOLVER precisa ter coordenada, senão a venda
  // é geolocalizada e mesmo assim não aparece no globo — o pior dos dois mundos.
  const semPosicao = PAISES.filter((p) => p !== "\0" && !temPosicao(p));
  if (semPosicao.length) console.log(`      faltando: ${semPosicao.join(", ")}`);
  eq("todo país resolvível tem posição no mapa", semPosicao.length, 0);

  // O inverso é aceitável (país no mapa que a base nunca devolve), mas vale ver.
  const naBase = new Set(PAISES);
  const soNoMapa = Object.keys(PAIS).filter((c) => !naBase.has(c));
  console.log(`      ${Object.keys(PAIS).length} países no mapa · ${PAISES.length - 1} na base de IP` +
    (soNoMapa.length ? ` · ${soNoMapa.length} só no mapa (${soNoMapa.join(", ")})` : ""));

  eq("bandeira do Brasil", bandeiraDe("BR"), "🇧🇷");
  eq("bandeira do Japão", bandeiraDe("JP"), "🇯🇵");
  eq("código inválido cai no globo genérico", bandeiraDe("ZZZ"), "🌐");
  eq("toda bandeira tem 2 indicadores regionais", Object.keys(PAIS).filter((c) => [...PAIS[c].bandeira].length !== 2).length, 0);
  eq("nenhuma coordenada fora do intervalo válido",
    Object.values(PAIS).filter((p) => Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180).length, 0);
}

console.log(
  falhas === 0
    ? `\n\x1b[1m\x1b[32m${ok} asserções passaram, 0 falharam.\x1b[0m\n`
    : `\n\x1b[1m\x1b[31m${ok} passaram, ${falhas} FALHARAM.\x1b[0m\n`,
);
process.exit(falhas === 0 ? 0 : 1);
