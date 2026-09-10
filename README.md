# Armario Inteligente

PWA que cataloga el armario de una persona a partir de fotos: recorta el
fondo, etiqueta cada prenda con IA y genera conjuntos combinando lo que hay
guardado. No tiene login: todo el armario pertenece a un único usuario
implícito.

## Arrancar

Requisitos: Node 20 o superior, y las claves de Supabase, un proveedor de
recorte de fondo y Anthropic (ver `docs/SETUP-APIS.md` para darlas de alta
paso a paso).

```bash
npm install
cp .env.example .env.local   # y rellenar las claves
npm run dev
```

La app queda en http://localhost:3000.

## El pipeline

Subir una prenda:

```
foto ──▶ recorte de fondo ──▶ normalizado ──▶ etiquetado ──▶ base de datos
        (fal / photoroom /    (centrado en    (Claude Vision   (Supabase:
         remove.bg, según      lienzo 1024²,    sobre el        fila +
         BG_REMOVAL_PROVIDER)  miniatura webp,  recorte, no      Storage)
                                paleta real)     la foto
                                                 original)
```

Ese recorrido ocurre en `POST /api/garments/analyze` y **no** guarda nada
todavía: devuelve un borrador para que el usuario lo revise. La fila se
escribe aparte, en `POST /api/garments`, una vez confirmado (ver
"Arquitectura" más abajo).

Generar conjuntos:

```
armario ──▶ motor de reglas (determinista, sin red) ──▶ conjuntos puntuados
                                    │
                                    └─▶ opcional: Claude reordena
                                        y redacta el top 5
```

## Estructura de `src/`

- **`app/`** — rutas de Next.js (App Router). Páginas: `/` (portada),
  `/subir` (dar de alta una prenda), `/armario` (rejilla del armario),
  `/outfits` (generar conjuntos), `/favoritos` (conjuntos guardados). Bajo
  `api/` viven los Route Handlers: `garments/`, `garments/[id]`,
  `garments/[id]/wear`, `garments/analyze`, `outfits/generate` y
  `outfits/favorites`.
- **`components/`** — componentes de React. `ui/` tiene los básicos
  reutilizables (botón, spinner, chip, estado vacío); `upload/` cubre el
  flujo de subida (captura de foto, recorte manual, revisión de etiquetas);
  `outfits/` pinta las tarjetas y el carrusel de conjuntos; `wardrobe/`
  pinta la rejilla del armario y su filtro por categoría. `Navigation.tsx` es
  la barra de navegación inferior y `ServiceWorkerRegistrar.tsx` registra el
  service worker de la PWA al montar la app.
- **`lib/ai/`** — integraciones de IA del servidor. `background/` abstrae el
  recorte de fondo detrás de una interfaz común (`fal.ts`, `photoroom.ts`,
  `removebg.ts`, elegidos por `BG_REMOVAL_PROVIDER`); `tagging/claude.ts`
  etiqueta la prenda con Claude Vision; `postprocess.ts` normaliza el recorte
  y extrae la paleta de color real.
- **`lib/image/`** — preparación de la foto en el propio navegador antes de
  subirla: `prepare.ts` redimensiona y comprime, `exif.ts` corrige la
  orientación cuando el navegador no lo hace solo, `crop.ts` aplica el
  recorte manual que el usuario ajusta en pantalla.
- **`lib/db/`** — acceso a Supabase. `supabase.ts` crea el cliente admin y
  gestiona el bucket de Storage; `schema.ts` traduce entre las filas
  snake_case de Postgres y los tipos de dominio; `garments.ts` y
  `outfits.ts` son las operaciones CRUD sobre cada tabla.
- **`lib/outfits/`** — el motor de conjuntos. `rules.ts` define qué huecos
  hay que llenar y qué combinaciones son imposibles; `color.ts` es la teoría
  del color (RGB/HSL/CIELAB) que mide armonía entre prendas; `generator.ts`
  hace la búsqueda combinatoria con poda; `signature.ts` calcula el hash
  estable de un conjunto; `explain.ts` es el paso opcional que deja a Claude
  reordenar y redactar el top 5.
