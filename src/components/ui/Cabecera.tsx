import type { ReactNode } from "react";
import { Lazo } from "./Lazo";

/**
 * La cabecera de pantalla del diseño: lazo, titular en Baloo rosa oscuro y una
 * línea pequeña debajo. `accion` es el hueco de la derecha (el "Añadir" del
 * armario, el "Vaciar" del probador).
 */
export function Cabecera({
  titulo,
  subtitulo,
  accion,
}: {
  titulo: string;
  subtitulo?: string;
  accion?: ReactNode;
}) {
  return (
    <header>
      <Lazo />
      <div className="mt-1.5 flex items-center justify-between gap-4">
        <div>
          <h1 className="titulo text-[28px]">{titulo}</h1>
          {subtitulo !== undefined && (
            <p className="mt-0.5 text-xs font-medium text-neutral-500">{subtitulo}</p>
          )}
        </div>
        {accion}
      </div>
    </header>
  );
}
