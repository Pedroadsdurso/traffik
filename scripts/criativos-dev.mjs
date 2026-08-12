/**
 * Dá ao dev o que a tela de Criativos precisa para ser AVALIADA: **criativos,
 * série de vários dias e atribuição de venda**.
 *
 * > ### 🌗 O SEED NÃO PRODUZIA ESTADO INCOMPLETO. NÃO PRODUZIA ESTADO NENHUM.
 * >
 * > Medido em 12/08/2026, contra o banco de dev:
 * >
 * > | | |
 * > |---|---|
 * > | `Creative` | **0 linhas** — e `computeCreatives` filtra `creative: { isNot: null }` |
 * > | `Sale.utmContent` / `Click.utmContent` | **NULL nas 47 vendas aprovadas** |
 * > | `DailyAdMetric` | **1 dia por anúncio** (`2026-08-07`) |
 * >
 * > Ou seja: a tela saía **vazia**; se não saísse, todo ROAS por criativo seria
 * > `—` por falta de atribuição; e se houvesse atribuição, a aba **Em queda** —
 * > a que justifica a tela existir — não teria duas janelas para comparar.
 * >
 * > Três camadas, e cada uma sozinha já esvaziava a tela.
 *
 * ## ⛔ OS ESTADOS DIVERGEM DE PROPÓSITO — é o que torna o seed útil
 *
 * A regra desta base é que o gerador não pode produzir o estado que impede de
 * ver o que se ia verificar (o `n % 2` do BOLETO). Então:
 *
 * | Eixo | Divergência plantada |
 * |---|---|
 * | **mídia** | imagem que CARREGA · thumbnail EXPIRADA da Meta · nada |
 * | **formato** | vídeo e imagem, na proporção que produção tem (12 de 13 são vídeo) |
 * | **tendência** | criativos em QUEDA, em ALTA e ESTÁVEIS na mesma janela |
 * | **medição** | um anúncio **sem métrica nenhuma** — `—`, não zero |
 * | **atribuição** | parte das vendas carimbada, parte não |
 *
 * ### 🔴 A THUMBNAIL EXPIRADA É O ITEM MAIS IMPORTANTE DAQUI
 *
 * Medido no backup de produção de 01/08/2026, nos **13 de 13** criativos reais:
 * `thumbnailUrl` é uma URL assinada da Meta com `oe=` (expiração) entre **34h e
 * 4,5 dias** após o sync — e **`_p64x64`**, ou seja 64 pixels de lado.
 *
 * Hoje (12/08) as treze estão vencidas há uma semana. O estado NORMAL desta tela
 * em produção é a imagem não carregar, e por isso ele precisa existir no dev.
 *
 * ⚠️ **O que este script NÃO consegue exercitar:** uma URL REMOTA da Meta que
 * carrega. Isso exige token válido e sync recente, que o dev não tem. A imagem
 * que carrega aqui é um `data:` URI sintético — ele prova o caminho do `<img>`
 * bem-sucedido, não a integração com o CDN da Meta.
 *
 * ## Uso
 *
 *   npm run dev:criativos        # aplica no banco de dev que o .env aponta
 *
 * É **idempotente** e **determinístico**: os criativos são procurados antes de
 * criados, a série sai de `índice` (nunca de `random()`), e o carimbo de UTM só
 * escreve onde está NULL.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import pg from "pg";

import { exigirBancoDeDesenvolvimento } from "./guard-db.mjs";

const MARCA = "[DEV]";
const id = () => "d" + randomUUID().replace(/-/g, "").slice(0, 24);

/**
 * Dias de série por anúncio.
 *
 * ⚠️ Precisa ser PAR e ≥ 4: a aba `Em queda` parte a janela ao meio e compara as
 * metades. Com 1 dia — que era o estado do dev — não há o que comparar, e a aba
 * sairia vazia sem que nada denunciasse o motivo.
 */
const DIAS = 14;

/**
 * Uma URL assinada REAL da Meta, colhida do backup de produção de 01/08/2026 e
 * já vencida (`oe=6A6F554C` → 02/08/2026 14:33).
 *
 * ⛔ Não a "conserte" trocando por uma que funcione. Ela está aqui exatamente
 * porque **não** carrega: é o estado normal desta tela em produção, e é o único
 * jeito de o fallback tipográfico ser exercido no dev.
 *
 * ⚠️ O host é o real para o `onError` disparar pelo motivo certo (403 do CDN da
 * Meta), e não por um domínio que não resolve — que é outro modo de falha.
 */
