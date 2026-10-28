import type { CoupleOutfit, Outfit } from "@/lib/types";
import { computeSignature } from "@/lib/outfits/signature";
import { currentOwnerId, getSupabaseAdmin } from "@/lib/db/supabase";
import { partnerOf } from "@/lib/owners";
import {
  outfitToRow,
  rowToOutfit,
  type OutfitRowWithItems,
} from "@/lib/db/schema";

const OUTFITS_TABLE = "outfits";
const OUTFIT_ITEMS_TABLE = "outfit_items";

/** Selección con join anidado: trae cada outfit con sus prendas completas en una sola consulta. */
export const OUTFIT_WITH_ITEMS_SELECT = "*, outfit_items(slot, garments(*))";

const COUPLES_TABLE = "couple_outfits";

/** Un par con sus dos conjuntos completos, embebidos por la columna de cada FK. */
export const COUPLE_SELECT = `*, a:outfit_a(${OUTFIT_WITH_ITEMS_SELECT}), b:outfit_b(${OUTFIT_WITH_ITEMS_SELECT})`;

/** Código de Postgres para violación de restricción única (usado por el índice de `signature`). */
const UNIQUE_VIOLATION = "23505";

/**
 * Se reexporta la firma del motor de outfits en vez de reimplementarla: el
 * generador la usa como `id` del conjunto, así que cualquier divergencia
 * entre ambas rompería el guardado de favoritos.
 */
export { computeSignature } from "@/lib/outfits/signature";

/**
 * `ownerId` solo lo pasa el servidor, sacado de `partnerOf()`, para guardar el
 * look del otro dentro de un par. Nunca viene del cliente.
 */
export async function saveOutfit(outfit: Outfit, ownerId?: string): Promise<Outfit> {
  const client = getSupabaseAdmin();
  const garmentIds = outfit.items.map((item) => item.garment.id);
  const signature = computeSignature(garmentIds);
  const owner = ownerId ?? (await currentOwnerId());

  const row = outfitToRow(outfit, owner, signature);
  const { data: inserted, error: insertError } = await client
    .from(OUTFITS_TABLE)
    .insert(row)
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === UNIQUE_VIOLATION) {
      // Ya existe un outfit con exactamente este conjunto de prendas: se
      // devuelve el existente en vez de duplicarlo.
      const existing = await getOutfitBySignature(signature, owner);
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

  const saved = await getOutfitById(outfitId, owner);
  if (!saved) {
    throw new Error(`El conjunto ${outfitId} se guardó pero no se pudo releer.`);
  }
  return saved;
}

async function getOutfitById(id: string, owner: string): Promise<Outfit | null> {
  const client = getSupabaseAdmin();
  const { data, error } = await client
    .from(OUTFITS_TABLE)
    .select(OUTFIT_WITH_ITEMS_SELECT)
    .eq("owner_id", owner)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo leer el conjunto ${id}: ${error.message}`);
  }
  if (!data) return null;

  return rowToOutfit(data as unknown as OutfitRowWithItems);
}

async function getOutfitBySignature(signature: string, owner: string): Promise<Outfit | null> {
  const client = getSupabaseAdmin();
  const { data, error } = await client
    .from(OUTFITS_TABLE)
    .select(OUTFIT_WITH_ITEMS_SELECT)
    .eq("owner_id", owner)
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
    .eq("owner_id", await currentOwnerId())
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
    .eq("owner_id", await currentOwnerId())
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
    .eq("owner_id", await currentOwnerId())
    .eq("id", id);

  if (error) {
    throw new Error(`No se pudo borrar el conjunto ${id}: ${error.message}`);
  }
}

/* ────────────────────────────── Pares ────────────────────────────── */

export interface CoupleRow {
  id: string;
  owner_a: string;
  owner_b: string;
  score: number;
  rationale: string | null;
  is_favorite: boolean;
  a: OutfitRowWithItems;
  b: OutfitRowWithItems;
}

/** Un par visto por `viewer`: `mine` es siempre su look, lo guardara quien lo guardara. */
export function rowToCouple(row: CoupleRow, viewer: string): CoupleOutfit {
  const [mine, theirs] = row.owner_a === viewer ? [row.a, row.b] : [row.b, row.a];
  return {
    id: row.id,
    mine: rowToOutfit(mine),
    theirs: rowToOutfit(theirs),
    name: row.a.name,
    score: Number(row.score),
    rationale: row.rationale ?? "",
    isFavorite: row.is_favorite,
  };
}

/**
 * Guarda un par: cada look en el armario de su dueño (sin marcarlo favorito
 * por separado) y la fila que los une. Si ese par ya existe, lo guardara quien
 * lo guardara, se reutiliza.
 */
export async function saveCouple(pair: CoupleOutfit, favorite: boolean): Promise<CoupleOutfit> {
  const me = await currentOwnerId();
  const partner = partnerOf(me);
  if (partner === null) throw new Error("No hay un segundo armario configurado.");

  const [mine, theirs] = await Promise.all([
    saveOutfit({ ...pair.mine, name: pair.name, isFavorite: false }),
    saveOutfit({ ...pair.theirs, name: pair.name, isFavorite: false }, partner.id),
  ]);

  const client = getSupabaseAdmin();
  const { data: existing, error: findError } = await client
    .from(COUPLES_TABLE)
    .select("id")
    .or(
      `and(outfit_a.eq.${mine.id},outfit_b.eq.${theirs.id}),and(outfit_a.eq.${theirs.id},outfit_b.eq.${mine.id})`,
    )
    .maybeSingle();
  if (findError) throw new Error(`No se pudo buscar el par: ${findError.message}`);

  let id = (existing as { id: string } | null)?.id;
  if (id === undefined) {
    const { data, error } = await client
      .from(COUPLES_TABLE)
      .insert({
        owner_a: me,
        owner_b: partner.id,
        outfit_a: mine.id,
        outfit_b: theirs.id,
        score: pair.score,
        rationale: pair.rationale,
        is_favorite: favorite,
      })
      .select("id")
      .single();
    if (error) throw new Error(`No se pudo guardar el par: ${error.message}`);
    id = (data as { id: string }).id;
  } else if (favorite) {
    await setCoupleFavorite(id, true);
  }

  return { ...pair, id, mine, theirs, isFavorite: favorite || pair.isFavorite };
}

/** Los pares favoritos de los dos, guardara quien los guardara. */
export async function listCoupleFavorites(): Promise<CoupleOutfit[]> {
  const me = await currentOwnerId();
  const { data, error } = await getSupabaseAdmin()
    .from(COUPLES_TABLE)
    .select(COUPLE_SELECT)
    .or(`owner_a.eq.${me},owner_b.eq.${me}`)
    .eq("is_favorite", true)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`No se pudieron listar los pares favoritos: ${error.message}`);
  return (data as unknown as CoupleRow[]).map((row) => rowToCouple(row, me));
}

export async function setCoupleFavorite(id: string, isFavorite: boolean): Promise<void> {
  const me = await currentOwnerId();
  const { error } = await getSupabaseAdmin()
    .from(COUPLES_TABLE)
    .update({ is_favorite: isFavorite })
    .or(`owner_a.eq.${me},owner_b.eq.${me}`)
    .eq("id", id);

  if (error) throw new Error(`No se pudo actualizar el par ${id}: ${error.message}`);
}
