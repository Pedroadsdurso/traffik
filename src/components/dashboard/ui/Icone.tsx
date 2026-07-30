"use client";

import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowUp,
  Ban,
  Barcode,
  BarChart3,
  Bell,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleCheck,
  Clock,
  Check,
  Compass,
  CreditCard,
  DollarSign,
  Eye,
  Globe,
  Image as ImageIcon,
  Info,
  Layers,
  LayoutGrid,
  LineChart,
  Link,
  Link2,
  ListFilter,
  LogOut,
  MapPin,
  MonitorPlay,
  Moon,
  MousePointerClick,
  Pencil,
  Percent,
  QrCode,
  Receipt,
  RefreshCw,
  Settings2,
  ShoppingCart,
  SlidersHorizontal,
  Star,
  Sun,
  Pin,
  Sparkles,
  Target,
  Trash2,
  Undo2,
  UserPlus,
  Wallet,
  X,
  Zap,
  Bot,
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
 * ## ✅ Convergência CONCLUÍDA: 24×24 e traço 1,75
 *
 * O produto tinha **dois sistemas de coordenada** misturados — `0 0 24 24` e
 * `0 0 256 256`, com `strokeWidth` de 1 a 20. Visualmente parecidos, mas cada
 * ícone novo exigia decidir qual sistema, e errar aparece. Em 30/07/2026 os 11
 * SVGs em 256×256 foram migrados para cá e o `Icon.tsx` (`NavIcon`) foi
 * **deletado** — não existe mais nenhum ícone de conteúdo fora deste mapa.
 *
 * ⚠️ **Ícone novo entra NESTE mapa**, não solto na view. É o que impede a
 * divergência de voltar.
 *
 * ⚠️ **Banco de `path` em string é a forma que a divergência volta.** Tanto o
 * `NavIcon` quanto as abas do Gerenciador guardavam `icon: "M40 40 h72…"` num
 * array de configuração — parecia dado, era desenho, e escapava de qualquer
 * padronização. Se precisar de ícone dirigido por dados, o campo guarda um
 * `NomeIcone`, nunca um `path`.
 *
 * ⚠️ **Os `<svg>` de `Funnel`, `Donut`, `CountryMap`, `AreaChart` e o
 * `Sparkline` do `chartKit` NÃO passam por aqui** — são telas de gráfico
 * desenhadas por coordenada, não ícones. Não tente unificá-los.
 */
const MAPA = {
  aviso: AlertTriangle,
  /** Acesso automatizado — a contagem de bot removido do funil. */
  robo: Bot,
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
  vendaAprovada: CircleCheck,
  vendaPendente: Clock,
  relatorio: BarChart3,
  sino: Bell,

  // ── Navegação da sidebar (eram um banco de `path` em `Icon.tsx`) ──
  painel: LayoutGrid,
  gerenciador: Target,
  criativos: ImageIcon,
  regras: Zap,
  integracoes: Link,
  taxas: Percent,
  sair: LogOut,

  // ── Controles de interface ──
  temaClaro: Sun,
  temaEscuro: Moon,
  chevronCima: ChevronUp,
  chevronBaixo: ChevronDown,
  chevronDireita: ChevronRight,
  editar: Pencil,
  atualizar: RefreshCw,
  ajustes: SlidersHorizontal,
  destaque: Star,
  grafico: LineChart,
  seta: ArrowUp,

  // ── Formas de pagamento. `pix` é QrCode porque no Brasil o Pix É o QR code —
  //    o losango genérico anterior não dizia nada. ──
  pix: QrCode,
  cartao: CreditCard,
  boleto: Barcode,
  pagamento: Wallet,

  // ── Tipos de evento do feed de atividade ──
  clique: MousePointerClick,
  carrinho: ShoppingCart,
  lead: UserPlus,
  visita: Eye,

  // ── Abas do Gerenciador de Anúncios ──
  contas: Receipt,
  conjuntos: ListFilter,
  anuncios: MonitorPlay,
  camadas: Layers,
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
  style,
}: {
  nome: NomeIcone;
  tamanho?: number;
  cor?: keyof typeof CORES;
  className?: string;
  /**
   * ⚠️ Só para `transform`, `animation` e `opacity` — o ícone que gira quando o
   * menu abre, a seta do delta que aponta para baixo na queda, o "Atualizar" que
   * roda enquanto sincroniza. **Não é uma porta para cor:** cor passa por `cor`,
   * senão a paleta de intenções deixa de valer e voltamos a ter hex solto na view.
   */
  style?: React.CSSProperties;
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
      style={{ ...sx("flex:none;display:block"), ...style }}
    />
  );
}
