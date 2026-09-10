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

  const cardClass = `group relative flex flex-col rounded-[22px] bg-bone-soft p-3 text-left shadow-[0_6px_16px_rgb(247_168_196_/_0.20)] transition-colors ${
    selected ? "border-2 border-clay-500 p-[10px]" : ""
  }`;

  const body = (
    <>
      <div
        className="relative aspect-square w-full overflow-hidden rounded-2xl"
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
      <div className="flex flex-col gap-2 pt-2.5">
        <span className="line-clamp-2 text-[13px] font-semibold leading-tight text-ink">
          {garment.subcategory}
        </span>
        <div className="flex gap-[5px]" aria-hidden="true">
          {garment.colors.slice(0, 4).map((color, index) => (
            <span
              key={index}
              className="h-[11px] w-[11px] rounded-full border border-black/10"
              style={{ backgroundColor: color.hex }}
            />
          ))}
        </div>
      </div>
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
