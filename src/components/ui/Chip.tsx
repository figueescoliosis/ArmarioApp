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
  const Tag = onClick ? "button" : "span";

  return (
    <Tag
      {...(onClick
        ? { type: "button" as const, "aria-pressed": selected, onClick, disabled }
        : {})}
      className={`inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-[15px] text-[13px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500 disabled:cursor-not-allowed disabled:opacity-50 ${
        selected
          ? "bg-clay-500 font-bold text-cream"
          : "border-[1.5px] border-clay-200 bg-surface font-semibold text-ink hover:bg-bone-soft"
      } ${className}`}
    >
      <span>{label}</span>
      {typeof count === "number" && (
        <span
          className={
            selected
              ? "rounded-full bg-accent px-[7px] py-0.5 text-[11px] font-bold text-clay-700"
              : "text-[11px] font-bold text-accent-strong"
          }
        >
          {count}
        </span>
      )}
    </Tag>
  );
}
