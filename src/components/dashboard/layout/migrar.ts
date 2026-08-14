/**
 * MIGRAÇÃO do layout salvo — de tudo que já existiu para a GRADE ÚNICA.
 *
 * 🔴 POR QUE ELA EXISTE, E O QUE ACONTECE SEM ELA
 *
 * O layout do Dashboard já teve quatro contratos, e cada um deixou envelopes
 * gravados em contas de verdade:
 *
 * | | O que era |
 * |---|---|
 * | **v1** | o grid de `react-grid-layout`: `{i,x,y,w,h}`, com `kpi:*` e `chart:*` |
 * | **v2** | três zonas, largura por RÓTULO (`um-terco`/`metade`/`cheia`) |
 * | **v3** | três zonas, largura em colunas de 12, altura em `linhas` de 44px |
 * | **v4** | três zonas, altura em CÉLULAS de 96px (a F1) |
 * | **v5** | 🔑 **uma grade só** — métrica e painel no mesmo `blocos` (a F5) |
 *
 * Sem migração, quem tem qualquer um dos quatro primeiros tem duas saídas ruins:
 * vê o padrão (perdeu o arranjo) ou vê uma tela quebrada.
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
 * ⚠️ O silêncio do caso 3 é decisão: um bloco que sumiu do produto não dá ao
 * usuário nada que ele possa fazer. Barulho sem ação é ruído.
 */

import {
  ALTURA_LINHA_ANTIGA,
  CATALOGO_META,
  COLUNAS_GRADE,
  celulasDePx,
  encaixarAltura,
  encaixarColunas,
  ehBlocoDeMetrica,
  reporEstruturais,
  type MetaBloco,
} from "../catalogo";
import { idDaMetrica, metaDaMetrica, type ChaveDeMetrica } from "../metricas";

/* ⛔ AS CONSTANTES VÊM ANTES DE QUEM AS USA.
   As três estavam declaradas depois das funções que as consomem — `const` em
   zona morta temporal. Aqui não estourava porque o uso está dentro de função,
   que só roda depois do módulo carregar; mas a proteção era acidental, e some
   no dia em que alguém calcular um valor no corpo do módulo. */

/**
 * As quatro métricas que o layout padrão põe em destaque, e as que o envelope
 * antigo completava quando o `hero` salvo tinha menos de quatro.
 *
 * ⚠️ **`hero` era uma REGRA e virou um PADRÃO.** Até o v4 a zona Principais
 * tinha exatamente quatro vagas, e a migração completava o que faltasse porque
 * um hero com 3 quebrava a fileira. Com a grade única não há vaga nem fileira: o
 * usuário pode ter uma métrica ou quinze, do tamanho que quiser.
 *
 * ⛔ A completude continua acontecendo **na leitura de um envelope de zonas**, e
 * isso não é resíduo: ela descreve o que aquele envelope DESENHAVA. Um v4 com
 * `hero: ["roas", "cpa"]` mostrava quatro cards na tela — os dois dele e os dois
 * do padrão —, e a migração existe para o usuário encontrar o que ele via.
 */
export const HERO_PADRAO = ["faturamento", "gasto", "roas", "lucroLiquido"];

/**
 * O teto da zona Resumo, e ele **só vale na leitura dos envelopes de zonas**.
 *
 * ⛔ Não existe mais teto de métrica: a F5 apagou o "sempre 4" e o "até 8", que
 * eram os dois números arbitrários da queixa 1 do `07`. Este continua aqui pelo
 * mesmo motivo do `HERO_PADRAO` — um v4 com dez na faixa desenhava oito, e é o
 * que a pessoa viu.
 */
export const MAX_FAIXA = 8;

/** As sete que o layout padrão põe na leitura compacta, na ordem. */
export const FAIXA_PADRAO = ["ticket", "ctr", "cpa", "arpu", "margem", "pendentes", "reembolsadas"];

/** O grid antigo tinha 12 colunas no desktop — a mesma contagem de hoje. */
const COLUNAS_ANTIGAS = 12;

