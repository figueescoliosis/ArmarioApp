import type { CoupleOutfit, Outfit, Plan } from "@/lib/types";
import { currentOwnerId, getSupabaseAdmin } from "@/lib/db/supabase";
import { rowToOutfit, type OutfitRowWithItems } from "@/lib/db/schema";
import {
  COUPLE_SELECT,
  OUTFIT_WITH_ITEMS_SELECT,
  rowToCouple,
  saveCouple,
  saveOutfit,
  type CoupleRow,
} from "@/lib/db/outfits";
import { partnerOf } from "@/lib/owners";

const PLANS_TABLE = "plans";

const PLAN_SELECT = `id, owner_id, day, outfit:outfit_id(${OUTFIT_WITH_ITEMS_SELECT}), couple:couple_id(${COUPLE_SELECT})`;

interface PlanRow {
  id: string;
  owner_id: string;
  day: string;
  outfit: OutfitRowWithItems | null;
  couple: CoupleRow | null;
}

/** Apunta un conjunto o un par para un día. Guarda primero lo que haga falta. */
export async function addPlan(
  day: string,
  target: { outfit: Outfit } | { couple: CoupleOutfit },
): Promise<Plan> {
  const me = await currentOwnerId();
  const row: { owner_id: string; day: string; outfit_id?: string; couple_id?: string } =
    "outfit" in target
      ? { owner_id: me, day, outfit_id: (await saveOutfit(target.outfit)).id }
      : { owner_id: me, day, couple_id: (await saveCouple(target.couple, false)).id };

  const { data, error } = await getSupabaseAdmin()
    .from(PLANS_TABLE)
    .insert(row)
    .select(PLAN_SELECT)
    .single();

  if (error) throw new Error(`No se pudo apuntar el plan: ${error.message}`);
  return rowToPlan(data as unknown as PlanRow, me);
}

/** Planes de los dos desde `from` (yyyy-mm-dd), por día. */
export async function listPlans(from: string): Promise<Plan[]> {
  const me = await currentOwnerId();
  const partner = partnerOf(me);
  const { data, error } = await getSupabaseAdmin()
    .from(PLANS_TABLE)
    .select(PLAN_SELECT)
    .in("owner_id", partner === null ? [me] : [me, partner.id])
    .gte("day", from)
    .order("day")
    .order("created_at");

  if (error) throw new Error(`No se pudieron leer los planes: ${error.message}`);
  return (data as unknown as PlanRow[]).map((row) => rowToPlan(row, me));
}

/** Solo quien apuntó el plan lo puede borrar. */
export async function deletePlan(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from(PLANS_TABLE)
    .delete()
    .eq("owner_id", await currentOwnerId())
    .eq("id", id);

  if (error) throw new Error(`No se pudo borrar el plan ${id}: ${error.message}`);
}

function rowToPlan(row: PlanRow, viewer: string): Plan {
  return {
    id: row.id,
    day: row.day,
    ownerId: row.owner_id,
    outfit: row.outfit === null ? null : rowToOutfit(row.outfit),
    couple: row.couple === null ? null : rowToCouple(row.couple, viewer),
  };
}
