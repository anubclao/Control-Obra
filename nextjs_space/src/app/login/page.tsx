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
      setError("Ingresa tu correo electrónico");
      return;
    }
    const isValidFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    if (!isValidFormat) {
      setError("Correo electrónico no válido");
      return;
    }
    setLoading(true);
    let status: number | null = null;
    let detail: any = null;
    try {
      const ok = await switchUser(trimmed);
      if (!ok) {
        setError(
          status === 404
            ? "Usuario no encontrado en la base de datos. Verifica que el email este registrado en la tabla 'users' con is_active=1."
            : status === 500
            ? `Servidor devolvio 500. Diagnostico del backend:

${detail ? JSON.stringify(detail, null, 2) : "(sin detalle del servidor)"}

Revisa el log de errores de Hostinger (server.err.log) o llama a /api/auth/debug para ver env vars.`
            : "No se pudo iniciar sesion. Revisa tu conexion o contacta al administrador."
        );
        return;
      }
    } finally {
      setLoading(false);
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
                <div className="space-y-2">
                  <p className="text-sm text-destructive whitespace-pre-wrap font-mono text-xs">{error}</p>
                  <details className="rounded border border-destructive/30 bg-destructive/5 p-2 text-xs">
                    <summary className="cursor-pointer text-muted-foreground">
                      Detalle tecnico (para soporte)
                    </summary>
                    <pre className="mt-2 overflow-auto text-[10px] text-muted-foreground whitespace-pre-wrap break-all">
                      {JSON.stringify({ status: lastStatus, detail: lastDetail, requestId: new Date().toISOString() }, null, 2)}
                    </pre>
                  </details>
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
