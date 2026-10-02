"use client";

/**
 * /administrativo/usuarios
 *
 * Spec: docs/specs/admin-user-authorization-with-otp.md
 *
 * Reemplaza el flujo de "invitaciones por código" por el nuevo flujo:
 *   - Super Admin crea un AuthorizedUser (email + nombre + rol + area + opcional projectId).
 *   - Estado inicial PENDING.
 *   - El Super Admin activa (PENDING → ACTIVE) desde la tabla.
 *   - Cuando el usuario final hace login OTP en /login, el backend valida que
 *     su email exista en users con status='ACTIVE' antes de enviar el código.
 *   - Suspender (ACTIVE → SUSPENDED) y Reactivar (SUSPENDED → ACTIVE) están
 *     disponibles.
 *   - Eliminar solo se permite si el usuario no tiene historial crítico.
 *
 * Acceso restringido a rol ADMIN (gating por useIsSuperAdmin).
 */

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Mail,
  ShieldAlert,
  UserCog,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useProjectsStore } from "@/lib/data-store";
import { useUsersStore } from "@/lib/users-store";
import { useAuthStore } from "@/lib/auth-store";
import { useIsSuperAdmin } from "@/lib/permissions";
import {
  computeKpis,
  filterAuthorizedUsers,
  type AuthorizedUserFilters,
} from "@/lib/admin-users";
import { ModuleExplanationCard } from "@/components/ui/module-explanation-card";
import { AuthorizedUserForm } from "@/components/admin/AuthorizedUserForm";
import { AuthorizedUserRow } from "@/components/admin/AuthorizedUserRow";
import { AuthorizedUsersFilters } from "@/components/admin/AuthorizedUsersFilters";
import { AuthorizedUsersKpis } from "@/components/admin/AuthorizedUsersKpis";
import { useConfirm } from "@/components/ui/confirm-dialog";
import type { AuthorizedUser } from "@/types";

