/**
 * # Classificação de bot — MARCA, nunca bloqueia
 *
 * ## A decisão, e por quê
 *
 * O `/api/track/click` **continua gravando tudo**. O que muda é uma coluna:
 * `Click.bot`. As métricas excluem `bot: true`; o registro fica.
 *
 * Bloquear na ingestão significaria **não gravar**, e aí um falso positivo apaga
 * um cliente **sem deixar rastro** — não há como descobrir depois, nem como
 * desfazer. Marcar é reversível: erro na lista de padrões se corrige rodando o
 * `npm run bot:reclassificar`, porque o `userAgent` continua no banco.
 *
 * Medido em produção (30/07/2026): **39 de 237 cliques = 16,5%** são bot.
 *
 * ## ⛔ PAÍS NUNCA É CRITÉRIO. IP DE DATACENTER TAMBÉM NÃO.
 *
 * A suspeita inicial era de que os 90 cliques de US+IE fossem crawler — afinal,
 * a Irlanda é o datacenter europeu da Meta. A decomposição mostrou **37 bots e
 * 53 pessoas reais**, e as 2 únicas vendas que casaram com um clique vieram
 * justamente dali.
 *
 * O motivo é estrutural neste produto: **55,6% do tráfego humano vem do
 * navegador embutido do Instagram e do Facebook**, que sai pela infraestrutura
 * da Meta. Então, aqui, IP de datacenter da Meta é evidência de **usuário real
 * de rede social** — quase o oposto de bot.
 *
 * > ⚠️ Isto vale mesmo quando a detecção de datacenter existir (passo 6). Ela
 * > serve para corrigir o PAÍS, não para classificar bot.
 *
 * O único critério é o **user agent**.
 *
 * ## Como manter a lista
 *
 * `PADROES` é uma lista de `{ re, motivo }` lida de cima para baixo, e o
 * primeiro que casar vence. **A ordem importa**: o crawler da Meta se anuncia
 * dentro de um user agent de navegador comum
 * (`Mozilla/5.0 (...) Chrome/145 (compatible; meta-externalads/1.1 ...)`), então
 * ele precisa ser testado antes de qualquer regra de "parece navegador".
 *
 * Para acrescentar um padrão: uma linha aqui + rodar `npm run bot:reclassificar`
 * para reavaliar o histórico. Nenhuma outra parte do código precisa saber.
 */

export interface Classificacao {
  bot: boolean;
  /** Rótulo curto e estável — vai para `Click.botMotivo` e para a tela. */
  motivo: string | null;
}

/**
 * ⚠️ **Conservador de propósito.** Cada padrão aqui precisa ser algo que um
 * navegador de pessoa real **nunca** manda. Na dúvida, deixe de fora: um bot que
 * escapa infla a contagem em alguns por cento; um humano marcado como bot some
 * das métricas e leva a decisão de mídia junto.
 */
export const PADROES: readonly { re: RegExp; motivo: string }[] = [
  // ── Crawlers de rede social ──
  // Visitam a página quando um anúncio ou link é criado/compartilhado. O
  // `meta-externalads` foi o mais frequente na produção (17 de 39).
  { re: /meta-externalads/i, motivo: "Crawler da Meta (anúncios)" },
  { re: /facebookexternalhit|facebookcatalog|facebookbot/i, motivo: "Crawler da Meta" },
  { re: /twitterbot|linkedinbot|pinterestbot|slackbot|whatsapp|telegrambot|discordbot/i, motivo: "Crawler de rede social" },
  { re: /tiktok.*(bot|spider)|bytespider/i, motivo: "Crawler do TikTok" },

  // ── Navegador automatizado ──
  // 18 dos 39 em produção. `HeadlessChrome` é o padrão de Puppeteer/Playwright.
  { re: /headlesschrome|phantomjs|electron\/.*\bheadless\b/i, motivo: "Navegador automatizado" },
  { re: /\bselenium\b|webdriver|puppeteer|playwright|cypress/i, motivo: "Navegador automatizado" },

  // ── Auditoria e monitoramento ──
  { re: /lighthouse|pagespeed|gtmetrix|pingdom|uptimerobot|statuscake|newrelic/i, motivo: "Auditoria de site" },

  // ── Buscadores ──
  { re: /googlebot|google-inspectiontool|adsbot-google|mediapartners-google/i, motivo: "Buscador (Google)" },
  { re: /bingbot|bingpreview|yandexbot|duckduckbot|baiduspider|applebot|petalbot/i, motivo: "Buscador" },

  // ── SEO e raspagem ──
  { re: /ahrefsbot|semrushbot|mj12bot|dotbot|screaming frog|dataforseo|serpstat/i, motivo: "Robô de SEO" },

  // ── Ferramentas de linha de comando e bibliotecas HTTP ──
  // ⚠️ `curl/` e `wget` com barra/limite para não casar "curly" num nome de
  // aparelho. Foram 2 em produção — provavelmente teste nosso.
  { re: /^curl\/|\bcurl\/\d|^wget\b|\bwget\/\d/i, motivo: "Ferramenta de linha de comando" },
  { re: /python-requests|python-urllib|aiohttp|scrapy|okhttp|go-http-client|java\/\d|libwww-perl|guzzle/i, motivo: "Biblioteca HTTP" },
  { re: /axios\/|node-fetch|got \(|postmanruntime|insomnia|httpie/i, motivo: "Cliente HTTP" },

  // ── Genéricos, por último ──
  // ⚠️ `\bbot\b` com limites de palavra: sem isso, "Abbott" num nome de
  // aparelho e o `FBAV/...` do app do Facebook cairiam aqui.
  // ⚠️ `\brobot\b` é separado de `\bbot\b` porque o limite de palavra de `bot`
  // **não** casa dentro de "Robot" (o `o` antes do `b` é caractere de palavra).
  // Um teste com `SomeCompany Robot/1.0` passava batido. O `\b` final continua
  // protegendo "robotics", que é nome de produto e não declaração de robô.
  { re: /\bbot\b|\bbots\b|\brobot\b|\bcrawler\b|\bspider\b|\bscraper\b|\bslurp\b/i, motivo: "Robô declarado" },
  { re: /\bheadless\b|\bmonitoring\b|\bpreview\b.*\bfetch\b/i, motivo: "Acesso automatizado" },
];

/**
 * Classifica um user agent.
 *
 * ⚠️ **User agent AUSENTE não é bot.** Navegador com extensão de privacidade,
 * app embutido antigo e algumas configurações corporativas suprimem o header.
 * Chutar "bot" aqui apagaria pessoas reais em silêncio — que é exatamente o
 * risco que a decisão de marcar (e não bloquear) existe para evitar.
 */
export function classificarUserAgent(ua: string | null | undefined): Classificacao {
  const s = ua?.trim();
  if (!s) return { bot: false, motivo: null };

  for (const { re, motivo } of PADROES) {
    if (re.test(s)) return { bot: true, motivo };
  }
  return { bot: false, motivo: null };
}
