/**
 * Latido diario para que Supabase no pause el proyecto.
 *
 * En el plan Free, Supabase pausa la base de datos tras una semana sin
 * actividad, y la app se queda sin prendas hasta que alguien la restaura a
 * mano. Vercel Cron llama aquí una vez al día (`vercel.json`) y una consulta
 * mínima basta para contar como actividad.
 *
 * El middleware deja pasar esta ruta sin Basic Auth, porque Vercel Cron no
 * puede mandarlo: solo manda `Authorization: Bearer $CRON_SECRET`. La
 * comprobación de ese secreto la hace este handler.
 */

import { fail, handle, ok } from "@/lib/api";
import { DEFAULT_OWNER_ID, getSupabaseAdmin, MissingConfigError } from "@/lib/db/supabase";

export async function GET(request: Request) {
  return handle(async () => {
    const secret = process.env.CRON_SECRET;
    if (!secret) throw new MissingConfigError("CRON_SECRET");
    if (request.headers.get("authorization") !== `Bearer ${secret}`) {
      return fail("UNAUTHORIZED", "Acceso restringido.");
    }

    const { error } = await getSupabaseAdmin()
      .from("garments")
      .select("id", { head: true, count: "exact" })
      .eq("owner_id", DEFAULT_OWNER_ID);
    if (error) throw new Error(`No se pudo consultar la base de datos: ${error.message}`);

    return ok({ pong: true });
  });
}
