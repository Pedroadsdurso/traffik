/**
 * # Nome de exibição das fontes de tráfego
 *
 * O `utm_source` que os nossos códigos emitem é **`FB`** — e "FB" não é o nome
 * de nada há anos. Na tela isso aparece num donut de "Vendas por fonte" e no
 * filtro do topo, ao lado de valores que o usuário escreveu à mão.
 *
 * ## ⛔ Isto é TRADUÇÃO DE EXIBIÇÃO. O valor gravado NÃO muda.
 *
 * A tentação óbvia é trocar `utm_source=FB` por `utm_source=Meta Ads` no
 * gerador de códigos. Seria errado por duas razões, e a segunda é permanente:
 *
 * 1. **Partiria a dimensão em duas.** Clique antigo com `FB` e clique novo com
 *    `Meta Ads` virariam duas fatias no mesmo donut, somando a mesma coisa —
 *    e ninguém entenderia por quê.
 * 2. **Nenhum identificador já emitido muda de significado.** É a regra que
 *    garante que script e webhook instalados nunca param de reportar. O `FB`
 *    está colado no painel da Hotmart e da Cartpanda de todo mundo que já
 *    gerou os códigos; ele continua sendo `FB` para sempre.
 *
 * Por isso a troca vive aqui, na leitura, e vale **retroativamente para todo o
 * histórico** — que é justamente o que uma migração de dados não conseguiria
 * dar sem reescrever o passado.
 *
 * ⚠️ Comparação **sem diferenciar maiúsculas**: o usuário pode ter digitado
 * `fb` num link feito à mão, e é a mesma fonte.
 */
const NOMES: Record<string, string> = {
  fb: "Meta Ads",
  facebook: "Meta Ads",
  meta: "Meta Ads",
  ig: "Meta Ads",
  instagram: "Meta Ads",
  // Os demais aparecem como o usuário escreveu — ver a nota abaixo.
  google: "Google Ads",
  adwords: "Google Ads",
  gads: "Google Ads",
  tiktok: "TikTok Ads",
  ttk: "TikTok Ads",
  kwai: "Kwai Ads",
  yt: "YouTube",
  youtube: "YouTube",
};

/**
 * Nome legível de uma fonte de tráfego.
 *
 * ⛔ Fonte desconhecida volta **exatamente como veio**, nunca "Outro". O
 * `utm_source` é texto livre e quase sempre foi escrito pelo próprio usuário:
 * agrupar o que não reconhecemos num balde apagaria o nome que ele escolheu, e
 * ele procuraria na tela um valor que não está mais lá. Mesma regra do
 * `effective_status` que a Meta acrescenta sem avisar.
 */
export function nomeDaFonte(bruto: string | null | undefined): string {
  if (!bruto) return "Direto / Orgânico";
  const limpo = bruto.trim();
  if (!limpo) return "Direto / Orgânico";
  return NOMES[limpo.toLowerCase()] ?? limpo;
}

/** O nome de exibição da Meta. Uma constante porque DOIS lugares a comparam. */
export const NOME_META = "Meta Ads";

/**
 * A sessão veio de um anúncio da Meta?
 *
 * ## 🔴 Por que ela existe, e por que DERIVA de `nomeDaFonte`
 *
 * A faixa de cobertura do funil divide sessões por `DailyAdMetric.clicks`, que
 * é **só da Meta**. Enquanto o numerador era `Click.length` inteiro, a razão
 * somava tráfego que não pode existir no denominador: medido no dev em
 * 13/08/2026, **20 das 57 sessões (35%)** vinham de `google`, `organico` e
 * `tiktok`. A razão não era uma taxa ruim — era uma taxa **sem intervalo
 * válido**, porque o numerador não é subconjunto do denominador.
 *
 * ⛔ **Não escreva uma segunda lista de aliases aqui.** `fb`, `facebook`,
 * `meta`, `ig` e `instagram` já vivem em `NOMES`, e duas listas divergem no
 * primeiro alias que alguém acrescentar de um lado só — com o defeito mudo, do
 * jeito que esta base já pagou. Esta função **lê** o mapa; ela não o copia.
 */
export function ehFonteMeta(bruto: string | null | undefined): boolean {
  return nomeDaFonte(bruto) === NOME_META;
}
