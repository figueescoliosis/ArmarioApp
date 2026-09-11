import Image from "next/image";
import type { Garment } from "@/lib/types";

export interface GarmentCardProps {
  garment: Garment;
  onClick?: (garment: Garment) => void;
  selected?: boolean;
}

export function GarmentCard({ garment, onClick, selected = false }: GarmentCardProps) {
  const imageSrc = garment.thumbUrl ?? garment.cutoutUrl;
  // Un velo del color de la prenda sobre rosa muy claro: da un fondo distinto a
  // cada tarjeta sin llegar a oscurecerlo, que es lo que haría desaparecer los
  // recortes negros, que son la mayoría de un armario real.
  const softBg = `color-mix(in srgb, ${garment.primaryHex} 10%, var(--color-clay-50))`;

  const cardClass = `relative overflow-hidden rounded-[20px] bg-surface p-[9px] pb-0 text-left shadow-[var(--sombra-tarjeta)] ${
    selected ? "border-2 border-clay-500" : ""
  }`;

  const body = (
    <>
      <div
        className="relative aspect-[3/4] w-full overflow-hidden rounded-[14px] bg-bone-soft"
        style={{ backgroundColor: softBg }}
      >
        <Image
          src={imageSrc}
          alt={garment.subcategory || "Prenda"}
          fill
          sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
          className="object-contain p-2"
        />
      </div>
      <div className="flex items-center justify-between gap-1.5 py-[9px] px-0.5">
        <span className="line-clamp-2 text-[13px] font-semibold leading-tight text-ink">
          {garment.subcategory}
        </span>
        <div className="flex shrink-0 gap-[5px]" aria-hidden="true">
          {garment.colors.slice(0, 4).map((color, index) => (
            <span
              key={index}
              className="h-[11px] w-[11px] rounded-full"
              style={{ backgroundColor: color.hex, boxShadow: "inset 0 0 0 1px rgb(0 0 0 / .1)" }}
            />
          ))}
        </div>
      </div>
      <div className="cinta-encaje-tarjeta mx-[-9px]" />
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => onClick(garment)}
        className={`${cardClass} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500`}
      >
        {body}
      </button>
    );
  }

  return <div className={cardClass}>{body}</div>;
}
