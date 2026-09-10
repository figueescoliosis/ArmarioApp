import type { ReactNode } from "react";

export interface EmptyStateProps {
  message: string;
  title?: string;
  icon?: ReactNode;
}

export function EmptyState({ message, title, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-neutral-300 bg-bone-soft px-6 py-12 text-center">
      <div className="text-neutral-400" aria-hidden="true">
        {icon ?? <HangerIcon />}
      </div>
      {title && <p className="text-base font-medium text-ink">{title}</p>}
      <p className="max-w-xs text-sm text-ink-soft">{message}</p>
    </div>
  );
}

function HangerIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3a1.5 1.5 0 1 1 1.5 1.5H12V6l7.5 5c.8.53.4 1.75-.55 1.75H5.05c-.95 0-1.35-1.22-.55-1.75L12 6"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 17.5h17" />
    </svg>
  );
}
