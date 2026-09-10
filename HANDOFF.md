# Handoff

Estado del proyecto en el punto en que se entrega: código completo, tipado en
verde, tests en verde. Sin claves de API dadas de alta todavía, así que la
parte que depende de servicios externos no se ha probado con datos reales.

## Arrancar en local

```bash
git clone https://github.com/figueescoliosis/ArmarioApp.git
cd ArmarioApp
git checkout claude/smart-wardrobe-app-vkdlkz
npm install
cp .env.example .env.local
```

Rellenar `.env.local` con las claves (ver siguiente sección) y luego:

```bash
npm run dev
```

La app queda en http://localhost:3000.

## Dar de alta las API keys con Claude Code

Instalar Claude Code si no está ya:

```bash
npm i -g @anthropic-ai/claude-code
claude
```

Dentro de la sesión, pedirle:

> lee docs/SETUP-APIS.md y ayúdame a dar de alta las API keys

Ese documento está escrito para que Claude Code, con control del navegador,
cree las cuentas de Supabase, fal.ai y Anthropic paso a paso y deje
`.env.local` relleno.

## Qué está verificado y qué no

Verificado en esta entrega:

- Compilación (`npm run build`) y tipos (`npm run typecheck`) en verde.
- El motor de conjuntos (`src/lib/outfits/generator.ts` y el resto de
  `src/lib/outfits/`) tiene 80 tests pasando (`npm run test`), incluida la
  puntuación por color, las reglas de compatibilidad y el generador
  combinatorio. Es determinista y no depende de ninguna API, así que es la
  parte del proyecto en la que más se puede confiar sin haberla probado a
  mano.

Todavía sin verificar, porque se construyó sin claves activas:

- La subida real de imágenes a Supabase Storage (el código está escrito y
  compila, pero no se ha ejecutado contra un proyecto Supabase real).
- La calidad del recorte de fondo de fal.ai sobre una foto real de una
  prenda (bordes en tejidos de punto, encaje, transparencias — es justo lo
  que el proveedor promete hacer mejor, pero no se ha comprobado).
- La precisión del etiquetado de Claude Vision: si acierta categoría,
  colores, material y estilo sobre fotos reales del armario del usuario.

La prueba de humo descrita al final de `docs/SETUP-APIS.md` (subir dos
prendas y generar conjuntos) es la forma más rápida de comprobar estos tres
puntos de una vez.

## Siguientes pasos naturales

- **Registrar qué se lleva puesto cada día.** El esquema ya tiene la tabla
  `wear_log` y el endpoint `POST /api/garments/[id]/wear`
  (`src/app/api/garments/[id]/wear/route.ts`); falta solo la pantalla o el
  botón en la UI que lo dispare desde `/armario` u `/outfits`.
- **Login con Supabase Auth.** Todas las tablas ya llevan `owner_id` con
  valor por defecto `'default'` (ver `supabase/migrations/0001_init.sql` y
  `DEFAULT_OWNER_ID` en `src/lib/db/supabase.ts`), pensado explícitamente
  para que pasar a multiusuario sea sustituir ese valor fijo por el usuario
  autenticado, sin tocar el esquema.
- **Desplegar en Vercel**, que es el hosting más directo para una app
  Next.js. Solo hace falta configurar las mismas variables de entorno de
  `.env.local` en el panel del proyecto.
- **Ajustar la matriz de reglas de compatibilidad** (`src/lib/outfits/rules.ts`)
  con los gustos reales del usuario una vez pruebe el generador con su
  armario, en vez de dejarla como quedó a partir de supuestos genéricos de
  estilismo.
- **Añadir un service worker más completo.** Ya existe `public/sw.js` y el
  manifest de PWA, pero conviene revisar la estrategia de caché una vez la
  app tenga tráfico real, para que funcione bien offline con el armario ya
  cargado.
