// "Banco vetorial" simples: um arquivo JSON e busca por produto escalar.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import type { Chunk } from "./types.js";

export const INDEX_PATH = "datalake/index/index.json";

export interface IndexedChunk extends Chunk {
  embedding: number[];
}

export interface Hit {
  chunk: Chunk;
  score: number; // similaridade de cosseno (vetores já normalizados)
}

export function saveIndex(index: IndexedChunk[], path = INDEX_PATH): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(index), "utf8");
}

export function loadIndex(path = INDEX_PATH): IndexedChunk[] {
  if (!existsSync(path)) {
    throw new Error(`Índice não encontrado em ${path}. Rode "npm run index" antes.`);
  }
  return JSON.parse(readFileSync(path, "utf8")) as IndexedChunk[];
}

function dot(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Dimensões diferentes: ${a.length} e ${b.length}`);
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i]! * b[i]!;
  return sum;
}

// Compara a pergunta com todos os chunks (busca exata, "força bruta").
// Para alguns milhares de chunks isso é rápido o bastante.
export function search(index: IndexedChunk[], query: number[], k = 4): Hit[] {
  return index
    .map(({ embedding, ...chunk }) => ({ chunk, score: dot(embedding, query) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
