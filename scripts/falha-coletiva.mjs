/**
 * "E problema do usuario ou e nosso?"
 *
 * ## Por que existe
 *
 * Uma restricao no NOSSO app da Meta derruba todos os usuarios ao mesmo tempo —
 * e a tela diz a mesma coisa que diria para um problema individual: "peca acesso
 * ao dono da conta", "confira o seu Business Manager". Cada um abre chamado
 * achando que e problema dele.
 *
 * Aconteceu em escala 1 em 04/08/2026: a conta de DESENVOLVEDOR de um testador
 * foi restringida, o token inteiro parou e a Graph respondeu `(#200) permission`
 * por conta. Com o app aberto ao publico, a mesma coisa acontece com todos de
 * uma vez.
 *
 * ⚠️ **SO LEITURA.** Pode rodar em producao.
 *
 * ## O sinal
 *
 * Falha individual e ruido de fundo: tokens expiram, contas sao desabilitadas,
 * gente troca de senha. O que denuncia causa COMUM e a **concentracao no
 * tempo**: varios usuarios que estavam sincronizando bem comecarem a falhar com
 * a mesma causa dentro da mesma janela.
 *
 * > ### ⚠️ A comparacao e da CAUSA TRADUZIDA, nao do texto cru
 * > A Meta prefixa o nome da conta e anexa a URL da documentacao, entao duas
 * > mensagens da mesma causa nunca sao strings iguais. Agrupar por texto cru
 * > nao acharia grupo nenhum.
 *
 * > ### ⛔ O veredito NAO e binario
 * > "1 de 1 usuario falhando" nao e evidencia de nada — e o caso normal de quem
 * > tem um usuario so. O script diz quantos falham, quantos existem, e deixa a
 * > conclusao explicita em vez de fingir certeza.
 *
 * ## Uso
 *
 *   npm run falha:coletiva -- --url "<conn>"
 *   npm run falha:coletiva -- --url "<conn>" --horas 6
 */
import "dotenv/config";
import pg from "pg";

import { explicarErroDeConta } from "@/lib/facebook/erroMeta";

const args = process.argv.slice(2);
const arg = (n, p = null) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : p;
};

const url = arg("--url") ?? process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const horas = Number(arg("--horas", "24"));
if (!url) {
  console.error("✗ Sem DATABASE_URL/DIRECT_URL e sem --url.");
  process.exit(1);
}

const ref = (url.match(/postgres\.([a-z0-9]+)[:@]/) ?? [])[1] ?? "desconhecido";
const c = new pg.Client({ connectionString: url.split("?")[0], ssl: { rejectUnauthorized: false } });
const C = { v: "\x1b[32m", r: "\x1b[31m", a: "\x1b[33m", b: "\x1b[1m", d: "\x1b[2m", x: "\x1b[0m" };

async function main() {
  await c.connect();
  console.log(
    `\n${C.b}Falha coletiva?${C.x} — projeto ${C.b}${ref}${C.x} · janela de ${horas}h  ${C.d}(só leitura)${C.x}\n`,
  );

  // Universo: usuarios com perfil do Facebook conectado. So eles podem falhar
  // por causa do app — quem nunca conectou nao entra no denominador.
  const { rows: [uni] } = await c.query(
    `SELECT count(DISTINCT p."userId")::int AS n FROM "AdProfile" p`,
  );

  const { rows } = await c.query(
    `SELECT u.id AS "userId", u.email,
            a.name AS conta, a."lastSyncError" AS erro, a."accountStatus" AS status,
            a."syncErrorCount" AS falhas,
            EXTRACT(EPOCH FROM (timezone('UTC', now()) - a."lastSyncErrorAt")) AS "haSegundos"
       FROM "AdAccount" a
       JOIN "User" u ON u.id = a."userId"
      WHERE a."lastSyncError" IS NOT NULL
        AND a."lastSyncErrorAt" > timezone('UTC', now()) - ($1 || ' hours')::interval
      ORDER BY u.email, a.name`,
    [String(horas)],
  );

  if (rows.length === 0) {
    console.log(`${C.v}✓ Nenhuma conta com erro nas últimas ${horas}h.${C.x}\n`);
    return;
  }

  // Agrupa pela CAUSA traduzida — ver a nota no cabeçalho.
  const porCausa = new Map();
  for (const r of rows) {
    const causa = explicarErroDeConta(r.erro, r.status)?.mensagem ?? "(não traduzida)";
    const g = porCausa.get(causa) ?? { usuarios: new Set(), contas: 0, maisNovo: Infinity, exemplo: r.erro };
    g.usuarios.add(r.userId);
    g.contas += 1;
    g.maisNovo = Math.min(g.maisNovo, Number(r.haSegundos));
    porCausa.set(causa, g);
  }

  const ordenado = [...porCausa.entries()].sort((a, b) => b[1].usuarios.size - a[1].usuarios.size);

  for (const [causa, g] of ordenado) {
    const n = g.usuarios.size;
    // Dois usuários distintos com a MESMA causa já é o sinal — abaixo disso é
    // ruído de fundo (token que expirou, conta desabilitada, troca de senha).
    const suspeito = n >= 2;
    const marca = suspeito ? `${C.r}🔴 SUSPEITO DE CAUSA COMUM${C.x}` : `${C.d}individual${C.x}`;
    console.log(`${C.b}${causa}${C.x}`);
    console.log(
      `  ${n} de ${uni.n} usuário(s) com perfil conectado · ${g.contas} conta(s)` +
        ` · mais recente há ${Math.round(g.maisNovo / 60)} min   ${marca}`,
    );
    if (suspeito) {
      console.log(
        `  ${C.a}→ ${n} usuários DIFERENTES falhando pela mesma causa. Antes de responder que` +
          ` é problema deles, confira o app em developers.facebook.com (restrição, revisão` +
          ` pendente, permissão removida).${C.x}`,
      );
    }
    console.log(`  ${C.d}exemplo cru: ${String(g.exemplo).slice(0, 110)}${C.x}\n`);
  }

  const maior = ordenado[0][1].usuarios.size;
  console.log(
    maior >= 2
      ? `${C.r}${C.b}VEREDITO: há causa comum a ${maior} usuários. Investigue o APP antes das contas.${C.x}\n`
      : `${C.v}VEREDITO: nenhuma causa atinge mais de um usuário — são problemas individuais.${C.x}\n`,
  );
  // ⚠️ Com UM usuário no banco este script não consegue distinguir nada, e diz
  // isso em vez de dar um veredito que não se sustenta.
  if (uni.n < 2) {
    console.log(
      `${C.d}⚠ Só há ${uni.n} usuário com perfil conectado — não há como detectar causa comum` +
        ` até haver mais de um.${C.x}\n`,
    );
  }
}

main()
  .catch((e) => {
    console.error(`${C.r}✗ ${e.message}${C.x}`);
    process.exitCode = 1;
  })
  .finally(() => c.end());
