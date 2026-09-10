/**
 * Utilidades compartidas por todos los Route Handlers.
 *
 * Toda respuesta de `/api/*` sale con la misma forma (`ApiResponse<T>`), de modo
 * que la interfaz solo tiene que mirar `ok`. Los errores se traducen aquí una
 * sola vez, en lugar de repetir bloques try/catch en cada endpoint.
 */

import { NextResponse } from "next/server";
import type { ApiError, ApiErrorCode, ApiResponse } from "@/lib/types";
import { MissingConfigError, ServiceError } from "@/lib/errors";

export function ok<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(
  code: ApiErrorCode,
  message: string,
  status?: number,
  missingEnvVar?: string,
): NextResponse<ApiResponse<never>> {
  const error: ApiError = missingEnvVar ? { code, message, missingEnvVar } : { code, message };
  return NextResponse.json({ ok: false, error }, { status: status ?? statusFor(code) });
}

function statusFor(code: ApiErrorCode): number {
  switch (code) {
    case "BAD_REQUEST":
      return 400;
    case "NOT_FOUND":
      return 404;
    case "UNSUPPORTED_MEDIA_TYPE":
      return 415;
    case "IMAGE_TOO_LARGE":
      return 413;
    case "MISSING_CONFIG":
      // 503: no es culpa de la petición, es que al servidor le falta una clave.
      return 503;
    default:
      return 500;
  }
}

/**
 * Envuelve un handler y traduce cualquier excepción a `ApiResponse`.
 *
 * Los errores de configuración se distinguen del resto a propósito: son los
 * únicos que el usuario puede resolver por su cuenta, y la interfaz los muestra
 * con el nombre de la variable que falta.
 */
export async function handle<T>(
  fn: () => Promise<NextResponse<ApiResponse<T>>>,
): Promise<NextResponse<ApiResponse<T>> | NextResponse<ApiResponse<never>>> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof MissingConfigError) {
      return fail("MISSING_CONFIG", error.message, undefined, error.missingEnvVar);
    }
    if (error instanceof ServiceError) {
      return fail(error.code, error.message);
    }

    console.error("[api] error no controlado:", error);
    return fail(
      "INTERNAL",
      error instanceof Error ? error.message : "Error interno del servidor.",
    );
  }
}
