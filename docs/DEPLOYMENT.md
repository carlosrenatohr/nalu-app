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

## Variables de entorno

No hay secretos de aplicación: la app es de un solo negocio y no expone credenciales. La autenticación está **preparada en la arquitectura** (los servicios y la API ya separan capas), pero no implementada: se añadirá cuando el negocio lo requiera.

| Variable | Dónde | Descripción |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Secretos de GitHub / CLI | Token de despliegue |
| `CLOUDFLARE_ACCOUNT_ID` | Secretos de GitHub / CLI | Cuenta Cloudflare |
| `CORS_ORIGIN` | Local (opcional) | Origen permitido en desarrollo |

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
