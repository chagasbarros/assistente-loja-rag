// RAG: junta as peças (máscara de PII -> embedding -> busca -> resposta).
import { maskPii } from "./pii.js";
import { embedQuery } from "./embeddings.js";
import { loadIndex, search } from "./store.js";
import { answer, type Answer } from "./llm.js";

// Carregado uma única vez, quando o módulo é importado (na subida do servidor).
// Se o índice não existir, o servidor nem sobe e a mensagem explica o motivo.
const index = loadIndex();

export async function ask(pergunta: string, k = 4): Promise<Answer> {
  // Mascara ANTES de embedar e de enviar ao Gemini.
  const masked = maskPii(pergunta);
  const queryVector = await embedQuery(masked);
  const hits = search(index, queryVector, k);
  return answer(masked, hits);
}
