"use client";

/**
 * «¿Para cuándo?»: un día y el tiempo que hará.
 *
 * La ubicación sale del GPS del móvil; si no se da permiso, de una ciudad que
 * se escribe una vez y se recuerda en este dispositivo.
 */

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { fetchWeather } from "@/lib/client-api";
import type { DayWeather } from "@/lib/types";

type Where = { lat: number; lon: number } | { city: string };

const CITY_KEY = "armario:ciudad";

/** Hoy en la zona horaria del móvil, como `yyyy-mm-dd`. */
export function today(): string {
  return new Date().toLocaleDateString("en-CA");
}

export function dayLabel(day: string): string {
  return new Date(`${day}T12:00:00`).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function savedCity(): Where | null {
  try {
    const city = localStorage.getItem(CITY_KEY);
    return city ? { city } : null;
  } catch {
    return null;
  }
}

/** GPS si lo dan; si no, la ciudad guardada; si tampoco, `null`. */
export function locate(): Promise<Where | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      resolve(savedCity());
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lon: position.coords.longitude }),
      () => resolve(savedCity()),
      { timeout: 8000, maximumAge: 3_600_000 },
    );
  });
}

export function useWhere(): [Where | null | undefined, (city: string) => void] {
  // `undefined` mientras se pregunta; `null` si no hay forma de saberlo.
  const [where, setWhere] = useState<Where | null | undefined>(undefined);
  useEffect(() => {
    void locate().then(setWhere);
  }, []);

  function setCity(city: string) {
    try {
      localStorage.setItem(CITY_KEY, city);
    } catch {
      // Sin almacenamiento se usa igual, solo que no se recuerda.
    }
    setWhere({ city });
  }
  return [where, setCity];
}

export interface DayWeatherPickerProps {
  day: string;
  onDayChange: (day: string) => void;
  /** Avisa cada vez que llega el tiempo del día (o `null` si no se pudo). */
  onWeather: (weather: DayWeather | null) => void;
}

export function DayWeatherPicker({ day, onDayChange, onWeather }: DayWeatherPickerProps) {
  const [where, setCity] = useWhere();
  const [weather, setWeather] = useState<DayWeather | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cityDraft, setCityDraft] = useState("");

  useEffect(() => {
    if (!where) return;
    let active = true;
    fetchWeather(day, where).then(
      (result) => {
        if (!active) return;
        setError(null);
        setWeather(result);
        onWeather(result);
      },
      (cause: unknown) => {
        if (!active) return;
        setWeather(null);
        onWeather(null);
        setError(cause instanceof Error ? cause.message : "No se pudo consultar el tiempo.");
      },
    );
    return () => {
      active = false;
    };
    // `onWeather` cambia en cada render de la página; solo importan día y sitio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, where]);

  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-bold text-ink">¿Para cuándo?</legend>
      <input
        type="date"
        value={day}
        min={today()}
        onChange={(event) => event.target.value && onDayChange(event.target.value)}
        className="h-11 w-full rounded-full border-[1.5px] border-clay-200 bg-surface px-4 text-sm font-semibold text-ink"
      />

      {where === null && (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (cityDraft.trim()) setCity(cityDraft.trim());
          }}
        >
          <input
            type="text"
            value={cityDraft}
            onChange={(event) => setCityDraft(event.target.value)}
            placeholder="Tu ciudad, para mirar el tiempo"
            aria-label="Ciudad"
            className="h-11 min-w-0 flex-1 rounded-full border-[1.5px] border-clay-200 bg-surface px-4 text-sm"
          />
          <Button type="submit" variant="secondary">
            Usar
          </Button>
        </form>
      )}

      {weather !== null && (
        <p className="rounded-[20px] bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700">
          {weather.minC}° – {weather.maxC}° de sensación
          {weather.rainProbability !== null && weather.rainProbability >= 40
            ? ` · ${weather.rainProbability}% de lluvia, lleva paraguas`
            : ""}
          {weather.place !== null ? ` · ${weather.place}` : ""}
          {weather.estimated && (
            <span className="block text-xs font-medium">
              Aún no hay previsión para ese día: es lo que hizo hace un año.
            </span>
          )}
        </p>
      )}
      {error !== null && <p className="text-xs font-medium text-red-700">{error}</p>}
    </fieldset>
  );
}
