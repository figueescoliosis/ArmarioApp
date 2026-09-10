/**
 * Generador de conjuntos.
 *
 * Es determinista y no toca la red: con el mismo armario y la misma petición
 * devuelve exactamente los mismos conjuntos en el mismo orden. Eso lo hace
 * testeable de verdad, y hace que la app siga funcionando aunque no haya
 * ninguna API de IA disponible.
 *
 * El recorrido es combinatorio sobre las plantillas, con poda temprana: en
 * cuanto dos prendas ya elegidas son incompatibles se abandona esa rama entera
 * en vez de terminar de construir conjuntos que van a puntuar mal igualmente.
 */

import type {
  Garment,
  Outfit,
  OutfitItem,
  OutfitRequest,
  ScoreBreakdown,
  Slot,
} from "@/lib/types";
import { harmonyScore, paletteHarmony } from "@/lib/outfits/color";
import {
  OUTFIT_TEMPLATES,
  compatibilityScore,
  formalityScore,
  freshnessScore,
  hardRuleViolation,
  pairCompatibility,
  seasonScore,
  warmthForTemperature,
} from "@/lib/outfits/rules";
import { computeSignature } from "@/lib/outfits/signature";

/** Peso de cada componente en la puntuación final. Suman 1. */
export const WEIGHTS: Readonly<ScoreBreakdown> = {
  color: 0.35,
  compatibility: 0.25,
  formality: 0.2,
  season: 0.1,
  freshness: 0.1,
};

/**
 * Por debajo de esta compatibilidad entre dos prendas, la rama se abandona.
 * Es el corte que evita la explosión combinatoria en armarios grandes.
 */
const PRUNE_FLOOR = 0.3;

/** Máximo de candidatas por hueco. Acota el peor caso a unas decenas de miles. */
const MAX_CANDIDATES_PER_SLOT = 25;

/**
 * Cuántas bases pasan a la fase de enriquecido. Es el parámetro que mantiene
 * la generación por debajo del segundo con armarios de cientos de prendas.
 */
const ENRICH_TOP_N = 200;

/** Solape máximo tolerado entre dos conjuntos devueltos, como fracción. */
const MAX_OVERLAP = 0.6;

/** Veces que una misma prenda puede aparecer en el resultado final. */
const MAX_APPEARANCES_PER_GARMENT = 3;

export interface GenerateOptions {
  request?: OutfitRequest;
  /** garmentId → fecha ISO de la última vez que se puso. */
  lastWorn?: Map<string, string>;
  /** Inyectable para que los tests sean deterministas. */
  now?: Date;
}

export function generateOutfits(
  garments: Garment[],
  options: GenerateOptions = {},
): Outfit[] {
  const request = options.request ?? {};
  const lastWorn = options.lastWorn ?? new Map<string, string>();
  const now = options.now ?? new Date();
  const limit = request.limit ?? 10;

  const pool = filterPool(garments, request);
  const bySlot = bucketBySlot(pool, request, lastWorn, now);

  const mustInclude = new Set(request.mustIncludeIds ?? []);

  // Fase 1: recorrer las plantillas y puntuar solo la base (los huecos
  // obligatorios). Es la parte combinatoria, y por eso tiene que ser barata.
  const bases: { items: OutfitItem[]; optional: readonly Slot[]; score: number }[] = [];

  for (const template of OUTFIT_TEMPLATES) {
    const slots = template.required;

    // Si algún hueco obligatorio se queda sin candidatas, esta plantilla no
    // puede producir nada: no tiene sentido recorrerla.
    if (slots.some((slot) => (bySlot.get(slot)?.length ?? 0) === 0)) continue;

    walk(
      slots,
      0,
      [],
      (chosen) => {
        if (mustInclude.size > 0) {
          const ids = new Set(chosen.map((item) => item.garment.id));
          // Una prenda forzada puede entrar todavía por un hueco opcional, así
          // que aquí solo se descarta si su hueco es obligatorio en esta
          // plantilla y aun así no está.
          const pendientes = [...mustInclude].filter((id) => !ids.has(id));
          const alcanzables = pendientes.every((id) =>
            template.optional.some((slot) =>
              (bySlot.get(slot) ?? []).some((g) => g.id === id),
            ),
          );
          if (!alcanzables) return;
        }

        if (hardRuleViolation(chosen.map((item) => item.garment)) !== null) return;
        // Aquí solo interesa el número: construir el conjunto entero (con su
        // firma sha256 y su explicación) para las decenas de miles de bases que
        // se van a descartar cuesta más que todo el resto de la generación.
        const breakdown = computeBreakdown(chosen, request, lastWorn, now);
        bases.push({ items: chosen, optional: template.optional, score: weighted(breakdown) });
      },
      bySlot,
    );
  }

  // Fase 2: enriquecer con abrigo y accesorio solo las mejores bases. Añadir
  // prendas opcionales cuesta un orden de magnitud más que puntuar una base, y
  // una combinación que ya va última no va a remontar por ponerle un cinturón.
  bases.sort((a, b) => b.score - a.score);

  const candidates: Outfit[] = [];
  const seen = new Set<string>();

  for (const base of bases.slice(0, ENRICH_TOP_N)) {
    const items = addOptionalPieces(base.items, base.optional, bySlot, request);

    if (mustInclude.size > 0) {
      const ids = new Set(items.map((item) => item.garment.id));
      if (![...mustInclude].every((id) => ids.has(id))) continue;
    }

    const outfit = scoreOutfit(items, request, lastWorn, now);
    if (outfit === null || seen.has(outfit.id)) continue;

    seen.add(outfit.id);
    candidates.push(outfit);
  }

  candidates.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return diversify(candidates, limit);
}

