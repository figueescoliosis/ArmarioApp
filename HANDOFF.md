# Handoff

Estado del proyecto: desplegado y funcionando de punta a punta con datos
reales. Tipos, lint y 109 tests en verde.

## Estado de los servicios

| Pieza | Servicio | Estado |
|---|---|---|
| Base de datos y Storage | Supabase, plan Free, West EU (Ireland) | Migración aplicada, 4 tablas con RLS, bucket público `garments` |
| Recorte de fondo | remove.bg | Funcionando. 50 imágenes al mes gratis, a 0,25 MP |
| Etiquetado y redacción | Google Gemini (AI Studio) | Funcionando. Cuota diaria gratuita, sin tarjeta |
| Hosting | Vercel, plan Hobby | Desplegado, con Basic Auth delante |

La combinación elegida no cuesta nada. Ni fal.ai ni Anthropic tienen plan
gratuito, y por eso se añadieron `removebg` y `gemini` como proveedores: el
apartado D de `docs/SETUP-APIS.md` lo explica con sus límites reales.

Cambiar a los proveedores de pago es cambiar dos variables de entorno
(`BG_REMOVAL_PROVIDER=fal`, `TAGGING_PROVIDER=anthropic`) y añadir sus claves.
No hay que tocar código.

## Arrancar en local

```bash
git clone https://github.com/figueescoliosis/ArmarioApp.git
cd ArmarioApp
git checkout claude/smart-wardrobe-app-vkdlkz
npm install
cp .env.example .env.local
```

Rellenar `.env.local` siguiendo `docs/SETUP-APIS.md` y luego:

```bash
npm run dev
```

`APP_PASSWORD` puede quedarse vacía en local: sin ella el middleware no pide
credenciales.

## Qué está verificado

Probado contra los servicios reales, no solo compilado:

- **Pipeline completo de subida**, cinco prendas reales: recorte, normalizado,
  etiquetado y guardado. El recorte de remove.bg sale limpio (comprobado a
  tamaño completo, 1024² con fondo transparente y bordes correctos hasta en
  los cordones de una zapatilla). El etiquetado de Gemini acierta categoría,
  subcategoría, colores, material, formalidad y temporadas.
- **Generación de conjuntos** sobre esas cinco prendas, y la casilla *Afinar
  con IA*, que devuelve nombres y explicaciones concretas — incluida una
  crítica honesta del conjunto más flojo.
- **Basic Auth en producción**: sin credenciales y con credenciales
  incorrectas devuelve 401 tanto la web como `/api/*`.
- **Tiempos en producción**: el análisis completo tarda unos 7,5 s (recorte
  1,2 s + modelo 5,1 s + subida 0,9 s), muy por debajo del límite de 60 s de
  las funciones de Vercel. En local va entre 9 y 14 s.

Sin verificar:

- Los proveedores de pago (fal.ai, Photoroom, Anthropic): el código está
  escrito y tipado, pero nunca se ha ejecutado con una clave activa.
- El comportamiento offline del service worker con tráfico real.
- El generador con un armario grande. Está acotado por diseño
  (`MAX_CANDIDATES_PER_SLOT`, `ENRICH_TOP_N` en `generator.ts`) pero solo se ha
  probado con cinco prendas.

## Deuda conocida

- **`panconpalta` quedó en el commit `14b77a4`**, cuando el repo aún era
  privado, por usar la contraseña real como fixture del test del middleware.
  El repo es público desde entonces, así que esa contraseña está quemada y ya
  se rotó. Los tests usan un valor ficticio.
- **El repo tiene que seguir siendo público** para que Vercel construya: en
  plan Hobby con repo privado bloquea el build porque el autor de los commits
  no coincide con el dueño del proyecto de Vercel.
- **El modelo de Gemini está fijado** a `gemini-3.5-flash` en vez del alias
  `gemini-flash-latest`, que a día de hoy responde 503 por saturación. Hay un
  comentario `ponytail:` en `src/lib/ai/gemini.ts` con el camino de vuelta.

## Siguientes pasos naturales

- **Registrar qué se lleva puesto cada día.** El esquema ya tiene la tabla
  `wear_log` y el endpoint `POST /api/garments/[id]/wear`; falta el botón en
  la UI que lo dispare desde `/armario` u `/outfits`. El generador ya usa esa
  información (`freshnessScore`), así que hoy ese factor está siempre a cero.
- **Login con Supabase Auth.** Todas las tablas llevan `owner_id` con valor
  por defecto `'default'`, pensado para que pasar a multiusuario sea sustituir
  `DEFAULT_OWNER_ID` por el usuario autenticado sin tocar el esquema. Haría
  falta escribir políticas RLS, que hoy no existen. Eso permitiría además
  quitar el Basic Auth del middleware.
- **Ajustar la matriz de compatibilidad** (`src/lib/outfits/rules.ts`) con los
  gustos reales del usuario, en vez de dejarla como quedó a partir de
  supuestos genéricos de estilismo.
- **Vigilar la cuota de remove.bg.** Son 50 imágenes al mes y no avisa: al
  agotarse, la subida falla con `BACKGROUND_REMOVAL_FAILED`. Si se queda
  corta, la alternativa gratis es recortar en local con un modelo ONNX; la de
  pago, volver a `BG_REMOVAL_PROVIDER=fal`.
- **Revisar la estrategia de caché del service worker** (`public/sw.js`) para
  que la app funcione offline con el armario ya cargado.
