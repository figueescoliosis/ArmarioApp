/**
 * Reordenado y redacción de los mejores conjuntos con un modelo.
 *
 * Es estrictamente opcional. El motor de reglas ya entrega conjuntos válidos
 * con su explicación; esto solo añade criterio de estilista y una frase mejor
 * escrita. Si falla, si no hay clave o si tarda, se devuelven los conjuntos tal
 * cual venían: la app nunca depende de este paso.
 *
 * Usa Claude si hay `ANTHROPIC_API_KEY` y, si no, Gemini. No hay variable para
 * elegir: con una sola clave configurada no hay nada que decidir, y el paso es
 * opcional de todas formas.
 */

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as z from "zod/v4";

import type { CoupleOutfit, Outfit } from "@/lib/types";
import { geminiJson, hasGemini } from "@/lib/ai/gemini";

const DEFAULT_MODEL = "claude-opus-5";
/** Cuántos conjuntos se mandan al modelo. Una sola llamada para todos. */
const TOP_N = 5;

const RankingSchema = z.object({
  outfits: z.array(
    z.object({
      id: z.string().describe("El id del conjunto, copiado tal cual."),
      name: z.string().describe("Nombre corto y evocador, máximo cuatro palabras."),
      rationale: z
        .string()
        .describe(
          "Una o dos frases explicando por qué funciona. Tono de Mocha: cálido y concreto, nunca un elogio genérico.",
        ),
      rank: z.number().int().describe("Posición recomendada, empezando en 1."),
    }),
  ),
});

const SYSTEM_PROMPT = `Eres Mocha, la amiga de Cinnamoroll: dulce, entusiasta y muy pendiente de la
moda. Hablas de tú, con frases cortas, como una amiga mayor que quiere que
triunfes. No eres empalagosa: cariño con criterio, no un chorro de piropos. No
te presentes ni saludes: lo que escribes son nombres de conjunto y
explicaciones, no un mensaje de chat.

Recibes conjuntos que ya ha compuesto un motor de reglas a partir del armario
real de una persona, con los atributos de cada prenda. Tu trabajo es doble:

1. Reordenarlos según lo bien que funcionan de verdad al vestir. El motor mide
   armonía de color y coherencia de registro, pero no sabe de proporciones, de
   siluetas ni de lo que simplemente no se lleva. Ahí es donde aportas.
2. Escribir para cada uno un nombre corto (máximo cuatro palabras) y una
   explicación de una o dos frases.

Sé concreta y honesta: si algo no pega, dilo, con cariño pero dilo. Nunca
inventes prendas que no estén en la lista. Devuelve todos los conjuntos que
recibas, ninguno menos.`;

const COUPLE_PROMPT = `${SYSTEM_PROMPT}

Esta vez cada conjunto es un par: un look para cada persona de una pareja que
va a salir junta. Valora sobre todo si los dos looks combinan entre sí sin ir
disfrazados de iguales, y explica el porqué hablando a los dos ("vais...").`;

/**
 * Devuelve los conjuntos reordenados y con textos del modelo.
 * Ante cualquier problema devuelve `outfits` sin tocar.
 */
export async function explainOutfits(outfits: Outfit[]): Promise<Outfit[]> {
  return rewriteTop(outfits, SYSTEM_PROMPT, describeOutfits, (outfit, entry) => ({
    ...outfit,
    name: entry.name,
    rationale: entry.rationale,
    source: "rules+llm" as const,
  }));
}

/** Lo mismo para los pares de `/api/outfits/couple`. */
export async function explainCouples(pairs: CoupleOutfit[]): Promise<CoupleOutfit[]> {
  return rewriteTop(pairs, COUPLE_PROMPT, describeCouples, (pair, entry) => ({
    ...pair,
    name: entry.name,
    rationale: entry.rationale,
  }));
}

type Entry = z.infer<typeof RankingSchema>["outfits"][number];

/** Manda el top al modelo, reordena con su criterio y deja el resto como estaba. */
async function rewriteTop<T extends { id: string }>(
  items: T[],
  system: string,
  describe: (items: T[]) => string,
  apply: (item: T, entry: Entry) => T,
): Promise<T[]> {
  if (items.length === 0) return items;
  if (!process.env.ANTHROPIC_API_KEY && !hasGemini()) return items;

  const head = items.slice(0, TOP_N);
  const tail = items.slice(TOP_N);

  try {
    const parsed = await rank(system, describe(head));
    if (parsed === null) return items;

    const byId = new Map(parsed.outfits.map((entry) => [entry.id, entry]));

    const rewritten = head
      .map((item) => {
        const entry = byId.get(item.id);
        if (entry === undefined) return { item, rank: Number.MAX_SAFE_INTEGER };
        return { item: apply(item, entry), rank: entry.rank };
      })
      .sort((a, b) => a.rank - b.rank)
      .map((entry) => entry.item);

    return [...rewritten, ...tail];
  } catch {
    // Degradar en silencio es lo correcto aquí: el usuario sigue viendo sus
    // conjuntos, solo que con la explicación generada por reglas.
    return items;
  }
}

/** Pregunta al modelo que haya configurado. Claude manda si están los dos. */
async function rank(system: string, prompt: string): Promise<z.infer<typeof RankingSchema> | null> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (anthropicKey) {
    const client = new Anthropic({ apiKey: anthropicKey });
    const message = await client.messages.parse({
      model: process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL,
      max_tokens: 4000,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: prompt }],
      output_config: { format: zodOutputFormat(RankingSchema) },
    });
    return message.parsed_output;
  }

  return geminiJson(
    process.env.GEMINI_API_KEY as string,
    system,
    [{ text: prompt }],
    RankingSchema,
  );
}

/** Describe los conjuntos en texto plano, que es más barato en tokens que JSON. */
function describeOutfits(outfits: Outfit[]): string {
  return outfits.map((outfit) => `Conjunto ${outfit.id}\n${describeItems(outfit)}`).join("\n\n");
}

function describeCouples(pairs: CoupleOutfit[]): string {
  return pairs
    .map(
      (pair) =>
        `Conjunto ${pair.id}\n Look de una persona:\n${describeItems(pair.mine)}\n Look de la otra:\n${describeItems(pair.theirs)}`,
    )
    .join("\n\n");
}

function describeItems(outfit: Outfit): string {
  return outfit.items
    .map((item) => {
      const g = item.garment;
      const color = g.colors[0]?.name || g.primaryHex;
      return `  - ${item.slot}: ${g.subcategory}, ${color}, ${g.pattern}, formalidad ${g.formality}/5, abrigo ${g.warmth}/5${g.material ? `, ${g.material}` : ""}`;
    })
    .join("\n");
}
