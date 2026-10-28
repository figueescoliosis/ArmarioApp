/**
 * Conjuntos de pareja: los mejores looks de cada armario, emparejados.
 *
 * Cada armario pasa por el generador con la misma petición (misma ocasión,
 * misma temperatura) y `pairOutfits` busca qué looks van bien juntos. Todo por
 * reglas: sin modelo, así que es rápido y no gasta cuota.
 */

import { NextRequest } from "next/server";
import { fail, handle, ok } from "@/lib/api";
import { getLastWornMap, listGarments } from "@/lib/db/garments";
import { currentOwnerId } from "@/lib/db/supabase";
import { pairOutfits } from "@/lib/outfits/couple";
import { generateOutfits } from "@/lib/outfits/generator";
import { sanitizeRequest } from "@/lib/outfits/request";
import { partnerOf } from "@/lib/owners";

/** Looks de cada armario que entran al emparejado. */
const CANDIDATES_PER_OWNER = 15;

export async function POST(request: NextRequest) {
  return handle(async () => {
    const raw: unknown = await request.json().catch(() => ({}));
    const body = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
    const outfitRequest = sanitizeRequest(body);

    const me = await currentOwnerId();
    const partner = partnerOf(me);
    if (partner === null) {
      return fail("NOT_FOUND", "No hay un segundo armario configurado.");
    }

    const [mine, theirs, lastWorn] = await Promise.all([
      listGarments({ ownerIds: [me] }),
      listGarments({ ownerIds: [partner.id] }),
      getLastWornMap(),
    ]);

    if (mine.length < 2 || theirs.length < 2) {
      return fail(
        "BAD_REQUEST",
        "Hacen falta al menos dos prendas en cada armario para combinar en pareja.",
      );
    }

    const generate = (garments: typeof mine) =>
      generateOutfits(garments, {
        request: { ...outfitRequest, limit: CANDIDATES_PER_OWNER },
        lastWorn,
      });

    const pairs = pairOutfits(generate(mine), generate(theirs), outfitRequest.limit ?? 10);
    if (pairs.length === 0) {
      return fail(
        "NOT_FOUND",
        "No ha salido ningún conjunto de pareja con esas restricciones. Prueba a relajar la ocasión o la temperatura.",
      );
    }

    return ok(pairs);
  });
}
