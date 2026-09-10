/**
 * Eliminación del fondo de la foto de una prenda.
 *
 * El resto de la aplicación no sabe qué servicio hace el recorte: habla con la
 * interfaz `BackgroundRemover` y el proveedor concreto se elige con la variable
 * `BG_REMOVAL_PROVIDER`. Cambiar de fal.ai a Photoroom es cambiar una línea del
 * `.env.local`, sin tocar código.
 */

import { MissingConfigError, ServiceError } from "@/lib/errors";
import { falRemover } from "@/lib/ai/background/fal";
import { photoroomRemover } from "@/lib/ai/background/photoroom";
import { removeBgRemover } from "@/lib/ai/background/removebg";

export interface BackgroundRemovalResult {
  /** PNG con canal alfa: el fondo queda transparente. */
  png: Buffer;
  /** Milisegundos que tardó la llamada al servicio. */
  ms: number;
}

export interface BackgroundRemover {
  readonly name: string;
  /** Nombre de la variable de entorno con la clave de este proveedor. */
  readonly envVar: string;
  remove(input: Buffer, mime: string): Promise<BackgroundRemovalResult>;
}

const PROVIDERS: Readonly<Record<string, BackgroundRemover>> = {
  fal: falRemover,
  photoroom: photoroomRemover,
  removebg: removeBgRemover,
};

export const DEFAULT_PROVIDER = "fal";

/**
 * Devuelve el proveedor configurado.
 *
 * Falla de forma ruidosa y concreta si no hay clave: es deliberado. Un recorte
 * silenciosamente omitido produciría prendas con el fondo del salón puesto, y
 * eso se propaga a todo el armario antes de que nadie se dé cuenta.
 */
export function getBackgroundRemover(): BackgroundRemover {
  const name = (process.env.BG_REMOVAL_PROVIDER ?? DEFAULT_PROVIDER).toLowerCase();
  const provider = PROVIDERS[name];

  if (provider === undefined) {
    throw new ServiceError(
      "MISSING_CONFIG",
      `Proveedor de recorte desconocido: "${name}". Válidos: ${Object.keys(PROVIDERS).join(", ")}.`,
    );
  }

  if (!process.env[provider.envVar]) {
    throw new MissingConfigError(
      provider.envVar,
      `Es la clave del proveedor de recorte "${provider.name}".`,
    );
  }

  return provider;
}

/** Atajo: recorta con el proveedor configurado. */
export async function removeBackground(
  input: Buffer,
  mime: string,
): Promise<BackgroundRemovalResult & { provider: string }> {
  const provider = getBackgroundRemover();
  const result = await provider.remove(input, mime);
  return { ...result, provider: provider.name };
}

/** Convierte un buffer en data URI, que es como aceptan la imagen estas APIs. */
export function toDataUri(input: Buffer, mime: string): string {
  return `data:${mime};base64,${input.toString("base64")}`;
}

/** Descarga el resultado del recorte, que estos servicios devuelven por URL. */
export async function fetchResultImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new ServiceError(
      "BACKGROUND_REMOVAL_FAILED",
      `No se pudo descargar la imagen recortada (HTTP ${response.status}).`,
    );
  }
  return Buffer.from(await response.arrayBuffer());
}
