/**
 * `estadoDoToken` — A FALHA MAIS CARA QUE ESTA FERRAMENTA TEM, sem asserção.
 *
 * O cabeçalho do módulo diz por que ele existe: um token de Marketing API
 * vencendo em silêncio para a sincronização inteira — o gasto congela, o ROAS
 * passa a mentir por omissão, e **as regras de automação decidem com dado
 * velho**, pausando campanha e mexendo em orçamento com dinheiro real.
 *
 * Três consumidores de produção (`dashboard/alertas.ts`,
 * `integracoes/inventario.ts` ×2) e **zero asserções** até 14/08/2026.
 *
 * ### 🔑 O QUE SE CONGELA
 *
 *   1. **partição**      todo input cai em exatamente UM dos três tipos
 *   2. **a costura**     `delta <= 0` é vencido; `expira` nunca reporta 0 dias
 *   3. **`desconhecido` ≠ `expira`**  a distinção central do projeto
 *   4. **acordo**        `detalheDoToken` explica exatamente quando pede atenção
 *   5. **`agora` é parâmetro**, não `Date.now()` de dentro
 *
 * ### ✅ AS DUAS AFIRMAÇÕES FALSAS DO CABEÇALHO — CORRIGIDAS EM 14/08/2026
 *
 * O módulo afirmava que o `DIAS_ATENCAO = 30` era *"o mesmo limiar do
 * `/api/cron/manutencao`"*. **Não era: lá havia um `AVISO_TOKEN_DIAS = 14`
 * local.** E o grupo que este mesmo arquivo chama de *"o mais perigoso da
 * base"* — os tokens de data desconhecida — era excluído da consulta do cron
 * por um `not: null`, então nunca gerava notificação nenhuma.
 *
 * ⛔ **A correção do primeiro não foi trocar o número: foi apagar a segunda
 * fonte.** O cron importa a constante, e por isso a §7a congela a AUSÊNCIA de
 * um limiar local — não o valor `30`. Duas cópias que concordam hoje são
 * exatamente o que sobrevive até o commit que mexe num lado só.
 *
 * ⚠️ Alinhado para CIMA pela regra de desempate do dono (*o que não corta
 * informação do usuário vence*), e o custo é volume: a janela de notificação
 * vai de ≤14 para ≤30 por perfil. Ver a §7.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let n = 0;
const ok = (nome, cond, extra) => {
  assert.ok(cond, nome + (extra ? " — " + extra : ""));
  console.log("  ✓ " + nome + (extra ? " — " + extra : ""));
  n++;
};

const { estadoDoToken, tokenPedeAtencao, rotuloDoToken, detalheDoToken, DIAS_ATENCAO } =
  await import("@/lib/integracoes/token");

const AGORA = new Date("2026-08-14T12:00:00.000Z");
const DIA = 864e5;
/** Um instante a `d` dias de `AGORA` (negativo = passado). */
const emDias = (d) => new Date(AGORA.getTime() + d * DIA);

