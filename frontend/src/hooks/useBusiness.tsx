import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { businessApi } from "@/services/api";
import type { Business } from "@/types";

// ---------------------------------------------------------------------
// Contexto del negocio (ajustes). Compartido donde hace falta: la app
// NO usa Redux; Context solo para estado genuinamente compartido.
// ---------------------------------------------------------------------

interface BusinessContextValue {
  business: Business | null;
  loading: boolean;
  reload: () => void;
  currency: string;
  defaultHomePrice: number;
  defaultPurchaseCost: number;
}

const BusinessContext = createContext<BusinessContextValue | null>(null);

export function BusinessProvider({ children }: { children: ReactNode }) {
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    businessApi
      .get()
      .then(setBusiness)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const value: BusinessContextValue = {
    business,
    loading,
    reload,
    currency: business?.currency ?? "NIO",
    defaultHomePrice: business?.defaultHomePrice ?? 60,
    defaultPurchaseCost: business?.defaultPurchaseCost ?? 28,
  };

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBusiness(): BusinessContextValue {
  const ctx = useContext(BusinessContext);
  if (!ctx) throw new Error("useBusiness debe usarse dentro de <BusinessProvider>");
  return ctx;
}
