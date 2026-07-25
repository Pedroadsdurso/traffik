"use client";

import Image from "next/image";

import { sx } from "@/lib/sx";

/**
 * Logo de um gateway/plataforma. Cai no monograma quando não temos o arquivo —
 * hoje é o caso da Kiwify, que ainda não está habilitada de qualquer forma.
 */
const LOGOS: Record<string, string> = {
  KIRVANO: "/logos/kirvano.webp",
  HOTMART: "/logos/hotmart.webp",
  CARTPANDA: "/logos/cartpanda.webp",
  FACEBOOK: "/logos/facebook.webp",
};

export function LogoGateway({
  id,
  nome,
  tamanho = 34,
}: {
  /** Chave do gateway (KIRVANO, HOTMART…) ou plataforma. */
  id: string;
  nome: string;
  tamanho?: number;
}) {
  const src = LOGOS[id.toUpperCase()];

  if (!src) {
    return (
      <span
        aria-hidden
        style={sx(
          `display:grid;place-items:center;flex:none;width:${tamanho}px;height:${tamanho}px;border-radius:${Math.round(tamanho * 0.28)}px;background:var(--color-accent-800);color:var(--color-accent-100);font-weight:600;font-size:${Math.round(tamanho * 0.42)}px`,
        )}
      >
        {nome.charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    // Fundo claro sutil: as logos vêm com fundo transparente e várias são
    // escuras, então sem isso a Kirvano sumiria no card escuro.
    <span
      style={sx(
        `display:grid;place-items:center;flex:none;width:${tamanho}px;height:${tamanho}px;border-radius:${Math.round(tamanho * 0.28)}px;background:#fff;overflow:hidden`,
      )}
    >
      <Image
        src={src}
        alt={nome}
        width={tamanho}
        height={tamanho}
        style={{ width: `${Math.round(tamanho * 0.78)}px`, height: `${Math.round(tamanho * 0.78)}px`, objectFit: "contain" }}
      />
    </span>
  );
}
