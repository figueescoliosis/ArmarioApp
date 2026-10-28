"use client";

/**
 * Generación de conjuntos.
 *
 * Los conjuntos no se guardan al generarlos: solo llegan a la base de datos
 * cuando el usuario marca uno como favorito. Generar es barato y determinista;
 * almacenar cada combinación que se le pasa por delante no aportaría nada.
 */

import { useEffect, useState } from "react";
import Link from "next/link";

import { CoupleCard } from "@/components/outfits/CoupleCard";
import { DayWeatherPicker, dayLabel, today } from "@/components/outfits/DayWeatherPicker";
import { OutfitDeck } from "@/components/outfits/OutfitDeck";
import { Button } from "@/components/ui/Button";
import { Cabecera } from "@/components/ui/Cabecera";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  ApiCallError,
  addPlan,
  fetchOwners,
  generateCoupleOutfits,
  generateOutfits,
  logWear,
  removeCoupleFavorite,
  saveCoupleFavorite,
  saveFavorite,
} from "@/lib/client-api";
import {
  FORMALITY,
  type CoupleOutfit,
  type Formality,
  type Outfit,
  type OwnersInfo,
  type Season,
} from "@/lib/types";

const OCCASIONS: Formality[] = [1, 2, 3, 4, 5];

/** Solo yo, un look para cada uno que combinen, o prendas de los dos en uno. */
type Mode = "solo" | "pareja" | "mezcla";

export default function OutfitsPage() {
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [pairs, setPairs] = useState<CoupleOutfit[]>([]);
  const [owners, setOwners] = useState<OwnersInfo | null>(null);
  const [mode, setMode] = useState<Mode>("solo");
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [occasion, setOccasion] = useState<Formality | null>(null);
  const [temperature, setTemperature] = useState<number | null>(null);
  const [useLlm, setUseLlm] = useState(false);
  const [day, setDay] = useState(today);
  const [season, setSeason] = useState<Season | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    // Sin segundo armario el selector de modo ni aparece.
    fetchOwners().then(setOwners, () => undefined);
  }, []);

  const partner = owners?.partner ?? null;

  async function generate() {
    setLoading(true);
    setError(null);
    setTouched(true);
    const request = {
      ...(occasion !== null ? { occasion } : {}),
      ...(temperature !== null ? { temperatureC: temperature } : {}),
      ...(season !== null ? { season } : {}),
      limit: 10,
      useLlmRanking: useLlm,
    };
    try {
      if (mode === "pareja") {
        setOutfits([]);
        setPairs(await generateCoupleOutfits(request));
      } else {
        setPairs([]);
        setOutfits(await generateOutfits({ ...request, mode }));
      }
    } catch (cause) {
      setOutfits([]);
      setPairs([]);
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
      const mark = (o: Outfit) => (o.id === outfit.id ? { ...o, ...saved, isFavorite: true } : o);
      setOutfits((current) => current.map(mark));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar el favorito.");
    }
  }

  /** El par se guarda entero; la tarjeta pasa a llevar el id guardado. */
  async function favoritePair(pair: CoupleOutfit) {
    try {
      const saved = pair.isFavorite
        ? (await removeCoupleFavorite(pair.id), { ...pair, isFavorite: false })
        : await saveCoupleFavorite(pair);
      setPairs((current) => current.map((p) => (p.id === pair.id ? saved : p)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar el par.");
    }
  }

  async function plan(target: { outfit: Outfit } | { couple: CoupleOutfit }) {
    setNotice(null);
    try {
      await addPlan(day, target);
      setNotice(`Apuntado para el ${dayLabel(day)}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo apuntar.");
    }
  }

  const planLabel = `Apuntar para el ${dayLabel(day)}`;

  async function wear(outfit: Outfit) {
    // Registrar cada prenda por separado alimenta la métrica de frescura, que
    // luego premia lo que lleva tiempo sin usarse.
    await Promise.allSettled(outfit.items.map((item) => logWear(item.garment.id)));
  }

  return (
    <div className="space-y-6">
      <Cabecera
        adorno="conjuntos"
        titulo="Conjuntos"
        subtitulo="Combinaciones hechas con lo que ya tienes."
        accion={
          <Link href="/calendario">
            <Button variant="secondary">Calendario</Button>
          </Link>
        }
      />

      <section className="space-y-4 rounded-[28px] bg-surface p-4 shadow-[0_12px_30px_rgb(247_168_196_/_0.24)]">
        {partner !== null && (
          <fieldset>
            <legend className="mb-2 text-sm font-bold text-ink">¿Para quién?</legend>
            <div className="flex flex-wrap gap-2">
              <Chip label="Solo yo" selected={mode === "solo"} onClick={() => setMode("solo")} />
              <Chip
                label={`A juego con ${partner.name}`}
                selected={mode === "pareja"}
                onClick={() => setMode("pareja")}
              />
              <Chip
                label="Mezclar armarios"
                selected={mode === "mezcla"}
                onClick={() => setMode("mezcla")}
              />
            </div>
          </fieldset>
        )}

        <DayWeatherPicker
          day={day}
          onDayChange={setDay}
          onWeather={(weather) => {
            setTemperature(weather?.tempC ?? null);
            setSeason(weather?.season ?? null);
          }}
        />

        <fieldset>
          <legend className="mb-2 text-sm font-bold text-ink">¿Para qué ocasión?</legend>
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
          <label htmlFor="temp" className="mb-2 block text-sm font-bold text-ink">
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

        <label className="flex min-h-11 items-start gap-3 py-1 text-sm">
          <input
            type="checkbox"
            checked={useLlm}
            onChange={(event) => setUseLlm(event.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0"
          />
          <span className="font-bold text-ink">
            Afinar con IA
            <span className="block font-medium text-xs text-neutral-500">
              Claude reordena los cinco mejores y escribe el porqué. Tarda unos segundos más.
            </span>
          </span>
        </label>

        <Button size="lg" className="w-full" onClick={() => void generate()} disabled={loading}>
          {loading ? "Combinando…" : "Generar conjuntos"}
        </Button>
      </section>

      {notice !== null && (
        <p role="status" className="rounded-[20px] bg-sky-50 p-4 text-sm font-semibold text-sky-700">
          {notice} <Link href="/calendario" className="underline">Ver calendario</Link>
        </p>
      )}

      {error !== null && (
        <p role="alert" className="rounded-[20px] border-[1.5px] border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {mode === "pareja" && partner !== null && pairs.length > 0 && !loading ? (
        <div className="flex flex-col gap-4">
          {pairs.map((pair) => (
            <CoupleCard
              key={pair.id}
              pair={pair}
              partnerName={partner.name}
              onToggleFavorite={(p) => void favoritePair(p)}
              onWear={(outfit) => void wear(outfit)}
              onPlan={(couple) => void plan({ couple })}
              planLabel={planLabel}
            />
          ))}
        </div>
      ) : touched && !loading && outfits.length === 0 && error === null ? (
        <EmptyState message="No ha salido ningún conjunto con esas restricciones. Prueba a relajar la ocasión o la temperatura." />
      ) : (
        <OutfitDeck
          outfits={outfits}
          loading={loading}
          onToggleFavorite={(outfit) => void favorite(outfit)}
          onWear={(outfit) => void wear(outfit)}
          onPlan={(outfit) => void plan({ outfit })}
          planLabel={planLabel}
          {...(mode === "mezcla" && partner !== null
            ? { ajenas: { ownerId: partner.id, name: partner.name } }
            : {})}
        />
      )}
    </div>
  );
}
