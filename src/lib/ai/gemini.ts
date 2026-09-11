/**
 * Llamada JSON a Gemini, compartida por el etiquetado y la redacción de
 * conjuntos.
 *
 * Por REST y no por SDK a propósito: son treinta líneas de `fetch` y ahorra una
 * dependencia. Se pide el esquema con `responseJsonSchema` y además se valida
 * la respuesta con Zod, que es la misma garantía que da `messages.parse()` en
 * el lado de Claude.
 */

import * as z from "zod/v4";

// ponytail: modelo fijado a una versión concreta, no al alias
// `gemini-flash-latest`. El alias apunta al último flash, que a día de hoy
// responde 503 por saturación; cuando se estabilice, volver al alias ahorra ir
// persiguiendo deprecaciones. Se sobrescribe con `GEMINI_MODEL`.
const DEFAULT_MODEL = "gemini-3.5-flash";

/** Espera antes de cada reintento, si el modelo responde que está saturado. */
const ESPERAS_MS = [2000, 4000];

export interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

/** ¿Hay clave de Gemini configurada? */
export function hasGemini(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

/**
 * Manda `parts` a Gemini y devuelve la respuesta ya validada contra `schema`.
 * Lanza si la API falla o si lo que vuelve no encaja: quien llama decide si eso
 * es un error o un motivo para degradar.
 */
export async function geminiJson<T extends z.ZodType>(
  apiKey: string,
  system: string,
  parts: GeminiPart[],
  schema: T,
): Promise<z.infer<T>> {
  const model = process.env.GEMINI_MODEL ?? DEFAULT_MODEL;

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseMimeType: "application/json",
      responseJsonSchema: z.toJSONSchema(schema),
    },
  });

  const pedir = () =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body,
    });

  // Un 503 de Gemini es saturación momentánea del modelo, no un problema de la
  // petición: la propia respuesta pide que se reintente. Seis segundos de
  // espera salen más baratos que hacer al usuario repetir la foto.
  let response = await pedir();
  for (const espera of ESPERAS_MS) {
    if (response.status !== 503) break;
    await new Promise((listo) => setTimeout(listo, espera));
    response = await pedir();
  }

  if (!response.ok) {
    throw new Error(
      `Gemini respondió ${response.status}: ${(await response.text()).slice(0, 300)}`,
    );
  }

  // El JSON útil viaja como texto dentro de la primera parte del primer
  // candidato.
  const datos = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = datos.candidates?.[0]?.content?.parts?.[0]?.text;

  if (text === undefined) {
    throw new Error("Gemini devolvió una respuesta sin contenido.");
  }

  return schema.parse(JSON.parse(text));
}
