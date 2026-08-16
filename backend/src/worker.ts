import { httpServerHandler } from "cloudflare:node";
import { env } from "cloudflare:workers";
import { createApp } from "./app";
import { D1DbAdapter } from "./db/d1-adapter";
import { resolveBusinessId } from "./config/bootstrap";
import { createServices } from "./services";
import { runDailyAlerts, type EmailSender } from "./services/alerts.service";
import { addDays, todayISO } from "./utils/dates";

// ---------------------------------------------------------------------
// Entrada de Cloudflare Workers.
// Express corre sobre el runtime de Workers gracias al flag
// nodejs_compat y al adaptador httpServerHandler de cloudflare:node.
// La base de datos es D1 (binding DB definido en wrangler.jsonc).
//
// Importante: el runtime de Workers NO permite I/O asíncrono (como
// consultas a D1) en el scope global del módulo. Por eso el id del
// negocio se resuelve de forma perezosa dentro del primer request y
// se cachea. Crear los objetos de servicios NO hace I/O: es seguro.
// ---------------------------------------------------------------------
const db = new D1DbAdapter(env.DB);

let cachedBusinessId: string | null = null;
async function getBusinessId(): Promise<string> {
  if (cachedBusinessId === null) {
    cachedBusinessId = await resolveBusinessId(db);
  }
  return cachedBusinessId;
}

const services = createServices({ db, getBusinessId });

const app = createApp({ db, getBusinessId });

app.listen(3000);

// ---------------------------------------------------------------------
// Cron diario (07:00 hora local ≈ 13:00 UTC en Nicaragua):
// alerta de stock bajo + resumen del día anterior por email.
// Si no hay alert_email configurado o no existe el binding/remitente,
// se omite silenciosamente (la app funciona igual sin emails).
// ---------------------------------------------------------------------
async function runScheduledAlerts(workerEnv: typeof env): Promise<void> {
  const fromEmail = workerEnv.ALERT_FROM_EMAIL;
  if (!fromEmail || !workerEnv.SEND_EMAIL) return;

  const business = await services.business.get();
  if (!business?.alertEmail) return;

  const yesterday = addDays(todayISO(), -1);
  const [inventory, summary] = await Promise.all([
    services.inventory.getInventory(),
    services.reports.salesReport({ from: yesterday, to: yesterday }),
  ]);

  await runDailyAlerts({
    business,
    inventory,
    summary,
    from: { email: fromEmail, name: "Nalu" },
    sender: workerEnv.SEND_EMAIL as unknown as EmailSender,
  });
}

// httpServerHandler devuelve un ExportedHandler ({ fetch, … }); lo
// fusionamos con el handler `scheduled` del cron de alertas.
export default {
  ...httpServerHandler({ port: 3000 }),
  scheduled: async (event: unknown, workerEnv: typeof env, ctx: ExecutionContext): Promise<void> => {
    ctx.waitUntil(
      runScheduledAlerts(workerEnv).catch((err) => {
        console.error("Error en la alerta diaria:", err);
      }),
    );
  },
};
