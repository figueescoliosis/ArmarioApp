"use client";

/**
 * Generación de conjuntos.
 *
 * Los conjuntos no se guardan al generarlos: solo llegan a la base de datos
 * cuando el usuario marca uno como favorito. Generar es barato y determinista;
 * almacenar cada combinación que se le pasa por delante no aportaría nada.
 */

import { useState } from "react";

import { OutfitDeck } from "@/components/outfits/OutfitDeck";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { ApiCallError, generateOutfits, logWear, saveFavorite } from "@/lib/client-api";
import { FORMALITY, type Formality, type Outfit } from "@/lib/types";

const OCCASIONS: Formality[] = [1, 2, 3, 4, 5];

export default function OutfitsPage() {
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [occasion, setOccasion] = useState<Formality | null>(null);
  const [temperature, setTemperature] = useState<number | null>(null);
  const [useLlm, setUseLlm] = useState(false);

  async function generate() {
    setLoading(true);
    setError(null);
    setTouched(true);
    try {
      setOutfits(
        await generateOutfits({
          ...(occasion !== null ? { occasion } : {}),
          ...(temperature !== null ? { temperatureC: temperature } : {}),
          useLlmRanking: useLlm,
          limit: 10,
        }),
      );
    } catch (cause) {
      setOutfits([]);
      setError(
        cause instanceof ApiCallError || cause instanceof Error
          ? cause.message
          : "No se pudieron generar conjuntos.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function favorite(outfit: Outfit) {
    try {
      const saved = await saveFavorite(outfit);
      setOutfits((current) =>
        current.map((o) => (o.id === outfit.id ? { ...o, ...saved, isFavorite: true } : o)),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar el favorito.");
    }
  }

  async function wear(outfit: Outfit) {
    // Registrar cada prenda por separado alimenta la métrica de frescura, que
    // luego premia lo que lleva tiempo sin usarse.
    await Promise.allSettled(outfit.items.map((item) => logWear(item.garment.id)));
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Conjuntos</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Combinaciones hechas con lo que ya tienes.
        </p>
      </header>

      <section className="space-y-4 rounded-2xl border border-line bg-bone-soft p-4">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">¿Para qué ocasión?</legend>
          <div className="flex flex-wrap gap-2">
            <Chip label="Cualquiera" selected={occasion === null} onClick={() => setOccasion(null)} />
            {OCCASIONS.map((level) => (
              <Chip
                key={level}
                label={FORMALITY[level]}
                selected={occasion === level}
                onClick={() => setOccasion(level)}
              />
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="temp" className="mb-2 block text-sm font-medium">
            Temperatura: {temperature === null ? "sin especificar" : `${temperature}°`}
          </label>
          <div className="flex items-center gap-3">
            <input
              id="temp"
              type="range"
              min={-5}
              max={40}
              step={1}
              value={temperature ?? 18}
              onChange={(event) => setTemperature(Number(event.target.value))}
              className="h-11 flex-1"
            />
            {temperature !== null && (
              <Button variant="ghost" onClick={() => setTemperature(null)}>
                Quitar
              </Button>
            )}
          </div>
        </div>

        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={useLlm}
            onChange={(event) => setUseLlm(event.target.checked)}
            className="h-5 w-5"
          />
          <span>
            Afinar con IA
            <span className="block text-xs text-neutral-500">
              Claude reordena los cinco mejores y escribe el porqué. Tarda unos segundos más.
            </span>
          </span>
        </label>

        <Button size="lg" className="w-full" onClick={() => void generate()} disabled={loading}>
          {loading ? "Combinando…" : "Generar conjuntos"}
        </Button>
      </section>

      {error !== null && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {error}
        </p>
      )}

      {touched && !loading && outfits.length === 0 && error === null ? (
        <EmptyState message="No ha salido ningún conjunto con esas restricciones. Prueba a relajar la ocasión o la temperatura." />
      ) : (
        <OutfitDeck
          outfits={outfits}
          loading={loading}
          onToggleFavorite={(outfit) => void favorite(outfit)}
          onWear={(outfit) => void wear(outfit)}
        />
      )}
    </div>
  );
}
