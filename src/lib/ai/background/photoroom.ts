/**
 * Recorte de fondo con Photoroom. Alternativa a fal.ai; devuelve el PNG
 * directamente en el cuerpo de la respuesta, sin URL intermedia.
 */

import type { BackgroundRemovalResult, BackgroundRemover } from "@/lib/ai/background";
import { ServiceError, requireEnv } from "@/lib/errors";

const ENDPOINT = "https://sdk.photoroom.com/v1/segment";

export const photoroomRemover: BackgroundRemover = {
  name: "photoroom",
  envVar: "PHOTOROOM_API_KEY",

  async remove(input: Buffer, mime: string): Promise<BackgroundRemovalResult> {
    const key = requireEnv(
      "PHOTOROOM_API_KEY",
      "Se obtiene en https://www.photoroom.com/api.",
    );
    const started = Date.now();

    const form = new FormData();
    form.append("image_file", new Blob([new Uint8Array(input)], { type: mime }), "prenda.jpg");
    form.append("format", "png");

    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "x-api-key": key },
      body: form,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new ServiceError(
        "BACKGROUND_REMOVAL_FAILED",
        `Photoroom respondió ${response.status}. ${detail.slice(0, 300)}`,
      );
    }

    return {
      png: Buffer.from(await response.arrayBuffer()),
      ms: Date.now() - started,
    };
  },
};
