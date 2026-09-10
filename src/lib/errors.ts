import type { ApiErrorCode } from "@/lib/types";

/**
 * Falta una variable de entorno. Es el único error que la interfaz trata de
 * forma especial: en vez de un "algo ha fallado" genérico, puede decir
 * exactamente qué clave hay que dar de alta y enlazar al documento de setup.
 */
export class MissingConfigError extends Error {
  readonly missingEnvVar: string;

  constructor(missingEnvVar: string, hint?: string) {
    super(
      `Falta la variable de entorno "${missingEnvVar}".` +
        (hint ? ` ${hint}` : " Revisa docs/SETUP-APIS.md."),
    );
    this.name = "MissingConfigError";
    this.missingEnvVar = missingEnvVar;
  }
}

/** Fallo de un servicio externo, con el código que debe viajar al cliente. */
export class ServiceError extends Error {
  readonly code: ApiErrorCode;
  readonly cause?: unknown;

  constructor(code: ApiErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Lee una variable de entorno obligatoria.
 * Lanza `MissingConfigError` en vez de devolver `undefined` para que el fallo
 * ocurra en el punto exacto donde falta la configuración, con su nombre.
 */
export function requireEnv(name: string, hint?: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    throw new MissingConfigError(name, hint);
  }
  return value;
}
