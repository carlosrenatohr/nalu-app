import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { ReactElement } from "react";
import { BusinessProvider } from "@/hooks/useBusiness";
import { ToastProvider } from "@/components/ui/Toast";

export function renderWithProviders(ui: ReactElement, route = "/") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <BusinessProvider>
        <ToastProvider>{ui}</ToastProvider>
      </BusinessProvider>
    </MemoryRouter>,
  );
}
