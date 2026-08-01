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
    ambiente: "local",
    // RFC 2606 e RFC 6761 RESERVAM estes nomes para documentação e teste. A
    // IANA garante que nunca são delegados — não existe loja em `example.com`.
    // É contrato, como os formatos de plataforma, não palpite.
    porque: "Domínio reservado pela IANA para documentação e teste (RFC 2606/6761).",
    testar: (h) =>
      h === "example.com" || h === "example.org" || h === "example.net" ||
      h.endsWith(".example.com") || h.endsWith(".example.org") || h.endsWith(".example.net") ||
      h === "example" || h.endsWith(".example") ||
      h === "test" || h.endsWith(".test") ||
      h === "invalid" || h.endsWith(".invalid"),
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

// ─────────────── Detecção por REPETIÇÃO (só no marcador, nunca ao vivo) ───────────────

/**
 * # Previews que só se revelam EM CONJUNTO
 *
 * O preview de hash aleatório da Vercel
 * (`<projeto>-<hash>-<escopo>.vercel.app`) é indistinguível, **numa URL
 * sozinha**, de um projeto legítimo com hífens (`loja-verao-brasil.vercel.app`).
 * Por isso ele ficou de fora de `FORMATOS`.
 *
 * Mas o dado real trouxe o contrapadrão: **quatro** hosts com o mesmo prefixo
 * (`moldes-`) e o mesmo escopo (`-noahvivaryder3s-projects.vercel.app`),
 * diferindo só num segmento do meio. Nenhum site de produção tem quatro
 * domínios assim. **O sinal não é o formato de uma URL — é a repetição.**
 *
 * > ### ⛔ ISTO NÃO RODA NA INGESTÃO, E NÃO PODE RODAR
 * > A classificação de um evento depende da EXISTÊNCIA de outros. No instante
 * > do primeiro POST não há repetição para observar — logo:
 * >
 * > 1. não dá para usar isto para cortar o envio à CAPI (a decisão é tomada
 * >    antes de a evidência existir);
 * > 2. os primeiros eventos de uma família nunca seriam marcados ao vivo.
 * >
 * > É uma regra **retroativa**, e o lugar dela é o `eventos:marcar` — que
 * > mostra o que vai fazer e **espera aprovação**. É essa confirmação que torna
 * > uma regra ambígua segura: um falso positivo é pego pelo usuário, não pela
 * > produção.
 */
export interface FamiliaDePreview {
  /** Os hosts do grupo. */
  hosts: string[];
  /** Prefixo e sufixo compartilhados, para a tela mostrar o que casou. */
  padrao: string;
}

/** Maior prefixo comum entre as strings. */
function prefixoComum(vs: string[]): number {
  if (vs.length < 2) return vs[0]?.length ?? 0;
  let n = 0;
  while (n < vs[0]!.length && vs.every((v) => v[n] === vs[0]![n])) n++;
  return n;
}

/**
 * Parece hash gerado, e não palavra?
 *
 * ⚠️ O teste decisivo NÃO é "alfanumérico curto" — `cliente1`, `cliente2`,
 * `cliente3` passariam nisso, e um multi-tenant legítimo seria marcado como
 * teste. O que separa os dois é o **prefixo comum**: hashes de verdade
 * (`ahuhuv5fb`, `ralhb1gzf`, `ppxn74d34`, `4i5mg0sx2`) não compartilham
 * começo; `cliente1..3` compartilham sete caracteres.
 */
function pareceHashes(valores: string[]): boolean {
  if (valores.some((v) => !/^[a-z0-9]{6,14}$/.test(v) || !/\d/.test(v))) return false;
  return prefixoComum(valores) <= 1;
}

/** Mínimo de hosts distintos para a repetição valer como evidência. */
const MINIMO_DE_HOSTS = 3;

/**
 * Agrupa hosts que diferem em UM único segmento com cara de hash.
 *
 * ⚠️ Subdomínio legítimo (`app.loja.com`, `blog.loja.com`) **não casa**: o
 * padrão ali é outro nível de DNS, não um segmento hifenizado do mesmo rótulo,
 * e `app`/`blog` não passam no teste de hash.
 */
export function familiasDePreview(hosts: string[]): FamiliaDePreview[] {
  const unicos = [...new Set(hosts.map((h) => h.toLowerCase()))];
  /** chave "seg|*|seg" → hosts */
  const grupos = new Map<string, { hosts: string[]; valores: string[]; i: number; partes: string[] }>();

  for (const host of unicos) {
    const partes = host.split("-");
    // Menos de 3 segmentos não tem "meio" — e `loja-verao.vercel.app` não deve
    // entrar em nenhum agrupamento.
    if (partes.length < 3) continue;
    // Só posições do MEIO: o primeiro é o projeto e o último carrega o domínio.
    for (let i = 1; i < partes.length - 1; i++) {
      const chave = partes.map((p, j) => (j === i ? "*" : p)).join("-");
      if (!grupos.has(chave)) grupos.set(chave, { hosts: [], valores: [], i, partes });
      const g = grupos.get(chave)!;
      g.hosts.push(host);
      g.valores.push(partes[i]!);
    }
  }

  const saida: FamiliaDePreview[] = [];
  const jaUsado = new Set<string>();
  for (const [chave, g] of grupos) {
    if (g.hosts.length < MINIMO_DE_HOSTS) continue;
    if (!pareceHashes(g.valores)) continue;
    if (g.hosts.some((h) => jaUsado.has(h))) continue;
    for (const h of g.hosts) jaUsado.add(h);
    saida.push({ hosts: g.hosts, padrao: chave });
  }
  return saida;
}

