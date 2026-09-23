# 🤖 Jev en Nalu — Guía de aprendizaje

> **Qué es esto:** apuntes para entender, de un vistazo, cómo Jev (System One, vía OpenCode Zen) quedó integrado en Nalu, **qué aprendimos** construyéndolo y **cómo leerlo** cuando se mire la demo. Con diagramas y capturas reales.

---

## 1. Jev no es un chatbot 💡

Jev — el modelo `jev-1.13-free` de **System One**, accesible vía OpenCode Zen — no responde texto libre que haya que "parsear". Usa **primitivas tipadas de decisión** (*Choice*): tú le envías **preguntas con opciones cerradas** y él devuelve, para cada pregunta:

```jsonc
{
  "type": "choice",
  "choice": "<id de una de las opciones que TÚ enviaste>",
  "confidence": 0.62,          // cuán seguro está de SU elección
  "probabilities": {           // reparto completo entre TODAS las opciones
    "<sabor-1>": 0.67,
    "<sabor-2>": 0.17,
    "ninguno": 0.00,
    "...": 0.16
  }
}
```

Esa es **toda la magia**: no hay parsing frágil, no hay alucinaciones de texto que rechazar, no hay *jailbreak* posible. O la opción existe en tu lista, o la respuesta es inválida → error controlado.

```mermaid
flowchart LR
    subgraph Chatbot ["Lo que NO hicimos ❌"]
        A1[Prompt de texto libre] --> A2[Respuesta en prosa] --> A3[Regex / parsing frágil] --> A4[❌ Alucinaciones,<br/>formatos rotos, RAG, streaming…]
    end
    subgraph Jev ["Lo que SÍ hicimos ✅"]
        B1["Preguntas con opciones cerradas"] --> B2["choice + confidence<br/>+ probabilities"] --> B3["Zod valida la forma"] --> B4["Opción válida → resultado<br/>Opción inválida → error controlado"]
    end
```

**Regla de oro aplicada:** *el modelo solo decide; Nalu calcula.* Todo lo numérico (stock, ventas, `reason`) lo compone el servidor con datos verificados — el modelo nunca inventa cifras.

---

## 2. El flujo completo, end-to-end

```mermaid
flowchart LR
    UI["🍧 Tarjeta en Inventario<br/><b>POST</b> /api/ai/inventory-recommendation?days=30"] --> Auth["requireAuth<br/>sesión PIN"]
    Auth --> Ctrl["ai.controller<br/>days ∈ 1–365 (default 30)"]
    Ctrl --> Svc["ai.service<br/>📜 logs de etapa"]
    Svc --> DB[("D1 / SQLite<br/>inventario + ventas")]
    Svc --> Dom["domain/ai<br/>buildState + buildQuestions"]
    Dom --> Zen["zen-client<br/>AbortSignal 15 s"]
    Zen --> Jev(("Jev<br/>jev-1.13-free"))
    Jev --> Zen
    Zen --> Val["interpretAnswers<br/>Zod + semántica<br/>¿opción existe? ¿conf ≥ 0.3?"]
    Val --> Ctrl
    Ctrl --> UI

    style Jev fill:#36C9C6,stroke:#1F7A78,color:#fff
    style UI fill:#FFD166,stroke:#E0A800,color:#333
```

**Arquitectura limpia:** `Route → Controller → Service → Repository` (patrón obligatorio del proyecto). El dominio (`domain/ai/recommendation.ts`) es **puro**: arma el estado, las preguntas e interpreta la respuesta — se testea solo, sin red ni base de datos.

---

## 3. Secuencia de una petición real

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario 🍧
    participant FE as Tarjeta IA
    participant BE as ai.service
    participant DB as D1
    participant Z as zen-client
    participant J as Jev · System One

    U->>FE: Toca "✨ Analizar inventario"
    activate FE
    FE->>BE: POST /api/ai/inventory-recommendation?days=30
    activate BE
    BE->>DB: sabores + stock + ventas de la ventana
    DB-->>BE: 6 sabores · 27 unidades vendidas
    Note over BE: 📜 "datos cargidos"
    BE->>Z: state (datos reales) + 2 questions (flavor, priority)
    Z->>J: POST /zen/v1/systemone (timeout 15 s)
    activate J
    J-->>Z: answers + usage (in/out tokens)
    deactivate J
    Z-->>BE: respuesta tipada
    Note over BE: 📜 "respuesta del modelo: uso in=1038 out=348"
    BE->>BE: Zod + semántica (opción ∈ lista, conf ≥ 0.3)
    BE->>BE: reason = plantilla + datos verificados
    Note over BE: 📜 "recomendación validada: flavor=Fresa Kiwi"
    BE-->>FE: { flavor, priority, reason, confidence, probabilities… }
    deactivate BE
    FE-->>U: 🍓 Fresa Kiwi · Prioridad 🔥 Alta · Confianza 62%
    deactivate FE
