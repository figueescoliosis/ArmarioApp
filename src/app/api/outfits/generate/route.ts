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
import { SEASONS, type OutfitRequest, type Season } from "@/lib/types";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  return handle(async () => {
    const raw: unknown = await request.json().catch(() => ({}));
    const body = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;

    const outfitRequest = sanitizeRequest(body);

    const [garments, lastWorn] = await Promise.all([listGarments(), getLastWornMap()]);

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

function sanitizeRequest(body: Record<string, unknown>): OutfitRequest {
  const request: OutfitRequest = {};

  if (typeof body.occasion === "number" && body.occasion >= 1 && body.occasion <= 5) {
    request.occasion = Math.round(body.occasion) as OutfitRequest["occasion"];
  }
  if (typeof body.temperatureC === "number" && Number.isFinite(body.temperatureC)) {
    request.temperatureC = body.temperatureC;
  }
  if (typeof body.season === "string" && (SEASONS as readonly string[]).includes(body.season)) {
    request.season = body.season as Season;
  }
  if (Array.isArray(body.mustIncludeIds)) {
    request.mustIncludeIds = body.mustIncludeIds.filter((id): id is string => typeof id === "string");
  }
  if (Array.isArray(body.excludeIds)) {
    request.excludeIds = body.excludeIds.filter((id): id is string => typeof id === "string");
  }
  if (typeof body.limit === "number" && body.limit > 0) {
    request.limit = Math.min(30, Math.round(body.limit));
  }
  if (typeof body.useLlmRanking === "boolean") request.useLlmRanking = body.useLlmRanking;

  return request;
}
