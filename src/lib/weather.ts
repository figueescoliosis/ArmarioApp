/**
 * El tiempo de un día, para vestir según él.
 *
 * Open-Meteo, sin clave. Hasta `FORECAST_DAYS` días vista se usa la previsión;
 * más lejos no hay previsión que valga, así que se toma el mismo día de un año
 * pasado del archivo y se marca como estimación. El motor de conjuntos no se
 * entera de nada de esto: recibe una temperatura y una temporada, como si las
 * hubiera elegido el usuario, y sigue sin red.
 */

import { ServiceError } from "@/lib/errors";
import type { DayWeather, Season } from "@/lib/types";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";
const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";

/** Open-Meteo da 16 días de previsión contando hoy. */
export const FORECAST_DAYS = 15;
/** El archivo tarda unos días en tener datos consolidados. */
const ARCHIVE_LAG_DAYS = 7;

const DAY_MS = 86_400_000;

export interface Place {
  lat: number;
  lon: number;
  name: string | null;
}

/**
 * Temporada meteorológica (por meses completos). En el hemisferio sur va al
 * revés: diciembre es verano en Santiago y invierno en Madrid.
 */
export function seasonFor(day: string, lat: number): Season {
  const month = Number(day.slice(5, 7));
  const north: Season[] = ["invierno", "primavera", "verano", "otoño"];
  const index = Math.floor((month % 12) / 3);
  const season = north[lat < 0 ? (index + 2) % 4 : index];
  return season ?? "primavera";
}

/**
 * Qué pedir a Open-Meteo: la previsión del propio día o, si cae fuera, el
 * mismo día de un año pasado con datos en el archivo.
 */
export function sourceFor(day: string, today: string): { kind: "forecast" | "archive"; day: string } {
  const offset = (Date.parse(day) - Date.parse(today)) / DAY_MS;
  if (offset <= FORECAST_DAYS) return { kind: "forecast", day };

  const date = new Date(`${day}T00:00:00Z`);
  const limit = Date.parse(today) - ARCHIVE_LAG_DAYS * DAY_MS;
  while (date.getTime() > limit) date.setUTCFullYear(date.getUTCFullYear() - 1);
  return { kind: "archive", day: date.toISOString().slice(0, 10) };
}

export async function geocode(city: string): Promise<Place> {
  const params = new URLSearchParams({ name: city, count: "1", language: "es" });
  const body = await getJson<{
    results?: Array<{ latitude: number; longitude: number; name: string; country?: string }>;
  }>(`${GEOCODING_URL}?${params}`);

  const hit = body.results?.[0];
  if (hit === undefined) {
    throw new ServiceError("NOT_FOUND", `No encuentro la ciudad «${city}». Prueba con otro nombre.`);
  }
  return {
    lat: hit.latitude,
    lon: hit.longitude,
    name: hit.country ? `${hit.name}, ${hit.country}` : hit.name,
  };
}

export async function weatherFor(day: string, place: Place, today: string): Promise<DayWeather> {
  const source = sourceFor(day, today);
  const daily = ["apparent_temperature_max", "apparent_temperature_min"];
  if (source.kind === "forecast") daily.push("precipitation_probability_max");

  const params = new URLSearchParams({
    latitude: String(place.lat),
    longitude: String(place.lon),
    daily: daily.join(","),
    timezone: "auto",
    start_date: source.day,
    end_date: source.day,
  });
  const body = await getJson<{
    daily?: {
      apparent_temperature_max?: Array<number | null>;
      apparent_temperature_min?: Array<number | null>;
      precipitation_probability_max?: Array<number | null>;
    };
  }>(`${source.kind === "forecast" ? FORECAST_URL : ARCHIVE_URL}?${params}`);

  const maxC = body.daily?.apparent_temperature_max?.[0];
  const minC = body.daily?.apparent_temperature_min?.[0];
  if (typeof maxC !== "number" || typeof minC !== "number") {
    throw new ServiceError("WEATHER_FAILED", "No hay datos del tiempo para ese día.");
  }

  return {
    day,
    tempC: Math.round((maxC + minC) / 2),
    minC: Math.round(minC),
    maxC: Math.round(maxC),
    rainProbability: body.daily?.precipitation_probability_max?.[0] ?? null,
    season: seasonFor(day, place.lat),
    place: place.name,
    estimated: source.kind === "archive",
  };
}

async function getJson<T>(url: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  } catch (cause) {
    throw new ServiceError("WEATHER_FAILED", "No se pudo consultar el tiempo. Inténtalo de nuevo.", cause);
  }
  if (!response.ok) {
    throw new ServiceError("WEATHER_FAILED", `El servicio del tiempo respondió ${response.status}.`);
  }
  return (await response.json()) as T;
}
