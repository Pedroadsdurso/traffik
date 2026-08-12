/**
 * O CONTEÚDO da tela de entrada — texto e lista, sem JSX.
 *
 * Mora fora do componente por dois motivos, e o segundo é o que importa:
 *
 * 1. `/login` e `/signup` mostram o MESMO painel esquerdo. Duas cópias
 *    divergiriam no primeiro ajuste de copy, e a divergência seria invisível
 *    (ninguém abre as duas telas lado a lado).
 * 2. Isto é a única tela do produto que faz AFIRMAÇÃO DE MARKETING, e afirmação
 *    de marketing é testável. Como dado puro, cada frase pode ser conferida
 *    contra o que o produto realmente faz.
 *
 * ⛔ NENHUMA FRASE AQUI CARREGA NÚMERO DE CONFIGURAÇÃO. A primeira versão dizia
 * "atualiza a cada 5 segundos", lido de `DASH_POLL_MS`. Copiar o valor cria uma
 * segunda fonte que envelhece no primeiro commit que mexer no polling — e o
 * texto de marketing é o último lugar onde alguém procuraria a divergência.
 * Descreva a DECISÃO ("se atualiza sozinho"), nunca o valor.
 */

export type Prova = {
  /** Nome do ícone do lucide — resolvido no componente, para isto ficar puro. */
  icone: "raio" | "escudo" | "alvo";
  titulo: string;
  /** A frase que AFIRMA algo. Cada uma é conferível contra o código. */
  apoio: string;
};

export const BADGE = "Plataforma de tracking e gestão";

/**
 * Duas linhas, e a segunda em cor de destaque — é o desenho da referência.
 * Separadas em campos porque a cor cai na SEGUNDA: uma string única obrigaria a
 * fatiar texto no JSX, que é a cirurgia de string que já produziu placeholder
 * vazio nesta base.
 */
export const HEADLINE = {
  primeira: "Transforme dados",
  destaque: "em lucro real.",
} as const;

export const APOIO =
  "Conecte suas campanhas, rastreie cada conversão e tome decisões com precisão em tempo real.";

/**
 * As três provas. ⚠️ Cada `apoio` é uma afirmação sobre o produto, e as três
 * foram medidas em 12/08/2026 antes de serem escritas:
 *
 * | Prova | O que sustenta |
 * |---|---|
 * | tempo real | `startPolling` no `useTraffikState` — o painel revalida sozinho com a aba visível |
 * | criptografia | `lib/crypto/secrets.ts`, AES-256-GCM em repouso; senha em bcrypt |
 * | regras | `lib/rules/engine.ts` — PAUSAR e AJUSTAR_ORCAMENTO, exercidos em produção em 31/07/2026 |
 *
 * ⛔ Ao acrescentar uma quarta, meça antes. A tela de entrada é onde a promessa
 * é feita, e uma promessa que o produto não cumpre é descoberta pelo usuário —
 * não pelo build.
 */
export const PROVAS: readonly Prova[] = [
  {
    icone: "raio",
    titulo: "Dados em tempo real",
    apoio: "O painel se atualiza sozinho enquanto você olha.",
  },
  {
    icone: "escudo",
    titulo: "Seguro e confiável",
    apoio: "Suas credenciais ficam criptografadas, nunca em texto puro.",
  },
  {
    icone: "alvo",
    titulo: "Decisões mais rápidas",
    apoio: "Regras que pausam e ajustam orçamento sozinhas.",
  },
];

export const RODAPE_SEGURANCA =
  "Suas credenciais são criptografadas e nunca ficam em texto puro.";

/**
 * ⛔ SEM ANO NO COPYRIGHT, e a ausência é a decisão.
 *
 * `new Date().getFullYear()` no servidor devolve o ano em UTC. Renderizado num
 * componente que passa pelo servidor, ele é a mesma armadilha do `elapsed()`:
 * na virada do ano o HTML sai com um ano e o cliente hidrata com outro, e o
 * React aborta a hidratação da árvore — nesta tela, o formulário de login.
 *
 * Um ano fixo no código é a outra metade do problema: ele vira mentira em
 * 1º de janeiro e ninguém revisa rodapé.
 *
 * Sem ano, não há valor que se mexe sozinho nem valor que envelhece.
 */
export const COPYRIGHT = "© TrackHub. Todos os direitos reservados.";

/**
 * A NAVEGAÇÃO DESENHADA NA PRÉVIA DO PRODUTO.
 *
 * 🔴 Estes rótulos são os do `Rail` de verdade, um por um — e isso não é
 * capricho. A referência (imagem 10) desenha `Conversões`, `Relatórios` e
 * `Logs`, que **não existem nesta ferramenta**. Uma prévia com área inventada é
 * a tela de entrada prometendo produto que ninguém construiu: mesma classe do
 * controle inerte, no lugar onde a expectativa é formada.
 *
 * ⚠️ E os rótulos vão EXATOS, sem encurtar. `test:login` confere cada um contra
 * o `Rail.tsx` — encurtar "Gerenciador de Anúncios" para "Gerenciador" faria a
 * guarda reprovar, que é exatamente o que se quer: o dia em que o rail mudar um
 * nome, esta prévia passa a mentir, e a suíte diz onde.
 */
export const NAV_PREVIA: readonly string[] = [
  "Dashboard",
  "Gerenciador de Anúncios",
  "Criativos",
  "Regras",
  "Integrações",
  "UTM & Snippets",
  "Taxas e Despesas",
];