/**
 * 🔴 QUANTAS MÉTRICAS CABEM NUMA FILEIRA DA GRADE — e o número não é escolha.
 *
 * O padrão do catálogo é `w = 3`, e 12 ÷ 3 = 4. Ele existe como constante
 * porque a conversão de zonas o usa duas vezes e porque a asserção do teste
 * precisa dizer de onde ele sai.
 */
export const METRICAS_POR_FILEIRA = 4;

/* ── OS ENVELOPES, do mais novo para o mais velho ──────────────────────────── */

/**
 * O envelope gravado hoje.
 *
 * ⛔ `v: 5` é o que diz "métrica e painel estão na MESMA lista". Sem a marca, um
 * `paineis` do v4 e um `blocos` do v5 seriam dois arrays de objetos parecidos com
 * contratos diferentes — e a leitura não teria como saber se as métricas estão
 * lá dentro ou nos campos `hero`/`faixa` ao lado. É a mesma razão do `v: 4`, que
 * separava `linhas` de 44px de `h` de 96.
 */
export interface LayoutV5 {
  v: 5;
  blocos: { id: string; col: number; h?: number; linhas?: number }[];
  /** 🔑 legado — ver `LayoutGrade.heroLegado`. */
  hero?: string[];
  faixa?: string[];
}

/** As três zonas com altura em CÉLULAS — F1, 12/08/2026. */
export interface LayoutV4 {
  v: 4;
  hero: string[];
  faixa: string[];
  paineis: { id: string; col: number; h?: number; linhas?: number }[];
}

