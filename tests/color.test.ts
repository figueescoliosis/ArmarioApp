import { describe, expect, it } from "vitest";
import {
  deltaE2000,
  harmonyScore,
  hexToHsl,
  hexToRgb,
  hueDistance,
  isNeutralHex,
  paletteHarmony,
  rgbToHex,
  rgbToLab,
} from "@/lib/outfits/color";

describe("hexToRgb", () => {
  it("lee la forma larga y la corta", () => {
    expect(hexToRgb("#1A2B3C")).toEqual({ r: 26, g: 43, b: 60 });
    expect(hexToRgb("1A2B3C")).toEqual({ r: 26, g: 43, b: 60 });
    expect(hexToRgb("#FFF")).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb("#f00")).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("devuelve null ante entradas inválidas en vez de lanzar", () => {
    // Los hex llegan del modelo y del usuario: uno malo no debe tumbar la
    // generación de un conjunto entero.
    for (const bad of ["", "#12", "#GGGGGG", "azul", "#1234567"]) {
      expect(hexToRgb(bad)).toBeNull();
    }
  });
});

describe("rgbToHex", () => {
  it("es la inversa de hexToRgb", () => {
    const rgb = hexToRgb("#3A5A82");
    expect(rgb).not.toBeNull();
    expect(rgbToHex(rgb!)).toBe("#3A5A82");
  });

  it("recorta valores fuera de rango", () => {
    expect(rgbToHex({ r: -20, g: 300, b: 128 })).toBe("#00FF80");
  });
});

describe("rgbToHsl", () => {
  it("sitúa los primarios en su matiz", () => {
    expect(hexToHsl("#FF0000")?.h).toBeCloseTo(0, 1);
    expect(hexToHsl("#00FF00")?.h).toBeCloseTo(120, 1);
    expect(hexToHsl("#0000FF")?.h).toBeCloseTo(240, 1);
  });

  it("da saturación cero a los grises", () => {
    expect(hexToHsl("#808080")?.s).toBeCloseTo(0, 5);
    expect(hexToHsl("#000000")?.l).toBeCloseTo(0, 5);
    expect(hexToHsl("#FFFFFF")?.l).toBeCloseTo(1, 5);
  });
});

describe("deltaE2000", () => {
  it("da cero para el mismo color", () => {
    const lab = rgbToLab({ r: 100, g: 140, b: 200 });
    expect(deltaE2000(lab, lab)).toBeCloseTo(0, 6);
  });

  it("es simétrica", () => {
    const a = rgbToLab({ r: 200, g: 30, b: 40 });
    const b = rgbToLab({ r: 30, g: 200, b: 40 });
    expect(deltaE2000(a, b)).toBeCloseTo(deltaE2000(b, a), 6);
  });

  it("separa blanco de negro mucho más que dos grises vecinos", () => {
    const blancoNegro = deltaE2000(
      rgbToLab({ r: 255, g: 255, b: 255 }),
      rgbToLab({ r: 0, g: 0, b: 0 }),
    );
    const grisesVecinos = deltaE2000(
      rgbToLab({ r: 128, g: 128, b: 128 }),
      rgbToLab({ r: 132, g: 132, b: 132 }),
    );
    expect(blancoNegro).toBeGreaterThan(90);
    expect(grisesVecinos).toBeLessThan(3);
  });
});

describe("hueDistance", () => {
  it("nunca pasa de 180 y cruza bien el origen", () => {
    expect(hueDistance(10, 350)).toBe(20);
    expect(hueDistance(0, 180)).toBe(180);
    expect(hueDistance(200, 200)).toBe(0);
    expect(hueDistance(-10, 10)).toBe(20);
  });
});

describe("isNeutralHex", () => {
  it("reconoce los neutros que combinan con todo", () => {
    for (const hex of [
      "#000000", // negro
      "#FFFFFF", // blanco
      "#808080", // gris
      "#3A5A82", // vaquero
      "#C6B393", // beige
      "#1C1C1C", // negro apagado
    ]) {
      expect(isNeutralHex(hex), `${hex} debería ser neutro`).toBe(true);
    }
  });

  it("no confunde un color de acento con un neutro", () => {
    for (const hex of ["#E63946", "#2ECC71", "#9B59B6", "#0077FF"]) {
      expect(isNeutralHex(hex), `${hex} no debería ser neutro`).toBe(false);
    }
  });
});

describe("harmonyScore", () => {
  it("premia un color sobre base neutra", () => {
    const result = harmonyScore("#1C1C1C", "#6B7A45");
    expect(result.kind).toBe("neutral");
    expect(result.score).toBeGreaterThan(0.8);
  });

  it("penaliza dos neutros sin contraste de luminosidad", () => {
    // Negro con gris marengo no es un conjunto, es un accidente.
    const flojo = harmonyScore("#1A1A1A", "#2B2B2B");
    const bueno = harmonyScore("#1A1A1A", "#F0EDE8");
    expect(flojo.kind).toBe("neutral");
    expect(bueno.score).toBeGreaterThan(flojo.score);
  });

  it("identifica el monocromático y exige salto de luminosidad", () => {
    const plano = harmonyScore("#4A80C0", "#5285C4");
    const conSalto = harmonyScore("#9CC2E8", "#123A66");
    expect(conSalto.score).toBeGreaterThan(plano.score);
  });

  it("valora los análogos por encima de la tierra de nadie de la rueda", () => {
    const analogo = harmonyScore("#C05A2E", "#C0952E"); // naranja / mostaza
    const raro = harmonyScore("#C05A2E", "#2EA0C0"); // naranja / cian
    expect(analogo.kind).toBe("analogo");
    expect(analogo.score).toBeGreaterThan(raro.score);
  });

  it("castiga dos complementarios saturados y aprueba uno apagado", () => {
    const semaforo = harmonyScore("#FF3B00", "#00B4FF");
    const suave = harmonyScore("#B5714F", "#4F7FB5");
    expect(semaforo.kind).toBe("complementario");
    expect(suave.score).toBeGreaterThan(semaforo.score);
  });

  it("no inventa armonía con un hex ilegible", () => {
    expect(harmonyScore("no-es-un-color", "#000000").score).toBe(0.5);
  });
});

describe("paletteHarmony", () => {
  it("puntúa alto una paleta de neutros con acento", () => {
    expect(paletteHarmony(["#1C1C1C", "#F5F3EF", "#6B7A45"])).toBeGreaterThan(0.8);
  });

  it("penaliza tres colores de acento distintos en el mismo conjunto", () => {
    const disciplinada = paletteHarmony(["#1C1C1C", "#F5F3EF", "#E63946"]);
    const ruidosa = paletteHarmony(["#E63946", "#2ECC71", "#9B59B6"]);
    expect(ruidosa).toBeLessThan(disciplinada);
  });

  it("no premia ni castiga cuando hay menos de dos colores", () => {
    expect(paletteHarmony(["#1C1C1C"])).toBe(0.75);
    expect(paletteHarmony([])).toBe(0.75);
  });
});
