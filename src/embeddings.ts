// Geração de embeddings com o Gemini. Junto com llm.ts, é o único arquivo que
// fala com o provedor de IA.
import { GoogleGenAI } from "@google/genai";
import { withRetry } from "./retry.js";

const MODEL = "gemini-embedding-001";
const DIMENSIONS = 768;

// Sem parâmetros, o SDK lê GEMINI_API_KEY do ambiente.
const ai = new GoogleGenAI({});

// Deixa o vetor com norma 1. Assim o produto escalar entre dois vetores
// é igual à similaridade de cosseno (com 768 dimensões o modelo não devolve
// vetores normalizados).
function normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  return norm === 0 ? vector : vector.map((v) => v / norm);
}

async function embed(texts: string[], taskType: string): Promise<number[][]> {
  const result = await withRetry(() =>
    ai.models.embedContent({
      model: MODEL,
      contents: texts,
      config: { taskType, outputDimensionality: DIMENSIONS },
    }),
  );

  const vectors = result.embeddings?.map((e) => e.values ?? []) ?? [];
  if (vectors.length !== texts.length || vectors.some((v) => v.length !== DIMENSIONS)) {
    throw new Error(`Esperava ${texts.length} vetores de ${DIMENSIONS} dimensões`);
  }
  return vectors.map(normalize);
}

// Para os chunks dos documentos (usado na indexação).
export function embedDocuments(texts: string[]): Promise<number[][]> {
  return embed(texts, "RETRIEVAL_DOCUMENT");
}

// Para a pergunta do usuário (usado na busca).
export async function embedQuery(text: string): Promise<number[]> {
  const [vector] = await embed([text], "RETRIEVAL_QUERY");
  return vector!;
}
