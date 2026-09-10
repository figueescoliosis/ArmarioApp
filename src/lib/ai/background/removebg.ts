/**
 * Recorte de fondo con remove.bg. Se incluye porque es el servicio más
 * conocido y muchos ya tienen cuenta, aunque en ropa de punto y prendas
 * translúcidas da bordes más duros que BiRefNet.
 */

import type { BackgroundRemovalResult, BackgroundRemover } from "@/lib/ai/background";
import { ServiceError, requireEnv } from "@/lib/errors";

const ENDPOINT = "https://api.remove.bg/v1.0/removebg";

export const removeBgRemover: BackgroundRemover = {
  name: "removebg",
  envVar: "REMOVE_BG_API_KEY",

  async remove(input: Buffer, mime: string): Promise<BackgroundRemovalResult> {
    const key = requireEnv(
      "REMOVE_BG_API_KEY",
      "Se obtiene en https://www.remove.bg/dashboard#api-key.",
    );
    const started = Date.now();

    const form = new FormData();
    form.append("image_file", new Blob([new Uint8Array(input)], { type: mime }), "prenda.jpg");
    form.append("size", "auto");
    // "product" está afinado para objetos sobre fondo liso, que es exactamente
    // el caso de una prenda fotografiada sobre la cama o colgada de una puerta.
    form.append("type", "product");

    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "X-Api-Key": key },
      body: form,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new ServiceError(
        "BACKGROUND_REMOVAL_FAILED",
        `remove.bg respondió ${response.status}. ${detail.slice(0, 300)}`,
      );
    }

    return {
      png: Buffer.from(await response.arrayBuffer()),
      ms: Date.now() - started,
    };
  },
};
