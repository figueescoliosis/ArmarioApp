"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/armario", label: "Armario", icon: "M3 7h18v13H3z M8 7V5a4 4 0 0 1 8 0v2" },
  { href: "/subir", label: "Añadir", icon: "M12 5v14 M5 12h14" },
  { href: "/probador", label: "Probador", icon: "M12 3a3 3 0 0 1 3 3 M9 6a3 3 0 0 1 3-3 M4 21h16 M12 9v12 M6 21l6-12 6 12" },
  { href: "/outfits", label: "Conjuntos", icon: "M4 6h16 M4 12h16 M4 18h10" },
  { href: "/favoritos", label: "Favoritos", icon: "M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" },
] as const;

/** Barra inferior fija: es la navegación que se alcanza con el pulgar. */
export function Navigation() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bone/95 backdrop-blur"
    >
      <ul className="mx-auto flex w-full max-w-3xl">
        {LINKS.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <li key={link.href} className="flex-1">
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 pb-[env(safe-area-inset-bottom)] text-xs transition-colors ${
                  active ? "text-clay" : "text-neutral-500 hover:text-ink"
                }`}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {link.icon.split(" M").map((segment, index) => (
                    <path key={index} d={index === 0 ? segment : `M${segment}`} />
                  ))}
                </svg>
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
