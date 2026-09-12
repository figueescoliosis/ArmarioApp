"use client";

import { useCallback, useRef, useState } from "react";
import type { Outfit } from "@/lib/types";
import { OutfitCard } from "./OutfitCard";
import { EmptyState } from "@/components/ui/EmptyState";

export interface OutfitDeckProps {
  outfits: Outfit[];
  onToggleFavorite?: (outfit: Outfit) => void;
  onWear?: (outfit: Outfit) => void;
  loading?: boolean;
  /** Favoritos lleva el sello del diseño en cada tarjeta; Conjuntos no. */
  mostrarSello?: boolean;
}

const CARD_GAP_PX = 16;

export function OutfitDeck({
  outfits,
  onToggleFavorite,
  onWear,
  loading = false,
  mostrarSello = false,
}: OutfitDeckProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    const first = el?.children[0];
    if (!el || !first) return;
    const cardWidth = first.getBoundingClientRect().width + CARD_GAP_PX;
    if (cardWidth <= 0) return;
    const index = Math.round(el.scrollLeft / cardWidth);
    setActiveIndex(Math.min(Math.max(index, 0), Math.max(outfits.length - 1, 0)));
  }, [outfits.length]);

  if (loading) {
    return (
      <div className="flex gap-4 overflow-x-hidden" aria-hidden="true">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-96 w-full max-w-sm shrink-0 animate-pulse rounded-[28px] bg-clay-100" />
        ))}
      </div>
    );
  }

  if (outfits.length === 0) {
    return <EmptyState message="No hay conjuntos que mostrar todavía." />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 lg:grid lg:snap-none lg:grid-cols-1 lg:overflow-visible"
      >
        {outfits.map((outfit, index) => (
          <div key={outfit.id} className="w-[88vw] max-w-sm shrink-0 snap-center lg:w-full lg:max-w-none">
            <OutfitCard
              outfit={outfit}
              onToggleFavorite={onToggleFavorite}
              onWear={onWear}
              {...(mostrarSello ? { sello: index % 2 === 0 ? "a" : "b" } : {})}
            />
          </div>
        ))}
      </div>

      {outfits.length > 1 && (
        <div
          role="tablist"
          aria-label="Posición en la baraja de conjuntos"
          className="flex items-center justify-center gap-1.5 lg:hidden"
        >
          {outfits.map((outfit, index) => (
            <span
              key={outfit.id}
              aria-hidden="true"
              className={`h-1.5 rounded-full transition-all ${
                index === activeIndex ? "w-4 bg-clay-500" : "w-1.5 bg-clay-200"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
