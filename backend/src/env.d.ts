// Ampliación de tipos para secretos de Workers que `wrangler types`
// no conoce (los secretos no viven en wrangler.jsonc; se cargan con
// `wrangler secret put …`). Ver docs/DEPLOYMENT.md.
interface __BaseEnv_Env {
  /** API key de OpenCode Zen (Jev). Secreto: solo backend/server-side. */
  OPENCODE_ZEN_API_KEY?: string;
  /**
   * Clave del Vercel AI Gateway para Jev (prefijo vck_). Secreto: solo
   * backend/server-side. Preferida en producción: Zen limita por
   * origen las IPs salientes de Cloudflare Workers (ver docs/JEV.md).
   */
  AI_GATEWAY_API_KEY?: string;
}
