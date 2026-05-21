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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { CONTRACT_TYPE, PAYMENT_METHOD } from "@/lib/constants";

interface NuevoContratoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: any[];
  contractors: any[];
  onSuccess: () => void;
}

export function NuevoContratoDialog({
  open,
  onOpenChange,
  projects,
  contractors,
  onSuccess,
}: NuevoContratoDialogProps) {
  const [formData, setFormData] = useState({
    projectId: "",
    contractorId: "",
    contractType: "OBRA",
    paymentMethod: "POR_CORTES",
    startDate: "",
    endDate: "",
    contractObject: "",
    contractValue: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.projectId || !formData.contractorId || !formData.startDate || !formData.contractObject) {
      setError("Por favor complete todos los campos requeridos");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/contratos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          contractValue: formData.contractValue
            ? parseFloat(formData.contractValue)
            : 0,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Error al crear contrato");
      }

      // Limpiar formulario
      setFormData({
        projectId: "",
        contractorId: "",
        contractType: "OBRA",
        paymentMethod: "POR_CORTES",
        startDate: "",
        endDate: "",
        contractObject: "",
        contractValue: "",
      });

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo Contrato</DialogTitle>
          <DialogDescription>
            Crea un nuevo contrato de subcontratista. El contrato iniciará en
            estado &quot;Borrador&quot; hasta completar requisitos.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="projectId">Proyecto *</Label>
            <Select
              value={formData.projectId}
              onValueChange={(value) =>
                setFormData({ ...formData, projectId: value, contractorId: "" })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un proyecto" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contractorId">Contratista *</Label>
            <Select
              value={formData.contractorId}
              onValueChange={(value) =>
                setFormData({ ...formData, contractorId: value })
              }
              disabled={!formData.projectId}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    formData.projectId
                      ? "Selecciona un contratista"
                      : "Primero selecciona un proyecto"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {contractors.map((contractor) => (
                  <SelectItem key={contractor.id} value={contractor.id}>
                    {contractor.name} ({contractor.nit})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contractType">Tipo de Contrato</Label>
              <Select
                value={formData.contractType}
                onValueChange={(value) =>
                  setFormData({ ...formData, contractType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CONTRACT_TYPE).map(([key, value]) => (
                    <SelectItem key={key} value={key}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Forma de Pago</Label>
              <Select
                value={formData.paymentMethod}
                onValueChange={(value) =>
                  setFormData({ ...formData, paymentMethod: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_METHOD).map(([key, value]) => (
                    <SelectItem key={key} value={key}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Fecha Inicio *</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) =>
                  setFormData({ ...formData, startDate: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Fecha Fin</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contractValue">Valor del Contrato</Label>
            <Input
              id="contractValue"
              type="number"
              placeholder="0"
              value={formData.contractValue}
              onChange={(e) =>
                setFormData({ ...formData, contractValue: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contractObject">Objeto del Contrato *</Label>
            <Textarea
              id="contractObject"
              placeholder="Describe el alcance del contrato..."
              value={formData.contractObject}
              onChange={(e) =>
                setFormData({ ...formData, contractObject: e.target.value })
              }
              rows={4}
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                "Crear Contrato"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
