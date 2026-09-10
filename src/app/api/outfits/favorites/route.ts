import { NextRequest } from "next/server";
import { fail, handle, ok } from "@/lib/api";
import { deleteOutfit, listFavorites, saveOutfit, setFavorite } from "@/lib/db/outfits";
import type { Outfit } from "@/lib/types";

export async function GET() {
  return handle(async () => ok(await listFavorites()));
}

/**
 * Guarda un conjunto como favorito.
 *
 * Los conjuntos generados no se persisten al vuelo: solo llegan a la base de
 * datos cuando el usuario marca uno, que es la señal de que le interesa.
 */
export async function POST(request: NextRequest) {
  return handle(async () => {
    const raw: unknown = await request.json().catch(() => null);
    if (raw === null || typeof raw !== "object") {
      return fail("BAD_REQUEST", "Se esperaba el conjunto en el cuerpo de la petición.");
    }

    const outfit = raw as Outfit;
    if (!Array.isArray(outfit.items) || outfit.items.length === 0) {
      return fail("BAD_REQUEST", "El conjunto no tiene prendas.");
    }

    const saved = await saveOutfit({ ...outfit, isFavorite: true });
    if (!saved.isFavorite) await setFavorite(saved.id, true);

    return ok({ ...saved, isFavorite: true }, 201);
  });
}

export async function DELETE(request: NextRequest) {
  return handle(async () => {
    const id = request.nextUrl.searchParams.get("id");
    if (id === null) return fail("BAD_REQUEST", "Falta el parámetro 'id'.");

    await deleteOutfit(id);
    return ok({ id });
  });
}
