import { afterEach, describe, expect, it, vi } from "vitest";
import { tagGarment } from "@/lib/ai/tagging";
import { tagGarmentWithGemini } from "@/lib/ai/tagging/gemini";

const ATTRS = {
  category: "top",
  subcategory: "camisa de vestir",
  colors: [{ hex: "#1A2B3C", name: "azul marino", ratio: 1 }],
  pattern: "solid",
  material: "algodón",
  styleTags: ["formal"],
  formality: 4,
  warmth: 2,
  seasons: ["primavera"],
};

function mockGemini(body: unknown, ok = true) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok,
    status: ok ? 200 : 429,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response);
}

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.TAGGING_PROVIDER;
  delete process.env.GEMINI_API_KEY;
});

describe("tagGarment", () => {
  it("rechaza un proveedor desconocido", async () => {
    process.env.TAGGING_PROVIDER = "inventado";
    await expect(tagGarment(Buffer.alloc(0))).rejects.toThrow(/inventado/);
  });

  it("enruta a gemini y devuelve los atributos saneados", async () => {
    process.env.TAGGING_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "test";
    mockGemini({ candidates: [{ content: { parts: [{ text: JSON.stringify(ATTRS) }] } }] });

    const result = await tagGarment(Buffer.from("png"));
    expect(result.attributes.subcategory).toBe("camisa de vestir");
    expect(result.attributes.colors[0]).toEqual({ hex: "#1A2B3C", name: "azul marino", ratio: 1 });
  });
});

describe("tagGarmentWithGemini", () => {
  it("exige la clave", async () => {
    await expect(tagGarmentWithGemini(Buffer.alloc(0))).rejects.toThrow(/GEMINI_API_KEY/);
  });

  it("falla si la respuesta no encaja con el esquema", async () => {
    process.env.GEMINI_API_KEY = "test";
    mockGemini({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ ...ATTRS, category: "nave" }) }] } }],
    });
    await expect(tagGarmentWithGemini(Buffer.from("png"))).rejects.toThrow(/category/);
  });

  it("reintenta si el modelo está saturado", async () => {
    process.env.GEMINI_API_KEY = "test";
    const ok = {
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(ATTRS) }] } }] }),
    } as Response;
    const saturado = { ok: false, status: 503, text: async () => "sobrecargado" } as Response;
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(saturado)
      .mockResolvedValueOnce(ok);

    vi.useFakeTimers();
    try {
      const promesa = tagGarmentWithGemini(Buffer.from("png"));
      await vi.runAllTimersAsync();
      expect((await promesa).attributes.subcategory).toBe("camisa de vestir");
    } finally {
      vi.useRealTimers();
    }
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("falla si la API responde con error", async () => {
    process.env.GEMINI_API_KEY = "test";
    mockGemini({ error: "quota" }, false);
    await expect(tagGarmentWithGemini(Buffer.from("png"))).rejects.toThrow(/respondió 429/);
  });
});
