/**
 * MIGRAÇÃO do layout salvo — do grid antigo para as três zonas.
 *
 * 🔴 POR QUE ELA EXISTE, E O QUE ACONTECE SEM ELA
 *
 * A reescrita do Dashboard (06/08/2026) trocou um grid arrastável de 12 colunas
 * por três zonas com regras. **Quem tinha layout customizado perdeu a
 * customização** — o `DashboardLayout` continua no banco, com `chart:funil` e
 * `kpi:roas` que a tela nova não conhece.
 *
 * Sem migração, esse usuário tem duas saídas ruins: vê o padrão (perdeu o
 * arranjo) ou vê uma tela quebrada. Com ela, vê o dele.
 *
 * ⛔ **É pura, sem React e sem Prisma, de propósito.** Migração é a peça que não
 * pode falhar em produção e é a mais difícil de exercitar na tela — precisa ser
 * testável com um layout literal em mãos.
 *
 * ### As três guardas, e cada uma tem caso no teste
 *
 * A regra do projeto: *guarda que nunca disparou não é guarda*. As três aqui
 * são exercitadas uma vez cada em `npm run test:migrar-layout`:
 *
 *   1. **sem layout salvo** → devolve o padrão, sem tentar migrar `null`;
 *   2. **layout válido** → migra, e nenhum bloco que ainda existe se perde;
 *   3. **bloco que não existe mais** → descartado em SILÊNCIO, sem quebrar.
 *
 * ⚠️ O silêncio do caso 3 é decisão: `chart:posicionamento` sumiu do produto, e
 * avisar "um bloco que você tinha não existe mais" não dá ao usuário nada que
 * ele possa fazer. Barulho sem ação é ruído.
 */

import { CATALOGO_META, type Largura } from "../catalogo";

