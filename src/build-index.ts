// Indexação: lê processed/chunks.jsonl, gera os embeddings e salva index/index.json.
import { readFileSync } from "node:fs";
import { embedDocuments } from "./embeddings.js";
import { saveIndex, INDEX_PATH, type IndexedChunk } from "./store.js";
import type { Chunk } from "./types.js";

const CHUNKS_PATH = "datalake/processed/chunks.jsonl";
const BATCH_SIZE = 16; // vários textos por chamada = menos requisições à API

async function main(): Promise<void> {
  const chunks: Chunk[] = readFileSync(CHUNKS_PATH, "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as Chunk);

  const index: IndexedChunk[] = [];

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const vectors = await embedDocuments(batch.map((c) => c.text));
    batch.forEach((chunk, j) => index.push({ ...chunk, embedding: vectors[j]! }));
    console.log(`Lote ${i / BATCH_SIZE + 1}: ${index.length}/${chunks.length} chunks`);
  }

  saveIndex(index);
  console.log(`Índice salvo em ${INDEX_PATH} (${index.length} chunks)`);
}

main().catch((err: unknown) => {
  // Mostra só o nome, a mensagem e o status, nunca o objeto inteiro.
  const e = err as { name?: string; message?: string; status?: number };
  console.error(`Erro: ${e.name ?? "Error"}: ${e.message ?? String(err)}`);
  process.exit(1);
});
