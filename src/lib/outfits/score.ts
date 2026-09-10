/**
 * Puntuación de un conjunto ya formado.
 *
 * Está separado de `generator.ts` por una razón concreta: `generator.ts`
 * importa `signature.ts`, que usa `node:crypto`, así que no puede llegar al
 * navegador. El probador necesita puntuar en el cliente para dar el veredicto
 * al instante, sin una petición por cada prenda que se cambia.
 *
 * Todo lo de aquí es puro y determinista. Es también la **única** fuente de la
 * puntuación: si el probador calculase la suya, el mismo conjunto daría un
 * porcentaje en `/probador` y otro distinto en `/outfits`.
 */

import type {
  Garment,
  LookEvaluation,
  LookIssue,
  OutfitItem,
  OutfitRequest,
  ScoreBreakdown,
} from "@/lib/types";
import { harmonyScore, paletteHarmony } from "@/lib/outfits/color";
import {
  compatibilityScore,
  formalityScore,
  freshnessScore,
  hardRuleViolation,
  pairCompatibility,
  seasonScore,
} from "@/lib/outfits/rules";

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
 * Es el corte que evita la explosión combinatoria en armarios grandes, y el
 * mismo umbral que marca un desajuste como grave en el probador.
 */
export const PRUNE_FLOOR = 0.3;

/** Entre este valor y `PRUNE_FLOOR` el par no está vetado, pero se avisa. */
const WARN_FLOOR = 0.55;

/** Por debajo de esta armonía de paleta, los colores chocan de verdad. */
const COLOR_FLOOR = 0.4;

export function computeBreakdown(
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

export function weighted(breakdown: ScoreBreakdown): number {
  return (
    breakdown.color * WEIGHTS.color +
    breakdown.compatibility * WEIGHTS.compatibility +
    breakdown.formality * WEIGHTS.formality +
    breakdown.season * WEIGHTS.season +
    breakdown.freshness * WEIGHTS.freshness
  );
}

/**
 * Explicación de estilista, sin modelo de lenguaje. Se queda con el rasgo más
 * característico del conjunto en vez de recitar las cinco métricas.
 */
export function explainByRules(items: OutfitItem[], breakdown: ScoreBreakdown): string {
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
    parts.push("Además rescata prendas que llevabas tiempo sin ponerte");
  }

  return parts.length > 0 ? `${parts.join(". ")}.` : "Un conjunto equilibrado.";
}

/* ────────────────────────── Veredicto de un look ────────────────────────── */

export interface EvaluateOptions {
  request?: OutfitRequest;
  lastWorn?: Map<string, string>;
  now?: Date;
}

/**
 * Puntúa un conjunto que ha compuesto el usuario y traduce las métricas a
 * avisos legibles.
 *
 * El generador usa estas mismas comprobaciones para **descartar** conjuntos en
 * silencio; aquí no se descarta nada: el usuario ha elegido a mano, así que lo
 * que toca es decirle qué falla y dejarle decidir.
 */
export function evaluateLook(
  garments: Garment[],
  options: EvaluateOptions = {},
): LookEvaluation {
  const request = options.request ?? {};
  const lastWorn = options.lastWorn ?? new Map<string, string>();
  const now = options.now ?? new Date();

  // Los huecos no importan para puntuar: `computeBreakdown` solo mira prendas.
  const items: OutfitItem[] = garments.map((garment) => ({
    garment,
    slot: garment.category,
  }));

  const breakdown = computeBreakdown(items, request, lastWorn, now);

  return {
    score: weighted(breakdown),
    breakdown,
    rationale: explainByRules(items, breakdown),
    issues: collectIssues(garments, breakdown),
  };
}

function collectIssues(garments: Garment[], breakdown: ScoreBreakdown): LookIssue[] {
  const issues: LookIssue[] = [];

  const violation = hardRuleViolation(garments);
  if (violation !== null) {
    issues.push({ severity: "grave", message: `No puede ser: ${violation}.` });
  }

  for (let i = 0; i < garments.length; i++) {
    for (let j = i + 1; j < garments.length; j++) {
      const a = garments[i];
      const b = garments[j];
      if (a === undefined || b === undefined) continue;

      const compat = pairCompatibility(a, b);
      if (compat >= WARN_FLOOR) continue;

      issues.push(
        compat < PRUNE_FLOOR
          ? { severity: "grave", message: `${capitalize(name(a))} no pega con ${name(b)}.` }
          : {
              severity: "leve",
              message: `${capitalize(name(a))} y ${name(b)} van a registros distintos.`,
            },
      );
    }
  }

  if (garments.length > 1 && breakdown.color < COLOR_FLOOR) {
    issues.push({ severity: "leve", message: "Los colores chocan más que contrastan." });
  }

  return issues;
}

/** La subcategoría ya viene en español y es lo que el usuario reconoce. */
function name(garment: Garment): string {
  return garment.subcategory.trim() || "esa prenda";
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
