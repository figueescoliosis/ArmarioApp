@AGENTS.md

# Armario Inteligente

PWA en español que cataloga el armario de una persona a partir de fotos:
recorta el fondo, etiqueta cada prenda con un modelo de visión y compone
conjuntos con un motor de reglas. Next.js 16 (App Router) + Supabase.

`README.md` explica el pipeline y la estructura de `src/`. Este archivo
recoge lo que hace falta para *cambiar* el código sin romper nada.

## Comandos

```bash
npm run dev        # desarrollo en http://localhost:3000
npm run test       # Vitest, 109 tests, ninguno toca la red
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint
npm run build      # build de producción (más estricto que typecheck, ver abajo)
```

`npm run typecheck` y `npm run build` **no** comprueban lo mismo: el build
aplica `noUncheckedIndexedAccess` sobre los tests y `typecheck` se lo salta.
Un cambio puede pasar `typecheck` y tumbar el despliegue. Antes de dar por
buena una tarea, `npm run build`.

## Invariantes

Romper cualquiera de estos es un bug aunque los tests pasen.

1. **Ninguna clave llega al navegador.** El cliente solo habla con
   `/api/*`; los Route Handlers son los únicos que hablan con Supabase y con
   las APIs de IA. `src/lib/db/supabase.ts` lanza en tiempo de ejecución si
   detecta `window`, porque `server-only` no está instalado.
2. **`src/lib/client-api.ts` es el único `fetch` del cliente.** Las páginas
   llaman a esas funciones, nunca a `fetch` directamente.
3. **El motor de conjuntos es determinista y no usa red.** Mismo armario y
   misma petición ⇒ mismos conjuntos en el mismo orden. Es lo que permite
   testear `generator.ts` y `rules.ts` sin un solo mock. Cualquier llamada de
   red que entre ahí destruye la suite.
4. **El modelo es siempre opcional en los conjuntos.**
   `src/lib/outfits/explain.ts` solo reordena y redacta el top 5. Si falla, si
   tarda o si no hay clave, devuelve los conjuntos de reglas sin tocar. La app
   nunca depende de ese paso.
5. **La subida es en dos pasos.** `POST /api/garments/analyze` recorta,
   normaliza, etiqueta y sube imágenes, pero **no escribe en la base de
   datos**: devuelve un borrador. `POST /api/garments` guarda la fila una vez
   el usuario ha revisado las etiquetas.
6. **Toda respuesta de `/api/*` tiene la forma `ApiResponse<T>`.** Se
   construye con `ok()` / `fail()` / `handle()` de `src/lib/api.ts`; el cliente
   solo mira `ok`. No devolver `NextResponse.json` a mano.
7. **`src/lib/outfits/score.ts` no puede importar `generator.ts` ni
   `signature.ts`.** El probador puntúa en el navegador y esos dos módulos
   arrastran `node:crypto`, que rompe el build del cliente. Por eso la
   puntuación vive en `score.ts` y el generador la importa de ahí, y no al
   revés. Es también lo que garantiza que el mismo conjunto no muestre un
   porcentaje en `/probador` y otro en `/outfits`.
8. **Falta de configuración = `MissingConfigError`.** Lleva el nombre exacto
   de la variable ausente hasta la interfaz (`missingEnvVar`). Nunca degradar
   en silencio por una clave que falta, salvo en `explain.ts`, donde es
   deliberado.

## Dónde tocar qué

| Quiero… | Voy a… |
|---|---|
| Añadir un proveedor de recorte | `src/lib/ai/background/`, registrarlo en el mapa `PROVIDERS` de su `index.ts` |
| Añadir un proveedor de etiquetado | `src/lib/ai/tagging/`, registrarlo en `PROVIDERS` de `tagging/index.ts` |
| Cambiar qué combina con qué | `src/lib/outfits/rules.ts` (plantillas, tipos de prenda, incompatibilidades) |
| Cambiar cuánto pesa el color frente al resto | `WEIGHTS` en `src/lib/outfits/score.ts` |
| Cambiar qué se avisa como «Mis-match» | `collectIssues()` en `src/lib/outfits/score.ts` |
| Añadir un campo a la prenda | `src/lib/types.ts` → `supabase/migrations/` → `src/lib/db/schema.ts` (los tres, en ese orden) |
| Cambiar el tamaño del recorte o la miniatura | constantes al principio de `src/lib/ai/postprocess.ts` |
| Proteger o abrir rutas | `src/middleware.ts` (`config.matcher`) |

