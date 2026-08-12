"use client";

import { useTraffik } from "@/components/dashboard/TraffikContext";
import { PixelScreen } from "@/components/dashboard/views/pixel/PixelScreen";

/**
 * Pixel & Eventos — reescrita de 11/08/2026. A `PixelView` (1.181 linhas) foi
 * DELETADA no mesmo commit.
 *
 * 🔴 A tela lê `v.workspaceAtiva` por dentro, e não por prop, porque precisa do
 * valor ATUAL a cada troca de área: o que sai daqui é SCRIPT, e um script de um
 * pixel de outra operação é **válido** — ele instala, roda e manda evento para a
 * conta errada. Quem denuncia é o Gerenciador de Eventos da Meta, semanas
 * depois.
 */
export default function PixelPage() {
  return <PixelScreen v={useTraffik()} />;
}