/** O envelope da grade de 12 com altura em `linhas` de 44px — 07 a 12/08/2026. */
export interface LayoutV3 {
  v: 3;
  hero: string[];
  faixa: string[];
  paineis: { id: string; col: number; linhas?: number }[];
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

function versaoDe(x: unknown): 2 | 3 | 4 | 5 | null {
  if (!x || typeof x !== "object" || Array.isArray(x)) return null;
  const v = (x as { v?: unknown }).v;
  return v === 5 ? 5 : v === 4 ? 4 : v === 3 ? 3 : v === 2 ? 2 : null;
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

/* ══ O QUE A TELA CONSOME ═══════════════════════════════════════════════════ */

/** Um bloco posicionado na grade. **Métrica e painel são o mesmo tipo.** */
export interface BlocoGrade {
  id: string;
  /** Largura em colunas de 12. Nunca abaixo do `colMin` do bloco. */
  col: number;
  /**
   * Altura em CÉLULAS de 96px (80 + 16 de gap). O slot ocupa exatamente `h`.
   *
   * ⛔ **`undefined` significa "ainda não migrado", e NÃO "sem altura".** É
   * estado de transição de um painel que veio de um envelope de antes da F1 e
   * ainda não passou pela conversão `linhas → h`.
   *
   * ⚠️ **Métrica nunca chega aqui sem `h`**: ela nasce da conversão de zonas ou
   * do catálogo, e as duas dão altura. Se um dia uma aparecer sem, é sinal de
   * envelope editado à mão.
   */
  h?: number;
  /**
   * O `linhas` gravado antes da F1, CRU, em unidade de 44px.
   *
   * ⛔ Nada que DESENHA lê este campo. Aplicá-lo como altura reintroduziria o
   * piso de 44px por cima da grade de 96 e **dobraria** todo bloco alto.
   *
   * ### 🔴 ELE É PRESERVADO, E É UMA DAS DUAS REDES QUE EXISTEM
   *
   * A conversão `linhas → h` é **destrutiva e irreversível**: `h` é o `max()` da
   * conta com a medição F0b, então de `h` não se volta ao `linhas` que o usuário
   * escolheu. A migração roda **uma vez, sozinha, ao abrir o Dashboard**, e roda
   * em PRODUÇÃO. Se ela converter errado, sem este campo não há de onde
   * reconstituir nada.
   *
   * ⛔ **Não "limpe" este campo por ele não ter leitor de desenho.** É a classe
   * de coisa que a regra *ANTES DE DELETAR UM ÓRFÃO, PERGUNTE O QUE ELE FAZIA*
   * protege: sem consumidor, com consequência.
   */
  linhasLegado?: number;
}

/**
 * O layout novo: **uma lista só**, na ordem em que a grade empacota.
 *
 * ### 🔴 AS TRÊS ZONAS ACABARAM — F5, 12/08/2026
 *
 * `hero` (sempre 4), `faixa` (até 8) e `paineis` eram três estruturas separadas
 * com três regras diferentes, e os dois tetos eram a queixa 1 do `07`: **onze
 * métricas disputando oito vagas.** Não havia razão de produto para nenhum dos
 * dois números — eles existiam porque os três grupos eram três componentes.
 */
export interface LayoutGrade {
  blocos: BlocoGrade[];
  /**
   * 🔴 AS ZONAS DE ONDE ESTE LAYOUT VEIO — a rede da conversão da F5.
   *
   * ⛔ **Nada que desenha lê estes campos**, e eles não voltam a ser zona. Eles
   * existem pelo mesmo motivo do `linhasLegado`, uma camada acima: a conversão
   * `{hero, faixa, paineis} → blocos` **também é irreversível**. Da lista única
   * não se recupera qual métrica era hero — a altura (2 × 1) diz isso no
   * instante da conversão e deixa de dizer no primeiro arrasto da alça.
   *
   * ⚠️ E a conversão roda sozinha, em produção, num layout que o usuário montou.
   * Sem os dois campos, uma conversão errada não teria de onde ser desfeita: o
   * arranjo dele viraria o que a conta decidiu, para sempre, e ninguém saberia
   * qual era o anterior.
   *
   * 🔜 Eles podem sair no dia em que a conversão tiver rodado em toda a base E
   * alguém decidir que não há mais o que reconstituir. É decisão, não faxina.
   */
  heroLegado?: string[];
  faixaLegado?: string[];
}

/* ══ A CONVERSÃO DAS ZONAS PARA A GRADE ═════════════════════════════════════ */

/**
 * 🔴 UMA FAIXA DE MÉTRICAS VIRA FILEIRAS QUE **FECHAM 12** — e é isso que
 * preserva o agrupamento.
 *
 * As zonas eram faixas de largura cheia: os quatro heros ocupavam a linha
 * inteira, e a faixa de Resumo também. Na grade, um grupo de `n` métricas a 3
 * colunas cada só fecha a linha quando `n` é múltiplo de 4 — e uma linha que não
 * fecha deixa uma sobra em que **um painel estreito sobe**, encostando num
 * grupo do qual ele nunca fez parte.
 *
 * Então as fileiras são balanceadas: no máximo `METRICAS_POR_FILEIRA` por
 * fileira, tão iguais quanto possível, e cada fileira divide as 12 colunas entre
 * quem está nela. Como o divisor é sempre 1, 2, 3 ou 4, a divisão é exata.
 *
 * | métricas | fileiras | larguras |
 * |---|---|---|
 * | 4 (o hero) | 1 | 3 3 3 3 |
 * | 8 (o teto da faixa) | 2 | 3 3 3 3 · 3 3 3 3 |
 * | 7 (a faixa padrão) | 2 | 3 3 3 3 · 4 4 4 |
 * | 1 | 1 | 12 — que é o que a faixa de um item já era |
 *
 * ⚠️ **A EXCEÇÃO DECLARADA da F5 está aqui**, e é a única mudança de posição
 * aceita: a faixa de oito passa de UMA fileira para DUAS, porque em 12 colunas
 * não existe largura inteira que mantenha oito lado a lado. Qualquer outro
 * deslocamento é defeito.
 *
 * ⛔ A altura vem do parâmetro, **não do `hPadrao` da métrica**. Uma métrica de
 * destaque que o usuário tinha arrastado para o Resumo volta com `h = 1`, que é
 * onde ela estava. O catálogo decide o tamanho de quem NASCE agora; a migração
 * mede o que já existia.
 */
export function fileirasDeMetricas(chaves: readonly string[], h: number): BlocoGrade[] {
  /* Chave que não é métrica conhecida some — mesma regra do bloco fora do
     catálogo, e pelo mesmo motivo: não há o que desenhar nem o que dizer. */
  const validas = chaves.filter((c) => metaDaMetrica(c) !== undefined);
  const fileiras = Math.ceil(validas.length / METRICAS_POR_FILEIRA);
  if (fileiras === 0) return [];

  const porFileira = Math.floor(validas.length / fileiras);
  const sobra = validas.length % fileiras;

  const blocos: BlocoGrade[] = [];
  let i = 0;
  for (let f = 0; f < fileiras; f++) {
    const quantas = porFileira + (f < sobra ? 1 : 0);
    const col = COLUNAS_GRADE / quantas;
    for (let k = 0; k < quantas; k++) {
      const chave = validas[i++] as ChaveDeMetrica;
      const meta = CATALOGO_META.find((b) => b.id === idDaMetrica(chave));
      /* Não pode acontecer — `metaDaMetrica` já filtrou —, e mesmo assim a
         guarda fica: o catálogo e a lista de métricas são dois arquivos, e a
         alternativa a esta linha é um `!` que estoura na tela do usuário. */
      if (!meta) continue;
      blocos.push({ id: meta.id, col: encaixarColunas(col, meta), h: encaixarAltura(h, meta) });
    }
  }
  return blocos;
}

/** As três zonas de um envelope antigo, já saneadas. É a entrada da conversão. */
interface Zonas {
  hero: string[];
  faixa: string[];
  paineis: BlocoGrade[];
}

/**
 * 🔴 O PONTO ÚNICO DE CONVERSÃO ZONAS → GRADE.
 *
 * Todos os envelopes antigos (v1 a v4) passam por aqui, e é de propósito: duas
 * rotas até a mesma grade divergiriam, e a divergência seria muda — dois
 * usuários com o mesmo arranjo veriam telas diferentes conforme a versão em que
 * salvaram. É a mesma disciplina do `alturaMigrada`, uma camada abaixo.
 *
 * ### A ordem é hero → faixa → painéis, e ela é a ordem de leitura da tela
 *
 * O hero fecha exatamente uma fileira (4 × 3 = 12), a faixa fecha as dela, e o
 * primeiro painel começa numa fileira nova. **O agrupamento visual sobrevive**:
 * os principais juntos, o resumo junto, os painéis depois.
 */
export function deZonasParaGrade(z: Zonas): LayoutGrade {
  return {
    blocos: [
      ...fileirasDeMetricas(z.hero, 2),
      ...fileirasDeMetricas(z.faixa, 1),
      ...z.paineis,
    ],
    heroLegado: z.hero,
    faixaLegado: z.faixa,
  };
}

/* ══ A LEITURA DOS ENVELOPES ════════════════════════════════════════════════ */

/** Sanea a lista de painéis de um envelope de zonas (v2/v3/v4). */
function saneiaPaineis(
  crus: unknown,
  versao: 2 | 3 | 4,
): BlocoGrade[] | null {
  /* 🔴 LISTA VAZIA VÁLIDA ≠ CAMPO CORROMPIDO, e a diferença é uma escolha do
     usuário. No modo de edição ele PODE remover todos os blocos OPCIONAIS; se um
     `[]` legítimo caísse no padrão, a escolha dele seria desfeita em silêncio no
     recarregamento — e ele não teria como saber por quê.

     Só o campo que NÃO É ARRAY cai no padrão: aí não houve escolha, houve
     corrupção. É a mesma distinção de "célula vazia ≠ célula zero". */
  if (!Array.isArray(crus)) return null;

  const paineis: BlocoGrade[] = [];
  for (const p of crus as ({ id?: unknown; col?: unknown; h?: unknown; linhas?: unknown } & Partial<PainelV2>)[]) {
    const meta = CATALOGO_META.find((b) => b.id === p?.id);
    if (!meta) continue; // bloco que saiu do catálogo depois de gravado
    if (paineis.some((x) => x.id === meta.id)) continue;
    /* v2 falava por RÓTULO, v3 em diante falam em colunas. O rótulo vira coluna
       e passa pelo mesmo encaixe — um `um-terco` gravado para um bloco cujo
       mínimo hoje é 6 sobe para 6, em vez de nascer num tamanho que o produto
       recusaria. */
    const colBruta =
      versao === 2
        ? COLUNAS_DO_ROTULO[(p as PainelV2).largura] ?? meta.colPadrao
        : typeof p.col === "number"
          ? p.col
          : meta.colPadrao;
    paineis.push({
      id: meta.id,
      col: encaixarColunas(colBruta, meta),
      /* 🔴 SÓ O v4 EM DIANTE TEM ALTURA EM CÉLULAS. O `linhas` do v2/v3 NÃO é
         convertido aqui, e não é esquecimento: converter na leitura faria toda
         abertura do Dashboard reinterpretar o salvo, e a migração de altura
         precisa ser um evento ÚNICO e gravado. */
      h: versao === 4 && typeof p.h === "number" ? encaixarAltura(p.h, meta) : undefined,
      /* 🔴 O `linhas` ATRAVESSA A LEITURA EM TODA VERSÃO — ele é a rede. */
      linhasLegado: typeof p.linhas === "number" ? p.linhas : undefined,
    });
  }
  return reporEstruturais(paineis);
}

/**
 * Um layout com marca de versão ainda precisa passar pelas MESMAS regras.
 *
 * ⛔ Não é paranoia: o payload pode ter sido gravado por uma versão anterior do
 * modo de edição, editado à mão, ou conter um bloco que saiu do catálogo depois.
 * **Confiar em `v: 5` para pular a validação é confiar que o passado obedeceu
 * regras que só existem no presente.**
 */
function sanearZonas(raw: LayoutV2 | LayoutV3 | LayoutV4, versao: 2 | 3 | 4): LayoutGrade {
  const hero = Array.isArray(raw.hero) ? raw.hero.filter((x) => typeof x === "string").slice(0, 4) : [];
  /* ⚠️ A completude descreve o que o envelope DESENHAVA, não uma regra de hoje —
     ver `HERO_PADRAO`. */
  for (const m of HERO_PADRAO) {
    if (hero.length >= 4) break;
    if (!hero.includes(m)) hero.push(m);
  }
  const faixa = Array.isArray(raw.faixa)
    ? raw.faixa.filter((x) => typeof x === "string" && !hero.includes(x)).slice(0, MAX_FAIXA)
    : [...FAIXA_PADRAO];

  const paineis = saneiaPaineis(raw.paineis, versao);
  /* ⛔ O CAMPO CORROMPIDO LEVA OS PAINÉIS PADRÃO, NÃO O LAYOUT PADRÃO INTEIRO.
     As métricas do usuário estão em `hero`/`faixa`, que são outros campos e
     podem estar perfeitamente íntegros. Trocar tudo pelo padrão desfaria uma
     escolha que não foi corrompida — e ele não teria como saber por quê. */
  return deZonasParaGrade({ hero, faixa, paineis: paineis ?? paineisPadrao() });
}

/** Sanea um envelope que JÁ é grade única. */
function sanearGrade(raw: LayoutV5): LayoutGrade {
  if (!Array.isArray(raw.blocos)) return layoutPadrao();

  const blocos: BlocoGrade[] = [];
  for (const b of raw.blocos as { id?: unknown; col?: unknown; h?: unknown; linhas?: unknown }[]) {
    const meta = CATALOGO_META.find((x) => x.id === b?.id);
    if (!meta) continue;
    if (blocos.some((x) => x.id === meta.id)) continue;
    blocos.push({
      id: meta.id,
      col: encaixarColunas(typeof b.col === "number" ? b.col : meta.colPadrao, meta),
      h: typeof b.h === "number" ? encaixarAltura(b.h, meta) : undefined,
      linhasLegado: typeof b.linhas === "number" ? b.linhas : undefined,
    });
  }
  return {
    blocos: reporEstruturais(blocos),
    /* As zonas de origem continuam viajando no envelope, intactas. */
    heroLegado: Array.isArray(raw.hero) ? raw.hero.filter((x) => typeof x === "string") : undefined,
    faixaLegado: Array.isArray(raw.faixa) ? raw.faixa.filter((x) => typeof x === "string") : undefined,
  };
}

/* ── A CONVERSÃO 44 → 96, e a razão dela ────────────────────────────────────
   🔴 ESTA É UMA DAS PARTES QUE IMPORTAM DA MIGRAÇÃO, E A RAZÃO MAIS QUE A
   FÓRMULA.

   O campo `linhas` do v3 está em unidade de **44px** (`ALTURA_LINHA_ANTIGA`) e
   era um PISO (`minHeight`); a célula nova vale **96px** (80 + 16 de gap) e é
   altura EXATA. Comparar os dois números crus **dobra a altura**: `linhas: 8`
   significa 352px hoje, e 8 células significariam 752px.

   ⚠️ Sem a razão escrita, a próxima mudança de `ALTURA_LINHA_ANTIGA` ou de
   `ALTURA_CELULA` repete o erro — a fórmula continuaria "certa" e o resultado,
   errado. */

/** As células que o `linhas` gravado (unidade de 44px) ocupava de verdade. */
export function celulasDeLinhas(linhas: number): number {
  return celulasDePx(linhas * ALTURA_LINHA_ANTIGA);
}

/**
 * A altura migrada de UM bloco, em células.
 *
 * ```
 * h = max( células(linhas gravado) , hMin do bloco )
 * ```
 *
 * 🔴 O `hMin` do catálogo **é a medição F0b** — a altura que o bloco de fato
 * ocupava na grade em `auto`, no maior entre 1280 e 2260 (§11 do `07`). Então
 * este `max` é literalmente a fórmula do documento:
 * `max(ceil((linhas×44+16)/96), ceil((altura renderizada+16)/96))`.
 *
 * ⛔ **A medição vem do CATÁLOGO, não da tela.** Ela só existia enquanto a grade
 * estava em `grid-auto-rows: auto`, que é justamente o que a F1 remove — é dado
 * de ENTRADA, e colhê-lo depois é impossível.
 */
export function alturaMigrada(meta: MetaBloco, linhas: number | undefined): number {
  const deLinhas = typeof linhas === "number" && Number.isFinite(linhas) ? celulasDeLinhas(linhas) : 0;
  return Math.max(meta.hMin, deLinhas);
}

/** O item do grid antigo, como está gravado no `DashboardLayout.layout`. */
export interface ItemAntigo {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * 🔴 O ARRANJO PADRÃO DOS PAINÉIS — a ORDEM e a LARGURA de conta nova,
 * aprovadas em 07/08/2026.
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
 * Com dezesseis painéis, o padrão fácil é uma pilha de largura cheia — e aí
 * ninguém descobre que a grade aceita mais de um por linha. O modo de edição
 * seria um recurso que existe e não é encontrado.
 *
 * ⛔ **Nenhum painel em 3 colunas, mesmo com sete deles aceitando.** 3 é o piso
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
 * fechava 12 por acidente, e ninguém podia ter escrito o raciocínio acima.
 *
 * ⚠️ O preço é que **um bloco novo no catálogo não entra sozinho no padrão** —
 * e isso é bom: uma asserção reprova a divergência, e ela força a pergunta "em
 * que linha ele entra, e o que sai para caber?".
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

/**
 * Os PAINÉIS do arranjo padrão, sem as métricas.
 *
 * ⚠️ Ele existe para os dois casos em que os painéis do salvo são
 * inaproveitáveis (campo corrompido, ou nenhum id que ainda exista) **sem que as
 * métricas do usuário sejam levadas junto**. Antes da F5 isso era automático:
 * `hero` e `faixa` eram campos separados, e trocar `paineis` pelo padrão não os
 * tocava. Numa lista só, trocar a lista apaga tudo.
 */
function paineisPadrao(): BlocoGrade[] {
  return layoutPadrao().blocos.filter((b) => !ehBlocoDeMetrica(b.id));
}

/**
 * O padrão do produto — o que toda conta nova vê.
 *
 * 🔴 **Ele passa pela MESMA `fileirasDeMetricas` da migração**, e não por uma
 * lista de larguras escrita à mão. Se as duas divergissem, uma conta nova e uma
 * conta migrada com as mesmas métricas veriam arranjos diferentes — e ninguém
 * saberia qual dos dois é o certo.
 *
 * ⚠️ As quatro métricas que sobram (`liquido`, `roi`, `vendas`, `chargeback`)
 * ficam FORA de propósito, e é a mesma decisão que os painéis já tinham: o
 * padrão é um arranjo, não um inventário. Elas aparecem no catálogo lateral,
 * com o contador de disponíveis.
 */
export function layoutPadrao(): LayoutGrade {
  const paineis: BlocoGrade[] = [];
  for (const [id, col] of PADRAO_PAINEIS) {
    const meta = CATALOGO_META.find((b) => b.id === id);
    /* Um id que saiu do catálogo é PULADO, não quebra a tela. A asserção do
       teste é quem denuncia a divergência — aqui o pior caso tem de ser uma
       linha a menos, nunca um Dashboard que não carrega. */
    if (!meta) continue;
    paineis.push({
      /* ⚠️ Passa pelo `encaixarColunas`: a largura escrita acima é uma escolha
         de ARRANJO, e o mínimo do bloco continua mandando. */
      id,
      col: encaixarColunas(col, meta),
      /* 🔴 O PADRÃO JÁ NASCE MIGRADO. Conta nova nunca passa pelo efeito de
         migração: não há layout salvo para converter, e `hPadrao` é a saída da
         F0b, que é a melhor altura conhecida para aquele bloco.

         ⚠️ Isto NÃO reintroduz o esburacado de 07/08: quem responde por bloco
         vazio é a condição F0 na renderização (colapso para
         `min(h, células do estado vazio)`), sem tocar no `h`. */
      h: meta.hPadrao,
    });
  }
  return {
    blocos: [
      ...fileirasDeMetricas(HERO_PADRAO, 2),
      ...fileirasDeMetricas(FAIXA_PADRAO, 1),
      ...paineis,
    ],
  };
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
 * no catálogo** e têm render. É a família do ⛔ que envelhece e vira ordem de
 * reverter: a proibição continuava bem escrita e convincente depois de ter
 * deixado de ser verdade. Ela foi APAGADA, não anotada.
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
 * identidade: o `w` gravado É a largura em colunas.
 *
 * ⚠️ O `encaixarColunas` ainda roda por cima, e não é redundância: um `w: 3`
 * gravado para um bloco cujo mínimo hoje é 6 tem de subir. A migração nunca
 * pode produzir um estado que o redimensionamento recusaria.
 */
export function colunasDoGridAntigo(w: number, meta: MetaBloco): number {
  return encaixarColunas(Math.min(COLUNAS_ANTIGAS, Math.max(1, w)), meta);
}

/**
 * A altura do grid antigo, em `linhas` de 44px — a MESMA unidade do v3.
 *
 * ⚠️ As unidades NÃO são as mesmas: a linha do `react-grid-layout` valia ~30px
 * mais margem; a de 44px é a do v3. O fator de 0,75 é o que faz um gráfico de
 * `h: 8` chegar com 6 linhas — a mesma altura na tela, que é o que o usuário
 * reconhece. Converter 1:1 dobraria todo bloco de gráfico.
 *
 * 🔴 ELA PARA AQUI, EM `linhas`, e não vai até células de propósito: assim o
 * grid antigo e o v3 entram no **mesmo** ponto de conversão (`alturaMigrada`).
 */
export function linhasDoGridAntigo(h: number): number {
  return Math.max(1, Math.round(h * 0.75));
}

/* ══ A MIGRAÇÃO DE ALTURA — as três camadas da guarda ════════════════════════
   Elas são uma sequência, e cada uma responde a uma pergunta diferente. Juntar
   duas num `if` só faria a falha de uma parecer a da outra.

     1. ELEGIBILIDADE — POR BLOCO. "este bloco pode receber `h` agora?"
     2. COMPLETUDE    — DO LAYOUT. "todos receberam? então há o que gravar."
     3. RESERVA       — NO BANCO.  "eu sou quem grava?" (fica na action)

   🔴 Por que a elegibilidade é `temDado`, e não "está no catálogo": o `hMin` que
   a migração aplica é a medição F0b, feita com o bloco CHEIO. Aplicá-la a um
   bloco que ninguém nunca viu com dado é gravar a altura de um conteúdo que não
   existe — o defeito de 07/08 (o bloco vazio reservando 6 linhas para escrever
   "Sem dado neste período"), agora persistido em vez de só desenhado.

   ⚠️ A consequência é decisão do dono e está aceita: **bloco que nunca tem dado
   fica sem `h`, em `auto`, por tempo indeterminado.** Os dois modos convivem. */

/** O resultado de uma tentativa de migração. `completo` é a camada 2. */
export interface MigracaoDeAltura {
  blocos: BlocoGrade[];
  /**
   * `true` só quando TODO bloco do layout ficou com `h`.
   *
   * ⛔ É o que autoriza a escrita. Gravar um layout meio-migrado marcaria o
   * envelope como `v: 5` — com blocos que ainda têm `linhas` por converter.
   */
  completo: boolean;
}

/**
 * Converte as alturas de um layout lido. **Pura** — não escreve nada.
 *
 * @param temDado responde, por id de bloco, se ele tem dado NESTE momento. É a
 *                camada 1 (elegibilidade), e ela é por bloco.
 */
export function migrarAlturas(layout: LayoutGrade, temDado: (id: string) => boolean): MigracaoDeAltura {
  let pendentes = 0;
  const blocos = layout.blocos.map((p) => {
    if (typeof p.h === "number") return p; // já migrado: não se toca
    const meta = CATALOGO_META.find((b) => b.id === p.id);
    if (!meta || !temDado(p.id)) {
      pendentes++;
      return p;
    }
    /* ⚠️ O `linhasLegado` FICA. Quem impede a próxima abertura de converter de
       novo é o `h` existir (`precisaMigrarAltura`), não o campo antigo sumir. */
    return { id: p.id, col: p.col, h: alturaMigrada(meta, p.linhasLegado), linhasLegado: p.linhasLegado };
  });
  return { blocos, completo: pendentes === 0 };
}

/** `true` quando o layout lido ainda tem bloco sem `h` — ou seja, há o que migrar. */
export function precisaMigrarAltura(layout: LayoutGrade): boolean {
  return layout.blocos.some((p) => typeof p.h !== "number");
}

/**
 * Migra um layout antigo. **Nunca lança** — layout corrompido cai no padrão.
 *
 * ⛔ O `try` não é preguiça: este código roda no carregamento do Dashboard, e um
 * `Json` malformado no banco (edição manual, migração parcial, versão futura)
 * não pode deixar o usuário sem tela. O padrão é sempre uma resposta válida.
 */
export function migrarLayout(bruto: unknown): LayoutGrade {
  const padrao = layoutPadrao();

  const versao = versaoDe(bruto);
  if (versao === 5) return sanearGrade(bruto as LayoutV5);
  if (versao) return sanearZonas(bruto as LayoutV2 | LayoutV3 | LayoutV4, versao);

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

    const hero = metricas.slice(0, 4);
    for (const m of HERO_PADRAO) {
      if (hero.length >= 4) break;
      if (!hero.includes(m)) hero.push(m);
    }
    const faixa = metricas.slice(4).filter((m) => !hero.includes(m)).slice(0, MAX_FAIXA);

    /* ── Painéis ─────────────────────────────────────────────────────────── */
    const paineis: BlocoGrade[] = [];
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
        /* Entra como LEGADO, na mesma unidade do v3 — o efeito de migração
           converte os dois pelo mesmo caminho. Ver `linhasDoGridAntigo`. */
        linhasLegado: linhasDoGridAntigo(it.h),
      });
    }

    /* Layout salvo SÓ com painéis que sumiram: cai no padrão de PAINÉIS em vez
       de deixar a grade só com métrica, que parece tela pela metade.

       ⚠️ E as métricas do usuário continuam sendo as dele. A versão anterior
       devolvia o layout padrão INTEIRO aqui, e com as zonas isso não se via —
       `hero` e `faixa` eram campos separados que sobreviviam ao lado. Numa
       lista só, trocar a lista apagaria a ordem dos KPIs que ele escolheu. */
    return deZonasParaGrade({
      hero,
      faixa,
      paineis: paineis.length > 0 ? reporEstruturais(paineis) : paineisPadrao(),
    });
  } catch {
    return padrao;
  }
}
