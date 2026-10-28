/**
 * Cliente de Supabase con la service role key. SOLO se importa desde Route
 * Handlers (código de servidor): nunca debe llegar al bundle del navegador,
 * porque la service role key se salta cualquier política de RLS.
 *
 * El paquete `server-only` no está instalado en este proyecto, así que en su
 * lugar comprobamos en runtime que no estamos en un entorno de navegador.
 */
if (typeof window !== "undefined") {
  throw new Error(
    "src/lib/db/supabase.ts es código de servidor y no debe ejecutarse en el navegador.",
  );
}

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
// Un único tipo de error de configuración en toda la app: los Route Handlers
// lo capturan para responder con el nombre de la variable que falta.
import { MissingConfigError } from "@/lib/errors";

export { MissingConfigError };

import { headers } from "next/headers";
import { DEFAULT_OWNER_ID, OWNER_HEADER } from "@/lib/owners";

export { DEFAULT_OWNER_ID };

/**
 * El dueño del armario de esta petición. Lo fija el middleware según quién
 * entró por el Basic Auth (ver `src/lib/owners.ts`); sin cabecera (fuera de
 * una petición o sin middleware) es el dueño por defecto.
 */
export async function currentOwnerId(): Promise<string> {
  return (await headers()).get(OWNER_HEADER) ?? DEFAULT_OWNER_ID;
}

export const GARMENTS_BUCKET = "garments";

let cachedClient: SupabaseClient | null = null;

/** Cliente admin perezoso (singleton): se construye la primera vez que hace falta. */
export function getSupabaseAdmin(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new MissingConfigError("NEXT_PUBLIC_SUPABASE_URL");
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new MissingConfigError("SUPABASE_SERVICE_ROLE_KEY");
  }

  cachedClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}

/** Sube un archivo al bucket público de prendas y devuelve su URL pública. */
export async function uploadImage(
  path: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  const client = getSupabaseAdmin();
  const { error } = await client.storage
    .from(GARMENTS_BUCKET)
    .upload(path, body, { contentType, upsert: true });

  if (error) {
    throw new Error(`No se pudo subir la imagen "${path}" al bucket ${GARMENTS_BUCKET}: ${error.message}`);
  }

  const { data } = client.storage.from(GARMENTS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Borra un lote de archivos del bucket de prendas. */
export async function deleteImages(paths: string[]): Promise<void> {
  if (paths.length === 0) return;

  const client = getSupabaseAdmin();
  const { error } = await client.storage.from(GARMENTS_BUCKET).remove(paths);

  if (error) {
    throw new Error(`No se pudieron borrar imágenes del bucket ${GARMENTS_BUCKET}: ${error.message}`);
  }
}
