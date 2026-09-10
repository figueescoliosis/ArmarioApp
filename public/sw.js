// Service worker del Armario Inteligente.
//
// Estrategia:
// - Navegaciones (documentos HTML): network-first. Si la red falla, se cae
//   a la caché del App Shell. Así nunca se queda pegada una versión vieja
//   de la app cuando hay conexión.
// - Estáticos (JS, CSS, fuentes, iconos) e imágenes de prendas: cache-first.
//   Son inmutables una vez publicados/subidos y además pesados (las fotos de
//   ropa), así que evitar la red en cada carga ahorra datos y tiempo.
// - `/api/*`: siempre red, nunca caché. Cachear la subida de una prenda o la
//   generación de un conjunto serviría respuestas obsoletas o, peor,
//   reproduciría una escritura que no debía repetirse.

// Súbela cada vez que cambie el contenido del App Shell: es lo que fuerza
// a los clientes a descartar la caché antigua en `activate`.
const CACHE_VERSION = "v1";
const SHELL_CACHE = `armario-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `armario-runtime-${CACHE_VERSION}`;
const CURRENT_CACHES = [SHELL_CACHE, RUNTIME_CACHE];

// Lo mínimo imprescindible para que la app arranque sin red. El resto de
// estáticos se va cacheando bajo demanda en el runtime cache (cache-first).
const APP_SHELL_URLS = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // `addAll` falla entero si una sola URL da error: las añadimos una a
      // una para que un icono que aún no exista no tumbe la instalación.
      await Promise.all(
        APP_SHELL_URLS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`[sw] no se pudo precachear ${url}`, err);
          }),
        ),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => !CURRENT_CACHES.includes(name))
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Nunca tocar la API: ni las lecturas ni, sobre todo, las escrituras
  // (subida de prendas, generación de outfits) deben pasar por caché.
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isStaticAsset(url) || isGarmentImage(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest" ||
    /\.(?:js|css|woff2?|ttf)$/.test(url.pathname)
  );
}

function isGarmentImage(url) {
  // Fotos originales y recortes de prendas: inmutables una vez generadas.
  return (
    url.pathname.startsWith("/garments/") ||
    /\.(?:png|jpe?g|webp|avif|gif|svg)$/.test(url.pathname)
  );
}

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const shell = await cache.match("/");
    if (shell) return shell;
    throw new Error("Sin conexión y sin App Shell en caché.");
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}
