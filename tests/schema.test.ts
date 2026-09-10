import { describe, expect, it } from "vitest";
import {
  garmentToRow,
  rowToGarment,
  rowToOutfit,
  type GarmentRow,
  type OutfitRowWithItems,
} from "@/lib/db/schema";
import type { GarmentAttributes } from "@/lib/types";

/**
 * Los mapeadores son la frontera entre Postgres y el resto de la app: aquí es
 * donde `jsonb`, los arrays de texto y los `smallint` se convierten en tipos de
 * dominio. Es código puro, así que se puede probar sin base de datos, y merece
 * la pena porque un fallo aquí se manifiesta muy lejos de su causa.
 */

function row(overrides: Partial<GarmentRow> = {}): GarmentRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    owner_id: "default",
    image_url: "https://example.test/original.jpg",
    cutout_url: "https://example.test/cutout.png",
    thumb_url: "https://example.test/thumb.webp",
    category: "top",
    subcategory: "camisa de vestir",
    colors: [{ hex: "#F5F3EF", name: "hueso", ratio: 0.9 }],
    primary_hex: "#F5F3EF",
    is_neutral: true,
    pattern: "solid",
    material: "algodón",
    style_tags: ["minimalista"],
    formality: 4,
    warmth: 2,
    seasons: ["primavera", "otoño"],
    notes: null,
    archived: false,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("rowToGarment", () => {
  it("convierte una fila completa a tipo de dominio", () => {
    const garment = rowToGarment(row());

    expect(garment.id).toBe("11111111-1111-4111-8111-111111111111");
    expect(garment.imageUrl).toBe("https://example.test/original.jpg");
    expect(garment.cutoutUrl).toBe("https://example.test/cutout.png");
    expect(garment.category).toBe("top");
    expect(garment.colors).toEqual([{ hex: "#F5F3EF", name: "hueso", ratio: 0.9 }]);
    expect(garment.seasons).toEqual(["primavera", "otoño"]);
    expect(garment.formality).toBe(4);
  });

  it("recorta a la escala 1-5 un valor corrupto en la base de datos", () => {
    // Un `as` a ciegas dejaría pasar un 9 y rompería el motor de outfits en
    // algún punto muy alejado de aquí.
    expect(rowToGarment(row({ formality: 9 })).formality).toBe(5);
    expect(rowToGarment(row({ warmth: 0 })).warmth).toBe(1);
    expect(rowToGarment(row({ formality: 3.6 })).formality).toBe(4);
  });

  it("tolera un jsonb de colores vacío o mal formado", () => {
    expect(rowToGarment(row({ colors: null })).colors).toEqual([]);
    expect(rowToGarment(row({ colors: "no es json" })).colors).toEqual([]);
    expect(rowToGarment(row({ colors: [] })).colors).toEqual([]);
  });

  it("descarta temporadas desconocidas en vez de propagarlas", () => {
    const garment = rowToGarment(row({ seasons: ["verano", "monzón"] }));
    expect(garment.seasons).toEqual(["verano"]);
  });

  it("convierte los nulos de columnas opcionales a lo que espera el dominio", () => {
    const garment = rowToGarment(row({ subcategory: null, thumb_url: null, material: null }));
    expect(garment.subcategory).toBe("");
    expect(garment.thumbUrl).toBeNull();
    expect(garment.material).toBeNull();
  });

  it("rechaza una categoría que no existe", () => {
    // Aquí sí conviene fallar: una categoría desconocida significa que el
    // esquema y el código se han desincronizado.
    expect(() => rowToGarment(row({ category: "sombrero" }))).toThrow(/sombrero/);
  });
});

describe("garmentToRow", () => {
  const attributes: GarmentAttributes = {
    category: "bottom",
    subcategory: "vaquero recto",
    colors: [{ hex: "#3A5A82", name: "azul vaquero", ratio: 1 }],
    pattern: "solid",
    material: "denim",
    styleTags: ["casual"],
    formality: 2,
    warmth: 3,
    seasons: ["primavera"],
  };

  it("produce una fila en snake_case lista para insertar", () => {
    const result = garmentToRow({
      attributes,
      imageUrl: "https://example.test/o.jpg",
      cutoutUrl: "https://example.test/c.png",
      thumbUrl: null,
      primaryHex: "#3A5A82",
      isNeutral: true,
      ownerId: "default",
    });

    expect(result.owner_id).toBe("default");
    expect(result.image_url).toBe("https://example.test/o.jpg");
    expect(result.primary_hex).toBe("#3A5A82");
    expect(result.is_neutral).toBe(true);
    expect(result.style_tags).toEqual(["casual"]);
    expect(result.thumb_url).toBeNull();
  });

  it("es reversible: fila → dominio → fila conserva los atributos", () => {
    const inserted = garmentToRow({
      attributes,
      imageUrl: "https://example.test/o.jpg",
      cutoutUrl: "https://example.test/c.png",
      thumbUrl: null,
      primaryHex: "#3A5A82",
      isNeutral: true,
      ownerId: "default",
    });

    const roundTripped = rowToGarment({
      ...inserted,
      id: "22222222-2222-4222-8222-222222222222",
      created_at: "2026-01-01T00:00:00.000Z",
    } as GarmentRow);

    expect(roundTripped.category).toBe(attributes.category);
    expect(roundTripped.subcategory).toBe(attributes.subcategory);
    expect(roundTripped.colors).toEqual(attributes.colors);
    expect(roundTripped.formality).toBe(attributes.formality);
    expect(roundTripped.seasons).toEqual(attributes.seasons);
  });
});

describe("rowToOutfit", () => {
  function outfitRow(): OutfitRowWithItems {
    return {
      id: "33333333-3333-4333-8333-333333333333",
      owner_id: "default",
      name: "Lunes tranquilo",
      score: 0.82,
      score_breakdown: {
        color: 0.9,
        compatibility: 0.8,
        formality: 1,
        season: 0.7,
        freshness: 0.5,
      },
      rationale: "Se apoya en una base neutra.",
      source: "rules",
      signature: "abc123",
      is_favorite: true,
      created_at: "2026-01-01T00:00:00.000Z",
      outfit_items: [
        { slot: "top", garments: row() },
        { slot: "bottom", garments: row({ id: "44444444-4444-4444-8444-444444444444", category: "bottom" }) },
      ],
    };
  }

  it("reconstruye el conjunto con sus prendas desde el join anidado", () => {
    const outfit = rowToOutfit(outfitRow());

    expect(outfit.id).toBe("33333333-3333-4333-8333-333333333333");
    expect(outfit.name).toBe("Lunes tranquilo");
    expect(outfit.isFavorite).toBe(true);
    expect(outfit.items).toHaveLength(2);
    expect(outfit.items[0]?.slot).toBe("top");
    expect(outfit.items[0]?.garment.category).toBe("top");
    expect(outfit.items[1]?.garment.category).toBe("bottom");
  });

  it("conserva el desglose de la puntuación", () => {
    const outfit = rowToOutfit(outfitRow());
    expect(outfit.breakdown.color).toBe(0.9);
    expect(outfit.breakdown.formality).toBe(1);
  });

  it("no se rompe si un conjunto se quedó sin prendas", () => {
    const outfit = rowToOutfit({ ...outfitRow(), outfit_items: [] });
    expect(outfit.items).toEqual([]);
  });
});
