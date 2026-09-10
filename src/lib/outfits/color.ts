/**
 * Teoría del color aplicada a combinar ropa.
 *
 * Todo lo de aquí son funciones puras y deterministas, sin red ni estado. El
 * motor de outfits se apoya en ellas y los tests las cubren caso a caso.
 *
 * Se trabaja en tres espacios distintos porque cada uno responde a una pregunta
 * diferente: RGB para leer el hexadecimal, HSL para razonar sobre matiz y
 * saturación (que es como se piensa al vestir: "un azul apagado"), y CIELAB
 * para medir *cuánto* se parecen dos colores de forma perceptual, que es algo
 * que las distancias en RGB hacen francamente mal.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}
export interface Hsl {
  /** Matiz en grados, 0-360. */
  h: number;
  /** Saturación, 0-1. */
  s: number;
  /** Luminosidad, 0-1. */
  l: number;
}
export interface Lab {
  l: number;
  a: number;
  b: number;
}

/* ────────────────────────── Conversiones ────────────────────────── */

/**
 * Acepta `#RGB`, `#RRGGBB` y las mismas formas sin almohadilla.
 * Devuelve `null` en vez de lanzar: los hex llegan del modelo y del usuario,
 * y un color mal escrito no debe tumbar la generación de un conjunto entero.
 */
export function hexToRgb(hex: string): Rgb | null {
  const clean = hex.trim().replace(/^#/, "");

  if (clean.length === 3) {
    const [r, g, b] = [clean[0], clean[1], clean[2]];
    if (r === undefined || g === undefined || b === undefined) return null;
    if (!/^[0-9a-fA-F]{3}$/.test(clean)) return null;
    return {
      r: parseInt(r + r, 16),
      g: parseInt(g + g, 16),
      b: parseInt(b + b, 16),
    };
  }

  if (clean.length === 6) {
    if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
    };
  }

  return null;
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const part = (n: number) =>
    Math.round(Math.min(255, Math.max(0, n)))
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  return `#${part(r)}${part(g)}${part(b)}`;
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const l = (max + min) / 2;

  if (delta === 0) return { h: 0, s: 0, l };

  const s = delta / (1 - Math.abs(2 * l - 1));

  let h: number;
  if (max === rn) h = 60 * (((gn - bn) / delta) % 6);
  else if (max === gn) h = 60 * ((bn - rn) / delta + 2);
  else h = 60 * ((rn - gn) / delta + 4);

  return { h: (h + 360) % 360, s, l };
}

export function hexToHsl(hex: string): Hsl | null {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHsl(rgb) : null;
}

/** sRGB → CIELAB con iluminante D65, que es el estándar para pantallas. */
export function rgbToLab({ r, g, b }: Rgb): Lab {
  // Linealización sRGB: deshace la corrección gamma antes de ir a XYZ.
  const linear = (c: number): number => {
    const n = c / 255;
    return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
  };

  const rl = linear(r);
  const gl = linear(g);
  const bl = linear(b);

  const x = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) / 0.95047;
  const y = (rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175) / 1.0;
  const z = (rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041) / 1.08883;

  const f = (t: number): number =>
    t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;

  const fx = f(x);
  const fy = f(y);
  const fz = f(z);

  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/**
 * CIEDE2000: la diferencia perceptual entre dos colores. 0 es idéntico, ~2.3
 * es el umbral en que un ojo humano empieza a notar la diferencia, y por
 * encima de 50 son colores claramente distintos.
 *
 * Se usa para detectar prendas del mismo color (que no aportan nada juntas)
 * y para medir contraste real, no aritmético.
 */
