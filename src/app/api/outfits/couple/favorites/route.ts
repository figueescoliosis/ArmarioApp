/** Pares favoritos: los ven y los quitan los dos. */

import { NextRequest } from "next/server";
import { fail, handle, ok } from "@/lib/api";
import { listCoupleFavorites, saveCouple, setCoupleFavorite } from "@/lib/db/outfits";
import type { CoupleOutfit } from "@/lib/types";

export async function GET() {
  return handle(async () => ok(await listCoupleFavorites()));
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const raw: unknown = await request.json().catch(() => null);
    const pair = raw as CoupleOutfit | null;
    if (pair === null || !Array.isArray(pair.mine?.items) || !Array.isArray(pair.theirs?.items)) {
      return fail("BAD_REQUEST", "Se esperaba el par en el cuerpo de la petición.");
    }
    return ok(await saveCouple(pair, true), 201);
  });
}

export async function DELETE(request: NextRequest) {
  return handle(async () => {
    const id = request.nextUrl.searchParams.get("id");
    if (id === null) return fail("BAD_REQUEST", "Falta el parámetro 'id'.");
    await setCoupleFavorite(id, false);
    return ok({ id });
  });
}
