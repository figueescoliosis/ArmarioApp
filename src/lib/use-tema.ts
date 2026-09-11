"use client";

import { useSyncExternalStore } from "react";
import { guardarTema, leerTema, TEMA_POR_DEFECTO, type Tema } from "@/lib/tema";

// Se cachea el valor leído: `getSnapshot` tiene que devolver el mismo
// objeto mientras nada cambie, o React entra en bucle de re-render.
let cache: Tema | null = null;
const oyentes = new Set<() => void>();

function instantanea(): Tema {
  cache ??= leerTema();
  return cache;
}

function enElServidor(): Tema {
  return TEMA_POR_DEFECTO;
}

function suscribir(avisar: () => void): () => void {
  oyentes.add(avisar);
  return () => {
    oyentes.delete(avisar);
  };
}

export function useTema(): Tema {
  return useSyncExternalStore(suscribir, instantanea, enElServidor);
}

export function cambiarTema(tema: Tema): void {
  guardarTema(tema);

  // Solo la ausencia del atributo deja actuar a `prefers-color-scheme`.
  if (typeof document !== "undefined") {
    if (tema === "sistema") {
      delete document.documentElement.dataset.tema;
    } else {
      document.documentElement.dataset.tema = tema;
    }
  }

  cache = tema;
  oyentes.forEach((avisar) => avisar());
}