`src/lib/types.ts` es el contrato: todo lo que cruza una frontera
(cliente↔API, API↔Postgres) se declara ahí una vez. `src/lib/db/schema.ts`
traduce entre el snake_case de Postgres y esos tipos, con funciones puras.

## Proveedores de IA

Dos selectores por variable de entorno, con la misma forma:

| Variable | Valores | Por defecto |
|---|---|---|
| `BG_REMOVAL_PROVIDER` | `fal`, `photoroom`, `removebg` | `fal` |
| `TAGGING_PROVIDER` | `anthropic`, `gemini` | `anthropic` |

Solo hace falta la clave del proveedor activo. `src/lib/ai/gemini.ts` es la
llamada JSON compartida por el etiquetado y la redacción de conjuntos: va por
REST y no por SDK a propósito, son treinta líneas de `fetch` y ahorra una
dependencia. Valida siempre con Zod, igual que `messages.parse()` en el lado
de Claude.

`explain.ts` no tiene selector: usa Claude si hay `ANTHROPIC_API_KEY` y Gemini
si no. Con una sola clave configurada no hay nada que decidir.

El modelo de Gemini está fijado a una versión concreta
(`gemini-3.5-flash`) y no al alias `gemini-flash-latest`, que responde 503 por
saturación. Hay un comentario `ponytail:` en `src/lib/ai/gemini.ts` con el
camino de vuelta al alias.

## Sin login

No hay usuarios. Todas las filas cuelgan de `DEFAULT_OWNER_ID = "default"`
(`src/lib/db/supabase.ts`), centralizado ahí para que añadir multiusuario sea
un cambio en un solo sitio.

Como consecuencia, `src/middleware.ts` pone un Basic Auth (usuario `admin`,
contraseña en `APP_PASSWORD`) delante de todo. Sin esa variable no pide nada,
que es lo cómodo en local; **en cualquier despliegue es obligatoria**, porque
si no cualquiera que dé con la URL ve el armario, borra prendas y gasta las
cuotas de los servicios externos.

Nunca poner una contraseña real en un fixture de test: el repo es público.

## Base de datos

Cuatro tablas: `garments`, `outfits`, `outfit_items`, `wear_log`. El esquema
vive en `supabase/migrations/0001_init.sql`, es idempotente donde tiene
sentido y se ejecuta pegándolo en el SQL Editor de Supabase.

Las imágenes van al bucket público `garments` de Supabase Storage, en tres
tamaños por prenda: `original.jpg`, `cutout.png` (1024² transparente) y
`thumb.webp` (320²).

RLS está activado en las cuatro tablas y **no hay políticas**: el servidor usa
la secret key, que se salta RLS, y así la Data API no queda abierta con la
clave anon. Si algún día hay login, habrá que escribir políticas.

## Tests

Vitest, sin framework de mocks más allá de `vi.spyOn(globalThis, "fetch")`.
`tests/fixtures.ts` construye prendas y armarios de prueba con ids estables
(`resetIds()` entre tests).

- `color`, `rules`, `generator`, `evaluate`, `schema`, `image` — lógica pura, sin red.
- `tagging`, `explain` — el `fetch` a Gemini interceptado.
- `middleware` — la puerta de Basic Auth.

## Despliegue

Vercel, proyecto `armario-app`. La rama de producción es
`claude/smart-wardrobe-app-vkdlkz`: cada push a ella redespliega.

Dos cosas que muerden:

- **El repo tiene que seguir siendo público.** En plan Hobby con repo privado,
  Vercel bloquea el build si el autor del commit no coincide con el dueño del
  proyecto, y aquí no coinciden.
- **Las variables de entorno se leen en el build.** Cambiar una en Vercel no
  hace nada hasta que se redespliega.

## Idioma

Todo el proyecto está en español: la interfaz, los comentarios, los mensajes
de error, los nombres de los tests y los mensajes de commit. Los
identificadores del código son en inglés (`garment`, `outfit`, `slot`), salvo
los valores de dominio que el usuario llega a ver, que van en español
(`"primavera"`, `"vaquero recto"`). Mantener esa mezcla tal cual.
