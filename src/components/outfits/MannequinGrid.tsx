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
  /** `alerta` pinta un borde rojo en los huecos ocupados: hay un Mis-match. */
  alerta?: boolean;
  /** `compacta` es la versión de tarjeta de conjunto, más baja. */
  compacta?: boolean;
  className?: string;
}

/**
 * Las prendas apiladas por huecos, con los recortes sin fondo.
 *
 * La misma rejilla sirve para enseñar un conjunto ya hecho (`OutfitCard`) y
 * para montarlo a mano (`/probador`); la única diferencia es si los huecos
 * responden al toque.
 */
export function MannequinGrid({
  items,
  onSlotClick,
  alerta = false,
  compacta = false,
  className = "",
}: MannequinGridProps) {
  const bySlot = new Map<Slot, OutfitItem>();
  for (const item of items) bySlot.set(item.slot, item);

  // Un vestido ocupa arriba y abajo, así que la rejilla cambia de forma.
  const hasDress = bySlot.has("dress");
  const slots: Slot[] = hasDress
    ? ["dress", "shoes", "accessory"]
    : ["outerwear", "top", "bottom", "shoes", "accessory"];

  return (
    <div
      className={`grid flex-1 ${compacta ? "gap-2" : "gap-2.5"} ${className}`}
      style={{
        gridTemplateAreas: hasDress
          ? `"dress dress" "dress dress" "shoes accessory"`
          : `"outerwear top" "bottom bottom" "shoes accessory"`,
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "1fr 1fr 1fr",
        height: compacta ? "13rem" : "19.5rem",
      }}
    >
      {slots.map((slot) => (
        <SlotCell
          key={slot}
          slot={slot}
          item={bySlot.get(slot)}
          alerta={alerta}
          compacta={compacta}
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
  alerta,
  compacta,
}: {
  slot: Slot;
  item?: OutfitItem;
  onClick?: (slot: Slot) => void;
  alerta: boolean;
  compacta: boolean;
}) {
  const radius = compacta ? "rounded-[18px]" : "rounded-[22px]";
  const innerRadius = compacta ? "rounded-[14px]" : "rounded-2xl";

  const lleno = `relative ${radius} bg-bone-soft p-1.5 shadow-[0_6px_14px_rgb(247_168_196_/_0.2)] ${
    alerta ? "border-2 border-red-200" : ""
  }`;
  const vacio = `flex flex-col items-center justify-center gap-1.5 ${radius} border-[2.5px] border-dashed border-clay-500 bg-neutral-50`;

  const body = item ? (
    <div className={`relative h-full w-full overflow-hidden ${innerRadius} bg-clay-50`}>
      <Image
        src={item.garment.thumbUrl ?? item.garment.cutoutUrl}
        alt={item.garment.subcategory || "Prenda"}
        fill
        sizes="180px"
        className="object-contain p-1"
      />
    </div>
  ) : (
    <>
      {onClick && !compacta && (
        <span
          aria-hidden="true"
          className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-bone-soft font-display text-base font-bold text-clay-500"
        >
          +
        </span>
      )}
      <span className="px-1 text-center text-[11px] font-semibold text-clay-700">
        {SLOT_LABELS[slot]}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        style={{ gridArea: slot }}
        onClick={() => onClick(slot)}
        aria-label={
          item
            ? `Cambiar ${SLOT_LABELS[slot].toLowerCase()}`
            : `Elegir ${SLOT_LABELS[slot].toLowerCase()}`
        }
        className={`${item ? lleno : vacio} transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500 active:scale-[0.97]`}
      >
        {body}
      </button>
    );
  }

  return (
    <div style={{ gridArea: slot }} className={item ? lleno : vacio}>
      {body}
    </div>
  );
}
