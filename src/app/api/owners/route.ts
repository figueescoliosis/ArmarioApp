/**
 * Quién soy y de quién es el otro armario, para los textos de la interfaz.
 * Solo nombres: las contraseñas de `owners()` no salen de aquí.
 */

import { handle, ok } from "@/lib/api";
import { currentOwnerId } from "@/lib/db/supabase";
import { owners, partnerOf } from "@/lib/owners";
import type { OwnersInfo } from "@/lib/types";

export async function GET() {
  return handle(async () => {
    const meId = await currentOwnerId();
    const me = owners().find((owner) => owner.id === meId);
    const partner = partnerOf(meId);
    const info: OwnersInfo = {
      me: { id: meId, name: me?.name ?? "Yo" },
      partner: partner === null ? null : { id: partner.id, name: partner.name },
    };
    return ok(info);
  });
}
