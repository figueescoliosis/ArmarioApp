// Genera los PNG de los iconos de la PWA a partir de public/icons/source.svg.
// Uso: node scripts/generate-icons.mjs
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const iconsDir = path.join(rootDir, "public", "icons");
const sourceSvgPath = path.join(iconsDir, "source.svg");

// El SVG fuente ya dibuja la percha dentro del 80% central (zona segura
// maskable), así que el mismo arte sirve tanto para los iconos normales
// como para el maskable: no hace falta una variante distinta.
const targets = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "icon-512-maskable.png", size: 512 },
];

async function main() {
  await mkdir(iconsDir, { recursive: true });
  const svg = await readFile(sourceSvgPath);

  for (const { file, size } of targets) {
    const outPath = path.join(iconsDir, file);
    await sharp(svg, { density: 384 })
      .resize(size, size)
      .png()
      .toFile(outPath);
    console.log(`✓ ${file} (${size}×${size})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
