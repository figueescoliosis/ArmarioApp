"use client";

import { useState } from "react";
import type { KeyboardEvent } from "react";
import {
  CATEGORIES,
  FORMALITY,
  PATTERNS,
  SEASONS,
} from "@/lib/types";
import type {
  Category,
  Formality,
  GarmentAttributes,
  GarmentColor,
  Pattern,
  Season,
  Warmth,
} from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Spinner } from "@/components/ui/Spinner";

export interface TagReviewProps {
  attributes: GarmentAttributes;
  imageUrl: string;
  onConfirm: (attributes: GarmentAttributes) => void;
  onCancel: () => void;
  saving?: boolean;
}

const CATEGORY_LABELS: Record<Category, string> = {
  top: "Parte de arriba",
  bottom: "Parte de abajo",
  dress: "Vestido",
  outerwear: "Abrigo",
  shoes: "Calzado",
  accessory: "Accesorio",
};

const PATTERN_LABELS: Record<Pattern, string> = {
  solid: "Liso",
  striped: "Rayas",
  checked: "Cuadros",
  floral: "Flores",
  print: "Estampado",
  other: "Otro",
};

const WARMTH_LABELS: readonly [string, string, string, string, string] = [
  "Muy ligero",
  "Ligero",
  "Templado",
  "Abrigado",
  "Muy abrigado",
];

const MAX_COLORS = 4;
const MAX_TAGS = 5;

