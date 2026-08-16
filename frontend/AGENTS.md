# AGENTS.md — Frontend 🍧

Guía para trabajar en `frontend/` (React 19 + Vite + Tailwind v4 + PWA offline-first).

---

## 📁 Estructura

```
src/
├── components/
│   ├── ui/          # primitivas reutilizables: Button, Input, Modal, Card, Badge, StatCard, EmptyState, Spinner, Stepper, Toast, BarChart, icons
│   └── layout/      # AppLayout (sidebar desktop + bottom nav móvil), SyncChip
├── features/        # UN módulo por carpeta: dashboard, sales, inventory, purchases, suppliers, reports, settings, more
│   └── <modulo>/    # Página(s) + componentes propios del módulo + tests colocalizados (*.test.tsx)
├── hooks/           # useAsync, useBusiness (Context), useSyncStatus
├── services/api/    # cliente API tipado por recurso (única capa que conoce URLs)
├── lib/
│   ├── offline/     # db.ts (Dexie), outbox.ts, syncEngine.ts, network.ts
│   ├── formatting/  # currency.ts (formato monetario con Intl)
│   ├── validation/  # (reservado para esquemas compartidos)
│   └── utils/       # cn.ts (clsx), id.ts (UUIDs)
├── types/           # tipos compartidos del dominio (UI)
├── layouts/         # (AppLayout vive en components/layout)
├── test/            # setup vitest (jsdom + fake-indexeddb + cleanup), utils de render
├── App.tsx          # rutas con lazy loading (code splitting por feature)
├── main.tsx         # bootstrap: providers + service worker (PWA)
└── index.css        # ⚠️ TOKENS DE DISEÑO Nalu (Tailwind v4 @theme) — aquí viven colores/tipografía/sombras
```

## 🎨 Sistema de diseño (leer antes de tocar UI)

- **Todos los colores** están en `src/index.css` como tokens `@theme` (turquesa, fresa, mango, kiwi, uva, crema, cocoa). **Nunca** pongas hex sueltos en componentes; usa clases `bg-turquesa`, `text-cocoa`, etc.
- Estética: tropical, colorida, alegre — tarjetas redondeadas, sombras suaves, estados vacíos amigables. Nada de dashboards grises corporativos.
- **Mobile-first**: 360–430px, touch targets ≥ 44px, bottom nav en móvil / sidebar en desktop. No duplicar lógica por viewport.
- Accesibilidad: HTML semántico, labels accesibles, foco visible, `prefers-reduced-motion` soportado.

## 🧠 Estado y datos

- **Sin Redux.** Estado local + custom hooks. Context solo para: negocio (`useBusiness`), toasts, estado de sync.
- Datos de servidor vía **cliente API tipado** (`services/api/`): `salesApi.create()`, `inventoryApi.list()`, etc. Nunca URLs hardcodeadas en componentes.
- **Offline-first**: toda escritura de negocio pasa por el outbox (`lib/offline/outbox.ts`) → IndexedDB (Dexie) → sync cuando vuelve la conexión (`syncEngine.ts`).
- El estado de sincronización SIEMPRE es visible (`SyncChip`): En línea / Sin conexión / n pendientes / Sincronizando…
- `localStorage` SOLO para preferencias simples. Datos transaccionales → IndexedDB.

## 🗣️ Idioma

- **Todo lo que ve el usuario: español latinoamericano natural.** Botones, validaciones, errores, estados vacíos, PWA, reportes.
- Comentarios en español, solo cuando explican reglas de negocio o lógica no obvia.

## ⚡ Reglas de código

- TypeScript estricto, sin `any`. Tipos explícitos del dominio.
- Componentes pequeños y compuestos. Cálculos de negocio NO dentro del JSX — usa funciones puras/helpers.
- Hooks solo con razón: `useMemo` para derivados costosos, `useEffect` para efectos (sync, suscripciones).
- Lazy loading de rutas en `App.tsx` (reportes con jsPDF/html-to-image se cargan aparte).

## 🧪 Tests

- Unit/componente: Vitest + React Testing Library + jsdom (`pnpm --filter @nalu/frontend test`).
- `src/test/setup.ts` configura cleanup automático, `fake-indexeddb` y `@testing-library/jest-dom`.
- E2E: Playwright en `e2e/` (raíz del repo) — ver [`e2e/AGENTS.md`](../e2e/AGENTS.md) si existe, o `docs/TESTING.md`.
- Convenciones: render con `renderWithProviders` (usa `src/test/utils.tsx`), mockear el cliente API, aserciones de usuario real (`user-event`).

## ✅ Checklist antes de terminar

1. `pnpm --filter @nalu/frontend typecheck` y `pnpm --filter @nalu/frontend lint` en cero.
2. `pnpm --filter @nalu/frontend test` en verde.
3. UI en español, con tokens de diseño, accesible y mobile-first.
4. Datos transaccionales pasan por el outbox (offline-first).
