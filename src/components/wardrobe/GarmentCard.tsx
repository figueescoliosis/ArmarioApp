import Image from "next/image";
import type { Garment } from "@/lib/types";

export interface GarmentCardProps {
  garment: Garment;
  onClick?: (garment: Garment) => void;
  selected?: boolean;
}

export function GarmentCard({ garment, onClick, selected = false }: GarmentCardProps) {
  const imageSrc = garment.thumbUrl ?? garment.cutoutUrl;
  const softBg = `color-mix(in srgb, ${garment.primaryHex} 16%, var(--color-bone))`;

  const cardClass = `group relative flex flex-col overflow-hidden rounded-2xl border text-left transition-colors ${
    selected ? "border-clay-500 ring-2 ring-clay-300" : "border-neutral-200"
  }`;

  const body = (
    <>
      <div className="relative aspect-square w-full" style={{ backgroundColor: softBg }}>
        <Image
          src={imageSrc}
          alt={garment.subcategory || "Prenda"}
          fill
          sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
          className="object-contain p-3"
        />
      </div>
      <div className="flex flex-col gap-1.5 p-2">
        <span className="truncate text-sm font-medium text-ink">{garment.subcategory}</span>
        <div className="flex gap-1" aria-hidden="true">
          {garment.colors.slice(0, 4).map((color, index) => (
            <span
              key={index}
              className="h-2.5 w-2.5 rounded-full border border-black/10"
              style={{ backgroundColor: color.hex }}
            />
          ))}
        </div>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" aria-pressed={selected} onClick={() => onClick(garment)} className={`${cardClass} bg-surface`}>
        {body}
      </button>
    );
  }

  return <div className={`${cardClass} bg-surface`}>{body}</div>;
}
