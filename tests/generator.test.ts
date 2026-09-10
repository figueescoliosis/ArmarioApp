import { describe, expect, it } from "vitest";
import { generateOutfits } from "@/lib/outfits/generator";
import { computeSignature } from "@/lib/outfits/signature";
import type { Garment, Slot } from "@/lib/types";
import { garment, resetIds, seedWardrobe } from "./fixtures";

const NOW = new Date("2026-03-01T10:00:00.000Z");

function slotsOf(items: { slot: Slot }[]): Slot[] {
  return items.map((item) => item.slot).sort();
}

describe("generateOutfits", () => {
  it("forma conjuntos completos a partir de un armario real", () => {
    const outfits = generateOutfits(seedWardrobe(), { now: NOW });

    expect(outfits.length).toBeGreaterThan(0);
    for (const outfit of outfits) {
      const slots = slotsOf(outfit.items);
      const esVestido = slots.includes("dress");

      if (esVestido) {
        expect(slots).toContain("shoes");
        expect(slots).not.toContain("top");
        expect(slots).not.toContain("bottom");
      } else {
        expect(slots).toContain("top");
        expect(slots).toContain("bottom");
        expect(slots).toContain("shoes");
      }
    }
  });

  it("no repite hueco dentro de un mismo conjunto", () => {
    for (const outfit of generateOutfits(seedWardrobe(), { now: NOW })) {
      const slots = outfit.items.map((item) => item.slot);
      expect(new Set(slots).size).toBe(slots.length);
    }
  });

  it("no repite prenda dentro de un mismo conjunto", () => {
    for (const outfit of generateOutfits(seedWardrobe(), { now: NOW })) {
      const ids = outfit.items.map((item) => item.garment.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("devuelve los conjuntos ordenados de mejor a peor", () => {
    const scores = generateOutfits(seedWardrobe(), { now: NOW }).map((o) => o.score);
    const ordenados = [...scores].sort((a, b) => b - a);
    expect(scores).toEqual(ordenados);
  });

  it("no devuelve dos veces el mismo conjunto", () => {
    const ids = generateOutfits(seedWardrobe(), { now: NOW }).map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("es determinista: dos ejecuciones idénticas dan el mismo resultado", () => {
    const primera = generateOutfits(seedWardrobe(), { now: NOW });
    const segunda = generateOutfits(seedWardrobe(), { now: NOW });
    expect(primera.map((o) => o.id)).toEqual(segunda.map((o) => o.id));
    expect(primera.map((o) => o.score)).toEqual(segunda.map((o) => o.score));
  });

  it("usa la firma de las prendas como identificador", () => {
    const outfit = generateOutfits(seedWardrobe(), { now: NOW })[0];
    expect(outfit).toBeDefined();
    expect(outfit!.id).toBe(computeSignature(outfit!.items.map((item) => item.garment.id)));
  });

  it("respeta el límite pedido", () => {
    expect(generateOutfits(seedWardrobe(), { request: { limit: 3 }, now: NOW })).toHaveLength(3);
  });

  it("responde en decenas de milisegundos con un armario de veinte prendas", () => {
    const wardrobe = seedWardrobe();
    const started = performance.now();
    generateOutfits(wardrobe, { now: NOW });
    // Medido en ~13 ms. El margen absorbe el ruido de CI sin dejar pasar una
    // regresión de orden de magnitud.
    expect(performance.now() - started).toBeLessThan(150);
  });

  it("no devuelve nada si no hay material para ningún hueco obligatorio", () => {
    resetIds();
    // Sin calzado no se puede cerrar ninguna plantilla.
    const sinZapatos = [
      garment({ category: "top", subcategory: "camiseta" }),
      garment({ category: "bottom", subcategory: "vaquero" }),
    ];
    expect(generateOutfits(sinZapatos, { now: NOW })).toEqual([]);
  });

  it("incluye siempre la prenda que se fuerza", () => {
    const wardrobe = seedWardrobe();
    const blusa = wardrobe.find((g) => g.subcategory.includes("blusa"));
    expect(blusa).toBeDefined();

    const outfits = generateOutfits(wardrobe, {
      request: { mustIncludeIds: [blusa!.id] },
      now: NOW,
    });

    expect(outfits.length).toBeGreaterThan(0);
    for (const outfit of outfits) {
      expect(outfit.items.some((item) => item.garment.id === blusa!.id)).toBe(true);
    }
  });

  it("excluye las prendas que se le pide excluir", () => {
    const wardrobe = seedWardrobe();
    const excluida = wardrobe.find((g) => g.category === "shoes");
    expect(excluida).toBeDefined();

    for (const outfit of generateOutfits(wardrobe, {
      request: { excludeIds: [excluida!.id] },
      now: NOW,
    })) {
      expect(outfit.items.some((item) => item.garment.id === excluida!.id)).toBe(false);
    }
  });

  it("ignora las prendas archivadas", () => {
    const wardrobe = seedWardrobe().map((g) =>
      g.category === "dress" ? { ...g, archived: true } : g,
    );
    for (const outfit of generateOutfits(wardrobe, { now: NOW })) {
      expect(outfit.items.some((item) => item.slot === "dress")).toBe(false);
    }
  });

  it("sube el registro cuando se pide una ocasión formal", () => {
    const wardrobe = seedWardrobe();
    const media = (outfits: ReturnType<typeof generateOutfits>) => {
      const values = outfits.flatMap((o) => o.items.map((item) => item.garment.formality));
      return values.reduce((sum, v) => sum + v, 0) / values.length;
    };

    const formal = media(generateOutfits(wardrobe, { request: { occasion: 5 }, now: NOW }));
    const casa = media(generateOutfits(wardrobe, { request: { occasion: 1 }, now: NOW }));
    expect(formal).toBeGreaterThan(casa);
  });

  it("añade abrigo cuando hace frío y no lo añade cuando hace calor", () => {
    const wardrobe = seedWardrobe();

    const frio = generateOutfits(wardrobe, { request: { temperatureC: 0 }, now: NOW });
    const calor = generateOutfits(wardrobe, { request: { temperatureC: 32 }, now: NOW });

    expect(frio.some((o) => o.items.some((item) => item.slot === "outerwear"))).toBe(true);
    // En agosto no se propone un plumas por muy bien que combine de color.
    expect(calor.every((o) => o.items.every((item) => item.slot !== "outerwear"))).toBe(true);
  });

  it("prefiere prendas que llevan tiempo sin ponerse", () => {
    const wardrobe = seedWardrobe();
    const camisetas = wardrobe.filter((g) => g.subcategory.startsWith("camiseta"));
    expect(camisetas.length).toBeGreaterThanOrEqual(2);

    const recienPuesta = camisetas[0]!;
    const lastWorn = new Map([[recienPuesta.id, NOW.toISOString()]]);

    const conMemoria = generateOutfits(wardrobe, { lastWorn, now: NOW });
    const sinMemoria = generateOutfits(wardrobe, { now: NOW });

    const apariciones = (outfits: ReturnType<typeof generateOutfits>) =>
      outfits.filter((o) => o.items.some((item) => item.garment.id === recienPuesta.id)).length;

    expect(apariciones(conMemoria)).toBeLessThanOrEqual(apariciones(sinMemoria));
  });

  it("nunca junta dos estampados", () => {
    for (const outfit of generateOutfits(seedWardrobe(), { now: NOW })) {
      const estampadas = outfit.items.filter(
        (item) => item.garment.pattern !== "solid" && item.garment.pattern !== "other",
      );
      expect(estampadas.length).toBeLessThanOrEqual(1);
    }
  });

  it("veta el conjunto por su peor par, no por la media", () => {
    // Con frío, el motor quiere añadir abrigo. Un plumas con sandalias puntúa
    // 0,05, pero si se promediara con el resto de parejas se colaría igual.
    for (const outfit of generateOutfits(seedWardrobe(), {
      request: { temperatureC: 8, limit: 10 },
      now: NOW,
    })) {
      const sub = outfit.items.map((item) => item.garment.subcategory);
      expect(sub.some((s) => s.includes("sandalia")) && sub.some((s) => s.includes("plumas"))).toBe(
        false,
      );
    }
  });

  it("no propone chándal con zapato de vestir", () => {
    for (const outfit of generateOutfits(seedWardrobe(), { now: NOW })) {
      const sub = outfit.items.map((item) => item.garment.subcategory);
      const tieneChandal = sub.some((s) => s.includes("chándal"));
      const tieneZapatoVestir = sub.some((s) => s.includes("zapato de vestir"));
      expect(tieneChandal && tieneZapatoVestir).toBe(false);
    }
  });

  it("devuelve conjuntos variados, no la misma base con otros zapatos", () => {
    const outfits = generateOutfits(seedWardrobe(), { request: { limit: 8 }, now: NOW });

    for (let i = 0; i < outfits.length; i++) {
      for (let j = i + 1; j < outfits.length; j++) {
        const a = new Set(outfits[i]!.items.map((item) => item.garment.id));
        const b = new Set(outfits[j]!.items.map((item) => item.garment.id));
        const shared = [...a].filter((id) => b.has(id)).length;
        const union = new Set([...a, ...b]).size;
        expect(shared / union).toBeLessThanOrEqual(0.6);
      }
    }
  });

  it("puntúa entre 0 y 1, y el desglose también", () => {
    for (const outfit of generateOutfits(seedWardrobe(), { now: NOW })) {
      expect(outfit.score).toBeGreaterThanOrEqual(0);
      expect(outfit.score).toBeLessThanOrEqual(1);
      for (const value of Object.values(outfit.breakdown)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });

  it("acompaña cada conjunto de una explicación no vacía", () => {
    for (const outfit of generateOutfits(seedWardrobe(), { now: NOW })) {
      expect(outfit.rationale.trim().length).toBeGreaterThan(0);
      expect(outfit.source).toBe("rules");
    }
  });

  it("aguanta un armario grande sin dispararse", () => {
    resetIds();
    const grande: Garment[] = [];
    const categorias = ["top", "bottom", "shoes", "outerwear"] as const;
    for (let i = 0; i < 200; i++) {
      const category = categorias[i % categorias.length]!;
      grande.push(
        garment({
          category,
          subcategory: `prenda ${i}`,
          primaryHex: `#${((i * 7919) % 0xffffff).toString(16).padStart(6, "0")}`,
          formality: ((i % 5) + 1) as 1 | 2 | 3 | 4 | 5,
        }),
      );
    }

    const started = performance.now();
    const outfits = generateOutfits(grande, { now: NOW });
    const elapsed = performance.now() - started;

    expect(outfits.length).toBeGreaterThan(0);
    // Medido en ~170 ms con 300 prendas. El coste se aplana a partir de aquí
    // porque cada hueco tiene un tope de candidatas.
    expect(elapsed).toBeLessThan(800);
  });
});
