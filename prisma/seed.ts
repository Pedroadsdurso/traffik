import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const TEST_EMAIL = "teste@traffik.io";
const TEST_PASSWORD = "traffik123";

async function main() {
  const user = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    update: {},
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

  console.log(`Seed pronto. Login: ${TEST_EMAIL} / ${TEST_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
