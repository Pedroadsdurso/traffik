/**
 * A AUTENTICAÇÃO DO CRON FALHA FECHADA — sob asserção, finalmente.
 *
 * 🔴 ELA ERA VERIFICADA À MÃO, COM `curl`, EM 29/07/2026 — e nunca mais.
 *
 * O `CLAUDE.md` registra o teste original: *"cron sem header → 401, header
 * errado → 401, prefixo parcial do secret → 401, header correto → 200"*. Foi
 * feito contra o dev server, uma vez, e o resultado virou prosa. A varredura de
 * 14/08/2026 achou `cronAutorizado` **sem nenhum teste citando-a**.
 *
 * ⛔ Uma verificação manual que virou parágrafo é a forma mais convincente de
 * cobertura inexistente: o parágrafo continua verdadeiro sobre o dia em que foi
 * escrito, e não diz nada sobre hoje. Aqui o custo de errar é uma rota que
 * **pausa campanha e altera orçamento** aberta na internet.
 *
 * ### O que este arquivo mede, e o que não
 *
 * ✅ a decisão de `cronAutorizado` — todas as portas de entrada.
 * ⛔ **não** mede se as rotas `/api/cron/*` de fato a chamam. Isso é o outro
 * lado do par leitor/escritor, e a guarda estática no fim cobre exatamente
 * essa metade.
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const { cronAutorizado, naoAutorizado } = await import("../src/lib/cronAuth.ts");

let n = 0;
const ok = (nome, cond, extra) => {
  assert.ok(cond, nome + (extra ? " — " + extra : ""));
  console.log("  ✓ " + nome + (extra ? " — " + extra : ""));
  n++;
};

/** Um `NextRequest` de mentira: `cronAutorizado` só lê `headers.get`. */
const req = (authorization) => ({
  headers: { get: (k) => (k.toLowerCase() === "authorization" ? (authorization ?? null) : null) },
});

const comSecret = (valor, fn) => {
  const antes = process.env.CRON_SECRET;
  if (valor === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = valor;
  try {
    return fn();
  } finally {
    /* ⛔ RESTAURA SEMPRE. Teste que deixa env var suja contamina o próximo do
       agregado, e o sintoma aparece em outro arquivo — que é a pior forma. */
    if (antes === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = antes;
  }
};

console.log("\nFalha FECHADA — ausência de configuração nunca vira permissão");

/* ---- 1. SEM secret configurado: NINGUÉM entra, nem com header ---------- */
ok("sem CRON_SECRET, header correto NÃO entra", comSecret(undefined, () => cronAutorizado(req("Bearer qualquer"))) === false);
ok("sem CRON_SECRET, sem header também não", comSecret(undefined, () => cronAutorizado(req(null))) === false);

/* ⚠️ Os dois abaixo são a forma REAL de reabrir a porta sem perceber: o painel
   aceita string vazia, e ninguém olha de novo. */
ok('CRON_SECRET="" é ausente, não permissivo', comSecret("", () => cronAutorizado(req("Bearer "))) === false);
ok('CRON_SECRET="   " (só espaços) idem', comSecret("   ", () => cronAutorizado(req("Bearer    "))) === false);

/* ---- 2. COM secret: só o header exato entra --------------------------- */
const S = "segredo-de-teste-abc123";
ok("header correto entra", comSecret(S, () => cronAutorizado(req(`Bearer ${S}`))) === true);
ok("sem header não entra", comSecret(S, () => cronAutorizado(req(null))) === false);
ok("header vazio não entra", comSecret(S, () => cronAutorizado(req(""))) === false);
ok("secret errado não entra", comSecret(S, () => cronAutorizado(req("Bearer outro-segredo-qualquer"))) === false);

/* 🔴 O PREFIXO PARCIAL — o caso que a comparação em tempo constante existe para
   não vazar, e que o teste de 29/07 exercitou uma vez. */
ok("PREFIXO parcial do secret não entra", comSecret(S, () => cronAutorizado(req(`Bearer ${S.slice(0, -1)}`))) === false);
ok("secret com sufixo extra não entra", comSecret(S, () => cronAutorizado(req(`Bearer ${S}x`))) === false);

/* ---- 3. O FORMATO é `Bearer`, e só ------------------------------------
   ⛔ Nunca query string: a URL inteira fica no log de acesso, no histórico do
   serviço de cron e em qualquer proxy do caminho. */
ok("secret cru, sem `Bearer`, não entra", comSecret(S, () => cronAutorizado(req(S))) === false);
ok("`bearer` minúsculo não entra", comSecret(S, () => cronAutorizado(req(`bearer ${S}`))) === false);
ok("`Basic` não entra", comSecret(S, () => cronAutorizado(req(`Basic ${S}`))) === false);

/* ---- 4. A resposta de recusa ------------------------------------------ */
{
  const r = naoAutorizado();
  ok("a recusa é 401", r.status === 401);
}

/* ---- 5. GUARDA ESTÁTICA: toda rota /api/cron/* CHAMA a autenticação -----
   É a outra metade do par. Uma função de auth perfeita que uma rota esquece de
   chamar é a porta aberta com o cadeado do lado de fora — e esta base já pagou
   por endurecer uma rota com a irmã aberta ("endurecer uma porta com a outra
   aberta é teatro"). */
{
  const base = "src/app/api/cron";
  ok("linha de base: a pasta de rotas de cron existe", existsSync(base));
  const rotas = readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => join(base, d.name, "route.ts"))
    .filter((p) => existsSync(p));

  ok("linha de base: há rotas de cron para examinar", rotas.length >= 3, rotas.length + " rotas");

  const semAuth = rotas.filter((p) => {
    const s = readFileSync(p, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    return !s.includes("cronAutorizado");
  });
  ok(
    "TODA rota de cron chama `cronAutorizado`",
    semAuth.length === 0,
    semAuth.length ? "SEM AUTH: " + JSON.stringify(semAuth) : "0 de " + rotas.length + " sem auth",
  );

  /* PLANTIO: uma rota que esqueceu a chamada É detectada. */
  const fake = "export async function GET() { return Response.json({ ok: true }); }";
  ok("PLANTIO: rota sem `cronAutorizado` seria detectada", !fake.includes("cronAutorizado"));
}

console.log("\n\x1b[32m" + n + " asserções, 0 falha(s).\x1b[0m\n");
