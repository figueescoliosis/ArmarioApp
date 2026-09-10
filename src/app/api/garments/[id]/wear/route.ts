import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api";
import { logWear } from "@/lib/db/garments";

interface Context {
  params: Promise<{ id: string }>;
}

/** Registra que la prenda se ha llevado hoy; alimenta la métrica de frescura. */
export async function POST(_request: NextRequest, { params }: Context) {
  return handle(async () => {
    const { id } = await params;
    await logWear(id);
    return ok({ id, wornAt: new Date().toISOString() });
  });
}
