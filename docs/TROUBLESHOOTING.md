# Troubleshooting — Nalu

Problemas comunes y soluciones.

---

## Desarrollo local

### `pnpm dev` no arranca o da error de puertos

**Síntoma:** `Error: listen EADDRINUSE: address already in use :::3002`

**Solución:**
```bash
# Matar proceso en el puerto
lsof -ti:3002 | xargs kill -9
lsof -ti:5173 | xargs kill -9

# O usar otro puerto
PORT=3003 pnpm dev
```

### Base de datos local corrupta o desactualizada

**Síntoma:** Errores raros al crear ventas, datos faltantes, tablas no existen.

**Solución:**
```bash
pnpm db:reset    # Borra y recrea la BD local + seed
pnpm db:migrate  # O solo aplicar migraciones pendientes
```

### `wrangler dev` no conecta con D1 local

**Síntoma:** Error de bindings o "D1 not found".

**Solución:** Asegurarse de que `wrangler.jsonc` tenga el `database_id` correcto. Regenerar tipos:
```bash
pnpm --filter @nalu/backend cf-typegen
```

---

## Build y TypeScript

### `tsc` falla con tipos de Cloudflare

**Síntoma:** `Cannot find module '@cloudflare/workers-types'` o errores de `D1Database`.

**Solución:**
```bash
pnpm --filter @nalu/backend cf-typegen
# Verificar que worker-configuration.d.ts se generó en backend/src/
```

### `verbatimModuleSyntax` error con imports

**Síntoma:** `Module '"X"' can only be default-imported using the 'esModuleInterop' flag`

**Solución:** Usar `import type` para tipos:
```typescript
// ❌
import { Flavor } from '../domain/types'

// ✅
import type { Flavor } from '../domain/types'
```

### Frontend build falla por `tsc --noEmit`

**Síntoma:** Errores de tipos en el frontend antes de que Vite corra.

**Solución:** Correr typecheck por separado para ver el error exacto:
```bash
pnpm --filter @nalu/frontend typecheck
```

---

## Tests

### Tests de API fallan con "database is locked"

**Síntoma:** Error de SQLite concurrente en tests.

**Solución:** Los tests usan SQLite en memoria. Verificar que no haya otro proceso usando la BD. Los tests crean una BD fresca por caso, así que este error es raro — generalmente indica un problema de configuración de Vitest.

### Tests de frontend fallan con "fake-indexeddb"

**Síntoma:** `IndexedDB` no está definido.

**Solución:** Verificar que `src/test/setup.ts` importe `fake-indexeddb/auto` y que Vitest use el setup:
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    setup: ['./src/test/setup.ts'],
  },
})
```

### Playwright no encuentra Chromium

**Síntoma:** `Executable doesn't exist at ...`

**Solución:**
```bash
pnpm exec playwright install chromium --with-d
```

### Playwright falla con "port already in use"

**Síntoma:** Error al arrancar servidores e2e.

**Solución:** Asegurarse de que `pnpm dev` NO esté corriendo. Playwright arranca sus propios servidores en los puertos 3002 y 5173.

---

## Deploy a Cloudflare

### Workflow de GitHub Actions no se dispara

**Síntoma:** Push a `main` pero no aparece run en Actions.

**Solución:**
1. Verificar que el push sea a `main` (no a otro branch)
2. Verificar que `.github/workflows/deploy.yml` exista y tenga `on: push: branches: [main]`
3. Verificar que GitHub Actions esté habilitado en el repo (Settings → Actions → General)

### "CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID no configurados"

**Síntoma:** El deploy se salta con un warning.

**Solución:** Verificar que los secrets existan en el repo:
1. GitHub → Settings → Secrets and variables → Actions
2. Deben existir: `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`
3. **Nota:** Los secrets no se pueden ver una vez creados; solo se pueden sobrescribir

### `wrangler d1 migrations apply` falla

**Síntoma:** Error de migración o "database not found".

**Soluciones:**
- Verificar que `database_id` en `wrangler.jsonc` coincida con la D1 real
- Listar bases de datos: `pnpm exec wrangler d1 list`
- Verificar que el token tenga permisos D1 (edit en el dashboard de Cloudflare)

### `wrangler deploy` falla

**Síntoma:** Error al subir el Worker.

**Soluciones:**
- Verificar que `CLOUDFLARE_ACCOUNT_ID` sea correcto: `pnpm exec wrangler whoami`
- Verificar que el nombre del Worker (`nalu-api` en `wrangler.jsonc`) no esté en uso por otro proyecto
- Revisar logs: `pnpm exec wrangler tail`

### Deploy funciona pero la app no carga

**Síntoma:** Worker despliega pero la URL da error 404 o 500.

**Soluciones:**
- Verificar que `frontend/dist` exista (se construye durante el deploy)
- Verificar que `assets.directory` en `wrangler.jsonc` apunte a `../frontend/dist`
- Revisar logs del Worker: `pnpm exec wrangler tail --format json`

---

## Base de datos D1

### Migraciones no se aplican en producción

**Síntoma:** Tablas faltantes o columnas nuevas no existen en D1.

**Solución:**
```bash
# Desde backend/
pnpm exec wrangler d1 migrations apply nalu-db --remote
# Verificar migraciones aplicadas
pnpm exec wrangler d1 migrations list nalu-db --remote
```

### Backup de D1

```bash
# Desde la raíz
pnpm db:backup
# Crea backup en backups/nalu-db-YYYYMMDD-HHMM.sql
```

---

## Errores comunes de la API

### `BUSINESS_NOT_CONFIGURED` (500)

El negocio no está configurado en la BD. Ejecutar seed:
```bash
pnpm db:seed
```

### `INSUFFICIENT_INVENTORY` (409)

No hay suficientes paletas disponibles para la operación. Verificar inventario actual:
```bash
curl -H "Authorization: Bearer <token>" http://localhost:3002/api/inventory
```

### `UNAUTHORIZED` (401)

Token ausente, inválido o expirado. El token dura 90 días. Re-login:
```bash
curl -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"pin": "1234"}'
```

### `DUPLICATE` (409)

Nombre de sabor, proveedor o ubicación duplicado. Usar un nombre diferente.

---

## Rendimiento

### App lenta en móvil

- Verificar que la PWA esté instalada (no abierta en el navegador)
- Limpiar caché del Service Worker: Chrome → DevTools → Application → Storage → Clear site data
- Verificar que IndexedDB no tenga demasiadas operaciones pendientes

### Sync lento o se queda colgado

- El `SyncChip` muestra el estado actual
- Forzar sync: página "Más" → "Sincronizar ahora"
- Si hay muchas operaciones pendientes, el servidor puede tardar — revisar logs de Cloudflare
