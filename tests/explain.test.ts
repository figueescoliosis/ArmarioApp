import { afterEach, describe, expect, it, vi } from "vitest";
import { explainCouples, explainOutfits } from "@/lib/outfits/explain";
import type { CoupleOutfit, Outfit } from "@/lib/types";
import { garment, resetIds } from "./fixtures";

function outfit(id: string): Outfit {
  return {
    id,
    name: "Conjunto",
    items: [{ slot: "top", garment: garment({ category: "top" }) }],
    score: 0.9,
    breakdown: {},
    rationale: "de reglas",
    source: "rules",
  } as unknown as Outfit;
}

function mockGemini(body: unknown, ok = true) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response);
}

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GEMINI_API_KEY;
  resetIds();
});

describe("explainOutfits", () => {
  it("no toca nada si no hay ninguna clave", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const input = [outfit("a")];
    expect(await explainOutfits(input)).toBe(input);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("usa Gemini cuando solo está esa clave", async () => {
    process.env.GEMINI_API_KEY = "test";
    mockGemini({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  outfits: [{ id: "a", name: "Negro sobre negro", rationale: "funciona", rank: 1 }],
                }),
              },
            ],
          },
        },
      ],
    });

    const result = await explainOutfits([outfit("a")]);
    expect(result[0]?.name).toBe("Negro sobre negro");
    expect(result[0]?.source).toBe("rules+llm");
  });

  it("degrada a los conjuntos de reglas si el modelo falla", async () => {
    process.env.GEMINI_API_KEY = "test";
    mockGemini({ error: "boom" }, false);

    const input = [outfit("a")];
    expect(await explainOutfits(input)).toBe(input);
  });
});

describe("explainCouples", () => {
  const pair = (id: string, score: number): CoupleOutfit => ({
    id,
    mine: outfit(`${id}-mio`),
    theirs: outfit(`${id}-suyo`),
    name: null,
    score,
    rationale: "de reglas",
    isFavorite: false,
  });

  it("reordena los pares y les pone nombre", async () => {
    process.env.GEMINI_API_KEY = "test";
    const fetchSpy = mockGemini({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  outfits: [
                    { id: "b", name: "Domingo a juego", rationale: "vais iguales sin ir iguales", rank: 1 },
                    { id: "a", name: "Cena", rationale: "bien", rank: 2 },
                  ],
                }),
              },
            ],
          },
        },
      ],
    });

    const result = await explainCouples([pair("a", 0.9), pair("b", 0.8)]);
    expect(result.map((p) => p.id)).toEqual(["b", "a"]);
    expect(result[0]?.name).toBe("Domingo a juego");
    // El modelo ve los dos looks de cada par.
    expect(String(fetchSpy.mock.calls[0]?.[1]?.body)).toContain("Look de la otra");
  });

  it("devuelve los pares tal cual si el modelo falla", async () => {
    process.env.GEMINI_API_KEY = "test";
    mockGemini({ error: "boom" }, false);
    const input = [pair("a", 0.9)];
    expect(await explainCouples(input)).toBe(input);
  });
});
