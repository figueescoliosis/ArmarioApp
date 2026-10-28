/**
 * Conjuntos de pareja: un look de cada armario que vayan bien juntos.
 *
 * No genera nada nuevo: recibe los mejores conjuntos de cada uno (salidos de
 * `generateOutfits`, ya puntuados) y busca qué parejas combinan. Igual que el
 * generador, es puro y determinista: mismos conjuntos ⇒ mismos pares en el
 * mismo orden, y nada de red.
 */

import { harmonyScore, type HarmonyKind } from "@/lib/outfits/color";
import type { CoupleOutfit, Garment, Outfit, Slot } from "@/lib/types";

/** Cuánto pesa lo bueno de cada look frente a lo bien que combinan entre sí. */
const OWN_WEIGHT = 0.6;
const COORDINATION_WEIGHT = 0.4;

/** Dentro de la coordinación: color frente a nivel de arreglo. */
const COLOR_WEIGHT = 0.6;
const FORMALITY_WEIGHT = 0.4;

/** Qué prenda manda en el color de un look: la que más superficie ocupa. */
const SLOT_PRIORITY: Slot[] = ["dress", "top", "outerwear", "bottom", "shoes", "accessory"];

/**
 * Empareja los conjuntos de los dos armarios.
 *
 * Cada look aparece como mucho en un par: diez pares con el mismo jersey
 * cambiando solo el de enfrente no serían diez propuestas, serían una.
 */
export function pairOutfits(mine: Outfit[], theirs: Outfit[], limit = 10): CoupleOutfit[] {
  const candidates: CoupleOutfit[] = [];
  for (const a of mine) {
    for (const b of theirs) candidates.push(scorePair(a, b));
  }

  candidates.sort((x, y) => y.score - x.score || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));

  const usedMine = new Set<string>();
  const usedTheirs = new Set<string>();
  const result: CoupleOutfit[] = [];
  for (const pair of candidates) {
    if (result.length >= limit) break;
    if (usedMine.has(pair.mine.id) || usedTheirs.has(pair.theirs.id)) continue;
    usedMine.add(pair.mine.id);
    usedTheirs.add(pair.theirs.id);
    result.push(pair);
  }
  return result;
}

function scorePair(mine: Outfit, theirs: Outfit): CoupleOutfit {
  const harmony = harmonyScore(accentHex(mine), accentHex(theirs));
  const formalityGap = Math.abs(averageFormality(mine) - averageFormality(theirs));
  // La formalidad va de 1 a 5: 4 puntos de diferencia es chándal con traje.
  const formality = 1 - Math.min(formalityGap, 4) / 4;

  const coordination = COLOR_WEIGHT * harmony.score + FORMALITY_WEIGHT * formality;
  const own = (mine.score + theirs.score) / 2;

  return {
    id: `${mine.id}+${theirs.id}`,
    mine,
    theirs,
    score: OWN_WEIGHT * own + COORDINATION_WEIGHT * coordination,
    rationale: `${COLOR_PHRASES[harmony.kind]}, ${formalityGap < 0.75 ? "con el mismo nivel de arreglo" : "uno algo más arreglado que el otro"}.`,
  };
}

const COLOR_PHRASES: Record<HarmonyKind, string> = {
  neutral: "Una base neutra que deja lucir a los dos",
  monocromatico: "Vais a juego en la misma gama de color",
  analogo: "Colores vecinos que combinan sin ir iguales",
  complementario: "Colores que se complementan",
  triadico: "Colores que contrastan con intención",
  discordante: "Colores que no se buscan mucho entre sí",
};

/** El color que se ve primero en un look: el de la prenda principal no neutra. */
function accentHex(outfit: Outfit): string {
  const garments = SLOT_PRIORITY.flatMap((slot) =>
    outfit.items.filter((item) => item.slot === slot).map((item) => item.garment),
  );
  const accent = garments.find((garment) => !garment.isNeutral) ?? garments[0];
  return accent?.primaryHex ?? "#808080";
}

function averageFormality(outfit: Outfit): number {
  const garments: Garment[] = outfit.items.map((item) => item.garment);
  if (garments.length === 0) return 3;
  return garments.reduce((sum, garment) => sum + garment.formality, 0) / garments.length;
}
