import type { Metadata, Viewport } from "next";
import { Baloo_2, Quicksand } from "next/font/google";
import { Navigation } from "@/components/Navigation";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import "./globals.css";

/**
 * Las dos tipografías del diseño. Van por `next/font`, que las sirve desde el
 * propio dominio: sin petición a Google en tiempo de carga y sin salto de
 * fuente al pintar.
 */
const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-quicksand",
  display: "swap",
});

const baloo = Baloo_2({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-baloo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Armario Inteligente",
  description:
    "Fotografía tus prendas, deja que se recorten y etiqueten solas, y recibe conjuntos combinados a partir de tu propio armario.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Armario", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#F7A8C4",
  // La app se usa de pie delante del armario: sin zoom accidental al tocar.
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${quicksand.variable} ${baloo.variable}`}>
      <body>
        <ServiceWorkerRegistrar />
        <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-6">{children}</main>
        <Navigation />
      </body>
    </html>
  );
}
