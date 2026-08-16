import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { ToastProvider } from "@/components/ui/Toast";
import { BusinessProvider } from "@/hooks/useBusiness";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { LoginPage } from "@/features/auth/LoginPage";
import { PageLoader } from "@/components/ui/Spinner";

// ---------------------------------------------------------------------
// Code splitting por ruta: cada feature se descarga bajo demanda.
// Reportes (jspdf + html-to-image) queda fuera del chunk inicial.
// ---------------------------------------------------------------------

const DashboardPage = lazy(() =>
  import("@/features/dashboard/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);
const SalesPage = lazy(() =>
  import("@/features/sales/SalesPage").then((m) => ({ default: m.SalesPage })),
);
const NewSalePage = lazy(() =>
  import("@/features/sales/NewSalePage").then((m) => ({ default: m.NewSalePage })),
);
const PurchasesPage = lazy(() =>
  import("@/features/purchases/PurchasesPage").then((m) => ({ default: m.PurchasesPage })),
);
const NewPurchasePage = lazy(() =>
  import("@/features/purchases/NewPurchasePage").then((m) => ({ default: m.NewPurchasePage })),
);
const InventoryPage = lazy(() =>
  import("@/features/inventory/InventoryPage").then((m) => ({ default: m.InventoryPage })),
);
const InventoryDetailPage = lazy(() =>
  import("@/features/inventory/InventoryDetailPage").then((m) => ({ default: m.InventoryDetailPage })),
);
const SuppliersPage = lazy(() =>
  import("@/features/suppliers/SuppliersPage").then((m) => ({ default: m.SuppliersPage })),
);
const ReportsPage = lazy(() =>
  import("@/features/reports/ReportsPage").then((m) => ({ default: m.ReportsPage })),
);
const SettingsPage = lazy(() =>
  import("@/features/settings/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
const MorePage = lazy(() =>
  import("@/features/more/MorePage").then((m) => ({ default: m.MorePage })),
);

function PageFallback() {
  return <PageLoader label="Cargando…" />;
}

/** Puerta de entrada: sin sesión válida solo se muestra el login. */
function AppGate() {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-cream">
        <PageLoader label="Abriendo Nalu…" />
      </div>
    );
  }

  if (status === "anon") return <LoginPage />;

  // BusinessProvider vive DENTRO del gate: no debe hacer peticiones
  // antes de restaurar la sesión (un 401 prematuro cerraría la sesión).
  return (
    <BusinessProvider>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="sales" element={<SalesPage />} />
            <Route path="sales/new" element={<NewSalePage />} />
            <Route path="purchases" element={<PurchasesPage />} />
            <Route path="purchases/new" element={<NewPurchasePage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="inventory/:flavorId" element={<InventoryDetailPage />} />
            <Route path="suppliers" element={<SuppliersPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="more" element={<MorePage />} />
            <Route path="*" element={<DashboardPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BusinessProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppGate />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
