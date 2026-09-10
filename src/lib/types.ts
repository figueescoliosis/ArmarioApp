/**
 * Contrato de tipos compartido por toda la aplicación.
 *
 * Todo lo que cruce una frontera (cliente ↔ API, API ↔ base de datos, motor de
 * outfits ↔ UI) se describe aquí. Si un tipo se usa en más de un módulo, vive en
 * este archivo y no se redefine en ningún otro sitio.
 */

/* ────────────────────────────── Prendas ────────────────────────────── */

/** Categoría principal: determina qué hueco ocupa la prenda en un conjunto. */
export const CATEGORIES = [
  "top",
  "bottom",
  "dress",
  "outerwear",
  "shoes",
  "accessory",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const PATTERNS = [
  "solid",
  "striped",
  "checked",
  "floral",
  "print",
  "other",
] as const;
export type Pattern = (typeof PATTERNS)[number];

export const SEASONS = ["primavera", "verano", "otoño", "invierno"] as const;
export type Season = (typeof SEASONS)[number];

/**
 * Escala de formalidad, 1 a 5. Se usa para penalizar mezclas imposibles
 * (unas chanclas con un esmoquin) midiendo la distancia entre prendas.
 */
export const FORMALITY = {
  1: "estar por casa",
  2: "casual",
  3: "smart casual",
  4: "formal",
  5: "etiqueta",
} as const;
export type Formality = 1 | 2 | 3 | 4 | 5;

/** Abrigo, 1 (tirantes) a 5 (plumas). Filtra conjuntos por temperatura. */
export type Warmth = 1 | 2 | 3 | 4 | 5;

/** Un color extraído de la prenda. `ratio` es la fracción de píxeles que ocupa. */
export interface GarmentColor {
  /** Hexadecimal en mayúsculas, con almohadilla: `#1A2B3C`. */
  hex: string;
  /** Nombre legible en español: "azul marino", "verde oliva". */
  name: string;
  /** Entre 0 y 1. Los colores llegan ordenados de mayor a menor ratio. */
  ratio: number;
}

/**
 * Atributos que deduce la IA al analizar la foto. Es exactamente la forma que
 * devuelve `tagGarment()` y la que el usuario puede corregir antes de guardar.
 */
export interface GarmentAttributes {
  category: Category;
  /** Tipo concreto en español: "camisa de vestir", "vaquero recto", "botín". */
  subcategory: string;
  colors: GarmentColor[];
  pattern: Pattern;
  /** Tejido si es reconocible: "algodón", "lana", "denim". `null` si no lo es. */
  material: string | null;
  /** Etiquetas de estilo libres: "streetwear", "minimalista", "deportivo". */
  styleTags: string[];
  formality: Formality;
  warmth: Warmth;
  seasons: Season[];
}

/** Una prenda tal y como está guardada y como la consume la interfaz. */
export interface Garment extends GarmentAttributes {
  id: string;
  ownerId: string;
  /** Foto original subida por el usuario. */
  imageUrl: string;
  /** PNG con el fondo eliminado. Es la imagen que se muestra en toda la app. */
  cutoutUrl: string;
  /** WebP pequeño para la rejilla del armario. `null` si aún no se generó. */
  thumbUrl: string | null;
  /** Color dominante, cacheado desde `colors[0]` para poder ordenar en SQL. */
  primaryHex: string;
  /** Precalculado: negro, blanco, gris, beige o denim combinan con todo. */
  isNeutral: boolean;
  notes: string | null;
  archived: boolean;
  createdAt: string;
}

/** Campos que el usuario puede corregir después de que la IA etiquete. */
export type GarmentUpdate = Partial<
  Pick<
    Garment,
    | "category"
    | "subcategory"
    | "colors"
    | "pattern"
    | "material"
    | "styleTags"
    | "formality"
    | "warmth"
    | "seasons"
    | "notes"
    | "archived"
  >
>;

/* ────────────────────────────── Conjuntos ────────────────────────────── */

/**
 * Hueco que ocupa una prenda dentro de un conjunto. Coincide con `Category`
 * salvo que `dress` ocupa a la vez el hueco de arriba y el de abajo.
 */
export const SLOTS = [
  "top",
  "bottom",
  "dress",
  "outerwear",
  "shoes",
  "accessory",
] as const;
export type Slot = (typeof SLOTS)[number];

/** Desglose de la puntuación: permite explicar al usuario el porqué del conjunto. */
export interface ScoreBreakdown {
  /** Armonía cromática entre las prendas (0-1). */
  color: number;
  /** Coherencia de formalidad: penaliza mezclar extremos (0-1). */
  formality: number;
  /** Compatibilidad entre subcategorías según la matriz de reglas (0-1). */
  compatibility: number;
  /** Adecuación a la temporada y temperatura pedidas (0-1). */
  season: number;
  /** Bonus por usar prendas que llevan tiempo sin ponerse (0-1). */
  freshness: number;
}

export interface OutfitItem {
  garment: Garment;
  slot: Slot;
}

export interface Outfit {
  /** UUID si está guardado; identificador determinista si es recién generado. */
  id: string;
  name: string | null;
  items: OutfitItem[];
  /** Puntuación global 0-1, media ponderada de `breakdown`. */
  score: number;
  breakdown: ScoreBreakdown;
  /** Explicación en lenguaje natural, por reglas o escrita por el modelo. */
  rationale: string;
  source: "rules" | "rules+llm";
  isFavorite: boolean;
  createdAt: string;
}

/** Un desajuste detectado en un conjunto compuesto a mano. */
export interface LookIssue {
  /** `grave` es lo que el generador vetaría; `leve` solo se avisa. */
  severity: "grave" | "leve";
  /** Redactado en español y mostrable tal cual. */
  message: string;
}

/**
 * Veredicto sobre un conjunto que ha montado el usuario en el probador.
 *
 * Se calcula en el navegador con las mismas funciones puras que usa el motor,
 * así que la alerta aparece al instante y sin gastar cuota de ningún servicio.
 */
export interface LookEvaluation {
  score: number;
  breakdown: ScoreBreakdown;
  rationale: string;
  issues: LookIssue[];
}

/** Restricciones opcionales que el usuario impone al generar conjuntos. */
export interface OutfitRequest {
  /** Nivel de formalidad objetivo. Sin él, se aceptan todos. */
  occasion?: Formality;
  /** Temperatura en grados. Filtra por el `warmth` de las prendas. */
  temperatureC?: number;
  season?: Season;
  /** "Quiero ponerme esto, dime con qué": fuerza incluir estas prendas. */
  mustIncludeIds?: string[];
  excludeIds?: string[];
  /** Cuántos conjuntos devolver. Por defecto 10. */
  limit?: number;
  /** Si es `true`, Claude reordena y redacta las explicaciones del top 5. */
  useLlmRanking?: boolean;
}

/* ────────────────────────────── API ────────────────────────────── */

/**
 * Envoltorio uniforme de todas las respuestas de `/api/*`.
 * La UI solo tiene que mirar `ok` para saber si pintar datos o un error.
 */
export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

export interface ApiError {
  /** Código estable, apto para hacer `switch` en el cliente. */
  code: ApiErrorCode;
  /** Mensaje en español, mostrable directamente al usuario. */
  message: string;
  /**
   * Presente cuando falta configuración: nombra la variable de entorno
   * concreta que hay que rellenar. La UI lo usa para enlazar al setup.
   */
  missingEnvVar?: string;
}

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "NOT_FOUND"
  | "MISSING_CONFIG"
  | "IMAGE_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "BACKGROUND_REMOVAL_FAILED"
  | "TAGGING_FAILED"
  | "STORAGE_FAILED"
  | "DATABASE_FAILED"
  | "INTERNAL";

export interface PipelineTimings {
  backgroundRemovalMs: number;
  taggingMs: number;
  uploadMs: number;
  totalMs: number;
}

/**
 * Resultado de analizar una foto: la prenda ya está recortada y subida al
 * almacenamiento, pero **todavía no guardada en la base de datos**.
 *
 * La subida es en dos pasos a propósito. El usuario tiene que poder corregir lo
 * que dedujo la IA antes de que la prenda entre en su armario, y para revisarlo
 * necesita ver el recorte ya hecho. Guardar primero y corregir después dejaría
 * prendas mal etiquetadas en el armario cada vez que alguien se arrepiente a
 * mitad de camino.
 */
export interface AnalyzeGarmentResult {
  imageUrl: string;
  cutoutUrl: string;
  thumbUrl: string | null;
  /** Lo que dedujo el modelo. Es un borrador: el usuario puede cambiarlo todo. */
  attributes: GarmentAttributes;
  timings: PipelineTimings;
  /** Proveedor de recorte que atendió la petición: "fal", "photoroom"… */
  backgroundProvider: string;
}

/** Resultado de confirmar la prenda: la fila ya guardada. */
export interface CreateGarmentResult {
  garment: Garment;
}
