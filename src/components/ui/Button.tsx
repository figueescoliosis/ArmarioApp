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
    "bg-clay-500 text-bone hover:bg-clay-600 active:bg-clay-700 disabled:bg-neutral-200 disabled:text-neutral-400",
  secondary:
    "bg-bone-soft text-ink border border-neutral-300 hover:bg-neutral-100 disabled:text-neutral-400 disabled:bg-bone-soft",
  ghost: "bg-transparent text-ink hover:bg-bone-soft disabled:text-neutral-400",
  danger:
    "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 disabled:bg-neutral-200 disabled:text-neutral-400",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: "h-11 min-w-11 px-4 text-sm",
  lg: "h-14 min-w-14 px-6 text-base",
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
      className={`inline-flex items-center justify-center gap-2 rounded-2xl font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
