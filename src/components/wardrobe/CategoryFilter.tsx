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
  return (
    <div
      role="group"
      aria-label="Filtrar por categoría"
      className="flex gap-2 overflow-x-auto pb-1"
    >
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
