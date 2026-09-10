import { CATEGORIES } from "@/lib/types";
import type { Category } from "@/lib/types";
import { Chip } from "@/components/ui/Chip";

const LABELS: Record<Category | "all", string> = {
  all: "Todo",
  top: "Arriba",
  bottom: "Abajo",
  dress: "Vestidos",
  outerwear: "Abrigos",
  shoes: "Calzado",
  accessory: "Accesorios",
};

const OPTIONS: Array<Category | "all"> = ["all", ...CATEGORIES];

export interface CategoryFilterProps {
  value: Category | "all";
  counts: Record<Category | "all", number>;
  onChange: (value: Category | "all") => void;
}

export function CategoryFilter({ value, counts, onChange }: CategoryFilterProps) {
  // Los chips se envuelven en vez de scrollar en horizontal: en un móvil de
  // 375px el scroll dejaba "Vestidos" cortado a media palabra, sin ninguna
  // pista de que hubiera más categorías a la derecha.
  return (
    <div role="group" aria-label="Filtrar por categoría" className="flex flex-wrap gap-2">
      {OPTIONS.map((option) => (
        <Chip
          key={option}
          label={LABELS[option]}
          count={counts[option]}
          selected={value === option}
          onClick={() => onChange(option)}
        />
      ))}
    </div>
  );
}
