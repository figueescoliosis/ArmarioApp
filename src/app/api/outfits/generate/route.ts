/**
 * Generación de conjuntos.
 *
 * El motor es local y determinista: esta ruta lee el armario, lo pasa por el
 * generador y opcionalmente deja que Claude reordene y redacte el top 5. Si esa
 * segunda parte falla, se devuelven igualmente los conjuntos de las reglas.
 */

import { NextRequest } from "next/server";
import { fail, handle, ok } from "@/lib/api";
import { getLastWornMap, listGarments } from "@/lib/db/garments";
import { generateOutfits } from "@/lib/outfits/generator";
import { explainOutfits } from "@/lib/outfits/explain";
import { sanitizeRequest } from "@/lib/outfits/request";
import { currentOwnerId } from "@/lib/db/supabase";
import { partnerOf } from "@/lib/owners";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  return handle(async () => {
    const raw: unknown = await request.json().catch(() => ({}));
    const body = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;

    const outfitRequest = sanitizeRequest(body);

    // En modo mezcla entran los dos armarios; el motor no sabe de dueños.
    const me = await currentOwnerId();
    const partner = outfitRequest.mode === "mezcla" ? partnerOf(me) : null;
    const ownerIds = partner === null ? [me] : [me, partner.id];

    const [garments, lastWorn] = await Promise.all([
      listGarments({ ownerIds }),
      getLastWornMap(),
    ]);

    if (garments.length < 2) {
      return fail(
        "BAD_REQUEST",
        "Hacen falta al menos dos prendas en el armario para poder combinar.",
      );
    }

    const outfits = generateOutfits(garments, { request: outfitRequest, lastWorn });

    if (outfits.length === 0) {
      return fail(
        "NOT_FOUND",
        "No se ha podido formar ningún conjunto con esas restricciones. Prueba a relajar la ocasión o la temperatura.",
      );
    }

    const finalOutfits = outfitRequest.useLlmRanking ? await explainOutfits(outfits) : outfits;

    return ok(finalOutfits);
  });
}
