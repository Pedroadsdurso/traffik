"use client";

import Image from "next/image";

import { sx } from "@/lib/sx";

/**
 * Logo de um gateway/plataforma. Cai no monograma quando não temos o arquivo —
 * hoje nenhum gateway cadastrado está nessa situação, mas o fallback fica para
 * o próximo que entrar na lista antes de a arte chegar.
 */
const LOGOS: Record<string, string> = {
  KIRVANO: "/logos/kirvano.webp",
  CAKTO: "/logos/cakto.webp",
  HOTMART: "/logos/hotmart.webp",
  CARTPANDA: "/logos/cartpanda.webp",
  KIWIFY: "/logos/kiwify.webp",
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
    // Sem fundo: só o recorte arredondado. Algumas artes (a da Kirvano, por
    // exemplo) já trazem o próprio fundo embutido, e o `overflow:hidden`
    // arredonda esse quadrado em vez de deixá-lo com quina viva.
    <span
      style={sx(
        `display:grid;place-items:center;flex:none;width:${tamanho}px;height:${tamanho}px;border-radius:${Math.round(tamanho * 0.26)}px;overflow:hidden`,
      )}
    >
      <Image
        src={src}
        alt={nome}
        width={tamanho}
        height={tamanho}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    </span>
  );
}
