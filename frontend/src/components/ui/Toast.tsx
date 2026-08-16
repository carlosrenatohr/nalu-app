import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { IconCheck, IconAlert, IconX } from "./icons";

// ---------------------------------------------------------------------
// Notificaciones breves (toasts). La app las usa para confirmar
// acciones y mostrar errores de forma amigable.
// ---------------------------------------------------------------------

type ToastTone = "success" | "error" | "info";

interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return ctx;
}

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, tone: ToastTone = "success") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, tone, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const tones: Record<ToastTone, string> = {
    success: "bg-turquoise-deep text-white",
    error: "bg-strawberry text-white",
    info: "bg-cocoa text-white",
  };
  const icons: Record<ToastTone, ReactNode> = {
    success: <IconCheck className="h-5 w-5" />,
    error: <IconAlert className="h-5 w-5" />,
    info: <IconX className="h-5 w-5 rotate-45" />,
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`animate-pop flex min-h-11 max-w-sm items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold shadow-card ${tones[t.tone]}`}
          >
            {icons[t.tone]}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
