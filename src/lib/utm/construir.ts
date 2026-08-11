/**
 * Montagem da URL com parâmetros de rastreamento — FUNÇÃO PURA.
 *
 * > ### ⛔ A URL NÃO É CONCATENADA NO JSX. NUNCA.
 * >
 * > Foi assim que nasceu o `[object Object]` que esta base carregou desde antes
 * > do redesign: um valor que não era string caiu num template literal e virou
 * > texto dentro de uma URL que o usuário copiou e colou num anúncio.
 * >
 * > ⚠️ O gerador antigo já não existe — ele saiu na faxina de 05/08/2026, junto
 * > do nav morto do `useTraffikState`. Então este arquivo **previne**, não
 * > conserta. É de propósito: o defeito voltaria no primeiro campo novo.
 *
 * ## Por que o guarda é de RUNTIME e não de tipo
 *
 * `tsc` não vê o valor atravessando a fronteira: ele vem de estado de
 * formulário, de um modelo salvo, de um `JSON.parse`. Nos três o tipo declarado
 * é uma promessa, não uma medição. `valorDeTexto()` é quem mede — e o teste
 * dela passa um objeto, para ela **disparar** pelo motivo que alega existir.
 */

/** Os seis parâmetros, na ordem canônica em que a URL os escreve. */
export const CHAVES_UTM = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
] as const;

export type ChaveUtm = (typeof CHAVES_UTM)[number];

/** O que o formulário entrega. `unknown` porque é isso que ele é de fato. */
export type EntradaUtm = {
  /** A URL de destino, sem parâmetros nossos. */
  base?: unknown;
} & Partial<Record<ChaveUtm, unknown>>;

export interface ParametroMontado {
  chave: ChaveUtm;
  /** O valor como o usuário digitou — é o que o chip mostra. */
  valor: string;
  /** O valor como ele entra na URL. Difere quando há espaço, acento ou `&`. */
  codificado: string;
}

export type EstadoDaUrl = "valida" | "incompleta" | "invalida";

export interface UrlMontada {
  /** A URL final. Vazia quando não há base utilizável — nunca uma URL pela metade. */
  url: string;
  parametros: ParametroMontado[];
  estado: EstadoDaUrl;
  /**
   * O que impede a URL de ficar `valida`, em linguagem de consequência.
   * Vazio quando `valida`.
   */
  problemas: string[];
  /**
   * Valores DESCARTADOS por não serem texto — o guarda do `[object Object]`.
   * Não vazio é defeito de quem chamou, e a tela o denuncia em vez de engolir.
   */
  descartados: ChaveUtm[];
}

/**
 * Devolve a string útil de um valor, ou `null`.
 *
 * ⛔ Não use `String(v)`, que é exatamente a linha que produz `[object Object]`.
 * Aqui o que não é string **não vira** string: ele sai da URL e é reportado.
 */
export function valorDeTexto(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const limpo = v.trim();
  return limpo.length > 0 ? limpo : null;
}

/**
 * Parte a base em `antes do #` e `o # e o resto`.
 *
 * 🔴 Sem isto os parâmetros entram DENTRO do fragmento (`/p#secao?utm_source=fb`)
 * e o servidor nunca os vê — o fragmento não sai do navegador. A URL fica com
 * cara de certa, o anúncio roda, e a atribuição não acontece. É o modo de falha
 * mais caro possível numa tela cujo produto é um texto para colar em outro lugar.
 */
function separarFragmento(base: string): { corpo: string; fragmento: string } {
  const i = base.indexOf("#");
  if (i < 0) return { corpo: base, fragmento: "" };
  return { corpo: base.slice(0, i), fragmento: base.slice(i) };
}

