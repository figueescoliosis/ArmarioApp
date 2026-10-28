/**
 * Puerta de entrada: Basic Auth para toda la app.
 *
 * La app no tiene login ni multiusuario — todo vive bajo un único dueño
 * (`DEFAULT_OWNER_ID`). Desplegada en una URL pública eso significa que
 * cualquiera que la encuentre ve el armario, borra prendas y gasta la cuota de
 * los servicios de pago. Esto es lo mínimo que lo impide.
 *
 * Sin `APP_PASSWORD` no pide nada, para que `npm run dev` en local siga siendo
 * inmediato. En el despliegue la variable es obligatoria. El usuario sale de
 * `APP_USER`, y si no está, de "admin".
 *
 * Hay un segundo par opcional (`APP_USER_2`/`APP_PASSWORD_2`) para un segundo
 * armario: quien entra decide de quién es el armario que ve. El middleware lo
 * pasa a las rutas en la cabecera `x-owner-id`, que **siempre** sobrescribe:
 * si dejara pasar la del cliente, cualquiera podría leer el armario del otro.
 */

import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_OWNER_ID, OWNER_HEADER, owners } from "@/lib/owners";

export function middleware(request: NextRequest) {
  // Sin `APP_PASSWORD` no hay puerta (local): todo es del dueño por defecto.
  if (!process.env.APP_PASSWORD) return asOwner(request, DEFAULT_OWNER_ID);

  const header = request.headers.get("authorization");

  if (header?.startsWith("Basic ")) {
    // atob en vez de Buffer: el middleware corre en el runtime Edge.
    const [user, ...rest] = atob(header.slice(6)).split(":");
    const password = rest.join(":");
    // Se comprueban todos sin cortar al primero que acierta, para que el
    // tiempo de respuesta no delate cuál de los usuarios existe.
    let matched: string | null = null;
    for (const owner of owners()) {
      if (timingSafeEqual(password, owner.password) && user === owner.name) matched = owner.id;
    }
    if (matched !== null) return asOwner(request, matched);
  }

  return new NextResponse("Acceso restringido.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Armario Inteligente", charset="UTF-8"' },
  });
}

/** Deja pasar la petición con el dueño fijado, pise lo que pise el cliente. */
function asOwner(request: NextRequest, ownerId: string) {
  const headers = new Headers(request.headers);
  headers.set(OWNER_HEADER, ownerId);
  return NextResponse.next({ request: { headers } });
}

/**
 * Comparación de tiempo constante. Con una sola contraseña el ataque de
 * temporización es poco realista, pero cuesta cuatro líneas y es lo correcto en
 * un camino de autenticación.
 */
function timingSafeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  // charCodeAt fuera de rango devuelve NaN, y `NaN | 0` es 0.
  for (let i = 0; i < length; i++) {
    diff |= (a.charCodeAt(i) | 0) ^ (b.charCodeAt(i) | 0);
  }
  return diff === 0;
}

export const config = {
  // Todo menos los estáticos de Next y el favicon: no hace falta autenticar un
  // fichero de JavaScript, y pedirlo rompe la carga de la página del 401.
  // `api/cron` tampoco: Vercel Cron no manda Basic Auth y esa ruta comprueba
  // `CRON_SECRET` por su cuenta.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/cron/).*)"],
};
