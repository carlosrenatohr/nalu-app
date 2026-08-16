import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { authApi, restoreSession } from "@/services/api";
import { onUnauthorized } from "@/lib/offline/session";

// ---------------------------------------------------------------------
// Estado de autenticación de la app. La sesión es de larga duración
// (90 días en el servidor) para que la app móvil no pida el PIN a cada
// rato. Al arrancar se restaura desde IndexedDB.
//
// Flujo:
//   loading  → restaurando sesión persistida (pantalla de carga)
//   authed   → app principal
//   anon     → pantalla de login
// ---------------------------------------------------------------------

type AuthStatus = "loading" | "authed" | "anon";

interface AuthContextValue {
  status: AuthStatus;
  login: (pin: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");

  // Restaura la sesión persistida al arrancar. Si hay token, se valida
  // contra /auth/me; si la red falla, confiamos en el token local
  // (offline-first) hasta que el servidor diga lo contrario.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const hasToken = await restoreSession();
      if (cancelled) return;
      if (!hasToken) {
        setStatus("anon");
        return;
      }
      const business = await authApi.me();
      if (cancelled) return;
      setStatus(business ? "authed" : "anon");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Cualquier 401 del servidor cierra la sesión en toda la app.
  useEffect(() => {
    const unsubscribe = onUnauthorized(() => setStatus("anon"));
    return unsubscribe;
  }, []);

  const login = useCallback(async (pin: string) => {
    await authApi.login(pin);
    setStatus("authed");
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setStatus("anon");
  }, []);

  return (
    <AuthContext.Provider value={{ status, login, logout }}>{children}</AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
