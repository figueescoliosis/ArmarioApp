/**
 * Normalización del recorte y extracción de la paleta real de la prenda.
 *
 * El recorte que devuelve el servicio viene con el encuadre original: la prenda
 * puede quedar pequeña y descentrada dentro de un PNG enorme. Aquí se recorta
 * al contorno real, se centra sobre un lienzo cuadrado y se generan las dos
 * medidas que usa la app. Es lo que hace que la rejilla del armario se vea
 * uniforme aunque las fotos estén hechas de cualquier manera.
 */

import sharp from "sharp";
import type { GarmentColor } from "@/lib/types";
import { deltaE2000, rgbToHex, rgbToLab, type Rgb } from "@/lib/outfits/color";
import { ServiceError } from "@/lib/errors";

/** Lado del PNG final. Cuadrado para que la rejilla no baile. */
const CANVAS_SIZE = 1024;
/** Lado de la miniatura que se sirve en la rejilla. */
const THUMB_SIZE = 320;
/** Margen alrededor de la prenda, como fracción del lienzo. */
const PADDING_RATIO = 0.06;

export interface ProcessedImages {
  /** PNG cuadrado con la prenda centrada y fondo transparente. */
  cutout: Buffer;
  /** WebP pequeño para la rejilla. */
  thumb: Buffer;
  /** Paleta medida sobre los píxeles opacos, ordenada por dominancia. */
  palette: GarmentColor[];
}

export async function processCutout(png: Buffer): Promise<ProcessedImages> {
  let trimmed: ReturnType<typeof sharp>;

  try {
    // `trim` sobre un PNG con alfa recorta la orla transparente, dejando el
    // contorno exacto de la prenda.
    trimmed = sharp(png).ensureAlpha().trim();
    await trimmed.clone().metadata();
  } catch (error) {
    throw new ServiceError(
      "BACKGROUND_REMOVAL_FAILED",
      "El recorte recibido no es una imagen válida.",
      error,
    );
  }

  const inner = Math.round(CANVAS_SIZE * (1 - PADDING_RATIO * 2));

  const cutout = await trimmed
    .clone()
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top: Math.round(CANVAS_SIZE * PADDING_RATIO),
      bottom: Math.round(CANVAS_SIZE * PADDING_RATIO),
      left: Math.round(CANVAS_SIZE * PADDING_RATIO),
      right: Math.round(CANVAS_SIZE * PADDING_RATIO),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toBuffer();

  const thumb = await sharp(cutout)
    .resize(THUMB_SIZE, THUMB_SIZE, { fit: "inside" })
    .webp({ quality: 82 })
    .toBuffer();

  return { cutout, thumb, palette: await extractPalette(cutout) };
}

/**
 * Colores dominantes de la prenda, medidos sobre los píxeles opacos.
 *
 * El modelo de lenguaje nombra los colores muy bien ("verde oliva apagado")
 * pero acierta regular con el hexadecimal exacto. Esto es lo contrario: mide
 * el color real y no sabe cómo se llama. Se usan los dos y cada uno aporta
 * lo que hace bien.
 */
export async function extractPalette(png: Buffer, maxColors = 4): Promise<GarmentColor[]> {
  // Basta con una miniatura: la dominancia de color no cambia por muestrear
  // menos píxeles, y el coste baja en dos órdenes de magnitud.
  const { data, info } = await sharp(png)
    .resize(96, 96, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  const buckets = new Map<string, { sum: Rgb; count: number }>();
  let opaque = 0;

  for (let i = 0; i + channels - 1 < data.length; i += channels) {
    const alpha = channels === 4 ? data[i + 3] : 255;
    if (alpha === undefined || alpha < 128) continue;

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r === undefined || g === undefined || b === undefined) continue;

    opaque++;

    // Cuantización a una rejilla de 32 niveles por canal: agrupa las
    // variaciones de sombra e iluminación de un mismo color de tela.
    const key = `${r >> 3}-${g >> 3}-${b >> 3}`;
    const bucket = buckets.get(key);
    if (bucket === undefined) buckets.set(key, { sum: { r, g, b }, count: 1 });
    else {
      bucket.sum.r += r;
      bucket.sum.g += g;
      bucket.sum.b += b;
      bucket.count++;
    }
  }

  if (opaque === 0) return [];

  const averaged = [...buckets.values()]
    .map((bucket) => ({
      rgb: {
        r: bucket.sum.r / bucket.count,
        g: bucket.sum.g / bucket.count,
        b: bucket.sum.b / bucket.count,
      },
      count: bucket.count,
    }))
    .sort((a, b) => b.count - a.count);

  // Fusión perceptual: dos celdas vecinas de la rejilla pueden ser el mismo
  // color a ojo. Se unen las que están por debajo del umbral de CIEDE2000.
  const merged: { rgb: Rgb; count: number; lab: ReturnType<typeof rgbToLab> }[] = [];

  for (const entry of averaged) {
    const lab = rgbToLab(entry.rgb);
    const near = merged.find((m) => deltaE2000(m.lab, lab) < 12);

    if (near === undefined) {
      merged.push({ rgb: entry.rgb, count: entry.count, lab });
    } else {
      const total = near.count + entry.count;
      near.rgb = {
        r: (near.rgb.r * near.count + entry.rgb.r * entry.count) / total,
        g: (near.rgb.g * near.count + entry.rgb.g * entry.count) / total,
        b: (near.rgb.b * near.count + entry.rgb.b * entry.count) / total,
      };
      near.count = total;
      near.lab = rgbToLab(near.rgb);
    }
  }

  merged.sort((a, b) => b.count - a.count);

  return merged
    .slice(0, maxColors)
    .filter((entry) => entry.count / opaque >= 0.04) // Descarta motas y bordes.
    .map((entry) => ({
      hex: rgbToHex(entry.rgb),
      name: "",
      ratio: Number((entry.count / opaque).toFixed(3)),
    }));
}
