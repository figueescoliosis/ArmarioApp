"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { CategoryFilter } from "@/components/wardrobe/CategoryFilter";
import { GarmentGrid } from "@/components/wardrobe/GarmentGrid";
import { Button } from "@/components/ui/Button";
import { fetchGarments } from "@/lib/client-api";
import { CATEGORIES, type Category, type Garment } from "@/lib/types";

export default function ArmarioPage() {
  const [garments, setGarments] = useState<Garment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Category | "all">("all");

  useEffect(() => {
    let active = true;
    fetchGarments()
      .then((data) => {
        if (active) setGarments(data);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "No se pudo cargar el armario.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    // Evita escribir estado si el usuario navega antes de que responda la API.
    return () => {
      active = false;
    };
  }, []);

  const counts = useMemo(() => {
    const result = { all: garments.length } as Record<Category | "all", number>;
    for (const category of CATEGORIES) {
      result[category] = garments.filter((g) => g.category === category).length;
    }
    return result;
  }, [garments]);

  const visible = filter === "all" ? garments : garments.filter((g) => g.category === filter);

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mi armario</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {garments.length === 0
              ? "Todavía no hay prendas."
              : `${garments.length} ${garments.length === 1 ? "prenda" : "prendas"}`}
          </p>
        </div>
        <Link href="/subir">
          <Button>Añadir</Button>
        </Link>
      </header>

      {error !== null && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {error}
        </p>
      )}

      {garments.length > 0 && (
        <CategoryFilter value={filter} counts={counts} onChange={setFilter} />
      )}

      <GarmentGrid
        garments={visible}
        loading={loading}
        emptyMessage={
          garments.length === 0
            ? "Haz una foto a tu primera prenda y empieza a llenar el armario."
            : "No hay prendas en esta categoría."
        }
      />
    </div>
  );
}
