/**
 * Prendas: listar y confirmar el alta.
 *
 * El POST es el paso 2 de la subida: recibe las URLs que devolvió
 * `/api/garments/analyze` junto con los atributos ya revisados por el usuario,
 * y escribe la fila. Es deliberadamente barato — todo el trabajo pesado ya se
 * hizo en el análisis.
 */

import { NextRequest } from "next/server";
import { fail, handle, ok } from "@/lib/api";
import { insertGarment, listGarments } from "@/lib/db/garments";
import {
  CATEGORIES,
  PATTERNS,
  SEASONS,
  type Category,
  type CreateGarmentResult,
  type GarmentAttributes,
} from "@/lib/types";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const categoryParam = request.nextUrl.searchParams.get("category");
    const category =
      categoryParam !== null && (CATEGORIES as readonly string[]).includes(categoryParam)
        ? (categoryParam as Category)
        : undefined;

    const includeArchived = request.nextUrl.searchParams.get("archived") === "true";

    return ok(await listGarments({ category, includeArchived }));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const raw: unknown = await request.json().catch(() => null);
    if (raw === null || typeof raw !== "object") {
      return fail("BAD_REQUEST", "Se esperaba un cuerpo JSON.");
    }

    const body = raw as Record<string, unknown>;
    const imageUrl = body.imageUrl;
    const cutoutUrl = body.cutoutUrl;

    if (typeof imageUrl !== "string" || typeof cutoutUrl !== "string") {
      return fail(
        "BAD_REQUEST",
        "Faltan 'imageUrl' o 'cutoutUrl'. Deben venir de POST /api/garments/analyze.",
      );
    }

    const attributes = parseAttributes(body.attributes);
    if (attributes === null) {
      return fail("BAD_REQUEST", "Los atributos de la prenda no son válidos.");
    }

    const garment = await insertGarment({
      attributes,
      imageUrl,
      cutoutUrl,
      thumbUrl: typeof body.thumbUrl === "string" ? body.thumbUrl : null,
    });

    const result: CreateGarmentResult = { garment };
    return ok(result, 201);
  });
}

/**
 * Valida los atributos que llegan del formulario de revisión.
 *
 * Devuelve `null` en vez de lanzar si algo esencial no cuadra: el endpoint
 * responde entonces con un 400 claro en lugar de un error interno.
 */
function parseAttributes(input: unknown): GarmentAttributes | null {
  if (typeof input !== "object" || input === null) return null;
  const raw = input as Record<string, unknown>;

  if (typeof raw.category !== "string" || !(CATEGORIES as readonly string[]).includes(raw.category)) {
    return null;
  }
  if (typeof raw.subcategory !== "string" || raw.subcategory.trim() === "") return null;

  const colors = Array.isArray(raw.colors)
    ? raw.colors
        .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
        .filter((c) => typeof c.hex === "string" && /^#?[0-9a-fA-F]{6}$/.test(c.hex))
        .slice(0, 4)
        .map((c) => ({
          hex: `#${String(c.hex).replace(/^#/, "").toUpperCase()}`,
          name: typeof c.name === "string" ? c.name.trim() : "",
          ratio: typeof c.ratio === "number" && Number.isFinite(c.ratio) ? c.ratio : 0,
        }))
    : [];
  if (colors.length === 0) return null;

  const clamp = (value: unknown): 1 | 2 | 3 | 4 | 5 => {
    const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 3;
    return Math.min(5, Math.max(1, n)) as 1 | 2 | 3 | 4 | 5;
  };

  return {
    category: raw.category as Category,
    subcategory: raw.subcategory.trim(),
    colors,
    pattern:
      typeof raw.pattern === "string" && (PATTERNS as readonly string[]).includes(raw.pattern)
        ? (raw.pattern as GarmentAttributes["pattern"])
        : "solid",
    material: typeof raw.material === "string" && raw.material.trim() !== "" ? raw.material.trim() : null,
    styleTags: Array.isArray(raw.styleTags)
      ? raw.styleTags
          .filter((tag): tag is string => typeof tag === "string")
          .map((tag) => tag.trim())
          .filter(Boolean)
          .slice(0, 5)
      : [],
    formality: clamp(raw.formality),
    warmth: clamp(raw.warmth),
    seasons: Array.isArray(raw.seasons)
      ? raw.seasons.filter(
          (s): s is GarmentAttributes["seasons"][number] =>
            typeof s === "string" && (SEASONS as readonly string[]).includes(s),
        )
      : [],
  };
}
