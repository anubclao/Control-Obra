"use client";

import { useState } from "react";
import { Mail, User, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isValidEmail, buildAuthorizedUser } from "@/lib/admin-users";
import { useUsersStore, type CreateAuthorizedUserInput } from "@/lib/users-store";
import type { AuthorizedUser, Role, Area } from "@/types";

interface AuthorizedUserFormProps {
  projects: Array<{ id: string; code: string; name: string }>;
  onCreated: (user: AuthorizedUser) => void;
  createdBy: string;
}

const ROLES: Role[] = [
  "ADMIN",
  "GERENTE",
  "DIRECTOR",
  "RESIDENTE",
  "CONTABILIDAD",
  "TESORERIA",
  "HSEQ",
  "CLIENTE",
  "USER",
];

const AREAS: Area[] = ["tecnico", "administrativo", "ventas"];

export function AuthorizedUserForm({
  projects,
  onCreated,
  createdBy,
}: AuthorizedUserFormProps) {
  const createUser = useUsersStore((s) => s.createUser);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("USER");
  const [area, setArea] = useState<Area>("administrativo");
  const [projectId, setProjectId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("El nombre es obligatorio");
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      setError("Correo electrónico no válido");
      return;
    }

    setLoading(true);
    try {
      const input: CreateAuthorizedUserInput = {
        email: trimmedEmail,
        name: trimmedName,
        role,
        area,
        projectId: projectId || undefined,
        createdBy,
      };
      // Pre-validate via helper to give instant feedback (also runs server-side).
      buildAuthorizedUser({
        email: trimmedEmail,
        name: trimmedName,
        role,
        area,
        projectId: projectId || undefined,
        createdBy,
      });
      const created = await createUser(input);
      onCreated(created);
      // Reset form
      setEmail("");
      setName("");
      setRole("USER");
      setArea("administrativo");
      setProjectId("");
    } catch (e: any) {
      const msg =
        e?.status === 409
          ? "Este correo ya está registrado"
          : e?.message ?? "Error al crear el usuario";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="mb-1.5 block">Nombre completo *</Label>
          <div className="relative">
            <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Juan Pérez"
              required
              className="pl-8"
            />
          </div>
        </div>
        <div>
          <Label className="mb-1.5 block">Correo electrónico *</Label>
          <div className="relative">
            <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="juan@empresa.com"
              required
              className="pl-8"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="mb-1.5 block">Rol *</Label>
          <Select value={role} onValueChange={(v) => setRole(v as Role)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1.5 block">Área *</Label>
          <Select value={area} onValueChange={(v) => setArea(v as Area)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AREAS.map((a) => (
                <SelectItem key={a} value={a}>
                  {a === "tecnico"
                    ? "Técnico"
                    : a === "administrativo"
                      ? "Administrativo"
                      : "Ventas"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="mb-1.5 block">
          Proyecto específico (opcional)
        </Label>
        <Select
          value={projectId}
          onValueChange={(v) => setProjectId(v === "__none" ? "" : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Todos los proyectos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">Todos los proyectos</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.code} – {p.name.slice(0, 30)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mt-1 text-xs text-muted-foreground">
          Si defines un proyecto, el usuario solo verá datos de ese proyecto.
        </p>
      </div>

      {error && (
        <p className="text-xs text-destructive whitespace-pre-wrap font-mono bg-destructive/5 p-2 rounded">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="submit" disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <KeyRound className="mr-2 h-4 w-4" />
          )}
          Crear usuario (PENDING)
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        El usuario quedará en estado <strong>PENDING</strong>. Tras crearlo,
        podrás activarlo desde la tabla (botón "Activar").
      </p>
    </form>
  );
}
