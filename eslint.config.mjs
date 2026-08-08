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
  {
    // TDZ não é erro de tipo — tsc passa e a página quebra em execução.
    // Ligada em 07/08/2026 depois de a mesma família morder quatro vezes.
    // functions: false de propósito: function é içada, e chamá-la antes da
    // declaração é idioma normal de JS. O que estoura é const/let.
    rules: {
      "@typescript-eslint/no-use-before-define": [
        "error",
        { functions: false, classes: false, variables: true, enums: true, typedefs: false },
      ],
    },
  },
]);

export default eslintConfig;