/**
 * Asserções de `lib/geo/clientIp.ts` — extração do IP do visitante.
 *
 * ⚠️ Este é o teste que precisa passar ANTES da migração para VPS. Se a extração
 * estiver errada atrás de proxy reverso, todo visitante vira "não identificado" —
 * e o sintoma só aparece depois que o tráfego real já passou.
 *
 * Simula: Vercel, nginx com 1 proxy, Cloudflare + nginx, conexão direta, e as
 * tentativas de forjar o header.
 */
process.env.PROXIES_CONFIAVEIS = "1";

import { ehIpPrivado, ehIpValido, extrairIpDoCliente, normalizarIp } from "@/lib/geo/clientIp";

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

/** Monta uma requisição falsa com os headers dados. */
const req = (headers, ipDaConexao) => ({
  header: (n) => headers[n.toLowerCase()] ?? null,
  ipDaConexao,
});

const CLIENTE = "203.0.113.45";

// ── 1. Os cenários de produção ─────────────────────────────────────────────
console.log("\n\x1b[1mCenários reais de infraestrutura\x1b[0m");

eq(
  "VERCEL — x-forwarded-for com a borda no fim",
  extrairIpDoCliente(req({ "x-forwarded-for": `${CLIENTE}, 76.76.21.１`.replace("１", "1") })),
  CLIENTE,
);

eq(
  "VPS + nginx — proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for",
  extrairIpDoCliente(req({ "x-forwarded-for": `${CLIENTE}, 127.0.0.1` }, "127.0.0.1")),
  CLIENTE,
);

eq(
  "VPS + nginx — só X-Real-IP (config mínima, sem XFF)",
  extrairIpDoCliente(req({ "x-real-ip": CLIENTE }, "127.0.0.1")),
  CLIENTE,
);

eq(
  "CLOUDFLARE na frente — cf-connecting-ip vence a cadeia",
  extrairIpDoCliente(
    req({ "cf-connecting-ip": CLIENTE, "x-forwarded-for": "1.2.3.4, 172.16.0.9, 10.0.0.5" }, "10.0.0.5"),
  ),
  CLIENTE,
);

eq(
  "CONEXÃO DIRETA — sem proxy nenhum, sem headers",
  extrairIpDoCliente(req({}, CLIENTE)),
  CLIENTE,
);

// ── 2. 🔴 Anti-spoofing: o header é do CLIENTE ─────────────────────────────
console.log("\n\x1b[1mTentativas de forjar o IP\x1b[0m");

eq(
  "cliente injeta um IP falso ANTES do real -> pega o real, não o falso",
  extrairIpDoCliente(req({ "x-forwarded-for": `8.8.8.8, ${CLIENTE}, 127.0.0.1` }, "127.0.0.1")),
  CLIENTE,
);

eq(
  "cliente injeta VÁRIOS falsos -> ainda pega o real",
  extrairIpDoCliente(req({ "x-forwarded-for": `1.1.1.1, 2.2.2.2, 3.3.3.3, ${CLIENTE}, 127.0.0.1` }, "127.0.0.1")),
  CLIENTE,
);

// Com 0 proxies confiáveis (aplicação exposta direto), o último da cadeia É o
// que o cliente mandou por último — e continua sendo dele. Aqui não há proteção
// possível pelo header; por isso o padrão é 1 e a conexão é o fallback.
eq(
  "IP privado forjado na cadeia é descartado",
  extrairIpDoCliente(req({ "x-forwarded-for": `10.0.0.1, 192.168.1.1, ${CLIENTE}, 127.0.0.1` }, "127.0.0.1")),
  CLIENTE,
);

// ── 3. Endereço privado nunca é o visitante ────────────────────────────────
console.log("\n\x1b[1mEndereços que NÃO são visitante\x1b[0m");

eq(
  "só o proxy na cadeia -> null (melhor não saber que gravar o datacenter)",
  extrairIpDoCliente(req({ "x-forwarded-for": "127.0.0.1" }, "127.0.0.1")),
  null,
);
eq("nenhum header e nenhuma conexão -> null", extrairIpDoCliente(req({})), null);
eq("CGNAT (100.64/10) é privado", ehIpPrivado("100.100.5.4"), true);
eq("172.16–31 é privado", ehIpPrivado("172.20.1.1"), true);
eq("172.32 NÃO é privado (fora da faixa)", ehIpPrivado("172.32.1.1"), false);
eq("169.254 link-local é privado", ehIpPrivado("169.254.1.1"), true);
eq("::1 é privado", ehIpPrivado("::1"), true);
eq("fd00:: (unique local) é privado", ehIpPrivado("fd00::1"), true);
eq("2001:db8:: é público", ehIpPrivado("2001:db8::1"), false);

// ── 4. Formatos malformados ────────────────────────────────────────────────
console.log("\n\x1b[1mNormalização de formato\x1b[0m");
eq("IPv4 com porta", normalizarIp("203.0.113.45:51234"), CLIENTE);
eq("IPv6 entre colchetes com porta", normalizarIp("[2001:db8::1]:443"), "2001:db8::1");
eq("IPv6 sem colchetes fica intacto", normalizarIp("2001:db8::1"), "2001:db8::1");
eq("espaços e aspas", normalizarIp('  "203.0.113.45"  '), CLIENTE);
eq('"unknown" vira null', normalizarIp("unknown"), null);
eq("string vazia vira null", normalizarIp("   "), null);
eq("lixo vira null", normalizarIp("não-é-ip"), null);
eq("octeto > 255 é inválido", ehIpValido("999.1.1.1"), false);
eq(
  "cadeia com entradas vazias e 'unknown' não quebra",
  extrairIpDoCliente(req({ "x-forwarded-for": `unknown, , ${CLIENTE}, 127.0.0.1` }, "127.0.0.1")),
  CLIENTE,
);

// ── 5. PROXIES_CONFIAVEIS muda a contagem ──────────────────────────────────
console.log("\n\x1b[1mPROXIES_CONFIAVEIS\x1b[0m");
{
  // Dois proxies à frente (ex.: Cloudflare -> nginx), sem cf-connecting-ip.
  process.env.PROXIES_CONFIAVEIS = "2";
  eq(
    "com 2 proxies, pula os DOIS últimos",
    extrairIpDoCliente(req({ "x-forwarded-for": `${CLIENTE}, 172.16.0.9, 127.0.0.1` }, "127.0.0.1")),
    CLIENTE,
  );
  process.env.PROXIES_CONFIAVEIS = "1";
}

console.log(
  falhas === 0
    ? `\n\x1b[1m\x1b[32m${ok} asserções passaram, 0 falharam.\x1b[0m\n`
    : `\n\x1b[1m\x1b[31m${ok} passaram, ${falhas} FALHARAM.\x1b[0m\n`,
);
process.exit(falhas === 0 ? 0 : 1);
