/**
 * # PRECEDÊNCIA DE FONTE — a REGRA 2 do contrato, implementada
 *
 * Campo **derivado** é o que a Trackhub inferiu, não o que o gateway declarou:
 * `country`/`countrySource` e `clickId`/`matchMethod`. Cada um carrega a
 * procedência da inferência, e essa procedência tem força.
 *
 * ## O que isto impede
 *
 * `ingestSale` recalcula o país a cada ingestão, e a 2ª fonte dele é o IP **de
 * dentro do payload**. Quando a Fase A da purga remover o IP dos payloads
 * guardados, reprocessar uma venda com um parser corrigido faria o país
 * recalculado **piorar** — cairia do IP medido (fonte `ip`) para o país do
 * clique (`clique`, estimado) ou para o texto cru. Silenciosamente, num número
 * que continuaria plausível.
 *
 * ## 🐛 E um bug que já existia
 *
 * O upsert fazia `...(match.clickId ? { clickId, matchMethod } : {})`. Isso
 * protege contra apagar com `null`, e **não** contra sobrescrever com fonte mais
 * fraca: se o primeiro evento casou por `direct` (o `click_id` que o nosso
 * script propagou) e o segundo, com payload esparso, casa por `ip` num clique
 * DIFERENTE, o match forte era substituído pelo fraco. A venda passava a apontar
 * para outro visitante — e daí saem país, campanha e atribuição.
 *
 * ## ⛔ Quem decide é o BANCO
 *
 * A força entra no `WHERE` do `UPDATE`, exatamente como a força do status no
 * upsert monotônico. Não é disciplina de quem escreve o parser: é estrutura.
 * Reprocessamento com payload degradado simplesmente **não passa no WHERE**.
 *
 * ## Campo derivado novo
 *
 * Acrescente a fonte na tabela dele. Uma fonte que não esteja aqui vale `0` —
 * o mínimo —, então esquecer de cadastrar **nunca** amplia permissão de escrita.
 * É a mesma regra da autenticação: a dúvida vira bloqueio.
 */

/**
 * De onde saiu o `Sale.country` / `Click.countrySource`.
 *
 * `payload` e `ip` são MEDIDAS — o gateway declarou o país do comprador, ou
 * resolvemos o IP dele. O resto é inferência, e o ranking já as marca com o chip
 * âmbar "estimado".
 */
const FORCA_PAIS: Record<string, number> = {
  payload: 4, // o gateway declarou, em ISO-2
  ip: 4, // IP do comprador, vindo do payload
  campanha: 3, // desempate pela segmentação do conjunto
  carrier: 2,
  clique: 2, // país do clique casado
  idioma: 1,
  locale: 1,
  header: 1,
  payload_cru: 0, // texto livre ("Brasil") — não casa no mapa
  incerto: 0,
};

/**
 * Como o clique de origem foi encontrado.
 *
 * `direct` é o `click_id` que o nosso próprio script propagou até o checkout —
 * identifica a SESSÃO. `fbclid` identifica o clique no anúncio (igualmente
 * exato, mas não prova que o checkout propagou o nosso id). `ip` é inferência
 * frouxa, dentro de uma janela de 12 h.
 */
const FORCA_MATCH: Record<string, number> = {
  direct: 3,
  fbclid: 2,
  ip: 1,
  none: 0,
};

function fontesQuePodemSerSobrescritas(tabela: Record<string, number>, nova: string | null): string[] {
  // Fonte desconhecida vale 0: ela só sobrescreve o que também vale 0.
  const forca = tabela[nova ?? ""] ?? 0;
  return Object.keys(tabela).filter((f) => tabela[f] <= forca);
}

/** Fontes de país que `nova` tem permissão de substituir. */
export function paisesSobrescreviveis(nova: string | null): string[] {
  return fontesQuePodemSerSobrescritas(FORCA_PAIS, nova);
}

/** Métodos de match que `novo` tem permissão de substituir. */
export function matchesSobrescreviveis(novo: string | null): string[] {
  return fontesQuePodemSerSobrescritas(FORCA_MATCH, novo);
}

/** Comparação direta, para testes e para decidir fora de um `WHERE`. */
export function paisEhMelhor(nova: string | null, atual: string | null): boolean {
  return (FORCA_PAIS[nova ?? ""] ?? 0) >= (FORCA_PAIS[atual ?? ""] ?? 0);
}

export function matchEhMelhor(novo: string | null, atual: string | null): boolean {
  return (FORCA_MATCH[novo ?? ""] ?? 0) >= (FORCA_MATCH[atual ?? ""] ?? 0);
}
