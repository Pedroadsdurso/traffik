import { isObj, type Json } from "./campos";
import type { Capacidades, GatewayDef, VendaNormalizada } from "./contrato";
import { gatewayPorId, REGISTRO } from "./registro";

/**
 * # TESTADOR DE PAYLOAD — validar um gateway ANTES de ter conta nele
 *
 * Cola-se o JSON da documentação (ou um payload real capturado) e ele mostra o
 * que o parser extraiu, o que ficou vazio **e por quê**.
 *
 * ## Por que "por quê" é a parte que importa
 *
 * Um campo vazio tem duas causas completamente diferentes, e confundi-las é o
 * que faz uma integração nascer torta:
 *
 * | Causa | O que fazer |
 * |---|---|
 * | **O gateway não enviou** | nada — é uma capacidade que ele não tem |
 * | **Enviou com outro nome e o parser não leu** | 🔴 corrigir o parser |
 *
 * O segundo caso é invisível numa inspeção normal: o campo aparece vazio, o
 * payload parece completo, e ninguém liga um ao outro. Por isso o testador
 * **varre o payload procurando chaves parecidas** com cada campo do formato
 * interno e denuncia quando acha uma que o parser ignorou.
 *
 * ## Não toca em nada
 *
 * É leitura pura: nenhum banco, nenhuma requisição, nenhuma venda criada.
 */

/** Como um campo do formato interno terminou. */
export type EstadoDoCampo =
  /** O parser leu um valor. */
  | "lido"
  /** O gateway não mandou — e não há nada parecido no payload. */
  | "ausente"
  /** 🔴 Existe algo parecido no payload que o parser NÃO leu. */
  | "nao_mapeado";

export interface CampoDiagnosticado {
  campo: string;
  rotulo: string;
  valor: string | null;
  estado: EstadoDoCampo;
  /** Onde o valor parecido foi encontrado, quando `nao_mapeado`. */
  chaveNoPayload?: string;
}

export interface VendaDiagnosticada {
  indice: number;
  pedidoId: string | null;
  itemTipo: string;
  status: string;
  campos: CampoDiagnosticado[];
}

export interface Diagnostico {
  gateway: { id: string; nome: string };
  ok: boolean;
  erro?: string;
  /** `data` veio como objeto ou lista? */
  forma: "objeto" | "lista" | "ausente";
  itens: number;
  /** Conversões: itens distintos por `pedidoId`. */
  pedidos: number;
  vendas: VendaDiagnosticada[];
  /** Avisos do parser: evento desconhecido, comissão de tipo novo… */
  avisos: string[];
  /** O que o registro DECLARA × o que este payload REALMENTE trouxe. */
  capacidades: {
    nome: string;
    declarada: boolean;
    observada: boolean;
    /** Declarada e não observada, ou o contrário — merece o olho do usuário. */
    divergente: boolean;
  }[];
}

/**
 * Cada campo do formato interno, com o rótulo da tela e um padrão para procurar
 * um equivalente no payload.
 *
 * ⚠️ O padrão é DELIBERADAMENTE frouxo: ele existe para levantar suspeita, não
 * para afirmar. Um falso positivo custa uma olhada; um falso negativo esconde
 * um campo que o gateway manda e a gente joga fora.
 */
