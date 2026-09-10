import { NextRequest } from "next/server";
import { fail, handle, ok } from "@/lib/api";
import { deleteGarment, getGarment, updateGarment } from "@/lib/db/garments";
import { CATEGORIES, PATTERNS, SEASONS, type GarmentUpdate } from "@/lib/types";

interface Context {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Context) {
  return handle(async () => {
    const { id } = await params;
    const garment = await getGarment(id);
    return garment === null ? fail("NOT_FOUND", "Esa prenda no existe.") : ok(garment);
  });
}

export async function PATCH(request: NextRequest, { params }: Context) {
  return handle(async () => {
    const { id } = await params;
    const body: unknown = await request.json().catch(() => null);
    if (body === null || typeof body !== "object") {
      return fail("BAD_REQUEST", "El cuerpo debe ser un objeto JSON con los campos a corregir.");
    }

    const patch = sanitizeUpdate(body as Record<string, unknown>);
    if (Object.keys(patch).length === 0) {
      return fail("BAD_REQUEST", "No hay ningún campo válido que actualizar.");
    }

    return ok(await updateGarment(id, patch));
  });
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  return handle(async () => {
    const { id } = await params;
    await deleteGarment(id);
    return ok({ id });
  });
}

/**
 * Valida campo a campo lo que llega del cliente.
 *
 * Se hace a mano y de forma explícita porque este endpoint escribe directamente
 * en la base de datos: cualquier campo desconocido se descarta en silencio en
 * vez de propagarse a la fila.
 */
function sanitizeUpdate(input: Record<string, unknown>): GarmentUpdate {
  const patch: GarmentUpdate = {};

  if (typeof input.category === "string" && (CATEGORIES as readonly string[]).includes(input.category)) {
    patch.category = input.category as GarmentUpdate["category"];
  }
  if (typeof input.subcategory === "string") patch.subcategory = input.subcategory.trim();
  if (typeof input.pattern === "string" && (PATTERNS as readonly string[]).includes(input.pattern)) {
    patch.pattern = input.pattern as GarmentUpdate["pattern"];
  }
  if (typeof input.material === "string" || input.material === null) {
    patch.material = typeof input.material === "string" ? input.material.trim() || null : null;
  }
  if (typeof input.notes === "string" || input.notes === null) {
    patch.notes = typeof input.notes === "string" ? input.notes.trim() || null : null;
  }
  if (typeof input.archived === "boolean") patch.archived = input.archived;

  if (Array.isArray(input.styleTags)) {
    patch.styleTags = input.styleTags
      .filter((tag): tag is string => typeof tag === "string")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 5);
  }

  if (Array.isArray(input.seasons)) {
    patch.seasons = input.seasons.filter(
      (season): season is GarmentUpdate["seasons"] extends (infer S)[] | undefined ? S : never =>
        typeof season === "string" && (SEASONS as readonly string[]).includes(season),
    );
  }

  if (Array.isArray(input.colors)) {
    const colors = input.colors
      .filter((color): color is Record<string, unknown> => typeof color === "object" && color !== null)
      .filter((color) => typeof color.hex === "string" && /^#?[0-9a-fA-F]{6}$/.test(color.hex))
      .slice(0, 4)
      .map((color) => ({
        hex: `#${String(color.hex).replace(/^#/, "").toUpperCase()}`,
        name: typeof color.name === "string" ? color.name.trim() : "",
        ratio: typeof color.ratio === "number" && Number.isFinite(color.ratio) ? color.ratio : 0,
      }));
    if (colors.length > 0) patch.colors = colors;
  }

  for (const field of ["formality", "warmth"] as const) {
    const value = input[field];
    if (typeof value === "number" && Number.isFinite(value)) {
      const clamped = Math.min(5, Math.max(1, Math.round(value)));
      patch[field] = clamped as 1 | 2 | 3 | 4 | 5;
    }
  }

  return patch;
}