export function deltaE2000(c1: Lab, c2: Lab): number {
  const kL = 1;
  const kC = 1;
  const kH = 1;

  const c1ab = Math.hypot(c1.a, c1.b);
  const c2ab = Math.hypot(c2.a, c2.b);
  const cAvg = (c1ab + c2ab) / 2;

  const g =
    0.5 * (1 - Math.sqrt(Math.pow(cAvg, 7) / (Math.pow(cAvg, 7) + Math.pow(25, 7))));

  const a1p = (1 + g) * c1.a;
  const a2p = (1 + g) * c2.a;
  const c1p = Math.hypot(a1p, c1.b);
  const c2p = Math.hypot(a2p, c2.b);

  const h1p = c1p === 0 ? 0 : ((Math.atan2(c1.b, a1p) * 180) / Math.PI + 360) % 360;
  const h2p = c2p === 0 ? 0 : ((Math.atan2(c2.b, a2p) * 180) / Math.PI + 360) % 360;

  const dLp = c2.l - c1.l;
  const dCp = c2p - c1p;

  let dhp: number;
  if (c1p * c2p === 0) dhp = 0;
  else if (Math.abs(h2p - h1p) <= 180) dhp = h2p - h1p;
  else if (h2p - h1p > 180) dhp = h2p - h1p - 360;
  else dhp = h2p - h1p + 360;

  const dHp = 2 * Math.sqrt(c1p * c2p) * Math.sin((dhp * Math.PI) / 360);

  const lAvgP = (c1.l + c2.l) / 2;
  const cAvgP = (c1p + c2p) / 2;

  let hAvgP: number;
  if (c1p * c2p === 0) hAvgP = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hAvgP = (h1p + h2p) / 2;
  else if (h1p + h2p < 360) hAvgP = (h1p + h2p + 360) / 2;
  else hAvgP = (h1p + h2p - 360) / 2;

  const t =
    1 -
    0.17 * Math.cos(((hAvgP - 30) * Math.PI) / 180) +
    0.24 * Math.cos((2 * hAvgP * Math.PI) / 180) +
    0.32 * Math.cos(((3 * hAvgP + 6) * Math.PI) / 180) -
    0.2 * Math.cos(((4 * hAvgP - 63) * Math.PI) / 180);

  const sL =
    1 + (0.015 * Math.pow(lAvgP - 50, 2)) / Math.sqrt(20 + Math.pow(lAvgP - 50, 2));
  const sC = 1 + 0.045 * cAvgP;
  const sH = 1 + 0.015 * cAvgP * t;

  const dTheta = 30 * Math.exp(-Math.pow((hAvgP - 275) / 25, 2));
  const rC =
    2 * Math.sqrt(Math.pow(cAvgP, 7) / (Math.pow(cAvgP, 7) + Math.pow(25, 7)));
  const rT = -rC * Math.sin((2 * dTheta * Math.PI) / 180);

  return Math.sqrt(
    Math.pow(dLp / (kL * sL), 2) +
      Math.pow(dCp / (kC * sC), 2) +
      Math.pow(dHp / (kH * sH), 2) +
      rT * (dCp / (kC * sC)) * (dHp / (kH * sH)),
  );
}

/* ────────────────────────── Neutros ────────────────────────── */

/**
 * Un color neutro combina con cualquier cosa y por tanto no debe penalizar
 * nunca la armonía de un conjunto. Entran tres familias:
 *
 *  - Acromáticos: negro, blanco y toda la escala de grises (saturación baja).
 *  - Extremos de luminosidad: un burdeos casi negro se comporta como negro.
 *  - Tierras y denim: beige, camel, marrón y vaquero. Son saturados pero la
 *    convención al vestir los trata como base, no como color de acento.
 */
export function isNeutralHsl({ h, s, l }: Hsl): boolean {
  if (s < 0.15) return true;
  if (l < 0.15 || l > 0.9) return true;

  // Denim: azules medios y desaturados. Un azul eléctrico (s alta) no entra.
  if (h >= 195 && h <= 245 && s < 0.45 && l < 0.6) return true;

  // Tierras: del naranja quemado al amarillo apagado, sin llegar a ser vivos.
  if (h >= 20 && h <= 50 && s < 0.4) return true;

  return false;
}

export function isNeutralHex(hex: string): boolean {
  const hsl = hexToHsl(hex);
  return hsl ? isNeutralHsl(hsl) : false;
}

/* ────────────────────────── Armonía ────────────────────────── */

/** Distancia angular entre dos matices, siempre en el rango 0-180. */
export function hueDistance(h1: number, h2: number): number {
  const d = Math.abs(((h1 % 360) + 360) % 360 - (((h2 % 360) + 360) % 360));
  return d > 180 ? 360 - d : d;
}

export type HarmonyKind =
  | "neutral"
  | "monocromatico"
  | "analogo"
  | "triadico"
  | "complementario"
  | "discordante";

export interface HarmonyResult {
  kind: HarmonyKind;
  /** 0 (chirría) a 1 (combinación de manual). */
  score: number;
}

/**
 * Caché de armonías ya calculadas.
 *
 * El generador evalúa decenas de miles de combinaciones sobre un armario con
 * apenas unas decenas de colores distintos, así que los mismos pares se repiten
 * una y otra vez. La función es pura, de modo que memorizarla no cambia ningún
 * resultado: solo evita repetir el trabajo.
 */
const harmonyCache = new Map<string, HarmonyResult>();

