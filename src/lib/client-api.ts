"use client";

/**
 * Cliente tipado de `/api/*`.
 *
 * Los componentes no hacen `fetch`: las páginas llaman a estas funciones, que
 * desenvuelven `ApiResponse` y convierten cualquier fallo en una excepción con
 * mensaje ya redactado en español. Así el manejo de errores en la interfaz es
 * un único `catch` por acción, no un `if (!res.ok)` en cada sitio.
 */

import type {
  AnalyzeGarmentResult,
  ApiError,
  ApiResponse,
  CreateGarmentResult,
  Garment,
  GarmentAttributes,
  GarmentUpdate,
  Outfit,
  OutfitRequest,
} from "@/lib/types";

/** Error de API con el código y, si aplica, la variable de entorno que falta. */
export class ApiCallError extends Error {
  readonly code: ApiError["code"];
  readonly missingEnvVar?: string;

  constructor(error: ApiError) {
    super(error.message);
    this.name = "ApiCallError";
    this.code = error.code;
    if (error.missingEnvVar !== undefined) this.missingEnvVar = error.missingEnvVar;
  }
}

async function unwrap<T>(response: Response): Promise<T> {
  let body: ApiResponse<T>;
  try {
    body = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new Error(`El servidor respondió ${response.status} sin un cuerpo válido.`);
  }

  if (!body.ok) throw new ApiCallError(body.error);
  return body.data;
}

/* ────────────────────────────── Prendas ────────────────────────────── */

export async function fetchGarments(opts?: { archived?: boolean }): Promise<Garment[]> {
  // Con `archived=true` la API devuelve archivadas **y** activas mezcladas:
  // quien quiera solo la papelera filtra por `garment.archived`.
  const query = opts?.archived === true ? "?archived=true" : "";
  return unwrap<Garment[]>(await fetch(`/api/garments${query}`, { cache: "no-store" }));
}

/** Paso 1: recorta, etiqueta y sube. No guarda todavía. */
export async function analyzeGarment(image: Blob): Promise<AnalyzeGarmentResult> {
  const form = new FormData();
  form.append("image", image, "prenda.jpg");
  return unwrap<AnalyzeGarmentResult>(
    await fetch("/api/garments/analyze", { method: "POST", body: form }),
  );
}

/** Paso 2: guarda la prenda con los atributos ya revisados. */
export async function createGarment(input: {
  imageUrl: string;
  cutoutUrl: string;
  thumbUrl: string | null;
  attributes: GarmentAttributes;
}): Promise<Garment> {
  const result = await unwrap<CreateGarmentResult>(
    await fetch("/api/garments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
  return result.garment;
}

export async function updateGarment(id: string, patch: GarmentUpdate): Promise<Garment> {
  return unwrap<Garment>(
    await fetch(`/api/garments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }),
  );
}

export async function deleteGarment(id: string): Promise<void> {
  await unwrap<{ id: string }>(await fetch(`/api/garments/${id}`, { method: "DELETE" }));
}

/** garmentId → fecha ISO de la última vez que se registró su uso. */
export async function fetchWearLog(): Promise<Record<string, string>> {
  return unwrap<Record<string, string>>(await fetch("/api/wear", { cache: "no-store" }));
}

export async function logWear(garmentId: string): Promise<void> {
  await unwrap(await fetch(`/api/garments/${garmentId}/wear`, { method: "POST" }));
}

/* ────────────────────────────── Conjuntos ────────────────────────────── */

export async function generateOutfits(request: OutfitRequest = {}): Promise<Outfit[]> {
  return unwrap<Outfit[]>(
    await fetch("/api/outfits/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    }),
  );
}

/** Pide al modelo que opine sobre un look montado a mano en el probador. */
export async function critiqueLook(garmentIds: string[]): Promise<Outfit> {
  return unwrap<Outfit>(
    await fetch("/api/outfits/critique", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ garmentIds }),
    }),
  );
}

export async function fetchFavorites(): Promise<Outfit[]> {
  return unwrap<Outfit[]>(await fetch("/api/outfits/favorites", { cache: "no-store" }));
}

export async function saveFavorite(outfit: Outfit): Promise<Outfit> {
  return unwrap<Outfit>(
    await fetch("/api/outfits/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(outfit),
    }),
  );
}

export async function removeFavorite(id: string): Promise<void> {
  await unwrap<{ id: string }>(
    await fetch(`/api/outfits/favorites?id=${encodeURIComponent(id)}`, { method: "DELETE" }),
  );
}
