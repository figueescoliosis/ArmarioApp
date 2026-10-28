"use client";

import { useEffect, useState } from "react";

import { CoupleCard } from "@/components/outfits/CoupleCard";
import { OutfitDeck } from "@/components/outfits/OutfitDeck";
import { Cabecera } from "@/components/ui/Cabecera";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  fetchCoupleFavorites,
  fetchFavorites,
  fetchOwners,
  logWear,
  removeCoupleFavorite,
  removeFavorite,
} from "@/lib/client-api";
import type { CoupleOutfit, Outfit, OwnersInfo } from "@/lib/types";

export default function FavoritosPage() {
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pairs, setPairs] = useState<CoupleOutfit[]>([]);
  const [owners, setOwners] = useState<OwnersInfo | null>(null);

  useEffect(() => {
    // Sin segundo armario no hay pares; si falla, la página sigue con lo suyo.
    fetchOwners().then((info) => {
      setOwners(info);
      if (info.partner !== null) fetchCoupleFavorites().then(setPairs, () => undefined);
    }, () => undefined);
  }, []);

  async function unfavoritePair(pair: CoupleOutfit) {
    const previous = pairs;
    setPairs((current) => current.filter((p) => p.id !== pair.id));
    try {
      await removeCoupleFavorite(pair.id);
    } catch (cause) {
      setPairs(previous);
      setError(cause instanceof Error ? cause.message : "No se pudo quitar el par.");
    }
  }

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

      {pairs.length > 0 && owners?.partner && (
        <section className="space-y-3">
          <h2 className="titulo px-1 text-2xl">En pareja</h2>
          {pairs.map((pair) => (
            <CoupleCard
              key={pair.id}
              pair={pair}
              partnerName={owners.partner?.name ?? ""}
              onToggleFavorite={(p) => void unfavoritePair(p)}
              onWear={(outfit) => {
                void Promise.allSettled(outfit.items.map((item) => logWear(item.garment.id)));
              }}
            />
          ))}
        </section>
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
