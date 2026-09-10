import type { ReactNode } from "react";

export interface EmptyStateProps {
  message: string;
  title?: string;
  icon?: ReactNode;
}

export function EmptyState({ message, title, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[28px] border-2 border-dashed border-clay-200 bg-clay-50 px-6 py-12 text-center">
      <div className="text-clay-300" aria-hidden="true">
        {icon ?? <HangerIcon />}
      </div>
      {title && <p className="titulo text-[17px]">{title}</p>}
      <p className="max-w-xs text-sm font-medium text-ink-soft">{message}</p>
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
