import type { PreparedImage } from "./prepare";

/** Rectángulo de recorte, en píxeles de la imagen original (no del canvas en pantalla). */
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Área mínima aceptable tras el saneado: por debajo de esto el recorte no sirve de nada. */
const MIN_CROP_SIDE = 16;

/**
 * Ajusta `rect` para que quede completamente dentro de una imagen de
 * `imageWidth` x `imageHeight`. Es pura y no valida el tamaño mínimo (eso lo
 * hace `cropImage`, que es quien decide si lanzar o no) para que sea fácil
 * de testear de forma aislada.
 *
 * Redondea siempre "hacia dentro": el origen sube (ceil) y el extremo baja
 * (floor), de modo que el rectángulo resultante nunca se sale de la imagen
 * ni siquiera por errores de redondeo.
 */
export function clampRect(rect: CropRect, imageWidth: number, imageHeight: number): CropRect {
  // Primero resolvemos a coordenadas de esquina (x0,y0)-(x1,y1): así los
  // negativos y los desbordamientos se tratan de forma simétrica en los
  // dos ejes en vez de duplicar la lógica para x y para y.
  const x0 = Math.max(0, Math.min(rect.x, imageWidth));
  const y0 = Math.max(0, Math.min(rect.y, imageHeight));
  const x1 = Math.max(0, Math.min(rect.x + rect.width, imageWidth));
  const y1 = Math.max(0, Math.min(rect.y + rect.height, imageHeight));

  const left = Math.ceil(Math.min(x0, x1));
  const top = Math.ceil(Math.min(y0, y1));
  const right = Math.floor(Math.max(x0, x1));
  const bottom = Math.floor(Math.max(y0, y1));

  return {
    x: left,
    y: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

/**
 * Recorta `source` según `rect` (en píxeles de la imagen original) y
 * devuelve el resultado como JPEG, con el mismo formato que `prepareImage`.
 * Solo funciona en el navegador.
 */
export async function cropImage(source: Blob, rect: CropRect): Promise<PreparedImage> {
  if (typeof window === "undefined") {
    throw new Error("cropImage solo puede ejecutarse en el navegador.");
  }

  const { bitmap, revoke } = await decodeToBitmap(source);
  try {
    const safeRect = clampRect(rect, bitmap.width, bitmap.height);
    if (safeRect.width < MIN_CROP_SIDE || safeRect.height < MIN_CROP_SIDE) {
      throw new Error(
        `El área de recorte es demasiado pequeña (mínimo ${MIN_CROP_SIDE}×${MIN_CROP_SIDE} px).`,
      );
    }

    const canvas = createCanvas(safeRect.width, safeRect.height);
    const ctx = canvas.getContext("2d") as
      | OffscreenCanvasRenderingContext2D
      | CanvasRenderingContext2D
      | null;
    if (!ctx) {
      throw new Error("No se ha podido crear el contexto de dibujo para recortar la imagen.");
    }
    ctx.drawImage(
      bitmap,
      safeRect.x,
      safeRect.y,
      safeRect.width,
      safeRect.height,
      0,
      0,
      safeRect.width,
      safeRect.height,
    );

    const blob = await canvasToBlob(canvas);
    const dataUrl = await blobToDataUrl(blob);
    return { blob, dataUrl, width: safeRect.width, height: safeRect.height };
  } finally {
    revoke();
    if ("close" in bitmap) bitmap.close();
  }
}

/** Decodifica un Blob a un bitmap dibujable, con `revoke()` para liberar recursos si hizo falta un object URL. */
async function decodeToBitmap(
  source: Blob,
): Promise<{ bitmap: ImageBitmap | HTMLImageElement; revoke: () => void }> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(source);
    return { bitmap, revoke: () => {} };
  }

  const url = URL.createObjectURL(source);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("No se ha podido decodificar la imagen a recortar."));
      img.src = url;
    });
    return { bitmap: img, revoke: () => URL.revokeObjectURL(url) };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

function createCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

async function canvasToBlob(canvas: OffscreenCanvas | HTMLCanvasElement): Promise<Blob> {
  if (canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: "image/jpeg", quality: 0.9 });
  }
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("El canvas no ha podido generar la imagen recortada."));
      },
      "image/jpeg",
      0.9,
    );
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("No se ha podido generar la vista previa del recorte."));
    reader.readAsDataURL(blob);
  });
}
