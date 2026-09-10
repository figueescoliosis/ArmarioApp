import { beforeEach, describe, expect, it } from "vitest";
import {
  EXPLICIT_PAIR_KEYS,
  GARMENT_KINDS,
  compatibilityScore,
  formalityScore,
  freshnessScore,
  garmentKind,
  hardRuleViolation,
  minPairCompatibility,
  pairCompatibility,
  seasonScore,
  warmthForTemperature,
} from "@/lib/outfits/rules";
import { garment, resetIds } from "./fixtures";

beforeEach(resetIds);

describe("garmentKind", () => {
  it("normaliza subcategorías en español a un tipo cerrado", () => {
    const cases: [string, string][] = [
      ["vaquero recto azul", "vaquero"],
      ["camisa de vestir blanca", "camisa_vestir"],
      ["zapatilla blanca de piel", "zapatilla"],
      ["botín negro", "bota"],
      ["blazer azul marino", "blazer"],
      ["pantalón de chándal gris", "chandal"],
      ["plumífero negro", "plumas"],
    ];
    for (const [subcategory, expected] of cases) {
      expect(garmentKind({ category: "top", subcategory }), subcategory).toBe(expected);
    }
  });

  it("prefiere lo específico a lo genérico", () => {
    // "camisa de vestir" no debe caer en el genérico "camisa", ni "zapatilla"
    // en "zapato".
    expect(garmentKind({ category: "top", subcategory: "camisa de vestir" })).toBe("camisa_vestir");
    expect(garmentKind({ category: "shoes", subcategory: "zapatilla deportiva" })).toBe("zapatilla");
  });

  it("ignora tildes y mayúsculas", () => {
    expect(garmentKind({ category: "bottom", subcategory: "PANTALÓN DE CHANDAL" })).toBe("chandal");
  });

  it("cae a la categoría cuando el texto no dice nada", () => {
    expect(garmentKind({ category: "dress", subcategory: "algo raro" })).toBe("vestido");
    expect(garmentKind({ category: "top", subcategory: "" })).toBe("generico");
  });
});

describe("pairCompatibility", () => {
  it("rescata las combinaciones consagradas que la formalidad castigaría", () => {
    const blazer = garment({ category: "outerwear", subcategory: "blazer azul marino", formality: 5 });
    const vaquero = garment({ category: "bottom", subcategory: "vaquero recto", formality: 2 });
    // Por formalidad pura serían un 0.3; la excepción explícita lo corrige.
    expect(pairCompatibility(blazer, vaquero)).toBeGreaterThan(0.9);
  });

  it("hunde los choques que sencillamente no se hacen", () => {
    const chandal = garment({ category: "bottom", subcategory: "pantalón de chándal", formality: 1 });
    const zapato = garment({ category: "shoes", subcategory: "zapato de vestir", formality: 5 });
    expect(pairCompatibility(chandal, zapato)).toBeLessThan(0.2);
  });

  it("es simétrica", () => {
    const a = garment({ category: "outerwear", subcategory: "blazer", formality: 5 });
    const b = garment({ category: "bottom", subcategory: "vaquero", formality: 2 });
    expect(pairCompatibility(a, b)).toBe(pairCompatibility(b, a));
  });

  it("sin excepción, se deriva de la distancia de formalidad", () => {
    const igual = pairCompatibility(
      garment({ category: "top", subcategory: "prenda a", formality: 3 }),
      garment({ category: "bottom", subcategory: "prenda b", formality: 3 }),
    );
    const lejano = pairCompatibility(
      garment({ category: "top", subcategory: "prenda c", formality: 1 }),
      garment({ category: "bottom", subcategory: "prenda d", formality: 5 }),
    );
    expect(igual).toBe(1);
    expect(lejano).toBeLessThan(0.2);
  });
});

describe("compatibilityScore", () => {
  it("vale 1 con menos de dos prendas", () => {
    expect(compatibilityScore([])).toBe(1);
    expect(compatibilityScore([garment({ category: "top" })])).toBe(1);
  });
});

describe("tabla de excepciones", () => {
  it("solo nombra tipos de prenda que existen", () => {
    // Una clave con un tipo mal escrito no da error de compilación en tiempo de
    // ejecución: simplemente nunca se consulta y la excepción se pierde en
    // silencio. Ya pasó una vez con seis claves.
    const conocidos = new Set<string>(GARMENT_KINDS);
    for (const key of EXPLICIT_PAIR_KEYS) {
      const [a, b] = key.split("|");
      expect(conocidos.has(a ?? ""), `${key}: "${a}" no es un tipo de prenda`).toBe(true);
      expect(conocidos.has(b ?? ""), `${key}: "${b}" no es un tipo de prenda`).toBe(true);
    }
  });

  it("aplica cada excepción sin importar el orden de las prendas", () => {
    // La tabla se escribe como se lee ("sandalia|plumas"), no en orden
    // alfabético, así que la reindexación tiene que hacer su trabajo.
    const sandalia = garment({ category: "shoes", subcategory: "sandalia de cuero", formality: 2 });
    const plumas = garment({ category: "outerwear", subcategory: "plumífero", formality: 2 });
    expect(pairCompatibility(sandalia, plumas)).toBeLessThan(0.1);
    expect(pairCompatibility(plumas, sandalia)).toBeLessThan(0.1);

    const chandal = garment({ category: "bottom", subcategory: "chándal", formality: 2 });
    const blazer = garment({ category: "outerwear", subcategory: "blazer", formality: 2 });
    expect(pairCompatibility(chandal, blazer)).toBeLessThan(0.2);
  });
});

