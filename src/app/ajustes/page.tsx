"use client";

import { Cabecera } from "@/components/ui/Cabecera";
import { cambiarTema, useTema } from "@/lib/use-tema";
import type { Tema } from "@/lib/tema";

const OPCIONES: { valor: Tema; etiqueta: string; descripcion: string }[] = [
  { valor: "claro", etiqueta: "Hada", descripcion: "Verde tierno, encaje rosa y mariposas" },
  { valor: "oscuro", etiqueta: "Coqueta", descripcion: "Rosa oscuro, lazos de lunares y lacre" },
  { valor: "sistema", etiqueta: "Como el móvil", descripcion: "Sigue lo que tengas puesto en el teléfono" },
];

export default function AjustesPage() {
  const tema = useTema();

  return (
    <div className="space-y-6">
      <Cabecera titulo="Ajustes" subtitulo="Elige cómo se viste la app" />

      <div className="flex flex-col gap-3">
        {OPCIONES.map((opcion) => {
          const seleccionada = tema === opcion.valor;
          return (
            <button
              key={opcion.valor}
              type="button"
              aria-pressed={seleccionada}
              onClick={() => cambiarTema(opcion.valor)}
              className={`w-full min-h-14 rounded-[20px] border-[1.5px] bg-surface px-4 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500 ${
                seleccionada ? "border-clay-500" : "border-clay-200"
              }`}
            >
              <p className="font-bold text-ink">{opcion.etiqueta}</p>
              <p className="text-xs text-ink-soft">{opcion.descripcion}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
