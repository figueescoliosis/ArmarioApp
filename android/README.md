# Nosotros

App Android privada para dos personas: un álbum de fotos compartido y un
widget en la pantalla de inicio de los dos que las va rotando. Gratis, sin
anuncios ni compras. Kotlin + Jetpack Compose + Glance, con Supabase (plan
gratuito) de servidor.

> Es independiente de la app web del Armario que vive en la raíz del repo:
> no comparten código, solo (si quieres) el proyecto de Supabase.

## 0. Antes de nada: Supabase

Una sola persona sigue [SETUP.md](SETUP.md) (unos 10 minutos): crea el
proyecto, activa el acceso anónimo y pega el SQL.

## 1. Instalar la APK en los dos teléfonos

La APK está en [`dist/Nosotros-debug.apk`](dist/Nosotros-debug.apk) (o la
compilas tú, ver abajo). Funciona en Android 8 o superior.

1. Pásala a cada teléfono: descárgala desde GitHub en el propio móvil, o
   mándatela por WhatsApp / Telegram / Drive / cable USB.
2. Ábrela desde **Archivos** o desde la notificación de descarga.
3. Android avisará de que viene de una «fuente desconocida»: toca
   **Configuración → Permitir de esta fuente** (para el navegador o la app
   desde la que la abriste) y vuelve atrás → **Instalar**.
4. Si Play Protect pregunta, **Instalar de todas formas** (es una app sin
   publicar en Play Store, por eso avisa).

## 2. Emparejarse

**Teléfono 1**

1. Abre Nosotros. Si la APK no trae la configuración, pega la URL y la clave
   pública de Supabase (SETUP.md, paso 4) → **Guardar y continuar**.
2. **Crear nuestro álbum**. Aparece un código de 6 caracteres.
3. Toca **Compartir invitación** y mándasela a tu pareja (WhatsApp, etc.).

**Teléfono 2**

1. Copia el mensaje de invitación **entero** (mantener pulsado → Copiar).
2. Abre Nosotros → **Pegar invitación**. Listo: configura el servidor y se
   une al álbum en un paso.

   (Si la APK ya trae la configuración, también vale escribir el código de 6
   caracteres y tocar **Unirme**.)

Cada álbum admite exactamente dos personas.

## 3. Usar el álbum

- **+** abre el selector de fotos (puedes elegir varias); el botón de la
  cámara hace una foto en el momento.
- Las fotos se reducen a 1080 px y JPEG calidad 80 antes de subirlas.
- Tocar una foto la abre en grande; **mantenerla presionada** la elimina
  (para los dos).
- Con la app abierta, lo que sube el otro aparece en unos 5 segundos.

## 4. Agregar el widget

Desde la app: **⋮ → Agregar 2×2** o **Agregar 4×2**.

O a mano: mantén presionado un hueco vacío de la pantalla de inicio →
**Widgets** → busca **Nosotros** → arrastra «Nosotros 2×2» o «Nosotros 4×2».

- Cambia de foto cada 15 min, 30 min o 1 h (**⋮ → Cambiar de foto cada**).
  Android no permite menos de 15 minutos.
- **Tócalo** para pasar a la siguiente foto.
- Muestra las fotos guardadas en el teléfono, así que funciona sin internet.
- Cuando subes o borras una foto, tu widget se actualiza al momento y salta
  a la más nueva. En el teléfono de tu pareja, el widget se entera en cuanto
  abre la app o, si no la abre, en la siguiente rotación (15–60 min).

Si el widget deja de rotar, revisa que la batería de Android no esté
restringiendo la app: Ajustes → Apps → Nosotros → Batería → **Sin
restricciones**.

## Compilar

Requisitos: JDK 17+ y el Android SDK (platform 37.2, build-tools 37). Con
Android Studio basta con abrir la carpeta `android/`. Por línea de comandos:

```bash
cd android
cp local.properties.example local.properties   # y pon sdk.dir (y opcionalmente Supabase)
./gradlew assembleDebug
# → app/build/outputs/apk/debug/app-debug.apk
./gradlew testDebugUnitTest lintDebug          # tests y lint
```

La APK se firma con `keystore/debug.keystore` (una llave de depuración
pública, contraseña `android`) para que cualquier compilación se instale
encima de la anterior sin desinstalar ni perder el emparejamiento. No sirve
para publicar en Play Store.

## Cómo está hecho

```
app/src/main/java/com/nosotros/app/
├── NosotrosApp.kt          Application: crea el repositorio y programa la rotación
├── data/
│   ├── SupabaseApi.kt      REST mínimo: Auth anónimo, PostgREST y Storage (OkHttp)
│   ├── AlbumRepository.kt  única puerta a los datos; sincroniza y avisa al widget
│   ├── LocalPhotoStore.kt  copia local de las fotos (la usa el widget sin red)
│   ├── ImageCompressor.kt  1080 px, EXIF, JPEG 80
│   ├── Config.kt           URL/clave (BuildConfig o pegadas) e invitaciones
│   └── SessionStore.kt     sesión anónima y álbum actual
├── ui/                     Compose: configuración, emparejamiento, álbum, ajustes
└── widget/                 Glance: widget, rotación (WorkManager) y recorte redondeado
supabase/schema.sql         tablas, RLS, funciones y bucket (lo mismo que SETUP.md)
```

Decisiones:

- **Supabase y no Firebase**: Firebase Storage ya exige el plan de pago
  (Blaze) para crear buckets; Supabase da 1 GB de Storage, Postgres con RLS y
  Auth anónimo gratis y sin tarjeta.
- **Sin SDK de Supabase**: son seis llamadas REST; OkHttp y kotlinx.serialization
  bastan y no atan la app a la versión del SDK.
- **Consulta cada 5 s con la app abierta, en vez de Realtime**: para dos
  personas es más simple y robusto que mantener un websocket; el plan
  gratuito no limita las peticiones a la API.
- **Avisos instantáneos al widget del otro** necesitarían notificaciones push
  (Firebase Cloud Messaging, gratis, pero con proyecto de Firebase y una Edge
  Function). Queda como mejora posible.