function capitalize(text: string): string {
  return text.length === 0 ? text : text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * `attributes` se toma como valor inicial, no como prop controlada: la pantalla
 * existe para que el usuario corrija una única vez lo que dedujo la IA antes de
 * guardar, así que no tiene sentido resincronizarla si el padre re-renderiza.
 */
export function TagReview({ attributes, imageUrl, onConfirm, onCancel, saving = false }: TagReviewProps) {
  const [attrs, setAttrs] = useState<GarmentAttributes>(attributes);
  const [tagDraft, setTagDraft] = useState("");

  function updateColor(index: number, patch: Partial<GarmentColor>) {
    setAttrs((prev) => ({
      ...prev,
      colors: prev.colors.map((color, i) => (i === index ? { ...color, ...patch } : color)),
    }));
  }

  function addColor() {
    setAttrs((prev) =>
      prev.colors.length >= MAX_COLORS
        ? prev
        : { ...prev, colors: [...prev.colors, { hex: "#8A8A8A", name: "", ratio: 0 }] },
    );
  }

  function removeColor(index: number) {
    setAttrs((prev) => ({ ...prev, colors: prev.colors.filter((_, i) => i !== index) }));
  }

  function commitTag() {
    const trimmed = tagDraft.trim();
    setTagDraft("");
    if (!trimmed) return;
    setAttrs((prev) => {
      if (prev.styleTags.length >= MAX_TAGS || prev.styleTags.includes(trimmed)) return prev;
      return { ...prev, styleTags: [...prev.styleTags, trimmed] };
    });
  }

  function removeTag(tag: string) {
    setAttrs((prev) => ({ ...prev, styleTags: prev.styleTags.filter((t) => t !== tag) }));
  }

  function handleTagKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commitTag();
    }
  }

  function toggleSeason(season: Season) {
    setAttrs((prev) => ({
      ...prev,
      seasons: prev.seasons.includes(season)
        ? prev.seasons.filter((s) => s !== season)
        : [...prev.seasons, season],
    }));
  }

  return (
    <div className="flex flex-col gap-6 pb-24">
      <div className="checkerboard mx-auto flex h-64 w-64 max-w-full items-center justify-center overflow-hidden rounded-[28px] shadow-[var(--sombra-tarjeta)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- imagen local aún sin subir, no cabe en el loader de next/image */}
        <img src={imageUrl} alt="Recorte de la prenda" className="h-full w-full object-contain" />
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="titulo text-[15px]">Categoría</h3>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((category) => (
            <Chip
              key={category}
              label={CATEGORY_LABELS[category]}
              selected={attrs.category === category}
              onClick={() => setAttrs((prev) => ({ ...prev, category }))}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <label htmlFor="subcategory" className="titulo text-[15px]">
          Tipo de prenda
        </label>
        <input
          id="subcategory"
          type="text"
          value={attrs.subcategory}
          onChange={(event) => setAttrs((prev) => ({ ...prev, subcategory: event.target.value }))}
          placeholder="Ej. camisa de vestir"
          className="h-11 rounded-2xl border-[1.5px] border-clay-200 bg-surface px-3 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
        />
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="titulo text-[15px]">Colores</h3>
        <div className="flex flex-col gap-2">
          {attrs.colors.map((color, index) => (
            <div key={index} className="flex items-center gap-2 rounded-2xl bg-surface p-2 shadow-[0_4px_12px_rgb(247_168_196_/_0.2)]">
              <input
                type="color"
                aria-label={`Color hexadecimal ${index + 1}`}
                value={/^#[0-9a-fA-F]{6}$/.test(color.hex) ? color.hex : "#888888"}
                onChange={(event) => updateColor(index, { hex: event.target.value })}
                className="h-9 w-11 shrink-0 cursor-pointer rounded-xl border-[1.5px] border-clay-200"
              />
              <input
                type="text"
                value={color.name}
                onChange={(event) => updateColor(index, { name: event.target.value })}
                placeholder="Nombre del color"
                className="h-9 min-w-0 flex-1 rounded-xl border-[1.5px] border-clay-200 bg-transparent px-2 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Quitar color ${color.name || index + 1}`}
                onClick={() => removeColor(index)}
              >
                <TrashIcon />
              </Button>
            </div>
          ))}
        </div>
        {attrs.colors.length < MAX_COLORS && (
          <Button variant="secondary" size="md" className="self-start" onClick={addColor}>
            <PlusIcon /> Añadir color
          </Button>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="titulo text-[15px]">Patrón</h3>
        <div className="flex flex-wrap gap-2">
          {PATTERNS.map((pattern) => (
            <Chip
              key={pattern}
              label={PATTERN_LABELS[pattern]}
              selected={attrs.pattern === pattern}
              onClick={() => setAttrs((prev) => ({ ...prev, pattern }))}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <label htmlFor="material" className="titulo text-[15px]">
          Material <span className="font-normal text-ink-soft">(opcional)</span>
        </label>
        <input
          id="material"
          type="text"
          value={attrs.material ?? ""}
          onChange={(event) =>
            setAttrs((prev) => ({ ...prev, material: event.target.value === "" ? null : event.target.value }))
          }
          placeholder="Ej. algodón"
          className="h-11 rounded-2xl border-[1.5px] border-clay-200 bg-surface px-3 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
        />
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="titulo text-[15px]">
          Estilo <span className="font-normal text-ink-soft">(máximo {MAX_TAGS})</span>
        </h3>
        <div className="flex flex-wrap gap-2">
          {attrs.styleTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-clay-50 px-3 text-sm font-semibold text-clay-700"
            >
              {tag}
              <button
                type="button"
                aria-label={`Quitar etiqueta ${tag}`}
                onClick={() => removeTag(tag)}
                className="text-clay-700 hover:text-ink"
              >
                <CloseIcon />
              </button>
            </span>
          ))}
        </div>
        {attrs.styleTags.length < MAX_TAGS && (
          <input
            type="text"
            value={tagDraft}
            onChange={(event) => setTagDraft(event.target.value)}
            onKeyDown={handleTagKeyDown}
            onBlur={commitTag}
            placeholder="Escribe y pulsa Enter o coma"
            className="h-11 rounded-2xl border-[1.5px] border-clay-200 bg-surface px-3 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
          />
        )}
      </section>

      <section className="flex flex-col gap-2">
        <label htmlFor="formality" className="titulo text-[15px]">
          Formalidad
        </label>
        <input
          id="formality"
          type="range"
          min={1}
          max={5}
          step={1}
          value={attrs.formality}
          onChange={(event) =>
            setAttrs((prev) => ({ ...prev, formality: Number(event.target.value) as Formality }))
          }
          className="accent-clay-500"
        />
        <p className="text-center text-sm font-semibold text-clay-700">{FORMALITY[attrs.formality]}</p>
      </section>

      <section className="flex flex-col gap-2">
        <label htmlFor="warmth" className="titulo text-[15px]">
          Abrigo
        </label>
        <input
          id="warmth"
          type="range"
          min={1}
          max={5}
          step={1}
          value={attrs.warmth}
          onChange={(event) => setAttrs((prev) => ({ ...prev, warmth: Number(event.target.value) as Warmth }))}
          className="accent-clay-500"
        />
        <p className="text-center text-sm font-semibold text-clay-700">{WARMTH_LABELS[attrs.warmth - 1]}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="titulo text-[15px]">Temporadas</h3>
        <div className="flex flex-wrap gap-2">
          {SEASONS.map((season) => (
            <Chip
              key={season}
              label={capitalize(season)}
              selected={attrs.seasons.includes(season)}
              onClick={() => toggleSeason(season)}
            />
          ))}
        </div>
      </section>

      {/* Por encima del menú (z-40), no debajo: mientras se revisan las etiquetas
          estos dos botones son la única salida del paso, y el menú los tapaba. */}
      <div className="fixed inset-x-0 bottom-0 z-50 flex gap-3 rounded-t-[28px] bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[var(--sombra-hoja)]">
        <Button variant="secondary" size="lg" className="flex-1" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          size="lg"
          className="flex-1"
          onClick={() => onConfirm(attrs)}
          disabled={saving}
        >
          {saving && <Spinner className="h-4 w-4 text-bone" />}
          Guardar prenda
        </Button>
      </div>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-12" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}
