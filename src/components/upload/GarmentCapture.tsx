"use client";

import { useCallback, useRef, useState } from "react";
import type { DragEvent } from "react";
import { prepareImage } from "@/lib/image/prepare";
import type { PreparedImage } from "@/lib/image/prepare";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

const MAX_BYTES = 15 * 1024 * 1024;

export interface GarmentCaptureProps {
  onSelected: (image: PreparedImage) => void;
  disabled?: boolean;
}

export function GarmentCapture({ onSelected, disabled = false }: GarmentCaptureProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const busy = disabled || loading;

  const processFile = useCallback(
    async (file: File | undefined) => {
      if (!file || busy) return;
      setError(null);

      if (!file.type.startsWith("image/")) {
        setError("Ese archivo no es una imagen. Elige una foto en formato JPG, PNG o similar.");
        return;
      }
      if (file.size > MAX_BYTES) {
        setError("La imagen pesa demasiado (máximo 15 MB). Prueba con otra foto.");
        return;
      }

      setLoading(true);
      try {
        const prepared = await prepareImage(file, { maxSide: 1600 });
        onSelected(prepared);
      } catch {
        setError("No se ha podido procesar la imagen. Inténtalo de nuevo.");
      } finally {
        setLoading(false);
      }
    },
    [busy, onSelected],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLButtonElement>) => {
      event.preventDefault();
      setDragActive(false);
      void processFile(event.dataTransfer.files[0]);
    },
    [processFile],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Los dos <input> quedan ocultos: los botones visibles disparan su click. */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(event) => void processFile(event.target.files?.[0])}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => void processFile(event.target.files?.[0])}
      />

      <Button
        variant="primary"
        size="lg"
        className="w-full"
        disabled={busy}
        onClick={() => cameraInputRef.current?.click()}
      >
        {loading ? <Spinner className="h-5 w-5 text-bone" /> : <CameraIcon />}
        Hacer foto
      </Button>

      <button
        type="button"
        onClick={() => galleryInputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        disabled={busy}
        className={`flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500 disabled:cursor-not-allowed disabled:opacity-60 ${
          dragActive ? "border-clay-500 bg-clay-50" : "border-neutral-300 bg-bone-soft"
        }`}
      >
        <GalleryIcon />
        <span className="text-sm font-medium text-ink">Arrastra una foto aquí</span>
        <span className="text-xs text-ink-soft">o elige de la galería</span>
      </button>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function CameraIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13.5" r="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GalleryIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="text-ink-soft">
      <rect x="3" y="4" width="18" height="16" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m4 17 4.5-5 3.5 3.5L16 11l4 6" />
      <circle cx="8" cy="9" r="1.4" />
    </svg>
  );
}
