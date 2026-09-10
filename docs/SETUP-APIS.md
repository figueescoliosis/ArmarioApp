# Dar de alta las APIs de Armario Inteligente

Este documento es un guion operativo, pensado para que una sesión de Claude
Code con control de navegador lo siga paso a paso en el ordenador del
usuario. Cada paso dice qué URL abrir, qué pulsar, qué copiar y a qué
variable de `.env.local` va.

Hacen falta tres cuentas: Supabase, un proveedor de recorte de fondo (fal.ai
por defecto) y Anthropic. Las tres son obligatorias salvo que se indique lo
contrario.

Antes de empezar, si no existe todavía:

```bash
cp .env.example .env.local
```

Todas las variables de este documento se rellenan en ese archivo. Nunca se
commitea: está en `.gitignore`.

---

## A. Supabase (obligatorio)

Base de datos y almacenamiento de imágenes.

1. Abrir https://supabase.com/dashboard y crear una cuenta (o iniciar sesión).
2. Pulsar **New project**.
   - Elegir una organización (crear una si es la primera vez).
   - Nombre del proyecto: el que se quiera, por ejemplo `armario-inteligente`.
   - Generar y guardar una contraseña de base de datos (no hace falta
     recordarla para esta app: no se usa fuera del panel).
   - Región: la más cercana a España, normalmente **West EU (Ireland)** o la
     alternativa europea que ofrezca el desplegable.
   - Plan: **Free**.
   - Pulsar **Create new project** y esperar a que termine de aprovisionarse
     (uno o dos minutos).
3. Copiar la URL del proyecto y la clave de servidor.
   - Menú lateral → **Settings** → **API**.
   - En **Project URL** copiar el valor y pegarlo en `.env.local` como
     `NEXT_PUBLIC_SUPABASE_URL`.
   - En **Project API keys** buscar la fila **service_role** (no la
     `anon`/`public`), pulsar el icono de ojo o copiar, y pegarla en
     `.env.local` como `SUPABASE_SERVICE_ROLE_KEY`.
   - **Advertencia importante**: la `service_role` key se salta cualquier
     política de seguridad de la base de datos (RLS). Solo el servidor de la
     app la usa, nunca debe llegar al navegador ni a un repositorio público.
     Por eso `.env.local` está en `.gitignore` — verificar que sigue ahí antes
     de continuar.
4. Ejecutar la migración inicial.
   - Menú lateral → **SQL Editor** → **New query**.
   - Abrir el archivo `supabase/migrations/0001_init.sql` del repositorio,
     copiar todo su contenido y pegarlo en el editor.
   - Pulsar **Run** (o Ctrl/Cmd+Enter).
   - Comprobar que dice "Success. No rows returned".
5. Verificar que las tablas existen.
   - Menú lateral → **Table Editor**.
   - Deben aparecer cuatro tablas: `garments`, `outfits`, `outfit_items` y
     `wear_log`.
6. Crear el bucket de Storage.
   - Menú lateral → **Storage** → **New bucket**.
   - Nombre exacto: `garments` (así lo espera el código, en
     `src/lib/db/supabase.ts`).
   - Activar **Public bucket**.
   - Pulsar **Create bucket**.
   - No hace falta configurar ninguna política adicional: las subidas y
     borrados los hace siempre el servidor con la `service_role` key, que se
     salta RLS, y las lecturas son públicas porque el bucket ya lo es.

---

## B. Recorte de fondo — fal.ai (obligatorio con la configuración por defecto)

La variable `BG_REMOVAL_PROVIDER` decide qué servicio recorta el fondo de
cada foto. Por defecto vale `fal`, así que estos pasos son obligatorios salvo
que en el paso final se elija otro proveedor.

1. Abrir https://fal.ai/dashboard/keys y crear una cuenta.
2. Añadir un método de pago. fal.ai es de pago por uso (no tiene plan
   gratuito con cuota); lo pide antes de generar claves.
3. Generar una API key nueva desde esa misma pantalla (**Dashboard → Keys**).
4. Copiarla en `.env.local` como `FAL_KEY`.
5. Dejar `BG_REMOVAL_PROVIDER=fal` (ya viene así en `.env.example`).

El coste es bajo: el comentario en `src/lib/ai/background/fal.ts` lo describe
como "unas milésimas de euro por imagen". El modelo usado es BiRefNet v2, que
según ese mismo archivo da mejores bordes que los recortadores genéricos en
tejidos de punto, flecos o transparencias.

### Alternativas (opcional)

Si se prefiere no dar de alta fal.ai, basta con cambiar
`BG_REMOVAL_PROVIDER` y rellenar la clave del proveedor elegido. Nunca hacen
falta las tres claves a la vez, solo la del proveedor activo.

