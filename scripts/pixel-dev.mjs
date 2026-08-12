/**
 * Dá aos pixels do dev o que faltava: **pixels da Meta e regras de evento**.
 *
 * > ### 🌗 O SEED PRODUZIA ESTADO INCOMPLETO — a família, não um esquecimento
 * >
 * > `seed-dev` criava `PixelConfig` **sem `MetaPixel` e sem `PixelEventRule`**
 * > (medido em 11/08/2026: 0 e 0). O código funcionava, os testes passavam, e a
 * > tela de Pixel & Eventos mostrava, com toda honestidade:
 * >
 * > | | |
 * > |---|---|
 * > | `0 pixels da Meta` em todo pixel | o **fan-out** nunca era exercido |
 * > | **todo evento `desligado`** no diagnóstico | o estado *"ligado e recebendo"* não existia |
 * >
 * > É o mesmo defeito do `n % 2` do BOLETO: **o gerador produz exatamente o
 * > estado que impede de avaliar o que se ia avaliar.** Estado INCOMPLETO engana
 * > diferente de estado errado — o ramo exercido funciona, então nada parece
 * > suspeito, e só um acidente revela que metade do caminho nunca rodou.
 *
 * ## ⛔ Os dois pixels DIVERGEM, e é isso que os torna úteis
 *
 * Dois pixels configurados igual valem por um. A distribuição abaixo existe para
 * que os **quatro** estados por evento apareçam juntos numa tela só:
 *
 * | Estado do diagnóstico | Onde aparece |
 * |---|---|
 * | ligado **e recebendo** | `InitiateCheckout` nos dois (há 35 eventos) |
 * | ligado e **nunca recebido** | `Lead` do pixel B — regra ligada, zero eventos |
 * | **desligado** | `Purchase` do pixel B, `AddToCart` nos dois |
 * | fan-out com N > 1 | o pixel A tem **dois** pixels da Meta |
 *
 * E os dois estados do campo de token (`Já cadastrado` × vazio) exigem um
 * `MetaPixel` **com** e outro **sem** — por isso o par do pixel A.
 *
 * ## Uso
 *
 *   npm run dev:pixel            # aplica no banco de dev que o .env aponta
 *
 * É **idempotente**: apaga os `MetaPixel`/`PixelEventRule` DOS PIXELS `[DEV]` e
 * reinsere. Não toca em pixel que ele não criou, e não recria banco nenhum.
 *
 * ⚠️ O token é encriptado com a MESMA função do app (`encryptSecret`). Um valor
 * cru ali seria estado falso de um jeito que só apareceria no dia em que alguém
 * fosse decriptar — e aí pareceria bug de criptografia.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import pg from "pg";

import { exigirBancoDeDesenvolvimento } from "./guard-db.mjs";

const { encryptSecret } = await import("../src/lib/crypto/secrets.ts");

const MARCA = "[DEV]";
const id = () => "d" + randomUUID().replace(/-/g, "").slice(0, 24);

/**
 * O que cada pixel do seed ganha, por POSIÇÃO na ordem de criação.
 *
 * ⚠️ Por posição, e não por nome: o nome carrega o nome da conta e mudaria junto
 * com ele. `[0]` é o primeiro pixel criado pelo seed, `[1]` o segundo.
 */
const PLANO = [
  {
    metas: [
      { pixelId: "100000000000001", nickname: "Conta principal", token: "EAAG-dev-token-de-mentira-1" },
      { pixelId: "100000000000002", nickname: "Backup — conta secundária", token: null },
    ],
    regras: [
      { tipo: "INITIATE_CHECKOUT", ligada: true, deteccao: { tipo: "clique_checkout" } },
      { tipo: "PURCHASE", ligada: true },
      { tipo: "LEAD", ligada: false },
      { tipo: "ADD_TO_CART", ligada: false },
    ],
  },
  {
    // Um só, e sem apelido: o outro caso do campo, e o outro do fan-out.
    metas: [{ pixelId: "200000000000007", nickname: null, token: null }],
    regras: [
      { tipo: "INITIATE_CHECKOUT", ligada: true, deteccao: { tipo: "clique_checkout" } },
      // 🔴 LIGADO e sem nenhum evento `Lead` no banco: é este que faz o
      // diagnóstico dizer "configurado e nunca recebido" numa regra de verdade.
      { tipo: "LEAD", ligada: true },
      { tipo: "PURCHASE", ligada: false },
      { tipo: "ADD_TO_CART", ligada: false },
    ],
  },
];