// ─────────────── Padrões APROVADOS: a metade preventiva ───────────────

/**
 * # Fechar a assimetria: Netlify era preventivo, Vercel era retroativo
 *
 * `FORMATOS` bloqueia na hora, porque são formatos reservados. A regra de
 * repetição só age DEPOIS, então o preview novo da Vercel já tinha ido para a
 * CAPI antes de qualquer coisa marcá-lo.
 *
 * Quando o usuário APROVA uma família (`eventos:marcar --aplicar`), o padrão
 * (`moldes-*-noahvivaryder3s-projects.vercel.app`) é guardado em
 * `User.testHostPatterns` e passa a valer **na ingestão**, como os formatos.
 *
 * ## 🔴 Aprovar NÃO é cheque em branco
 *
 * Casar o desenho do host não basta: o segmento variável **ainda precisa
 * parecer hash**. Um `moldes-producao-noahvivaryder3s-projects.vercel.app`
 * casa o molde e **não bloqueia**, porque `producao` é palavra.
 *
 * É a aplicação do critério "errar para o lado seguro": bloquear é
 * irreversível (o evento não vai para a CAPI e não volta), então a aprovação
 * amplia o alcance da regra, nunca afrouxa o teste que a torna confiável.
 *
 * ## ⚠️ Por isso a lista é REMOVÍVEL na tela
 *
 * Integrações › Testes lista os padrões aprovados com botão de remover. Uma
 * regra de bloqueio que só saísse por SQL seria irreversível na prática — e
 * irreversível é exatamente o que ela não pode ser.
 */
export interface PadraoAprovado {
  padrao: string;
  criadoEm?: string;
}

/** Lê o Json cru, descartando o que não reconhece. */
export function lerPadroes(bruto: unknown): PadraoAprovado[] {
  if (!Array.isArray(bruto)) return [];
  const out: PadraoAprovado[] = [];
  for (const item of bruto) {
    if (!item || typeof item !== "object") continue;
    const p = (item as Record<string, unknown>).padrao;
    // Só padrão com curinga NO MEIO — ver `casaPadrao`.
    if (typeof p !== "string" || !p.includes("*")) continue;
    const c = (item as Record<string, unknown>).criadoEm;
    out.push({ padrao: p, criadoEm: typeof c === "string" ? c : undefined });
  }
  return out;
}

/** Um único segmento parece hash gerado? Mesmo critério do `pareceHashes`. */
export function pareceHashUnico(v: string): boolean {
  return /^[a-z0-9]{6,14}$/.test(v) && /\d/.test(v);
}

/**
 * O host casa este padrão aprovado?
 *
 * ⚠️ Exige, cumulativamente: **mesmo número de segmentos**, todos os fixos
 * idênticos, **exatamente um** curinga, ele **no meio** (nunca no primeiro nem
 * no último, que carregam projeto e domínio) e o valor variável passando no
 * teste de hash. Qualquer folga aqui transforma uma aprovação pontual numa
 * regra ampla, e o custo é evento real fora da CAPI.
 */
export function casaPadrao(host: string, padrao: string): boolean {
  const pp = padrao.toLowerCase().split("-");
  const hp = host.toLowerCase().split("-");
  if (pp.length !== hp.length || pp.length < 3) return false;
  let curinga = -1;
  for (let i = 0; i < pp.length; i++) {
    if (pp[i] === "*") {
      if (curinga >= 0) return false; // dois curingas: recusa
      curinga = i;
      continue;
    }
    if (pp[i] !== hp[i]) return false;
  }
  if (curinga <= 0 || curinga >= pp.length - 1) return false;
  return pareceHashUnico(hp[curinga]!);
}

/**
 * Classifica pela lista aprovada, DEPOIS de `ambienteDaUrl` não ter decidido.
 *
 * ⚠️ Nunca sobrescreve `FORMATOS`: aquilo é contrato de plataforma, isto é
 * escolha do usuário. Se um dia os dois discordarem, quem manda é o contrato.
 */
export function ambientePorPadraoAprovado(
  url: string | null | undefined,
  padroes: PadraoAprovado[],
): Deteccao {
  if (!url || padroes.length === 0) return NENHUM;
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return NENHUM;
  }
  for (const p of padroes) {
    if (casaPadrao(host, p.padrao)) {
      return { ambiente: "preview", porque: `Padrão de ambiente de teste aprovado por você: ${p.padrao}` };
    }
  }
  return NENHUM;
}
