import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Runtime instalável servido ao site do cliente: ES5 por exigência de
    // compatibilidade, e GERADO — lintar com as regras do app só produz
    // ruído em código que não é da aplicação.
    "public/*.js",
  ]),
]);

export default eslintConfig;