const THUMB_EXPIRADA =
  "https://scontent-iad3-1.xx.fbcdn.net/v/t15.5256-10/758563068_2247523632746661_2916690616326362806_n.jpg" +
  "?_nc_cat=110&ccb=1-7&stp=c0.5000x0.5000f_dst-emg0_p64x64_q75_tt6&oh=00_AQFBOjPgWS2oTar3fUvFhAnKPnO2ykLqXZXf2QR7XSkDKw&oe=6A6F554C";

/** Uma imagem sintética que CARREGA — sem rede, sem expiração. */
function imagemSintetica(rotulo, matiz) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="hsl(${matiz} 70% 45%)"/>` +
    `<stop offset="1" stop-color="hsl(${(matiz + 40) % 360} 70% 28%)"/>` +
    `</linearGradient></defs>` +
    `<rect width="640" height="360" fill="url(#g)"/>` +
    `<text x="32" y="320" font-family="sans-serif" font-size="34" font-weight="700" fill="#fff" opacity=".92">` +
    rotulo.replace(/[<>&]/g, "") +
    `</text></svg>`;
  return "data:image/svg+xml;base64," + Buffer.from(svg, "utf8").toString("base64");
}

/**
 * O plano por POSIÇÃO na ordem alfabética dos anúncios `[DEV]`.
 *
 * ⚠️ Por posição, e não por nome: o nome do anúncio carrega o nome da campanha e
 * mudaria junto com ele — foi assim que renomear campanha zerou a receita de
 * duas, em 07/08.
 *
 * `tendencia` multiplica a segunda metade da janela. `1` é estável.
 */
const PLANO = [
  { midia: "imagem", titulo: "Prova social — depoimento em vídeo", tendencia: 0.42, matiz: 210 },
  { midia: "expirada", titulo: "Oferta de lançamento — carrossel", tendencia: 1.0, matiz: 0 },
  { midia: "vazia", titulo: null, tendencia: 1.0, matiz: 0 },
  { midia: "expirada", titulo: "Antes e depois — imagem única", tendencia: 0.55, matiz: 0 },
  { midia: "imagem", titulo: "Bastidores — vertical 9:16", tendencia: 1.9, matiz: 145 },
  { midia: "expirada", titulo: "Depoimento da cliente — 30s", tendencia: 1.0, matiz: 0 },
  { midia: "imagem", titulo: "Comparativo de preço — estático", tendencia: 0.68, matiz: 32 },
  { midia: "vazia", titulo: null, tendencia: 1.0, matiz: 0 },
  { midia: "expirada", titulo: "Unboxing — 15s", tendencia: 1.35, matiz: 0 },
  { midia: "expirada", titulo: "Chamada direta — texto grande", tendencia: 0.71, matiz: 0 },
  { midia: "imagem", titulo: "Kit completo — foto de produto", tendencia: 1.0, matiz: 275 },
  { midia: "expirada", titulo: "Contagem regressiva — story", tendencia: 1.0, matiz: 0 },
];

/**
 * Volume base por posição. Determinístico e coprimo com o tamanho do `PLANO`
 * (12): sem isso, `índice % N` e `índice % M` compartilhando fator fazem uma
 * categoria inteira cair sempre do mesmo lado da segunda decisão.
 */
const BASE = [1900, 1450, 3100, 880, 2400, 1200, 1750, 640, 2900, 1050, 2200, 1600];

export async function completarCriativos(q, userId) {
  const { rows: ads } = await q(
    `SELECT a.id, a."fbAdId", a.name, a.status
       FROM "Ad" a
       JOIN "AdAccount" ac ON ac.id = a."adAccountId"
      WHERE ac."userId" = $1 AND a.name LIKE $2
      ORDER BY a.name`,
    [userId, `${MARCA}%`],
  );
  if (!ads.length) return { criativos: [], utms: null };

  const feito = [];

  for (let i = 0; i < ads.length; i++) {
    const a = ads[i];
    const p = PLANO[i % PLANO.length];

    /* ── 1. O criativo ─────────────────────────────────────────────────────
       O `Rascunho Importado` fica SEM criativo de propósito: ele é o anúncio
       que a Meta ainda não devolveu, e `computeCreatives` o exclui. É o estado
       "existe e não foi medido", que some se todo anúncio tiver criativo. */
    const rascunho = a.name.includes("Rascunho Importado");
    if (rascunho) {
      feito.push({ anúncio: a.name.replace(`${MARCA} `, ""), mídia: "— sem criativo —", formato: "—", tendência: "—" });
      continue;
    }

    const video = p.midia !== "imagem";
    const thumb =
      p.midia === "imagem" ? imagemSintetica(p.titulo, p.matiz) : p.midia === "expirada" ? THUMB_EXPIRADA : null;

    const { rows: existe } = await q(`SELECT id FROM "Creative" WHERE "adId" = $1`, [a.id]);
    const dados = [
      p.titulo ?? a.name.replace(` — Criativo`, ""),
      p.titulo,
      thumb,
      /* `imageUrl` só na mídia sintética. Em produção ele existe em 1 de 13:
         os outros são vídeo e não têm imagem estática nenhuma. */
      p.midia === "imagem" ? thumb : null,
      video ? `video-dev-${i + 1}` : null,
    ];
    if (existe[0]) {
      await q(
        `UPDATE "Creative" SET name=$2, title=$3, "thumbnailUrl"=$4, "imageUrl"=$5, "videoId"=$6, "updatedAt"=now() WHERE id=$1`,
        [existe[0].id, ...dados],
      );
    } else {
      await q(
        `INSERT INTO "Creative" (id,"adId",name,title,"thumbnailUrl","imageUrl","videoId","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,now())`,
        [id(), a.id, ...dados],
      );
    }

    /* ── 2. A série de DIAS dias ───────────────────────────────────────────
       Sem ela a aba `Em queda` não tem duas metades para comparar. O dia sai do
       fuso de São Paulo, nunca de `CURRENT_DATE` — que é o dia do BANCO, em UTC,
       e faz o teste passar de dia depois das 21h. */
    const base = BASE[i % BASE.length];
    let dias = 0;
    for (let d = DIAS - 1; d >= 0; d--) {
      /* ⛔ A tendência é GRADUAL ao longo dos dias, não um degrau na metade.
         A primeira versão aplicava o fator só nos 7 dias mais recentes — e o
         período padrão da tela é **Últimos 7 dias**, ou seja, a janela inteira
         caía do mesmo lado do degrau. Resultado: `Em queda 0` na tela, com
         quatro criativos plantados em queda.

         🔴 É a família de sempre: **o gerador produzindo exatamente o estado
         que impede de ver o que se ia verificar** — e a aba invisível era a
         que justifica a tela existir. Descoberto na passada visual, não pelo
         teste: as asserções exercitam a função com metades sintéticas e não
         sabem que janela a tela pede.

         Com a rampa, qualquer janela de 4 dias ou mais vê a inclinação. */
      const progresso = (DIAS - 1 - d) / (DIAS - 1);
      const fator = 1 + (p.tendencia - 1) * progresso;
      const recente = d < DIAS / 2;
      /* Ondulação determinística por dia: sem ela a série é uma reta e o
         gráfico não mostra que houve medição diária. */
      const onda = 1 + 0.14 * Math.sin(d * 1.1 + i);
      const impressoes = Math.round(base * onda * fator);
      const cliques = Math.max(1, Math.round(impressoes * 0.021 * (recente ? fator : 1)));
      const gasto = +(impressoes * 0.0125).toFixed(2);
      await q(
        `INSERT INTO "DailyAdMetric" (id,"adId",date,spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,"updatedAt")
         VALUES ($1,$2,((now() AT TIME ZONE 'America/Sao_Paulo')::date - $3::int),$4,$5,$6,$7,$8,$9,$10,$11,now())
         ON CONFLICT ("adId",date) DO UPDATE SET
           spend=EXCLUDED.spend, impressions=EXCLUDED.impressions, clicks=EXCLUDED.clicks,
           ctr=EXCLUDED.ctr, cpc=EXCLUDED.cpc, cpm=EXCLUDED.cpm, reach=EXCLUDED.reach,
           frequency=EXCLUDED.frequency, "updatedAt"=now()`,
        [
          id(),
          a.id,
          d,
          gasto,
          impressoes,
          cliques,
          +((cliques / impressoes) * 100).toFixed(4),
          +(gasto / cliques).toFixed(4),
          +((gasto / impressoes) * 1000).toFixed(4),
          Math.round(impressoes * 0.78),
          +(1 / 0.78).toFixed(2),
        ],
      );
      dias++;
    }

    feito.push({
      anúncio: a.name.replace(`${MARCA} `, ""),
      mídia: { imagem: "carrega", expirada: "🔴 EXPIRADA (Meta)", vazia: "nenhuma" }[p.midia],
      formato: video ? "Vídeo" : "Imagem",
      dias,
      tendência: p.tendencia < 0.9 ? `↓ ${Math.round((1 - p.tendencia) * 100)}%` : p.tendencia > 1.1 ? `↑ ${Math.round((p.tendencia - 1) * 100)}%` : "estável",
    });
  }

  /* ── 3. Atribuição venda → criativo ───────────────────────────────────────
     Sem `utmContent` nenhuma venda casa com anúncio, e TODO ROAS por criativo
     sai `—`. Carimbamos no CLIQUE, que é a fonte que produção usa — a cópia na
     `Sale` é o seguro para quando o clique some.

     ⛔ Só ~2/3 dos cliques: o criativo SEM venda atribuída é um estado real e
     precisa continuar visível. Carimbar todos produziria o estado que impede de
     ver o que se ia verificar.

     > ### 🔴 A NUMERAÇÃO CORRE SOBRE **TODOS** OS CLIQUES, NÃO SÓ OS NULOS
     >
     > A primeira versão filtrava `utmContent IS NULL` na própria consulta, e com
     > isso **não era idempotente**: cada execução renumerava só os que sobraram
     > e carimbava 2/3 DELES. Medido — 1ª execução deixaria 19 sem atribuição, a
     > 2ª deixaria ~6, a 3ª ~2. O estado que o script existe para criar era
     > consumido pelo próprio script, em três execuções.
     >
     > Numerando sobre a população inteira, `n % 3` é uma propriedade fixa do
     > clique: rodar de novo reescreve o mesmo valor nos mesmos, e o terço de
     > fora é sempre o mesmo terço. */
  const nomes = ads.filter((a) => !a.name.includes("Rascunho Importado")).map((a) => a.name);
  const { rows: alvo } = await q(
    `SELECT cl.id, row_number() OVER (ORDER BY cl.timestamp, cl.id) AS n
       FROM "Click" cl
      WHERE cl."userId" = $1
      ORDER BY cl.timestamp, cl.id`,
    [userId],
  );
  let carimbados = 0;
  for (const c of alvo) {
    /* 3 é coprimo com 12 (o tamanho de `nomes`), então o terço que fica de fora
       não recai sempre nos mesmos anúncios. */
    if (Number(c.n) % 3 === 0) continue;
    await q(`UPDATE "Click" SET "utmContent" = $2 WHERE id = $1`, [c.id, nomes[Number(c.n) % nomes.length]]);
    carimbados++;
  }

  return { criativos: feito, utms: { carimbados, deixados: alvo.length - carimbados } };
}

