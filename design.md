# Design System — Nalu Paluka

## Overview

Este documento define el **system of design** para Nalu, un asistente de negocio para la venta de paletas artesanales. El diseño sigue principios de **Google Material Design** adaptados a la identidad de marca (colores de frutas tropicales) y optimizado para **offline-first** y **mobile-first**.

---

## 1. Filosofía de Diseño

| Principio | Descripción |
|-----------|-------------|
| **Offline-first** | La UI debe funcionar sin conexión completa. Los estados de carga, error y offline deben ser tan buenos como los estados online. |
| **Mobile-first** | Todo el diseño es responsive desde 320px. Touch targets ≥ 44px (Google recommendation). |
| **Latinoamericano** | Toda la interfaz en español (español latinoamericano), sin términos técnicos en inglés en la UI. |
| **Rústico artesanal** | Los colores inspirados en frutas tropicales y texturas cálidas reflejan el oficio de la paleta artesanal. |
| **Accesibilidad** | WCAG 2.2 Level AA como mínimo. Contraste mínimo 4.5:1. Preferencia `prefers-reduced-motion` respetada. |

---

## 2. Paleta de Colores (Tokens Centralizados)

Todos los colores están definidos en `frontend/src/index.css` bajo `@theme`. **Nunca dispersar colores crudos en los componentes.**

### Colores Principales (Frutas Tropicales)

| Nombre | Valor HEX | Uso |
|--------|-----------|-----|
| `--color-turquoise` | `#36c9c6` | Acciones primarias, navegación, enlaces activos |
| `--color-turquoise-deep` | `#159e9b` | Estados hover/active, borders |
| `--color-strawberry` | `#ff6f91` | Acentos positivos, ventas, CTA |
| `--color-strawberry-soft` | `#ffd1dc` | Fondos secundarios, hover states |
| `--color-mango` | `#ffd95a` | Resaltados, warnings, atención |
| `--color-mango-soft` | `#fff1b8` | Fondos ligeros, tarjetas de info |
| `--color-orange` | `#ff9f43` | Accent secundario, botones secundarios |
| `--color-orange-soft` | `#ffd6a5` | Hover, fondos suaves |
| `--color-kiwi` | `#8bcf5b` | Inventario, disponibilidad, estados positivos |
| `--color-mint` | `#d9f4c7` | Fondos de tarjetas, states de stock |
| `--color-grape` | `#9b7ede` | Reportes, analítica, fechas |
| `--color-lavender` | `#e7dfff` | Fondos de secciones de reporte |

### Colores Neutros

| Nombre | Valor HEX | Uso |
|--------|-----------|-----|
| `--color-cream` | `#fff9ef` | Fondo principal (`bg-cream`) |
| `--color-cocoa` | `#4b3832` | Texto principal (`text-cocoa`), borders |
| `--color-cocoa-soft` | `#75645e` | Texto secundario, disabled states |

---

## 3. Tipografía

```css
--font-sans: ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, -apple-system, sans-serif;
```

- **Familia:** `ui-rounded` (redondeado, cálido, refiere a artesanal) como primary
- **Fallback:** SF Pro Rounded, Segoe UI, system-ui
- **Peso normal para body**, weights disponibles: 400, 500, 600
- **Tamaños de texto** (scale 1.25, ratio 1.5):
  - `text-xs`: 0.75rem (12px)
  - `text-sm`: 0.875rem (14px)
  - `text-base`: 1rem (16px)
  - `text-lg`: 1.125rem (18px)
  - `text-xl`: 1.25rem (20px)
  - `text-2xl`: 1.5rem (24px)
  - `text-3xl`: 1.875rem (30px)

---

## 4. Espaciado y Escala

Sistema de 4px base con escalas refinadas:

| Valor | Espacio |
|-------|---------|
| `space-1` | 0.25rem (4px) |
| `space-2` | 0.5rem (8px) |
| `space-3` | 0.75rem (12px) |
| `space-4` | 1rem (16px) |
| `space-6` | 1.5rem (24px) |
| `space-8` | 2rem (32px) |
| `space-12` | 3rem (48px) |

**Regra:** `marginVertical: "space-4"` para tarjetas, `marginHorizontal: "space-6"` para sections principales.

---

## 5. Border Radius

| Token | Valor | Uso |
|-------|-------|-----|
| `--radius-pill` | `9999px` | Píldoras, chips, avatares |
| `--radius-card` | `1.25rem` | Tarjetas, modals, popovers |

**Regla:** Usar `--radius-card` para casi todo. `--radius-pill` solo para elementos de decisión rápida (chips, filtros).

---

## 6. Sombras

| Token | Valor | Uso |
|-------|-------|-----|
| `--shadow-soft` | `0 4px 20px -6px rgb(75 56 50 / 0.12)` | Fondos, seguras detrás de contenido |
| `--shadow-card` | `0 8px 30px -8px rgb(75 56 50 / 0.16)` | Tarjetas con elevación |
| `--shadow-pop` | `0 12px 40px -8px rgb(21 158 155 / 0.35)` | Modals, dropdowns, focus highlight |

