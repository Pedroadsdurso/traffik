import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const SOURCES = ["facebook", "instagram", "google"];
const CAMPAIGNS = ["lancamento-metodo-foco", "remarketing-vsl", "promo-julho"];
const PRODUCTS = [
  { name: "Método Foco 3.0", value: 497 },
  { name: "Mentoria Alta Renda", value: 1997 },
  { name: "E-book Gatilhos", value: 47 },
];
const PAYMENTS = ["PIX", "CARTAO", "BOLETO"];

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function daysAgo(n, jitterHours = 0) {
  return new Date(Date.now() - n * 864e5 - jitterHours * 36e5);
}

async function main() {
  const user = await prisma.user.findUnique({ where: { email: "teste@traffik.io" }, select: { id: true } });
  if (!user) throw new Error("Usuário de teste não encontrado. Rode `npx prisma db seed` antes.");
  const userId = user.id;

  // Limpa dados demo anteriores (mantém os poucos de teste manual, se houver).
  await prisma.sale.deleteMany({ where: { userId, externalId: { startsWith: "DEMO-" } } });
  await prisma.click.deleteMany({ where: { userId, fbclid: { startsWith: "demo-" } } });

  let created = 0;
  for (let day = 6; day >= 0; day--) {
    // 6 a 14 cliques por dia
    const clicksToday = 6 + Math.floor(Math.random() * 8);
    for (let c = 0; c < clicksToday; c++) {
      const source = rand(SOURCES);
      const campaign = rand(CAMPAIGNS);
      const ts = daysAgo(day, Math.random() * 20);
      const click = await prisma.click.create({
        data: {
          userId,
          clickId: crypto.randomUUID(),
          utmSource: source,
          utmMedium: "cpc",
          utmCampaign: campaign,
          utmContent: "criativo-" + (1 + Math.floor(Math.random() * 4)),
          fbclid: "demo-" + Math.random().toString(36).slice(2, 10),
          url: "https://loja.com/checkout",
          referrer: source === "google" ? "https://google.com" : "https://instagram.com",
          ip: "203.0.113." + Math.floor(Math.random() * 250),
          country: "BR",
          timestamp: ts,
        },
      });

      // ~35% dos cliques viram venda; a maioria aprovada
      if (Math.random() < 0.35) {
        const prod = rand(PRODUCTS);
        const r = Math.random();
        const status = r < 0.8 ? "APROVADA" : r < 0.9 ? "PENDENTE" : "REEMBOLSADA";
        const saleTs = new Date(click.timestamp.getTime() + Math.random() * 36e5);
        await prisma.sale.create({
          data: {
            userId,
            externalId: "DEMO-" + click.id,
            value: prod.value,
            product: prod.name,
            status,
            paymentMethod: rand(PAYMENTS),
            buyerEmail: `comprador${created}@example.com`,
            buyerName: "Comprador " + created,
            country: "BR",
            matchMethod: "direct",
            clickId: click.id,
            approvedAt: status === "APROVADA" ? saleTs : null,
            timestamp: saleTs,
          },
        });
        created++;
      }
    }
  }

  const totals = await prisma.sale.groupBy({ by: ["status"], where: { userId }, _count: true, _sum: { value: true } });
  console.log("Vendas por status:", JSON.stringify(totals.map((t) => ({ status: t.status, count: t._count, total: String(t._sum.value) }))));
  const clickCount = await prisma.click.count({ where: { userId } });
  console.log("Cliques totais:", clickCount);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
