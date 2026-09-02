# AGENTS.md — Nalu 🍧

Guía para agentes de IA y desarrolladores que trabajan en **Nalu**, un asistente de negocio *offline-first* para la venta de paletas artesanales (reventa a proveedores, sin manufactura).

> **Idioma:** toda la interfaz, documentación y comentarios van en **español** (natural, latinoamericano). No expongas términos técnicos en inglés al usuario final.

---

## 🛡️ Protocolo previo a toda tarea

**Antes de iniciar cualquier tarea, el agente debe ejecutar obligatoriamente:**

1. **Verificar codebase memory up-to-date:** Ejecutar `pnpm --filter @nalu/codebase-memory info` o revisar `.codebase-memory/graph.db.zst`. Confirmar que `schema_version` y `commit` están actualizados. Si el grafo no está actualizado, realizar `pnpm exec codebase-memory update` desde la raíz antes de continuar.

*Este paso es obligatorio para evitar búsquedas grep/glob obsoletas y ahorrar tokens en cada operación.*

---

## 🗺️ Mapa del repositorio

Monorepo con **pnpm workspaces**.

```
nalu/
├── frontend/   # React 19 + Vite 7 + Tailwind v4 + PWA offline-first
├── backend/    # Express 5 + TypeScript + D1 (Cloudflare Workers)
├── docs/       # Documentación completa en español
└── .github/    # CI (PR) y CD (main → deploy condicional)
```

## 🏗️ Stack (no negociable)

| Capa | Tecnología |
|---|---|
| Frontend | React 19 · TypeScript estricto · Vite · Tailwind CSS v4 |
| Backend | Node.js · Express 5 · TypeScript |
| Base de datos | Cloudflare D1 (prod) · `node:sqlite` (local/dev/tests) |
| Validación | Zod v4 (compartido FE/BE) |
| Offline | Service Worker · IndexedDB (Dexie) · outbox + sync |
| Reportes | jsPDF + autotable · html-to-image |
| Tests | Vitest · Supertest · React Testing Library · Playwright (e2e) |
| Despliegue | Cloudflare Workers + D1 (un solo Worker sirve API + frontend) |

**Prohibido introducir sin justificación:** Redux, Next.js, Astro, NestJS, GraphQL, Prisma, Supabase/Firebase, Hono, microservicios.

## ⚡ Comandos (siempre desde la raíz)

```bash
pnpm install          # instala todo (workspaces)
pnpm dev              # API :3002 + web :5173
pnpm dev:worker       # Express dentro de workerd :8787 (D1 local)
pnpm test             # unit + API + componentes (Vitest)
pnpm test:e2e         # e2e (Playwright, requiere servidores arriba)
pnpm lint / pnpm typecheck / pnpm build
pnpm db:migrate / pnpm db:seed / pnpm db:reset
```

Comandos por paquete con `--filter`: `pnpm --filter @nalu/backend test`, `pnpm --filter @nalu/frontend build`, etc. (o `cd backend && pnpm test`).

## 🧠 Reglas de negocio críticas (NO romper)

1. **Una salida de inventario NO es automáticamente una venta.** `GIFT`, `PERSONAL_USE` y `LOSS` reducen inventario pero no generan ingresos. Solo `SALE` genera ingresos.
2. **El inventario es la suma de movimientos firmados** (modelo autoritativo, sin contadores duplicados). Convención: `+` entrada (compra), `−` salida.
3. **Costo histórico congelado**: al vender se guarda `unit_cost_snapshot`; nunca recalcular ganancias con el costo actual del proveedor.
4. **El servidor es la fuente de verdad** para cálculos financieros. La UI solo muestra estimaciones instantáneas.
5. **Operaciones atómicas**: venta/compra = entidad + ítems + movimientos en una sola transacción (`batch` en D1 / `BEGIN` en SQLite).
6. **Inventario insuficiente** → error `INSUFFICIENT_INVENTORY` (409), sin alterar stock.

## 🏛️ Arquitectura del backend (obligatoria)

```
Route → Controller (HTTP) → Service (negocio) → Repository (SQL) → Db (D1 | node:sqlite)
```

- Sin SQL en controllers. Sin HTTP en services. Cálculos puros en `backend/src/domain/calculations/` (testeados de forma independiente).
- `src/db/types.ts` define la interfaz `Db`; hay adaptadores D1 y SQLite local. Migraciones SQL compartidas en `backend/migrations/`.
- Errores con contrato estructurado `{ success: false, error: { code, message } }`, mensajes en español.

## 🎨 Frontend

- Feature-based: `src/features/<módulo>/`. Componentes UI reutilizables en `src/components/ui/`.
- Sin Redux: estado local + hooks + Context solo donde hace falta (negocio, sync, toasts).
- Cliente API tipado en `src/services/api/` — los componentes NUNCA hardcodean URLs.
- **Offline-first**: Dexie (`src/lib/offline/db.ts`), outbox (`outbox.ts`), motor de sync (`syncEngine.ts`) con protección contra duplicados (opId = UUID de la entidad).
- Diseño: tokens de color Nalu centralizados en `src/index.css` (Tailwind v4 `@theme`). Nada de colores sueltos en componentes. UI 100% en español, mobile-first, touch targets ≥ 44px.

## 📝 Commits (Conventional Commits)

Todos los commits deben seguir [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <asunto en inglés, conciso>

<opcional: cuerpo en inglés, 1-2 oraciones, por qué>
```

**Tipos válidos:** `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `style`, `perf`, `ci`, `build`.

**Reglas:**
- Asunto ≤ 70 caracteres, en **inglés**.
- Scope opcional: `feat(frontend):`, `fix(backend):`, etc.
- Cuerpo solo si el *por qué* no es obvio; máximo 2 oraciones.
- Sin `Co-Authored-By`, sin firmas, sin trailers automáticos.
- No usar el término "CTE" en mensajes; usar `Sql` o un sustantivo descriptivo.

## ✅ Antes de terminar una tarea

1. **Verificar codebase memory up-to-date:** Ejecutar `pnpm --filter @nalu/codebase-memory info` o revisar `.codebase-memory/graph.db.zst` para confirmar que el grafo está actualizado (schema_version, commit timestamp).
2. `pnpm lint` y `pnpm typecheck` — cero errores.
3. `pnpm test` — suite completa en verde (no romper tests existentes).
4. Si el cambio es de negocio, verificar reglas críticas (sección arriba).
5. Documentación en español si cambia arquitectura, BD o flujos.

## ☁️ Despliegue (resumen)

1. `pnpm build` (backend `tsc` + frontend `vite build` → `frontend/dist`).
2. `pnpm exec wrangler d1 migrations apply nalu-db --remote` (desde `backend/`).
3. `pnpm exec wrangler deploy` (desde `backend/`).

Detalles completos en [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).
