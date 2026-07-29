/**
 * Hook de resolução (roda na thread de loaders). Ver `alias-loader.mjs`.
 *
 * Resolve o que o bundler do Next resolve e o Node não: o alias `@/` do
 * tsconfig e a extensão implícita `.ts`.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const src = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");

const comExtensao = (base) => {
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
    if (path.extname(cand) && existsSync(cand)) return cand;
  }
  return null;
};

export async function resolve(spec, ctx, next) {
  let base = null;

  if (spec.startsWith("@/")) {
    base = path.join(src, spec.slice(2));
  } else if ((spec.startsWith("./") || spec.startsWith("../")) && ctx.parentURL?.startsWith("file:")) {
    // Só entra aqui quando falta extensão — import relativo já completo segue
    // o caminho normal do Node.
    const p = path.resolve(path.dirname(fileURLToPath(ctx.parentURL)), spec);
    if (!path.extname(p)) base = p;
  }

  const alvo = base ? comExtensao(base) : null;
  return alvo ? next(pathToFileURL(alvo).href, ctx) : next(spec, ctx);
}
