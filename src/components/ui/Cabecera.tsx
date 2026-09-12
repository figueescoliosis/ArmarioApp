import type { ReactNode } from "react";
import Link from "next/link";

/**
 * La cabecera de pantalla del diseño: bloque blanco a sangre con la cinta de
 * vichy arriba, el titular en la manuscrita y la cinta de encaje abajo.
 * `accion` es el hueco de la derecha (el "Añadir" del armario, el "Vaciar"
 * del probador). El icono de ajustes va siempre: es la única entrada a esa
 * pantalla.
 */
const ADORNOS = {
  armario: "adorno-cabecera-armario",
  subir: "adorno-cabecera-subir",
  etiquetas: "adorno-cabecera-etiquetas",
  probador: "adorno-cabecera-probador",
  mismatch: "adorno-cabecera-mismatch",
  conjuntos: "adorno-cabecera-conjuntos",
  favoritos: "adorno-cabecera-favoritos",
} as const;

export function Cabecera({
  titulo,
  subtitulo,
  accion,
  contador,
  adorno,
}: {
  titulo: string;
  subtitulo?: string;
  accion?: ReactNode;
  /** Píldora opcional a la derecha del título (p. ej. "12 prendas"). */
  contador?: string;
  /** El recorte de esquina del diseño para esta pantalla, si tiene uno. */
  adorno?: keyof typeof ADORNOS;
}) {
  return (
    <header className="relative z-[3] -mx-4 bg-surface">
      <div className="cinta-vichy" />
      <div className="flex items-end justify-between gap-3 px-[18px] pb-3 pt-3.5">
        <div>
          <h1 className="titulo text-[44px]">{titulo}</h1>
          {subtitulo !== undefined && (
            <p className="text-xs font-medium text-ink-soft">{subtitulo}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {contador !== undefined && (
            <span className="whitespace-nowrap rounded-full bg-clay-500 px-3 py-2 text-[11px] font-bold text-cream">
              {contador}
            </span>
          )}
          {accion}
          <Link
            href="/ajustes"
            aria-label="Ajustes"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
          >
            <svg
              aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </Link>
        </div>
      </div>
      <div className="cinta-encaje" />
      {adorno !== undefined && <div aria-hidden="true" className={ADORNOS[adorno]} />}
    </header>
  );
}
