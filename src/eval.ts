// Avaliação: roda as perguntas de eval/perguntas.json pelo RAG completo e
// confere as respostas por substring (sem diferenciar maiúsculas).
import { readFileSync } from "node:fs";
import { ask } from "./rag.js";

interface Caso {
  pergunta: string;
  esperado?: string;
  semResposta?: boolean;
}

function acertou(caso: Caso, resposta: string): boolean {
  const r = resposta.toLowerCase();
  if (caso.semResposta) return r.includes("não encontrei");
  return caso.esperado !== undefined && r.includes(caso.esperado.toLowerCase());
}

async function main(): Promise<void> {
  const casos = JSON.parse(readFileSync("eval/perguntas.json", "utf8")) as Caso[];
  console.log(`Modelo: ${process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite"} | ${casos.length} perguntas\n`);

  let acertos = 0;
  let somaTokens = 0;
  let respondidas = 0;

  // Uma pergunta por vez, para não estourar o limite por minuto da API.
  for (const [i, caso] of casos.entries()) {
    try {
      const r = await ask(caso.pergunta);
      respondidas++;
      somaTokens += r.uso.total;

      const ok = acertou(caso, r.resposta);
      if (ok) acertos++;

      const resumo = r.resposta.replace(/\s+/g, " ").slice(0, 160);
      console.log(`${ok ? "OK   " : "FALHA"} ${i + 1}. ${caso.pergunta}\n      -> ${resumo}`);
      if (!ok) {
        // Primeiro passo da investigação: o chunk certo veio no top-4?
        const fontes = r.fontes.map((f) => `${f.arquivo} (${f.score})`).join(", ");
        console.log(`      esperado: ${caso.semResposta ? "recusa" : caso.esperado} | fontes: ${fontes}`);
      }
    } catch (err) {
      const e = err as { name?: string; message?: string };
      console.log(`FALHA ${i + 1}. ${caso.pergunta}\n      -> erro: ${e.name}: ${e.message}`);
    }
  }

  const media = respondidas > 0 ? Math.round(somaTokens / respondidas) : 0;
  console.log(`\nAcertos: ${acertos}/${casos.length} | tokens médios: ${media}`);
}

main();