const CAMPOS: { campo: keyof VendaNormalizada; rotulo: string; padrao?: RegExp }[] = [
  { campo: "externalId", rotulo: "Id da venda no gateway", padrao: /^(id|order_?id|sale_?id|transaction)/i },
  { campo: "pedidoId", rotulo: "Agrupador do checkout", padrao: /checkout|cart|pedido/i },
  { campo: "itemTipo", rotulo: "Tipo do item" },
  { campo: "valor", rotulo: "Valor pago", padrao: /^(amount|value|total|price|valor)/i },
  { campo: "valorBruto", rotulo: "Valor antes do desconto", padrao: /base_?amount|gross|bruto/i },
  { campo: "desconto", rotulo: "Desconto", padrao: /discount|desconto|cupom|coupon/i },
  { campo: "moeda", rotulo: "Moeda", padrao: /currency|moeda/i },
  { campo: "produto", rotulo: "Produto", padrao: /product|produto|offer|plan/i },
  { campo: "produtoId", rotulo: "Id do produto" },
  { campo: "status", rotulo: "Status" },
  { campo: "formaDePagamento", rotulo: "Forma de pagamento", padrao: /payment|pagamento|method/i },
  { campo: "email", rotulo: "E-mail do comprador", padrao: /e?mail/i },
  { campo: "nome", rotulo: "Nome do comprador", padrao: /name|nome/i },
  { campo: "telefone", rotulo: "Telefone", padrao: /phone|fone|tel|whats/i },
  { campo: "documento", rotulo: "Documento", padrao: /doc|cpf|cnpj|tax_?id/i },
  { campo: "pais", rotulo: "País do comprador", padrao: /country|pais|nation/i },
  { campo: "ipDoComprador", rotulo: "IP do comprador", padrao: /(^|_)ip($|_|addr)/i },
  { campo: "clickId", rotulo: "click_id da Trackhub", padrao: /click/i },
  { campo: "fbc", rotulo: "Cookie _fbc (Meta)", padrao: /fbc|fbclid/i },
  { campo: "fbp", rotulo: "Cookie _fbp (Meta)", padrao: /fbp/i },
  { campo: "taxaGateway", rotulo: "Taxa do gateway", padrao: /fee|tax(a|es)|comiss/i },
  { campo: "comissoes", rotulo: "Comissões", padrao: /commission|comiss|afili|coprodu/i },
];

/** Achata o payload em `caminho → valor`, para a varredura por chave. */
function achatar(v: unknown, prefixo = "", saida: Map<string, unknown> = new Map()): Map<string, unknown> {
  if (Array.isArray(v)) {
    v.forEach((item, i) => achatar(item, `${prefixo}[${i}]`, saida));
  } else if (isObj(v)) {
    for (const [k, val] of Object.entries(v)) {
      const caminho = prefixo ? `${prefixo}.${k}` : k;
      if (isObj(val) || Array.isArray(val)) achatar(val, caminho, saida);
      else saida.set(caminho, val);
    }
  }
  return saida;
}

const temValor = (v: unknown) => v !== undefined && v !== null && v !== "";

