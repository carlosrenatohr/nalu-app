# 🍧 Nalu — Asistente de negocio para paletas artesanales

**Un pequeño asistente de negocio, colorido y alegre, para un negocio real de venta de paletas.** 🥥🍓🥭🥝🍇

Nalu es una aplicación full-stack **offline-first** para un negocio de reventa de paletas artesanales: compras a proveedores, ventas en casa o en el puesto, inventario por movimientos, ganancias con **costo histórico** y reportes exportables (PDF e imagen para WhatsApp). 📱☁️

> 🎓 **Aprendizaje deliberado:** este proyecto está construido para enseñar React, Node.js/Express, TypeScript, REST APIs, SQL/SQLite (D1), PWA/offline, testing y despliegue en Cloudflare — con buenas prácticas y sin dependencias innecesarias.

---

## ✨ ¿Qué hace?

| 🚀 Funcionalidad | 📝 Detalle |
|---|---|
| 🛒 **Compras** | Registro de compras a proveedores con sabores, cantidades y costos. El inventario sube automáticamente. |
| 💵 **Ventas** | Flujo móvil optimizado: **Venta rápida** en segundos, con ganancia estimada al instante. |
| 📦 **Inventario** | Basado en **movimientos firmados** (modelo autoritativo). Disponible, último costo, valor estimado y historial por sabor. |
| 🎁 **Regalar / Consumo propio / Pérdida** | Salidas que **no** generan ingresos — siempre visibles en el historial. |
| 📊 **Reportes** | Hoy, semana, mes, rango personalizado: ventas, ganancia, margen, sabores top, análisis por ubicación y por precio. |
| 🖼️ **Exportación** | Reporte en **PDF** e **imagen** con branding Nalu, listo para WhatsApp. |
| 📴 **Offline-first** | Vende, compra y registra salidas **sin conexión**. Todo se sincroniza cuando vuelve la red. |
| 📱 **PWA** | Instalable en la pantalla de inicio del móvil, con shell offline. |
| ⚙️ **Ajustes** | Nombre del negocio, moneda, precios por defecto, ubicaciones, sabores y colores. |

---

## 🚀 Inicio rápido (desarrollo local)

```bash
pnpm install           # instala frontend y backend (workspaces)
pnpm dev               # API en :3002 + web en :5173 (Vite con proxy)
```

Abre **http://localhost:5173** 🎉. La base local (SQLite) se crea y siembra automáticamente con datos de ejemplo.

Otros comandos útiles:

```bash
pnpm db:migrate        # aplica migraciones a la base local
pnpm db:seed           # carga los datos semilla (demo)
pnpm test              # tests de backend y frontend
pnpm test:e2e          # tests end-to-end (Playwright)
pnpm lint              # ESLint en ambos paquetes
pnpm typecheck         # TypeScript estricto
pnpm build             # build de producción (backend + frontend)
pnpm preview           # sirve el frontend construido
```

---

## 🏗️ Stack

| Capa | Tecnología | Por qué 🤔 |
|---|---|---|
| 🎨 Frontend | React 19 · TypeScript · Vite · Tailwind CSS v4 | Moderno, rápido, tipado |
| ⚙️ Backend | Node.js · Express 5 · TypeScript | Aprender Express a fondo |
| 🗄️ Base de datos | Cloudflare D1 (SQLite) + `node:sqlite` local | SQL real, sin servidor |
| ✅ Validación | Zod v4 | Contrato compartido FE/BE |
| 📴 Offline | Web App Manifest · Service Worker · IndexedDB (Dexie) | Vender sin conexión |
| 📈 Reportes | jsPDF + autotable · html-to-image | PDF e imagen con branding |
| 🧪 Tests | Vitest · Supertest · React Testing Library · Playwright | Calidad verificada |
| ☁️ Despliegue | Cloudflare Workers + D1 (un solo Worker sirve API y estáticos) | Edge global, gratis |
| 🔄 CI/CD | GitHub Actions | Calidad + deploy condicional |

---

## 🗂️ Estructura

