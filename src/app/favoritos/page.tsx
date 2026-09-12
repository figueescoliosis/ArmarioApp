"use client";

import { useEffect, useState } from "react";

import { OutfitDeck } from "@/components/outfits/OutfitDeck";
import { Cabecera } from "@/components/ui/Cabecera";
import { EmptyState } from "@/components/ui/EmptyState";
import { fetchFavorites, logWear, removeFavorite } from "@/lib/client-api";
import type { Outfit } from "@/lib/types";

export default function FavoritosPage() {
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchFavorites()
      .then((data) => {
        if (active) setOutfits(data);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "No se pudieron cargar los favoritos.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function unfavorite(outfit: Outfit) {
    const previous = outfits;
    // Optimista: la lista responde al instante y se revierte solo si falla.
    setOutfits((current) => current.filter((o) => o.id !== outfit.id));
    try {
      await removeFavorite(outfit.id);
    } catch (cause) {
      setOutfits(previous);
      setError(cause instanceof Error ? cause.message : "No se pudo quitar el favorito.");
    }
  }

  return (
    <div className="space-y-6">
      <Cabecera adorno="favoritos" titulo="Favoritos" subtitulo="Los conjuntos que has guardado." />

      {error !== null && (
        <p role="alert" className="rounded-[20px] border-[1.5px] border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {!loading && outfits.length === 0 ? (
        <EmptyState
          title="Aún no hay favoritos"
          message="Genera conjuntos y guarda con el corazón los que te convenzan."
        />
      ) : (
        <OutfitDeck
          outfits={outfits}
          loading={loading}
          mostrarSello
          onToggleFavorite={(outfit) => void unfavorite(outfit)}
          onWear={(outfit) => {
            void Promise.allSettled(outfit.items.map((item) => logWear(item.garment.id)));
          }}
        />
      )}
    </div>
  );
}
