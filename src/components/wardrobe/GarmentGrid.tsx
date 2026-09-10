import type { Garment } from "@/lib/types";
import { GarmentCard } from "./GarmentCard";
import { EmptyState } from "@/components/ui/EmptyState";

export interface GarmentGridProps {
  garments: Garment[];
  onSelect?: (garment: Garment) => void;
  selectedIds?: string[];
  loading?: boolean;
  emptyMessage?: string;
}

const SKELETON_COUNT = 8;
const GRID_CLASSES = "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";

export function GarmentGrid({
  garments,
  onSelect,
  selectedIds,
  loading = false,
  emptyMessage = "Todavía no hay prendas aquí.",
}: GarmentGridProps) {
  if (loading) {
    return (
      <div className={GRID_CLASSES} aria-hidden="true">
        {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
          <div key={index} className="aspect-square animate-pulse rounded-[22px] bg-clay-100" />
        ))}
      </div>
    );
  }

  if (garments.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  return (
    <div className={GRID_CLASSES}>
      {garments.map((garment) => (
        <GarmentCard
          key={garment.id}
          garment={garment}
          onClick={onSelect}
          selected={selectedIds?.includes(garment.id) ?? false}
        />
      ))}
    </div>
  );
}
