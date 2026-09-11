/**
 * El lazo del diseño: dos pétalos y un nudo.
 *
 * Aparece en la cabecera de cada pantalla, sobre la pestaña activa del menú y,
 * torcido, en la alerta de Mis-match. Se dibuja con tres divs porque un SVG
 * para esto sería más código y no se vería mejor.
 */
export function Lazo({
  size = 13,
  tone = "duo",
  className = "",
}: {
  /** Alto en píxeles; el ancho sale de ahí. */
  size?: number;
  /** `duo` es rosa y celeste; `rosa`, los dos pétalos rosas; `triste`, el de la alerta. */
  tone?: "duo" | "rosa" | "triste";
  className?: string;
}) {
  const petal = Math.round(size * 0.77);
  const knot = Math.round(size * 0.46);

  // `triste` sale en la alerta de Mis-match y ahí el color es la mitad del
  // mensaje: si se pinta igual que el lazo normal, el aviso deja de leerse de
  // un vistazo. Los demás tonos sí comparten paleta —pétalos al acento, nudo a
  // la tinta— y se distinguen solo por la forma.
  const colors =
    tone === "triste"
      ? { petalo: "var(--color-red-500)", nudo: "var(--color-red-700)" }
      : { petalo: "var(--color-accent)", nudo: "var(--color-clay-500)" };

  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-end gap-px ${className}`}
      style={{ height: size, transform: tone === "triste" ? "rotate(-16deg)" : undefined }}
    >
      <span
        style={{
          width: petal,
          height: size,
          borderRadius: `${size * 0.77}px ${size * 0.23}px ${size * 0.77}px ${size * 0.23}px`,
          background: colors.petalo,
        }}
      />
      <span
        style={{
          width: knot,
          height: knot,
          borderRadius: "50%",
          background: colors.nudo,
          marginBottom: size * 0.23,
        }}
      />
      <span
        style={{
          width: petal,
          height: tone === "triste" ? size * 0.74 : size,
          borderRadius: `${size * 0.23}px ${size * 0.77}px ${size * 0.23}px ${size * 0.77}px`,
          background: colors.petalo,
          transform: tone === "triste" ? "rotate(22deg)" : undefined,
        }}
      />
    </span>
  );
}
