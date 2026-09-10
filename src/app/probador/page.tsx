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
import { Cabecera } from "@/components/ui/Cabecera";
import { Lazo } from "@/components/ui/Lazo";
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
    <div className="space-y-4">
      <Header {...(items.length > 0 ? { onVaciar: () => setLook({}) } : {})} />

      {error !== null && (
        <p role="alert" className="rounded-[20px] border-[1.5px] border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <section className="flex items-start gap-3 rounded-[28px] bg-surface p-[13px] shadow-[0_12px_30px_rgb(247_168_196_/_0.24)]">
        <MannequinGrid items={items} onSlotClick={setPicking} alerta={graves.length > 0} />
        {/* El hueco del anillo se reserva siempre: si apareciera y desapareciera,
            el maniquí se estrecharía y los huecos se moverían bajo el dedo justo
            cuando el usuario va a tocar el siguiente.
            Con un desajuste grave el porcentaje no significa nada — el motor ni
            siquiera propondría ese conjunto — así que manda la alerta, no el número. */}
        <div className="w-[100px] shrink-0">
          {enoughPieces && graves.length === 0 && (
            <ScoreRing
              percent={Math.round(evaluation.score * 100)}
              tone={leves.length > 0 ? "aviso" : "bien"}
            />
          )}
        </div>
      </section>

      {!enoughPieces ? (
        <p className="text-sm font-medium text-neutral-500">
          Toca un hueco para elegir prenda. Con dos ya te digo si pega.
        </p>
      ) : graves.length > 0 ? (
        <Alerta
          tono="mal"
          titulo="Mis-match"
          subtitulo="Así no, mejor cambia una prenda"
          mensajes={graves.map((issue) => issue.message)}
          extra={leves.map((issue) => issue.message)}
        />
      ) : leves.length > 0 ? (
        <Alerta
          tono="aviso"
          titulo="Casi"
          subtitulo="Funciona, pero hay un detalle"
          mensajes={leves.map((issue) => issue.message)}
        />
      ) : (
        <Cita texto={critique ?? evaluation.rationale} deIA={critique !== null} />
      )}

      {critique !== null && evaluation.issues.length > 0 && (
        <Cita texto={critique} deIA />
      )}

      {done !== null && <p className="text-sm font-semibold text-clay-700">{done}</p>}

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
        className="m-auto w-[92vw] max-w-2xl rounded-[28px] bg-bone p-4 shadow-[0_12px_30px_rgb(247_168_196_/_0.3)]"
      >
        {picking !== null && (
          <>
            <div className="mb-3 flex items-center justify-between gap-4">
              <h2 className="titulo text-[22px]">Elige prenda</h2>
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

function Header({ onVaciar }: { onVaciar?: () => void }) {
  return (
    <Cabecera
      titulo="Probador"
      subtitulo="Toca un hueco para elegir prenda"
      accion={
        onVaciar && (
          <button
            type="button"
            onClick={onVaciar}
            className="flex h-9 items-center rounded-full border-[1.5px] border-clay-200 bg-surface px-3 text-xs font-bold text-clay-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
          >
            Vaciar
          </button>
        )
      }
    />
  );
}

/** La frase del estilista, en la tarjeta crema del diseño. */
function Cita({ texto, deIA }: { texto: string; deIA: boolean }) {
  return (
    <div className="rounded-[20px] bg-amber-50 p-3">
      <p className="text-xs italic leading-relaxed text-amber-900">«{texto}»</p>
      <p className="mt-2 text-[10px] font-bold tracking-[0.6px] text-ink-soft">
        — CHER, {deIA ? "REGLAS + IA" : "REGLAS"}
      </p>
    </div>
  );
}

function Alerta({
  tono,
  titulo,
  subtitulo,
  mensajes,
  extra = [],
}: {
  tono: "mal" | "aviso";
  titulo: string;
  subtitulo: string;
  mensajes: string[];
  extra?: string[];
}) {
  const mal = tono === "mal";

  return (
    <div
      role="alert"
      className={`flex items-start gap-3.5 rounded-3xl border-[1.5px] p-3.5 ${
        mal ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
      }`}
    >
      <Lazo size={22} tone={mal ? "triste" : "rosa"} className="mt-1 flex-none" />
      <div className="flex-1">
        <p className={`titulo text-xl ${mal ? "text-red-700" : "text-amber-900"}`}>{titulo}</p>
        <p className="mt-0.5 text-xs font-medium text-neutral-500">{subtitulo}</p>
        <ul className="mt-2.5 flex flex-col gap-1.5">
          {[...mensajes, ...extra].map((mensaje, index) => (
            <li key={index} className="flex items-start gap-2">
              <span
                aria-hidden="true"
                className={`mt-1.5 h-1.5 w-1.5 flex-none rounded-full ${
                  mal ? "bg-red-500" : "bg-amber-500"
                }`}
              />
              <span className="text-xs font-semibold leading-relaxed text-ink">{mensaje}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
