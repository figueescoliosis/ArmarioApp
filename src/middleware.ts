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
 */

import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return NextResponse.next();

  // El usuario también es configurable; "admin" es lo que había antes de que
  // lo fuera, así que un despliegue sin `APP_USER` sigue funcionando igual.
  const expectedUser = process.env.APP_USER || "admin";

  const header = request.headers.get("authorization");

  if (header?.startsWith("Basic ")) {
    // atob en vez de Buffer: el middleware corre en el runtime Edge.
    const [user, ...rest] = atob(header.slice(6)).split(":");
    if (user === expectedUser && timingSafeEqual(rest.join(":"), expected)) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Acceso restringido.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Armario Inteligente", charset="UTF-8"' },
  });
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