/** `https:` e `http:` e mais nada. `javascript:` numa URL copiada é grave. */
function baseUtilizavel(base: string): boolean {
  try {
    const u = new URL(base);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Monta a URL final.
 *
 * ⚠️ **Parâmetro que já existe na base é SUBSTITUÍDO, não duplicado.** Colar uma
 * URL que já tem `utm_source` e gerar outra produziria dois `utm_source`, e qual
 * deles vence depende do gateway — ou seja, a atribuição passaria a depender de
 * um detalhe que ninguém controla.
 */
export function montarUrl(entrada: EntradaUtm): UrlMontada {
  const parametros: ParametroMontado[] = [];
  const descartados: ChaveUtm[] = [];

  for (const chave of CHAVES_UTM) {
    const bruto = entrada[chave];
    // `undefined`/`null` é campo vazio — ausência normal, não descarte.
    if (bruto === undefined || bruto === null) continue;
    const valor = valorDeTexto(bruto);
    if (valor === null) {
      // String vazia é campo em branco; qualquer OUTRA coisa é o defeito.
      if (typeof bruto !== "string") descartados.push(chave);
      continue;
    }
    parametros.push({ chave, valor, codificado: encodeURIComponent(valor) });
  }

  const problemas: string[] = [];
  const base = valorDeTexto(entrada.base);

  if (base === null) {
    problemas.push("Falta o endereço de destino.");
  } else if (!baseUtilizavel(base)) {
    problemas.push("O endereço precisa começar com https:// ou http://.");
  }
  if (parametros.length === 0) {
    problemas.push("Nenhum parâmetro preenchido — a URL sairia igual à original.");
  }
  for (const c of descartados) {
    problemas.push(`O campo ${c} não é texto e foi descartado.`);
  }

  // Sem base utilizável não existe URL parcial: devolver meia URL é oferecer
  // para copiar algo que não funciona.
  if (base === null || !baseUtilizavel(base)) {
    return {
      url: "",
      parametros,
      estado: base === null ? "incompleta" : "invalida",
      problemas,
      descartados,
    };
  }

  const { corpo, fragmento } = separarFragmento(base);
  const [caminho, buscaCrua = ""] = corpo.split("?");
  const busca = new URLSearchParams(buscaCrua);
  for (const p of parametros) busca.set(p.chave, p.valor);

  const qs = busca.toString();
  const url = `${caminho}${qs ? `?${qs}` : ""}${fragmento}`;

  return {
    url,
    parametros,
    estado: descartados.length > 0 ? "invalida" : parametros.length > 0 ? "valida" : "incompleta",
    problemas,
    descartados,
  };
}

/** Rótulo humano de cada parâmetro — o que o formulário mostra. */
export const ROTULO_UTM: Record<ChaveUtm, string> = {
  utm_source: "Fonte",
  utm_medium: "Mídia",
  utm_campaign: "Campanha",
  utm_term: "Termo",
  utm_content: "Conteúdo",
  utm_id: "ID da campanha",
};

/**
 * O exemplo de cada campo — texto próprio, não fatiado da ajuda.
 *
 * 🐛 A primeira versão derivava isto de `AJUDA_UTM` com `split(": ")[1]`, e na
 * tela **quatro dos seis campos mostraram `Ex:` e mais nada**: as frases de
 * ajuda não têm todas a mesma forma, então a fatia devolvia `undefined`.
 *
 * ⛔ Derivar um texto de outro por cirurgia de string é o oposto de "documentação
 * que LÊ o valor": não é a mesma informação em dois lugares, é uma informação
 * DIFERENTE arrancada de uma frase que ninguém escreveu para isso. `tsc` e lint
 * passaram; só a tela mostrou.
 */
export const EXEMPLO_UTM: Record<ChaveUtm, string> = {
  utm_source: "facebook",
  utm_medium: "cpc",
  utm_campaign: "lancamento-pro",
  utm_term: "curso-trafego",
  utm_content: "criativo-a",
  utm_id: "12020783847",
};

/** O que cada parâmetro responde, na voz de quem compra tráfego. */
export const AJUDA_UTM: Record<ChaveUtm, string> = {
  utm_source: "De onde veio a visita: facebook, google, tiktok.",
  utm_medium: "Como ela foi paga: cpc, organico, email.",
  utm_campaign: "O nome da campanha, como você a chama.",
  utm_term: "A palavra-chave, quando houver.",
  utm_content: "Qual criativo ou variação trouxe o clique.",
  utm_id: "O ID numérico da campanha na plataforma.",
};
