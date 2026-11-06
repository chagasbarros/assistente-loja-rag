// Repetição de chamadas ao Gemini com espera exponencial (backoff).

// Erro "nosso" para falhas do modelo. O server.ts usa o status para decidir
// a resposta HTTP (429 -> 503, outros -> 502). O erro original fica em `cause`.
export class ModelError extends Error {
  status?: number;

  constructor(message: string, status?: number, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ModelError";
    this.status = status;
  }
}

// Status que valem nova tentativa: limite de requisições e falhas temporárias.
const RETRYABLE = new Set([429, 500, 503]);

// Descobre o status HTTP de um erro qualquer, sem confiar em um formato fixo:
// SDKs diferentes usam campos diferentes.
export function getStatus(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const e = err as Record<string, unknown>;

  for (const field of ["status", "statusCode", "code"]) {
    const value = e[field];
    if (typeof value === "number" && value >= 100 && value <= 599) return value;
  }

  // Último recurso: procura um código HTTP (4xx/5xx) na mensagem.
  if (typeof e.message === "string") {
    const match = e.message.match(/\b([45]\d{2})\b/);
    if (match) return Number(match[1]);
  }
  return undefined;
}

// O 429 tem dois casos: limite por minuto (passa em segundos, vale repetir) e
// cota diária esgotada (só volta em horas, repetir só gasta tempo). A API não
// manda um código diferente, então olhamos o texto do erro, que traz algo como
// "limit: 20 requests per day" ou um quotaId terminado em "PerDay".
export function isDailyQuota(err: unknown): boolean {
  const message = (err as { message?: unknown })?.message;
  return typeof message === "string" && /per ?day|daily/i.test(message);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Executa fn; em 429/500/503 espera 1 s, 2 s, 4 s (+ até 500 ms aleatórios)
// e tenta de novo. A variação aleatória evita que vários clientes tentem
// todos no mesmo instante. Exceção: 429 de cota diária falha na hora.
// Ao desistir, lança ModelError.
// Esta é a ÚNICA camada de retry: o retry interno do SDK fica desligado
// (veja llm.ts), senão as esperas se somam.
export async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = getStatus(err);
      const canRetry = status !== undefined && RETRYABLE.has(status) && !(status === 429 && isDailyQuota(err));

      if (!canRetry || attempt >= attempts) {
        // Mensagem genérica de propósito: não repassa o texto do erro original.
        throw new ModelError(`Falha ao chamar o modelo (status ${status ?? "desconhecido"})`, status, {
          cause: err,
        });
      }

      const wait = 1000 * 2 ** (attempt - 1) + Math.random() * 500;
      await sleep(wait);
    }
  }
}
