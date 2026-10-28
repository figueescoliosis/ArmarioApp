"use client";

/**
 * Subida de varias prendas a la vez.
 *
 * Analiza de dos en dos (recortar y etiquetar tarda segundos y gasta cuota:
 * mandar veinte a la vez solo consigue que fallen por límite) y deja revisar
 * cada una antes de guardarlas todas. Sin encuadre: para eso está la subida
 * de una en una.
 */

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

import { TagReview } from "@/components/upload/TagReview";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { analyzeGarment, createGarment } from "@/lib/client-api";
import { prepareImage } from "@/lib/image/prepare";
import type { AnalyzeGarmentResult, GarmentAttributes } from "@/lib/types";

/** Más de esto es una tarde entera de cuota; mejor en varias tandas. */
export const MAX_BATCH = 20;
const CONCURRENCY = 2;

interface Item {
  file: File;
  status: "pendiente" | "analizando" | "lista" | "error" | "guardando" | "guardada";
  analysis?: AnalyzeGarmentResult;
  /** Lo revisado a mano; sin revisar se guarda lo que dedujo la IA. */
  attributes?: GarmentAttributes;
  error?: string;
}

export interface BatchUploadProps {
  files: File[];
  onDone: () => void;
  onCancel: () => void;
}

export function BatchUpload({ files, onDone, onCancel }: BatchUploadProps) {
  const [items, setItems] = useState<Item[]>(() =>
    files.slice(0, MAX_BATCH).map((file) => ({ file, status: "pendiente" })),
  );
  const [reviewing, setReviewing] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const started = useRef(false);

  function patch(index: number, change: Partial<Item>) {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...change } : item)));
  }

  async function analyzeOne(index: number, file: File) {
    patch(index, { status: "analizando", error: undefined });
    try {
      const prepared = await prepareImage(file, { maxSide: 1600 });
      patch(index, { status: "lista", analysis: await analyzeGarment(prepared.blob) });
    } catch (cause) {
      patch(index, {
        status: "error",
        error: cause instanceof Error ? cause.message : "No se pudo analizar.",
      });
    }
  }

  useEffect(() => {
    // En desarrollo React monta dos veces: sin esto se analizaría todo doble.
    if (started.current) return;
    started.current = true;
    const queue = files.slice(0, MAX_BATCH);
    let next = 0;
    async function worker() {
      while (next < queue.length) {
        const index = next++;
        const file = queue[index];
        if (file !== undefined) await analyzeOne(index, file);
      }
    }
    void Promise.all(Array.from({ length: CONCURRENCY }, worker));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  async function saveAll() {
    setSaving(true);
    for (const [index, item] of items.entries()) {
      if (item.status !== "lista" || item.analysis === undefined) continue;
      patch(index, { status: "guardando" });
      try {
        await createGarment({
          imageUrl: item.analysis.imageUrl,
          cutoutUrl: item.analysis.cutoutUrl,
          thumbUrl: item.analysis.thumbUrl,
          attributes: item.attributes ?? item.analysis.attributes,
        });
        patch(index, { status: "guardada" });
      } catch (cause) {
        patch(index, {
          status: "lista",
          error: cause instanceof Error ? cause.message : "No se pudo guardar.",
        });
      }
    }
    setSaving(false);
  }

  const reviewed = reviewing === null ? undefined : items[reviewing];
  if (reviewing !== null && reviewed?.analysis !== undefined) {
    return (
      <TagReview
        attributes={reviewed.attributes ?? reviewed.analysis.attributes}
        imageUrl={reviewed.analysis.cutoutUrl}
        onConfirm={(attributes) => {
          patch(reviewing, { attributes });
          setReviewing(null);
        }}
        onCancel={() => setReviewing(null)}
      />
    );
  }

  const busy = items.some((item) => item.status === "pendiente" || item.status === "analizando");
  const ready = items.filter((item) => item.status === "lista").length;
  const done = items.length > 0 && items.every((item) => item.status === "guardada");

  return (
    <div className="space-y-4">
      {files.length > MAX_BATCH && (
        <p className="rounded-[20px] bg-amber-50 p-3 text-xs font-semibold text-amber-900">
          Van las {MAX_BATCH} primeras; el resto, en otra tanda.
        </p>
      )}

      <ul className="space-y-2">
        {items.map((item, index) => (
          <li
            key={`${item.file.name}-${index}`}
            className="flex items-center gap-3 rounded-[20px] bg-surface p-2 shadow-[var(--sombra-tarjeta)]"
          >
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-clay-50">
              {item.analysis !== undefined ? (
                <Image
                  src={item.analysis.thumbUrl ?? item.analysis.cutoutUrl}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-contain p-1"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  {item.status === "analizando" && <Spinner className="h-5 w-5" />}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 text-sm">
              <p className="truncate font-bold text-ink">
                {(item.attributes ?? item.analysis?.attributes)?.subcategory ?? item.file.name}
              </p>
              <p className="text-xs font-medium text-neutral-500">
                {item.error ?? STATUS_LABELS[item.status]}
                {item.attributes !== undefined && item.status === "lista" ? " · revisada" : ""}
              </p>
            </div>

            {item.status === "lista" && (
              <Button variant="secondary" disabled={saving} onClick={() => setReviewing(index)}>
                Revisar
              </Button>
            )}
            {item.status === "error" && (
              <Button variant="secondary" onClick={() => void analyzeOne(index, item.file)}>
                Reintentar
              </Button>
            )}
          </li>
        ))}
      </ul>

      {done ? (
        <Button size="lg" className="w-full" onClick={onDone}>
          Ver el armario
        </Button>
      ) : (
        <>
          <Button size="lg" className="w-full" disabled={saving || ready === 0} onClick={() => void saveAll()}>
            {saving
              ? "Guardando…"
              : busy
                ? `Guardar las ${ready} listas (siguen analizándose otras)`
                : `Guardar ${ready === 1 ? "la prenda" : `las ${ready} prendas`}`}
          </Button>
          <Button variant="ghost" size="lg" className="w-full" disabled={saving} onClick={onCancel}>
            Cancelar
          </Button>
        </>
      )}
    </div>
  );
}

const STATUS_LABELS: Record<Item["status"], string> = {
  pendiente: "En cola",
  analizando: "Recortando y etiquetando…",
  lista: "Lista para guardar",
  error: "No se pudo analizar",
  guardando: "Guardando…",
  guardada: "Guardada",
};
