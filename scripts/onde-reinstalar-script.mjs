/**
 * Onde o script de UTM precisa ser reinstalado, por Área de Trabalho.
 *
 * SÓ LEITURA. Cruza as áreas com os cliques já carimbados (`Click.workspaceId`)
 * e com as URLs por onde o tráfego daquela área entrou, para dizer em qual
 * página trocar o script.
 *
 * Uso: node --experimental-strip-types --import ./scripts/alias-loader.mjs scripts/onde-reinstalar-script.mjs
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { carregarMapaDeAreas } from "@/lib/areas/atribuicao";

const users = await prisma.user.findMany({ select: { id: true, email: true } });

for (const u of users) {
  const mapa = await carregarMapaDeAreas(u.id);
  const areas = mapa.areas.filter((a) => !a.archived);
  if (areas.length === 0) continue;

  console.log(`\n\x1b[1m${u.email}\x1b[0m`);

  const cliques = await prisma.click.findMany({
    where: { userId: u.id, timestamp: { gte: new Date(Date.now() - 30 * 864e5) } },
    select: { url: true, utmCampaign: true, workspaceId: true },
  });

  for (const a of areas) {
    const daArea = cliques.filter(
      (c) => mapa.areaDoClique({ utmCampaign: c.utmCampaign, workspaceId: c.workspaceId }).areaId === a.id,
    );
    const carimbados = daArea.filter((c) => c.workspaceId === a.id).length;
    const semCarimbo = daArea.length - carimbados;

    // Páginas por onde o tráfego dessa área entrou — é onde o script vive.
    const paginas = new Map();
    for (const c of daArea) {
      if (!c.url) continue;
      let chave;
      try { const u2 = new URL(c.url); chave = u2.origin + u2.pathname; } catch { chave = c.url; }
      paginas.set(chave, (paginas.get(chave) ?? 0) + 1);
    }
    const top = [...paginas.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5);

    const status = a.isDefault
      ? "\x1b[32mnão precisa\x1b[0m (Principal é o catch-all — o script antigo já cai aqui)"
      : carimbados > 0
        ? `\x1b[32mjá instalado\x1b[0m (${carimbados} clique(s) carimbado(s))`
        : "\x1b[33mREINSTALAR\x1b[0m — nenhum clique carimbado com esta área";

    console.log(`\n  ${a.isDefault ? "🏠" : "📁"} ${a.name}  →  ${status}`);
    if (!a.isDefault && semCarimbo > 0) {
      console.log(`     ${semCarimbo} clique(s) chegaram sem o carimbo nos últimos 30 dias.`);
    }
    if (top.length > 0) {
      console.log("     Páginas por onde o tráfego desta área entrou:");
      for (const [url, n] of top) console.log(`       · ${url}  (${n})`);
    } else {
      console.log("     Nenhum clique com URL nos últimos 30 dias — instale na página de vendas desta operação.");
    }
  }
}

console.log("\nO script de cada área está em Integrações › UTMs, com a área ativa selecionada na barra lateral.\n");
await prisma.$disconnect();