```

---

## 4. Las dos preguntas que se le hacen

| Pregunta | Opciones | Sirve para… |
|---|---|---|
| `flavor` | cada `flavor.id` real + `ninguno` | Elegir **qué sabor priorizar** |
| `priority` | `high` / `medium` / `low` | Elegir **qué tan urgente** es |

Y el **estado** que le llega (solo datos reales, sin rodeos):

```
Nalu es una app de venta de paletas artesanales.
Datos reales por sabor, ventana de últimos 30 días [disponible ahora, vendidas en la ventana]:
- Coco: 5 disponibles, 5 vendidas
- Oreo: 9 disponibles, 1 vendidas
- Fresa Kiwi: 10 disponibles, 10 vendidas
- Nutella con Almendras: 12 disponibles, 3 vendidas
- Maracumango: 15 disponibles, 5 vendidas
- Guanábana: 2 disponibles, 3 vendidas
Usa SOLO estos datos: no inventes ventas, inventario ni sabores.
```

Jev debe considerar **rotación y stock juntos** (no solo "lo que más se vende"): por eso en la semilla real Fresa Kiwi gana (10 vendidas + stock justo) pero Guanábana queda segunda (stock peligroso: 2).

---

## 5. Cómo leer la respuesta 📊

Respuesta **real** (capturada en el smoke test, `days=30`):

```json
{
  "success": true,
  "data": {
    "flavor": { "id": "20000000-…-0003", "name": "Fresa Kiwi", "emoji": "🍓" },
    "priority": "high",
    "reason": "Se va volando 🏃: 10 unidades vendidas en los últimos 30 días y solo quedan 10 paletas.",
    "confidence": 0.61,
    "probabilities": [
      { "name": "Fresa Kiwi",          "p": 0.67 },
      { "name": "Guanábana",           "p": 0.19 },
      { "name": "Maracumango",         "p": 0.07 },
      { "name": "Coco",                "p": 0.05 },
      { "name": "Oreo",                "p": 0.01 },
      { "name": "Nutella con Almendras","p": 0.01 },
      { "name": "Sin recomendación",   "p": 0.00 }
    ],
    "insufficientData": false,
    "range": { "from": "2026-08-23", "to": "2026-09-22", "days": 30 },
    "model": "jev-1.13-free"
  }
}
```

### Las dos escalas que importan

| Concepto | Significado | Ejemplo |
|---|---|---|
| **`confidence`** | Cuánto confía Jev en **su elección** (un solo número) | 0.61 → "62% seguro de Fresa Kiwi" |
| **`probabilities`** | Cómo reparte su apuesta **entre todos los sabores** | 67% Fresa Kiwi, 19% Guanábana… |

Visualizado como lo muestra la tarjeta (30 días):

```
Confianza de Jev  ██████████████████████▌               62%

Probabilidades
Fresa Kiwi        ████████████████████████████▎         67%
Guanábana         ████████                              17%
Maracumango       █████                                 10%
Coco              ██                                     4%
Oreo              ▏                                      1%
Nutella           ▏                                      1%
Sin recomendación                                        0%
```

Y **cambiando la ventana a 7 días** (misma BD, mismo botón):

```
Confianza de Jev  ██████████████████████████▊           69%   (↑ de 62%)

