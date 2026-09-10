/**
 * Recorte de fondo con fal.ai, modelo BiRefNet v2.
 *
 * Es el proveedor por defecto: da los mejores bordes en tejido (flecos, punto,
 * transparencias) que es justo donde fallan los recortadores genéricos, y sale
 * por unas milésimas de euro por imagen.
 */

import {
  fetchResultImage,
  toDataUri,
  type BackgroundRemovalResult,
  type BackgroundRemover,
} from "@/lib/ai/background";
import { ServiceError, requireEnv } from "@/lib/errors";

const ENDPOINT = "https://fal.run/fal-ai/birefnet/v2";

interface FalResponse {
  image?: { url?: string; content_type?: string };
}

export const falRemover: BackgroundRemover = {
  name: "fal",
  envVar: "FAL_KEY",

  async remove(input: Buffer, mime: string): Promise<BackgroundRemovalResult> {
    const key = requireEnv("FAL_KEY", "Se obtiene en https://fal.ai/dashboard/keys.");
    const started = Date.now();

    // fal acepta la imagen como data URI en `image_url`, lo que ahorra tener
    // que subirla antes a su almacenamiento y luego referenciarla.
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Key ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image_url: toDataUri(input, mime),
        operating_resolution: "1024x1024",
        output_format: "png",
        // Afina el borde del sujeto: importa mucho en prendas de punto y encaje.
        refine_foreground: true,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new ServiceError(
        "BACKGROUND_REMOVAL_FAILED",
        `fal.ai respondió ${response.status}. ${detail.slice(0, 300)}`,
      );
    }

    const body = (await response.json()) as FalResponse;
    const url = body.image?.url;
    if (typeof url !== "string") {
      throw new ServiceError(
        "BACKGROUND_REMOVAL_FAILED",
        "fal.ai no devolvió ninguna imagen en la respuesta.",
      );
    }

    return { png: await fetchResultImage(url), ms: Date.now() - started };
  },
};
