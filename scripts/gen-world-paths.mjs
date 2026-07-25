/**
 * Gera `src/lib/worldPaths.ts` — os contornos dos continentes já convertidos
 * para paths SVG em projeção equirretangular (viewBox 360×180).
 *
 * Roda UMA VEZ, na mão, e o resultado é commitado — assim o navegador não
 * baixa os 105 KB de TopoJSON nem o topojson-client, e nenhum dos dois fica no
 * package.json da aplicação.
 *
 * Para regerar:
 *   npm i -D world-atlas@2 topojson-client@3
 *   node scripts/gen-world-paths.mjs
 *   npm uninstall world-atlas topojson-client
 */
import { readFileSync, writeFileSync } from "node:fs";
import { feature } from "topojson-client";

const topo = JSON.parse(readFileSync("node_modules/world-atlas/land-110m.json", "utf8"));
const geo = feature(topo, topo.objects.land);

// Equirretangular: lng -180..180 → 0..360 ; lat 90..-90 → 0..180
const px = (lng) => +(lng + 180).toFixed(1);
const py = (lat) => +(90 - lat).toFixed(1);

function anelParaPath(ring) {
  let d = "";
  for (let i = 0; i < ring.length; i++) {
    const [lng, lat] = ring[i];
    d += (i === 0 ? "M" : "L") + px(lng) + " " + py(lat);
  }
  return d + "Z";
}

const partes = [];
for (const f of geo.features) {
  const g = f.geometry;
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  for (const poly of polys) for (const ring of poly) partes.push(anelParaPath(ring));
}

const d = partes.join("");
const out = `// GERADO por scripts/gen-world-paths.mjs — não editar à mão.
// Contorno dos continentes em projeção equirretangular, viewBox 360x180.
// Pré-computado para o navegador não baixar o TopoJSON (105 KB) nem o
// topojson-client. Regerar com: node scripts/gen-world-paths.mjs
export const WORLD_PATH = ${JSON.stringify(d)};
`;
writeFileSync("src/lib/worldPaths.ts", out);
console.log("gerado:", Math.round(out.length / 1024) + "KB,", partes.length, "anéis");
