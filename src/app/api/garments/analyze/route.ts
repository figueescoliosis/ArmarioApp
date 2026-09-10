/**
 * Paso 1 de la subida: analizar la foto.
 *
 * Recorta el fondo, normaliza el resultado, mide la paleta real, etiqueta con
 * Claude y deja las tres imágenes en el almacenamiento. **No escribe en la base
 * de datos**: devuelve un borrador para que el usuario lo revise. La prenda
 * entra en el armario en el paso 2, con `POST /api/garments`.
 *
 * Es la parte cara del producto, y por eso vive entera en el servidor: ninguna
 * de las claves puede llegar al navegador.
 */

import { NextRequest } from "next/server";
import { fail, handle, ok } from "@/lib/api";
import { uploadImage } from "@/lib/db/supabase";
import { removeBackground } from "@/lib/ai/background";
import { processCutout } from "@/lib/ai/postprocess";
import { tagGarment } from "@/lib/ai/tagging/claude";
import type { AnalyzeGarmentResult } from "@/lib/types";

/** El recorte y el etiquetado juntos pueden pasar de los diez segundos. */
export const maxDuration = 60;

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export async function POST(request: NextRequest) {
  return handle(async () => {
    const startedAt = Date.now();

    const form = await request.formData().catch(() => null);
    if (form === null) {
      return fail("BAD_REQUEST", "Se esperaba un formulario multipart con el campo 'image'.");
    }

    const file = form.get("image");
    if (!(file instanceof File)) {
      return fail("BAD_REQUEST", "Falta el archivo de imagen en el campo 'image'.");
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return fail("IMAGE_TOO_LARGE", "La imagen supera los 15 MB.");
    }

    const mime = file.type || "image/jpeg";
    if (!ACCEPTED.includes(mime)) {
      return fail("UNSUPPORTED_MEDIA_TYPE", `Formato no admitido: ${mime}.`);
    }

    const original = Buffer.from(await file.arrayBuffer());

    const removal = await removeBackground(original, mime);
    const processed = await processCutout(removal.png);

    // La paleta medida en los píxeles corrige los hexadecimales del modelo,
    // que nombra los colores bien pero los mide regular.
    const tagging = await tagGarment(processed.cutout, processed.palette);

    const uploadStarted = Date.now();
    const prefix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const [imageUrl, cutoutUrl, thumbUrl] = await Promise.all([
      uploadImage(`${prefix}/original.jpg`, original, mime),
      uploadImage(`${prefix}/cutout.png`, processed.cutout, "image/png"),
      uploadImage(`${prefix}/thumb.webp`, processed.thumb, "image/webp"),
    ]);
    const uploadMs = Date.now() - uploadStarted;

    const result: AnalyzeGarmentResult = {
      imageUrl,
      cutoutUrl,
      thumbUrl,
      attributes: tagging.attributes,
      timings: {
        backgroundRemovalMs: removal.ms,
        taggingMs: tagging.ms,
        uploadMs,
        totalMs: Date.now() - startedAt,
      },
      backgroundProvider: removal.provider,
    };

    return ok(result);
  });
}
