import type { Category, Garment, GarmentAttributes, GarmentUpdate } from "@/lib/types";
import { DEFAULT_OWNER_ID, deleteImages, getSupabaseAdmin } from "@/lib/db/supabase";
import {
  garmentToRow,
  rowToGarment,
  type GarmentRow,
} from "@/lib/db/schema";
// El criterio de "neutro" vive con el resto de la teoría del color, que es
// donde lo consume el motor de outfits. Aquí solo se cachea en la fila.
import { isNeutralHex } from "@/lib/outfits/color";

const TABLE = "garments";

export async function listGarments(opts?: {
  category?: Category;
  includeArchived?: boolean;
}): Promise<Garment[]> {
  const client = getSupabaseAdmin();
  let query = client
    .from(TABLE)
    .select("*")
    .eq("owner_id", DEFAULT_OWNER_ID)
    .order("created_at", { ascending: false });

  if (opts?.category) {
    query = query.eq("category", opts.category);
  }
  if (!opts?.includeArchived) {
    query = query.eq("archived", false);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`No se pudieron listar las prendas: ${error.message}`);
  }

  return (data as GarmentRow[]).map(rowToGarment);
}

export async function getGarment(id: string): Promise<Garment | null> {
  const client = getSupabaseAdmin();
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .eq("owner_id", DEFAULT_OWNER_ID)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo obtener la prenda ${id}: ${error.message}`);
  }
  if (!data) return null;

  return rowToGarment(data as GarmentRow);
}

export async function insertGarment(input: {
  attributes: GarmentAttributes;
  imageUrl: string;
  cutoutUrl: string;
  thumbUrl: string | null;
}): Promise<Garment> {
  const firstColor = input.attributes.colors[0];
  const primaryHex = firstColor?.hex ?? "#000000";
  const isNeutral = isNeutralHex(primaryHex);

  const row = garmentToRow({
    attributes: input.attributes,
    imageUrl: input.imageUrl,
    cutoutUrl: input.cutoutUrl,
    thumbUrl: input.thumbUrl,
    primaryHex,
    isNeutral,
    ownerId: DEFAULT_OWNER_ID,
  });

  const client = getSupabaseAdmin();
  const { data, error } = await client.from(TABLE).insert(row).select("*").single();

  if (error) {
    throw new Error(`No se pudo guardar la prenda: ${error.message}`);
  }

  return rowToGarment(data as GarmentRow);
}

export async function updateGarment(id: string, patch: GarmentUpdate): Promise<Garment> {
  const client = getSupabaseAdmin();

  const row: Record<string, unknown> = {};
  if (patch.category !== undefined) row.category = patch.category;
  if (patch.subcategory !== undefined) row.subcategory = patch.subcategory;
  if (patch.pattern !== undefined) row.pattern = patch.pattern;
  if (patch.material !== undefined) row.material = patch.material;
  if (patch.styleTags !== undefined) row.style_tags = patch.styleTags;
  if (patch.formality !== undefined) row.formality = patch.formality;
  if (patch.warmth !== undefined) row.warmth = patch.warmth;
  if (patch.seasons !== undefined) row.seasons = patch.seasons;
  if (patch.notes !== undefined) row.notes = patch.notes;
  if (patch.archived !== undefined) row.archived = patch.archived;

  if (patch.colors !== undefined) {
    row.colors = patch.colors;
    // El color dominante cacheado (`primary_hex`/`is_neutral`) se mantiene
    // en sincronía con `colors[0]` para que ordenar/filtrar en SQL siga
    // siendo correcto tras una edición manual.
    const firstColor = patch.colors[0];
    if (firstColor) {
      row.primary_hex = firstColor.hex;
      row.is_neutral = isNeutralHex(firstColor.hex);
    }
  }

  const { data, error } = await client
    .from(TABLE)
    .update(row)
    .eq("owner_id", DEFAULT_OWNER_ID)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`No se pudo actualizar la prenda ${id}: ${error.message}`);
  }

  return rowToGarment(data as GarmentRow);
}

export async function deleteGarment(id: string): Promise<void> {
  const client = getSupabaseAdmin();

  const { data: existing, error: fetchError } = await client
    .from(TABLE)
    .select("image_url, cutout_url, thumb_url")
    .eq("owner_id", DEFAULT_OWNER_ID)
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`No se pudo preparar el borrado de la prenda ${id}: ${fetchError.message}`);
  }
  if (!existing) return;

  const { error: deleteError } = await client
    .from(TABLE)
    .delete()
    .eq("owner_id", DEFAULT_OWNER_ID)
    .eq("id", id);

  if (deleteError) {
    throw new Error(`No se pudo borrar la prenda ${id}: ${deleteError.message}`);
  }

  const paths = extractStoragePaths([existing.image_url, existing.cutout_url, existing.thumb_url]);
  if (paths.length > 0) {
    await deleteImages(paths);
  }
}

/** Extrae la ruta relativa dentro del bucket a partir de una URL pública de Storage. */
function extractStoragePaths(urls: Array<string | null>): string[] {
  const marker = "/object/public/garments/";
  const paths: string[] = [];
  for (const url of urls) {
    if (!url) continue;
    const index = url.indexOf(marker);
    if (index === -1) continue;
    paths.push(url.slice(index + marker.length));
  }
  return paths;
}

export async function logWear(garmentId: string): Promise<void> {
  const client = getSupabaseAdmin();
  const { error } = await client.from("wear_log").insert({ garment_id: garmentId });

  if (error) {
    throw new Error(`No se pudo registrar el uso de la prenda ${garmentId}: ${error.message}`);
  }
}

/** garmentId → fecha ISO (yyyy-mm-dd) de la última vez que se registró su uso. */
export async function getLastWornMap(): Promise<Map<string, string>> {
  const client = getSupabaseAdmin();
  const { data, error } = await client
    .from("wear_log")
    .select("garment_id, worn_at")
    .order("worn_at", { ascending: false });

  if (error) {
    throw new Error(`No se pudo leer el registro de uso: ${error.message}`);
  }

  const map = new Map<string, string>();
  for (const row of data as Array<{ garment_id: string | null; worn_at: string }>) {
    if (!row.garment_id) continue;
    // Los resultados vienen ordenados por fecha descendente, así que la
    // primera vez que vemos un garment_id ya es su fecha más reciente.
    if (!map.has(row.garment_id)) {
      map.set(row.garment_id, row.worn_at);
    }
  }
  return map;
}