/**
 * ⛔ IMPRIME O QUE GEROU, e alguém LÊ.
 *
 * Foi a saída de um script assim que denunciou o BOLETO com 100% de aprovação —
 * e foi a saída VAZIA que denunciou o `pathToFileURL` errado no Windows.
 */
export function imprimir({ criativos, utms }) {
  if (!criativos.length) {
    console.log("\n⚠️  Nenhum Ad [DEV] encontrado — rode `npm run dev:campanhas` antes.\n");
    return;
  }
  console.table(criativos);
  if (utms) console.log(`\nUTMs: ${utms.carimbados} cliques carimbados, ${utms.deixados} deixados sem atribuição (de propósito).`);
  console.log(
    "\nO que abrir para conferir, na tela de Criativos:\n" +
      "  • os cards `🔴 EXPIRADA` são o caso NORMAL de produção — eles têm de cair\n" +
      "    no bloco tipográfico com o selo de pré-visualização indisponível\n" +
      "  • `Rascunho Importado` não aparece: anúncio sem criativo fica FORA da tela\n" +
      "  • a aba `Em queda` precisa listar os `↓` e NENHUM dos `↑` ou `estável`\n" +
      "  • parte dos criativos fica sem venda atribuída — ROAS `—`, e isso é correto\n" +
      "\n⚠️  A imagem que CARREGA aqui é um `data:` URI sintético. Nenhum dev exercita\n" +
      "    a URL remota viva da Meta: ela exige token válido e sync recente.\n",
  );
}

// ── Execução avulsa ─────────────────────────────────────────────────────────
/* ⚠️ `pathToFileURL`, e não interpolação à mão: no Windows o Node usa
   `file:///C:/...` — três barras — e a comparação montada à mão dava falso. */
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  exigirBancoDeDesenvolvimento({ script: "criativos-dev" });

  const cliente = new pg.Client({
    connectionString: (process.env.DATABASE_URL ?? "").split("?")[0],
    ssl: process.env.DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false },
  });
  await cliente.connect();
  const q = (sql, params = []) => cliente.query(sql, params);

  const { rows } = await q(`SELECT id FROM "User" WHERE email = $1`, ["dev@exemplo.dev"]);
  if (!rows[0]) {
    console.log("\n⚠️  Usuário dev@exemplo.dev não existe. Rode `npm run seed:dev` antes.\n");
    await cliente.end();
    process.exit(1);
  }

  imprimir(await completarCriativos(q, rows[0].id));
  await cliente.end();
}
