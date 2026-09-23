// Ampliación de tipos para secretos de Workers que `wrangler types`
// no conoce (los secretos no viven en wrangler.jsonc; se cargan con
// `wrangler secret put OPENCODE_ZEN_API_KEY`). Ver docs/DEPLOYMENT.md.
interface __BaseEnv_Env {
  /** API key de OpenCode Zen (Jev). Secreto: solo backend/server-side. */
  OPENCODE_ZEN_API_KEY?: string;
}