describe("minPairCompatibility", () => {
  it("devuelve el peor par, no la media", () => {
    const conjunto = [
      garment({ category: "top", subcategory: "camiseta", formality: 2 }),
      garment({ category: "bottom", subcategory: "vaquero", formality: 2 }),
      garment({ category: "shoes", subcategory: "sandalia de cuero", formality: 2 }),
      garment({ category: "outerwear", subcategory: "plumífero", formality: 2 }),
    ];
    // Tres parejas son perfectas y una es imposible: la media lo taparía.
    expect(compatibilityScore(conjunto)).toBeGreaterThan(0.7);
    expect(minPairCompatibility(conjunto)).toBeLessThan(0.1);
  });

  it("vale 1 con menos de dos prendas", () => {
    expect(minPairCompatibility([])).toBe(1);
    expect(minPairCompatibility([garment({ category: "top" })])).toBe(1);
  });
});

describe("formalityScore", () => {
  it("no penaliza un salto de un punto", () => {
    const conjunto = [
      garment({ category: "top", formality: 3 }),
      garment({ category: "bottom", formality: 4 }),
    ];
    expect(formalityScore(conjunto)).toBe(1);
  });

  it("penaliza la dispersión a partir de dos puntos", () => {
    const disperso = [
      garment({ category: "top", formality: 1 }),
      garment({ category: "bottom", formality: 5 }),
    ];
    expect(formalityScore(disperso)).toBeLessThan(0.5);
  });

  it("penaliza además lo lejos que queda de la ocasión pedida", () => {
    const casual = [
      garment({ category: "top", formality: 2 }),
      garment({ category: "bottom", formality: 2 }),
    ];
    expect(formalityScore(casual, 2)).toBeGreaterThan(formalityScore(casual, 5));
  });
});

describe("warmthForTemperature", () => {
  it("traduce grados a nivel de abrigo, de menos a más", () => {
    expect(warmthForTemperature(30)).toBe(1);
    expect(warmthForTemperature(22)).toBe(2);
    expect(warmthForTemperature(15)).toBe(3);
    expect(warmthForTemperature(8)).toBe(4);
    expect(warmthForTemperature(-2)).toBe(5);
  });
});

describe("seasonScore", () => {
  it("trata las prendas sin temporada como válidas todo el año", () => {
    const conjunto = [garment({ category: "top", seasons: [] })];
    expect(seasonScore(conjunto, { season: "invierno" })).toBe(1);
  });

  it("mide el abrigo por la prenda más gruesa, no por la media", () => {
    // Una camiseta debajo de un plumas no hace que pases frío.
    const conjunto = [
      garment({ category: "top", warmth: 1 }),
      garment({ category: "outerwear", warmth: 5 }),
    ];
    expect(seasonScore(conjunto, { temperatureC: -2 })).toBe(1);
  });

  it("castiga ir de verano con temperaturas de invierno", () => {
    const conjunto = [garment({ category: "top", warmth: 1 })];
    expect(seasonScore(conjunto, { temperatureC: -2 })).toBeLessThan(0.1);
  });
});

describe("freshnessScore", () => {
  const now = new Date("2026-02-01T12:00:00.000Z");

  it("da la puntuación máxima a lo que nunca se ha puesto", () => {
    expect(freshnessScore([garment({ category: "top" })], new Map(), now)).toBe(1);
  });

  it("da cero a lo que se ha puesto hoy y sube con los días", () => {
    const prenda = garment({ category: "top" });
    const hoy = new Map([[prenda.id, "2026-02-01T00:00:00.000Z"]]);
    const haceQuince = new Map([[prenda.id, "2026-01-17T12:00:00.000Z"]]);
    const haceDosMeses = new Map([[prenda.id, "2025-12-01T12:00:00.000Z"]]);

    expect(freshnessScore([prenda], hoy, now)).toBeLessThan(0.05);
    expect(freshnessScore([prenda], haceQuince, now)).toBeCloseTo(0.5, 1);
    expect(freshnessScore([prenda], haceDosMeses, now)).toBe(1);
  });

  it("no se rompe con una fecha inválida", () => {
    const prenda = garment({ category: "top" });
    expect(freshnessScore([prenda], new Map([[prenda.id, "no-es-fecha"]]), now)).toBe(1);
  });
});

describe("hardRuleViolation", () => {
  it("admite un solo estampado", () => {
    expect(
      hardRuleViolation([
        garment({ category: "top", pattern: "striped" }),
        garment({ category: "bottom", pattern: "solid" }),
      ]),
    ).toBeNull();
  });

  it("rechaza dos estampados en el mismo conjunto", () => {
    const violation = hardRuleViolation([
      garment({ category: "top", pattern: "striped" }),
      garment({ category: "bottom", pattern: "floral" }),
    ]);
    expect(violation).toMatch(/estampada/);
  });

  it("rechaza un vestido con parte de arriba o de abajo", () => {
    const violation = hardRuleViolation([
      garment({ category: "dress" }),
      garment({ category: "bottom" }),
    ]);
    expect(violation).toMatch(/[Vv]estido/);
  });
});