/* ────────────────────────── Selección del material ────────────────────────── */

function filterPool(garments: Garment[], request: OutfitRequest): Garment[] {
  const excluded = new Set(request.excludeIds ?? []);
  return garments.filter((g) => !g.archived && !excluded.has(g.id));
}

/**
 * Reparte las prendas por hueco y recorta cada lista a las más prometedoras.
 *
 * El criterio de recorte es a propósito independiente del conjunto final: se
 * ordena por lo bien que encaja la prenda *por sí sola* con lo que se ha
 * pedido (ocasión, temperatura) y por cuánto tiempo lleva sin usarse. Las
 * prendas que el usuario ha forzado a incluir se anteponen siempre.
 */
function bucketBySlot(
  pool: Garment[],
  request: OutfitRequest,
  lastWorn: Map<string, string>,
  now: Date,
): Map<Slot, Garment[]> {
  const mustInclude = new Set(request.mustIncludeIds ?? []);
  const targetWarmth =
    request.temperatureC !== undefined ? warmthForTemperature(request.temperatureC) : null;

  const buckets = new Map<Slot, Garment[]>();

  for (const garment of pool) {
    const slot: Slot = garment.category;
    const list = buckets.get(slot);
    if (list === undefined) buckets.set(slot, [garment]);
    else list.push(garment);
  }

  for (const [slot, list] of buckets) {
    const scored = list.map((garment) => {
      let prior = 0;

      if (mustInclude.has(garment.id)) prior += 100;

      if (request.occasion !== undefined) {
        prior += 3 - Math.abs(garment.formality - request.occasion);
      }
      if (targetWarmth !== null) {
        prior += 3 - Math.abs(garment.warmth - targetWarmth);
      }
      if (request.season !== undefined) {
        if (garment.seasons.length === 0 || garment.seasons.includes(request.season)) {
          prior += 1;
        } else {
          prior -= 2;
        }
      }
      prior += freshnessScore([garment], lastWorn, now);

      return { garment, prior };
    });

    scored.sort(
      (a, b) => b.prior - a.prior || a.garment.id.localeCompare(b.garment.id),
    );
    buckets.set(
      slot,
      scored.slice(0, MAX_CANDIDATES_PER_SLOT).map((entry) => entry.garment),
    );
  }

  return buckets;
}

/* ────────────────────────── Recorrido con poda ────────────────────────── */

function walk(
  slots: readonly Slot[],
  depth: number,
  chosen: OutfitItem[],
  emit: (items: OutfitItem[]) => void,
  bySlot: Map<Slot, Garment[]>,
): void {
  if (depth === slots.length) {
    emit([...chosen]);
    return;
  }

  const slot = slots[depth];
  if (slot === undefined) return;

  for (const garment of bySlot.get(slot) ?? []) {
    // Poda: basta con que la prenda nueva sea incompatible con una sola de las
    // ya elegidas para descartar toda la rama.
    let compatible = true;
    for (const item of chosen) {
      if (pairCompatibility(item.garment, garment) < PRUNE_FLOOR) {
        compatible = false;
        break;
      }
    }
    if (!compatible) continue;

    chosen.push({ garment, slot });
    if (hardRuleViolation(chosen.map((item) => item.garment)) === null) {
      walk(slots, depth + 1, chosen, emit, bySlot);
    }
    chosen.pop();
  }
}

/**
 * Añade abrigo y accesorio si mejoran el conjunto.
 *
 * El abrigo solo entra cuando la temperatura lo pide; si no se ha indicado
 * ninguna, no se fuerza — nadie quiere que le propongan un plumas en agosto
 * solo porque combina bien de color.
 */
function addOptionalPieces(
  base: OutfitItem[],
  optional: readonly Slot[],
  bySlot: Map<Slot, Garment[]>,
  request: OutfitRequest,
): OutfitItem[] {
  const result = [...base];
  const targetWarmth =
    request.temperatureC !== undefined ? warmthForTemperature(request.temperatureC) : null;

  for (const slot of optional) {
    if (slot === "outerwear" && (targetWarmth === null || targetWarmth < 3)) continue;

    let best: { garment: Garment; score: number } | null = null;

    for (const garment of bySlot.get(slot) ?? []) {
      const trial = [...result.map((item) => item.garment), garment];
      if (hardRuleViolation(trial) !== null) continue;

      const compat = compatibilityScore(trial);
      if (compat < PRUNE_FLOOR) continue;

      const harmony = paletteHarmony(trial.map((g) => g.primaryHex));
      const score = compat * 0.5 + harmony * 0.5;

      if (best === null || score > best.score) best = { garment, score };
    }

    // Solo se añade si aporta: por debajo de este listón, el conjunto está
    // mejor sin la prenda de más.
    if (best !== null && best.score > 0.6) result.push({ garment: best.garment, slot });
  }

  return result;
}

