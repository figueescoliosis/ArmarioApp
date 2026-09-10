import { createHash } from "node:crypto";

/**
 * Identificador estable de un conjunto, derivado únicamente de las prendas que
 * lo componen.
 *
 * Los ids se ordenan antes de hashear, así que el mismo conjunto de prendas
 * produce siempre la misma firma independientemente del orden en que llegue.
 * Es lo que permite deduplicar entre generaciones sucesivas y lo que respalda
 * el índice único `outfits(owner_id, signature)`.
 */
export function computeSignature(garmentIds: string[]): string {
  const sorted = [...garmentIds].sort();
  return createHash("sha256").update(sorted.join("|")).digest("hex").slice(0, 32);
}
