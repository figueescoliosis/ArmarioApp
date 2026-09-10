"use client";

import { useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { cropImage } from "@/lib/image/crop";
import type { CropRect } from "@/lib/image/crop";
import type { PreparedImage } from "@/lib/image/prepare";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

export interface ImageCropperProps {
  image: PreparedImage;
  onCropped: (image: PreparedImage) => void;
  onSkip: () => void;
}

/** Recorte expresado como fracción [0,1] del ancho/alto de la imagen original. */
interface CropFraction {
  x: number;
  y: number;
  width: number;
  height: number;
}

type Corner = "nw" | "ne" | "sw" | "se";

interface DragState {
  mode: "move" | "resize";
  corner?: Corner;
  containerRect: DOMRect;
  startFrac: { x: number; y: number };
  startCrop: CropFraction;
}

const MIN_FRAC = 0.15;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Marco inicial: cuadrado que cubre el 80% del lado corto de la imagen, centrado. */
function initialCrop(image: PreparedImage): CropFraction {
  const shortSidePx = Math.min(image.width, image.height);
  const sizePx = shortSidePx * 0.8;
  const widthFrac = clamp(sizePx / image.width, MIN_FRAC, 1);
  const heightFrac = clamp(sizePx / image.height, MIN_FRAC, 1);
  return {
    x: (1 - widthFrac) / 2,
    y: (1 - heightFrac) / 2,
    width: widthFrac,
    height: heightFrac,
  };
}

function fracFromPoint(clientX: number, clientY: number, rect: DOMRect) {
  return {
    x: clamp((clientX - rect.left) / rect.width, 0, 1),
    y: clamp((clientY - rect.top) / rect.height, 0, 1),
  };
}

export function ImageCropper({ image, onCropped, onSkip }: ImageCropperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [crop, setCrop] = useState<CropFraction>(() => initialCrop(image));
  const [cropping, setCropping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>, mode: DragState["mode"], corner?: Corner) => {
      const container = containerRef.current;
      if (!container) return;
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = {
        mode,
        corner,
        containerRect: container.getBoundingClientRect(),
        startFrac: fracFromPoint(event.clientX, event.clientY, container.getBoundingClientRect()),
        startCrop: crop,
      };
    },
    [crop],
  );

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const point = fracFromPoint(event.clientX, event.clientY, drag.containerRect);
    const deltaX = point.x - drag.startFrac.x;
    const deltaY = point.y - drag.startFrac.y;
    const { startCrop } = drag;

    if (drag.mode === "move") {
      setCrop({
        ...startCrop,
        x: clamp(startCrop.x + deltaX, 0, 1 - startCrop.width),
        y: clamp(startCrop.y + deltaY, 0, 1 - startCrop.height),
      });
      return;
    }

    const left0 = startCrop.x;
    const top0 = startCrop.y;
    const right0 = startCrop.x + startCrop.width;
    const bottom0 = startCrop.y + startCrop.height;

    let left = left0;
    let top = top0;
    let right = right0;
    let bottom = bottom0;

    switch (drag.corner) {
      case "nw":
        left = clamp(left0 + deltaX, 0, right0 - MIN_FRAC);
        top = clamp(top0 + deltaY, 0, bottom0 - MIN_FRAC);
        break;
      case "ne":
        right = clamp(right0 + deltaX, left0 + MIN_FRAC, 1);
        top = clamp(top0 + deltaY, 0, bottom0 - MIN_FRAC);
        break;
      case "sw":
        left = clamp(left0 + deltaX, 0, right0 - MIN_FRAC);
        bottom = clamp(bottom0 + deltaY, top0 + MIN_FRAC, 1);
        break;
      case "se":
        right = clamp(right0 + deltaX, left0 + MIN_FRAC, 1);
        bottom = clamp(bottom0 + deltaY, top0 + MIN_FRAC, 1);
        break;
    }

    setCrop({ x: left, y: top, width: right - left, height: bottom - top });
  }, []);

  const endDrag = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  }, []);

  const handleUseCrop = useCallback(async () => {
    setError(null);
    setCropping(true);
    try {
      // Las coordenadas viven en fracción de pantalla; hay que escalarlas a
      // los píxeles reales de la imagen original antes de recortar.
      const rect: CropRect = {
        x: Math.round(crop.x * image.width),
        y: Math.round(crop.y * image.height),
        width: Math.round(crop.width * image.width),
        height: Math.round(crop.height * image.height),
      };
      const result = await cropImage(image.blob, rect);
      onCropped(result);
    } catch {
      setError("No se ha podido recortar la imagen. Inténtalo de nuevo.");
    } finally {
      setCropping(false);
    }
  }, [crop, image, onCropped]);

  return (
    <div className="flex flex-col gap-4">
      <div className="mx-auto w-full max-w-md">
        <div
          ref={containerRef}
          className="relative w-full touch-none overflow-hidden rounded-2xl bg-neutral-900"
          style={{ aspectRatio: `${image.width} / ${image.height}` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- dataUrl local, no cabe en el loader de next/image */}
          <img src={image.dataUrl} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />

          <div
            onPointerDown={(event) => startDrag(event, "move")}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className="absolute cursor-move border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
            style={{
              left: `${crop.x * 100}%`,
              top: `${crop.y * 100}%`,
              width: `${crop.width * 100}%`,
              height: `${crop.height * 100}%`,
            }}
          >
            {(["nw", "ne", "sw", "se"] as const).map((corner) => (
              <button
                key={corner}
                type="button"
                aria-label={`Redimensionar el recorte desde la esquina ${CORNER_LABELS[corner]}`}
                onPointerDown={(event) => startDrag(event, "resize", corner)}
                onPointerMove={handlePointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                className={`absolute flex h-11 w-11 cursor-pointer items-center justify-center touch-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500 ${CORNER_POSITION[corner]}`}
              >
                <span className="h-4 w-4 rounded-full border-2 border-clay-500 bg-white" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-center text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <Button variant="secondary" size="lg" className="flex-1" onClick={onSkip} disabled={cropping}>
          Saltar
        </Button>
        <Button variant="primary" size="lg" className="flex-1" onClick={() => void handleUseCrop()} disabled={cropping}>
          {cropping && <Spinner className="h-4 w-4 text-bone" />}
          Usar recorte
        </Button>
      </div>
    </div>
  );
}

const CORNER_LABELS: Record<Corner, string> = {
  nw: "superior izquierda",
  ne: "superior derecha",
  sw: "inferior izquierda",
  se: "inferior derecha",
};

const CORNER_POSITION: Record<Corner, string> = {
  nw: "left-0 top-0 -translate-x-1/2 -translate-y-1/2",
  ne: "right-0 top-0 translate-x-1/2 -translate-y-1/2",
  sw: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2",
  se: "right-0 bottom-0 translate-x-1/2 translate-y-1/2",
};
