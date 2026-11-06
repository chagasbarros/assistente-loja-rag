// API HTTP: POST /perguntar e GET /saude.
import Fastify from "fastify";
import { z, ZodError } from "zod";
import { ask } from "./rag.js";
import { ModelError } from "./retry.js";

const app = Fastify({ logger: true }); // o Fastify loga método, URL e status, nunca o corpo

const PerguntaSchema = z.object({
  pergunta: z.string().trim().min(3).max(500),
});

app.get("/saude", async () => ({ ok: true }));

app.post("/perguntar", async (request) => {
  // Se o corpo for inválido, parse() lança ZodError e o setErrorHandler responde 400.
  const { pergunta } = PerguntaSchema.parse(request.body);
  const resultado = await ask(pergunta);

  // Regra: nunca logar o texto da pergunta. Só tokens e arquivos usados.
  const arquivos = [...new Set(resultado.fontes.map((f) => f.arquivo))];
  request.log.info({ tokens: resultado.uso, arquivos }, "pergunta respondida");

  return resultado;
});

// Todos os erros passam por aqui. O corpo da resposta nunca traz detalhes
// internos; o log guarda só nome, status e mensagem (sem o erro original,
// que pode conter dados da requisição).
app.setErrorHandler((error: unknown, request, reply) => {
  if (error instanceof ZodError) {
    return reply.code(400).send({ erro: "Envie { pergunta } com 3 a 500 caracteres." });
  }

  if (error instanceof ModelError) {
    request.log.error({ erro: error.name, status: error.status }, error.message);
    if (error.status === 429) {
      return reply
        .code(503)
        .header("retry-after", "30")
        .send({ erro: "Muitas requisições. Tente novamente em instantes." });
    }
    return reply.code(502).send({ erro: "Falha ao consultar o modelo." });
  }

  // Erros do próprio Fastify (JSON malformado, content-type errado...) têm statusCode.
  const statusCode = (error as { statusCode?: unknown }).statusCode;
  if (typeof statusCode === "number" && statusCode >= 400 && statusCode < 500) {
    return reply.code(statusCode).send({ erro: "Requisição inválida." });
  }

  const e = error as { name?: string; message?: string };
  request.log.error({ erro: e.name }, e.message ?? "erro desconhecido");
  return reply.code(500).send({ erro: "Erro interno." });
});

app.listen({ port: 3000, host: "0.0.0.0" }).catch((err: unknown) => {
  app.log.error({ erro: (err as Error).name }, (err as Error).message);
  process.exit(1);
});
