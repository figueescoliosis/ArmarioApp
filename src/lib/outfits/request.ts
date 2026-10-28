import { SEASONS, type OutfitRequest, type Season } from "@/lib/types";

/**
 * Traduce el cuerpo de una petición de conjuntos a `OutfitRequest`,
 * descartando lo que no cuadre. La comparten `/api/outfits/generate` y
 * `/api/outfits/couple`.
 */
export function sanitizeRequest(body: Record<string, unknown>): OutfitRequest {
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
  if (body.mode === "solo" || body.mode === "mezcla") request.mode = body.mode;

  return request;
}