```
nalu/
├── frontend/          # 🎨 React + Vite + Tailwind + PWA offline-first
│   └── src/
│       ├── components/   # ui/ (Button, Modal, …) y layout/
│       ├── features/     # dashboard, sales, inventory, purchases, …
│       ├── services/api/ # cliente API tipado por recurso
│       ├── lib/offline/  # Dexie, outbox, motor de sincronización
│       └── hooks/        # useAsync, useBusiness, useSyncStatus
├── backend/           # ⚙️ Express + TypeScript + repositorios + D1
│   └── src/
│       ├── routes/ controllers/ services/ repositories/ schemas/
│       ├── domain/       # cálculos puros (ganancia, inventario)
│       ├── db/           # adaptadores D1 / node:sqlite, migraciones
│       ├── migrations/   # SQL aplicable a D1 y local
│       ├── server.ts     # entrada local (Node)
│       └── worker.ts     # entrada Cloudflare Workers
├── e2e/                # 🧪 tests end-to-end (Playwright)
├── docs/              # 📚 documentación completa (español)
└── .github/workflows/ # 🔄 CI y CD
```

> 🤖 **AGENTS.md** — guías para agentes de IA y devs: [`AGENTS.md`](AGENTS.md) (raíz), [`frontend/AGENTS.md`](frontend/AGENTS.md) y [`backend/AGENTS.md`](backend/AGENTS.md).

---

## 📚 Documentación

Toda la documentación está en español 🇪🇸:

- [🏛️ Arquitectura](docs/ARCHITECTURE.md)
- [🗄️ Base de datos](docs/DATABASE.md)
- [🧠 Reglas de negocio](docs/BUSINESS-RULES.md)
- [📴 Offline y sincronización](docs/OFFLINE.md)
- [📈 Reportes y exportación](docs/REPORTS.md)
- [🛠️ Desarrollo local](docs/DEVELOPMENT.md)
- [☁️ Despliegue en Cloudflare](docs/DEPLOYMENT.md)
- [🧪 Testing](docs/TESTING.md)

---

## 🌟 Principales reglas de negocio

- **Una salida de inventario no es automáticamente una venta.** 🎁 Regalar, 🍽️ consumo propio y 😢 pérdida reducen inventario pero no generan ingresos.
- **El inventario es la suma de movimientos firmados** (modelo autoritativo): `+30 compra −10 venta −2 regalo = 18`. 🧮
- **El costo histórico se congela al vender** ⏳: si el proveedor sube el precio, las ventas anteriores conservan su ganancia original.
- **El servidor es la fuente de verdad** ✅ para los cálculos financieros; la UI muestra estimaciones instantáneas.

---

## ☁️ Despliegue en Cloudflare

El despliegue en producción se documenta en [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). En resumen:

1. 🏗️ `pnpm build` — construye el frontend y compila el backend.
2. 🗄️ `cd backend && pnpm exec wrangler d1 create nalu-db` — crea la base D1 (solo la primera vez) y copia el `database_id` a `backend/wrangler.jsonc`.
3. 📦 `pnpm exec wrangler d1 migrations apply nalu-db --remote` — aplica migraciones + seed.
4. 🚀 `pnpm exec wrangler deploy` — publica el Worker.

**Un solo Worker** sirve la API (Express), el frontend, el manifest y el service worker. 🎯

---

## 🧪 Calidad

- ✅ **80 tests unitarios + 6 e2e**: dominio (16), casos límite (8), alertas por email (3), API con auth (26), frontend (27: componentes, login, formato, outbox, caché) + smoke e2e con login (Playwright).
- 🔐 **Autenticación por PIN** con sesión de 90 días (sin cierres constantes en el móvil).
- 📬 **Alertas por email**: aviso de stock bajo + resumen diario (Cloudflare Email Sending).
- ✅ TypeScript **estricto** en ambos paquetes.
- ✅ ESLint en cero errores.
- ✅ Build de producción verificado.
- ✅ Express corriendo en el runtime real de Workers con D1 (verificado localmente con `wrangler dev`).

---

*Hecho con 🍧 para el negocio real de paletas. ¡Que viva el verano! ☀️🌴*
