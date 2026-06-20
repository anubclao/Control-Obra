"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/lib/auth-store";
import { MOCK_USERS } from "@/lib/auth-mock";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();
  const { switchUser, user, hydrated } = useAuthStore();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"email" | "otp">("email");
  const [otp, setOtp] = useState("");

  useEffect(() => {
    if (hydrated && user) router.push(`/${user.area}`);
  }, [hydrated, user, router]);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    // MOCK: simula envío de OTP
    await new Promise((r) => setTimeout(r, 500));
    setLoading(false);
    setStep("otp");
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    await new Promise((r) => setTimeout(r, 500));

    // MOCK: cualquier OTP de 6 dígitos es válido si el email existe
    if (otp.length !== 6) {
      setError("El código debe tener 6 dígitos");
      setLoading(false);
      return;
    }

    const ok = switchUser(email);
    if (!ok) {
      setError("Usuario no encontrado. Usa uno de los usuarios de prueba.");
      setLoading(false);
      return;
    }

    const found = MOCK_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
    // Forzar reload para que el store se hidrate antes de la redirección
    window.location.href = `/${found!.area}`;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold">Control de Obra Pro</h1>
          <p className="text-sm text-muted-foreground">Sistema de gestión de proyectos</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {step === "email" ? "Iniciar sesión" : "Verificación"}
            </CardTitle>
            <CardDescription>
              {step === "email"
                ? "Ingresa tu correo para recibir un código OTP"
                : `Ingresa el código de 6 dígitos enviado a ${email}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === "email" ? (
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Correo electrónico</label>
                  <Input
                    type="email"
                    placeholder="tu@correo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enviar código
                </Button>
              </form>
            ) : (
              <form onSubmit={handleOtpSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Código OTP</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    required
                    autoFocus
                    className="text-center text-lg tracking-widest"
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    (Mock: cualquier código de 6 dígitos es válido)
                  </p>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setStep("email");
                      setOtp("");
                      setError(null);
                    }}
                  >
                    Atrás
                  </Button>
                  <Button type="submit" className="flex-1" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Ingresar
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 rounded-lg border bg-card p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Usuarios de prueba
          </p>
          <div className="space-y-1">
            {MOCK_USERS.slice(0, 5).map((u) => (
              <button
                key={u.id}
                onClick={() => setEmail(u.email)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                  email === u.email && "border-primary"
                )}
              >
                <div>
                  <p className="font-medium">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
                <span className="text-xs text-muted-foreground">{u.area}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
