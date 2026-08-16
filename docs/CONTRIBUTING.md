# Guía de Contribución — Nalu

## Requisitos previos

| Requisito | Versión |
|-----------|---------|
| Node.js | >= 24.0.0 |
| pnpm | >= 10.0.0 |
| Chromium | Solo para e2e: `pnpm exec playwright install chromium --with-deps` |

## Primeros pasos

```bash
git clone https://github.com/carlosrenatohr/nalu-app.git
cd nalu-app
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev        # API en :3002, web en :5173
```

## Scripts principales

| Comando | Qué hace |
|---------|----------|
| `pnpm dev` | Arranca API (:3002) + frontend (:5173) en paralelo |
| `pnpm dev:worker` | Express dentro de workerd (:8787) con D1 local |
| `pnpm build` | Build de producción (backend tsc + frontend vite) |
| `pnpm test` | Tests unit, API y componentes (Vitest) |
| `pnpm test:e2e` | Tests end-to-end (Playwright) |
| `pnpm lint` | ESLint en ambos paquetes |
| `pnpm typecheck` | Verificación de tipos en ambos paquetes |
| `pnpm db:migrate` | Aplica migraciones SQL localmente |
| `pnpm db:seed` | Carga datos de prueba |

Paquetes individuales: `pnpm --filter @nalu/backend <cmd>` o `pnpm --filter @nalu/frontend <cmd>`.

## Estructura del proyecto

```
nalu/
├── frontend/    React 19 + Vite + Tailwind v4 + PWA offline-first
├── backend/     Express 5 + TypeScript + D1 (Cloudflare Workers)
├── docs/        Documentación en español
└── e2e/         Tests Playwright
```

## Convenciones de código

### Idioma

Toda la interfaz, documentación y comentarios van en **español latinoamericano natural**. No exponer términos técnicos en inglés al usuario final.

### Commits

No hay formato forzado, pero se recomienda estilo descriptivo en español:

```
agregar filtro de fechas en reporte de ventas
fix: inventario insuficiente no descontaba stock
```

### Branching

- `main` es la rama de producción
- Los PRs se abren contra `main`
- No hay naming de branches formal (sugerido: `feature/*`, `fix/*`)

### TypeScript

- **Estricto**: `strict: true`, `noUncheckedIndexedAccess: true`
- Sin `any` explícito (ESLint lo marca como warning)
- Preferir `type-imports` (`import type { X } from '...'`)

### Backend — Arquitectura por capas

```
Route → Controller → Service → Repository → Db
```

- **Controller**: solo HTTP (status codes, req/res, delegación). Sin SQL.
- **Service**: lógica de negocio, transacciones atómicas. Sin HTTP.
- **Repository**: SQL parametrizado, alias `AS camelCase`.
- **Domain/calculations**: funciones puras de negocio (testeadas de forma independiente).

Naming: `<entidad>.controller.ts`, `<entidad>.service.ts`, `<entidad>.repository.ts`.

### Frontend — Feature-based

- Un módulo por carpeta en `src/features/<módulo>/`
- Componentes UI reutilizables en `src/components/ui/`
- Cliente API tipado en `src/services/api/` — nunca hardcodear URLs en componentes
- Tests colocalizados: `*.test.tsx` junto al componente
- Tokens de color en `src/index.css` (Tailwind v4 `@theme`). Nada de hex sueltos.
- Lazy loading de rutas en `App.tsx`

### Librerías prohibidas (sin justificación)

Redux, Next.js, Astro, NestJS, GraphQL, Prisma, Supabase/Firebase, Hono, microservicios.

## Tests

### Unit / API / Componentes

```bash
pnpm test                          # todos
pnpm --filter @nalu/backend test   # solo backend
pnpm --filter @nalu/frontend test  # solo frontend
```

- **Backend unit**: `tests/domain/calculations.test.ts` — funciones puras
- **Backend API**: `tests/api/api.test.ts` — Supertest con SQLite fresca por caso
- **Frontend**: Vitest + React Testing Library + jsdom. Usar `renderWithProviders` y `user-event`.

### E2E

```bash
pnpm exec playwright install chromium --with-d    # una vez
pnpm test:e2e                                      # requiere servidores OFF
```

Playwright arranca los servidores automáticamente (API :3002 + Vite :5173). No tener `pnpm dev` corriendo.

## Checklist antes de crear un PR

1. `pnpm lint` y `pnpm typecheck` — cero errores
2. `pnpm test` — suite completa en verde
3. Si el cambio es de negocio, verificar reglas críticas:
   - Solo `SALE` genera ingresos
   - Costo histórico congelado (`unitCostSnapshot`)
   - Transacciones atóomicas (venta = entidad + ítems + movimientos)
   - Inventario insuficiente → error 409 sin mutar stock
4. Documentación en español si cambia arquitectura, BD o flujos

## Despliegue

El deploy a Cloudflare Workers es automático al hacer push a `main`:

1. CI ejecuta lint + typecheck + tests + build
2. Si pasa, se aplican migraciones D1 y se despliega el Worker

Ver `docs/DEPLOYMENT.md` para detalles del deploy manual.

## Reglas de negocio críticas

Estas reglas **no se pueden romper**:

1. **Una salida de inventario NO es automáticamente una venta.** `GIFT`, `PERSONAL_USE` y `LOSS` reducen inventario pero no generan ingresos.
2. **El inventario es la suma de movimientos firmados** (sin contadores duplicados).
3. **Costo histórico congelado**: al vender se guarda `unitCostSnapshot`; nunca recalcular con el costo actual.
4. **El servidor es la fuente de verdad** para cálculos financieros.
5. **Operaciones atóomicas**: venta/compra = entidad + ítems + movimientos en una sola transacción.