Probabilidades
Fresa Kiwi        ██████████████████████████████▎       73%   (↑ de 67%)
Guanábana         ██████                                12%   (↓ de 17%)
…
```

> 🎮 **Esto es lo jugable:** cambiar 7/30/90 días re-analiza al instante y ves **cómo Jev repondera** rotación vs stock. En 7 días la venta reciente pesa más: Fresa Kiwi sube y la "lenta" Guanábana baja.

**Capturas reales de la demo (móvil):**

| 30 días | 7 días |
|---|---|
| ![Recomendación 30 días](assets/jev-recomendacion-30d.png) | ![Recomendación 7 días](assets/jev-recomendacion-7d.png) |

---

## 6. Estados de la tarjeta (y sus contrapartes en la API)

```mermaid
stateDiagram-v2
    [*] --> idle
    idle --> loading: toca Analizar / cambia ventana
    loading --> success: 200 + flavor no nulo
    loading --> insufficient: 200 + insufficientData=true
    loading --> error: 503/502/504/429
    success --> loading: Analizar nuevamente / nueva ventana
    insufficient --> loading: misma acción
    error --> loading: Reintentar

    note right of success: 🍓 sabor + prioridad + barras
    note right of insufficient: 🤔 "Aún no hay una\nrecomendación clara"
    note right of error: 😕 "No fue posible obtener\nla recomendación."
```

| Situación | HTTP | Comportamiento |
|---|---|---|
| Sin `OPENCODE_ZEN_API_KEY` | 503 `AI_NOT_CONFIGURED` | La app sigue: aviso amigable |
| Proveedor caído / red | 502 `AI_UNAVAILABLE` | Reintentar disponible |
| Sin respuesta en 15 s | 504 `AI_TIMEOUT` | `AbortSignal` en el cliente |
| Rate limit del proveedor | 429 `AI_RATE_LIMIT` | Mensaje controlado |
| Respuesta con forma rara u opción fuera de lista | 502 `AI_INVALID_RESPONSE` | Zod + validación semántica |
| Sin ventas en la ventana o Jev elige `ninguno` o conf < 0.3 | **200** | **No es error**: `insufficientData: true` + mensaje amigable |
| Inventario vacío (0 sabores) | **200** | Se salta el modelo (costo 0) |

**Nunca** se expone un stack trace ni un mensaje en inglés al usuario; los errores de negocio llevan contrato `{ success: false, error: { code, message } }`.

---

## 7. Lecciones aprendidas (el verdadero "aprendizaje alrededor de Jev") 🧠

1. **Primitivas tipadas > texto libre.** Al elegir *Choice*, la validación pasó de "interpretar prosa" a "verificar un enum". Barato, robusto, testeable.

2. **Cada opción necesita una semántica EXACTA.** La primera versión del prompt decía *"si los datos no alcanzan… elige `ninguno`"*. Resultado: Jev — buen modelo, instrucción vaga — eligió `ninguno` con 0.99 **aunque hubiera ventas**. Lección: `ninguno` ahora significa literalamente **"cero ventas en la ventana"**, escrito así en las instrucciones. Después de ese cambio, con ventas reales siempre elige un sabor (la demo "prendió").

3. **El error se explica con datos, no con el modelo.** Cuando `ninguno` vuelve con `unitsSold = 0`, el `reason` lo compone el servidor: *"Todavía no hay ventas registradas… ¡Tu primera venta lo desbloquea! 🍧"*. Si hay ventas pero Jev no encuentra claro ganador: *"Jev no encontró un sabor claro…"*. El modelo no tiene que adivinar por qué falló.

4. **Umbral de confianza como red de seguridad.** `MIN_CONFIDENCE = 0.3`: por debajo, la respuesta se trata como "datos insuficientes" en vez de forzar una recomendación débil.

5. **El modelo ve un resumen, no la base de datos.** ~1 000 tokens de entrada ⇒ costo mínimo y **privacidad**: viajan agregados por sabor, no nombres de clientes ni nada sensible. Y no hay RAG, memoria ni herramientas: cada llamada es un mundo independiente y auditable.

6. **Jev no es determinista (y está bien).** En corridas seguidas con los mismos datos: confianza 0.61 vs 0.62, `p(Fresa Kiwi)` 0.67 vs 0.67. Señales **estables pero no idénticas** — por eso la UI muestra el reparto completo, no solo el ganador.

7. **Latencia real:** 0.4–0.9 s en caliente, hasta 1.9 s en la primera llamada (frío). Con eso se diseñó el estado "✨ Analizando inventario…" (botón deshabilitado, `aria-live`) y el descarte de respuestas viejas con `requestId` al cambiar de ventana.

8. **La ventana temporal es el "mando de juego".** Un único query param (`days`) convierte la demo en algo interactivo que enseña cómo piensa Jev: cambia la ventana y cambia su razonamiento, sin tocar nada más.

---

## 8. Datos de las corridas reales 📈

| Escenario | `days` | Latencia | Tokens (in/out) | Resultado |
|---|---|---|---|---|
| BD local, ventas viejas | 30 | 748 ms | 1008 / 314 | `ninguno` 0.99 → *"no hay ventas en la ventana"* ✅ correcto |
| BD demo fresca (smoke) | 30 | 708 ms | 1038 / 348 | **Fresa Kiwi**, alta, conf 0.61 |
| BD demo fresca (smoke) | 7 | 453 ms | 1031 / 348 | **Fresa Kiwi**, alta, conf 0.59 |
| BD demo fresca (UI navegador) | 30 | — | — | Fresa Kiwi, conf 62% |
| BD demo fresca (UI navegador) | 7 | — | — | Fresa Kiwi, conf 69% ↑ |

*Interesante:* el caso "ventas viejas" no es un bug — Jev respondió **bien**: cero ventas en la ventana → `ninguno`. La misma semántica que hace brillar la demo también muestra el estado vacío con honestidad.

---

## 9. Seguridad y configuración 🔐

| Pieza | Dónde vive | Nota |
|---|---|---|
| `OPENCODE_ZEN_API_KEY` | **Secreto de Workers** (prod) / `backend/.env` (local, gitignored) | **Nunca** en el repo, logs ni frontend |
| `ZEN_MODEL` | `wrangler.jsonc` → `vars` | `jev-1.13-free` (no sensible) |
| `ZEN_ENDPOINT` | `wrangler.jsonc` → `vars` | `https://opencode.ai/zen/v1/systemone` |

