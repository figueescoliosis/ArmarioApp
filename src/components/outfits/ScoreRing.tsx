/** Anillo de progreso con el porcentaje de compatibilidad en el centro. */
export function ScoreRing({
  percent,
  tone = "bien",
  size = 100,
}: {
  percent: number;
  tone?: "bien" | "aviso" | "mal";
  size?: number;
}) {
  const colors = {
    bien: { arc: "var(--color-clay-500)", track: "var(--color-clay-200)" },
    aviso: { arc: "var(--color-amber-500)", track: "var(--color-amber-50)" },
    mal: { arc: "var(--color-red-500)", track: "var(--color-red-100)" },
  }[tone];

  const inner = Math.round(size * 0.72);

  return (
    <div
      className="relative flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(${colors.arc} 0 ${percent}%, ${colors.track} ${percent}% 100%)`,
      }}
      role="img"
      aria-label={`Compatibilidad del conjunto: ${percent}%`}
    >
      <div
        className="flex flex-col items-center justify-center rounded-full bg-surface"
        style={{ width: inner, height: inner }}
      >
        <span className="titulo leading-none" style={{ fontSize: Math.round(size * 0.36) }}>
          {percent}%
        </span>
        <span className="mt-0.5 text-[8px] font-bold tracking-[0.6px] text-ink-soft">
          COMBINA
        </span>
      </div>
    </div>
  );
}
