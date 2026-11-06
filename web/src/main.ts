// Lógica do chat: envia a pergunta para a API e mostra a resposta.
import "./style.css";

// Espelha o retorno de answer() em src/llm.ts do backend. Fica duplicado de
// propósito: o frontend não importa nada do backend, só conhece o contrato da API.
interface Answer {
  resposta: string;
  fontes: { trecho: number; arquivo: string; score: number }[];
  uso: { entrada: number; saida: number; total: number };
}

const mensagens = document.querySelector<HTMLElement>("#mensagens")!;
const formulario = document.querySelector<HTMLFormElement>("#formulario")!;
const campo = document.querySelector<HTMLTextAreaElement>("#pergunta")!;
const botao = document.querySelector<HTMLButtonElement>("#enviar")!;
const aviso = document.querySelector<HTMLElement>("#aviso")!;
const contador = document.querySelector<HTMLElement>("#contador")!;

// Cria um balão de mensagem e rola a lista até ele.
function adicionarBalao(tipo: "usuario" | "assistente" | "erro", texto: string): HTMLDivElement {
  const balao = document.createElement("div");
  balao.className = `msg ${tipo}`;
  const p = document.createElement("p");
  p.textContent = texto; // textContent nunca interpreta HTML: seguro contra XSS
  balao.append(p);
  mensagens.append(balao);
  balao.scrollIntoView({ behavior: "smooth", block: "end" });
  return balao;
}

// Converte **negrito** em <strong> sem usar innerHTML: divide o texto pelos
// "**"; os pedaços de posição ímpar estavam entre asteriscos.
function textoComNegrito(texto: string): DocumentFragment {
  const fragmento = document.createDocumentFragment();
  texto.split("**").forEach((pedaco, i) => {
    if (i % 2 === 1) {
      const forte = document.createElement("strong");
      forte.textContent = pedaco;
      fragmento.append(forte);
    } else {
      fragmento.append(pedaco); // string vira nó de texto, sem interpretar HTML
    }
  });
  return fragmento;
}

// Citações que o modelo coloca no texto: [1], [2], [1, 2]...
const CITACAO = /\s*\[(\d+(?:\s*,\s*\d+)*)\]/g;

// Mostra a resposta sem os números de citação e, embaixo, só os arquivos
// que o modelo citou. A API continua devolvendo o [1] (útil para depurar);
// só a exibição para o cliente esconde o número.
function mostrarResposta(balao: HTMLDivElement, dados: Answer): void {
  balao.className = "msg assistente";

  // Lê os números citados ANTES de removê-los do texto. "[1, 2]" vira 1 e 2.
  const citados = new Set(
    [...dados.resposta.matchAll(CITACAO)].flatMap((m) => m[1]!.split(",").map((n) => Number(n.trim()))),
  );

  // Remove a citação e o espaço antes dela: "produto [1]." vira "produto.".
  const semCitacao = dados.resposta.replace(CITACAO, "").trim();
  balao.querySelector("p")!.replaceChildren(textoComNegrito(semCitacao));

  const arquivos = [...new Set(dados.fontes.filter((f) => citados.has(f.trecho)).map((f) => f.arquivo))];
  if (arquivos.length > 0) {
    const fontes = document.createElement("p");
    fontes.className = "fontes";
    fontes.textContent = `Fonte: ${arquivos.join(", ")}`;
    balao.append(fontes);
  }
  balao.scrollIntoView({ behavior: "smooth", block: "end" });
}

function mostrarErro(balao: HTMLDivElement, mensagem: string): void {
  balao.className = "msg erro";
  balao.querySelector("p")!.textContent = mensagem;
}

function ocupado(sim: boolean): void {
  campo.disabled = sim;
  botao.disabled = sim;
  botao.textContent = sim ? "Aguarde…" : "Enviar";
}

async function enviar(texto: string): Promise<void> {
  const pergunta = texto.trim();
  // Mesma regra do zod no server.ts: 3 a 500 caracteres depois do trim.
  if (pergunta.length < 3 || pergunta.length > 500) {
    aviso.textContent = "A pergunta precisa ter de 3 a 500 caracteres.";
    return;
  }
  aviso.textContent = "";
  campo.value = "";
  contador.textContent = "0/500";

  adicionarBalao("usuario", pergunta);
  const balao = adicionarBalao("assistente", "Pensando…");
  balao.classList.add("pensando");
  ocupado(true);

  try {
    const resposta = await fetch("/perguntar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pergunta }),
    });
    // Se o corpo não for JSON (ex.: página de erro de um proxy), segue com {}.
    const dados: unknown = await resposta.json().catch(() => ({}));
    if (resposta.ok) {
      mostrarResposta(balao, dados as Answer);
    } else {
      // A API sempre devolve { erro: "..." } com uma mensagem amigável.
      mostrarErro(balao, (dados as { erro?: string }).erro ?? "Algo deu errado.");
    }
  } catch {
    // fetch só lança em falha de rede (API parada, sem internet...).
    mostrarErro(balao, "Não foi possível falar com a API. Ela está rodando?");
  } finally {
    ocupado(false);
    campo.focus();
  }
}

formulario.addEventListener("submit", (evento) => {
  evento.preventDefault(); // impede o recarregamento da página
  void enviar(campo.value);
});

// Enter envia; Shift+Enter quebra a linha.
campo.addEventListener("keydown", (evento) => {
  if (evento.key === "Enter" && !evento.shiftKey) {
    evento.preventDefault();
    formulario.requestSubmit();
  }
});

campo.addEventListener("input", () => {
  contador.textContent = `${campo.value.length}/500`;
  aviso.textContent = "";
});

// Botões de pergunta de exemplo.
document.querySelectorAll<HTMLButtonElement>(".exemplo").forEach((b) => {
  b.addEventListener("click", () => void enviar(b.textContent ?? ""));
});

campo.focus();
