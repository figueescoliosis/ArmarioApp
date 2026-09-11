/**
 * El tema (claro/oscuro/sistema) es una preferencia de pantalla, no un dato
 * del armario: no hay usuarios ni tabla que lo pida, y cada pantalla en la
 * que se abre la app puede querer un tema distinto. Por eso vive en
 * `localStorage` y no en Supabase.
 */

export type Tema = "claro" | "oscuro" | "sistema";

const CLAVE_TEMA = "armario:tema";

export const TEMA_POR_DEFECTO: Tema = "sistema";

const TEMAS_VALIDOS: readonly Tema[] = ["claro", "oscuro", "sistema"];

function esTema(valor: string | null): valor is Tema {
  return valor !== null && (TEMAS_VALIDOS as readonly string[]).includes(valor);
}

/** Nunca lanza: sin `localStorage` (servidor), sin valor o con uno inválido, cae al por defecto. */
export function leerTema(): Tema {
  try {
    const guardado = globalThis.localStorage?.getItem(CLAVE_TEMA) ?? null;
    return esTema(guardado) ? guardado : TEMA_POR_DEFECTO;
  } catch {
    return TEMA_POR_DEFECTO;
  }
}

/** Escritura muda: el almacenamiento puede estar bloqueado o sin cuota y eso no es un error para el usuario. */
export function guardarTema(tema: Tema): void {
  try {
    globalThis.localStorage?.setItem(CLAVE_TEMA, tema);
  } catch {
    // ignorado a propósito
  }
}
