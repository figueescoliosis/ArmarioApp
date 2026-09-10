"use client";

/**
 * Probador: el conjunto lo montas tú.
 *
 * Todo el armario se carga una sola vez al entrar, así que **cada cambio de
 * prenda se puntúa en el navegador**, sin una petición de red por medio. Es lo
 * que permite que la alerta de desajuste salga en el mismo instante en que
 * eliges la prenda que no pega. La opinión del modelo es aparte y va a botón,
 * porque esa sí cuesta segundos y cuota.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { MannequinGrid } from "@/components/outfits/MannequinGrid";
import { ScoreRing } from "@/components/outfits/ScoreRing";
import { GarmentGrid } from "@/components/wardrobe/GarmentGrid";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  critiqueLook,
  fetchGarments,
  fetchWearLog,
  logWear,
  saveFavorite,
} from "@/lib/client-api";
import { evaluateLook } from "@/lib/outfits/score";
import type { Garment, OutfitItem, Slot } from "@/lib/types";

type Look = Partial<Record<Slot, Garment>>;

/** Huecos que se vacían al elegir otro: un vestido ya cubre arriba y abajo. */
const EXCLUSIVE: Partial<Record<Slot, Slot[]>> = {
  dress: ["top", "bottom"],
  top: ["dress"],
  bottom: ["dress"],
};

