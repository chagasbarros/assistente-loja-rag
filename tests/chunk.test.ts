import { describe, it, expect } from "vitest";
import { chunkText } from "../src/chunk.js";

describe("chunkText", () => {
  it("devolve um único chunk quando o texto é menor que o limite", () => {
    expect(chunkText("Olá, mundo.")).toEqual(["Olá, mundo."]);
  });

  it("descarta texto vazio ou só com espaços", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n\n  ")).toEqual([]);
  });

  it("normaliza \\r\\n para \\n", () => {
    expect(chunkText("linha 1\r\nlinha 2")).toEqual(["linha 1\nlinha 2"]);
  });

  it("nenhum chunk passa do tamanho máximo", () => {
    const text = "a".repeat(5000);
    const chunks = chunkText(text, 1000, 100);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(1000);
  });

  it("aplica sobreposição entre chunks consecutivos", () => {
    // Sem \n\n, o corte é exato: chunk 2 começa 20 caracteres antes do fim do 1.
    const text = Array.from({ length: 300 }, (_, i) => String(i % 10)).join("");
    const [first, second] = chunkText(text, 100, 20);
    expect(second!.slice(0, 20)).toBe(first!.slice(-20));
  });

  it("corta no último parágrafo quando ele fica depois da metade do chunk", () => {
    const p1 = "x".repeat(70);
    const p2 = "y".repeat(70);
    const chunks = chunkText(`${p1}\n\n${p2}`, 100, 10);
    expect(chunks[0]).toBe(p1); // cortou no \n\n (posição 70 > 50)
  });

  it("ignora o parágrafo se ele estiver antes da metade do chunk", () => {
    const p1 = "x".repeat(20);
    const p2 = "y".repeat(200);
    const chunks = chunkText(`${p1}\n\n${p2}`, 100, 10);
    expect(chunks[0]!.length).toBe(100); // \n\n na posição 20 < 50: corte no limite
  });

  it("recusa overlap maior ou igual ao tamanho", () => {
    expect(() => chunkText("abc", 100, 100)).toThrow();
  });
});
