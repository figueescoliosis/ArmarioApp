/**
 * Etiquetado de prendas con Claude Vision.
 *
 * Se le manda el **recorte**, no la foto original: sin fondo, el modelo no se
 * distrae con el sofá ni con la percha, y acierta bastante más en la categoría.
 *
 * La salida va contra un esquema Zod mediante `messages.parse()`, así que lo
 * que vuelve o valida el esquema o lanza — nunca hay que adivinar si el JSON
 * vino bien formado.
 */

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as z from "zod/v4";

import {
  CATEGORIES,
  PATTERNS,
  SEASONS,
  type Formality,
  type GarmentAttributes,
  type GarmentColor,
  type Warmth,
} from "@/lib/types";
import { ServiceError, requireEnv } from "@/lib/errors";
import { deltaE2000, hexToRgb, rgbToLab } from "@/lib/outfits/color";

/** Modelo por defecto. Se puede cambiar sin tocar código con `ANTHROPIC_MODEL`. */
const DEFAULT_MODEL = "claude-opus-5";

const TaggingSchema = z.object({
  category: z.enum(CATEGORIES),
  subcategory: z
    .string()
    .describe("Tipo concreto en español, dos o tres palabras: 'camisa de vestir', 'botín de ante'."),
  colors: z
    .array(
      z.object({
        hex: z.string().describe("Hexadecimal con almohadilla, p. ej. #1A2B3C."),
        name: z.string().describe("Nombre del color en español: 'azul marino', 'verde oliva'."),
        ratio: z.number().describe("Fracción de la prenda que ocupa, de 0 a 1."),
      }),
    )
    .describe("De uno a cuatro colores, del más dominante al menos."),
  pattern: z.enum(PATTERNS),
  material: z.string().nullable().describe("Tejido si se reconoce; null si no."),
  styleTags: z.array(z.string()).describe("Hasta cinco etiquetas de estilo en español."),
  formality: z
    .number()
    .int()
    .describe("1 estar por casa, 2 casual, 3 smart casual, 4 formal, 5 etiqueta."),
  warmth: z.number().int().describe("1 muy fresca (tirantes) a 5 muy abrigada (plumas)."),
  seasons: z.array(z.enum(SEASONS)).describe("Temporadas en las que se puede llevar."),
});

const SYSTEM_PROMPT = `Eres un estilista que cataloga el armario de una persona.

Recibes la foto de una única prenda, ya recortada sobre fondo transparente, y
devuelves sus atributos.

Criterios:
- "category" es el hueco que ocupa la prenda al vestir. Un mono o un vestido son "dress".
  Los cinturones, gorros, bufandas y bolsos son "accessory".
- "subcategory" debe ser específica y en español natural: "vaquero recto", no "pantalón".
- Los colores van del más dominante al menos. Si la prenda es lisa, uno basta.
  Estima "ratio" a ojo; no tiene que sumar exactamente 1.
- "formality" es dónde se podría llevar la prenda, no lo cara que parece: unos
  vaqueros de marca siguen siendo un 2.
- "warmth" es cuánto abriga por sí sola, sin contar lo que se lleve debajo.
- "seasons": incluye todas en las que la prenda es razonable. Una camiseta lisa
  vale para las cuatro; un plumas, solo para invierno.

Responde solo con los atributos, sin comentarios.`;

let cachedClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (cachedClient !== null) return cachedClient;
  const apiKey = requireEnv(
    "ANTHROPIC_API_KEY",
    "Se obtiene en https://console.anthropic.com/settings/keys.",
  );
  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

export interface TaggingResult {
  attributes: GarmentAttributes;
  ms: number;
}

/**
 * @param cutoutPng PNG recortado de la prenda.
 * @param measuredPalette Paleta medida sobre los píxeles reales. Se usa para
 *   corregir los hexadecimales del modelo, que nombra bien pero mide regular.
 */
