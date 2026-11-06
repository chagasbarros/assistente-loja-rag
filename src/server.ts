// API HTTP: POST /perguntar e GET /saude. Se o frontend tiver sido buildado
// (web/dist), também serve o chat em "/".
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { z, ZodError } from "zod";
import { ask } from "./rag.js";
import { ModelError } from "./retry.js";

const app = Fastify({ logger: true }); // o Fastify loga método, URL e status, nunca o corpo

// Caminho absoluto de web/dist, calculado a partir deste arquivo (e não da
// pasta onde o comando foi rodado). O @fastify/static exige caminho absoluto.
const WEB_DIST = fileURLToPath(new URL("../web/dist", import.meta.url));

// Só serve o frontend se o build existir. Em desenvolvimento quem serve a
// página é o Vite (npm run web:dev); em produção é a própria API, na mesma
// origem: por isso não precisamos de CORS.
if (existsSync(WEB_DIST)) {
  await app.register(fastifyStatic, { root: WEB_DIST });
  app.log.info("servindo o frontend de web/dist");
}

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

// Serviços de hospedagem (Render, Railway...) definem a porta pela variável PORT.
const PORT = Number(process.env.PORT ?? 3000);

app.listen({ port: PORT, host: "0.0.0.0" }).catch((err: unknown) => {
  app.log.error({ erro: (err as Error).name }, (err as Error).message);
  process.exit(1);
});