**Regla:** `shadow-soft` en body, `shadow-card` en componentes de contenido, `shadow-pop` en elementos interactivos que necesitan atención.

---

## 7. Animaciones y Motion

### Tokens de Animación

```css
--animate-pop: pop 0.25s ease-out;
--animate-fade-up: fade-up 0.3s ease-out;
```

### Keyframes

```css
@keyframes pop {
  from { transform: scale(0.96); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

@keyframes fade-up {
  from { transform: translateY(8px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
```

### Política de Motion

- **Motion por defecto:** Todas las animaciones anteriores
- **Reduced motion:** Cuando `prefers-reduced-motion: reduce`, todas las animaciones deben reducirse a 1ms:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
  ```
- **Nunca remover la funcionalidad**, solo la animación.

---

## 8. Componentes UI

### 8.1 Botones

| Variante | Estilo |
|----------|--------|
| **Primario** | Fondo `--color-turquoise`, texto `white`, border `--color-turquoise-deep` |
| **Secundario** | Fondo transparente, texto `--color-cocoa`, border none |
| **Éxito** | Fondo `--color-kiwi`, texto `cocoa` |
| **Advertencia** | Fondo `--color-mango`, texto `cocoa-soft` |
| **Fantasma** | Sin fondo, texto `--color-strawberry`, border none |

**Especificaciones:**
- `min-height: 44px` (touch target)
- `padding: 0 1rem` (horizontal 1rem mínimo)
- `font-weight: 500`
- `border-radius: var(--radius-card)`
- `focus-visible: 3px solid var(--color-turquoise) outline-offset: 2px`
- `transition: background 0.2s ease, transform 0.1s ease`
- ` &:active { transform: scale(0.98); }`

### 8.2 Tarjetas (Cards)

```tsx
<div className="bg-cream rounded var(--radius-card) shadow-card p-6">
```

- Fondo `--color-cream`
- Border `--color-cocoa-soft` 1px suave (o none con `shadow-card`)
- `padding: var(--radius-card)` o `p-6` en Tailwind
- `touch-action: manipulation` en elementos hijos

### 8.3 Inputs y Formularios

- `touch-action: manipulation` en el wrapper
- `appearance: none` en inputs numéricos
- `border-radius: var(--radius-card)`
- Focus state: `outline: 3px solid var(--color-turquoise) outline-offset: 2px`
- `transition: border-color 0.2s, box-shadow 0.2s`

### 8.4 Tabs / Pestañas

- `border-bottom: 2px solid transparent`
- Tab activo: `border-bottom: 2px solid var(--color-turquoise)`
- `padding: 0.5rem 1rem`
- `font-weight: 500`
- `text-transform: uppercase` o `capitalize` en español

### 8.5 Modals y Overlays

- `fixed inset-0` backdrop con `app-backdrop` (gradients radiales)
- Modal contenido: `bg-cream rounded var(--radius-card) shadow-pop p-8 max-w-md mx-auto`
- Cerrar (close) button: `absolute top-4 right-4 rounded-full p-1 bg-cream/90 hover:bg-cream transition-colors`

---

## 9. Layout y Contenedores

### 9.1 App Backdrop

```css
.app-backdrop {
  background:
    radial-gradient(600px 300px at 100% 0%, rgb(255 217 90 / 0.18), transparent 60%),
    radial-gradient(700px 400px at 0% 100%, rgb(54 201 198 / 0.14), transparent 60%),
    var(--color-cream);
}
```

Aplicado en el `<body>` o wrapper principal como gradient sutil que refuerza la identidad de marca.

### 9.2 Contenedor Max-width

```css
.max-w-2xl { max-width: 32rem; }  /* 512px */
.max-w-xl { max-width: 36rem; }    /* 576px */
.max-w-2xl { max-width: 42rem; }   /* 672px */
```

### 9.3 Grid System

- **Mobile:** 1 columna, full width
- **Tablet:** 2 columnas, `gap: var(--radius-card)`
- **Desktop:** 3 columnas
- **Gutters:** `space-x-4 space-y-4` en mobile, `space-x-6 space-y-6` en desktop

---

## 10. accesibilidad (Accessibility)

### 10.1 Contraste

- Texto grande (18px+): razón mínima 3:1
- Texto pequeño: razón mínima 4.5:1
- Colores verificados:
  - `--color-cocoa` (#4b3832) sobre `--color-cream` (#fff9ef): razón 4.8:1 ✅
  - `--color-turquoise` (#36c9c6) sobre `--color-cream`: razón 4.6:1 ✅

### 10.2 Teclado y Touch

- `touch-action: manipulation` en todos los containers interactivos
- `tabindex` ordenado lógicamente
- `focus-visible` styles consistentes (turquoise 3px)
- `:focus-visible` nunca `:focus` puro en web

### 10.3 Lectores de Pantalla

- `aria-label` o `aria-labelledby` en todos los botones/iconos
- `role="status"` para mensajes de error/éxito dinámicos
- `polish` en textos en español (no "Error", usar "Hubo un problema")
- `LiveRegion` para actualizaciones de outbox/sync

### 10.4 Reducir Motion

```css
@media (prefers-reduced-motion: reduce) {
  * { transition-duration: 0.01ms !important; }
}
```

---

## 11. Estados y Variantes

### Estados de Componentes

| Estado | Estilo |
|--------|--------|
| **Default** | Tokens base (fondo, texto, border) |
| **Hover** | `transition: 0.15s`, cambiar `--color-soft` (e.g., `--color-strawberry-soft`) |
| **Active** | `transform: scale(0.98)`, `--color-deep` (e.g., `--color-turquoise-deep`) |
| **Focus** | `outline: 3px solid var(--color-turquoise) outline-offset: 2px` |
| **Disabled** | Opacidad `0.5`, cursor `not-allowed`, `--color-cocoa-soft` |
| **Error** | Borde `--color-mango`, fondo `--color-mango-soft`, texto `--color-orange` |
| **Success** | Borde `--color-kiwi`, fondo `--color-mint`, texto `--color-kiwi` |
| **Loading** | `animate-spin` (respeto `prefers-reduced-motion`), opacity `0.7` |

### Estados de Formulario

| Campo | Default | Focus | Error | Disabled |
|-------|---------|-------|-------|----------|
| **Input** | `border: 1px solid transparent` | `outline: 3px solid var(--color-turquoise)` | `border: 1px solid var(--color-mango)` | `opacity: 0.5` |
| **Select** | Mismo borde que input | Mismo focus | `border: 1px solid var(--color-mango)` | `pointer-events: none` |
| **Textarea** | Mismo | Mismo | Mismo | `resize: vertical` |

---

## 12. Responsive Breakpoints

| Breakpoint | Ancho Mínimo | Clases Tailwind |
|------------|--------------|-----------------|
| **sm** | 640px | `@media (min-width: 640px)` |
| **md** | 768px | `@media (min-width: 768px)` |
| **lg** | 1024px | `@media (min-width: 1024px)` |
| **xl** | 1280px | `@media (min-width: 1280px)` |
| **2xl** | 1536px | `@media (min-width: 1536px)` |

**Mobile-first** significa que las styles base son para móviles y las `@media` añaden funcionalidad para pantallas mayores.

### Ejemplo de patrón responsive

```tsx
<div className="p-4 md:p-6 lg:p-8">
  <h2 className="text-xl md:text-2xl lg:text-3xl font-medium">
    Título
  </h2>
  <p className="mt-2 text-base md:text-lg leading-relaxed">
    Descripción
  </p>
