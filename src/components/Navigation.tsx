"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Iconos del diseño: línea de 2px con puntas redondeadas, todos del mismo grosor. */
const ICONS: Record<string, ReactNode> = {
  armario: (
    <>
      <rect x="3.5" y="5.5" width="17" height="14" rx="4" />
      <path d="M12 5.5v14" />
    </>
  ),
  anadir: (
    <>
      <path d="M12 6v12" />
      <path d="M6 12h12" />
    </>
  ),
  probador: (
    <>
      <circle cx="12" cy="6.5" r="3" />
      <rect x="6.5" y="12" width="11" height="9" rx="3" />
    </>
  ),
  conjuntos: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="2.5" />
      <rect x="13" y="4" width="7" height="7" rx="2.5" />
      <rect x="4" y="13" width="7" height="7" rx="2.5" />
      <rect x="13" y="13" width="7" height="7" rx="2.5" />
    </>
  ),
  favoritos: <path d="M12 20s-7-4.6-7-9.6A3.9 3.9 0 0 1 12 7.6a3.9 3.9 0 0 1 7 2.8c0 5-7 9.6-7 9.6z" />,
};

const LINKS = [
  { href: "/armario", label: "Armario", icon: "armario" },
  { href: "/subir", label: "Añadir", icon: "anadir" },
  { href: "/probador", label: "Probador", icon: "probador" },
  { href: "/outfits", label: "Conjuntos", icon: "conjuntos" },
  { href: "/favoritos", label: "Favoritos", icon: "favoritos" },
] as const;

/** Barra inferior fija: es la navegación que se alcanza con el pulgar. */
export function Navigation() {
  const pathname = usePathname();

  return (
    <div className="fixed inset-x-0 bottom-0 z-40">
      <div className="volante-menu" />
      <nav
        aria-label="Navegación principal"
        className="h-[76px] bg-clay-500 shadow-[var(--sombra-tarjeta)]"
      >
        <div className="mx-auto grid h-full w-full max-w-3xl grid-cols-5">
          {LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center justify-center gap-[3px] pb-[env(safe-area-inset-bottom)] transition-colors ${
                  active ? "text-accent" : "text-neutral-400 hover:text-accent"
                }`}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-[22px] w-[22px]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {ICONS[link.icon]}
                </svg>
                <span className={`text-[10px] ${active ? "font-bold" : "font-semibold"}`}>
                  {link.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
