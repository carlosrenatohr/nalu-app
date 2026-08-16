# Despliegue en Cloudflare

Nalu se despliega como **un solo Worker** que sirve:

1. La **API REST** (Express corriendo en el runtime de Workers con `nodejs_compat` y `httpServerHandler` de `cloudflare:node`).
2. El **frontend construido** (assets estáticos de `frontend/dist`).
3. El **manifest PWA** y el **service worker**.

La base de datos es **Cloudflare D1**.

## Recursos requeridos en Cloudflare

| Recurso | Descripción |
|---|---|
| Cuenta Cloudflare | Gratuita |
| Worker `nalu-api` | Ejecuta la API + estáticos |
| Base D1 `nalu-db` | Base de datos (SQLite administrado) |

## Pasos

### 1. Crear la base D1

```bash
cd backend
pnpm exec wrangler login
pnpm exec wrangler d1 create nalu-db
```

Copia el `database_id` de la salida y pégalo en `backend/wrangler.jsonc`:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "nalu-db",
    "database_id": "EL-ID-REAL"
  }
]
```

Regenera los tipos:

```bash
pnpm --filter @nalu/backend cf-typegen
```

### 2. Aplicar migraciones y seed en producción

```bash
pnpm exec wrangler d1 migrations apply nalu-db --remote
```

> Esto aplica `0001_init.sql`, `0002_indexes.sql` y también `seed.sql` (idempotente con `INSERT OR IGNORE`), creando el negocio Nalu, sabores, proveedores, ubicaciones y datos de ejemplo.

### 3. Construir el frontend

```bash
pnpm --filter @nalu/frontend build
```

### 4. Desplegar

```bash
cd backend
pnpm exec wrangler deploy
```

### 5. Verificar

```bash
# Salud de la API
curl https://<tu-worker>.workers.dev/api/health