Los logs de etapa registran flujo y consumo (`uso in=… out=…`), **jamás credenciales**. El frontend solo recibe la recomendación ya validada.

Configurar en prod (una vez):

```bash
cd backend
pnpm exec wrangler secret put OPENCODE_ZEN_API_KEY
```

---

## 10. Cómo probarlo 🧪

| Nivel | Archivo | Cubre |
|---|---|---|
| Dominio puro | `backend/tests/domain/ai-recommendation.test.ts` | Estado/preguntas/interpretación, `ninguno`, confianza baja, cero ventas |
| Cliente HTTP | `backend/tests/ai/zen-client.test.ts` | 401→503, 429, 5xx, timeout/red (con fetch mockeado) |
| API | `backend/tests/api/ai-recommendation.test.ts` | Éxito, esquema inválido, proveedor caído, inventario vacío |
| Componente | `frontend/src/features/inventory/AiRecommendationCard.test.tsx` | idle/loading/success/error/insuficiente + selector de ventana |
| E2E | `e2e/tests/ai-recommendation.spec.ts` | La tarjeta en el navegador: siempre un estado definido, sin stack trace |

Ningún test hace llamadas reales al modelo (cliente inyectable/mock) — la suite es determinista y gratis.

---

## 11. Ideas a futuro 🔭

- **¿Inventario o Dashboard?** La tarjeta vive en *Inventario* porque necesita contexto de stock; pero como **gancho de entrada**, un mini-resumen en el *Dashboard* ("✨ Jev recomienda: Fresa Kiwi") con click-through podría darle más visibilidad. Decisión abierta.
- **Material para blog/LinkedIn:** este mismo documento (sección 2 + 5 + 7) es un buen esqueleto de post: *"Le enseñé a mi app a decidir: integrando un modelo de decisiones tipadas"*. Las dos capturas ya están listas en `docs/assets/`.
- **Más preguntas:** `location` (¿qué ubicación priorizar?) o `price` (¿subir/bajar precio?) son candidatas naturales — el contrato ya las soporta (agregar una question más, sin tocar la UI de un saque).
- **Costo:** ~1.4k tokens por llamada con `jev-1.13-free` ⇒ prácticamente cero en la demo; medir si crece el prompt.

---

*Documento vivo — actualízalo cuando Jev cambie. Última actualización: v1.5.0.*
