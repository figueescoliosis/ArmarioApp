/**
 * Los dueños de armario que conoce la app.
 *
 * No hay login: cada persona entra por el Basic Auth del middleware con su
 * propio usuario y contraseña, y eso decide de quién es el armario que ve. El
 * primero (`APP_USER`/`APP_PASSWORD`) es el dueño `"default"`, que es el que
 * tenían todas las filas antes de que hubiera dos; el segundo es opcional.
 *
 * Sin imports de Node: lo usa el middleware, que corre en el runtime Edge.
 */

export interface Owner {
  /** Valor de `owner_id` en la base de datos. */
  id: string;
  /** Usuario del Basic Auth, que es también el nombre que ve la interfaz. */
  name: string;
  password: string;
}

export const DEFAULT_OWNER_ID = "default";

/** Cabecera con la que el middleware pasa el dueño autenticado a las rutas. */
export const OWNER_HEADER = "x-owner-id";

export function owners(): Owner[] {
  const list: Owner[] = [];

  const password = process.env.APP_PASSWORD;
  if (password) {
    list.push({ id: DEFAULT_OWNER_ID, name: process.env.APP_USER || "admin", password });
  }

  const name2 = process.env.APP_USER_2?.trim();
  const password2 = process.env.APP_PASSWORD_2;
  if (name2 && password2) {
    list.push({ id: name2.toLowerCase(), name: name2, password: password2 });
  }

  return list;
}

/** El otro armario, o `null` si solo hay un dueño configurado. */
export function partnerOf(ownerId: string): Owner | null {
  return owners().find((owner) => owner.id !== ownerId) ?? null;
}
