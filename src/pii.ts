// Mascara dados pessoais (CPF, e-mail e telefone) antes de gravar ou enviar texto.
//
// LIMITAÇÃO: é só um ponto de partida baseado em regex. Ele não pega nomes,
// endereços, RG, cartões, dados escritos por extenso ("nove nove oito...") nem
// formatos fora do padrão. Também pode mascarar por engano um número de 11
// dígitos que não é CPF. Em produção, use uma ferramenta própria de detecção
// de PII e revise os resultados.

// E-mail: algo@dominio.tld
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;

// CPF: 123.456.789-09 ou 12345678909. (?<!\d) e (?!\d) evitam pegar só um
// pedaço de um número maior.
const CPF = /(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)/g;

// Telefone brasileiro: +55 opcional, DDD opcional (com ou sem parênteses),
// fixo (8 dígitos) ou celular (9 dígitos), com ou sem hífen/espaço.
// Ex.: (11) 98765-4321, +55 21 99876-5432, (85) 3456-7890, 11987654321.
const TELEFONE = /(?:\+55\s?)?(?:\(\d{2}\)\s?|(?<!\d)\d{2}\s)?(?<!\d)9?\d{4}[-\s]?\d{4}(?!\d)/g;

export function maskPii(text: string): string {
  // A ordem importa: e-mail primeiro (pode conter números), depois CPF
  // (11 dígitos) e por último telefone.
  return text
    .replace(EMAIL, "[EMAIL]")
    .replace(CPF, "[CPF]")
    .replace(TELEFONE, "[TELEFONE]");
}
