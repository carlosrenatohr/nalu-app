# Referencia de la API REST — Nalu

Base URL: `/api`

## Convención de respuestas

```jsonc
// Éxito
{ "success": true, "data": <payload> }

// Error
{ "success": false, "error": { "code": "CODIGO", "message": "Mensaje en español" } }
```

Las rutas marcadas con **\[AUTH\]** requieren el header `Authorization: Bearer <token>`.

---

## Health

### `GET /api/health`

Verifica que la base de datos esté respondiendo. Ruta pública.

**Respuesta (200):**

```json
{ "success": true, "data": { "status": "ok", "db": "ok" } }
```

---

## Autenticación

### `POST /api/auth/login`

Inicia sesión con PIN y devuelve un token de larga duración (90 días). Ruta pública.

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `pin` | string | Sí | PIN de 4 a 6 dígitos (`^\d{4,6}$`) |

**Respuesta (200):**

```json
{
  "success": true,
  "data": {
    "token": "<string>",
    "expiresAt": "<ISO date>",
    "business": { "id": "<uuid>", "name": "<string>", "currency": "<string>", ... }
  }
}
```

**Errores:** `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401 — PIN incorrecto o no configurado).

### `POST /api/auth/logout`

Invalida la sesión actual. **\[AUTH\]**

**Respuesta (200):** `{ "success": true, "data": { "loggedOut": true } }`

### `GET /api/auth/me`

Devuelve los datos del negocio si el token es válido. **\[AUTH\]**

**Respuesta (200):** `{ "success": true, "data": { /* Business */ } }`

### `POST /api/auth/change-pin`

Cambia el PIN del negocio. Requiere el PIN actual. **\[AUTH\]**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `currentPin` | string | Sí | PIN actual |
| `newPin` | string | Sí | Nuevo PIN (4-6 dígitos) |

---

## Sabores

### `GET /api/flavors`

Lista todos los sabores activos. **\[AUTH\]**

**Respuesta (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "<uuid>", "name": "<string>", "slug": "<string>",
      "emoji": "<string|null>", "color": "<#RRGGBB|null>",
      "minStock": 10, "active": true, ...
    }
  ]
}
```

### `POST /api/flavors`

Crea un nuevo sabor. El slug se genera automáticamente. **\[AUTH\]**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `name` | string | Sí | Nombre (1-60 chars) |
| `emoji` | string | No | Emoji (max 8 chars) |
| `color` | string | No | Color hex `#RRGGBB` |
| `minStock` | number | No | Stock mínimo (default: 10) |

**Errores:** `VALIDATION_ERROR` (400), `DUPLICATE` (409).

### `PATCH /api/flavors/:id`

Actualiza parcialmente un sabor. **\[AUTH\]**

Campos opcionales: `name`, `emoji`, `color`, `minStock`. Si cambia `name`, el slug se regenera.

---

## Proveedores

### `GET /api/suppliers`

Lista todos los proveedores activos. **\[AUTH\]**

### `POST /api/suppliers`

Crea un proveedor nuevo. **\[AUTH\]**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `name` | string | Sí | Nombre (1-80 chars) |
| `contact` | string | No | Contacto (max 120 chars) |
| `notes` | string | No | Notas (max 300 chars) |

### `PATCH /api/suppliers/:id`

Actualiza parcialmente un proveedor. **\[AUTH\]**

Campos opcionales: `name`, `contact`, `notes`, `active`.

---

## Ventas

### `GET /api/sales`

Lista ventas, con filtro opcional por rango de fechas. **\[AUTH\]**

| Query | Tipo | Descripción |
|-------|------|-------------|
| `from` | AAAA-MM-DD | Fecha inicio |
| `to` | AAAA-MM-DD | Fecha fin |

**Respuesta (200):** Array de ventas con `items` incluidos y `total` calculado por el servidor.

### `POST /api/sales`

Crea una venta atómicamente: venta + items + movimientos de salida (`SALE`). Congela `unitCostSnapshot`. **\[AUTH\]**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `saleDate` | AAAA-MM-DD | No | Fecha (default: hoy) |
| `location` | string | Sí | Nombre de ubicación (1-60 chars) |
| `notes` | string | No | Notas (max 500 chars) |
| `items` | array | Sí | Mínimo 1 item |
| `items[].flavorId` | uuid | Sí | ID del sabor |
| `items[].quantity` | number | Sí | Cantidad (entero > 0) |
| `items[].unitPrice` | number | Sí | Precio unitario (>= 0) |

**Respuesta (201):** Venta con `profit` (estimado, no persistido).

**Errores:** `VALIDATION_ERROR` (400), `NOT_FOUND` (404 — sabor inexistente), `INSUFFICIENT_INVENTORY` (409).

### `GET /api/sales/:id`

Obtiene una venta por ID con items y ganancia estimada. **\[AUTH\]**

---

## Compras

### `GET /api/purchases`

Lista compras con filtro opcional por fechas. **\[AUTH\]**

### `POST /api/purchases`

Crea una compra atómicamente: compra + items + movimientos de entrada (`PURCHASE`). **\[AUTH\]**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `purchaseDate` | AAAA-MM-DD | No | Fecha (default: hoy) |
| `supplierId` | uuid | Sí | ID del proveedor |
| `notes` | string | No | Notas (max 500 chars) |
| `items` | array | Sí | Mínimo 1 item |
| `items[].flavorId` | uuid | Sí | ID del sabor |
| `items[].quantity` | number | Sí | Cantidad (entero > 0) |
| `items[].unitCost` | number | Sí | Costo unitario (>= 0) |

**Errores:** `VALIDATION_ERROR` (400), `NOT_FOUND` (404).

### `GET /api/purchases/:id`

