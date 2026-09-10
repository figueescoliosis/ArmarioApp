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

  const colors =
    tone === "triste"
      ? { left: "#F3AAB6", right: "#F3AAB6", knot: "#C93A52" }
      : tone === "rosa"
        ? { left: "#F7A8C4", right: "#F7A8C4", knot: "#B03A62" }
        : { left: "#F7A8C4", right: "#A8D8F0", knot: "#B03A62" };

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
          background: colors.left,
        }}
      />
      <span
        style={{
          width: knot,
          height: knot,
          borderRadius: "50%",
          background: colors.knot,
          marginBottom: size * 0.23,
        }}
      />
      <span
        style={{
          width: petal,
          height: tone === "triste" ? size * 0.74 : size,
          borderRadius: `${size * 0.23}px ${size * 0.77}px ${size * 0.23}px ${size * 0.77}px`,
          background: colors.right,
          transform: tone === "triste" ? "rotate(22deg)" : undefined,
        }}
      />
    </span>
  );
}
