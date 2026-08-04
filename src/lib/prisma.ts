import { statSync } from "node:fs";
import { join } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

/**
 * # Singleton do Prisma — e a trava contra CLIENTE DEFASADO em dev
 *
 * Em dev o Next recarrega os módulos a cada edição; sem o singleton cada reload
 * abriria um novo pool de conexões. O cache vive em `globalThis`, que
 * **sobrevive ao reload de módulo** — e é exatamente daí que vem a armadilha.
 *
 * ## 🔴 O que acontecia
 *
 * Rodar `prisma migrate deploy && prisma generate` com o `npm run dev` no ar
 * regenera `src/generated/prisma/`. O Next recompila (os arquivos estão dentro
 * de `src/`), este módulo re-executa — e `globalForPrisma.prisma` já está
 * preenchido, então `?? createClient()` devolve **o cliente antigo**, que não
 * conhece as colunas novas.
 *
 * O sintoma é o pior possível: **nada falha**. As colunas novas voltam
 * `undefined`, a tela mostra campo em branco, e isso é indistinguível de um bug
 * de lógica — foi lido como bug de renderização duas vezes na sessão de
 * 04/08/2026, com o aviso já escrito no CLAUDE.md. Documentação não resolveu o
 * caso; então virou verificação.
 *
 * ## A trava
 *
 * A impressão do cliente gerado (o `mtime` do arquivo que o `generate`
 * reescreve) entra na chave do cache. Regenerou → `mtime` muda → o cliente
 * velho é descartado e um novo nasce, com aviso no console dizendo o que houve.
 *
 * ⚠️ Só em desenvolvimento. Em produção o cliente nunca é regenerado com o
 * processo no ar, e um `statSync` por carga de módulo seria custo sem ganho.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaImpressao?: string;
};

/**
 * Impressão do cliente gerado.
 *
 * ⚠️ Falha ao ler devolve `"?"`, e `"?"` **nunca invalida o cache** — é igual a
 * si mesmo. Um erro de caminho aqui não pode virar recriação de pool a cada
 * carga de módulo.
 */
function impressaoDoCliente(): string {
  try {
    return String(statSync(join(process.cwd(), "src", "generated", "prisma", "client.ts")).mtimeMs);
  } catch {
    return "?";
  }
}

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL não definida.");

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

const emDev = process.env.NODE_ENV !== "production";

if (emDev && globalForPrisma.prisma) {
  const agora = impressaoDoCliente();
  if (globalForPrisma.prismaImpressao && globalForPrisma.prismaImpressao !== agora) {
    console.warn(
      "\n\x1b[33m[prisma] O cliente foi REGENERADO com o dev server no ar.\x1b[0m\n" +
        "         Descartando a instancia antiga — ela nao conhece as colunas novas.\n" +
        "         (era isso que fazia coluna nova voltar `undefined` sem erro nenhum)\n",
    );
    // Fecha o pool antigo. `void` + catch: falhar ao desconectar nao pode
    // impedir a criacao do cliente novo, que e o objetivo.
    void globalForPrisma.prisma.$disconnect().catch(() => {});
    globalForPrisma.prisma = undefined;
  }
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (emDev) {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaImpressao = impressaoDoCliente();
}