/* ═══════════════════════════════════════════════════════════════════════
 * 0 · LINHA DE BASE — os três estados são ALCANÇÁVEIS
 *
 * ⛔ Sem isto, uma implementação que devolvesse sempre `desconhecido`
 * satisfaria a partição da §1 com nota máxima: um estado só é uma partição
 * perfeitamente válida.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n0 · linha de base — os três estados são alcançáveis");

  const tipos = new Set([
    estadoDoToken(emDias(10), AGORA).tipo,
    estadoDoToken(emDias(-10), AGORA).tipo,
    estadoDoToken(null, AGORA).tipo,
  ]);
  ok("os 3 tipos aparecem", tipos.size === 3, [...tipos].join(", "));

  /* ⚠️ Aqui havia `DIAS_ATENCAO === 30`, e ela foi TROCADA: congelar o valor
     faria uma correção legítima do limiar (ver a §7) reprovar com a mensagem
     "DIAS_ATENCAO é 30", que não diz nada a quem está corrigindo. O número tem
     um lugar só neste arquivo — a §7, onde ele é COMPARADO com a outra fonte. */
  ok(
    "`DIAS_ATENCAO` é um número de dias utilizável",
    Number.isInteger(DIAS_ATENCAO) && DIAS_ATENCAO > 0,
    "vale " + DIAS_ATENCAO + " — comparado com a outra fonte na §7",
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * 1 · PARTIÇÃO — exatamente um tipo por entrada, sob fuzz
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n1 · partição");

  let semente = 7;
  const rnd = () => ((semente = (semente * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const TIPOS = ["vencido", "expira", "desconhecido"];

  const contagem = { vencido: 0, expira: 0, desconhecido: 0 };
  let foraDaLista = null;
  let camposErrados = null;

  for (let i = 0; i < 400; i++) {
    const dias = rnd() * 800 - 400;
    const e = estadoDoToken(emDias(dias), AGORA);
    if (!TIPOS.includes(e.tipo)) foraDaLista ??= String(dias);
    contagem[e.tipo]++;

    /* Cada tipo carrega o SEU campo, e só ele. Um `expira` com `diasDesde` (ou
       vice-versa) compilaria — a união é discriminada no tipo, não em runtime. */
    if (e.tipo === "expira" && (typeof e.dias !== "number" || "diasDesde" in e)) camposErrados ??= JSON.stringify(e);
    if (e.tipo === "vencido" && (typeof e.diasDesde !== "number" || "dias" in e)) camposErrados ??= JSON.stringify(e);
    if (e.tipo === "desconhecido" && Object.keys(e).length !== 1) camposErrados ??= JSON.stringify(e);
  }

  ok("linha de base: o fuzz produziu vencidos E expirando", contagem.vencido > 50 && contagem.expira > 50, JSON.stringify(contagem));
  ok("todo estado tem um tipo conhecido", foraDaLista === null, foraDaLista ?? "");
  ok("e cada tipo carrega só o seu campo", camposErrados === null, camposErrados ?? "");
}

/* ═══════════════════════════════════════════════════════════════════════
 * 2 · A COSTURA — e o `ceil` que impede o contador de mentir
 *
 * O comentário do módulo diz: *"um contador que chega a zero antes de vencer
 * diz que já venceu, e manda reconectar um token que ainda funciona"*.
 * Afirmação de efeito, portanto asserção.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n2 · a costura, e o arredondamento para cima");

  ok("exatamente agora é VENCIDO, não `expira em 0`", estadoDoToken(AGORA, AGORA).tipo === "vencido");
  ok("1ms no passado é vencido", estadoDoToken(new Date(AGORA.getTime() - 1), AGORA).tipo === "vencido");
  ok("1ms no futuro é `expira`", estadoDoToken(new Date(AGORA.getTime() + 1), AGORA).tipo === "expira");

  /* A propriedade: enquanto o token FUNCIONA, o contador nunca marca 0. */
  let semente = 7;
  const rnd = () => ((semente = (semente * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  let zerou = null;
  let quantos = 0;
  for (let i = 0; i < 400; i++) {
    const dias = rnd() * 60; // só futuro
    if (dias <= 0) continue;
    const e = estadoDoToken(emDias(dias), AGORA);
    quantos++;
    if (e.tipo === "expira" && e.dias < 1) zerou ??= dias + " dia -> " + e.dias;
  }
  ok("linha de base: " + quantos + " tokens ainda válidos examinados", quantos > 300);
  ok("token que ainda funciona NUNCA reporta 0 dias", zerou === null, zerou ?? "");
  ok("0,3 dia é `1 dia`, não `0`", estadoDoToken(emDias(0.3), AGORA).dias === 1);
  ok("e o rótulo diz `Expira amanhã`", rotuloDoToken(estadoDoToken(emDias(0.3), AGORA)) === "Expira amanhã");

  /* ── PLANTIO A: `floor` no lugar de `ceil` — "arredondar para baixo é mais
     conservador". Ele produz o contador que mente ao contrário. */
  {
    const comFloor = (delta) => Math.floor(delta / DIA);
    ok(
      "PLANTIO A (floor): 0,3 dia vira `0 dias`",
      comFloor(0.3 * DIA) === 0,
      "a tela diria que venceu um token que ainda funciona",
    );
    ok("PLANTIO A: a asserção do `nunca 0` DERRUBA", comFloor(0.3 * DIA) < 1);
  }

  /* Vencido conta para trás, e o dia zero tem texto próprio. */
  ok("vencido há 0 dias", estadoDoToken(emDias(-0.5), AGORA).diasDesde === 0);
  ok("e o rótulo é `Token expirado hoje`", rotuloDoToken(estadoDoToken(emDias(-0.5), AGORA)) === "Token expirado hoje");
  ok("vencido há 1 dia diz `ontem`", rotuloDoToken(estadoDoToken(emDias(-1.5), AGORA)) === "Token expirado ontem");
  ok("vencido há 5 dias é plural", rotuloDoToken(estadoDoToken(emDias(-5.5), AGORA)) === "Token expirado há 5 dias");
}

/* ═══════════════════════════════════════════════════════════════════════
 * 3 · `desconhecido` NÃO É `expira` — a distinção central, na camada de token
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n3 · desconhecido é um estado próprio");

  const ausentes = [null, undefined, "", "não é data", "0000-13-45", NaN];
  const naoDeuDesconhecido = ausentes.filter((v) => estadoDoToken(v, AGORA).tipo !== "desconhecido");
  ok(
    "as " + ausentes.length + " formas de ausência dão `desconhecido`",
    naoDeuDesconhecido.length === 0,
    JSON.stringify(naoDeuDesconhecido),
  );

  ok("`desconhecido` não tem contador", !("dias" in estadoDoToken(null, AGORA)));
  ok(
    "o rótulo NÃO é um traço — o traço diria `não se aplica`",
    rotuloDoToken(estadoDoToken(null, AGORA)) === "Data de expiração desconhecida",
  );
  ok(
    "e o detalhe manda RECONECTAR",
    /reconecte/i.test(detalheDoToken(estadoDoToken(null, AGORA))),
  );

  /* Aceita `Date` e string ISO igual — os dois chegam do Prisma e do DTO. */
  ok(
    "string ISO e Date produzem o MESMO estado",
    JSON.stringify(estadoDoToken(emDias(7).toISOString(), AGORA)) ===
      JSON.stringify(estadoDoToken(emDias(7), AGORA)),
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * 4 · `tokenPedeAtencao` — e o plantio cujo PAR NEGATIVO é o achado
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n4 · tokenPedeAtencao");

  ok("desconhecido PEDE atenção", tokenPedeAtencao(estadoDoToken(null, AGORA)) === true);
  ok("vencido pede", tokenPedeAtencao(estadoDoToken(emDias(-1), AGORA)) === true);
  ok("expirando em 10 dias pede", tokenPedeAtencao(estadoDoToken(emDias(10), AGORA)) === true);
  ok("expirando em 90 dias NÃO pede", tokenPedeAtencao(estadoDoToken(emDias(90), AGORA)) === false);

  /* A fronteira é ESTRITA: o próprio limiar pede, o limiar + 1 não. Um `<` no
     lugar do `<=` tiraria um dia inteiro do aviso, e ninguém veria.

     ⚠️ Os dois lados são DERIVADOS de `DIAS_ATENCAO`, nunca escritos. Com `30`
     cravado, mudar o limiar reprovaria aqui com a mensagem errada — a
     propriedade congelada é a estrita, não o número. */
  ok(
    "exatamente o limiar (" + DIAS_ATENCAO + ") PEDE",
    tokenPedeAtencao({ tipo: "expira", dias: DIAS_ATENCAO }) === true,
  );
  ok(
    "o limiar + 1 (" + (DIAS_ATENCAO + 1) + ") NÃO pede",
    tokenPedeAtencao({ tipo: "expira", dias: DIAS_ATENCAO + 1 }) === false,
  );

  /* ── PLANTIO B: `e.tipo === "expira" && e.dias <= DIAS_ATENCAO`.
     É a leitura literal do nome: *"pede atenção quando está expirando em
     breve"*. Parece uma reescrita fiel. */
  {
    const plantio = (e) => e.tipo === "expira" && e.dias <= DIAS_ATENCAO;

    const universo = [
      estadoDoToken(emDias(90), AGORA),
      estadoDoToken(emDias(31), AGORA),
      estadoDoToken(emDias(30), AGORA),
      estadoDoToken(emDias(1), AGORA),
      estadoDoToken(emDias(-1), AGORA),
      estadoDoToken(emDias(-400), AGORA),
      estadoDoToken(null, AGORA),
    ];

    const divergem = universo.filter((e) => plantio(e) !== tokenPedeAtencao(e));

    /* ── PAR NEGATIVO, e é ele que informa: sobre TODO estado `expira` as duas
       versões concordam — inclusive na fronteira dos 30 dias. Elas divergem
       exatamente em `vencido` e `desconhecido`, que são os dois estados em que
       a atenção é OBRIGATÓRIA. Quem testasse à mão com um token expirando
       veria as duas concordarem. */
    const soExpira = universo.filter((e) => e.tipo === "expira");
    ok(
      "PAR NEGATIVO: nos " + soExpira.length + " estados `expira` as duas versões CONCORDAM",
      soExpira.every((e) => plantio(e) === tokenPedeAtencao(e)),
      "inclusive na fronteira — é por isso que a reescrita passaria numa conferência à mão",
    );
    ok(
      "PLANTIO B: divergem só em `vencido` e `desconhecido`",
      divergem.length === 3 && divergem.every((e) => e.tipo !== "expira"),
      divergem.map((e) => e.tipo).join(", "),
    );
    ok(
      "PLANTIO B: o token JÁ VENCIDO deixaria de pedir atenção",
      plantio(estadoDoToken(emDias(-400), AGORA)) === false,
      "e ele é o único estado em que a sincronização já parou",
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * 5 · ACORDO ENTRE AS DUAS FUNÇÕES DE TELA
 *
 * `tokenPedeAtencao` decide a COR; `detalheDoToken` escreve o PORQUÊ. Se
 * divergirem, a tela pinta alarme sem explicação (ou explica sem pintar) — e
 * as duas são versões do mesmo defeito: o usuário não sabe o que fazer.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n5 · a cor e a explicação concordam");

  let semente = 7;
  const rnd = () => ((semente = (semente * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  let divergiu = null;
  let comDetalhe = 0;
  let semDetalhe = 0;

  for (let i = 0; i < 400; i++) {
    const e = rnd() < 0.1 ? estadoDoToken(null, AGORA) : estadoDoToken(emDias(rnd() * 400 - 200), AGORA);
    const pede = tokenPedeAtencao(e);
    const temDetalhe = detalheDoToken(e) !== null;
    if (pede !== temDetalhe) divergiu ??= JSON.stringify(e);
    if (temDetalhe) comDetalhe++;
    else semDetalhe++;
  }

  /* ⛔ LINHA DE BASE dos DOIS lados: sem ela, um `detalheDoToken` que sempre
     devolvesse string e um `tokenPedeAtencao` que sempre devolvesse `true`
     concordariam perfeitamente. */
  ok("linha de base: houve estados COM detalhe", comDetalhe > 50, comDetalhe + " de 400");
  ok("linha de base: e estados SEM detalhe", semDetalhe > 50, semDetalhe + " de 400");
  ok("fuzz 400: pede atenção ⟺ tem detalhe", divergiu === null, divergiu ?? "");

  /* E o rótulo nunca é vazio — a tela desenha essa string direto. */
  ok(
    "o rótulo nunca sai vazio",
    [emDias(90), emDias(1), emDias(-1), null].every((v) => rotuloDoToken(estadoDoToken(v, AGORA)).length > 5),
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * 6 · `agora` É PARÂMETRO — a regra do `elapsed()`
 *
 * Se a função lesse `Date.now()` por dentro, o servidor e o cliente
 * calculariam estados diferentes e o React abortaria a hidratação da árvore.
 * O efeito visível não é o texto errado — é a NAVEGAÇÃO parar. Os três
 * consumidores passam `agora` explicitamente, e é o contrato que sustenta isso.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n6 · `agora` é parâmetro, não relógio interno");

  const expira = emDias(20);
  const cedo = estadoDoToken(expira, AGORA);
  const tarde = estadoDoToken(expira, new Date(AGORA.getTime() + 25 * DIA));

  ok("o MESMO token muda de estado conforme o `agora`", cedo.tipo === "expira" && tarde.tipo === "vencido");
  ok("e o `agora` é respeitado no contador", cedo.dias === 20, "dias: " + cedo.dias);

  /* Determinismo: duas chamadas com o mesmo `agora` dão a mesma resposta. Um
     `Date.now()` interno faria isto oscilar entre execuções. */
  ok(
    "duas chamadas com o mesmo `agora` são idênticas",
    JSON.stringify(estadoDoToken(expira, AGORA)) === JSON.stringify(estadoDoToken(expira, AGORA)),
  );

  /* E os três consumidores de produção passam o argumento — se algum parar de
     passar, ele volta ao relógio do processo e o defeito é de hidratação. */
  {
    const semComentario = (s) =>
      s.replace(/\r\n/g, "\n")
        .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
        .replace(/\/\/[^\n]*/g, "");

    const consumidores = ["src/lib/dashboard/alertas.ts", "src/lib/integracoes/inventario.ts"];
    const chamadas = consumidores.flatMap((f) =>
      [...semComentario(readFileSync(f, "utf8")).matchAll(/estadoDoToken\(([^)]*)\)/g)].map((m) => ({ f, args: m[1] })),
    );
    ok("linha de base: há chamadas no CÓDIGO", chamadas.length >= 3, chamadas.length + " chamadas");
    const semAgora = chamadas.filter((c) => !c.args.includes(","));
    ok(
      "os " + chamadas.length + " consumidores passam `agora` explicitamente",
      semAgora.length === 0,
      semAgora.map((c) => c.f + ": estadoDoToken(" + c.args + ")").join(" · "),
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * 7 · ✅ AS DUAS AFIRMAÇÕES FALSAS DO CABEÇALHO — CORRIGIDAS EM 14/08/2026
 *
 * Esta seção congelava um estado ruim e carregava a saída escrita nela. As
 * duas correções chegaram, e o que entra no lugar não é "agora está certo":
 * é a asserção de que **existe uma fonte só**.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n7 · ✅ o cabeçalho e o cron, agora por IMPORT");

  const cron = readFileSync("src/app/api/cron/manutencao/route.ts", "utf8").replace(/\r\n/g, "\n");
  const tok = readFileSync("src/lib/integracoes/token.ts", "utf8").replace(/\r\n/g, "\n");
  /* ⚠️ Comentário APAGADO antes de medir: este arquivo agora documenta, em
     prosa, tudo o que a guarda procura — inclusive o `AVISO_TOKEN_DIAS = 14`
     que deixou de existir. É a família "guarda por texto medindo PROSA", que
     esta base já pagou oito vezes. */
  const semCom = (x) =>
    x.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/\/\/[^\n]*/g, "");
  const cronCodigo = semCom(cron);

  ok(
    "linha de base: sobrou CÓDIGO no cron depois de apagar comentário",
    /prisma\.adProfile\.findMany/.test(cronCodigo),
    "senão toda negação abaixo passaria sobre um arquivo em branco",
  );

  /* ═══ 7a · O LIMIAR — a seção mudou de veredito ═══════════════════════
     A versão anterior congelava a divergência (tela 30 × cron 14) e dizia:
     *"se esta reprovar porque os dois foram unificados, apague a §7a — o
     cabeçalho virou verdade"*. Foi o que aconteceu.

     ⛔ E o que entra NÃO é `doCron === 30`. Congelar o número deixaria a
     segunda fonte poder voltar com o mesmo valor — e duas cópias que
     concordam hoje são exatamente o que sobrevive até o commit que mexe num
     lado só. O que se congela é a AUSÊNCIA da segunda fonte. */
  ok(
    "7a · ⛔ o cron NÃO tem limiar próprio",
    !/AVISO_TOKEN_DIAS\s*=/.test(cronCodigo),
    "um literal local aqui é a segunda fonte voltando",
  );
  ok(
    "7a · …ele IMPORTA `DIAS_ATENCAO` de `token.ts`",
    /import \{[^}]*DIAS_ATENCAO[^}]*\} from "@\/lib\/integracoes\/token"/.test(cronCodigo),
    "concordar deixou de ser promessa escrita e virou propriedade do grafo de imports",
  );
  ok(
    "7a · e a janela da consulta é DERIVADA dele",
    /DIAS_ATENCAO \* 864e5/.test(cronCodigo),
    "sem isto o import existiria sem efeito — importado e não chamado",
  );
  /* ⛔ AQUI HAVIA UMA NEGAÇÃO, E ELA REPROVOU MEDINDO PROSA — 9ª ocorrência
     desta família nesta base, e a segunda minha nesta sessão.

     Eu asserira `!/30 é o mesmo limiar do .../.test(tok)`, esperando provar que
     o cabeçalho parou de AFIRMAR a igualdade. Ela casou — porque o cabeçalho
     novo **cita a frase antiga** para registrar que ela era falsa. Apagar
     comentário antes de medir não resolve: o arquivo inteiro é comentário.

     ⛔ E a negação não tinha como funcionar de jeito nenhum: "afirmar" e
     "citar para desmentir" contêm o MESMO texto. Não existe âncora que separe
     os dois — só a leitura separa.

     ✅ O que segura de verdade é a §7a acima: o cron IMPORTA a constante. A
     verdade do cabeçalho passou a ser consequência do grafo de imports, e não
     algo que uma guarda de texto precise conferir. */
  ok(
    "7a · o cabeçalho REGISTRA que a afirmação antiga era falsa",
    /AVISO_TOKEN_DIAS = 14/.test(tok) && /ela era falsa|Não era/.test(tok),
    "afirmação que muda é apagada, e o motivo fica no lugar dela",
  );

  /* ═══ 7b · O GRUPO NULO — era excluído da consulta ════════════════════
     O `where` era `{ tokenExpiresAt: { not: null, lt: limite } }`. O grupo que
     o próprio módulo chama de "o mais perigoso da base" não gerava aviso
     nenhum — só a tela o mostrava, e é a tela que o cabeçalho diz que o
     usuário pode nunca abrir. */
  ok(
    "linha de base: o módulo chama o desconhecido de o mais perigoso",
    /mais perigoso da base/.test(tok),
  );
  ok(
    "7b · ⛔ o cron NÃO exclui mais o nulo",
    !/tokenExpiresAt:\s*\{\s*not:\s*null/.test(cronCodigo),
    "o `not: null` era o que apagava o grupo inteiro",
  );
  ok(
    "7b · …e a consulta INCLUI o ramo nulo explicitamente",
    /OR:\s*\[\{ tokenExpiresAt: null \}/.test(cronCodigo),
    "pré-filtro grosso de propósito — quem decide é `tokenPedeAtencao`",
  );
  ok(
    "7b · e quem decide passou a ser `token.ts`, não o `where`",
    /tokenPedeAtencao\(estado\)/.test(cronCodigo) &&
      /estadoDoToken\(p\.tokenExpiresAt, agora\)/.test(cronCodigo),
    "o `p.tokenExpiresAt! < agora` não sobrevive à inclusão dos nulos",
  );
  ok(
    "7b · …e o desconhecido de fato pede atenção",
    tokenPedeAtencao(estadoDoToken(null, AGORA)) === true,
    "então ele agora ATRAVESSA a guarda do cron, em vez de nunca chegar nela",
  );
  ok(
    "7b · o denominador da saída é quem PASSOU na guarda",
    /perfisEmRisco: emRisco/.test(cronCodigo) && /perfisConsultados: perfis\.length/.test(cronCodigo),
    "`perfis.length` é o pré-filtro; reportá-lo superestimaria o risco",
  );

  /* ═══ 7c · E o texto matou um defeito de FUSO de graça ════════════════
     A versão anterior formatava a data com `toLocaleDateString("pt-BR")` no
     fuso do PROCESSO, que na Vercel é UTC: um token vencendo às 02h UTC era
     anunciado com a data do dia seguinte para quem está em Brasília. */
  ok(
    "7c · ✅ a notificação não formata mais data no fuso do processo",
    !/toLocaleDateString/.test(cronCodigo),
    "o rótulo é relativo (`Expira em N dias`) e não tem como escorregar de dia",
  );
  ok(
    "7c · …e o texto vem de `token.ts`",
    /rotuloDoToken\(estado\)/.test(cronCodigo) && /detalheDoToken\(estado\)/.test(cronCodigo),
    "tela e notificação dizem a MESMA frase para o mesmo estado",
  );
}

console.log(
  "\n\x1b[32m  ✅ OS DOIS ACHADOS DE 14/08 FORAM CORRIGIDOS:" +
    "\n      (a) o cron tinha `AVISO_TOKEN_DIAS = 14` local enquanto a tela usa 30," +
    "\n          com o cabeçalho jurando que eram o mesmo. Agora ele IMPORTA a" +
    "\n          constante — concordar virou propriedade do grafo de imports." +
    "\n      (b) o `not: null` do `where` apagava o grupo de data desconhecida," +
    "\n          que o próprio módulo chama de o mais perigoso da base." +
    "\n\x1b[33m      ⚠️  Alinhado para CIMA (30): a regra de desempate do dono diz que o" +
    "\n      que não corta informação vence. O custo é VOLUME — a janela vai de" +
    "\n      ≤14 para ≤30 notificações por perfil, uma por dia, e para na" +
    "\n      reconexão.\x1b[0m",
);

console.log("\n\x1b[32m" + n + " asserções, 0 falha(s).\x1b[0m\n");
