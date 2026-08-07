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

import { CATALOGO_META, encaixarColunas, encaixarLinhas, reporEstruturais, type MetaBloco } from "../catalogo";

/** O envelope gravado hoje. `v` é o que separa dele do grid antigo. */
export interface LayoutV3 extends LayoutZonas {
  v: 3;
}

/**
 * O envelope da entrega C, com largura por RÓTULO. Ele ainda existe no banco de
 * quem salvou entre 06 e 07/08/2026 — poucos, mas o produto não sabe quantos.
 *
 * ⛔ Não delete este tipo junto com o `Largura`: quem tem um v2 gravado depende
 * dele para não cair no padrão, e cair no padrão é perder o arranjo em silêncio.
 */
interface PainelV2 {
  id: string;
  largura: "um-terco" | "metade" | "cheia";
}
interface LayoutV2 {
  v: 2;
  hero: string[];
  faixa: string[];
  paineis: PainelV2[];
}

function versaoDe(x: unknown): 2 | 3 | null {
  if (!x || typeof x !== "object" || Array.isArray(x)) return null;
  const v = (x as { v?: unknown }).v;
  return v === 3 ? 3 : v === 2 ? 2 : null;
}

/**
 * A largura por rótulo do v2, em colunas de 12.
 *
 * ⚠️ Ela passa pelo `encaixarColunas` do bloco na hora de usar: um `um-terco`
 * gravado para um painel cujo mínimo hoje é 6 tem de virar 6, não 4. O rótulo
 * antigo é a INTENÇÃO do usuário, não uma medida que o produto ainda garante.
 */
const COLUNAS_DO_ROTULO: Record<PainelV2["largura"], number> = {
  "um-terco": 4,
  metade: 6,
  cheia: 12,
};

/**
 * Um layout com marca de versão ainda precisa passar pelas MESMAS regras.
 *
 * ⛔ Não é paranoia: o payload pode ter sido gravado por uma versão anterior do
 * modo de edição, editado à mão, ou conter um bloco que saiu do catálogo depois.
 * **Confiar em `v: 3` para pular a validação é confiar que o passado obedeceu
 * regras que só existem no presente.**
 */
function sanearEnvelope(raw: LayoutV2 | LayoutV3, versao: 2 | 3): LayoutZonas {
  const padrao = layoutPadrao();
  const hero = Array.isArray(raw.hero) ? raw.hero.filter((x) => typeof x === "string").slice(0, 4) : [];
  for (const m of HERO_PADRAO) {
    if (hero.length >= 4) break;
    if (!hero.includes(m)) hero.push(m);
  }
  const faixa = Array.isArray(raw.faixa)
    ? raw.faixa.filter((x) => typeof x === "string" && !hero.includes(x)).slice(0, MAX_FAIXA)
    : padrao.faixa;

  /* 🔴 LISTA VAZIA VÁLIDA ≠ CAMPO CORROMPIDO, e a diferença é uma escolha do
     usuário. No modo de edição ele PODE remover todos os painéis OPCIONAIS; se
     um `paineis: []` legítimo caísse no padrão, a escolha dele seria desfeita em
     silêncio no recarregamento — e ele não teria como saber por quê.

     Só o campo que NÃO É ARRAY cai no padrão: aí não houve escolha, houve
     corrupção. É a mesma distinção de "célula vazia ≠ célula zero", aplicada a
     um array.

     ⚠️ "Vazio" aqui quer dizer sem OPCIONAIS: `reporEstruturais` devolve os
     quatro fixos mesmo para `[]`. Remover todos os opcionais é uma escolha;
     ocultar um estrutural não é uma escolha que o produto ofereça. */
  if (!Array.isArray(raw.paineis)) return { hero, faixa, paineis: padrao.paineis };

  const paineis: LayoutZonas["paineis"] = [];
  for (const p of raw.paineis as ({ id?: unknown } & Partial<PainelV2> & Partial<PainelGrade>)[]) {
    const meta = CATALOGO_META.find((b) => b.id === p?.id);
    if (!meta) continue; // bloco que saiu do catálogo depois de gravado
    if (paineis.some((x) => x.id === meta.id)) continue;
    /* v2 falava por RÓTULO, v3 fala em colunas. O rótulo vira coluna e passa
       pelo mesmo encaixe — um `um-terco` gravado para um bloco cujo mínimo hoje
       é 6 sobe para 6, em vez de nascer num tamanho que o produto recusaria. */
    const colBruta =
      versao === 2
        ? COLUNAS_DO_ROTULO[(p as PainelV2).largura] ?? meta.colPadrao
        : typeof p.col === "number"
          ? p.col
          : meta.colPadrao;
    const linhasBrutas = versao === 2 || typeof p.linhas !== "number" ? undefined : p.linhas;
    paineis.push({
      id: meta.id,
      col: encaixarColunas(colBruta, meta),
      linhas: encaixarLinhas(linhasBrutas, meta),
    });
  }
  return { hero, faixa, paineis: reporEstruturais(paineis) };
}