/* ────────────────────────── Puntuación ────────────────────────── */

function computeBreakdown(
  items: OutfitItem[],
  request: OutfitRequest,
  lastWorn: Map<string, string>,
  now: Date,
): ScoreBreakdown {
  const garments = items.map((item) => item.garment);

  return {
    color: paletteHarmony(garments.map((g) => g.primaryHex)),
    compatibility: compatibilityScore(garments),
    formality: formalityScore(garments, request.occasion),
    season: seasonScore(garments, {
      season: request.season,
      temperatureC: request.temperatureC,
    }),
    freshness: freshnessScore(garments, lastWorn, now),
  };
}

function weighted(breakdown: ScoreBreakdown): number {
  return (
    breakdown.color * WEIGHTS.color +
    breakdown.compatibility * WEIGHTS.compatibility +
    breakdown.formality * WEIGHTS.formality +
    breakdown.season * WEIGHTS.season +
    breakdown.freshness * WEIGHTS.freshness
  );
}

/** Ensambla el conjunto definitivo. Solo se llama para los finalistas. */
function scoreOutfit(
  items: OutfitItem[],
  request: OutfitRequest,
  lastWorn: Map<string, string>,
  now: Date,
): Outfit | null {
  const garments = items.map((item) => item.garment);
  if (hardRuleViolation(garments) !== null) return null;

  const breakdown = computeBreakdown(items, request, lastWorn, now);

  return {
    id: computeSignature(garments.map((g) => g.id)),
    name: null,
    items,
    score: weighted(breakdown),
    breakdown,
    rationale: explainByRules(items, breakdown),
    source: "rules",
    isFavorite: false,
    createdAt: now.toISOString(),
  };
}

/**
 * Explicación de estilista, sin modelo de lenguaje. Se queda con el rasgo más
 * característico del conjunto en vez de recitar las cinco métricas.
 */
function explainByRules(items: OutfitItem[], breakdown: ScoreBreakdown): string {
  const garments = items.map((item) => item.garment);
  const first = garments[0];
  const second = garments[1];

  const parts: string[] = [];

  if (first !== undefined && second !== undefined) {
    const harmony = harmonyScore(first.primaryHex, second.primaryHex);
    const byKind: Record<string, string> = {
      neutral: "Se apoya en una base neutra, que es lo que hace que no falle",
      monocromatico: "Juega con un mismo color en dos intensidades",
      analogo: "Combina colores vecinos, así que el salto entre prendas es suave",
      triadico: "Reparte el color en tres puntos equidistantes de la rueda",
      complementario: "Enfrenta dos colores opuestos y por eso tiene fuerza",
      discordante: "Mezcla colores que no son parientes, con lo que arriesga",
    };
    const line = byKind[harmony.kind];
    if (line !== undefined) parts.push(line);
  }

  const formality = Math.round(
    garments.reduce((sum, g) => sum + g.formality, 0) / Math.max(1, garments.length),
  );
  const registro: Record<number, string> = {
    1: "para estar por casa",
    2: "de diario",
    3: "resuelto pero informal",
    4: "para una ocasión formal",
    5: "de etiqueta",
  };
  const registroLine = registro[formality];
  if (registroLine !== undefined) parts.push(`El registro es ${registroLine}`);

  if (breakdown.freshness > 0.8) {
    parts.push("además rescata prendas que llevabas tiempo sin ponerte");
  }

  return parts.length > 0 ? `${parts.join(". ")}.` : "Un conjunto equilibrado.";
}

/* ────────────────────────── Diversidad ────────────────────────── */

/**
 * Selección voraz que evita devolver diez variantes del mismo conjunto con los
 * zapatos cambiados. Descarta un candidato si se parece demasiado a alguno ya
 * elegido, y limita cuántas veces puede repetirse una misma prenda.
 */
function diversify(sorted: Outfit[], limit: number): Outfit[] {
  const selected: Outfit[] = [];
  const appearances = new Map<string, number>();

  for (const candidate of sorted) {
    if (selected.length >= limit) break;

    const ids = new Set(candidate.items.map((item) => item.garment.id));

    const tooSimilar = selected.some((chosen) => {
      const chosenIds = new Set(chosen.items.map((item) => item.garment.id));
      let shared = 0;
      for (const id of ids) if (chosenIds.has(id)) shared++;
      const union = new Set([...ids, ...chosenIds]).size;
      return union > 0 && shared / union > MAX_OVERLAP;
    });
    if (tooSimilar) continue;

    const overused = [...ids].some(
      (id) => (appearances.get(id) ?? 0) >= MAX_APPEARANCES_PER_GARMENT,
    );
    if (overused) continue;

    selected.push(candidate);
    for (const id of ids) appearances.set(id, (appearances.get(id) ?? 0) + 1);
  }

  return selected;
}
