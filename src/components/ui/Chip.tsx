export interface ChipProps {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  count?: number;
  disabled?: boolean;
  className?: string;
}

/** Chip-interruptor: úsalo para selección única o múltiple con `aria-pressed`. */
export function Chip({
  label,
  selected = false,
  onClick,
  count,
  disabled = false,
  className = "",
}: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500 disabled:cursor-not-allowed disabled:opacity-50 ${
        selected
          ? "border-clay-500 bg-clay-500 text-bone"
          : "border-neutral-300 bg-surface text-ink hover:bg-bone-soft"
      } ${className}`}
    >
      <span>{label}</span>
      {typeof count === "number" && (
        <span className={selected ? "text-xs text-bone/80" : "text-xs text-ink-soft"}>
          {count}
        </span>
      )}
    </button>
  );
}
