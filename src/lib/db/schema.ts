/**
 * Tipos de fila tal y como los devuelve Postgres/PostgREST (snake_case) y
 * los mapeadores puros hacia/desde los tipos de dominio de `@/lib/types`.
 *
 * Nada de esto toca la red: son funciones de transformación, fáciles de
 * testear y reutilizables tanto por `garments.ts` como por `outfits.ts`.
 */

import type {
  Category,
  Formality,
  Garment,
  GarmentAttributes,
  GarmentColor,
  Outfit,
  OutfitItem,
  Pattern,
  ScoreBreakdown,
  Season,
  Slot,
  Warmth,
} from "@/lib/types";
import { CATEGORIES, PATTERNS, SEASONS, SLOTS } from "@/lib/types";

/* ────────────────────────────── Filas de Postgres ────────────────────────────── */

export interface GarmentRow {
  id: string;
  owner_id: string;
  image_url: string;
  cutout_url: string;
  thumb_url: string | null;
  category: string;
  subcategory: string | null;
  colors: unknown;
  primary_hex: string;
  is_neutral: boolean;
  pattern: string | null;
  material: string | null;
  style_tags: string[];
  formality: number;
  warmth: number;
  seasons: string[];
  notes: string | null;
  archived: boolean;
  created_at: string;
}

export interface OutfitRow {
  id: string;
  owner_id: string;
  name: string | null;
  score: number;
  score_breakdown: unknown;
  rationale: string | null;
  source: string;
  signature: string;
  is_favorite: boolean;
  created_at: string;
}

export interface OutfitItemRow {
  outfit_id: string;
  garment_id: string;
  slot: string;
}

/** `outfit_items` con la prenda embebida, tal y como la trae un join anidado de PostgREST. */
export interface OutfitItemRowWithGarment {
  slot: string;
  garments: GarmentRow;
}

/** `outfits` con sus `outfit_items` (y la prenda de cada uno) embebidos. */
export interface OutfitRowWithItems extends OutfitRow {
  outfit_items: OutfitItemRowWithGarment[];
}

/* ────────────────────────────── Validación de rango ────────────────────────────── */

/**
 * Estrecha un número a la escala 1-5 con clamp en vez de un `as` a ciegas:
 * un valor corrupto en la base de datos no debe poder colar un `Formality`
 * o `Warmth` fuera de rango en el resto de la app.
 */
function clampToScale(value: number): Formality | Warmth {
  const rounded = Math.round(value);
  const clamped = Math.min(5, Math.max(1, rounded));
  return clamped as Formality | Warmth;
}

function toCategory(value: string): Category {
  const found = CATEGORIES.find((c) => c === value);
  if (!found) {
    throw new Error(`Categoría desconocida en base de datos: "${value}"`);
  }
  return found;
}

function toPattern(value: string | null): Pattern {
  if (value === null) return "other";
  const found = PATTERNS.find((p) => p === value);
  return found ?? "other";
}

function toSeasons(value: string[]): Season[] {
  return value.filter((v): v is Season => (SEASONS as readonly string[]).includes(v));
}

function toSlot(value: string): Slot {
  const found = SLOTS.find((s) => s === value);
  if (!found) {
    throw new Error(`Slot desconocido en base de datos: "${value}"`);
  }
  return found;
}

/** Cast seguro desde `jsonb`: valida forma mínima en vez de confiar ciegamente en la columna. */
function toGarmentColors(value: unknown): GarmentColor[] {
  if (!Array.isArray(value)) return [];
  const result: GarmentColor[] = [];
  for (const item of value) {
    if (
      item !== null &&
      typeof item === "object" &&
      typeof (item as Record<string, unknown>).hex === "string" &&
      typeof (item as Record<string, unknown>).name === "string" &&
      typeof (item as Record<string, unknown>).ratio === "number"
    ) {
      const record = item as Record<string, unknown>;
      result.push({
        hex: record.hex as string,
        name: record.name as string,
        ratio: record.ratio as number,
      });
    }
  }
  return result;
}

function toScoreBreakdown(value: unknown): ScoreBreakdown {
  const record = value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const num = (key: string): number => (typeof record[key] === "number" ? (record[key] as number) : 0);
  return {
    color: num("color"),
    formality: num("formality"),
    compatibility: num("compatibility"),
    season: num("season"),
    freshness: num("freshness"),
  };
}

function toSource(value: string): Outfit["source"] {
  return value === "rules+llm" ? "rules+llm" : "rules";
}

/* ────────────────────────────── Mapeadores: Garment ────────────────────────────── */

export function rowToGarment(row: GarmentRow): Garment {
  return {
    id: row.id,
    ownerId: row.owner_id,
    imageUrl: row.image_url,
    cutoutUrl: row.cutout_url,
    thumbUrl: row.thumb_url,
    category: toCategory(row.category),
    subcategory: row.subcategory ?? "",
    colors: toGarmentColors(row.colors),
    primaryHex: row.primary_hex,
    isNeutral: row.is_neutral,
    pattern: toPattern(row.pattern),
    material: row.material,
    styleTags: row.style_tags,
    formality: clampToScale(row.formality) as Formality,
    warmth: clampToScale(row.warmth) as Warmth,
    seasons: toSeasons(row.seasons),
    notes: row.notes,
    archived: row.archived,
    createdAt: row.created_at,
  };
}

/** Datos necesarios para insertar/actualizar una prenda, en forma de fila snake_case. */
export function garmentToRow(input: {
  attributes: GarmentAttributes;
  imageUrl: string;
  cutoutUrl: string;
  thumbUrl: string | null;
  primaryHex: string;
  isNeutral: boolean;
  ownerId: string;
}): Omit<GarmentRow, "id" | "created_at"> {
  return {
    owner_id: input.ownerId,
    image_url: input.imageUrl,
    cutout_url: input.cutoutUrl,
    thumb_url: input.thumbUrl,
    category: input.attributes.category,
    subcategory: input.attributes.subcategory,
    colors: input.attributes.colors,
    primary_hex: input.primaryHex,
    is_neutral: input.isNeutral,
    pattern: input.attributes.pattern,
    material: input.attributes.material,
    style_tags: input.attributes.styleTags,
    formality: input.attributes.formality,
    warmth: input.attributes.warmth,
    seasons: input.attributes.seasons,
    notes: null,
    archived: false,
  };
}

/* ────────────────────────────── Mapeadores: Outfit ────────────────────────────── */

export function rowToOutfitItem(row: OutfitItemRowWithGarment): OutfitItem {
  return {
    garment: rowToGarment(row.garments),
    slot: toSlot(row.slot),
  };
}

export function rowToOutfit(row: OutfitRowWithItems): Outfit {
  return {
    id: row.id,
    name: row.name,
    items: row.outfit_items.map(rowToOutfitItem),
    score: row.score,
    breakdown: toScoreBreakdown(row.score_breakdown),
    rationale: row.rationale ?? "",
    source: toSource(row.source),
    isFavorite: row.is_favorite,
    createdAt: row.created_at,
  };
}

export function outfitToRow(outfit: Outfit, ownerId: string, signature: string): Omit<OutfitRow, "id" | "created_at"> {
  return {
    owner_id: ownerId,
    name: outfit.name,
    score: outfit.score,
    score_breakdown: outfit.breakdown,
    rationale: outfit.rationale,
    source: outfit.source,
    signature,
    is_favorite: outfit.isFavorite,
  };
}
