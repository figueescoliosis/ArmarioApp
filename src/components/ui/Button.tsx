import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "md" | "lg" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children?: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-clay-500 text-cream font-bold shadow-[var(--sombra-tarjeta)] hover:bg-clay-600 disabled:bg-clay-200 disabled:text-cream disabled:shadow-none",
  secondary:
    "bg-surface text-ink font-bold border-[1.5px] border-clay-200 hover:bg-bone-soft disabled:text-neutral-400",
  // El celeste es el "salir de aquí" del diseño: cerrar, cancelar, volver.
  ghost: "bg-sky-50 text-sky-700 font-bold hover:bg-sky-100 disabled:text-neutral-400",
  danger:
    "bg-red-50 text-red-700 font-bold border-[1.5px] border-red-500 hover:bg-red-100 disabled:text-neutral-400 disabled:border-clay-200",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: "h-11 min-w-11 px-4 text-sm",
  lg: "h-14 min-w-14 px-6 text-[17px]",
  icon: "h-11 w-11 p-0",
};

/** Botón base de la app: siempre `<button>` real, con objetivo táctil ≥44px. */
export function Button({
  variant = "primary",
  size = "md",
  type = "button",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-[18px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