export default function UsuariosPage() {
  const isAdmin = useIsSuperAdmin();
  const { user } = useAuthStore();
  const { projects } = useProjectsStore();
  const {
    users,
    loaded,
    loading,
    error,
    load,
    authorizeUser,
    suspendUser,
    reactivateUser,
    deleteUser,
  } = useUsersStore();
  const [createOpen, setCreateOpen] = useState(false);
  const [lastCreated, setLastCreated] = useState<AuthorizedUser | null>(null);
  const [filters, setFilters] = useState<AuthorizedUserFilters>({
    search: "",
    role: "ALL",
    status: "ALL",
  });
  const confirm = useConfirm();

  // Cargar usuarios solo si el viewer es Super Admin.
  useEffect(() => {
    if (isAdmin && !loaded && !loading) {
      load();
    }
  }, [isAdmin, loaded, loading, load]);

  const filtered = useMemo(
    () => filterAuthorizedUsers(users, filters),
    [users, filters],
  );

  const kpis = useMemo(() => computeKpis(users), [users]);

  // ───────────────────────────────────────────────────────────────────
  // Gating: si no es ADMIN, mostramos mensaje y NO renderizamos controles.
  // ───────────────────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Acceso restringido</AlertTitle>
          <AlertDescription>
            Solo el <strong>Super Administrador</strong> (rol ADMIN) puede
            gestionar usuarios autorizados. Si necesitas acceso, contacta al
            administrador del sistema.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────
  // Handlers
  // ───────────────────────────────────────────────────────────────────
  async function handleAuthorize(id: string) {
    try {
      await authorizeUser(id, user?.id ?? "");
    } catch (e: any) {
      console.error("[authorize]", e?.message);
    }
  }

  function handleSuspend(id: string) {
    confirm.open({
      title: "Suspender usuario",
      description:
        "El usuario no podrá recibir códigos OTP para iniciar sesión. ¿Confirmas?",
      confirmText: "Suspender",
      variant: "danger",
      onConfirm: async () => {
        try {
          await suspendUser(id, user?.id ?? "");
        } catch (e: any) {
          console.error("[suspend]", e?.message);
        }
      },
    });
  }

  function handleReactivate(id: string) {
    confirm.open({
      title: "Reactivar usuario",
      description:
        "El usuario volverá a poder recibir códigos OTP para iniciar sesión.",
      confirmText: "Reactivar",
      variant: "success",
      onConfirm: async () => {
        try {
          await reactivateUser(id, user?.id ?? "");
        } catch (e: any) {
          console.error("[reactivate]", e?.message);
        }
      },
    });
  }

  function handleDelete(id: string, email: string) {
    confirm.open({
      title: "Eliminar usuario",
      description: `Vas a eliminar a ${email}. Esta acción no se puede deshacer. Si tiene historial (cortes, pagos, contratos), la operación será rechazada.`,
      confirmText: "Eliminar definitivamente",
      variant: "danger",
      onConfirm: async () => {
        try {
          await deleteUser(id);
        } catch (e: any) {
          console.error("[delete]", e?.message);
          const msg =
            e?.status === 409
              ? "No se puede eliminar: el usuario tiene historial. Usa Suspender."
              : e?.message ?? "Error al eliminar";
          alert(msg);
        }
      },
    });
  }

  return (
    <div className="space-y-6">
      {confirm.dialog}
      <ModuleExplanationCard
        icon={UserCog}
        variant="guide"
        title="Administración de Usuarios Autorizados"
        description="El Super Admin controla quién puede recibir códigos OTP."
        steps={[
          {
            title: "Crear usuario",
            description: "Email + nombre + rol + área. Estado inicial PENDING.",
          },
          {
            title: "Activar",
            description: "PENDING → ACTIVE. A partir de ahí puede recibir OTP.",
          },
          {
            title: "Suspender / Reactivar",
            description: "Control fino cuando alguien sale de la empresa.",
          },
        ]}
        warnings={[
          "Solo ADMIN puede crear/activar/suspender usuarios.",
          "Eliminar un usuario con historial (cortes, pagos, contratos) será rechazado.",
        ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Usuarios Autorizados
          </h1>
          <p className="text-sm text-muted-foreground">
            {kpis.total} usuarios · {kpis.pending} pendientes de activar
          </p>
        </div>

        <Dialog
          open={createOpen}
          onOpenChange={(o) => {
            setCreateOpen(o);
            if (!o) setLastCreated(null);
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo usuario
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear usuario autorizado</DialogTitle>
              <DialogDescription>
                Quedará en estado PENDING hasta que lo actives desde la tabla.
              </DialogDescription>
            </DialogHeader>

            {lastCreated ? (
              <div className="space-y-3">
                <div className="rounded-md border-2 border-dashed border-emerald-500 bg-emerald-50 p-6 text-center">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
                  <p className="mt-2 text-sm font-medium text-emerald-900">
                    Usuario creado
                  </p>
                  <p className="mt-1 text-sm text-emerald-700">
                    {lastCreated.name}
                  </p>
                  <p className="text-xs text-emerald-700">{lastCreated.email}</p>
                  <p className="mt-2 font-mono text-xs uppercase tracking-wider text-emerald-700">
                    Status: {lastCreated.status}
                  </p>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => {
                      setCreateOpen(false);
                      setLastCreated(null);
                    }}
                  >
                    Cerrar
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <AuthorizedUserForm
                projects={projects}
                createdBy={user?.id ?? "unknown"}
                onCreated={(u) => setLastCreated(u)}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>

      <AuthorizedUsersKpis kpis={kpis} />

      <AuthorizedUsersFilters filters={filters} onChange={setFilters} />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Tabla de usuarios */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Usuarios
        </h2>

        {loading && users.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg border bg-muted/40" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <Mail className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">
              {users.length === 0
                ? "Aún no has autorizado ningún usuario"
                : "Sin resultados"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {users.length === 0
                ? "Crea el primero con el botón «Nuevo usuario»."
                : "Prueba cambiando o limpiando los filtros."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((u) => (
              <AuthorizedUserRow
                key={u.id}
                user={u}
                projectName={
                  u.projectId
                    ? projects.find((p) => p.id === u.projectId)?.name
                    : undefined
                }
                onAuthorize={handleAuthorize}
                onSuspend={handleSuspend}
                onReactivate={handleReactivate}
                onDelete={(id) => handleDelete(id, u.email)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
