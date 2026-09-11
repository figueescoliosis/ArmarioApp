"use client";

import { useState } from "react";
import type { Outfit, ScoreBreakdown } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { MannequinGrid } from "./MannequinGrid";
import { ScoreRing } from "./ScoreRing";

export interface OutfitCardProps {
  outfit: Outfit;
  onToggleFavorite?: (outfit: Outfit) => void;
  onWear?: (outfit: Outfit) => void;
}

/**
 * Cada métrica lleva su propio color, como en el diseño: rosa para lo que mide
 * el gusto, celeste para lo que mide el encaje objetivo y lavanda para la
 * frescura. En fila se leen como cinco cosas distintas y no como cinco
 * repeticiones de la misma barra.
 */
const BREAKDOWN: Record<
  keyof ScoreBreakdown,
  { label: string; fill: string; track: string; text: string }
> = {
  color: { label: "Armonía de color", fill: "bg-clay-500", track: "bg-clay-100", text: "text-clay-700" },
  formality: { label: "Formalidad", fill: "bg-clay-500", track: "bg-clay-100", text: "text-clay-700" },
  compatibility: { label: "Compatibilidad", fill: "bg-sky-500", track: "bg-sky-50", text: "text-sky-700" },
  season: { label: "Temporada", fill: "bg-sky-500", track: "bg-sky-50", text: "text-sky-700" },
  freshness: { label: "Frescura", fill: "bg-lilac-500", track: "bg-lilac-50", text: "text-lilac-700" },
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
  const percent = Math.round(outfit.score * 100);

  return (
    <article className="flex flex-col gap-2.5">
      <div className="rounded-[28px] bg-surface p-[13px] shadow-[0_12px_30px_rgb(247_168_196_/_0.24)]">
        {outfit.name !== null && <h3 className="titulo mb-2 px-1 text-[22px]">{outfit.name}</h3>}

        <div className="flex items-start gap-3">
          <MannequinGrid items={outfit.items} compacta />

          <div className="flex w-24 shrink-0 flex-col items-center gap-2.5">
            <ScoreRing percent={percent} size={80} />
            <button
              type="button"
              aria-pressed={outfit.isFavorite}
              aria-label={outfit.isFavorite ? "Quitar de favoritos" : "Marcar como favorito"}
              onClick={() => onToggleFavorite?.(outfit)}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-bone-soft text-clay-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
            >
              <HeartIcon filled={outfit.isFavorite} />
            </button>
          </div>
        </div>

        <div className="mt-2.5 rounded-[20px] bg-amber-50 p-3">
          <p className="text-xs italic leading-relaxed text-amber-900">«{outfit.rationale}»</p>
          <p className="mt-2 text-[10px] font-bold tracking-[0.6px] text-ink-soft">
            — MOCHA, {outfit.source === "rules+llm" ? "REGLAS + IA" : "REGLAS"}
          </p>
        </div>
      </div>

      <div className="rounded-3xl bg-surface p-[13px] shadow-[0_8px_22px_rgb(247_168_196_/_0.2)]">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((prev) => !prev)}
          className="flex min-h-[34px] w-full items-center justify-between text-sm font-bold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
        >
          {expanded ? "Ocultar desglose" : "Ver desglose"}
          <ChevronIcon expanded={expanded} />
        </button>
        {expanded && (
          <div className="flex flex-col gap-1.5 pb-1 pt-0.5">
            {BREAKDOWN_KEYS.map((key) => {
              const { label, fill, track, text } = BREAKDOWN[key];
              const value = Math.round(outfit.breakdown[key] * 100);
              return (
                <div key={key}>
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-ink">{label}</span>
                    <span className={`font-bold ${text}`}>{value}</span>
                  </div>
                  <div className={`mt-1.5 h-2 overflow-hidden rounded-full ${track}`}>
                    <div className={`h-full rounded-full ${fill}`} style={{ width: `${value}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Button variant="primary" size="lg" className="w-full" onClick={() => onWear?.(outfit)}>
        Me lo pongo hoy
      </Button>
    </article>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill={filled ? "var(--color-clay-500)" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20s-7-4.6-7-9.6A3.9 3.9 0 0 1 12 7.6a3.9 3.9 0 0 1 7 2.8c0 5-7 9.6-7 9.6z" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--color-clay-700)"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`transition-transform ${expanded ? "" : "rotate-180"}`}
    >
      <path d="M6 14l6-6 6 6" />
    </svg>
  );
}
