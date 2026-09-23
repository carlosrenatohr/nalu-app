import { experimental_evaluate } from "ai";
import { ApiError } from "../../utils/http-error";
import {
  aiInvalidResponse,
  aiNotConfigured,
  aiRateLimit,
  aiTimeout,
  aiUnavailable,
} from "./errors";
import type {
  AiClient,
  AiEvaluateRequest,
  AiEvaluateResponse,
  ChoiceAnswer,
} from "./zen-client";

// ---------------------------------------------------------------------
// Cliente de Jev vía Vercel AI Gateway (AI SDK `experimental_evaluate`).
//
// Motivo de existir: OpenCode Zen limita por ORIGEN las peticiones que
// salen desde Cloudflare Workers (429 sostenido en producción; ver
// docs/JEV.md). El gateway entrega el MISMO Jev (alias typesafe-ai/jev)
// desde un origen serverless soportado y con su propia clave (vck_…).
//
// - La clave solo vive en process.env: jamás en logs ni en respuestas.
// - Contrato de errores idéntico al cliente Zen (mismos códigos).
// - Mapea la respuesta del AI SDK a la forma System One que ya valida
//   el resto de Nalu (Zod + semántica en el service).
// ---------------------------------------------------------------------

export interface GatewayClientOptions {
  apiKey: string;
  /** Alias del modelo en el gateway (por defecto typesafe-ai/jev). */
  model?: string;
  timeoutMs?: number;
}

export const DEFAULT_GATEWAY_MODEL = "typesafe-ai/jev";

const DEFAULT_TIMEOUT_MS = 15_000;

function isTimeout(err: unknown): boolean {
  return err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
}

function statusCodeOf(err: unknown): number | null {
  const status = (err as { statusCode?: unknown } | null)?.statusCode;
  return typeof status === "number" ? status : null;
}

function detailOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function createGatewayClient(options: GatewayClientOptions): AiClient {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const model = options.model ?? DEFAULT_GATEWAY_MODEL;

  // El AI SDK autentica contra el gateway leyendo process.env.
  try {
    process.env.AI_GATEWAY_API_KEY = options.apiKey;
  } catch {
    // Runtime sin process.env escribible: el fallo de auth se mapea abajo.
  }

  return {
    async evaluate(request: AiEvaluateRequest): Promise<AiEvaluateResponse> {
      if (!options.apiKey) {
        throw aiNotConfigured();
      }

      try {
        const result = await experimental_evaluate({
          model,
          state: request.state,
          questions: request.questions,
          // Sin reintentos del SDK: la UX de reintento la decide Nalu.
          maxRetries: 0,
          abortSignal: AbortSignal.timeout(timeoutMs),
          // Sin retención de datos en el gateway (misma práctica que Kev).
          providerOptions: { gateway: { zeroDataRetention: true } },
        });

        // La confianza por pregunta de TypeSafe llega en providerMetadata.
        const confidenceByQuestion = (
          result.providerMetadata as unknown as
            | { typesafe?: { confidence?: Record<string, number> } }
            | undefined
        )?.typesafe?.confidence;

        const answers: Record<string, ChoiceAnswer> = {};
        for (const qid of Object.keys(request.questions)) {
          const answer = result.answers[qid as keyof typeof result.answers];
          // El SDK tipa answers como unión (choice|score|boolean): estrechamos.
          if (answer?.type !== "choice" || !answer.probabilities) {
            console.error(`[ai] gateway sin probabilities válidas (${qid})`);
            throw aiInvalidResponse();
          }
          const probabilities = answer.probabilities;
          const raw = confidenceByQuestion?.[qid] ?? probabilities[answer.choice] ?? 0;
          const confidence = Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0;
          answers[qid] = {
            type: "choice",
            choice: answer.choice,
            confidence,
            probabilities: { ...probabilities },
          };
        }

        return {
          model,
          answers,
          usage: {
            input_tokens: result.usage?.inputTokens,
            output_tokens: result.usage?.outputTokens,
          },
        };
      } catch (err) {
        if (err instanceof ApiError) throw err; // errores ya controlados
        if (isTimeout(err)) throw aiTimeout();

        const status = statusCodeOf(err);
        console.error(
          `[ai] gateway respondió con error (status=${status ?? "-"}): ${detailOf(err)}`,
        );
        if (status === 401 || status === 403 || status === 404) throw aiNotConfigured(true);
        if (status === 429) throw aiRateLimit();
        if (detailOf(err).includes("AI_GATEWAY_API_KEY")) throw aiNotConfigured();
        throw aiUnavailable();
      }
    },
  };
}