/** Válvula de seguridad para un proceso de larga vida con muchos armarios. */
const HARMONY_CACHE_LIMIT = 20_000;

/**
 * Puntúa la relación cromática entre dos colores.
 *
 * Los umbrales de matiz salen de la rueda de color clásica; los ajustes por
 * saturación y luminosidad son los que separan una combinación que funciona de
 * otra que, sobre el papel, es la misma relación pero resulta estridente:
 * naranja y azul son complementarios tanto en pastel como en fosforito, y solo
 * uno de los dos casos es ponible.
 */
export function harmonyScore(hexA: string, hexB: string): HarmonyResult {
  // La relación es simétrica, así que la clave se ordena y ambos sentidos
  // comparten entrada.
  const key = hexA <= hexB ? `${hexA} ${hexB}` : `${hexB} ${hexA}`;
  const cached = harmonyCache.get(key);
  if (cached !== undefined) return cached;

  const result = computeHarmony(hexA, hexB);
  if (harmonyCache.size >= HARMONY_CACHE_LIMIT) harmonyCache.clear();
  harmonyCache.set(key, result);
  return result;
}

function computeHarmony(hexA: string, hexB: string): HarmonyResult {
  const a = hexToHsl(hexA);
  const b = hexToHsl(hexB);

  // Un hex ilegible no debe inventar armonía ni castigarla: puntuación neutra.
  if (!a || !b) return { kind: "discordante", score: 0.5 };

  const aNeutral = isNeutralHsl(a);
  const bNeutral = isNeutralHsl(b);

  if (aNeutral && bNeutral) {
    // Dos neutros funcionan si se distinguen entre sí. Negro con gris marengo
    // no es un conjunto, es un accidente.
    const contrast = Math.abs(a.l - b.l);
    return { kind: "neutral", score: contrast > 0.25 ? 0.92 : 0.68 };
  }

  // Un neutro contra un color: es la base de casi todo conjunto que funciona.
  if (aNeutral || bNeutral) return { kind: "neutral", score: 0.88 };

  const dh = hueDistance(a.h, b.h);
  const bothSaturated = a.s > 0.6 && b.s > 0.6;
  const lightnessGap = Math.abs(a.l - b.l);

  if (dh < 15) {
    // Mismo matiz: solo funciona si hay salto de luminosidad (celeste con
    // azul marino). Si no, parece un intento fallido de conjuntar.
    return { kind: "monocromatico", score: lightnessGap > 0.2 ? 0.86 : 0.55 };
  }

  if (dh < 45) return { kind: "analogo", score: bothSaturated ? 0.78 : 0.9 };

  if (dh < 100) {
    // Tierra de nadie de la rueda: ni parientes ni opuestos.
    return { kind: "discordante", score: 0.42 };
  }

  if (dh < 140) return { kind: "triadico", score: bothSaturated ? 0.58 : 0.74 };

  // Complementarios. Con ambos colores saturados es el clásico choque de
  // semáforo; con uno de los dos apagado, es una combinación excelente.
  return { kind: "complementario", score: bothSaturated ? 0.55 : 0.87 };
}

/**
 * Armonía de un conjunto completo, a partir de los colores dominantes de cada
 * prenda.
 *
 * No es la media simple de los pares: además de eso se penaliza el exceso de
 * colores de acento. Tres colores vivos distintos en un mismo conjunto es la
 * regla que casi todo el mundo rompe y casi nadie sabe llevar.
 */
export function paletteHarmony(hexes: string[]): number {
  const usable = hexes.filter((h) => hexToHsl(h) !== null);
  if (usable.length < 2) return 0.75; // Nada que combinar: ni premio ni castigo.

  let total = 0;
  let pairs = 0;
  for (let i = 0; i < usable.length; i++) {
    for (let j = i + 1; j < usable.length; j++) {
      const a = usable[i];
      const b = usable[j];
      if (a === undefined || b === undefined) continue;
      total += harmonyScore(a, b).score;
      pairs++;
    }
  }
  if (pairs === 0) return 0.75;

  const base = total / pairs;

  // Matices de acento realmente distintos (los neutros no cuentan).
  const accentHues: number[] = [];
  for (const hex of usable) {
    const hsl = hexToHsl(hex);
    if (!hsl || isNeutralHsl(hsl)) continue;
    if (!accentHues.some((h) => hueDistance(h, hsl.h) < 25)) accentHues.push(hsl.h);
  }

  const excess = Math.max(0, accentHues.length - 2);
  return Math.max(0, Math.min(1, base - excess * 0.18));
}
