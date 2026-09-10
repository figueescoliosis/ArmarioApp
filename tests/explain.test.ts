import { afterEach, describe, expect, it, vi } from "vitest";
import { explainOutfits } from "@/lib/outfits/explain";
import type { Outfit } from "@/lib/types";
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

    const [result] = await explainOutfits([outfit("a")]);
    expect(result.name).toBe("Negro sobre negro");
    expect(result.source).toBe("rules+llm");
  });

  it("degrada a los conjuntos de reglas si el modelo falla", async () => {
    process.env.GEMINI_API_KEY = "test";
    mockGemini({ error: "boom" }, false);

    const input = [outfit("a")];
    expect(await explainOutfits(input)).toBe(input);
  });
});
