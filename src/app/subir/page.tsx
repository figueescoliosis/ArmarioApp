"use client";

/**
 * Alta de una prenda, en cuatro estados: capturar → encuadrar → analizar →
 * revisar y guardar.
 *
 * La revisión de etiquetas antes de guardar no es un adorno: el modelo acierta
 * mucho pero no siempre, y una prenda mal categorizada envenena todos los
 * conjuntos que se generen a partir de ella.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

import { GarmentCapture } from "@/components/upload/GarmentCapture";
import { ImageCropper } from "@/components/upload/ImageCropper";
import { TagReview } from "@/components/upload/TagReview";
import { Button } from "@/components/ui/Button";
import { Cabecera } from "@/components/ui/Cabecera";
import { Spinner } from "@/components/ui/Spinner";
import { ApiCallError, analyzeGarment, createGarment } from "@/lib/client-api";
import type { PreparedImage } from "@/lib/image/prepare";
import type { AnalyzeGarmentResult, GarmentAttributes } from "@/lib/types";

type Step =
  | { name: "capture" }
  | { name: "crop"; image: PreparedImage }
  | { name: "analyzing" }
  | { name: "review"; analysis: AnalyzeGarmentResult };

export default function SubirPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ name: "capture" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ message: string; missingEnvVar?: string } | null>(null);

  function reportError(cause: unknown) {
    if (cause instanceof ApiCallError) {
      setError(
        cause.missingEnvVar !== undefined
          ? { message: cause.message, missingEnvVar: cause.missingEnvVar }
          : { message: cause.message },
      );
    } else {
      setError({ message: cause instanceof Error ? cause.message : "Algo ha ido mal." });
    }
  }

  async function analyze(image: PreparedImage) {
    setError(null);
    setStep({ name: "analyzing" });
    try {
      setStep({ name: "review", analysis: await analyzeGarment(image.blob) });
    } catch (cause) {
      reportError(cause);
      setStep({ name: "capture" });
    }
  }

  async function save(attributes: GarmentAttributes) {
    if (step.name !== "review") return;
    setSaving(true);
    setError(null);
    try {
      await createGarment({
        imageUrl: step.analysis.imageUrl,
        cutoutUrl: step.analysis.cutoutUrl,
        thumbUrl: step.analysis.thumbUrl,
        attributes,
      });
      router.push("/armario");
      router.refresh();
    } catch (cause) {
      reportError(cause);
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Cabecera
        titulo="Añadir prenda"
        subtitulo="Hazle una foto sobre un fondo liso. Del recorte y las etiquetas se encarga la app."
      />

      {error !== null && <ErrorNotice error={error} onDismiss={() => setError(null)} />}

      {step.name === "capture" && (
        <GarmentCapture onSelected={(image) => setStep({ name: "crop", image })} />
      )}

      {step.name === "crop" && (
        <ImageCropper
          image={step.image}
          onCropped={(cropped) => void analyze(cropped)}
          onSkip={() => void analyze(step.image)}
        />
      )}

      {step.name === "analyzing" && <AnalyzingNotice />}

      {step.name === "review" && (
        <>
          <PipelineSummary analysis={step.analysis} />
          <TagReview
            attributes={step.analysis.attributes}
            imageUrl={step.analysis.cutoutUrl}
            saving={saving}
            onConfirm={(attributes) => void save(attributes)}
            onCancel={() => setStep({ name: "capture" })}
          />
        </>
      )}
    </div>
  );
}

function AnalyzingNotice() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-[28px] bg-surface px-6 py-16 text-center shadow-[0_12px_30px_rgb(247_168_196_/_0.24)]">
      <Spinner />
      <div>
        <p className="titulo text-[17px]">Recortando el fondo y analizando la prenda…</p>
        <p className="mt-1 text-xs font-medium text-neutral-500">Suele tardar entre cinco y quince segundos.</p>
      </div>
    </div>
  );
}

function PipelineSummary({ analysis }: { analysis: AnalyzeGarmentResult }) {
  const seconds = (analysis.timings.totalMs / 1000).toFixed(1);
  return (
    <p className="px-1 text-xs font-medium text-neutral-500">
      Recortado con {analysis.backgroundProvider} y etiquetado en {seconds}s. Revisa lo que ha
      deducido y corrige lo que no cuadre antes de guardar.
    </p>
  );
}

/**
 * Un error de configuración se muestra distinto del resto: es el único que el
 * usuario puede resolver por su cuenta, y decirle qué clave falta le ahorra
 * abrir los logs del servidor.
 */
function ErrorNotice({
  error,
  onDismiss,
}: {
  error: { message: string; missingEnvVar?: string };
  onDismiss: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-[20px] border-[1.5px] border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700"
    >
      <p className="font-medium">{error.message}</p>
      {error.missingEnvVar !== undefined && (
        <p className="mt-2">
          Añade <code className="rounded bg-red-100 px-1 py-0.5">{error.missingEnvVar}</code> a tu{" "}
          <code className="rounded bg-red-100 px-1 py-0.5">.env.local</code> y reinicia el servidor.
          Los pasos están en <code className="rounded bg-red-100 px-1 py-0.5">docs/SETUP-APIS.md</code>.
        </p>
      )}
      <Button variant="ghost" size="md" className="mt-2" onClick={onDismiss}>
        Entendido
      </Button>
    </div>
  );
}
