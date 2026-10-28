import { beforeEach, describe, expect, it } from "vitest";
import { pairOutfits } from "@/lib/outfits/couple";
import { generateOutfits } from "@/lib/outfits/generator";
import type { Formality, Garment, Outfit } from "@/lib/types";
import { garment, resetIds, seedWardrobe } from "./fixtures";

/** Un look mínimo: camiseta y pantalón, con el color de la camiseta mandando. */
function look(id: string, topHex: string, formality: Formality = 3, score = 0.8): Outfit {
  const top = garment({ category: "top", primaryHex: topHex, formality });
  const bottom = garment({ category: "bottom", primaryHex: "#1A1A1A", isNeutral: true, formality });
  return {
    id,
    name: null,
    items: [
      { garment: top, slot: "top" },
      { garment: bottom, slot: "bottom" },
    ],
    score,
    breakdown: { color: score, formality: score, compatibility: score, season: score, freshness: score },
    rationale: "",
    source: "rules",
    isFavorite: false,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

beforeEach(resetIds);

describe("pairOutfits", () => {
  it("prefiere colores que combinan entre los dos looks", () => {
    // Azul marino con celeste (misma gama) frente a azul marino con verde lima.
    const [best] = pairOutfits(
      [look("mio", "#1F3A93")],
      [look("lima", "#9BE22B"), look("celeste", "#9CC9F5")],
      1,
    );
    expect(best?.theirs.id).toBe("celeste");
  });

  it("prefiere el mismo nivel de arreglo", () => {
    const [best] = pairOutfits(
      [look("mio", "#1F3A93", 4)],
      [look("chandal", "#9CC9F5", 1), look("traje", "#9CC9F5", 4)],
      1,
    );
    expect(best?.theirs.id).toBe("traje");
  });

  it("no repite un mismo look en dos pares", () => {
    const mine = [look("a", "#1F3A93"), look("b", "#C0392B"), look("c", "#2E8B57")];
    const theirs = [look("x", "#9CC9F5"), look("y", "#F5B7B1")];
    const pairs = pairOutfits(mine, theirs, 10);

    expect(pairs).toHaveLength(2);
    expect(new Set(pairs.map((p) => p.mine.id)).size).toBe(2);
    expect(new Set(pairs.map((p) => p.theirs.id)).size).toBe(2);
  });

  it("sale ordenado y es determinista sobre armarios reales", () => {
    const wardrobe: Garment[] = seedWardrobe();
    const mine = generateOutfits(wardrobe.slice(0, 10), { now: new Date("2026-06-01") });
    const theirs = generateOutfits(wardrobe.slice(10), { now: new Date("2026-06-01") });

    const first = pairOutfits(mine, theirs, 5);
    const second = pairOutfits(mine, theirs, 5);

    expect(first.map((p) => p.id)).toEqual(second.map((p) => p.id));
    for (let i = 1; i < first.length; i++) {
      expect(first[i - 1]!.score).toBeGreaterThanOrEqual(first[i]!.score);
    }
  });
});
