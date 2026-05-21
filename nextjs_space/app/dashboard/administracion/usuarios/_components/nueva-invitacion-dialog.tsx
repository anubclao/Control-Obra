"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Loader2, Copy, Check, Mail } from "lucide-react";
import { USER_ROLE } from "@/lib/constants";

interface NuevaInvitacionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: any[];
  onSuccess: () => void;
}

export function NuevaInvitacionDialog({
  open,
  onOpenChange,
  projects,
  onSuccess,
}: NuevaInvitacionDialogProps) {
  const [formData, setFormData] = useState({
    role: "",
    email: "",
    projectId: "",
    expiresInDays: "7",
    maxUses: "1",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.role) {
      setError("Selecciona un rol");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/invitaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: formData.role,
          email: formData.email || null,
          projectId: formData.projectId || null,
          expiresInDays: parseInt(formData.expiresInDays),
          maxUses: parseInt(formData.maxUses),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Error al crear invitación");
      }

      const data = await response.json();
      setGeneratedCode(data.code);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const copyCode = async () => {
    if (generatedCode) {
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    if (generatedCode) {
      onSuccess();
    }
    setGeneratedCode(null);
    setFormData({
      role: "",
      email: "",
      projectId: "",
      expiresInDays: "7",
      maxUses: "1",
    });
    onOpenChange(false);
  };

  // Roles disponibles para invitar (sin ADMIN)
  const availableRoles = Object.entries(USER_ROLE).filter(
    ([key]) => key !== "ADMIN" && key !== "USER"
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {generatedCode ? "Invitación Creada" : "Nueva Invitación"}
          </DialogTitle>
          <DialogDescription>
            {generatedCode
              ? "Comparte este código con el nuevo usuario"
              : "Genera un código de invitación para un nuevo usuario"}
          </DialogDescription>
        </DialogHeader>

        {generatedCode ? (
          <div className="space-y-6 py-4">
            <div className="text-center">
              <div className="bg-gray-100 rounded-lg p-6 mb-4">
                <code className="text-3xl font-mono font-bold tracking-widest">
                  {generatedCode}
                </code>
              </div>
              <Button onClick={copyCode} className="w-full">
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    ¡Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copiar Código
                  </>
                )}
              </Button>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-700">
                <Mail className="w-4 h-4 inline mr-2" />
                El usuario debe registrarse en <strong>/registro</strong> usando este código.
              </p>
            </div>
            <Button variant="outline" onClick={handleClose} className="w-full">
              Cerrar
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label>Rol *</Label>
              <Select
                value={formData.role}
                onValueChange={(value) =>
                  setFormData({ ...formData, role: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el rol" />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Email (opcional)</Label>
              <Input
                type="email"
                placeholder="usuario@empresa.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
              <p className="text-xs text-gray-500">
                Si se especifica, solo ese email podrá usar el código
              </p>
            </div>

            <div className="space-y-2">
              <Label>Proyecto (opcional)</Label>
              <Select
                value={formData.projectId}
                onValueChange={(value) =>
                  setFormData({ ...formData, projectId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos los proyectos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos los proyectos</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Expira en (días)</Label>
                <Select
                  value={formData.expiresInDays}
                  onValueChange={(value) =>
                    setFormData({ ...formData, expiresInDays: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 día</SelectItem>
                    <SelectItem value="3">3 días</SelectItem>
                    <SelectItem value="7">7 días</SelectItem>
                    <SelectItem value="14">14 días</SelectItem>
                    <SelectItem value="30">30 días</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Máximo de usos</Label>
                <Select
                  value={formData.maxUses}
                  onValueChange={(value) =>
                    setFormData({ ...formData, maxUses: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 uso</SelectItem>
                    <SelectItem value="5">5 usos</SelectItem>
                    <SelectItem value="10">10 usos</SelectItem>
                    <SelectItem value="50">50 usos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generando...
                  </>
                ) : (
                  "Generar Código"
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
