"use client";

import type { CoupleOutfit, Outfit } from "@/lib/types";
import { OutfitCard } from "./OutfitCard";
import { ScoreRing } from "./ScoreRing";

export interface CoupleCardProps {
  pair: CoupleOutfit;
  partnerName: string;
  /** Solo el look propio se guarda en favoritos: los favoritos son de cada uno. */
  onToggleFavorite?: (outfit: Outfit) => void;
  onWear?: (outfit: Outfit) => void;
}

/** Un par de looks a juego: el tuyo y el del otro, uno junto al otro. */
export function CoupleCard({ pair, partnerName, onToggleFavorite, onWear }: CoupleCardProps) {
  return (
    <article className="flex flex-col gap-3 rounded-[28px] bg-bone-soft p-3">
      <div className="flex items-center gap-3 px-1">
        <ScoreRing percent={Math.round(pair.score * 100)} size={56} />
        <p className="text-sm font-semibold text-ink">{pair.rationale}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <section aria-label="Tu look" className="flex flex-col gap-2">
          <h3 className="px-1 text-xs font-bold tracking-[0.6px] text-ink-soft">TÚ</h3>
          <OutfitCard outfit={pair.mine} onToggleFavorite={onToggleFavorite} onWear={onWear} />
        </section>
        <section aria-label={`Look de ${partnerName}`} className="flex flex-col gap-2">
          <h3 className="px-1 text-xs font-bold tracking-[0.6px] text-ink-soft">
            {partnerName.toUpperCase()}
          </h3>
          <OutfitCard outfit={pair.theirs} onWear={onWear} />
        </section>
      </div>
    </article>
  );
}
