/**
 * Gera os ativos de marca do TrackHub a partir dos 3 PNGs de origem.
 *
 * ## Por que existe, em vez de usar o arquivo cru
 *
 * Medido em 05/08/2026:
 *
 * | Origem | Conteúdo útil | Padding |
 * |---|---|---|
 * | `logo tema claro.png` 1774×887 | 1515×385 (3,94:1) | **57% vertical** |
 * | `logo tema escuro.png` 1774×887 | 1497×376 (3,98:1) | **58% vertical** |
 * | `favicon.png` 1254² | 990×1009 | 20% |
 *
 * Renderizar o wordmark cru por `max-width` deixa a marca visível com 43% da
 * altura da caixa. É exatamente a armadilha que a logo da OnyxPag já custou aqui
 * ("wordmark largo tem de ser quadrado antes de virar .webp").
 *
 * E o `favicon.png` traz um **quadrado claro assado**: serve como ícone de app e
 * é inutilizável no rail de 56px, onde viraria um azulejo branco sobre `#090D14`.
 * O símbolo transparente é recortado do próprio wordmark, que tem alpha.
 *
 * ⚠️ **A saída é COMMITADA**, mesma escolha do `gen-world-paths.mjs` e do
 * `gen-favicon.mjs`: `npm run dev` serve sem passo extra e nenhum deploy sobe sem
 * os arquivos.
 *
 *   npm run marca:gerar
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ORIGEM = "C:/Users/teste/OneDrive/Documentos/dashboard/trackhub";
const SAIDA = "public/marca";
const APP = "src/app";

const fontes = {
  favicon: path.join(ORIGEM, "favicon.png"),
  claro: path.join(ORIGEM, "logo tema claro.png"),
  escuro: path.join(ORIGEM, "logo tema escuro.png"),
};
for (const [k, f] of Object.entries(fontes)) {
  if (!fs.existsSync(f)) {
    console.error(`✗ origem ausente (${k}): ${f}`);
    process.exit(1);
  }
}
fs.mkdirSync(SAIDA, { recursive: true });

/** Caixa do conteúdo real (alpha > limiar), em pixels. */
async function caixa(arquivo) {
  const { data, info } = await sharp(arquivo).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * C + 3] > 12) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1, W, H, data, C };
}

/**
 * Acha onde o SÍMBOLO termina e o wordmark começa: a primeira coluna vazia
 * larga o suficiente depois do início do conteúdo.
 *
 * ⚠️ O limiar de "vazio" precisa ser uma FAIXA, não uma coluna: o traço do
 * símbolo tem antialiasing, e uma única coluna quase-vazia aparece dentro dele.
 */
function fimDoSimbolo(c) {
  const vazia = (x) => {
    for (let y = c.top; y <= c.top + c.height - 1; y++) if (c.data[(y * c.W + x) * c.C + 3] > 12) return false;
    return true;
  };
  const MIN_VAO = Math.round(c.height * 0.12); // vão real entre marca e texto
  let corrida = 0;
  for (let x = c.left; x < c.left + c.width; x++) {
    if (vazia(x)) {
      if (++corrida >= MIN_VAO) return x - corrida + 1;
    } else corrida = 0;
  }
  return null;
}

const feito = [];
const reg = (f) => feito.push(`${f}  ${(fs.statSync(f).size / 1024).toFixed(1)} KB`);

// ── 1. Símbolo transparente, quadrado — UM POR TEMA ────────────────────────
//
// 🔴 O símbolo NÃO é o mesmo nos dois arquivos, e recortar só de um produz um
// traço invisível. No `logo tema claro.png` a aresta inferior é azul-MARINHO
// (quase preto); sobre o fundo `#090D14` do tema escuro ela desaparece. No
// `logo tema escuro.png` a mesma aresta é AZUL.
//
// Descoberto olhando o PNG gerado, não a saída do script: o recorte "funcionou"
// nas duas vezes. É a regra da casa — conferir na tela, não na mensagem de êxito.
for (const [tema, fonte] of [["claro", fontes.claro], ["escuro", fontes.escuro]]) {
  const c = await caixa(fonte);
  const corte = fimDoSimbolo(c);
  if (!corte) {
    console.error(`✗ não achei o vão entre símbolo e wordmark em ${tema} — conferir à mão`);
    process.exit(1);
  }
  const simb = { left: c.left, top: c.top, width: corte - c.left, height: c.height };
  const lado = Math.max(simb.width, simb.height);
  const respiro = Math.round(lado * 0.08); // o rail precisa de folga
  const quadrado = await sharp(fonte)
    .extract(simb)
    .extend({
      top: Math.round((lado - simb.height) / 2) + respiro,
      bottom: lado - simb.height - Math.round((lado - simb.height) / 2) + respiro,
      left: Math.round((lado - simb.width) / 2) + respiro,
      right: lado - simb.width - Math.round((lado - simb.width) / 2) + respiro,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  for (const px of [512, 256, 128, 64]) {
    const f = `${SAIDA}/simbolo-${tema}-${px}.png`;
    await sharp(quadrado).resize(px, px).png({ compressionLevel: 9 }).toFile(f);
    reg(f);
  }
  const fw = `${SAIDA}/simbolo-${tema}.webp`;
  await sharp(quadrado).resize(512, 512).webp({ quality: 92 }).toFile(fw);
  reg(fw);
  console.log(`  símbolo ${tema}: ${simb.width}x${simb.height} -> quadrado de ${lado + respiro * 2}`);
}

// ── 2. Wordmarks APARADOS (sem os 57% de padding) ───────────────────────────
for (const [tema, fonte] of [["claro", fontes.claro], ["escuro", fontes.escuro]]) {
  const c = await caixa(fonte);
  const aparado = await sharp(fonte)
    .extract({ left: c.left, top: c.top, width: c.width, height: c.height })
    .toBuffer();
  for (const h of [96, 48]) {
    const f = `${SAIDA}/wordmark-${tema}-${h}.png`;
    await sharp(aparado).resize({ height: h }).png({ compressionLevel: 9 }).toFile(f);
    reg(f);
  }
  const fw = `${SAIDA}/wordmark-${tema}.webp`;
  await sharp(aparado).resize({ height: 192 }).webp({ quality: 92 }).toFile(fw);
  reg(fw);
  console.log(`  ${tema}: aparado de ${c.W}x${c.H} para ${c.width}x${c.height} (${(c.width / c.height).toFixed(2)}:1)`);
}

// ── 3. Favicon nas convenções do Next ───────────────────────────────────────
// ⚠️ A convenção de arquivo do Next NÃO aceita webp, e nem todo navegador
// desenha favicon nesse formato — por isso PNG.
await sharp(fontes.favicon).resize(512, 512).png({ compressionLevel: 9 }).toFile(`${APP}/icon.png`);
reg(`${APP}/icon.png`);
await sharp(fontes.favicon).resize(180, 180).png({ compressionLevel: 9 }).toFile(`${APP}/apple-icon.png`);
reg(`${APP}/apple-icon.png`);

console.log(`\n✓ ${feito.length} arquivos gerados:\n`);
feito.forEach((f) => console.log("   " + f));
console.log(`
⚠️ Pendente do designer, e NÃO derivável daqui:
   • SVG do símbolo e do wordmark — a 56px o PNG fica mole, e em SVG o gradiente
     da marca pode vir do token --gradient-brand em vez de pixel fixo.
   • "track" branco SEM bevel/sombra: o 'logo tema escuro.png' tem relevo e borda
     cinza assados, que sobre #090D14 liso leem como sujeira.
`);