export async function tagGarment(
  cutoutPng: Buffer,
  measuredPalette: GarmentColor[] = [],
): Promise<TaggingResult> {
  const client = getClient();
  const started = Date.now();

  let parsed: z.infer<typeof TaggingSchema> | null;

  try {
    const message = await client.messages.parse({
      model: process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL,
      max_tokens: 2000,
      // El sistema es idéntico en cada subida, así que a partir de la segunda
      // prenda solo se pagan los tokens de la imagen.
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: cutoutPng.toString("base64"),
              },
            },
            { type: "text", text: "Cataloga esta prenda." },
          ],
        },
      ],
      output_config: { format: zodOutputFormat(TaggingSchema) },
    });

    parsed = message.parsed_output;
  } catch (error) {
    throw new ServiceError(
      "TAGGING_FAILED",
      `Claude no pudo analizar la prenda: ${error instanceof Error ? error.message : String(error)}`,
      error,
    );
  }

  if (parsed === null) {
    throw new ServiceError(
      "TAGGING_FAILED",
      "Claude devolvió una respuesta que no encaja con el esquema de atributos.",
    );
  }

  return {
    attributes: normalize(parsed, measuredPalette),
    ms: Date.now() - started,
  };
}

/* ────────────────────────── Saneado ────────────────────────── */

function clampScale(value: number): 1 | 2 | 3 | 4 | 5 {
  const rounded = Math.round(value);
  if (rounded <= 1) return 1;
  if (rounded >= 5) return 5;
  return rounded as 2 | 3 | 4;
}

function normalizeHex(hex: string): string | null {
  const rgb = hexToRgb(hex);
  return rgb === null ? null : `#${[rgb.r, rgb.g, rgb.b].map((c) => c.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

/**
 * Cruza lo que dijo el modelo con lo que se midió en los píxeles.
 *
 * Para cada color medido se busca el nombre que el modelo dio al color más
 * parecido perceptualmente. El resultado tiene el hexadecimal exacto del
 * extractor y el nombre humano del modelo, que es lo mejor de cada uno. Si no
 * hubo medición, se usa tal cual lo del modelo.
 */
function reconcileColors(
  modelColors: { hex: string; name: string; ratio: number }[],
  measured: GarmentColor[],
): GarmentColor[] {
  const named = modelColors
    .map((color) => {
      const hex = normalizeHex(color.hex);
      return hex === null ? null : { hex, name: color.name.trim(), ratio: color.ratio };
    })
    .filter((color): color is GarmentColor => color !== null);

  if (measured.length === 0) {
    return named.length > 0 ? named : [{ hex: "#808080", name: "gris", ratio: 1 }];
  }

  const namedLabs = named.map((color) => {
    const rgb = hexToRgb(color.hex);
    return { color, lab: rgb === null ? null : rgbToLab(rgb) };
  });

  return measured.map((sample) => {
    const rgb = hexToRgb(sample.hex);
    if (rgb === null) return sample;
    const lab = rgbToLab(rgb);

    let best: { name: string; distance: number } | null = null;
    for (const candidate of namedLabs) {
      if (candidate.lab === null) continue;
      const distance = deltaE2000(lab, candidate.lab);
      if (best === null || distance < best.distance) {
        best = { name: candidate.color.name, distance };
      }
    }

    // Por encima de este umbral el nombre del modelo se refiere a otro color
    // distinto, y ponérselo a este sería peor que dejarlo sin nombre.
    const name = best !== null && best.distance < 25 ? best.name : "";
    return { hex: sample.hex, name, ratio: sample.ratio };
  });
}

function normalize(
  parsed: z.infer<typeof TaggingSchema>,
  measured: GarmentColor[],
): GarmentAttributes {
  return {
    category: parsed.category,
    subcategory: parsed.subcategory.trim(),
    colors: reconcileColors(parsed.colors, measured).slice(0, 4),
    pattern: parsed.pattern,
    material: parsed.material?.trim() || null,
    styleTags: parsed.styleTags.map((tag) => tag.trim()).filter(Boolean).slice(0, 5),
    formality: clampScale(parsed.formality) as Formality,
    warmth: clampScale(parsed.warmth) as Warmth,
    seasons: [...new Set(parsed.seasons)],
  };
}
