import { httpServerHandler } from "cloudflare:node";
import { env } from "cloudflare:workers";
import { createApp } from "./app";
import { D1DbAdapter } from "./db/d1-adapter";
import { resolveBusinessId } from "./config/bootstrap";

// ---------------------------------------------------------------------
// Entrada de Cloudflare Workers.
// Express corre sobre el runtime de Workers gracias al flag
// nodejs_compat y al adaptador httpServerHandler de cloudflare:node.
// La base de datos es D1 (binding DB definido en wrangler.jsonc).
//
// Importante: el runtime de Workers NO permite I/O asíncrono (como
// consultas a D1) en el scope global del módulo. Por eso el id del
// negocio se resuelve de forma perezosa dentro del primer request y
// se cachea.
// ---------------------------------------------------------------------
const db = new D1DbAdapter(env.DB);

let cachedBusinessId: string | null = null;
async function getBusinessId(): Promise<string> {
  if (cachedBusinessId === null) {
    cachedBusinessId = await resolveBusinessId(db);
  }
  return cachedBusinessId;
}

const app = createApp({ db, getBusinessId });

app.listen(3000);

export default httpServerHandler({ port: 3000 });