</div>
```

---

## 13. Patrón de Componente: Card with Action

```tsx
<article className="bg-cream rounded var(--radius-card) shadow-card p-6 hover:shadow-pop transition-shadow focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-var(--color-turquoise)">
  <h3 className="text-cocoa font-medium mb-3">Título</h3>
  <p className="text-cocoa-soft leading-relaxed mb-4">Descripción</p>
  <div className="flex items-center justify-between">
    <span className="text-caption text-cocoa-soft">Fecha</span>
    <button className="text-turquoise font-medium hover:text-turquoise-deep transition-colors">
      Ver detalles
    </button>
  </div>
</article>
```

**Reglas:**
- `focus-within` en lugar de `focus` en containers (mejor UX para mobile)
- `transition-shadow: 0.15s ease` en el card
- `touch-action: manipulation` en el card wrapper

---

## 14. Guía de Implementación

### 14.1 Nunca Hacer

1. ✗ **No** usar colores hex crudos en componentes — siempre los tokens `--color-*`
2. ✗ **No** usar `px` directo para `border-radius` o `shadow` — usar tokens `--radius-*` y `--shadow-*`
3. ✗ **No** ignorar `prefers-reduced-motion`
4. ✗ **No** usar `text-xs` para body — usar `text-base` como mínimo
5. ✗ **No** usar `display: none` para estados ocultos — usar `visibility: hidden` y `opacity: 0` con transición

### 14.2 Siempre Hacer

1. ✅ **Usar** `tailwind.config.ts` o `src/index.css` `@theme` para todos los tokens
2. ✅ **Verificar** contraste con herramienta (axecore, lighthouse)
3. ✅ **Probar** en móvil real (touch targets ≥ 44px)
4. ✅ **Revisar** `board.md` tasks usando tokens de diseño consistentes
5. ✅ **Documentar** nuevas componentes añadiendo guidelines a este `design.md`

---

## 15. Referencias y Enlaces

- [Material Design Guidelines](https://material.google.com/)
- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG-qr/)
- [Tailwind CSS v4 @theme docs](https://tailwindcss.com/docs/theme)
- [prefers-reduced-motion](https://developer.mozilla.org/es/docs/Web/CSS/@media/prefers-reduced-motion)

---

*Última actualización: 2026-09-02*  
*Versión: 1.0 — alineado con AGENTS.md protocolo codebase memory*