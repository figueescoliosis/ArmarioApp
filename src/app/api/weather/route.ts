/**
 * El tiempo de un día: `?date=yyyy-mm-dd` y `lat`+`lon` (GPS del móvil) o
 * `city` (si no se dio permiso de ubicación).
 */

import { NextRequest } from "next/server";
import { fail, handle, ok } from "@/lib/api";
import { geocode, weatherFor, type Place } from "@/lib/weather";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  return handle(async () => {
    const params = request.nextUrl.searchParams;
    const day = params.get("date") ?? "";
    if (!DAY.test(day) || Number.isNaN(Date.parse(day))) {
      return fail("BAD_REQUEST", "La fecha tiene que ir como aaaa-mm-dd.");
    }

    const lat = Number(params.get("lat"));
    const lon = Number(params.get("lon"));
    const city = params.get("city")?.trim() ?? "";

    let place: Place;
    if (params.has("lat") && params.has("lon") && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      place = { lat, lon, name: null };
    } else if (city !== "") {
      place = await geocode(city);
    } else {
      return fail("BAD_REQUEST", "Hace falta la ubicación o una ciudad.");
    }

    return ok(await weatherFor(day, place, new Date().toISOString().slice(0, 10)));
  });
}
