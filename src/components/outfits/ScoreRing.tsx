/** Anillo de progreso con el porcentaje del conjunto en el centro. */
export function ScoreRing({ percent, tone = "bien" }: { percent: number; tone?: "bien" | "aviso" | "mal" }) {
  const color =
    tone === "mal"
      ? "var(--color-red-500, #ef4444)"
      : tone === "aviso"
        ? "var(--color-amber-500, #f59e0b)"
        : "var(--color-clay-500)";

  return (
    <div
      className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(${color} ${percent * 3.6}deg, var(--color-neutral-200) 0deg)` }}
      role="img"
      aria-label={`Puntuación del conjunto: ${percent}%`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-sm font-semibold text-ink">
        {percent}%
      </div>
    </div>
  );
}
