"use client";

import type { CoupleOutfit, Outfit } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { OutfitCard } from "./OutfitCard";
import { ScoreRing } from "./ScoreRing";

export interface CoupleCardProps {
  pair: CoupleOutfit;
  partnerName: string;
  /** El favorito es el par entero, y lo ven los dos. */
  onToggleFavorite?: (pair: CoupleOutfit) => void;
  onWear?: (outfit: Outfit) => void;
  onPlan?: (pair: CoupleOutfit) => void;
  planLabel?: string;
}

/** Un par de looks a juego: el tuyo y el del otro, uno junto al otro. */
export function CoupleCard({
  pair,
  partnerName,
  onToggleFavorite,
  onWear,
  onPlan,
  planLabel,
}: CoupleCardProps) {
  return (
    <article className="flex flex-col gap-3 rounded-[28px] bg-bone-soft p-3">
      <div className="flex items-center gap-3 px-1">
        <ScoreRing percent={Math.round(pair.score * 100)} size={56} />
        <div className="flex-1">
          {pair.name !== null && <h3 className="titulo text-2xl">{pair.name}</h3>}
          <p className="text-sm font-semibold text-ink">{pair.rationale}</p>
        </div>
        {onToggleFavorite !== undefined && (
          <button
            type="button"
            aria-pressed={pair.isFavorite}
            aria-label={pair.isFavorite ? "Quitar el par de favoritos" : "Guardar el par en favoritos"}
            onClick={() => onToggleFavorite(pair)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-clay-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill={pair.isFavorite ? "var(--color-clay-500)" : "none"}
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 20s-7-4.6-7-9.6A3.9 3.9 0 0 1 12 7.6a3.9 3.9 0 0 1 7 2.8c0 5-7 9.6-7 9.6z" />
            </svg>
          </button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <section aria-label="Tu look" className="flex flex-col gap-2">
          <h3 className="px-1 text-xs font-bold tracking-[0.6px] text-ink-soft">TÚ</h3>
          <OutfitCard outfit={pair.mine} onWear={onWear} />
        </section>
        <section aria-label={`Look de ${partnerName}`} className="flex flex-col gap-2">
          <h3 className="px-1 text-xs font-bold tracking-[0.6px] text-ink-soft">
            {partnerName.toUpperCase()}
          </h3>
          <OutfitCard outfit={pair.theirs} onWear={onWear} />
        </section>
      </div>

      {onPlan !== undefined && (
        <Button variant="secondary" size="lg" className="w-full" onClick={() => onPlan(pair)}>
          {planLabel ?? "Apuntar en el calendario"}
        </Button>
      )}
    </article>
  );
}