/**
 * Aplica o plano. Recebe o executor de SQL para servir aos dois chamadores — o
 * `seed-dev` (que já tem conexão aberta) e a execução avulsa aqui embaixo.
 *
 * ⛔ Uma segunda cópia disto dentro do `seed-dev` divergiria no primeiro ajuste,
 * e aí o banco recriado e o banco completado mostrariam telas diferentes.
 */
export async function completarPixels(q, userId) {
  const { rows: pixels } = await q(
    `SELECT id, name FROM "PixelConfig" WHERE "userId" = $1 AND name LIKE $2 ORDER BY "createdAt"`,
    [userId, `${MARCA}%`],
  );
  const feito = [];

  for (let i = 0; i < pixels.length; i++) {
    const plano = PLANO[i % PLANO.length];
    const px = pixels[i];

    // Idempotência: só as linhas DESTE pixel `[DEV]`, que é do seed.
    await q(`DELETE FROM "MetaPixel" WHERE "pixelConfigId" = $1`, [px.id]);
    await q(`DELETE FROM "PixelEventRule" WHERE "pixelConfigId" = $1`, [px.id]);

    for (const m of plano.metas) {
      await q(
        `INSERT INTO "MetaPixel" ("id","pixelConfigId","pixelId","nickname","accessToken")
         VALUES ($1,$2,$3,$4,$5)`,
        [id(), px.id, m.pixelId, m.nickname, m.token ? encryptSecret(m.token) : null],
      );
    }

    for (const r of plano.regras) {
      await q(
        `INSERT INTO "PixelEventRule"
           ("id","pixelConfigId","eventType","enabled","detection","sendMode","valueMode","updatedAt")
         VALUES ($1,$2,$3::"PixelEventType",$4,$5,'APENAS_APROVADAS','VALOR_DA_VENDA',now())`,
        [id(), px.id, r.tipo, r.ligada, r.deteccao ? JSON.stringify(r.deteccao) : null],
      );
    }

    feito.push({
      pixel: px.name,
      "pixels da Meta": plano.metas.length,
      "com token": plano.metas.filter((m) => m.token).length,
      ligadas: plano.regras.filter((r) => r.ligada).map((r) => r.tipo).join(" · "),
    });
  }

  return feito;
}

/**
 * ⛔ IMPRIME O QUE GEROU, e alguém LÊ.
 *
 * Foi a saída de um script assim que denunciou o BOLETO com 100% de aprovação.
 * Um gerador silencioso produz o estado que ninguém confere.
 */
export function imprimir(feito) {
  if (!feito.length) {
    console.log("\n⚠️  Nenhum PixelConfig [DEV] encontrado — nada a completar.\n");
    return;
  }
  console.table(feito);
  console.log(
    "\nO que abrir para conferir, na tela de Pixel & Eventos:\n" +
      "  • o primeiro pixel mostra `2 pixels da Meta` — o fan-out\n" +
      "  • o `Lead` do segundo fica em `configurado e nunca recebido`\n" +
      "  • o `InitiateCheckout` dos dois aparece LIGADO, com contagem e data\n",
  );
}

// ── Execução avulsa ─────────────────────────────────────────────────────────
/* `import.meta.main` não existe nesta versão do Node, então a distinção entre
   "fui importado" e "fui executado" sai da comparação de URLs.

   ⚠️ **`pathToFileURL`, e não interpolação à mão.** A primeira versão montava
   `file://C:/...` enquanto o Node usa `file:///C:/...` — três barras. A
   comparação dava falso, e o script **saía sem imprimir nada e com código 0**,
   que é indistinguível de "rodou e não havia o que fazer". */
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  exigirBancoDeDesenvolvimento({ script: "pixel-dev" });

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

  imprimir(await completarPixels(q, rows[0].id));
  await cliente.end();
}
