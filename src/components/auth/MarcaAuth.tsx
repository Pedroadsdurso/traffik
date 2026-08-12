"use client";

import Image from "next/image";

import { useTheme } from "@/components/theme/ThemeProvider";

/**
 * MarcaAuth — o logotipo da tela de entrada, nos dois temas.
 *
 * ⚠️ A CONVENÇÃO DE NOME DE `/marca/` É "O TEMA SERVIDO", não a cor das letras —
 * e ela é INVERTIDA em relação à pasta `/logos/` antiga, onde o sufixo dizia a
 * cor das letras. Trocar um pelo outro dá logotipo invisível: letras claras
 * sobre fundo claro.
 *
 *   tema claro  → `*-claro.webp`   (letras escuras)
 *   tema escuro → `*-escuro.webp`  (letras claras)
 *
 * ⛔ Client component por causa do `useTheme`, que é o MESMO mecanismo do
 * `Rail`. Não escreva uma segunda troca de tema por CSS aqui: duas
 * implementações da mesma escolha divergem no dia em que o padrão mudar, e o
 * sintoma é a marca certa numa tela e a errada na outra.
 */

type Props = {
  variante: "wordmark" | "simbolo";
  /** Largura em px. A altura sai da proporção do arquivo. */
  largura: number;
};

/** Proporção real dos arquivos gerados por `npm run marca:gerar`. */
const PROPORCAO = { wordmark: 764 / 192, simbolo: 1 } as const;

export function MarcaAuth({ variante, largura }: Props) {
  const { theme } = useTheme();
  const tom = theme === "light" ? "claro" : "escuro";
  const altura = Math.round(largura / PROPORCAO[variante]);

  return (
    <Image
      src={`/marca/${variante}-${tom}.webp`}
      alt="TrackHub"
      width={variante === "wordmark" ? 764 : 512}
      height={variante === "wordmark" ? 192 : 512}
      priority
      style={{ width: largura, height: altura, objectFit: "contain" }}
    />
  );
}