- **Photoroom** — `BG_REMOVAL_PROVIDER=photoroom`
  1. Abrir https://www.photoroom.com/api y crear una cuenta.
  2. Generar una API key desde el panel de desarrollador.
  3. Copiarla en `.env.local` como `PHOTOROOM_API_KEY`.

- **remove.bg** — `BG_REMOVAL_PROVIDER=removebg`
  1. Abrir https://www.remove.bg/dashboard#api-key y crear una cuenta.
  2. Generar una API key desde esa pantalla.
  3. Copiarla en `.env.local` como `REMOVE_BG_API_KEY`.
  4. Según el comentario del propio código
     (`src/lib/ai/background/removebg.ts`), este proveedor da bordes más
     duros que fal.ai en ropa de punto o prendas translúcidas — es la opción
     más conocida, no la de mejor calidad.

---

## C. Anthropic (obligatorio)

Etiqueta cada prenda con Claude Vision y, si se activa, redacta las
explicaciones de los conjuntos.

1. Abrir https://console.anthropic.com/settings/keys y crear una cuenta.
2. Añadir saldo (**Settings → Billing** o el aviso que aparezca al intentar
   generar una clave sin saldo). Es de pago por uso, sin gasto mínimo previo
   más allá de la recarga inicial que pida la consola.
3. Volver a **Settings → API Keys**, pulsar **Create Key**, darle un nombre
   (por ejemplo `armario-inteligente`) y copiar el valor mostrado — solo se
   ve una vez.
4. Pegarlo en `.env.local` como `ANTHROPIC_API_KEY`.
5. Modelo: por defecto la app usa `claude-opus-5`
   (`src/lib/ai/tagging/claude.ts`). Para cambiarlo, descomentar y editar
   `ANTHROPIC_MODEL` en `.env.local`. No hace falta tocarlo para que la app
   funcione.

---

## Comprobar que todo funciona

Con las tres claves puestas en `.env.local`:

```bash
npm install
cp .env.example .env.local   # si no se hizo antes; luego rellenar las claves
npm run dev
```

Abrir http://localhost:3000.

### Prueba de humo end-to-end

1. Ir a `/subir`.
2. Subir la foto de una prenda (una foto sobre fondo relativamente liso da
   mejor resultado). Esperar al recorte y al etiquetado automático —
   `src/app/api/garments/analyze/route.ts` tiene hasta 60 segundos de margen
   para las dos llamadas juntas.
3. Comprobar que la imagen que aparece ya tiene el fondo eliminado y que los
   campos de categoría, colores, estilo, etc. vienen rellenos. Revisarlos o
   corregirlos y confirmar el alta.
4. Repetir el paso 2-3 con una segunda prenda de una categoría distinta (por
   ejemplo, un top y un pantalón), porque el motor de conjuntos necesita al
   menos dos prendas para combinar.
5. Ir a `/outfits` y generar conjuntos. Deben aparecer combinaciones
   puntuadas con una explicación breve.
6. Opcional: en `/armario` comprobar que ambas prendas aparecen en la
   rejilla con su miniatura.

### Si algo falla: de qué variable depende cada error

La app responde siempre con un código de `src/lib/types.ts`
(`ApiErrorCode`). Cuando falta una clave, el código es siempre
`MISSING_CONFIG` y la respuesta incluye `missingEnvVar` con el nombre exacto
de la variable que falta (lo genera `MissingConfigError` en
`src/lib/errors.ts` y lo traduce `handle()` en `src/lib/api.ts`).

| Síntoma / código de error | Variable que probablemente falta |
|---|---|
| `MISSING_CONFIG` mencionando `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase (paso A.3) |
| `MISSING_CONFIG` mencionando `SUPABASE_SERVICE_ROLE_KEY` | Clave `service_role` de Supabase (paso A.3) |
| `MISSING_CONFIG` mencionando `FAL_KEY` (con `BG_REMOVAL_PROVIDER=fal`) | Clave de fal.ai (paso B) |
| `MISSING_CONFIG` mencionando `PHOTOROOM_API_KEY` o `REMOVE_BG_API_KEY` | Falta la clave del proveedor de recorte que se haya elegido |
| `MISSING_CONFIG` mencionando `ANTHROPIC_API_KEY` | Clave de Anthropic (paso C) |
| `BACKGROUND_REMOVAL_FAILED` | La clave existe pero el proveedor de recorte respondió con error (revisar saldo/cuota, o que la imagen sea un formato admitido) |
| `TAGGING_FAILED` | Claude respondió con error o con un formato que no encaja con el esquema esperado (revisar saldo de Anthropic) |
| `STORAGE_FAILED` / error subiendo a Supabase Storage | El bucket `garments` no existe o no es público (paso A.6) |
| "Hacen falta al menos dos prendas..." (`BAD_REQUEST` en `/outfits/generate`) | No es un problema de configuración: falta subir una segunda prenda de otra categoría |