export default function ProbadorPage() {
  const [garments, setGarments] = useState<Garment[]>([]);
  const [lastWorn, setLastWorn] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [look, setLook] = useState<Look>({});
  const [picking, setPicking] = useState<Slot | null>(null);
  const [critique, setCritique] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "critica" | "favorito" | "puesto">(null);
  const [done, setDone] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let active = true;
    Promise.all([fetchGarments(), fetchWearLog()])
      .then(([wardrobe, wear]) => {
        if (!active) return;
        setGarments(wardrobe);
        setLastWorn(new Map(Object.entries(wear)));
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "No se pudo cargar el armario.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // `showModal()` da foco atrapado, Escape y fondo modal sin escribir nada.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (picking !== null && !dialog.open) dialog.showModal();
    if (picking === null && dialog.open) dialog.close();
  }, [picking]);

  const items: OutfitItem[] = useMemo(
    () =>
      (Object.entries(look) as Array<[Slot, Garment | undefined]>)
        .filter((entry): entry is [Slot, Garment] => entry[1] !== undefined)
        .map(([slot, garment]) => ({ garment, slot })),
    [look],
  );

  const evaluation = useMemo(
    () => evaluateLook(items.map((item) => item.garment), { lastWorn }),
    [items, lastWorn],
  );

  const graves = evaluation.issues.filter((issue) => issue.severity === "grave");
  const leves = evaluation.issues.filter((issue) => issue.severity === "leve");

  function choose(slot: Slot, garment: Garment | null) {
    // Cerrar aquí y no en el efecto: si se espera al siguiente render, durante
    // un frame el backdrop del modal sigue puesto y se come el toque que el
    // usuario da en el hueco siguiente.
    dialogRef.current?.close();
    setCritique(null);
    setDone(null);
    setLook((current) => {
      const next = { ...current };
      if (garment === null) delete next[slot];
      else next[slot] = garment;
      for (const other of EXCLUSIVE[slot] ?? []) delete next[other];
      return next;
    });
    setPicking(null);
  }

  async function run(action: NonNullable<typeof busy>, task: () => Promise<string | null>) {
    setBusy(action);
    setError(null);
    try {
      setDone(await task());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo completar la acción.");
    } finally {
      setBusy(null);
    }
  }

  const ids = items.map((item) => item.garment.id);
  const enoughPieces = items.length >= 2;

  if (!loading && garments.length === 0) {
    return (
      <div className="space-y-6">
        <Header />
        <EmptyState message="El probador necesita prendas. Sube unas cuantas y vuelve." />
        <Link href="/subir">
          <Button>Añadir prendas</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header />

      {error !== null && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {error}
        </p>
      )}

      <section className="flex items-start gap-4 rounded-3xl border border-neutral-200 bg-surface p-4 shadow-sm">
        <MannequinGrid items={items} onSlotClick={setPicking} />
        {/* El hueco del anillo se reserva siempre: si apareciera y desapareciera,
            el maniquí se estrecharía y los huecos se moverían bajo el dedo justo
            cuando el usuario va a tocar el siguiente.
            Con un desajuste grave el porcentaje no significa nada — el motor ni
            siquiera propondría ese conjunto — así que manda la alerta, no el número. */}
        <div className="w-16 shrink-0">
          {enoughPieces && graves.length === 0 && (
            <ScoreRing
              percent={Math.round(evaluation.score * 100)}
              tone={leves.length > 0 ? "aviso" : "bien"}
            />
          )}
        </div>
      </section>

      {!enoughPieces ? (
        <p className="text-sm text-neutral-500">
          Toca un hueco para elegir prenda. Con dos ya te digo si pega.
        </p>
      ) : graves.length > 0 ? (
        <Alerta
          tono="mal"
          titulo="Mis-match"
          mensajes={graves.map((issue) => issue.message)}
          extra={leves.map((issue) => issue.message)}
        />
      ) : leves.length > 0 ? (
        <Alerta tono="aviso" titulo="Casi" mensajes={leves.map((issue) => issue.message)} />
      ) : (
        <blockquote className="border-l-4 border-clay-300 pl-3 text-sm italic text-ink-soft">
          “{critique ?? evaluation.rationale}”
        </blockquote>
      )}

      {critique !== null && evaluation.issues.length > 0 && (
        <blockquote className="border-l-4 border-clay-300 pl-3 text-sm italic text-ink-soft">
          “{critique}”
        </blockquote>
      )}

      {done !== null && <p className="text-sm text-clay-500">{done}</p>}

      <div className="flex flex-col gap-2">
        <Button
          variant="secondary"
          size="lg"
          disabled={!enoughPieces || busy !== null}
          onClick={() =>
            void run("critica", async () => {
              const outfit = await critiqueLook(ids);
              setCritique(outfit.rationale);
              return outfit.source === "rules+llm"
                ? null
                : "El modelo no ha contestado; te dejo el veredicto de las reglas.";
            })
          }
        >
          {busy === "critica" ? "Preguntando…" : "¿Qué opina Cher?"}
        </Button>

        <Button
          variant="secondary"
          size="lg"
          disabled={!enoughPieces || busy !== null}
          onClick={() =>
            void run("favorito", async () => {
              await saveFavorite({
                id: ids.join("-"), // El servidor recalcula la firma; este id da igual.
                name: null,
                items,
                score: evaluation.score,
                breakdown: evaluation.breakdown,
                rationale: critique ?? evaluation.rationale,
                source: critique === null ? "rules" : "rules+llm",
                isFavorite: true,
                createdAt: new Date().toISOString(),
              });
              return "Guardado en favoritos.";
            })
          }
        >
          Guardar en favoritos
        </Button>

        <Button
          size="lg"
          disabled={!enoughPieces || busy !== null}
          onClick={() =>
            void run("puesto", async () => {
              await Promise.allSettled(ids.map((id) => logWear(id)));
              return "Anotado. Estas prendas bajan de frescura.";
            })
          }
        >
          Me lo pongo hoy
        </Button>
      </div>

      <dialog
        ref={dialogRef}
        onClose={() => setPicking(null)}
        className="m-auto w-[92vw] max-w-2xl rounded-2xl border border-line bg-bone p-4 backdrop:bg-black/40"
      >
        {picking !== null && (
          <>
            <div className="mb-3 flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold">Elige prenda</h2>
              <div className="flex gap-2">
                {look[picking] !== undefined && (
                  <Button variant="ghost" onClick={() => choose(picking, null)}>
                    Quitar
                  </Button>
                )}
                <Button variant="ghost" onClick={() => setPicking(null)}>
                  Cerrar
                </Button>
              </div>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              <GarmentGrid
                garments={garments.filter((garment) => garment.category === picking)}
                onSelect={(garment) => choose(picking, garment)}
                selectedIds={[look[picking]?.id ?? ""]}
                emptyMessage="No tienes nada en esta categoría todavía."
              />
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}

function Header() {
  return (
    <header>
      <h1 className="text-2xl font-semibold tracking-tight">Probador</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Monta el look tú misma y te aviso si algo no pega.
      </p>
    </header>
  );
}

function Alerta({
  tono,
  titulo,
  mensajes,
  extra = [],
}: {
  tono: "mal" | "aviso";
  titulo: string;
  mensajes: string[];
  extra?: string[];
}) {
  const clase =
    tono === "mal"
      ? "border-red-200 bg-red-50 text-red-900"
      : "border-amber-200 bg-amber-50 text-amber-900";

  return (
    <div role="alert" className={`rounded-xl border p-4 text-sm ${clase}`}>
      <p className="font-semibold">{titulo}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        {[...mensajes, ...extra].map((mensaje, index) => (
          <li key={index}>{mensaje}</li>
        ))}
      </ul>
    </div>
  );
}
