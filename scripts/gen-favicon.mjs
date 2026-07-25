/**
 * Gera `src/app/icon.png` e `src/app/apple-icon.png` a partir do favicon .webp.
 *
 * A convenção de arquivo do Next (`app/icon.*`) aceita ico/png/jpg/svg — não
 * webp —, e navegadores mais antigos não desenham favicon em webp. Rodar de
 * novo só se o arquivo de origem mudar:
 *   node scripts/gen-favicon.mjs
 */
import sharp from "sharp";

const ORIGEM = "public/logos/favicon.webp";
const transparente = { r: 0, g: 0, b: 0, alpha: 0 };

await Promise.all([
  sharp(ORIGEM).resize(512, 512, { fit: "contain", background: transparente }).png().toFile("src/app/icon.png"),
  sharp(ORIGEM).resize(180, 180, { fit: "contain", background: transparente }).png().toFile("src/app/apple-icon.png"),
]);
console.log("icon.png (512) e apple-icon.png (180) gerados");
