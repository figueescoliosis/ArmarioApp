"use client";

import { useState } from "react";
import Image from "next/image";
import type { Outfit, OutfitItem, ScoreBreakdown, Slot } from "@/lib/types";
import { Button } from "@/components/ui/Button";

export interface OutfitCardProps {
  outfit: Outfit;
  onToggleFavorite?: (outfit: Outfit) => void;
  onWear?: (outfit: Outfit) => void;
}

const BREAKDOWN_LABELS: Record<keyof ScoreBreakdown, string> = {
  color: "Armonía de color",
  formality: "Formalidad",
  compatibility: "Compatibilidad",
  season: "Temporada",
  freshness: "Frescura",
};

const BREAKDOWN_KEYS: Array<keyof ScoreBreakdown> = [
  "color",
  "formality",
  "compatibility",
  "season",
  "freshness",
];

export function OutfitCard({ outfit, onToggleFavorite, onWear }: OutfitCardProps) {
  const [expanded, setExpanded] = useState(false);
  const bySlot = new Map<Slot, OutfitItem>();
  for (const item of outfit.items) bySlot.set(item.slot, item);

  const hasDress = bySlot.has("dress");
  const percent = Math.round(outfit.score * 100);

  return (
    <article className="flex flex-col gap-4 rounded-3xl border border-neutral-200 bg-surface p-4 shadow-sm">
      <div className="flex items-start gap-4">
        <div
          className="grid flex-1 gap-2"
          style={{
            gridTemplateAreas: hasDress
              ? `"dress dress" "dress dress" "shoes accessory"`
              : `"outerwear top" "bottom bottom" "shoes accessory"`,
            gridTemplateColumns: "1fr 1fr",
            gridTemplateRows: "1fr 1fr 1fr",
            height: "16rem",
          }}
        >
          {hasDress ? (
            <>
              <SlotCell slot="dress" item={bySlot.get("dress")} />
              <SlotCell slot="shoes" item={bySlot.get("shoes")} />
              <SlotCell slot="accessory" item={bySlot.get("accessory")} />
            </>
          ) : (
            <>
              <SlotCell slot="outerwear" item={bySlot.get("outerwear")} />
              <SlotCell slot="top" item={bySlot.get("top")} />
              <SlotCell slot="bottom" item={bySlot.get("bottom")} />
              <SlotCell slot="shoes" item={bySlot.get("shoes")} />
              <SlotCell slot="accessory" item={bySlot.get("accessory")} />
            </>
          )}
        </div>

        <div className="flex flex-col items-center gap-1">
          <div
            className="relative flex h-16 w-16 items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(var(--color-clay-500) ${percent * 3.6}deg, var(--color-neutral-200) 0deg)`,
            }}
            role="img"
            aria-label={`Puntuación del conjunto: ${percent}%`}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-sm font-semibold text-ink">
              {percent}%
            </div>
          </div>
          <button
            type="button"
            aria-pressed={outfit.isFavorite}
            aria-label={outfit.isFavorite ? "Quitar de favoritos" : "Marcar como favorito"}
            onClick={() => onToggleFavorite?.(outfit)}
            className="flex h-11 w-11 items-center justify-center text-clay-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
          >
            <HeartIcon filled={outfit.isFavorite} />
          </button>
        </div>
      </div>

      <blockquote className="border-l-4 border-clay-300 pl-3 text-sm italic text-ink-soft">
        “{outfit.rationale}”
      </blockquote>

      <div>
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((prev) => !prev)}
          className="flex h-11 items-center gap-1 text-sm font-medium text-ink-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
        >
          <ChevronIcon expanded={expanded} />
          {expanded ? "Ocultar desglose" : "Ver desglose"}
        </button>
        {expanded && (
          <div className="flex flex-col gap-2 pb-2 pt-1">
            {BREAKDOWN_KEYS.map((key) => (
              <div key={key} className="flex flex-col gap-1">
                <div className="flex justify-between text-xs text-ink-soft">
                  <span>{BREAKDOWN_LABELS[key]}</span>
                  <span>{Math.round(outfit.breakdown[key] * 100)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-neutral-200">
                  <div
                    className="h-full rounded-full bg-clay-400"
                    style={{ width: `${Math.round(outfit.breakdown[key] * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Button variant="primary" size="lg" className="w-full" onClick={() => onWear?.(outfit)}>
        Me lo pongo hoy
      </Button>
    </article>
  );
}

function SlotCell({ slot, item }: { slot: Slot; item?: OutfitItem }) {
  return (
    <div
      style={{ gridArea: slot }}
      className="relative flex items-center justify-center overflow-hidden rounded-xl border border-dashed border-neutral-200 bg-bone-soft"
    >
      {item ? (
        <Image
          src={item.garment.thumbUrl ?? item.garment.cutoutUrl}
          alt={item.garment.subcategory || "Prenda"}
          fill
          sizes="140px"
          className="object-contain p-1.5"
        />
      ) : (
        <span className="text-xs text-ink-soft" aria-hidden="true">
          —
        </span>
      )}
    </div>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 20s-7-4.35-9.5-8.5C.7 8.1 2.3 4.5 6 4.5c2 0 3.3 1.05 4 2.05.7-1 2-2.05 4-2.05 3.7 0 5.3 3.6 3.5 7C19 15.65 12 20 12 20Z"
      />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      className={`transition-transform ${expanded ? "rotate-180" : ""}`}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  );
}