/** O item do grid antigo, como está gravado no `DashboardLayout.layout`. */
export interface ItemAntigo {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Um painel posicionado na grade de 12 colunas. */
export interface PainelGrade {
  id: string;
  /** Largura em colunas de 12. Nunca abaixo do `colMin` do bloco. */
  col: number;
  /**
   * Altura em linhas — **só nos blocos `alturaAjustavel`**.
   *
   * ⛔ `undefined` não é "não sei": é "a altura é a do CONTEÚDO", que é o padrão
   * do produto. Gravar um número aqui para um bloco sem alça de altura seria dado
   * morto, e o próximo leitor o aplicaria como se fosse escolha do usuário —
   * reservando espaço para dado que não existe.
   */
  linhas?: number;
}

/** O layout novo: três zonas, cada uma com suas regras. */
export interface LayoutZonas {
  /** EXATAMENTE 4 chaves de métrica. Nunca 3, nunca 5. */
  hero: string[];
  /** Até 8 chaves de métrica. */
  faixa: string[];
  /** Painéis, na ORDEM. A posição na linha é consequência da largura de quem
      veio antes — a grade acomoda, e o que não couber desce. */
  paineis: PainelGrade[];
}

export const HERO_PADRAO = ["faturamento", "gasto", "roas", "lucroLiquido"];
export const FAIXA_PADRAO = ["ticket", "ctr", "cpa", "arpu", "margem", "pendentes", "reembolsadas"];
export const MAX_FAIXA = 8;

/**
 * 🔴 O LAYOUT PADRÃO — a ORDEM e a LARGURA de conta nova, aprovadas em
 * 07/08/2026.
 *
 * ### A ordem: dinheiro → por quê → quando/onde → a ferramenta
 *
 * Não é ordem de importância. O rodapé é o bloco menos importante da tela e é o
 * único com largura cheia — porque ele responde outra pergunta ("a ferramenta
 * está funcionando?"), e largura cheia é o que o separa do resto em vez de
 * promovê-lo.
 *
 * ### As oito linhas, e por que cada largura
 *
 * | # | Blocos | col | Por quê |
 * |---|---|---|---|
 * | 1 | Receita×gasto · Alertas | 8+4 | a leitura central e o que exige ação. A série precisa de largura para o eixo; alerta é lista de texto e não ganha nada com ela |
 * | 2 | Funil · Top campanhas | 6+6 | onde perde × quem paga. Metades iguais porque as duas perguntas têm o mesmo peso — e 6 é onde a fita do funil finalmente existe |
 * | 3 | Origem · Produtos · Pagamentos | 4+4+4 | 🔑 **a linha de três.** Mesmo formato (tabela curta com barra atrás do texto) respondendo a mesma pergunta por três dimensões: lê-se em varredura horizontal |
 * | 4 | Quando compram · Taxa de aprovação | 8+4 | o heatmap é o bloco mais faminto de largura da tela (24 colunas de célula); o medidor é o menos. Emparelhá-los é o que põe os dois no tamanho certo |
 * | 5 | Vendas por país · Atividade | 8+4 | 8 é exatamente onde o globo aparece (a container query o esconde abaixo de 640px úteis). Em 6 haveria só o ranking — legítimo, mas o padrão deve mostrar o recurso |
 * | 6 | Vendas por dia · por horário | 6+6 | duas séries de barra na mesma escala de leitura. "Que dia" × "que hora" lado a lado é o uso real |
 * | 7 | Lucro por horário · Posicionamento | 6+6 | o que sobra dos dois formatos, sem nenhum sozinho numa linha de 12 |
 * | 8 | Estado do sistema | 12 | faixa de quatro indicadores, `auto-fit` |
 *
 * ### ⛔ A LINHA 3 EXISTE PARA ENSINAR QUE CABEM TRÊS
 *
 * Com dezesseis blocos, o padrão fácil é uma pilha de largura cheia — e aí
 * ninguém descobre que a grade aceita mais de um por linha. O modo de edição
 * seria um recurso que existe e não é encontrado.
 *
 * ⛔ **Nenhum bloco em 3 colunas, mesmo com sete deles aceitando.** 3 é o piso
 * para quem quer apertar; não é um tamanho que o produto deva sugerir.
 *
 * ⚠️ **Toda linha fecha 12.** Não é estética: o `avisoDeSobra` do modo de edição
 * escreve "N colunas livres" em toda linha incompleta, e um padrão que já nasce
 * com sobra ensina que o aviso é ruído.
 *
 * ### 🔴 A LISTA É EXPLÍCITA, E ANTES ERA DERIVADA DO CATÁLOGO
 *
 * Era `CATALOGO_META.map(b => b.colPadrao)` — a ordem do arquivo virava a ordem
 * da tela, e o arranjo era a soma de dezesseis decisões locais. Nenhuma linha
 * fechava 12 por acidente, e ninguém podia ter escrito o raciocínio acima,
 * porque não existia um lugar onde o arranjo fosse decidido.
 *
 * ⚠️ O preço é que **um bloco novo no catálogo não entra sozinho no padrão** —
 * e isso é bom: uma asserção reprova a divergência, e ela força a pergunta "em
 * que linha ele entra, e o que sai para caber?". Derivar respondia essa pergunta
 * sozinha, sempre com "no fim, largura solta".
 */
const PADRAO_PAINEIS: readonly (readonly [string, number])[] = [
  ["receita-gasto", 8], ["alertas", 4],
  ["funil", 6], ["top-campanhas", 6],
  ["fontes", 4], ["produtos", 4], ["pagamentos", 4],
  ["heatmap", 8], ["aprovacao", 4],
  ["paises", 8], ["atividade", 4],
  ["vendas-por-dia", 6], ["vendas-por-hora", 6],
  ["lucro-por-hora", 6], ["posicionamento", 6],
  ["rodape", 12],
];

/** O padrão do produto — o que toda conta nova vê. */
export function layoutPadrao(): LayoutZonas {
  const paineis: LayoutZonas["paineis"] = [];
  for (const [id, col] of PADRAO_PAINEIS) {
    const meta = CATALOGO_META.find((b) => b.id === id);
    /* Um id que saiu do catálogo é PULADO, não quebra a tela. A asserção do
       teste é quem denuncia a divergência — aqui o pior caso tem de ser uma
       linha a menos, nunca um Dashboard que não carrega. */
    if (!meta) continue;
    paineis.push({
      id,
      /* ⚠️ Passa pelo `encaixarColunas`: a largura escrita acima é uma escolha
         de ARRANJO, e o mínimo do bloco continua mandando. Se alguém baixar uma
         coluna aqui abaixo do `colMin`, ela sobe — em vez de o padrão nascer
         num tamanho que o redimensionamento recusaria. */
      col: encaixarColunas(col, meta),
      /* ⛔ Sem altura: quem não é `alturaAjustavel` não tem `linhas` no layout.
         `encaixarLinhas` devolve `undefined` para eles, e é esse `undefined` que
         faz a grade usar a altura do CONTEÚDO — a correção do esburacado. */
      linhas: encaixarLinhas(undefined, meta),
    });
  }
  return { hero: [...HERO_PADRAO], faixa: [...FAIXA_PADRAO], paineis };
}

/**
 * De `chart:*` antigo para o id do catálogo novo.
 *
 * ⚠️ **Ausente = o bloco não existe mais**, e some — em silêncio, porque avisar
 * "um bloco que você tinha não existe mais" não dá ao usuário nada que ele possa
 * fazer.
 *
 * ### 🔴 TRÊS ENTRADAS VOLTARAM em 07/08/2026, e o comentário daqui PROIBIA isso
 *
 * Ele dizia, em ⛔: *"não 'conserte' acrescentando entradas para os dois
 * primeiros: eles são estruturais, não estão no catálogo, e mapeá-los faria a
 * migração produzir um painel que ninguém sabe desenhar"*.
 *
 * A premissa caiu inteira. `receita-gasto`, `paises` e `posicionamento` **estão
 * no catálogo** e têm render — os dois primeiros porque estrutural passou a
 * significar só "sem ✕", o terceiro porque o bloco foi reconstruído. Com eles
 * mapeados, quem tinha o gráfico de receita na terceira posição volta a vê-lo na
 * terceira posição.
 *
 * ⚠️ É a família do ⛔ que envelhece e vira ordem de reverter: a proibição
 * continuava bem escrita e convincente depois de ter deixado de ser verdade.
 * Ela foi APAGADA, não anotada — o motivo de hoje é o texto acima.
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
  "chart:receita": "receita-gasto",
  "chart:paises": "paises",
  "chart:posicionamento": "posicionamento",
};

/**
 * 🔴 O GRID ANTIGO JÁ ERA DE 12 COLUNAS, e isso torna esta migração quase uma
 * identidade: o `w` gravado É a largura em colunas. O que era perda de
 * informação na entrega C — espremer três rótulos numa fração — deixou de
 * existir, e o arranjo do usuário chega inteiro.
 *
 * ⚠️ O `encaixarColunas` ainda roda por cima, e não é redundância: um `w: 3`
 * gravado para um bloco cujo mínimo hoje é 6 tem de subir. A migração nunca
 * pode produzir um estado que o redimensionamento recusaria.
 */
export function colunasDoGridAntigo(w: number, meta: MetaBloco): number {
  return encaixarColunas(Math.min(COLUNAS_ANTIGAS, Math.max(1, w)), meta);
}

/** O grid antigo tinha 12 colunas no desktop — a mesma contagem de hoje. */
const COLUNAS_ANTIGAS = 12;

/**
 * A altura do grid antigo em linhas da grade nova.
 *
 * ⚠️ As unidades NÃO são as mesmas: a linha do `react-grid-layout` valia ~30px
 * mais margem; a de hoje vale `ALTURA_LINHA` (44px). O fator de 0,75 é o que faz
 * um gráfico de `h: 8` chegar com 6 linhas — a mesma altura na tela, que é o que
 * o usuário reconhece. Converter 1:1 dobraria todo bloco de gráfico.
 *
 * ⚠️ E ela devolve `undefined` para bloco sem `alturaAjustavel`: a altura
 * gravada no grid antigo era do GRID, não uma escolha sobre aquele bloco.
 * Preservá-la reintroduziria o esburacado que a altura por conteúdo resolve.
 */
export function linhasDoGridAntigo(h: number, meta: MetaBloco): number | undefined {
  return encaixarLinhas(h * 0.75, meta);
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

  /* ── FORMA NOVA (v2 e v3) ─────────────────────────────────────────────────
     🔴 O PAYLOAD É VERSIONADO, e não foi capricho: as três zonas NÃO são um
     grid livre, e espremê-las de volta em `{i,x,y,w,h}` para reusar o formato
     antigo perderia informação (qual zona?) e obrigaria a migração a rodar em
     toda leitura de um layout que ela mesma acabou de escrever —
     reinterpretando o próprio resultado, que é onde arranjo salvo vira arranjo
     diferente do salvo.

     ⚠️ O v2 (largura por rótulo) continua sendo lido, e não é zelo excessivo:
     ele foi o formato gravado entre 06 e 07/08/2026. Tratá-lo como
     desconhecido faria quem salvou naquela janela cair no padrão — perder o
     arranjo, em silêncio, por causa de uma decisão nossa. */
  const versao = versaoDe(bruto);
  if (versao) return sanearEnvelope(bruto as LayoutV2 | LayoutV3, versao);

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
      paineis.push({
        id,
        col: colunasDoGridAntigo(it.w, bloco),
        linhas: linhasDoGridAntigo(it.h, bloco),
      });
    }

    /* Layout salvo SÓ com blocos que sumiram: cai no padrão de painéis em vez de
       deixar a zona 3 vazia. Zona vazia parece tela quebrada. */
    return {
      hero,
      faixa: faixa.length > 0 ? faixa : padrao.faixa,
      paineis: paineis.length > 0 ? reporEstruturais(paineis) : padrao.paineis,
    };
  } catch {
    return padrao;
  }
}
