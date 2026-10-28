/**
 * Planes del calendario: un conjunto o un par apuntado para un día. Los ven
 * los dos; solo quien lo apunta lo borra.
 */

import { NextRequest } from "next/server";
import { fail, handle, ok } from "@/lib/api";
import { addPlan, deletePlan, listPlans } from "@/lib/db/plans";
import type { CoupleOutfit, Outfit } from "@/lib/types";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  return handle(async () => {
    const from = request.nextUrl.searchParams.get("from") ?? new Date().toISOString().slice(0, 10);
    if (!DAY.test(from)) return fail("BAD_REQUEST", "La fecha tiene que ir como aaaa-mm-dd.");
    return ok(await listPlans(from));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const raw: unknown = await request.json().catch(() => null);
    const body = (typeof raw === "object" && raw !== null ? raw : {}) as {
      day?: unknown;
      outfit?: Outfit;
      couple?: CoupleOutfit;
    };

    if (typeof body.day !== "string" || !DAY.test(body.day)) {
      return fail("BAD_REQUEST", "La fecha tiene que ir como aaaa-mm-dd.");
    }
    if (body.outfit !== undefined && Array.isArray(body.outfit.items) && body.outfit.items.length > 0) {
      return ok(await addPlan(body.day, { outfit: body.outfit }), 201);
    }
    if (body.couple !== undefined && Array.isArray(body.couple.mine?.items) && Array.isArray(body.couple.theirs?.items)) {
      return ok(await addPlan(body.day, { couple: body.couple }), 201);
    }
    return fail("BAD_REQUEST", "Se esperaba un conjunto o un par.");
  });
}

export async function DELETE(request: NextRequest) {
  return handle(async () => {
    const id = request.nextUrl.searchParams.get("id");
    if (id === null) return fail("BAD_REQUEST", "Falta el parámetro 'id'.");
    await deletePlan(id);
    return ok({ id });
  });
}
