import type { Metadata, Viewport } from "next";
import { Navigation } from "@/components/Navigation";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Armario Inteligente",
  description:
    "Fotografía tus prendas, deja que se recorten y etiqueten solas, y recibe conjuntos combinados a partir de tu propio armario.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Armario", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#C4633F",
  // La app se usa de pie delante del armario: sin zoom accidental al tocar.
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <ServiceWorkerRegistrar />
        <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-6">{children}</main>
        <Navigation />
      </body>
    </html>
  );
}
