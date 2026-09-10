/**
 * Selector de proveedor de etiquetado, con la misma forma que el de recorte
 * (`src/lib/ai/background/index.ts`): la variable `TAGGING_PROVIDER` decide, y
 * el resto de la aplicación no se entera.
 */

import type { GarmentColor } from "@/lib/types";
import { ServiceError } from "@/lib/errors";
import { type TaggingResult, tagGarment as tagWithClaude } from "@/lib/ai/tagging/claude";
import { tagGarmentWithGemini } from "@/lib/ai/tagging/gemini";

const PROVIDERS: Readonly<
  Record<string, (png: Buffer, palette: GarmentColor[]) => Promise<TaggingResult>>
> = {
  anthropic: tagWithClaude,
  gemini: tagGarmentWithGemini,
};

export const DEFAULT_PROVIDER = "anthropic";

export async function tagGarment(
  cutoutPng: Buffer,
  measuredPalette: GarmentColor[] = [],
): Promise<TaggingResult> {
  const name = (process.env.TAGGING_PROVIDER ?? DEFAULT_PROVIDER).toLowerCase();
  const tag = PROVIDERS[name];

  if (tag === undefined) {
    throw new ServiceError(
      "MISSING_CONFIG",
      `Proveedor de etiquetado desconocido: "${name}". Válidos: ${Object.keys(PROVIDERS).join(", ")}.`,
    );
  }

  return tag(cutoutPng, measuredPalette);
}
