import type { Category, Formality, Garment, Pattern, Season, Warmth } from "@/lib/types";

let counter = 0;

/** Construye una prenda de prueba; solo hay que indicar lo que importa al test. */
export function garment(overrides: Partial<Garment> & { category: Category }): Garment {
  counter += 1;
  const hex = overrides.primaryHex ?? "#808080";

  return {
    id: `g${counter}`,
    ownerId: "default",
    imageUrl: `https://example.test/${counter}/original.jpg`,
    cutoutUrl: `https://example.test/${counter}/cutout.png`,
    thumbUrl: null,
    subcategory: "prenda",
    colors: [{ hex, name: "color", ratio: 1 }],
    pattern: "solid" as Pattern,
    material: null,
    styleTags: [],
    formality: 3 as Formality,
    warmth: 3 as Warmth,
    seasons: [] as Season[],
    primaryHex: hex,
    isNeutral: false,
    notes: null,
    archived: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** Reinicia los ids para que cada test sea reproducible. */
export function resetIds(): void {
  counter = 0;
}

/**
 * Armario de veinte prendas con variedad suficiente para que el generador
 * tenga decisiones reales que tomar: registros de formalidad de 1 a 5,
 * neutros y colores de acento, y prendas de todas las categorías.
 */
export function seedWardrobe(): Garment[] {
  resetIds();
  return [
    // Partes de arriba
    garment({ category: "top", subcategory: "camisa de vestir blanca", primaryHex: "#F5F3EF", formality: 4, warmth: 2, isNeutral: true }),
    garment({ category: "top", subcategory: "camiseta lisa negra", primaryHex: "#1C1C1C", formality: 2, warmth: 2, isNeutral: true }),
    garment({ category: "top", subcategory: "camiseta de rayas", primaryHex: "#2E4A7D", formality: 2, warmth: 2, pattern: "striped" }),
    garment({ category: "top", subcategory: "jersey de punto camel", primaryHex: "#B08556", formality: 3, warmth: 4, isNeutral: true }),
    garment({ category: "top", subcategory: "sudadera con capucha gris", primaryHex: "#8A8A8A", formality: 1, warmth: 3, isNeutral: true }),
    garment({ category: "top", subcategory: "blusa de seda verde oliva", primaryHex: "#6B7A45", formality: 4, warmth: 2 }),

    // Partes de abajo
    garment({ category: "bottom", subcategory: "vaquero recto azul", primaryHex: "#3A5A82", formality: 2, warmth: 3, isNeutral: true }),
    garment({ category: "bottom", subcategory: "pantalón de vestir negro", primaryHex: "#232323", formality: 4, warmth: 3, isNeutral: true }),
    garment({ category: "bottom", subcategory: "chino beige", primaryHex: "#C6B393", formality: 3, warmth: 3, isNeutral: true }),
    garment({ category: "bottom", subcategory: "pantalón de chándal gris", primaryHex: "#7E7E7E", formality: 1, warmth: 3, isNeutral: true }),
    garment({ category: "bottom", subcategory: "falda midi burdeos", primaryHex: "#6E2436", formality: 4, warmth: 2 }),

    // Calzado
    garment({ category: "shoes", subcategory: "zapatilla blanca", primaryHex: "#EFEFEF", formality: 2, warmth: 2, isNeutral: true }),
    garment({ category: "shoes", subcategory: "zapato de vestir marrón", primaryHex: "#5A3A25", formality: 5, warmth: 2, isNeutral: true }),
    garment({ category: "shoes", subcategory: "botín negro de piel", primaryHex: "#1A1A1A", formality: 4, warmth: 3, isNeutral: true }),
    garment({ category: "shoes", subcategory: "sandalia de cuero", primaryHex: "#8B6444", formality: 2, warmth: 1, seasons: ["verano"] }),

    // Abrigos
    garment({ category: "outerwear", subcategory: "blazer azul marino", primaryHex: "#25334D", formality: 5, warmth: 3, isNeutral: true }),
    garment({ category: "outerwear", subcategory: "cazadora vaquera", primaryHex: "#4A6A93", formality: 2, warmth: 3, isNeutral: true }),
    garment({ category: "outerwear", subcategory: "plumas negro", primaryHex: "#151515", formality: 2, warmth: 5, seasons: ["invierno"], isNeutral: true }),

    // Vestido y accesorio
    garment({ category: "dress", subcategory: "vestido midi verde", primaryHex: "#3F6B4A", formality: 4, warmth: 2 }),
    garment({ category: "accessory", subcategory: "cinturón de cuero marrón", primaryHex: "#6B4A2F", formality: 3, warmth: 1, isNeutral: true }),
  ];
}
