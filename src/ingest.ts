// Ingestão: lê os originais de datalake/raw, extrai o texto, mascara dados
// pessoais, quebra em chunks e grava datalake/processed/chunks.jsonl.
// raw/ é somente leitura: aqui só lemos de lá.
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { extname, join } from "node:path";
import { parse } from "csv-parse/sync";
import { chunkText } from "./chunk.js";
import { maskPii } from "./pii.js";
import type { Chunk } from "./types.js";

const RAW_DIR = "datalake/raw";
const PROCESSED_DIR = "datalake/processed";
const OUTPUT = join(PROCESSED_DIR, "chunks.jsonl");

// Cada registro de CSV/JSON vira um parágrafo separado por linha em branco,
// assim o chunkText consegue cortar entre registros em vez de no meio deles.
function csvToText(content: string): string {
  const rows = parse(content, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
  return rows
    .map((row) => {
      if (row.pergunta === undefined || row.resposta === undefined) {
        throw new Error("CSV precisa ter as colunas pergunta,resposta");
      }
      return `Pergunta: ${row.pergunta}\nResposta: ${row.resposta}`;
    })
    .join("\n\n");
}

interface Ticket {
  assunto: string;
  resolucao: string;
}

function ticketsToText(content: string): string {
  const tickets = JSON.parse(content) as Ticket[];
  if (!Array.isArray(tickets)) {
    throw new Error("JSON precisa ser uma lista de tickets");
  }
  return tickets.map((t) => `Ticket: ${t.assunto}\nResolução: ${t.resolucao}`).join("\n\n");
}

function extractText(fileName: string, content: string): string {
  const ext = extname(fileName).toLowerCase();
  switch (ext) {
    case ".md":
    case ".txt":
      return content;
    case ".csv":
      return csvToText(content);
    case ".json":
      return ticketsToText(content);
    default:
      throw new Error(`Formato desconhecido: ${fileName}`);
  }
}

function main(): void {
  // Ordena para o resultado ser sempre o mesmo, independente do sistema.
  const files = readdirSync(RAW_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();

  const chunks: Chunk[] = [];

  for (const file of files) {
    const content = readFileSync(join(RAW_DIR, file), "utf8");
    // Mascara ANTES de quebrar e gravar: nada com dado pessoal chega a processed/.
    const text = maskPii(extractText(file, content));
    chunkText(text).forEach((piece, position) => {
      chunks.push({ id: `${file}#${position}`, source: file, position, text: piece });
    });
  }

  mkdirSync(PROCESSED_DIR, { recursive: true });
  const jsonl = chunks.map((c) => JSON.stringify(c)).join("\n") + "\n";
  writeFileSync(OUTPUT, jsonl, "utf8");

  console.log(`${files.length} arquivos -> ${chunks.length} chunks`);
}

main();
