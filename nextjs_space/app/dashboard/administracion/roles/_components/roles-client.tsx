"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MENU_PERMISSION_CATALOG } from "@/lib/rbac";

type AccessRole = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  isSystem: boolean;
  usersCount: number;
};

type MenuPermissionState = {
  key: string;
  label: string;
  section: string;
  allowed: boolean;
};

export function RolesClient() {
  const { toast } = useToast();
  const [roles, setRoles] = useState<AccessRole[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [permissions, setPermissions] = useState<MenuPermissionState[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [creatingRole, setCreatingRole] = useState(false);

  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");

  const selectedRole = useMemo(
    () => roles.find((role) => role.id === selectedRoleId) || null,
    [roles, selectedRoleId]
  );

  const groupedPermissions = useMemo(() => {
    const sections = ["general", "tecnico", "administrativo", "ventas"];
    return sections.map((section) => ({
      section,
      items: permissions.filter((permission) => permission.section === section),
    }));
  }, [permissions]);

  const loadRoles = async () => {
    try {
      setLoadingRoles(true);
      const response = await fetch("/api/access-control/roles");
      if (!response.ok) throw new Error("No se pudieron cargar los roles");

      const data = await response.json();
      setRoles(data);

      if (!selectedRoleId && data.length) {
        setSelectedRoleId(data[0].id);
      } else if (selectedRoleId && !data.some((r: AccessRole) => r.id === selectedRoleId)) {
        setSelectedRoleId(data[0]?.id || "");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los roles de acceso",
        variant: "destructive",
      });
    } finally {
      setLoadingRoles(false);
    }
  };

  const loadPermissions = async (roleId: string) => {
    if (!roleId) {
      setPermissions([]);
      return;
    }

    try {
      const response = await fetch(`/api/access-control/roles/${roleId}/permissions`);
      if (!response.ok) throw new Error("No se pudieron cargar los permisos");

      const data = await response.json();
      setPermissions(data);
    } catch (error) {
      setPermissions(
        MENU_PERMISSION_CATALOG.map((item) => ({
          key: item.key,
          label: item.label,
          section: item.section,
          allowed: false,
        }))
      );
      toast({
        title: "Error",
        description: "No se pudieron cargar los permisos del rol",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    loadRoles();
  }, []);

  useEffect(() => {
    if (selectedRoleId) {
      loadPermissions(selectedRoleId);
    }
  }, [selectedRoleId]);

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) {
      toast({
        title: "Nombre requerido",
        description: "Debes escribir un nombre para el rol",
        variant: "destructive",
      });
      return;
    }

    try {
      setCreatingRole(true);
      const response = await fetch("/api/access-control/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRoleName.trim(),
          description: newRoleDescription.trim() || null,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "No se pudo crear el rol");
      }

      setNewRoleName("");
      setNewRoleDescription("");
      await loadRoles();
      setSelectedRoleId(payload.id);

      toast({ title: "Rol creado", description: "El nuevo rol fue creado correctamente" });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo crear el rol",
        variant: "destructive",
      });
    } finally {
      setCreatingRole(false);
    }
  };

  const togglePermission = (key: string, checked: boolean) => {
    setPermissions((current) =>
      current.map((permission) =>
        permission.key === key ? { ...permission, allowed: checked } : permission
      )
    );
  };

  const handleSavePermissions = async () => {
    if (!selectedRoleId) return;

    try {
      setSavingPermissions(true);
      const allowedKeys = permissions
        .filter((permission) => permission.allowed)
        .map((permission) => permission.key);

      const response = await fetch(`/api/access-control/roles/${selectedRoleId}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: allowedKeys }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "No se pudieron guardar los permisos");
      }

      toast({
        title: "Permisos actualizados",
        description: "Los cambios se guardaron correctamente",
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "No se pudieron guardar los permisos",
        variant: "destructive",
      });
    } finally {
      setSavingPermissions(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Roles y Permisos</h1>
        <p className="text-muted-foreground">
          Crea perfiles de acceso y define menus permitidos con checkboxes.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Crear Nuevo Rol</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-2">
            <Label htmlFor="role-name">Nombre</Label>
            <Input
              id="role-name"
              placeholder="Ej: Supervisor Financiero"
              value={newRoleName}
              onChange={(event) => setNewRoleName(event.target.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="role-description">Descripcion</Label>
            <Input
              id="role-description"
              placeholder="Opcional"
              value={newRoleDescription}
              onChange={(event) => setNewRoleDescription(event.target.value)}
            />
          </div>
          <div className="md:col-span-3">
            <Button onClick={handleCreateRole} disabled={creatingRole}>
              {creatingRole ? "Creando..." : "Crear Rol"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Roles Disponibles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loadingRoles ? (
              <p className="text-sm text-muted-foreground">Cargando roles...</p>
            ) : roles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay roles creados.</p>
            ) : (
              roles.map((role) => (
                <button
                  key={role.id}
                  className={`w-full text-left border rounded-md p-3 transition ${
                    selectedRoleId === role.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted"
                  }`}
                  onClick={() => setSelectedRoleId(role.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm">{role.name}</p>
                    <Badge variant="outline">{role.usersCount} usuarios</Badge>
                  </div>
                  {role.description && (
                    <p className="text-xs text-muted-foreground mt-1">{role.description}</p>
                  )}
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              Permisos del Rol {selectedRole ? `- ${selectedRole.name}` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!selectedRole ? (
              <p className="text-sm text-muted-foreground">
                Selecciona un rol para administrar permisos.
              </p>
            ) : (
              <>
                {groupedPermissions.map((group) => (
                  <div key={group.section} className="space-y-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                      {group.section}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {group.items.map((item) => (
                        <label
                          key={item.key}
                          className="flex items-center gap-2 rounded border p-3 cursor-pointer"
                        >
                          <Checkbox
                            checked={item.allowed}
                            onCheckedChange={(value) => togglePermission(item.key, Boolean(value))}
                          />
                          <span className="text-sm">{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}

                <Button onClick={handleSavePermissions} disabled={savingPermissions}>
                  {savingPermissions ? "Guardando..." : "Guardar Permisos"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
