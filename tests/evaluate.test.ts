import { describe, expect, it } from "vitest";
import { generateOutfits } from "@/lib/outfits/generator";
import { evaluateLook } from "@/lib/outfits/score";
import { garment, resetIds, seedWardrobe } from "./fixtures";

const NOW = new Date("2026-03-01T10:00:00.000Z");

/** Los mensajes de `grave` son los que el probador enseña como "Mis-match". */
function graves(issues: { severity: string; message: string }[]): string[] {
  return issues.filter((issue) => issue.severity === "grave").map((issue) => issue.message);
}

describe("evaluateLook", () => {
  it("no encuentra nada que objetar en un conjunto coherente", () => {
    resetIds();
    const look = [
      garment({ category: "top", subcategory: "camisa de vestir blanca", primaryHex: "#F5F3EF", formality: 4, isNeutral: true }),
      garment({ category: "bottom", subcategory: "vaquero recto azul", primaryHex: "#3A5A82", formality: 2, isNeutral: true }),
      garment({ category: "shoes", subcategory: "zapatilla blanca", primaryHex: "#EFEFEF", formality: 2, isNeutral: true }),
    ];

    const { issues, score } = evaluateLook(look, { now: NOW });

    expect(issues).toEqual([]);
    expect(score).toBeGreaterThan(0.6);
  });

  it("avisa del par imposible nombrando las dos prendas", () => {
    resetIds();
    const look = [
      garment({ category: "bottom", subcategory: "pantalón de chándal gris", formality: 1, isNeutral: true }),
      garment({ category: "shoes", subcategory: "zapato de vestir marrón", formality: 5, isNeutral: true }),
    ];

    const avisos = graves(evaluateLook(look, { now: NOW }).issues);

    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toContain("chándal");
    expect(avisos[0]).toContain("zapato de vestir");
  });

  it("marca como grave llevar dos estampados a la vez", () => {
    resetIds();
    const look = [
      garment({ category: "top", subcategory: "camiseta de rayas", pattern: "striped", formality: 2 }),
      garment({ category: "bottom", subcategory: "falda de flores", pattern: "floral", formality: 2 }),
    ];

    expect(graves(evaluateLook(look, { now: NOW }).issues)).toContain(
      "No puede ser: más de una prenda estampada.",
    );
  });

  it("puntúa igual que el generador el mismo conjunto de prendas", () => {
    // Es la garantía de que el probador y /outfits nunca muestran porcentajes
    // distintos para el mismo look: ambos pasan por `computeBreakdown`.
    const outfit = generateOutfits(seedWardrobe(), { now: NOW })[0];
    expect(outfit).toBeDefined();
    if (outfit === undefined) return;

    const evaluation = evaluateLook(
      outfit.items.map((item) => item.garment),
      { now: NOW },
    );

    expect(evaluation.score).toBeCloseTo(outfit.score, 10);
    expect(evaluation.breakdown).toEqual(outfit.breakdown);
    expect(evaluation.rationale).toBe(outfit.rationale);
  });
});
