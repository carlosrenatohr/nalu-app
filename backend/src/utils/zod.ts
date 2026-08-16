import type { ZodError } from "zod";

// ---------------------------------------------------------------------
// Traducción de errores de Zod a mensajes amigables en español.
// El frontend nunca debería mostrar códigos internos ni nombres de
// campos en inglés. (Compatibilidad con la forma de issues de Zod v4.)
// ---------------------------------------------------------------------

const FIELD_LABELS: Record<string, string> = {
  name: "el nombre",
  flavorId: "el sabor",
  supplierId: "el proveedor",
  quantity: "la cantidad",
  unitPrice: "el precio de venta",
  unitCost: "el costo",
  price: "el precio",
  saleDate: "la fecha de venta",
  purchaseDate: "la fecha de compra",
  date: "la fecha",
  movementType: "el tipo de movimiento",
  location: "la ubicación",
  notes: "las notas",
  minStock: "el stock mínimo",
  contact: "el contacto",
  currency: "la moneda",
  defaultPurchaseCost: "el costo de compra",
  defaultHomePrice: "el precio de venta",
  emoji: "el emoji",
  color: "el color",
  items: "los productos",
  id: "el identificador",
  operations: "las operaciones",
  type: "el tipo de operación",
  payload: "el contenido de la operación",
  primaryColor: "el color principal",
  secondaryColor: "el color secundario",
};

function label(path: PropertyKey[]): string {
  const key = String(path[0] ?? "");
  return FIELD_LABELS[key] ?? "el campo";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const TYPE_NAMES: Record<string, string> = {
  number: "un número",
  string: "un texto",
  boolean: "un valor verdadero o falso",
  array: "una lista",
  object: "un objeto",
};

export function zodErrorToSpanish(error: ZodError): string {
  const first = error.issues[0];
  if (!first) return "Los datos enviados no son válidos.";

  switch (first.code) {
    case "invalid_type": {
      // Zod v4 no expone "received"; lo extraemos del mensaje.
      const received = first.message.match(/received (undefined|null|\w+)/)?.[1];
      if (received === "undefined" || received === "null") {
        return `Falta ${label(first.path)}.`;
      }
      const expected = TYPE_NAMES[first.expected] ?? "un valor válido";
      return `${capitalize(label(first.path))} debe ser ${expected}.`;
    }
    case "too_small": {
      const origin = first.origin;
      if (origin === "array") {
        return `Agrega al menos ${first.minimum} ${first.path[0] === "items" ? "producto" : "elemento"}.`;
      }
      if (origin === "number") {
        return `${capitalize(label(first.path))} debe ser mayor o igual a ${first.minimum}.`;
      }
      return `${capitalize(label(first.path))} no puede estar vacío.`;
    }
    case "too_big": {
      return `${capitalize(label(first.path))} es demasiado largo.`;
    }
    case "invalid_value": {
      if (first.path[0] === "movementType") {
        return "El tipo de movimiento no es válido.";
      }
      return `${capitalize(label(first.path))} no es válido.`;
    }
    case "invalid_format": {
      return `${capitalize(label(first.path))} no es válido.`;
    }
    case "invalid_union":
      return "La operación enviada no es válida.";
    case "custom":
      return first.message || "Los datos enviados no son válidos.";
    case "unrecognized_keys":
      return "Se recibieron campos no esperados en la solicitud.";
    default:
      return "Los datos enviados no son válidos.";
  }
}

/** Detalles por campo para que el frontend pueda resaltar inputs. */
export function zodIssuesToDetails(
  error: ZodError,
): { field: string; message: string }[] {
  return error.issues.map((issue) => ({
    field: issue.path.map(String).join("."),
    message: issue.message,
  }));
}
