/**
 * Resolvedor de alias para rodar módulos do `src/` em Node puro.
 *
 * O código-fonte usa `@/lib/...` (o alias do tsconfig) e extensão implícita —
 * duas coisas que o bundler do Next resolve e o Node não. Sem isto, um teste
 * que importe do `src/` teria de duplicar o código sob teste, que é justamente
 * o que faz um teste parar de provar alguma coisa.
 *
 * Uso:
 *   node --experimental-strip-types --import ./scripts/alias-loader.mjs <teste>
 */
import { register } from "node:module";

register("./alias-hooks.mjs", import.meta.url);

// O type-stripping do Node avisa a cada .ts carregado; aqui todos são ESM.
const avisoRuidoso = (w) =>
  /MODULE_TYPELESS_PACKAGE_JSON|Type Stripping|TypeStripping/.test(String(w?.message ?? w));
const originais = process.listeners("warning");
process.removeAllListeners("warning");
process.on("warning", (w) => {
  if (!avisoRuidoso(w)) for (const l of originais) l(w);
});
