"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, ShieldCheck, Mail, KeyRound, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuthStore } from "@/lib/auth-store";
import { api } from "@/lib/api";

type Step = "email" | "otp";

export default function LoginPage() {
  const router = useRouter();
  const { user, hydrated, refresh } = useAuthStore();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (hydrated && user) router.push(`/${user.area}`);
  }, [hydrated, user, router]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError("Ingresa tu correo electronico");
      return;
    }
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    if (!isValid) {
      setError("Correo electronico no valido");
      return;
    }
    setLoading(true);
    try {
      const data = await api.post<{ ok: boolean; message: string; devCode?: string }>(
        "/api/auth/request-otp",
        { email: trimmed }
      );
      setInfo(
        (data.message ?? "Codigo enviado a tu correo") +
        (data.devCode ? ` [DEV: ${data.devCode}]` : "")
      );
      setStep("otp");
      setCountdown(60); // permite reenviar despues de 60s
    } catch (e: any) {
      const st = e?.status;
      if (st === 404) {
        setError("Este correo no esta registrado. Contacta al administrador para que te cree una cuenta.");
      } else if (st === 500) {
        setError("El servidor fallo al enviar el codigo. Verifica configuracion SMTP en Hostinger.");
      } else {
        setError(e?.message ?? "No se pudo enviar el codigo. Intenta de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!otp.trim() || !/^\d{6}$/.test(otp.trim())) {
      setError("El codigo debe tener exactamente 6 digitos");
      return;
    }
    setLoading(true);
    try {
      const data = await api.post<{ ok: boolean; user: any }>(
        "/api/auth/verify-otp",
        { email: email.trim().toLowerCase(), otp: otp.trim() }
      );
      if (data.ok && data.user) {
        router.push(`/${data.user.area ?? "administrativo"}`);
      } else {
        setError("Codigo invalido. Verifica e intenta de nuevo.");
      }
    } catch (e: any) {
      const st = e?.status;
      if (st === 401) {
        setError("Codigo invalido o expirado. Solicita uno nuevo.");
      } else if (st === 500) {
        setError("Error al verificar codigo. Mira server.err.log de Hostinger.");
      } else {
        setError(e?.message ?? "Error al verificar. Intenta de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold">Control de Obra Pro</h1>
          <p className="text-sm text-muted-foreground">
            Sistema de gestion de proyectos
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {step === "email" ? (
                <>
                  <Mail className="h-4 w-4" />
                  Iniciar sesion
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4" />
                  Verificar codigo
                </>
              )}
            </CardTitle>
            <CardDescription>
              {step === "email"
                ? "Ingresa tu correo corporativo. Te enviaremos un codigo de 6 digitos."
                : `Ingresa el codigo de 6 digitos enviado a ${email}.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === "email" ? (
              <form onSubmit={requestOtp} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Correo electronico
                  </label>
                  <Input
                    type="email"
                    placeholder="tu@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                {error && (
                  <p className="text-xs text-destructive whitespace-pre-wrap font-mono bg-destructive/5 p-2 rounded">{error}</p>
                )}
                {info && (
                  <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 p-2 rounded">{info}</p>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enviar codigo
                </Button>
              </form>
            ) : (
              <form onSubmit={verifyOtp} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Codigo de 6 digitos
                  </label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    required
                    autoFocus
                    className="text-center text-lg tracking-widest font-mono"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Revisa tu bandeja de entrada. Codigo valido por 10 minutos.
                  </p>
                </div>
                {error && (
                  <p className="text-xs text-destructive whitespace-pre-wrap font-mono bg-destructive/5 p-2 rounded">{error}</p>
                )}
                {info && (
                  <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 p-2 rounded">{info}</p>
                )}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setStep("email");
                      setOtp("");
                      setError(null);
                      setInfo(null);
                    }}
                    disabled={loading}
                  >
                    <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                    Cambiar email
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => requestOtp({ preventDefault: () => {} } as React.FormEvent)}
                    disabled={loading || countdown > 0}
                  >
                    {countdown > 0 ? `Reenviar (${countdown}s)` : "Reenviar"}
                  </Button>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verificar y entrar
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>
            Autenticacion por codigo OTP enviado a tu correo. Si no tienes acceso, contacta al administrador.
          </span>
        </div>
      </div>
    </div>
  );
}
