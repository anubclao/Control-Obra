"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, ShieldCheck } from "lucide-react";
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

export default function LoginPage() {
  const router = useRouter();
  const { switchUser, user, hydrated, refresh, lastStatus, lastDetail } = useAuthStore();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (hydrated && user) router.push(`/${user.area}`);
  }, [hydrated, user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Ingresa tu correo electronico");
      return;
    }
    const isValidFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    if (!isValidFormat) {
      setError("Correo electronico no valido");
      return;
    }
    setLoading(true);
    const ok = await switchUser(trimmed);
    setLoading(false);
    if (!ok) {
      const st = useAuthStore.getState().lastStatus;
      const dt = useAuthStore.getState().lastDetail;
      const statusText = st === 404
        ? "404 - Usuario no encontrado. Verifica que el email este registrado en users con is_active=1."
        : st === 500
        ? "500 - El servidor fallo. Causa probable: MySQL no accesible (env vars incorrectas en Hostinger)."
        : (st ? st + " - Error del servidor" : "Sin respuesta del servidor (timeout / DNS)");
      const detailText = dt ? "Detalle: " + JSON.stringify(dt, null, 2) : "Sin detalle del backend. Mira el log de errores de Hostinger (server.err.log) o llama a /api/auth/debug si configuraste DEBUG_TOKEN.";
      const fullMsg = statusText + "\n\n" + detailText;
      setError(fullMsg);
      return;
    }
    const me = await api.get<{ user: any }>("/api/auth/login").catch(() => ({ user: null }));
    router.push(`/${me.user?.area ?? "administrativo"}`);
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
            Sistema de gestión de proyectos
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Iniciar sesión</CardTitle>
            <CardDescription>
              Ingresa tu correo corporativo para acceder al sistema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Correo electrónico
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
                <div className="rounded border border-destructive/40 bg-destructive/5 p-3 space-y-2">
                  <p className="text-xs text-destructive font-semibold uppercase tracking-wide">Error del servidor</p>
                  <p className="text-xs text-destructive whitespace-pre-wrap font-medium">{error}</p>
                  {(lastStatus !== null) && (
                    <details className="border-t border-destructive/20 pt-2">
                      <summary className="text-[10px] text-muted-foreground cursor-pointer uppercase tracking-wide">
                        Detalle tecnico (soporte)
                      </summary>
                      <pre className="mt-2 overflow-auto text-[10px] text-foreground/70 whitespace-pre-wrap break-all bg-background/50 p-2 rounded">
{JSON.stringify({
  status: lastStatus,
  detail: lastDetail,
  requestId: `lastLogin-${new Date().toISOString()}`
}, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Ingresar
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>
            Si no tienes acceso, pide al administrador que te envíe una invitación.
          </span>
        </div>
      </div>
    </div>
  );
}
