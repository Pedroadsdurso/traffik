/**
 * `prisma generate` que RECUSA passar batido com o dev server no ar.
 *
 * ## O problema
 *
 * O singleton do Prisma vive em `globalThis`, que sobrevive ao reload de modulo
 * do Next. Regenerar o cliente com o `npm run dev` no ar reescreve
 * `src/generated/prisma/`, e a instancia antiga continua servindo — sem
 * conhecer as colunas novas.
 *
 * O sintoma e o pior possivel: **nada falha**. Coluna nova volta `undefined`, a
 * tela mostra campo em branco, e isso e indistinguivel de bug de logica. Foi
 * lido como bug de renderizacao duas vezes na sessao de 04/08/2026, com o aviso
 * ja escrito no CLAUDE.md.
 *
 * ## ⛔ O que NAO funciona, medido
 *
 * | Tentativa | Resultado |
 * |---|---|
 * | so `prisma generate` | o Next nao re-executa `lib/prisma.ts`; mtime muda e nao ha recompilacao |
 * | generate + tocar `src/lib/prisma.ts` | tambem nao re-executa — o modulo do servidor fica em cache |
 * | trava de impressao dentro de `lib/prisma.ts` | correta, e **so roda se o modulo re-executar** — ou seja, nunca neste caso |
 *
 * A trava continua la porque cobre o caso em que o modulo RE-EXECUTA por outro
 * motivo (uma edicao no arquivo). Mas ela nao pode ser a unica defesa.
 *
 * ## O que este script faz
 *
 * Gera e, se detectar dev server no ar, **sai com codigo diferente de zero** e
 * manda reiniciar. Nao e automacao — e a verificacao que impede o silencio.
 * Disciplina que falha duas vezes vira erro que interrompe.
 */
import { execFileSync } from "node:child_process";
import { connect } from "node:net";

const PORTA = Number(process.env.PORT ?? 3000);

/** Ha algo escutando na porta do dev server? */
function devNoAr(porta) {
  return new Promise((resolve) => {
    const s = connect({ port: porta, host: "127.0.0.1" });
    const fim = (r) => { s.destroy(); resolve(r); };
    s.setTimeout(600);
    s.on("connect", () => fim(true));
    s.on("error", () => fim(false));
    s.on("timeout", () => fim(false));
  });
}

console.log("→ prisma generate");
// `shell: true` no Windows: sem ele o spawn de `npx.cmd` da EINVAL. Os
// argumentos sao literais nossos, entao nao ha entrada externa para escapar.
execFileSync("npx", ["prisma", "generate"], { stdio: "inherit", shell: process.platform === "win32" });

if (await devNoAr(PORTA)) {
  console.error(
    `\n\x1b[33m⚠  Ha um dev server escutando em :${PORTA}.\x1b[0m\n\n` +
      "   O cliente do Prisma acabou de ser regenerado, mas o processo no ar\n" +
      "   continua com a instancia ANTIGA em globalThis — ela nao conhece as\n" +
      "   colunas novas, e nada vai falhar: os campos voltam `undefined` e a\n" +
      "   tela mostra branco.\n\n" +
      "   \x1b[1mREINICIE o dev server antes de conferir qualquer coisa na tela.\x1b[0m\n",
  );
  process.exit(1);
}

console.log("→ nenhum dev server no ar; nada a reiniciar.");
