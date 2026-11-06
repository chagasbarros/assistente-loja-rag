import { describe, it, expect } from "vitest";
import { maskPii } from "../src/pii.js";

describe("maskPii", () => {
  it("mascara CPF com pontuação", () => {
    expect(maskPii("CPF 123.456.789-09.")).toBe("CPF [CPF].");
  });

  it("mascara CPF sem pontuação", () => {
    expect(maskPii("CPF 98765432100 ok")).toBe("CPF [CPF] ok");
  });

  it("mascara e-mail", () => {
    expect(maskPii("escreva para maria.silva+loja@exemplo.com.br hoje")).toBe(
      "escreva para [EMAIL] hoje",
    );
  });

  it("mascara telefones em vários formatos", () => {
    expect(maskPii("tel (11) 98765-4321")).toBe("tel [TELEFONE]");
    expect(maskPii("tel +55 21 99876-5432")).toBe("tel [TELEFONE]");
    expect(maskPii("tel (85) 3456-7890")).toBe("tel [TELEFONE]");
    expect(maskPii("tel 98765-4321")).toBe("tel [TELEFONE]");
  });

  it("mascara vários dados no mesmo texto", () => {
    const input = "Ana (CPF 111.222.333-96), ana@exemplo.com, (11) 91234-5678";
    expect(maskPii(input)).toBe("Ana (CPF [CPF]), [EMAIL], [TELEFONE]");
  });

  it("não altera valores, prazos e datas comuns", () => {
    const text = "Troca em até 30 dias. Frete grátis acima de R$ 299,00. Taxa de R$ 19,90 em 2026.";
    expect(maskPii(text)).toBe(text);
  });
});
