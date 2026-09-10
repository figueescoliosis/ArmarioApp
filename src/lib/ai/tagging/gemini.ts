/**
 * Etiquetado de prendas con Gemini (Google AI Studio).
 *
 * Misma entrada, mismo esquema y mismo saneado que el proveedor de Claude: lo
 * único que cambia es a quién se le pregunta. Existe porque Gemini tiene cuota
 * gratuita de verdad, sin tarjeta, que es la diferencia entre poder probar la
 * app y no poder.
 */

import type { GarmentAttributes, GarmentColor } from "@/lib/types";
import { ServiceError, requireEnv } from "@/lib/errors";
import { geminiJson } from "@/lib/ai/gemini";
import { SYSTEM_PROMPT, TaggingSchema, normalize } from "@/lib/ai/tagging/claude";

export interface TaggingResult {
  attributes: GarmentAttributes;
  ms: number;
}

export async function tagGarmentWithGemini(
  cutoutPng: Buffer,
  measuredPalette: GarmentColor[] = [],
): Promise<TaggingResult> {
  const apiKey = requireEnv(
    "GEMINI_API_KEY",
    "Se obtiene gratis en https://aistudio.google.com/apikey.",
  );
  const started = Date.now();

  let parsed;
  try {
    parsed = await geminiJson(
      apiKey,
      SYSTEM_PROMPT,
      [
        { inlineData: { mimeType: "image/png", data: cutoutPng.toString("base64") } },
        { text: "Cataloga esta prenda." },
      ],
      TaggingSchema,
    );
  } catch (error) {
    throw new ServiceError(
      "TAGGING_FAILED",
      `Gemini no pudo analizar la prenda: ${error instanceof Error ? error.message : String(error)}`,
      error,
    );
  }

  return {
    attributes: normalize(parsed, measuredPalette),
    ms: Date.now() - started,
  };
}
