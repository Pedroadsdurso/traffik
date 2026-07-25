/**
 * Gera `src/lib/worldGeo.ts` — a geometria dos continentes em **coordenadas
 * geográficas** (lng/lat), não em paths SVG.
 *
 * O globo usa `d3.geoOrthographic`, que precisa reprojetar os pontos a cada
 * frame conforme a rotação — paths SVG pré-renderizados não serviriam.
 *
 * Roda na mão e o resultado é commitado, para o navegador não baixar o
 * TopoJSON (105 KB) nem o topojson-client:
 *   npm i -D world-atlas@2 topojson-client@3
 *   node scripts/gen-world-paths.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { feature } from "topojson-client";

const topo = JSON.parse(readFileSync("node_modules/world-atlas/land-110m.json", "utf8"));
const geo = feature(topo, topo.objects.land);

// 1 casa decimal ≈ 11 km: imperceptível num globo de ~300 px e corta ~40% do peso.
const round = (v) => +v.toFixed(1);
const anel = (r) => r.map(([lng, lat]) => [round(lng), round(lat)]);

const polys = [];
for (const f of geo.features) {
  const g = f.geometry;
  const lista = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  for (const poly of lista) polys.push(poly.map(anel));
}

const out = `// GERADO por scripts/gen-world-paths.mjs — não editar à mão.
// Continentes em lng/lat para o globo ortográfico (d3.geoOrthographic).
// Regerar: veja o cabeçalho do script.
import type { GeoJSON } from "geojson";

export const WORLD_LAND = {
  type: "MultiPolygon",
  coordinates: ${JSON.stringify(polys)},
} as const;
`;
writeFileSync("src/lib/worldGeo.ts", out);
console.log("gerado:", Math.round(out.length / 1024) + "KB,", polys.length, "polígonos");