function comoTexto(v: unknown): string | null {
  if (!temValor(v)) return null;
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Um campo do formato interno está de fato preenchido? */
function foiLido(campo: keyof VendaNormalizada, venda: VendaNormalizada): boolean {
  const v = venda[campo];
  if (campo === "utm") return isObj(v) && Object.values(v).some(temValor);
  if (campo === "itemTipo" || campo === "status" || campo === "moeda") return true; // sempre têm valor
  return temValor(v);
}

function diagnosticarVenda(venda: VendaNormalizada, item: Json, indice: number): VendaDiagnosticada {
  const plano = achatar(item);
  const campos: CampoDiagnosticado[] = [];

  for (const { campo, rotulo, padrao } of CAMPOS) {
    const lido = foiLido(campo, venda);
    if (lido) {
      campos.push({ campo, rotulo, valor: comoTexto(venda[campo]), estado: "lido" });
      continue;
    }
    // Vazio: o gateway não mandou, ou mandou com um nome que não lemos?
    let chaveNoPayload: string | undefined;
    if (padrao) {
      for (const [caminho, valor] of plano) {
        const folha = caminho.split(".").pop() ?? caminho;
        if (padrao.test(folha) && temValor(valor)) {
          chaveNoPayload = `${caminho} = ${JSON.stringify(valor)}`.slice(0, 120);
          break;
        }
      }
    }
    campos.push({
      campo,
      rotulo,
      valor: null,
      estado: chaveNoPayload ? "nao_mapeado" : "ausente",
      chaveNoPayload,
    });
  }

  return {
    indice,
    pedidoId: venda.pedidoId,
    itemTipo: venda.itemTipo,
    status: venda.status,
    campos,
  };
}

/** O que ESTE payload realmente trouxe, para comparar com o que o registro diz. */
function capacidadesObservadas(vendas: VendaNormalizada[]): Partial<Record<keyof Capacidades, boolean>> {
  const algum = (fn: (v: VendaNormalizada) => boolean) => vendas.some(fn);
  return {
    ipDoComprador: algum((v) => temValor(v.ipDoComprador)),
    fbc: algum((v) => temValor(v.fbc)),
    fbp: algum((v) => temValor(v.fbp)),
    utms: algum((v) => Boolean(v.utm) && Object.values(v.utm!).some(temValor)),
    taxasCalculadas: algum((v) => v.taxaGateway != null),
    comissoes: algum((v) => v.comissoes != null),
    agrupaItens: new Set(vendas.map((v) => v.pedidoId)).size < vendas.length,
  };
}

const ROTULO_CAPACIDADE: Record<string, string> = {
  ipDoComprador: "Envia o IP do comprador",
  fbc: "Envia o cookie _fbc",
  fbp: "Envia o cookie _fbp",
  utms: "Envia os UTMs",
  taxasCalculadas: "Envia a taxa já calculada",
  comissoes: "Envia comissões",
  agrupaItens: "Agrupa itens do mesmo checkout",
};

/**
 * Analisa um payload contra o parser de um gateway.
 *
 * @param gatewayId id do registro (`CAKTO`, `KIRVANO`…)
 * @param payload   JSON já parseado
 */
export function analisarPayload(gatewayId: string, payload: unknown): Diagnostico {
  const def: GatewayDef | null = gatewayPorId(gatewayId);
  if (!def) {
    return {
      gateway: { id: gatewayId, nome: gatewayId },
      ok: false,
      erro: `Gateway "${gatewayId}" não existe no registro.`,
      forma: "ausente",
      itens: 0,
      pedidos: 0,
      vendas: [],
      avisos: [],
      capacidades: [],
    };
  }

  const base = { gateway: { id: def.id, nome: def.nome } };

  let resultado;
  try {
    resultado = def.parse(payload);
  } catch (e) {
    return {
      ...base,
      ok: false,
      erro: e instanceof Error ? e.message : "O parser lançou um erro.",
      forma: "ausente",
      itens: 0,
      pedidos: 0,
      vendas: [],
      avisos: [],
      capacidades: [],
    };
  }

  // A forma do `data` é o que diferencia disparo individual de agrupado — e é
  // exatamente onde um parser que assume objeto quebra em silêncio.
  const bruto = isObj(payload) ? payload["data"] : undefined;
  const forma: Diagnostico["forma"] = Array.isArray(bruto) ? "lista" : isObj(bruto) ? "objeto" : "ausente";

  const itensBrutos = Array.isArray(bruto) ? bruto.filter(isObj) : isObj(bruto) ? [bruto] : [];

  const observadas = capacidadesObservadas(resultado.vendas);
  const capacidades = Object.entries(ROTULO_CAPACIDADE).map(([chave, nome]) => {
    const declarada = Boolean(def.capacidades[chave as keyof Capacidades]);
    const observada = Boolean(observadas[chave as keyof Capacidades]);
    return {
      nome,
      declarada,
      observada,
      // ⚠️ "Declarada e não observada" pode ser só um payload de exemplo sem o
      // campo. "Observada e NÃO declarada" é sempre um erro do registro — o
      // gateway manda algo que a tela vai dizer que ele não manda.
      divergente: declarada !== observada,
    };
  });

  return {
    ...base,
    ok: resultado.vendas.length > 0,
    erro: resultado.ignorado,
    forma,
    itens: resultado.vendas.length,
    pedidos: new Set(resultado.vendas.map((v, i) => v.pedidoId ?? `#${i}`)).size,
    vendas: resultado.vendas.map((v, i) =>
      diagnosticarVenda(v, (itensBrutos[i] as Json) ?? (isObj(payload) ? payload : {}), i),
    ),
    avisos: resultado.avisos ?? [],
    capacidades,
  };
}

/** Os gateways que o testador oferece, com os exemplos de cada um. */
export function gatewaysComExemplo(): { id: string; nome: string; exemplos: { nome: string }[] }[] {
  return Object.values(REGISTRO)
    .filter((def) => def.ativo)
    .map((def) => ({
      id: def.id,
      nome: def.nome,
      exemplos: (def.exemplos ?? []).map((e) => ({ nome: e.nome })),
    }));
}

/** O payload de exemplo `indice` do gateway, já pronto para colar no campo. */
export function exemploDoGateway(gatewayId: string, indice: number): string | null {
  const def = gatewayPorId(gatewayId);
  const ex = def?.exemplos?.[indice];
  return ex ? JSON.stringify(ex.payload, null, 2) : null;
}
