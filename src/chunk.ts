// Quebra um texto em pedaços (chunks) de tamanho parecido, com sobreposição.
// 1.800 caracteres ≈ 500 tokens em português.
export function chunkText(text: string, size = 1800, overlap = 200): string[] {
  if (overlap >= size) {
    throw new Error("overlap precisa ser menor que size");
  }

  // Normaliza quebras de linha do Windows (\r\n) para \n.
  const clean = text.replace(/\r\n/g, "\n");
  const chunks: string[] = [];
  let start = 0;

  while (start < clean.length) {
    let end = Math.min(start + size, clean.length);

    // Se não chegamos ao fim do texto, tenta cortar no último parágrafo (\n\n)
    // antes do limite. Só aceita o corte se ele estiver depois da metade do
    // chunk; senão o pedaço ficaria pequeno demais.
    if (end < clean.length) {
      const paragraph = clean.lastIndexOf("\n\n", end);
      if (paragraph > start + size / 2) {
        end = paragraph;
      }
    }

    const piece = clean.slice(start, end).trim();
    if (piece.length > 0) {
      chunks.push(piece);
    }

    if (end >= clean.length) break;

    // Volta "overlap" caracteres para o próximo chunk repetir o final deste.
    // Isso evita perder uma regra que ficou dividida entre dois chunks.
    start = end - overlap;
  }

  return chunks;
}
