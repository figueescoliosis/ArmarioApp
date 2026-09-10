/**
 * Registro de uso, en forma de mapa.
 *
 * El probador puntúa en el navegador, y la frescura es uno de los cinco
 * componentes de la puntuación: sin este mapa todas las prendas parecerían sin
 * estrenar y el porcentaje saldría inflado respecto al de `/outfits`.
 *
 * Vive en `/api/wear` y no en `/api/garments/wear` para no quedar pegado a la
 * ruta dinámica `/api/garments/[id]/wear`, que registra el uso de una prenda.
 */

import { handle, ok } from "@/lib/api";
import { getLastWornMap } from "@/lib/db/garments";

export async function GET() {
  return handle(async () => ok(Object.fromEntries(await getLastWornMap())));
}
