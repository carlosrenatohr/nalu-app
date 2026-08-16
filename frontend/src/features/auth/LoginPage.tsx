import { useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";

// ---------------------------------------------------------------------
// Pantalla de inicio de sesión: PIN de 4-6 dígitos.
// El PIN por defecto es 1234 y se cambia desde Ajustes.
// ---------------------------------------------------------------------

export function LoginPage() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (pin.length < 4) {
      toast("Escribe tu PIN de 4 dígitos", "error");
      return;
    }
    setLoading(true);
    try {
      await login(pin);
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo iniciar sesión", "error");
      setPin("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-turquoise to-turquoise-deep p-6">
      <div className="w-full max-w-sm animate-fade-up rounded-[2rem] bg-white p-8 shadow-pop">
        <div className="text-center">
          <span className="text-6xl" aria-hidden="true">
            🍧
          </span>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-cocoa">Nalu</h1>
          <p className="mt-1 text-sm font-bold text-cocoa-soft">
            Tu asistente de paletas 🍦
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="pin" className="mb-2 block text-sm font-bold text-cocoa">
              PIN de acceso
            </label>
            <input
              id="pin"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              maxLength={6}
              pattern="[0-9]*"
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              autoFocus
              className="w-full rounded-2xl border-2 border-cocoa/10 bg-cream px-4 py-3 text-center text-3xl font-black tracking-[0.5em] text-cocoa focus:border-turquoise focus:outline-none"
            />
          </div>

          <Button size="lg" type="submit" className="w-full" disabled={loading}>
            {loading ? <Spinner className="h-5 w-5" /> : "Entrar"}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-cocoa-soft">
          La sesión se mantiene abierta por 90 días en este dispositivo.
        </p>
      </div>
    </div>
  );
}
