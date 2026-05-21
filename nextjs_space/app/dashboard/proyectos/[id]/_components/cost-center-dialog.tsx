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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSuccess: () => void;
};

export default function CostCenterDialog({
  open,
  onOpenChange,
  projectId,
  onSuccess,
}: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    assignedBudget: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setIsLoading(true);

    try {
      const response = await fetch(`/api/proyectos/${projectId}/centros-costo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response?.ok) {
        const data = await response.json();
        throw new Error(data?.error || "Error al crear centro de costo");
      }

      setSuccess(true);
      setFormData({ name: "", assignedBudget: "" });
      setTimeout(() => {
        onSuccess();
      }, 1000);
    } catch (err: any) {
      setError(err?.message || "Error al crear centro de costo");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar Centro de Costo</DialogTitle>
          <DialogDescription>
            Crear un nuevo centro de costo para este proyecto
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Centro de costo creado exitosamente
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Nombre del Centro de Costo *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
              disabled={isLoading}
              placeholder="Ej: Estructura, Mampostería, Acabados"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="assignedBudget">Presupuesto Asignado (COP) *</Label>
            <Input
              id="assignedBudget"
              type="number"
              step="0.01"
              value={formData.assignedBudget}
              onChange={(e) =>
                setFormData({ ...formData, assignedBudget: e.target.value })
              }
              required
              disabled={isLoading}
              placeholder="0.00"
            />
          </div>

          <div className="flex gap-4">
            <Button
              type="submit"
              disabled={isLoading || success}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Crear Centro de Costo"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
