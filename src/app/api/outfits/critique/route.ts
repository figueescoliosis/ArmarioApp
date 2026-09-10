/**
 * Crítica de un conjunto compuesto a mano en el probador.
 *
 * El veredicto de reglas ya lo calcula el navegador al instante; esto es el
 * paso opcional de "¿y tú qué opinas?": manda el look al modelo para que lo
 * nombre y escriba por qué funciona o por qué no.
 *
 * No se reutiliza `/api/outfits/generate` con `mustIncludeIds` porque el
 * generador **veta** los conjuntos con un par imposible, que son justo los que
 * más interesa que alguien comente.
 */

import { NextRequest } from "next/server";
import { fail, handle, ok } from "@/lib/api";
import { getLastWornMap, listGarments } from "@/lib/db/garments";
import { explainOutfits } from "@/lib/outfits/explain";
import { evaluateLook } from "@/lib/outfits/score";
import { computeSignature } from "@/lib/outfits/signature";
import type { Outfit, OutfitItem } from "@/lib/types";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  return handle(async () => {
    const raw: unknown = await request.json().catch(() => null);
    const body = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;

    const ids = Array.isArray(body.garmentIds)
      ? body.garmentIds.filter((id): id is string => typeof id === "string")
      : [];

    if (ids.length < 2) {
      return fail("BAD_REQUEST", "Hacen falta al menos dos prendas para opinar sobre un look.");
    }

    const [wardrobe, lastWorn] = await Promise.all([
      listGarments({ includeArchived: true }),
      getLastWornMap(),
    ]);

    const byId = new Map(wardrobe.map((garment) => [garment.id, garment]));
    const garments = ids.map((id) => byId.get(id)).filter((g) => g !== undefined);

    if (garments.length !== ids.length) {
      return fail("NOT_FOUND", "Alguna de las prendas del look ya no está en el armario.");
    }

    const evaluation = evaluateLook(garments, { lastWorn });
    const items: OutfitItem[] = garments.map((garment) => ({
      garment,
      slot: garment.category,
    }));

    const outfit: Outfit = {
      id: computeSignature(ids),
      name: null,
      items,
      score: evaluation.score,
      breakdown: evaluation.breakdown,
      rationale: evaluation.rationale,
      source: "rules",
      isFavorite: false,
      createdAt: new Date().toISOString(),
    };

    // Si no hay clave o el modelo falla, `explainOutfits` devuelve el conjunto
    // sin tocar: el probador seguirá mostrando el veredicto de reglas.
    const [critiqued] = await explainOutfits([outfit]);
    return ok(critiqued ?? outfit);
  });
}
