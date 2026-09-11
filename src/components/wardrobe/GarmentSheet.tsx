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
import { FORMALITY, type Category, type Garment } from "@/lib/types";

const CATEGORY_LABELS: Record<Category, string> = {
  top: "Arriba",
  bottom: "Abajo",
  dress: "Vestido",
  outerwear: "Abrigo",
  shoes: "Calzado",
  accessory: "Accesorio",
};

const TONOS = {
  rosa: "bg-clay-50 text-clay-700",
  celeste: "bg-sky-50 text-sky-700",
  lila: "bg-lilac-50 text-lilac-700",
  crema: "bg-amber-50 text-ink-soft",
} as const;

function Etiqueta({
  tono,
  children,
}: {
  tono: keyof typeof TONOS;
  children: React.ReactNode;
}) {
  return <span className={`rounded-full px-3 py-2 ${TONOS[tono]}`}>{children}</span>;
}

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
      className="fixed bottom-0 left-0 right-0 top-auto m-0 max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-[30px] bg-surface p-0 shadow-[var(--sombra-hoja)]"
    >
      {garment !== null && (
        <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-5 pb-6 pt-3.5">
          {/* Agarradera: la pista de que la hoja se puede cerrar. */}
          <div aria-hidden="true" className="mx-auto h-[5px] w-[46px] rounded-full bg-clay-200" />
          <div
            className="relative aspect-square w-full overflow-hidden rounded-3xl p-3"
            style={{ backgroundColor: `color-mix(in srgb, ${garment.primaryHex} 10%, var(--color-clay-50))` }}
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
            <h2 className="titulo text-2xl">{garment.subcategory}</h2>
            <p className="mt-0.5 text-xs font-medium text-neutral-500">
              Añadida el {new Date(garment.createdAt).toLocaleDateString("es-ES", {
                day: "numeric",
                month: "long",
              })}
            </p>
          </div>

          {/* Las etiquetas van por familias de color, como en el diseño. */}
          <div className="flex flex-wrap gap-[7px] text-xs font-semibold">
            <Etiqueta tono="rosa">{CATEGORY_LABELS[garment.category]}</Etiqueta>
            <Etiqueta tono="celeste">{`${FORMALITY[garment.formality]} · ${garment.formality}`}</Etiqueta>
            {garment.material !== null && <Etiqueta tono="lila">{garment.material}</Etiqueta>}
            {garment.seasons.map((season) => (
              <Etiqueta key={season} tono="crema">
                {season}
              </Etiqueta>
            ))}
            {garment.styleTags.map((tag) => (
              <Etiqueta key={tag} tono="lila">
                {tag}
              </Etiqueta>
            ))}
          </div>

          {error !== null && (
            <p role="alert" className="rounded-[20px] border-[1.5px] border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
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
              variant="danger"
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
              <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full bg-red-500" />
              {confirming ? "¿Seguro? Toca otra vez" : "Eliminar para siempre"}
            </Button>

            <Button variant="ghost" size="lg" disabled={busy} onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      )}
    </dialog>
  );
}
