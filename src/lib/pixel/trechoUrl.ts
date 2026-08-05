/**
 * # O trecho da URL que identifica a página de pagamento
 *
 * Quem tem checkout no próprio domínio precisa dizer **qual endereço** é o de
 * pagamento. O campo é texto livre, e as três formas de errar têm consequências
 * bem diferentes:
 *
 * | O que a pessoa digita | O que acontece hoje |
 * |---|---|
 * | `/checkout` | ✅ certo |
 * | `https://meusite.com/checkout` | funciona por acidente, ou não funciona |
 * | `/` ou `meusite.com` | 🔴 **toda visita vira checkout iniciado** |
 *
 * O terceiro é o caro, e é silencioso: o funil enche de InitiateCheckout, a
 * taxa de conversão despenca, e nada na tela diz que a regra está larga demais.
 *
 * ## ⛔ Vazio NÃO é um caso a tratar aqui — é bloqueio no Salvar
 *
 * `location.href.indexOf("")` é **sempre verdadeiro**. Não existe correção
 * automática possível: sem trecho não há o que comparar. Este módulo classifica;
 * quem recusa é a tela.
 */

export type GrauDoTrecho = "ok" | "corrigido" | "largo" | "vazio";

export interface TrechoAnalisado {
  /** O que deve ser gravado — já normalizado. */
  valor: string;
  grau: GrauDoTrecho;
  /** Frase para a tela, em linguagem de consequência. `null` quando está ok. */
  aviso: string | null;
}

/**
 * Extrai o caminho quando a pessoa cola a URL inteira.
 *
 * ⚠️ Aceitar e corrigir, em vez de recusar. Colar a URL da barra de endereço é
 * o gesto natural de quem está olhando a própria página de checkout — recusar
 * ali transforma um acerto de intenção num erro de formulário.
 */
function caminhoDaUrl(bruto: string): string | null {
  if (!/^https?:\/\//i.test(bruto)) return null;
  try {
    const u = new URL(bruto);
    // A querystring sai: ela muda por visitante (`?produto=x`) e um trecho que
    // a inclua deixaria de casar na visita seguinte.
    const caminho = u.pathname.replace(/\/+$/, "");
    return caminho || "/";
  } catch {
    return null;
  }
}

/**
 * Um trecho é LARGO quando casaria com praticamente qualquer página do site.
 *
 * ⚠️ A checagem é de forma, não de semântica: não tentamos adivinhar se
 * `/p` é largo. `/` casa com tudo por definição; um host sem caminho casa com
 * tudo do próprio site, porque `location.href` sempre contém o próprio host.
 */
function ehLargo(v: string): boolean {
  const t = v.trim().toLowerCase();
  if (t === "/" || t === "*") return true;
  // "meusite.com", "www.meusite.com", "https://meusite.com" (sem caminho).
  const semEsquema = t.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(semEsquema);
}

export function analisarTrecho(bruto: string): TrechoAnalisado {
  const limpo = (bruto ?? "").trim();
  if (!limpo) {
    return {
      valor: "",
      grau: "vazio",
      aviso:
        "Preencha: sem um trecho para comparar, toda visita ao seu site seria contada como checkout iniciado.",
    };
  }

  const doUrl = caminhoDaUrl(limpo);
  const valor = doUrl ?? limpo;

  if (ehLargo(valor)) {
    return {
      valor,
      grau: "largo",
      aviso:
        "Esse trecho casa com qualquer página do seu site — todas as visitas virariam checkout iniciado. " +
        "Use o caminho da página de pagamento, como /checkout.",
    };
  }

  if (doUrl) {
    return {
      valor,
      grau: "corrigido",
      aviso: `Usamos só o caminho: ${doUrl}. O endereço completo mudaria de domínio entre teste e produção.`,
    };
  }

  return { valor, grau: "ok", aviso: null };
}

/** Exemplos reais, para a tela não deixar a pessoa adivinhar o formato. */
export const EXEMPLOS_DE_TRECHO = ["/checkout", "/finalizar", "/pagamento"];
