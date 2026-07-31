/**
 * Seed da conta de desenvolvimento.
 *
 * ## 🔴 POR QUE ESTE ARQUIVO TEM DUAS TRAVAS
 *
 * A senha desta conta era **literal no código-fonte**, e a conta
 * existia **no banco de produção**: qualquer pessoa com acesso ao repositório
 * tinha sessão válida no ambiente real. O isolamento por `userId` impedia que
 * ela visse os dados do dono — e **não** impedia a sessão: dentro dela dá para
 * criar webhook, conectar Facebook e gerar chave de API.
 *
 * > **Credencial em código-fonte é vazamento mesmo com o isolamento correto.**
 * > O isolamento protege os dados; ele não impede a sessão.
 *
 * As duas travas são independentes de propósito — cada uma sozinha já bastaria,
 * e é justamente por isso que as duas ficam:
 *
 *  1. **`exigirBancoDeDesenvolvimento()`** — mesma trava dos demais scripts de
 *     escrita. O seed recusa rodar contra um banco que não esteja na lista de
 *     permissão. É o que impede a conta de **voltar a existir** em produção.
 *  2. **Senha por variável de ambiente** (`SEED_PASSWORD`). Sem ela o seed
 *     **gera uma aleatória e a imprime uma vez**. Nenhuma senha volta ao
 *     código-fonte, nem mesmo para desenvolvimento.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { exigirBancoDeDesenvolvimento } from "../scripts/guard-db.mjs";

// ⛔ ANTES de abrir conexão. A dúvida vira bloqueio, como no resto do projeto:
// ref desconhecido é recusado, não liberado.
exigirBancoDeDesenvolvimento({ script: "prisma db seed" });

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const TEST_EMAIL = "teste@traffik.io";

/**
 * ⚠️ NUNCA volte a escrever uma senha literal aqui. Sem `SEED_PASSWORD`, uma
 * aleatória é gerada e impressa uma única vez — o que é seguro por construção:
 * não existe valor conhecido para vazar.
 */
const SENHA_GERADA = !process.env.SEED_PASSWORD;
const TEST_PASSWORD = process.env.SEED_PASSWORD || randomBytes(12).toString("base64url");

async function main() {
  // ⚠️ `update` reescreve o hash: sem isto, rodar o seed de novo numa base que
  // já tem a conta manteria a senha ANTIGA — inclusive a literal legada, se
  // a linha tiver sobrevivido. Rodar o seed passa a ser a forma de rotacionar.
  const user = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    update: { passwordHash: await bcrypt.hash(TEST_PASSWORD, 10) },
    create: {
      name: "Usuário de Teste",
      email: TEST_EMAIL,
      passwordHash: await bcrypt.hash(TEST_PASSWORD, 10),
      notificationSettings: { create: {} },
      dashboardPreference: { create: {} },
    },
  });

  const webhookCount = await prisma.webhook.count({ where: { userId: user.id } });
  if (webhookCount === 0) {
    await prisma.webhook.create({
      data: { userId: user.id, name: "Webhook principal", platform: "CUSTOM" },
    });
  }

  // Taxas de exemplo para o cálculo de lucro (Fase 13).
  const expenseCount = await prisma.expense.count({ where: { userId: user.id } });
  if (expenseCount === 0) {
    await prisma.expense.createMany({
      data: [
        { userId: user.id, name: "Taxa Pix", type: "TAXA_GATEWAY", calc: "PERCENTUAL", amount: 0.99, paymentMethod: "PIX" },
        { userId: user.id, name: "Taxa Cartão", type: "TAXA_GATEWAY", calc: "PERCENTUAL", amount: 4.99, paymentMethod: "CARTAO" },
        { userId: user.id, name: "Imposto sobre vendas", type: "IMPOSTO", calc: "PERCENTUAL", amount: 6 },
      ],
    });
  }

  console.log(`\nSeed pronto. Login: ${TEST_EMAIL} / ${TEST_PASSWORD}`);
  if (SENHA_GERADA) {
    console.log(
      "\n⚠️  Senha ALEATÓRIA — ela não é gravada em lugar nenhum e não aparece de novo.\n" +
        "    Para fixar uma, defina SEED_PASSWORD no .env (que é gitignored).\n",
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
