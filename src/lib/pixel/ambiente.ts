/**
 * # De qual AMBIENTE veio este evento?
 *
 * ## O problema
 *
 * Quem constrói uma página recarrega dezenas de vezes, e cada deploy preview
 * tem host próprio. Esses eventos entravam no funil como visitantes e iam para
 * a CAPI da Meta como conversões — poluindo o número na tela **e** o sinal que
 * otimiza a campanha.
 *
 * ## ⛔ Por que isto NÃO é a heurística que eu tinha recusado
 *
 * A primeira proposta foi filtrar por `*.netlify.app`, e recusei com razão:
 * **muita gente roda produção ali**, e descartar esses eventos seria perda
 * silenciosa de conversão.
 *
 * Só que os padrões abaixo não são `*.netlify.app` — são
 * `<hash>--<site>.netlify.app`, `<projeto>-git-<branch>.vercel.app`,
 * `localhost`. São **formatos RESERVADOS pelas plataformas** para ambiente
 * efêmero: o `--` antes de `.netlify.app` não aparece num domínio de produção,
 * porque a Netlify o usa como separador de deploy. Não é palpite sobre o
 * hospedeiro, é o formato que ele emite.
 *
 * Conflatar as duas coisas foi erro meu, corrigido em 01/08/2026.
 *
 * ## 🔴 MARCA, nunca apaga — e é o que torna o risco aceitável
 *
 * O evento continua gravado, com o motivo. Se a detecção errar, o dado está lá,
 * aparece na contagem da tela e é reversível com um `UPDATE`. Foi essa mudança
 * — de *descartar* para *marcar* — que desmontou a objeção original: perda
 * silenciosa vira classificação visível.
 *
 * ⚠️ **Ambiente de teste NÃO vai para a CAPI.** Mandar um Purchase de
 * `localhost` para o pixel real ensina a Meta a otimizar para ninguém. É o
 * único ponto em que a detecção tem consequência irreversível, e é justamente
 * onde os formatos são mais inequívocos (nenhuma loja vende em `localhost`).
 *
 * ## Como acrescentar um formato
 *
 * Uma linha em `FORMATOS`. É **dado, não `if`** — pelo mesmo motivo das
 * capacidades de gateway: um `if` espalhado pela ingestão faz o próximo
 * hospedeiro custar caro.
 */

export type Ambiente = "preview" | "local" | "tunel";

export interface FormatoDeTeste {
  /** Rótulo curto do que foi detectado, para a tela. */
  ambiente: Ambiente;
  /** Por que este host é inequivocamente efêmero. Vira o `title` na UI. */
  porque: string;
  testar: (host: string) => boolean;
}

/**
 * ⚠️ Cada entrada tem de casar um formato **RESERVADO**, não um hospedeiro.
 * Se você conseguir imaginar uma loja de verdade atendendo naquele host, a
 * entrada está errada — o custo do falso positivo é um evento real fora do
 * funil e fora da CAPI.
 */
export const FORMATOS: FormatoDeTeste[] = [
  {
    ambiente: "local",
    porque: "Endereço da máquina de quem desenvolve — nenhuma loja atende aqui.",
    // `localhost`, `127.0.0.1`, `[::1]`, `algo.localhost`, `algo.local` (mDNS).
    testar: (h) =>
      h === "localhost" ||
      h.endsWith(".localhost") ||
      h === "127.0.0.1" ||
      h.startsWith("127.") ||
      h === "[::1]" ||
      h === "::1" ||
      h === "0.0.0.0" ||
      h.endsWith(".local") ||
      // Faixas privadas: 10.x, 192.168.x e 172.16–31.x
      /^10\.\d+\.\d+\.\d+$/.test(h) ||
      /^192\.168\.\d+\.\d+$/.test(h) ||
      /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(h),
  },
  {
    ambiente: "preview",
    porque:
      "Formato de deploy preview da Netlify (<algo>--<site>.netlify.app). O domínio de produção não tem o `--`.",
    // Cobre deploy-preview-N--site, branch--site e <id>--site. Produção é
    // `site.netlify.app`, sem `--`, e NÃO casa.
    testar: (h) => h.endsWith(".netlify.app") && h.includes("--"),
  },
  {
    ambiente: "preview",
    porque: "Preview ao vivo da Netlify (netlify.live).",
    testar: (h) => h.endsWith(".netlify.live"),
  },
  {
    ambiente: "preview",
    porque:
      "Formato de deploy de branch da Vercel (<projeto>-git-<branch>-<escopo>.vercel.app). A produção não tem o `-git-`.",
    // ⚠️ Só o `-git-`, que é reservado. O preview de hash aleatório
    // (`projeto-a1b2c3d4-escopo.vercel.app`) NÃO entra: um projeto chamado
    // `loja-verao-brasil` produziria o mesmo desenho, e o falso positivo aqui
    // tira evento real do funil.
    testar: (h) => h.endsWith(".vercel.app") && h.includes("-git-"),
  },
  {
    ambiente: "tunel",
    porque: "Túnel de desenvolvimento (ngrok / localtunnel / cloudflared).",
    testar: (h) =>
      h.endsWith(".ngrok.io") ||
      h.endsWith(".ngrok-free.app") ||
      h.endsWith(".ngrok.app") ||
      h.endsWith(".loca.lt") ||
      h.endsWith(".trycloudflare.com"),
  },
];

export interface Deteccao {
  ambiente: Ambiente | null;
  porque: string | null;
}

const NENHUM: Deteccao = { ambiente: null, porque: null };

/**
 * Classifica a URL de um evento.
 *
 * ⚠️ **URL ausente ou ilegível → produção** (`null`), nunca teste. Não saber de
 * onde veio não é evidência de ambiente efêmero, e marcar por omissão tiraria
 * do funil todo evento server-side (o `InitiateCheckout` que nasce do webhook
 * do gateway não tem URL).
 */
export function ambienteDaUrl(url: string | null | undefined): Deteccao {
  if (!url) return NENHUM;
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return NENHUM;
  }
  if (!host) return NENHUM;
  for (const f of FORMATOS) {
    if (f.testar(host)) return { ambiente: f.ambiente, porque: f.porque };
  }
  return NENHUM;
}

/** Rótulo para a tela. */
export const ROTULO_AMBIENTE: Record<Ambiente, string> = {
  preview: "deploy de teste",
  local: "máquina local",
  tunel: "túnel de desenvolvimento",
};
