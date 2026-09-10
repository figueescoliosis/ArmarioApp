import type { Outfit } from "@/lib/types";
import { computeSignature } from "@/lib/outfits/signature";
import { DEFAULT_OWNER_ID, getSupabaseAdmin } from "@/lib/db/supabase";
import {
  outfitToRow,
  rowToOutfit,
  type OutfitRowWithItems,
} from "@/lib/db/schema";

const OUTFITS_TABLE = "outfits";
const OUTFIT_ITEMS_TABLE = "outfit_items";

/** Selección con join anidado: trae cada outfit con sus prendas completas en una sola consulta. */
const OUTFIT_WITH_ITEMS_SELECT = "*, outfit_items(slot, garments(*))";

/** Código de Postgres para violación de restricción única (usado por el índice de `signature`). */
const UNIQUE_VIOLATION = "23505";

/**
 * Se reexporta la firma del motor de outfits en vez de reimplementarla: el
 * generador la usa como `id` del conjunto, así que cualquier divergencia
 * entre ambas rompería el guardado de favoritos.
 */
export { computeSignature } from "@/lib/outfits/signature";

export async function saveOutfit(outfit: Outfit): Promise<Outfit> {
  const client = getSupabaseAdmin();
  const garmentIds = outfit.items.map((item) => item.garment.id);
  const signature = computeSignature(garmentIds);

  const row = outfitToRow(outfit, DEFAULT_OWNER_ID, signature);
  const { data: inserted, error: insertError } = await client
    .from(OUTFITS_TABLE)
    .insert(row)
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === UNIQUE_VIOLATION) {
      // Ya existe un outfit con exactamente este conjunto de prendas: se
      // devuelve el existente en vez de duplicarlo.
      const existing = await getOutfitBySignature(signature);
      if (existing) return existing;
    }
    throw new Error(`No se pudo guardar el conjunto: ${insertError.message}`);
  }

  const outfitId = (inserted as { id: string }).id;
  const itemRows = outfit.items.map((item) => ({
    outfit_id: outfitId,
    garment_id: item.garment.id,
    slot: item.slot,
  }));

  const { error: itemsError } = await client.from(OUTFIT_ITEMS_TABLE).insert(itemRows);
  if (itemsError) {
    // No dejamos un outfit huérfano sin prendas si falla la segunda mitad
    // de la operación (supabase-js no expone transacciones multi-tabla).
    await client.from(OUTFITS_TABLE).delete().eq("id", outfitId);
    throw new Error(`No se pudieron guardar las prendas del conjunto: ${itemsError.message}`);
  }

  const saved = await getOutfitById(outfitId);
  if (!saved) {
    throw new Error(`El conjunto ${outfitId} se guardó pero no se pudo releer.`);
  }
  return saved;
}

async function getOutfitById(id: string): Promise<Outfit | null> {
  const client = getSupabaseAdmin();
  const { data, error } = await client
    .from(OUTFITS_TABLE)
    .select(OUTFIT_WITH_ITEMS_SELECT)
    .eq("owner_id", DEFAULT_OWNER_ID)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo leer el conjunto ${id}: ${error.message}`);
  }
  if (!data) return null;

  return rowToOutfit(data as unknown as OutfitRowWithItems);
}

async function getOutfitBySignature(signature: string): Promise<Outfit | null> {
  const client = getSupabaseAdmin();
  const { data, error } = await client
    .from(OUTFITS_TABLE)
    .select(OUTFIT_WITH_ITEMS_SELECT)
    .eq("owner_id", DEFAULT_OWNER_ID)
    .eq("signature", signature)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo leer el conjunto con firma ${signature}: ${error.message}`);
  }
  if (!data) return null;

  return rowToOutfit(data as unknown as OutfitRowWithItems);
}

export async function listFavorites(): Promise<Outfit[]> {
  const client = getSupabaseAdmin();
  const { data, error } = await client
    .from(OUTFITS_TABLE)
    .select(OUTFIT_WITH_ITEMS_SELECT)
    .eq("owner_id", DEFAULT_OWNER_ID)
    .eq("is_favorite", true)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`No se pudieron listar los conjuntos favoritos: ${error.message}`);
  }

  return (data as unknown as OutfitRowWithItems[]).map(rowToOutfit);
}

export async function setFavorite(outfitId: string, isFavorite: boolean): Promise<void> {
  const client = getSupabaseAdmin();
  const { error } = await client
    .from(OUTFITS_TABLE)
    .update({ is_favorite: isFavorite })
    .eq("owner_id", DEFAULT_OWNER_ID)
    .eq("id", outfitId);

  if (error) {
    throw new Error(`No se pudo actualizar el favorito del conjunto ${outfitId}: ${error.message}`);
  }
}

export async function deleteOutfit(id: string): Promise<void> {
  const client = getSupabaseAdmin();
  const { error } = await client
    .from(OUTFITS_TABLE)
    .delete()
    .eq("owner_id", DEFAULT_OWNER_ID)
    .eq("id", id);

  if (error) {
    throw new Error(`No se pudo borrar el conjunto ${id}: ${error.message}`);
  }
}
