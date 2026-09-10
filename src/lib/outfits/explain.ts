/**
 * Reordenado y redacción de los mejores conjuntos con Claude.
 *
 * Es estrictamente opcional. El motor de reglas ya entrega conjuntos válidos
 * con su explicación; esto solo añade criterio de estilista y una frase mejor
 * escrita. Si falla, si no hay clave o si tarda, se devuelven los conjuntos tal
 * cual venían: la app nunca depende de este paso.
 */

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as z from "zod/v4";

import type { Outfit } from "@/lib/types";

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
        .describe("Una o dos frases explicando por qué funciona. Tono de estilista, sin adular."),
      rank: z.number().int().describe("Posición recomendada, empezando en 1."),
    }),
  ),
});

const SYSTEM_PROMPT = `Eres un estilista con criterio y sin condescendencia.

Recibes conjuntos que ya ha compuesto un motor de reglas a partir del armario
real de una persona, con los atributos de cada prenda. Tu trabajo es doble:

1. Reordenarlos según lo bien que funcionan de verdad al vestir. El motor mide
   armonía de color y coherencia de registro, pero no sabe de proporciones, de
   siluetas ni de lo que simplemente no se lleva. Ahí es donde aportas.
2. Escribir para cada uno un nombre corto y una explicación de una o dos frases.

Sé concreto y honesto: si un conjunto funciona por el contraste de texturas,
dilo; no escribas elogios genéricos. Nunca inventes prendas que no estén en la
lista. Devuelve todos los conjuntos que recibas, ninguno menos.`;

/**
 * Devuelve los conjuntos reordenados y con textos del modelo.
 * Ante cualquier problema devuelve `outfits` sin tocar.
 */
export async function explainOutfits(outfits: Outfit[]): Promise<Outfit[]> {
  if (outfits.length === 0) return outfits;
  if (!process.env.ANTHROPIC_API_KEY) return outfits;

  const head = outfits.slice(0, TOP_N);
  const tail = outfits.slice(TOP_N);

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await client.messages.parse({
      model: process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL,
      max_tokens: 4000,
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: describeOutfits(head) }],
      output_config: { format: zodOutputFormat(RankingSchema) },
    });

    const parsed = message.parsed_output;
    if (parsed === null) return outfits;

    const byId = new Map(parsed.outfits.map((entry) => [entry.id, entry]));

    const rewritten = head
      .map((outfit) => {
        const entry = byId.get(outfit.id);
        if (entry === undefined) return { outfit, rank: Number.MAX_SAFE_INTEGER };
        return {
          outfit: {
            ...outfit,
            name: entry.name,
            rationale: entry.rationale,
            source: "rules+llm" as const,
          },
          rank: entry.rank,
        };
      })
      .sort((a, b) => a.rank - b.rank)
      .map((entry) => entry.outfit);

    return [...rewritten, ...tail];
  } catch {
    // Degradar en silencio es lo correcto aquí: el usuario sigue viendo sus
    // conjuntos, solo que con la explicación generada por reglas.
    return outfits;
  }
}

/** Describe los conjuntos en texto plano, que es más barato en tokens que JSON. */
function describeOutfits(outfits: Outfit[]): string {
  return outfits
    .map((outfit) => {
      const prendas = outfit.items
        .map((item) => {
          const g = item.garment;
          const color = g.colors[0]?.name || g.primaryHex;
          return `  - ${item.slot}: ${g.subcategory}, ${color}, ${g.pattern}, formalidad ${g.formality}/5, abrigo ${g.warmth}/5${g.material ? `, ${g.material}` : ""}`;
        })
        .join("\n");
      return `Conjunto ${outfit.id}\n${prendas}`;
    })
    .join("\n\n");
}
