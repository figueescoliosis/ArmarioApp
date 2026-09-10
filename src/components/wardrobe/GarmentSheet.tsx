"use client";

/**
 * Ficha de una prenda, con las dos formas de quitarla del armario.
 *
 * Archivar es reversible y solo la esconde del armario y del generador;
 * eliminar borra la fila y las tres imágenes del almacenamiento. Por eso lo
 * segundo pide un segundo toque en el propio botón: es más barato de escribir
 * que un diálogo de confirmación y no bloquea la página como `confirm()`.
 */

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { FORMALITY, type Garment } from "@/lib/types";

export interface GarmentSheetProps {
  garment: Garment | null;
  onClose: () => void;
  onArchive: (garment: Garment, archived: boolean) => Promise<void>;
  onDelete: (garment: Garment) => Promise<void>;
}

export function GarmentSheet({ garment, onClose, onArchive, onDelete }: GarmentSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (garment !== null && !dialog.open) dialog.showModal();
    if (garment === null && dialog.open) dialog.close();
    // Cada prenda empieza con el borrado sin confirmar.
    setConfirming(false);
    setError(null);
  }, [garment]);

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await task();
      // `close()` dispara `onClose`, que es quien avisa al armario. Cerrar el
      // diálogo aquí evita el frame en el que el backdrop sigue tapando todo.
      dialogRef.current?.close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo completar la acción.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="m-auto w-[92vw] max-w-md rounded-2xl border border-line bg-bone p-4 backdrop:bg-black/40"
    >
      {garment !== null && (
        <div className="flex flex-col gap-4">
          <div
            className="relative aspect-square w-full overflow-hidden rounded-xl"
            style={{ backgroundColor: `color-mix(in srgb, ${garment.primaryHex} 16%, var(--color-bone))` }}
          >
            <Image
              src={garment.cutoutUrl}
              alt={garment.subcategory || "Prenda"}
              fill
              sizes="(min-width: 640px) 28rem, 92vw"
              className="object-contain p-4"
            />
          </div>

          <div>
            <h2 className="text-lg font-semibold">{garment.subcategory}</h2>
            <p className="text-sm text-neutral-500">
              {FORMALITY[garment.formality]}
              {garment.material !== null ? ` · ${garment.material}` : ""}
              {garment.seasons.length > 0 ? ` · ${garment.seasons.join(", ")}` : ""}
            </p>
          </div>

          {garment.styleTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {garment.styleTags.map((tag) => (
                <Chip key={tag} label={tag} />
              ))}
            </div>
          )}

          {error !== null && (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Button
              variant="secondary"
              size="lg"
              disabled={busy}
              onClick={() => void run(() => onArchive(garment, !garment.archived))}
            >
              {garment.archived ? "Restaurar al armario" : "Archivar"}
            </Button>

            <Button
              variant="secondary"
              size="lg"
              disabled={busy}
              onClick={() => {
                if (!confirming) {
                  setConfirming(true);
                  return;
                }
                void run(() => onDelete(garment));
              }}
            >
              {confirming ? "¿Seguro? Toca otra vez para borrarla" : "Eliminar para siempre"}
            </Button>

            <Button variant="ghost" size="md" disabled={busy} onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      )}
    </dialog>
  );
}
