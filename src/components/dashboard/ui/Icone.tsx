"use client";

import {
  AlertTriangle,
  ArrowLeftRight,
  Ban,
  Check,
  Compass,
  DollarSign,
  Globe,
  Info,
  Link2,
  MapPin,
  Settings2,
  Pin,
  Sparkles,
  Trash2,
  Undo2,
  X,
  type LucideIcon,
} from "lucide-react";

import { sx } from "@/lib/sx";

/**
 * Ponto ÚNICO de ícones da ferramenta.
 *
 * ## Por que existe
 *
 * As telas novas usavam **emoji** (🧭, ⚠️, 🔗). Emoji não é ícone: o desenho é
 * do sistema operacional, então muda de forma e de cor entre Windows, macOS e
 * Android, ignora a cor da marca e nunca combina com um traço de 1,5px. Ao lado
 * dos SVGs do resto do produto, denunciava que aquela tela foi feita depois.
 *
 * ## Por que `lucide-react`, e não SVG à mão
 *
 * O projeto já descartou `react-simple-maps` por não suportar React 19. O
 * `lucide-react` **declara `^19.0.0` em `peerDependencies`** — checado antes de
 * instalar. São SVGs com traço uniforme, `currentColor` e `viewBox` 24×24, que é
 * exatamente o padrão para o qual estamos convergindo.
 *
 * ## ⚠️ Convergência: 24×24 e traço 1,75
 *
 * O produto tinha **dois sistemas de coordenada** misturados — `0 0 24 24` (14
 * usos) e `0 0 256 256` (11 usos) — com `strokeWidth` de 1 a 20. Visualmente
 * parecidos, mas cada ícone novo exigia decidir qual sistema, e errar aparece.
 * Tudo o que passa por aqui é 24×24 com o mesmo traço.
 *
 * ⚠️ **Ícone novo entra NESTE mapa**, não solto na view. É o que impede a
 * divergência de voltar.
 */
const MAPA = {
  aviso: AlertTriangle,
  info: Info,
  bussola: Compass,
  automacao: Settings2,
  link: Link2,
  voltar: Undo2,
  local: MapPin,
  ok: Check,
  erro: X,
  excluir: Trash2,
  bloqueado: Ban,
  mover: ArrowLeftRight,
  novo: Sparkles,
  globo: Globe,
  dinheiro: DollarSign,
  fixado: Pin,
} satisfies Record<string, LucideIcon>;

export type NomeIcone = keyof typeof MAPA;

/**
 * Cores por intenção. Usa as variáveis do tema, exceto onde o significado é
 * universal (perigo em vermelho, atenção em âmbar) — aí a cor É a informação.
 */
const CORES = {
  neutro: "currentColor",
  suave: "var(--color-text-muted, currentColor)",
  marca: "var(--color-accent)",
  aviso: "#f59e0b",
  perigo: "#ef4444",
  ok: "#22c55e",
} as const;

export function Icone({
  nome,
  tamanho = 16,
  cor = "neutro",
  className,
}: {
  nome: NomeIcone;
  tamanho?: number;
  cor?: keyof typeof CORES;
  className?: string;
}) {
  const Svg = MAPA[nome];
  return (
    <Svg
      aria-hidden
      className={className}
      width={tamanho}
      height={tamanho}
      // 1,75 em 24×24 é o peso que casa com o texto de 13–14px do produto: 2 fica
      // pesado ao lado do corpo de texto, 1,5 desaparece no tema escuro.
      strokeWidth={1.75}
      color={CORES[cor]}
      style={sx("flex:none;display:block")}
    />
  );
}