/** O item do grid antigo, como está gravado no `DashboardLayout.layout`. */
export interface ItemAntigo {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** O layout novo: três zonas, cada uma com suas regras. */
export interface LayoutZonas {
  /** EXATAMENTE 4 chaves de métrica. Nunca 3, nunca 5. */
  hero: string[];
  /** Até 8 chaves de métrica. */
  faixa: string[];
  /** Painéis, na ordem, com a largura escolhida entre as permitidas do bloco. */
  paineis: { id: string; largura: Largura }[];
}

export const HERO_PADRAO = ["faturamento", "gasto", "roas", "lucroLiquido"];
export const FAIXA_PADRAO = ["ticket", "ctr", "cpa", "arpu", "margem", "pendentes", "reembolsadas"];
export const MAX_FAIXA = 8;

/** O padrão do produto — o que toda conta nova vê. */
export function layoutPadrao(): LayoutZonas {
  return {
    hero: [...HERO_PADRAO],
    faixa: [...FAIXA_PADRAO],
    paineis: CATALOGO_META.filter((b) => b.zona === "paineis").map((b) => ({
      id: b.id,
      largura: b.larguraPadrao,
    })),
  };
}

/**
 * De `chart:*` antigo para o id do catálogo novo.
 *
 * ⚠️ **Ausente = o bloco não existe mais**, e some. Os quatro que somem, e por
 * quê:
 *
 * | Antigo | Destino |
 * |---|---|
 * | `chart:receita` | virou o Receita × Gasto FIXO do Dashboard — bloco estrutural |
 * | `chart:paises` | virou o Vendas por país FIXO |
 * | `chart:posicionamento` | **não existe mais no produto** |
 *
 * ⛔ Não "conserte" acrescentando entradas para os dois primeiros: eles são
 * estruturais, não estão no catálogo, e mapeá-los faria a migração produzir um
 * painel que ninguém sabe desenhar.
 */
const DE_PARA: Record<string, string> = {
  "chart:funil": "funil",
  "chart:fontes": "fontes",
  "chart:produtos": "produtos",
  "chart:pagamentos": "pagamentos",
  "chart:vendasDia": "vendas-por-dia",
  "chart:vendasHora": "vendas-por-hora",
  "chart:lucroHora": "lucro-por-hora",
  "chart:aprovacao": "aprovacao",
  "chart:feed": "atividade",
};

/**
 * A largura do grid antigo (em colunas de 12) vira a largura permitida mais
 * PRÓXIMA entre as que o bloco aceita.
 *
 * ⚠️ "Mais próxima entre as DELE", não a mais próxima em absoluto: se o bloco só
 * aceita `um-terco` e `metade`, um item que ocupava 12 colunas vira `metade`, não
 * `cheia`. É o que impede a migração de produzir um layout que o modo de edição
 * recusaria.
 */
export function larguraMaisProxima(colunas: number, permitidas: Largura[]): Largura {
  const fracao = Math.min(1, Math.max(0, colunas / 12));
  const valor: Record<Largura, number> = { "um-terco": 1 / 3, metade: 1 / 2, cheia: 1 };
  let melhor = permitidas[0] ?? "um-terco";
  let dist = Infinity;
  for (const p of permitidas) {
    const d = Math.abs(valor[p] - fracao);
    if (d < dist) {
      dist = d;
      melhor = p;
    }
  }
  return melhor;
}

/**
 * Migra um layout antigo. **Nunca lança** — layout corrompido cai no padrão.
 *
 * ⛔ O `try` não é preguiça: este código roda no carregamento do Dashboard, e um
 * `Json` malformado no banco (edição manual, migração parcial, versão futura)
 * não pode deixar o usuário sem tela. O padrão é sempre uma resposta válida.
 */
export function migrarLayout(bruto: unknown): LayoutZonas {
  const padrao = layoutPadrao();
  if (!Array.isArray(bruto) || bruto.length === 0) return padrao;

  try {
    const itens = bruto.filter(
      (x): x is ItemAntigo =>
        !!x && typeof x === "object" && typeof (x as ItemAntigo).i === "string" && typeof (x as ItemAntigo).y === "number",
    );
    if (itens.length === 0) return padrao;

    /* A ORDEM DE LEITURA do grid antigo é de cima para baixo, e da esquerda para
       a direita dentro da linha. É assim que o usuário via, então é assim que a
       lista linear tem de sair — ordenar só por `y` embaralharia a linha. */
    const ordenados = [...itens].sort((a, b) => a.y - b.y || a.x - b.x);

    /* ── Métricas ────────────────────────────────────────────────────────── */
    const metricas = ordenados.filter((it) => it.i.startsWith("kpi:")).map((it) => it.i.slice(4));

    /* ⛔ HERO TEM EXATAMENTE 4. Se o usuário tinha menos, completa com o padrão
       — na ordem do padrão, e sem repetir o que ele já escolheu. Um hero com 3
       quebra a fileira, e é o estado que o modo de edição proíbe: ele não pode
       nascer da migração. */
    const hero = metricas.slice(0, 4);
    for (const m of HERO_PADRAO) {
      if (hero.length >= 4) break;
      if (!hero.includes(m)) hero.push(m);
    }

    /* O resto vai para a faixa, respeitando o teto. O que passar de 8 é
       descartado — em silêncio, pelo mesmo motivo do bloco inexistente. */
    const faixa = metricas.slice(4).filter((m) => !hero.includes(m)).slice(0, MAX_FAIXA);

    /* ── Painéis ─────────────────────────────────────────────────────────── */
    const paineis: LayoutZonas["paineis"] = [];
    for (const it of ordenados) {
      const id = DE_PARA[it.i];
      if (!id) continue; // ← a guarda do bloco que não existe mais
      const bloco = CATALOGO_META.find((b) => b.id === id);
      /* Cinto e suspensório: o `DE_PARA` pode apontar para um id que saiu do
         catálogo depois. Sem isto a migração produziria um painel órfão. */
      if (!bloco) continue;
      if (paineis.some((p) => p.id === id)) continue; // duplicata no salvo
      paineis.push({ id, largura: larguraMaisProxima(it.w, [...bloco.larguras]) });
    }

    /* Layout salvo SÓ com blocos que sumiram: cai no padrão de painéis em vez de
       deixar a zona 3 vazia. Zona vazia parece tela quebrada. */
    return {
      hero,
      faixa: faixa.length > 0 ? faixa : padrao.faixa,
      paineis: paineis.length > 0 ? paineis : padrao.paineis,
    };
  } catch {
    return padrao;
  }
}