Obtiene una compra por ID con items. **\[AUTH\]**

---

## Inventario

### `GET /api/inventario`

Devuelve el inventario completo calculado a partir de movimientos. **\[AUTH\]**

**Respuesta (200):**

```json
{
  "success": true,
  "data": [
    {
      "flavor": { /* Flavor */ },
      "available": 45,
      "lastCost": 18.50,
      "purchased": 50, "sold": 3, "gifted": 1,
      "personalUse": 0, "lost": 1, "adjusted": 0, "returned": 0,
      "value": 832.50,
      "lowStock": false
    }
  ]
}
```

### `GET /api/inventory/:flavorId`

Resumen de inventario + historial de movimientos de un sabor. **\[AUTH\]**

### `POST /api/inventory/movements`

Registra un movimiento manual (GIFT, PERSONAL_USE, LOSS, ADJUSTMENT, RETURN). **\[AUTH\]**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `flavorId` | uuid | Sí | ID del sabor |
| `movementType` | enum | Sí | `GIFT`, `PERSONAL_USE`, `LOSS`, `ADJUSTMENT`, `RETURN` |
| `quantity` | number | Sí | Cantidad (siempre positiva) |
| `date` | AAAA-MM-DD | No | Fecha (default: hoy) |
| `notes` | string | No | Notas (max 300 chars) |

**Nota:** Solo `SALE` y `PURCHASE` generan movimientos automáticos. Este endpoint es para movimientos manuales.

---

## Reportes

### `GET /api/reports/sales`

Reporte de ventas en rango de fechas. **\[AUTH\]**

| Query | Tipo | Descripción |
|-------|------|-------------|
| `from` | AAAA-MM-DD | Fecha inicio (default: hace 30 días) |
| `to` | AAAA-MM-DD | Fecha fin (default: hoy) |

**Respuesta (200):**

```json
{
  "success": true,
  "data": {
    "range": { "from": "...", "to": "..." },
    "totalSales": 5000.00,
    "unitsSold": 120,
    "totalCost": 2400.00,
    "profit": 2600.00,
    "margin": 52.0,
    "byFlavor": [{ "flavorId": "<uuid>", "flavorName": "...", "units": 40, "revenue": 1000.00, "cost": 600.00 }],
    "byLocation": [{ "location": "...", "sales": 15, "revenue": 375.00 }],
    "byPrice": [{ "priceRange": "...", "units": 50, "revenue": 1250.00 }]
  }
}
```

### `GET /api/reports/purchases`

Reporte de compras. **\[AUTH\]** Mismos query params que ventas. Incluye `bySupplier`.

### `GET /api/reports/inventory`

Reporte de inventario actual (mismo payload que `GET /api/inventory`). **\[AUTH\]**

---

## Negocio y Ubicaciones

### `GET /api/business`

Obtiene la configuración del negocio. **\[AUTH\]**

### `PATCH /api/business`

Actualiza la configuración del negocio. **\[AUTH\]**

Campos opcionales: `name`, `currency`, `defaultPurchaseCost`, `defaultHomePrice`, `primaryColor`, `secondaryColor`, `contact`, `reportFooter`, `alertEmail`.

### `GET /api/locations`

Lista ubicaciones activas. **\[AUTH\]**

### `POST /api/locations`

Crea una ubicación. **\[AUTH\]**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `name` | string | Sí | Nombre (1-40 chars) |

### `PATCH /api/locations/:id`

Actualiza una ubicación. **\[AUTH\]**

Campos opcionales: `name`, `active`.

---

## Sincronización Offline

### `POST /api/sync/operations`

Aplica un lote de operaciones del outbox offline. Cada operación tiene un `opId` (= UUID de la entidad) que permite deduplicar reintentos. **\[AUTH\]**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `operations` | array | Sí | Mínimo 1 operación |

Cada operación tiene un `type` (discriminante) y un `payload`:

| Type | Descripción | Payload clave |
|------|-------------|---------------|
| `"sale"` | Venta offline | `id` (opId), `saleDate`, `location`, `items` |
| `"purchase"` | Compra offline | `id` (opId), `purchaseDate`, `supplierId`, `items` |
| `"movement"` | Movimiento manual | `id` (opId), `flavorId`, `movementType`, `quantity` |
| `"flavor"` | Sabor nuevo | `id` (opId), `name`, `emoji`, `color`, `minStock` |
| `"supplier"` | Proveedor nuevo | `id` (opId), `name`, `contact`, `notes` |

**Respuesta (200):**

```json
{
  "success": true,
  "data": {
    "results": [
      { "opId": "<uuid>", "status": "applied", "entityId": "<uuid>" },
      { "opId": "<uuid>", "status": "duplicate", "entityId": "<uuid>" },
      { "opId": "<uuid>", "status": "failed", "message": "..." }
    ]
  }
}
```

| Status | Significado |
|--------|-------------|
| `applied` | Operación aplicada correctamente |
| `duplicate` | Ya se había aplicado (reintento seguro) |
| `failed` | Error de negocio (queda para reintento) |

---

## Errores globales

| Código | HTTP | Descripción |
|--------|------|-------------|
| `UNAUTHORIZED` | 401 | Token ausente o inválido |
| `VALIDATION_ERROR` | 400 | Parámetros o body no válidos |
| `INVALID_JSON` | 400 | Body no es JSON válido |
| `DUPLICATE` | 409 | Violación de unicidad |
| `NOT_FOUND` | 404 | Ruta o recurso no encontrado |
| `INTERNAL_ERROR` | 500 | Error inesperado del servidor |
| `INSUFFICIENT_INVENTORY` | 409 | Stock insuficiente |
| `BUSINESS_NOT_CONFIGURED` | 500 | Negocio no configurado (falta seed) |
