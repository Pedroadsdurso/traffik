/**
 * Os três efeitos pós-venda anotam o que aconteceu?
 *
 * Purchase na CAPI, InitiateCheckout do gateway e a notificação rodavam com
 * `console.error` e mais nada: o webhook respondia 200, a venda entrava certa, e
 * o efeito falhava sem aparecer em lugar nenhum. As colunas de `Sale` existem
 * para acabar com isso — e uma coluna só vale se **alguém escreve nela**.
 *
 * ## ⛔ Cada asserção precisa poder FALHAR pelo motivo que ela alega medir
 *
 * Contar `enviado` não prova nada: um código que gravasse `enviado` sempre
 * passaria. Por isso quase toda asserção aqui é um **contraste** — dois cenários
 * que o código antigo colapsava num valor só:
 *
 * | Contraste | O colapso que ele pega |
 * |---|---|
 * | `sem_config` × `desligada` | os dois eram `return` mudo; um é bug, o outro é escolha |
 * | `erro` × `ignorado` (checkout) | o `catch` devolvia **literalmente `"ignorado"`** |
 * | `outro_dono` × `sem_pixel` | valor inicial com força 2 descartaria o `outro_dono` |
 * | `erro` × `enviado` (dois pixels) | "o pior vence": um `enviado` esconderia a metade quebrada |
 * | `null` intocado | venda antiga não pode virar "ok" por omissão |
 *
 * ## Escreve no banco de DESENVOLVIMENTO, e limpa por id
 *
 * Passa pelo `guard-db.mjs`. Todo id é coletado na criação e removido no fim —
 * nunca por `LIKE`, nunca por nome.
 *
 *   npm run test:efeitos
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import pg from "pg";

import { prisma } from "@/lib/prisma";
import { registrarCheckoutDoGateway } from "@/lib/webhook/checkoutEvent";
import { dispatchSaleNotification } from "@/lib/webhook/dispatchNotification";
import { dispatchPurchaseEvents } from "@/lib/webhook/dispatchPixel";
import { STATUS_PROBLEMA, situacaoCapi, situacaoCheckout, situacaoNotificacao } from "@/lib/webhook/efeitos";
import { exigirBancoDeDesenvolvimento } from "./guard-db.mjs";

exigirBancoDeDesenvolvimento({ script: "teste-efeitos" });

const cliente = new pg.Client({
  connectionString: (process.env.DIRECT_URL || process.env.DATABASE_URL).split("?")[0],
  ssl: { rejectUnauthorized: false },
});

let ok = 0;
let falhas = 0;
function eq(nome, obtido, esperado) {
  const a = JSON.stringify(obtido);
  const b = JSON.stringify(esperado);
  if (a === b) {
    ok++;
    console.log(`  ✓ ${nome}`);
  } else {
    falhas++;
    console.log(`  ✗ ${nome}\n      obtido:   ${a}\n      esperado: ${b}`);
  }
}
function diferente(nome, obtido, naoPodeSer) {
  if (JSON.stringify(obtido) !== JSON.stringify(naoPodeSer)) {
    ok++;
    console.log(`  ✓ ${nome}`);
  } else {
    falhas++;
    console.log(`  ✗ ${nome}\n      obtido ${JSON.stringify(obtido)} — e este é exatamente o valor que NÃO pode aparecer`);
  }
}

const criados = { users: [], sales: [], pixels: [], eventos: [] };

async function novoUsuario(sufixo) {
  const email = `efeitos-${sufixo}-${randomUUID().slice(0, 8)}@teste.dev`;
  const { rows } = await cliente.query(
    `INSERT INTO "User" (id, email, name, "passwordHash", "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, 'teste efeitos', 'x', now(), now()) RETURNING id`,
    [email],
  );
  criados.users.push(rows[0].id);
  return rows[0].id;
}

async function novaVenda(userId, extra = {}) {
  const { status = "APROVADA", pedidoId = null, valor = 100 } = extra;
  const { rows } = await cliente.query(
    `INSERT INTO "Sale" (id, "externalId", "pedidoId", value, currency, product, status,
                         "paymentMethod", "userId", timestamp, "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, $2, $3, 'BRL', 'Produto de teste', $4::"SaleStatus",
             'PIX', $5, now(), now(), now()) RETURNING id`,
    [`efeitos-${randomUUID().slice(0, 12)}`, pedidoId, valor, status, userId],
  );
  criados.sales.push(rows[0].id);
  return rows[0].id;
}

async function lerVenda(id) {
  const { rows } = await cliente.query(
    `SELECT "capiStatus", "capiErro", "checkoutStatus", "checkoutErro", "notifStatus", "notifErro"
     FROM "Sale" WHERE id = $1`,
    [id],
  );
  return rows[0];
}

async function main() {
  await cliente.connect();

  // ══════════════════════════════════════════════════════════════════
  console.log("\n1. Notificação — o `return` mudo que nunca criava aviso nenhum\n");
  // ══════════════════════════════════════════════════════════════════
  {
    // Usuário SEM NotificationSettings: a função dava `return` e nenhum aviso
    // saía, para nenhuma venda, para sempre.
    const u = await novoUsuario("sem-config");
    const s = await novaVenda(u);
    await dispatchSaleNotification(s);
    const v = await lerVenda(s);
    eq("sem preferências → sem_config", v.notifStatus, "sem_config");
    // 🔴 O contraste: se o código colapsasse os dois `return`, este seria
    // "desligada" — e a tela cobraria do usuário uma escolha que ele nunca fez.
    diferente("sem_config NÃO é confundido com 'você desligou'", v.notifStatus, "desligada");
    eq("sem_config pede ação", situacaoNotificacao(v.notifStatus).tom, "problema");
  }
  {
    const u = await novoUsuario("desligada");
    await cliente.query(
      `INSERT INTO "NotificationSettings" (id, "userId", "notifyApprovedSale", "notifyPendingSale", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, false, false, now(), now())`,
      [u],
    );
    const s = await novaVenda(u);
    await dispatchSaleNotification(s);
    const v = await lerVenda(s);
    eq("aviso desligado pelo usuário → desligada", v.notifStatus, "desligada");
    // A outra ponta do contraste: escolha do usuário não pode virar alarme.
    eq("desligada NÃO pede ação", situacaoNotificacao(v.notifStatus).tom, "neutro");
  }
  {
    const u = await novoUsuario("criada");
    await cliente.query(
      `INSERT INTO "NotificationSettings" (id, "userId", "notifyApprovedSale", "notifyPendingSale", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, true, true, now(), now())`,
      [u],
    );
    const s = await novaVenda(u);
    await dispatchSaleNotification(s);
    const v = await lerVenda(s);
    eq("aviso ligado → criada", v.notifStatus, "criada");
    const { rows } = await cliente.query(`SELECT count(*)::int n FROM "Notification" WHERE "saleId" = $1`, [s]);
    // Prova que `criada` não é só um rótulo: a linha existe mesmo.
    eq("a notificação existe de verdade", rows[0].n, 1);
  }
  {
    const u = await novoUsuario("status");
    const s = await novaVenda(u, { status: "REEMBOLSADA" });
    await dispatchSaleNotification(s);
    const v = await lerVenda(s);
    eq("venda reembolsada → status (não avisamos)", v.notifStatus, "status");
  }

  // ══════════════════════════════════════════════════════════════════
  console.log("\n2. Checkout do gateway — o `catch` que devolvia 'ignorado'\n");
  // ══════════════════════════════════════════════════════════════════
  {
    const u = await novoUsuario("ck-ignorado");
    const s = await novaVenda(u);
    const r = await registrarCheckoutDoGateway(s, false);
    const v = await lerVenda(s);
    eq("venda que não gera checkout → ignorado", [r, v.checkoutStatus], ["ignorado", "ignorado"]);
    eq("ignorado NÃO pede ação", situacaoCheckout(v.checkoutStatus).tom, "neutro");
  }
  {
    const u = await novoUsuario("ck-criado");
    const s = await novaVenda(u, { status: "PENDENTE", pedidoId: `ped-${randomUUID().slice(0, 8)}` });
    const r = await registrarCheckoutDoGateway(s, true);
    const v = await lerVenda(s);
    eq("checkout novo → criado", [r, v.checkoutStatus], ["criado", "criado"]);
    const { rows } = await cliente.query(
      `SELECT count(*)::int n FROM "PixelEvent" WHERE "userId" = $1 AND event = 'InitiateCheckout'`,
      [u],
    );
    eq("o evento entrou no funil de verdade", rows[0].n, 1);

    // Segunda passada: a dedup tem de aparecer como DUPLICADO, não como criado
    // nem como erro. É desfecho correto e não pode pedir ação.
    const r2 = await registrarCheckoutDoGateway(s, true);
    const v2 = await lerVenda(s);
    eq("reentrega → duplicado", [r2, v2.checkoutStatus], ["duplicado", "duplicado"]);
    eq("duplicado NÃO pede ação", situacaoCheckout(v2.checkoutStatus).tom, "neutro");
  }
  {
    /**
     * 🔴 O caso que motivou a mudança: antes, uma exceção aqui devolvia
     * `"ignorado"` — o mesmo valor de "esta venda não gera checkout". Falha e
     * desfecho normal ficavam indistinguíveis, e o funil encolhia sem que nada,
     * em lugar nenhum, dissesse que houve erro.
     *
     * O stub troca exatamente a chamada que o `catch` existe para proteger.
     */
    const u = await novoUsuario("ck-erro");
    const s = await novaVenda(u, { status: "PENDENTE", pedidoId: `ped-${randomUUID().slice(0, 8)}` });
    const original = prisma.pixelEvent.create;
    prisma.pixelEvent.create = () => {
      throw new Error("falha simulada ao gravar o evento");
    };
    let r;
    try {
      r = await registrarCheckoutDoGateway(s, true);
    } finally {
      prisma.pixelEvent.create = original;
    }
    const v = await lerVenda(s);
    eq("exceção → erro", [r, v.checkoutStatus], ["erro", "erro"]);
    diferente("erro NÃO é mais confundido com 'ignorado'", v.checkoutStatus, "ignorado");
    eq("erro pede ação", situacaoCheckout(v.checkoutStatus).tom, "problema");
    eq("a mensagem crua foi guardada", v.checkoutErro, "falha simulada ao gravar o evento");
  }

  // ══════════════════════════════════════════════════════════════════
  console.log("\n3. Purchase na CAPI — os `continue` que perdiam conversão\n");
  // ══════════════════════════════════════════════════════════════════

  // Intercepta a CAPI: nenhuma requisição sai para o Facebook neste teste.
  const fetchReal = globalThis.fetch;
  let respostaDaMeta = () => ({ ok: true, corpo: { events_received: 1 } });
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("facebook.com")) {
      const r = respostaDaMeta(String(init?.body ?? ""));
      return new Response(JSON.stringify(r.corpo), {
        status: r.ok ? 200 : 400,
        headers: { "content-type": "application/json" },
      });
    }
    return fetchReal(url, init);
  };

  async function montarPixel(userId, { token, owners = null, pixelIds = ["100"] }) {
    const { rows } = await cliente.query(
      `INSERT INTO "PixelConfig" (id, name, provider, enabled, "eventOwners", "userId", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, 'pixel de teste', 'META', true, $1::jsonb, $2, now(), now()) RETURNING id`,
      [owners ? JSON.stringify(owners) : null, userId],
    );
    const cfg = rows[0].id;
    criados.pixels.push(cfg);
    await cliente.query(
      `INSERT INTO "PixelEventRule" (id, "pixelConfigId", "eventType", enabled, "sendMode", "valueMode", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, 'PURCHASE', true, 'APENAS_APROVADAS', 'VALOR_DA_VENDA', now(), now())`,
      [cfg],
    );
    for (const pid of pixelIds) {
      await cliente.query(
        `INSERT INTO "MetaPixel" (id, "pixelConfigId", "pixelId", "accessToken", "createdAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, now())`,
        [cfg, pid, token],
      );
    }
    return cfg;
  }

  {
    const u = await novoUsuario("capi-sem-pixel");
    const s = await novaVenda(u);
    await dispatchPurchaseEvents(s);
    const v = await lerVenda(s);
    eq("nenhum pixel cadastrado → sem_pixel", v.capiStatus, "sem_pixel");
    eq("sem_pixel NÃO pede ação urgente", situacaoCapi(v.capiStatus).tom, "neutro");
  }
  {
    /**
     * 🔴 O `continue` mais caro do arquivo: o pixel aparece "Ativo" na tela, a
     * regra está ligada, e `decryptSecretSafe` devolve vazio — nenhuma venda
     * chega ao Facebook, para sempre, sem erro em lugar nenhum.
     */
    const u = await novoUsuario("capi-sem-token");
    await montarPixel(u, { token: null });
    const s = await novaVenda(u);
    await dispatchPurchaseEvents(s);
    const v = await lerVenda(s);
    eq("pixel sem token → sem_token", v.capiStatus, "sem_token");
    eq("sem_token PEDE ação", situacaoCapi(v.capiStatus).tom, "problema");
    // O contraste que importa: sem token e sem pixel parecem iguais de longe, e
    // só um dos dois é bug.
    diferente("sem_token NÃO é confundido com sem_pixel", v.capiStatus, "sem_pixel");
  }
  {
    const u = await novoUsuario("capi-ok");
    await montarPixel(u, { token: "tok-de-teste" });
    const s = await novaVenda(u);
    respostaDaMeta = () => ({ ok: true, corpo: { events_received: 1 } });
    await dispatchPurchaseEvents(s);
    const v = await lerVenda(s);
    eq("pixel com token e Meta aceitando → enviado", v.capiStatus, "enviado");
    eq("enviado não guarda erro", v.capiErro, null);
  }
  {
    const u = await novoUsuario("capi-erro");
    await montarPixel(u, { token: "tok-ruim" });
    const s = await novaVenda(u);
    respostaDaMeta = () => ({ ok: false, corpo: { error: { message: "Malformed access token" } } });
    await dispatchPurchaseEvents(s);
    const v = await lerVenda(s);
    eq("Meta recusa → erro", v.capiStatus, "erro");
    eq("a mensagem da Meta foi guardada crua", /Malformed access token/.test(v.capiErro ?? ""), true);
    eq("o pixel que falhou é nomeado", /pixel 100/.test(v.capiErro ?? ""), true);
  }
  {
    /**
     * Dois pixels da Meta, um aceita e outro recusa. A coluna guarda UM valor,
     * então o pior tem de vencer — um `enviado` aqui esconderia exatamente a
     * metade que precisa de ação.
     */
    const u = await novoUsuario("capi-misto");
    await montarPixel(u, { token: "tok", pixelIds: ["200", "201"] });
    const s = await novaVenda(u);
    let n = 0;
    respostaDaMeta = () => {
      n++;
      return n === 1
        ? { ok: true, corpo: { events_received: 1 } }
        : { ok: false, corpo: { error: { message: "Invalid pixel" } } };
    };
    await dispatchPurchaseEvents(s);
    const v = await lerVenda(s);
    eq("um pixel ok + um recusado → erro (o pior vence)", v.capiStatus, "erro");
    diferente("o sucesso parcial NÃO esconde a falha", v.capiStatus, "enviado");
  }
  {
    /**
     * 🔴 Este cenário pega um bug que eu introduzi e corrigi: com `pior`
     * começando em `sem_pixel` (força 2), um `outro_dono` (força 0) nunca
     * sobrescreveria — e a venda de quem configurou a partição CORRETAMENTE
     * apareceria como "nenhum pixel configurado".
     */
    const u = await novoUsuario("capi-outro-dono");
    await montarPixel(u, { token: "tok", owners: { Purchase: "navegador" } });
    const s = await novaVenda(u);
    respostaDaMeta = () => ({ ok: true, corpo: { events_received: 1 } });
    await dispatchPurchaseEvents(s);
    const v = await lerVenda(s);
    eq("partição diz que outro envia → outro_dono", v.capiStatus, "outro_dono");
    diferente("outro_dono NÃO é engolido por sem_pixel", v.capiStatus, "sem_pixel");
    eq("outro_dono é configuração, não falha", situacaoCapi(v.capiStatus).tom, "neutro");
  }

  globalThis.fetch = fetchReal;

  // ══════════════════════════════════════════════════════════════════
  console.log("\n4. NULO é ausência de informação, nunca alarme\n");
  // ══════════════════════════════════════════════════════════════════
  {
    const u = await novoUsuario("nulo");
    const s = await novaVenda(u);
    const v = await lerVenda(s);
    eq("venda nunca despachada fica nula nos três", [v.capiStatus, v.checkoutStatus, v.notifStatus], [null, null, null]);
    // A tela não pode afirmar nada sobre ela — nem "ok", nem "falhou".
    eq("nulo não vira situação", [situacaoCapi(null), situacaoCheckout(null), situacaoNotificacao(null)], [null, null, null]);
  }
  {
    // Status desconhecido (gravado por código novo, não cadastrado na tela) vira
    // problema e aparece CRU — nunca um "ok" por omissão.
    const s = situacaoCapi("inventado_amanha");
    eq("status desconhecido pede correção", s.tom, "problema");
    eq("status desconhecido aparece cru", s.rotulo, "inventado_amanha");
  }
  {
    // A lista de "o que pede ação" é derivada das tabelas — se alguém
    // acrescentar um status `problema` sem tocar aqui, ele entra sozinho.
    eq("STATUS_PROBLEMA sai das tabelas", STATUS_PROBLEMA.capi.sort(), ["erro", "sem_token"]);
    eq("checkout tem um problema só", STATUS_PROBLEMA.checkout, ["erro"]);
    eq("notif tem dois", STATUS_PROBLEMA.notif.sort(), ["erro", "sem_config"]);
  }

  console.log(`\n${ok} asserções, ${falhas} falha(s).\n`);
}

main()
  .catch((e) => {
    console.error(e);
    falhas++;
  })
  .finally(async () => {
    // Limpeza por id coletado na criação — nunca por LIKE, nunca por nome.
    for (const id of criados.users) {
      await cliente.query(`DELETE FROM "User" WHERE id = $1`, [id]).catch(() => {});
    }
    await cliente.end().catch(() => {});
    await prisma.$disconnect().catch(() => {});
    process.exit(falhas > 0 ? 1 : 0);
  });
