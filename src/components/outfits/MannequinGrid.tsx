import Image from "next/image";
import type { OutfitItem, Slot } from "@/lib/types";

/** Etiqueta del hueco vacío. En el probador es la invitación a tocarlo. */
const SLOT_LABELS: Record<Slot, string> = {
  top: "Arriba",
  bottom: "Abajo",
  dress: "Vestido",
  outerwear: "Abrigo",
  shoes: "Zapatos",
  accessory: "Complemento",
};

export interface MannequinGridProps {
  items: OutfitItem[];
  /** Si se pasa, cada hueco se vuelve pulsable: es el modo probador. */
  onSlotClick?: (slot: Slot) => void;
  className?: string;
}

/**
 * Las prendas apiladas por huecos, con los recortes sin fondo.
 *
 * La misma rejilla sirve para enseñar un conjunto ya hecho (`OutfitCard`) y
 * para montarlo a mano (`/probador`); la única diferencia es si los huecos
 * responden al toque.
 */
export function MannequinGrid({ items, onSlotClick, className = "" }: MannequinGridProps) {
  const bySlot = new Map<Slot, OutfitItem>();
  for (const item of items) bySlot.set(item.slot, item);

  // Un vestido ocupa arriba y abajo, así que la rejilla cambia de forma.
  const hasDress = bySlot.has("dress");
  const slots: Slot[] = hasDress
    ? ["dress", "shoes", "accessory"]
    : ["outerwear", "top", "bottom", "shoes", "accessory"];

  return (
    <div
      className={`grid flex-1 gap-2 ${className}`}
      style={{
        gridTemplateAreas: hasDress
          ? `"dress dress" "dress dress" "shoes accessory"`
          : `"outerwear top" "bottom bottom" "shoes accessory"`,
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "1fr 1fr 1fr",
        height: "16rem",
      }}
    >
      {slots.map((slot) => (
        <SlotCell
          key={slot}
          slot={slot}
          item={bySlot.get(slot)}
          {...(onSlotClick ? { onClick: onSlotClick } : {})}
        />
      ))}
    </div>
  );
}

function SlotCell({
  slot,
  item,
  onClick,
}: {
  slot: Slot;
  item?: OutfitItem;
  onClick?: (slot: Slot) => void;
}) {
  const cellClass =
    "relative flex items-center justify-center overflow-hidden rounded-xl border border-dashed border-neutral-200 bg-bone-soft";

  const body = item ? (
    <Image
      src={item.garment.thumbUrl ?? item.garment.cutoutUrl}
      alt={item.garment.subcategory || "Prenda"}
      fill
      sizes="140px"
      className="object-contain p-1.5"
    />
  ) : (
    <span className="px-1 text-center text-xs text-ink-soft" aria-hidden="true">
      {onClick ? SLOT_LABELS[slot] : "—"}
    </span>
  );

  if (onClick) {
    return (
      <button
        type="button"
        style={{ gridArea: slot }}
        onClick={() => onClick(slot)}
        aria-label={
          item ? `Cambiar ${SLOT_LABELS[slot].toLowerCase()}` : `Elegir ${SLOT_LABELS[slot].toLowerCase()}`
        }
        className={`${cellClass} transition-colors hover:border-clay-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500`}
      >
        {body}
      </button>
    );
  }

  return (
    <div style={{ gridArea: slot }} className={cellClass}>
      {body}
    </div>
  );
}
