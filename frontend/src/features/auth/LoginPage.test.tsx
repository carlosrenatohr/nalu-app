// ---------------------------------------------------------------------
// Tests del login: el PIN se envía al iniciar sesión, se valida la
// longitud mínima y un error del servidor se muestra como toast.
// ---------------------------------------------------------------------
import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/utils";
import userEvent from "@testing-library/user-event";
import { LoginPage } from "./LoginPage";

const loginMock = vi.fn();

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    status: "anon",
    login: loginMock,
    logout: vi.fn(),
  }),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    loginMock.mockReset();
  });

  it("envía el PIN al entrar", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText("PIN de acceso"), "1234");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => expect(loginMock).toHaveBeenCalledWith("1234"));
  });

  it("no envía un PIN incompleto", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText("PIN de acceso"), "12");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(loginMock).not.toHaveBeenCalled();
    expect(screen.getByText("Escribe tu PIN de 4 dígitos")).toBeInTheDocument();
  });

  it("muestra el error del servidor si el PIN es incorrecto", async () => {
    loginMock.mockRejectedValue(new Error("PIN incorrecto. Intenta de nuevo."));
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText("PIN de acceso"), "0000");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() =>
      expect(screen.getByText("PIN incorrecto. Intenta de nuevo.")).toBeInTheDocument(),
    );
  });
});
