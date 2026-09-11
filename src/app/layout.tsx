import type { Metadata, Viewport } from "next";
import { Caveat, Quicksand, Sacramento } from "next/font/google";
import { Navigation } from "@/components/Navigation";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import "./globals.css";

/**
 * Las tipografías del diseño. Van por `next/font`, que las sirve desde el
 * propio dominio: sin petición a Google en tiempo de carga y sin salto de
 * fuente al pintar.
 *
 * Quicksand es el cuerpo en los dos temas. La manuscrita de los titulares
 * cambia: Caveat en Fairy, Sacramento en Coquette. Se cargan las dos siempre
 * —son dos ficheros pequeños— porque el tema se decide en el navegador y
 * pedirla entonces sería justo el parpadeo que evita el script de abajo.
 */
const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-quicksand",
  display: "swap",
});

const caveat = Caveat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-caveat",
  display: "swap",
});

const sacramento = Sacramento({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-sacramento",
  display: "swap",
});

/*
 * El tema vive en `localStorage`, que no existe en el servidor. Sin esto la
 * página se pinta en Fairy y salta a Coquette en cuanto hidrata, a la vista.
 * Corre antes del primer pintado y es lo único que justifica un script inline.
 */
const SCRIPT_TEMA = `try{var t=localStorage.getItem("armario:tema");if(t==="claro"||t==="oscuro")document.documentElement.dataset.tema=t}catch(e){}`;

export const metadata: Metadata = {
  title: "Armario Inteligente",
  description:
    "Fotografía tus prendas, deja que se recorten y etiqueten solas, y recibe conjuntos combinados a partir de tu propio armario.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Armario", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  // El color de la barra del sistema: el fondo de página de cada tema.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FBFBF3" },
    { media: "(prefers-color-scheme: dark)", color: "#FBEEF2" },
  ],
  // La app se usa de pie delante del armario: sin zoom accidental al tocar.
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${quicksand.variable} ${caveat.variable} ${sacramento.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body>
        <ServiceWorkerRegistrar />
        {/* Sin `pt`: la cabecera es un bloque a sangre que arranca pegado al
            borde superior, como en el diseño. */}
        <main className="mx-auto w-full max-w-3xl px-4 pb-28">{children}</main>
        <Navigation />
      </body>
    </html>
  );
}