- **`lib/types.ts`** — el contrato de tipos de toda la app: todo lo que cruza
  una frontera (cliente↔API, API↔base de datos) se define aquí una sola vez.
- **`lib/errors.ts`**, **`lib/api.ts`** — manejo de errores uniforme:
  `MissingConfigError` para configuración ausente, `ServiceError` para
  fallos de servicios externos, y `handle()`/`ok()`/`fail()` para que todas
  las respuestas de `/api/*` tengan la misma forma.
- **`lib/client-api.ts`** — el único sitio del cliente que hace `fetch` a
  `/api/*`; las páginas llaman a estas funciones, no a `fetch` directamente.
- **`lib/pwa.ts`** — registro del service worker, solo en producción.

## Arquitectura

Tres decisiones de diseño que no se ven a simple vista leyendo un archivo
suelto:

1. **El navegador nunca habla con Supabase ni con las APIs de IA.** Todo pasa
   por Route Handlers de Next.js (`src/app/api/**`). Es obligado por dos
   motivos a la vez: las claves de Supabase, fal.ai/Photoroom/remove.bg y
   Anthropic no pueden llegar al bundle del cliente, y como la app no tiene
   login, el servidor es el único sitio donde tiene sentido aplicar reglas
   (por ejemplo, cuál es la `service_role` key que se usa para escribir).
2. **El motor de conjuntos es determinista y no usa red.** Con el mismo
   armario y la misma petición, `generateOutfits()` devuelve siempre los
   mismos conjuntos en el mismo orden — es lo que permite testearlo con 80
   casos sin mocks. El modelo de lenguaje (`lib/outfits/explain.ts`) es un
   paso opcional encima: solo reordena y redacta el top 5, y si falla o no
   hay clave, la app sigue devolviendo los conjuntos de las reglas tal cual.
3. **La subida es en dos pasos.** `POST /api/garments/analyze` recorta,
   normaliza y etiqueta, pero no escribe en la base de datos: devuelve un
   borrador. `POST /api/garments` guarda la fila definitiva. Entre medias el
   usuario ve el recorte y corrige lo que la IA dedujo mal. Guardar
   directamente en el primer paso dejaría prendas mal etiquetadas en el
   armario cada vez que alguien cambia de opinión a mitad de la revisión.

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Arranca Next.js en desarrollo |
| `npm run build` | Compila la build de producción |
| `npm run start` | Sirve la build ya compilada |
| `npm run lint` | ESLint sobre todo el proyecto |
| `npm run typecheck` | `tsc --noEmit`, sin generar archivos |
| `npm run test` | Corre los tests con Vitest |
| `npm run test:watch` | Vitest en modo watch |

## Variables de entorno

Ver `docs/SETUP-APIS.md` para el paso a paso de cómo obtener cada valor.

| Variable | Obligatoria | Para qué |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Sí | URL del proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí | Clave de servidor de Supabase (se salta RLS; nunca al cliente) |
| `BG_REMOVAL_PROVIDER` | No (por defecto `fal`) | Elige el proveedor de recorte: `fal`, `photoroom` o `removebg` |
| `FAL_KEY` | Sí, si el proveedor es `fal` | Clave de fal.ai |
| `PHOTOROOM_API_KEY` | Sí, si el proveedor es `photoroom` | Clave de Photoroom |
| `REMOVE_BG_API_KEY` | Sí, si el proveedor es `removebg` | Clave de remove.bg |
| `ANTHROPIC_API_KEY` | Sí | Clave de Anthropic, para etiquetar prendas y redactar conjuntos |
| `ANTHROPIC_MODEL` | No (por defecto `claude-opus-5`) | Cambia el modelo de Claude usado |
