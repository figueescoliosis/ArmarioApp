/**
 * Registro del service worker desde el cliente.
 *
 * Solo en producción: en desarrollo el service worker cachearía respuestas
 * mientras Next recompila, dando la sensación de cambios que no se aplican.
 * Cualquier fallo se traga y se registra en consola: la PWA es una mejora,
 * nunca debe romper la app si el registro falla (navegador sin soporte,
 * `/sw.js` bloqueado, etc.).
 */
export function registerServiceWorker(): void {
  if (typeof window === "undefined") return;
  if (process.env.NODE_ENV !== "production") return;
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err: unknown) => {
      console.error("No se ha podido registrar el service worker:", err);
    });
  });
}