# La app (frontend + PWA)
curl https://<tu-worker>.workers.dev/
curl -I https://<tu-worker>.workers.dev/manifest.webmanifest
curl -I https://<tu-worker>.workers.dev/sw.js
```

Instala la app desde el navegador móvil ("Agregar a pantalla de inicio").

## Respaldos de la base

Cloudflare D1 guarda **snapshots automáticos** (~30 días, restaurar desde el dashboard). Para portabilidad extra, descarga un export SQL completo a tu máquina:

```bash
pnpm db:backup   # descarga producción a backups/nalu-db-<fecha>.sql
```

> También puedes exportar a mano con `wrangler d1 export nalu-db --remote --output backup.sql` (schema + datos).

## Autenticación (PIN + sesión larga)

- El acceso usa un **PIN de 4-6 dígitos**. Por defecto es **`1234`** (hash SHA-256 con salt en `businesses.pin_hash/pin_salt`) — **cámbialo desde Ajustes → Seguridad**.
- Las sesiones duran **90 días** (`sessions.expires_at`) para que la app móvil no pida el PIN constantemente. Solo se guarda el hash del token.
- Rutas públicas: `GET /api/health`, `POST /api/auth/login`. Todo lo demás exige `Authorization: Bearer <token>` (401 si falta o expiró).
- La app guarda el token en **IndexedDB** (Dexie), no en localStorage.

## Alertas por email (stock bajo + resumen diario)

Nalu puede enviar **avisos de stock bajo** y el **resumen del día anterior** por email usando Cloudflare Email Sending (binding `SEND_EMAIL`, sin API keys).

### Configurar (una vez)

1. **Verificar el dominio** en Email Sending (dashboard o `wrangler email sending enable tudominio.com`).
2. En `backend/wrangler.jsonc` ajusta `vars.ALERT_FROM_EMAIL` a una dirección de ese dominio (p. ej. `alertas@nalu.example`).
3. En la app, Ajustes → Email para alertas 📬, guarda el correo del negocio.
4. **Activar el cron diario** (07:00 hora de Nicaragua): descomenta `"triggers"` en `wrangler.jsonc` y despliega.

> ⚠️ **Límite Free**: la cuenta Workers Free permite **5 cron triggers por cuenta** y esta cuenta ya los tiene ocupados por otros proyectos. El handler `scheduled` de `src/worker.ts` está listo; mientras el plan no lo permita, el job simplemente no se dispara (la app funciona igual).

## Variables de entorno

| Variable | Dónde | Descripción |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Secretos de GitHub / CLI | Token de despliegue |
| `CLOUDFLARE_ACCOUNT_ID` | Secretos de GitHub / CLI | Cuenta Cloudflare |
| `CORS_ORIGIN` | Local (opcional) | Origen permitido en desarrollo |
| `ALERT_FROM_EMAIL` | `wrangler.jsonc` → `vars` | Remitente de las alertas (dominio verificado) |

### Permisos del token de Cloudflare

Crea el token en el dashboard (**Mi perfil → Tokens de API → Crear token**) con la plantilla **"Edit Cloudflare Workers"** y **agrega manualmente D1 Edit** (la plantilla no lo incluye y es necesario para `wrangler d1 migrations apply`):

| Permiso | Recurso | Incluido en la plantilla | Necesario para |
|---|---|---|---|
| Workers Scripts → Edit | Cuenta | ✅ | `wrangler deploy` (subir el Worker) |
| Workers KV Storage → Edit | Cuenta | ✅ | Assets estáticos del Worker (frontend) |
| Workers Routes → Edit | Zona | ✅ | Rutas en dominio propio (no usamos) |
| Workers Tail → Read | Cuenta | ✅ | Logs de tail |
| R2 Storage → Edit | Cuenta | ✅ | (no usado, viene por defecto) |
| Account Settings → Read | Cuenta | ✅ | Resolver el account ID |
| **D1 → Edit** | **Cuenta** | ❌ **agregar manual** | `wrangler d1 migrations apply nalu-db --remote` |
| User Details → Read | Usuario | ✅ | Autenticación del token |
| User Memberships → Read | Usuario | ✅ | Resolver membresías |

Alcance: **restringe el token a la cuenta de Nalu** (y a la zona si algún día usas dominio propio) — no uses "Todas las cuentas".

## CI/CD (GitHub Actions)

- **Pull requests** → `ci.yml`: install, lint, typecheck, tests, build.
- **main** → `deploy.yml`: misma calidad + migraciones remotas + `wrangler deploy`.

El deploy **solo se ejecuta si** `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` están configurados como secretos del repositorio (condicional `if` en el job).

## Arquitectura del despliegue

```
Browser (móvil/desktop)
   │  https://nalu.<dominio>.workers.dev
   ▼
Cloudflare Workers — Worker nalu-api
   ├── /api/*        → Express (nodejs_compat + httpServerHandler)
   │                    └── D1 (binding DB)
   ├── /             → assets estáticos (frontend/dist, PWA)
   ├── /sw.js        → service worker
   └── /manifest.webmanifest
```

**Ventajas:** un solo despliegue, sin CORS en producción (same-origin), latencia global (edge).

## Solución de problemas

| Síntoma | Causa probable |
|---|---|
| `Disallowed operation called within global scope` al arrancar | I/O asíncrono en el scope global; la resolución del negocio es perezosa (`getBusinessId`) — si reaparece, revisa que no haya `await` de D1 fuera de un handler. |
| `database_id` inválido | Falta reemplazar el placeholder en `wrangler.jsonc`. |
| El frontend no se sirve | Ejecutar `pnpm --filter @nalu/frontend build` antes de `wrangler deploy` (los assets se leen de `frontend/dist`). |
| Migraciones sin efecto | `wrangler d1 migrations apply nalu-db --remote` (no `--local`). |
| `worker.fetch is not a function` | `httpServerHandler` devuelve un `ExportedHandler`; fusiónalo con spread: `export default { ...httpServerHandler({ port: 3000 }), scheduled }`. |
| Cron no registrado (límite 5 triggers) | Cuenta Free sin triggers libres; activa el cron cuando el plan lo permita (ver sección de alertas). |
