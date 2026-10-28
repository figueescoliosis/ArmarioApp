"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { CategoryFilter } from "@/components/wardrobe/CategoryFilter";
import { GarmentGrid } from "@/components/wardrobe/GarmentGrid";
import { GarmentSheet } from "@/components/wardrobe/GarmentSheet";
import { Button } from "@/components/ui/Button";
import { Cabecera } from "@/components/ui/Cabecera";
import { Chip } from "@/components/ui/Chip";
import { deleteGarment, fetchGarments, fetchOwners, logWear, updateGarment } from "@/lib/client-api";
import { CATEGORIES, type Category, type Garment, type OwnersInfo } from "@/lib/types";

export default function ArmarioPage() {
  const [garments, setGarments] = useState<Garment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Category | "all">("all");
  const [showArchived, setShowArchived] = useState(false);
  const [detail, setDetail] = useState<Garment | null>(null);
  const [owners, setOwners] = useState<OwnersInfo | null>(null);
  // El armario del otro se mira, no se toca: sin añadir, archivar ni borrar.
  const [partnerView, setPartnerView] = useState(false);

  useEffect(() => {
    // Si falla, la página sigue siendo el armario propio de siempre.
    fetchOwners().then(setOwners, () => undefined);
  }, []);

  const load = useCallback((archived: boolean, partner: boolean) => {
    // La API con `archived=true` devuelve todas mezcladas: la papelera se
    // queda solo con las archivadas y el armario con el resto.
    return fetchGarments({ archived, owner: partner ? "partner" : "me" })
      .then((data) => setGarments(archived ? data.filter((g) => g.archived) : data))
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "No se pudo cargar el armario.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void load(showArchived, partnerView);
  }, [load, showArchived, partnerView]);

  const counts = useMemo(() => {
    const result = { all: garments.length } as Record<Category | "all", number>;
    for (const category of CATEGORIES) {
      result[category] = garments.filter((g) => g.category === category).length;
    }
    return result;
  }, [garments]);

  const visible = filter === "all" ? garments : garments.filter((g) => g.category === filter);

  function switchOwner(partner: boolean) {
    if (partner === partnerView) return;
    setFilter("all");
    setShowArchived(false);
    setLoading(true);
    setPartnerView(partner);
  }

  /** Archivar o restaurar: la prenda cambia de lista, así que sale de esta. */
  async function archive(garment: Garment, archived: boolean) {
    await updateGarment(garment.id, { archived });
    setGarments((current) => current.filter((g) => g.id !== garment.id));
  }

  async function remove(garment: Garment) {
    await deleteGarment(garment.id);
    setGarments((current) => current.filter((g) => g.id !== garment.id));
  }

  return (
    <div className="space-y-6">
      <Cabecera
        adorno="armario"
        titulo={
          partnerView
            ? `Armario de ${owners?.partner?.name ?? "tu pareja"}`
            : showArchived
              ? "Archivadas"
              : "Mi armario"
        }
        subtitulo={
          loading
            ? "Cargando…"
            : garments.length === 0
              ? showArchived
                ? "No has archivado nada."
                : "Todavía no hay prendas."
              : "Ordenado por lo último que añadiste"
        }
        {...(garments.length > 0
          ? {
              contador: `${garments.length} ${garments.length === 1 ? "prenda" : "prendas"}`,
            }
          : {})}
        accion={
          partnerView ? undefined : (
            <Link href="/subir">
              <Button>Añadir</Button>
            </Link>
          )
        }
      />

      {error !== null && (
        <p role="alert" className="rounded-[20px] border-[1.5px] border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {owners?.partner && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="De quién es el armario">
          <Chip label="Mío" selected={!partnerView} onClick={() => switchOwner(false)} />
          <Chip
            label={`De ${owners.partner.name}`}
            selected={partnerView}
            onClick={() => switchOwner(true)}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {garments.length > 0 && (
          <CategoryFilter value={filter} counts={counts} onChange={setFilter} />
        )}
        {!partnerView && (
          <Chip
            label={showArchived ? "Ver armario" : "Archivadas"}
            selected={showArchived}
            onClick={() => {
              setFilter("all");
              setLoading(true);
              setShowArchived((prev) => !prev);
            }}
          />
        )}
      </div>

      <GarmentGrid
        garments={visible}
        loading={loading}
        onSelect={setDetail}
        adornos={{ 0: "a", 2: "c" }}
        emptyMessage={
          partnerView && garments.length === 0
            ? `${owners?.partner?.name ?? "Tu pareja"} todavía no ha subido prendas.`
            : showArchived
            ? "Aquí aparecen las prendas que archives."
            : garments.length === 0
              ? "Haz una foto a tu primera prenda y empieza a llenar el armario."
              : "No hay prendas en esta categoría."
        }
      />

      <GarmentSheet
        garment={detail}
        onClose={() => setDetail(null)}
        onWear={(garment) => logWear(garment.id)}
        {...(partnerView ? {} : { onArchive: archive, onDelete: remove })}
      />
    </div>
  );
}
