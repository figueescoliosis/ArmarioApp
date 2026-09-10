import { orientationTransform, readExifOrientation } from "./exif";

/**
 * Por qué existe este módulo: una foto recién hecha con el móvil pesa
 * 4-6 MB y puede llegar a 4000×3000 px. Subirla tal cual haría lenta la
 * subida y, sobre todo, encarecería y ralentizaría el recorte de fondo (el
 * proveedor cobra y tarda en función del tamaño de la imagen que le
 * mandamos). Redimensionar y comprimir en el propio navegador, antes de
 * subir nada, hace que la subida sea instantánea y el recorte más barato,
 * sin que el usuario note pérdida de calidad visible en pantalla.
 */

export interface PreparedImage {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
}

const DEFAULT_MAX_SIDE = 1600;
const DEFAULT_QUALITY = 0.85;

/**
 * Redimensiona y comprime `file` para subirla. Solo funciona en el
 * navegador: usa `createImageBitmap`/`Image`, `canvas` y `FileReader`, que
 * no existen en Node.
 */
export async function prepareImage(
  file: File,
  opts?: { maxSide?: number; quality?: number },
): Promise<PreparedImage> {
  if (typeof window === "undefined") {
    throw new Error("prepareImage solo puede ejecutarse en el navegador.");
  }
  if (!file.type.startsWith("image/")) {
    throw new Error(`El archivo "${file.name}" no es una imagen.`);
  }

  const maxSide = opts?.maxSide ?? DEFAULT_MAX_SIDE;
  const quality = opts?.quality ?? DEFAULT_QUALITY;

  const { source, sourceWidth, sourceHeight, cleanup } = await decodeSource(file);
  try {
    const targetWidth = Math.round(sourceWidth * scaleFactor(sourceWidth, sourceHeight, maxSide));
    const targetHeight = Math.round(sourceHeight * scaleFactor(sourceWidth, sourceHeight, maxSide));

    const canvas = createCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext("2d") as
      | OffscreenCanvasRenderingContext2D
      | CanvasRenderingContext2D
      | null;
    if (!ctx) {
      throw new Error("No se ha podido crear el contexto de dibujo para procesar la imagen.");
    }
    ctx.drawImage(source, 0, 0, targetWidth, targetHeight);

    const blob = await canvasToJpegBlob(canvas, quality);
    const dataUrl = await blobToDataUrl(blob);
    return { blob, dataUrl, width: targetWidth, height: targetHeight };
  } finally {
    cleanup();
  }
}

/** Factor de escala que nunca amplía: si la imagen ya cabe en `maxSide`, es 1. */
function scaleFactor(width: number, height: number, maxSide: number): number {
  const longSide = Math.max(width, height);
  return longSide <= maxSide ? 1 : maxSide / longSide;
}

type DrawableSource = ImageBitmap | HTMLImageElement | HTMLCanvasElement;

interface DecodedSource {
  source: DrawableSource;
  sourceWidth: number;
  sourceHeight: number;
  cleanup: () => void;
}

/**
 * Decodifica el archivo ya con la orientación EXIF corregida.
 *
 * Camino rápido: `createImageBitmap` con `imageOrientation: "from-image"`
 * hace que el navegador aplique la rotación/espejo por nosotros — es la
 * opción soportada por todos los motores modernos y evita reimplementar el
 * parseo EXIF en el camino feliz.
 *
 * Camino de respaldo (navegadores sin `createImageBitmap`, o que fallan al
 * decodificar): leemos el buffer con `readExifOrientation`, decodificamos
 * con `<img>` sin corregir nada, y aplicamos nosotros la matriz de
 * `orientationTransform` al dibujar. Por eso `exif.ts` existe aunque el
 * camino feliz no lo use: es la implementación real para cuando el atajo
 * del navegador no está disponible.
 */
async function decodeSource(file: File): Promise<DecodedSource> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        source: bitmap,
        sourceWidth: bitmap.width,
        sourceHeight: bitmap.height,
        cleanup: () => bitmap.close?.(),
      };
    } catch {
      // Cae al camino de respaldo si el navegador no soporta la opción o
      // no puede decodificar el formato.
    }
  }

  const buffer = await file.arrayBuffer();
  const orientation = readExifOrientation(buffer);
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("No se ha podido decodificar la imagen."));
      img.src = url;
    });

    if (orientation === 1) {
      return {
        source: img,
        sourceWidth: img.naturalWidth,
        sourceHeight: img.naturalHeight,
        cleanup: () => URL.revokeObjectURL(url),
      };
    }

    // Hay que reorientar: dibujamos la imagen original (sin corregir) en un
    // canvas intermedio aplicando la matriz de transformación, y usamos ese
    // canvas ya corregido como fuente para el resto del proceso.
    const { width, height, transform } = orientationTransform(
      orientation,
      img.naturalWidth,
      img.naturalHeight,
    );
    const oriented = createCanvas(width, height);
    const octx = oriented.getContext("2d") as
      | OffscreenCanvasRenderingContext2D
      | CanvasRenderingContext2D
      | null;
    if (!octx) {
      throw new Error("No se ha podido crear el contexto de dibujo para corregir la orientación.");
    }
    octx.setTransform(...transform);
    octx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
    octx.setTransform(1, 0, 0, 1, 0, 0);

    const orientedBitmap = await canvasToBitmap(oriented);
    return {
      source: orientedBitmap,
      sourceWidth: width,
      sourceHeight: height,
      cleanup: () => {
        URL.revokeObjectURL(url);
        if ("close" in orientedBitmap) orientedBitmap.close?.();
      },
    };
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

/** Convierte un canvas intermedio a algo dibujable de nuevo con `drawImage` (bitmap o el propio canvas). */
async function canvasToBitmap(
  canvas: OffscreenCanvas | HTMLCanvasElement,
): Promise<ImageBitmap | HTMLCanvasElement> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(canvas);
  }
  // Sin `createImageBitmap`, el propio `<canvas>` sirve como fuente de dibujo.
  return canvas as HTMLCanvasElement;
}

async function canvasToJpegBlob(
  canvas: OffscreenCanvas | HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  if (canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: "image/jpeg", quality });
  }
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("El canvas no ha podido generar la imagen final."));
      },
      "image/jpeg",
      quality,
    );
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("No se ha podido generar la vista previa de la imagen."));
    reader.readAsDataURL(blob);
  });
}
