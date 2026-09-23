import type { SystemOneQuestions } from "../../domain/ai/recommendation";
import {
  aiInvalidResponse,
  aiNotConfigured,
  aiRateLimit,
  aiTimeout,
  aiUnavailable,
} from "./errors";

// ---------------------------------------------------------------------
// Cliente HTTP de OpenCode Zen (System One / Jev).
//
// - La API key JAMÁS sale del backend ni se registra en logs.
// - Sin dependencias nuevas: fetch nativo (compatible con Workers).
// - Errores de red/timeout/proveedor → errores controlados compartidos
//   (services/ai/errors.ts); el detalle solo queda en el log del
//   servidor. El cliente es inyectable para que los tests no dependan
//   de la red.
//
// Nota: en producción Zen limita por ORIGEN las IPs de Cloudflare
// Workers (429 sostenido); por eso el proveedor preferido en prod es
// el Vercel AI Gateway (ver gateway-client.ts y docs/JEV.md).
// ---------------------------------------------------------------------

export interface ZenClientOptions {
  apiKey: string;
  model: string;
  endpoint: string;
  timeoutMs?: number;
}

export interface AiEvaluateRequest {
  state: string;
  questions: SystemOneQuestions;
}

export interface ChoiceAnswer {
  type: "choice";
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
}

export interface AiEvaluateResponse {
  model?: string;
  answers: Record<string, ChoiceAnswer>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

/** Contrato mínimo del proveedor de IA (inyectable en tests). */
export interface AiClient {
  evaluate(request: AiEvaluateRequest): Promise<AiEvaluateResponse>;
}

const DEFAULT_TIMEOUT_MS = 15_000;

function isTimeout(err: unknown): boolean {
  return err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
}

export function createZenClient(options: ZenClientOptions): AiClient {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    async evaluate(request: AiEvaluateRequest): Promise<AiEvaluateResponse> {
      if (!options.apiKey) {
        throw aiNotConfigured();
      }

      let res: Response;
      try {
        res = await fetch(options.endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${options.apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            model: options.model,
            state: request.state,
            questions: request.questions,
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (err) {
        if (isTimeout(err)) {
          throw aiTimeout();
        }
        console.error("[ai] error de red al llamar al proveedor:", err instanceof Error ? err.message : err);
        throw aiUnavailable();
      }

      if (res.status === 401 || res.status === 403) {
        console.error(`[ai] credenciales rechazadas por el proveedor (${res.status})`);
        throw aiNotConfigured(true);
      }
      if (res.status === 429) {
        console.warn("[ai] rate limit del proveedor (429)");
        throw aiRateLimit();
      }
      if (!res.ok) {
        console.error(`[ai] el proveedor respondió ${res.status}`);
        throw aiUnavailable();
      }

      try {
        return (await res.json()) as AiEvaluateResponse;
      } catch {
        throw aiInvalidResponse();
      }
    },
  };
}
