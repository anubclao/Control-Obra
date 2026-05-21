"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ArrowLeft, Loader2, Upload, X } from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Project = { id: string; name: string; costCenters: { id: string; name: string }[] };
type Contractor = { id: string; name: string };

export default function NuevoCortePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [costCenters, setCostCenters] = useState<{ id: string; name: string }[]>([]);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  
  const [formData, setFormData] = useState({
    projectId: "",
    contractorId: "",
    costCenterId: "",
    periodStart: "",
    periodEnd: "",
    requestedAmount: "",
    description: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [projectsRes, contractorsRes] = await Promise.all([
        fetch("/api/proyectos"),
        fetch("/api/subcontratistas"),
      ]);

      if (projectsRes?.ok) {
        const projectsData = await projectsRes.json();
        setProjects(projectsData ?? []);
      }

      if (contractorsRes?.ok) {
        const contractorsData = await contractorsRes.json();
        setContractors(contractorsData ?? []);
      }
    } catch (err) {
      console.error("Error cargando datos:", err);
    }
  };

  const handleProjectChange = (projectId: string) => {
    setSelectedProject(projectId);
    const project = projects?.find?.((p) => p?.id === projectId);
    const projectCostCenters = project?.costCenters ?? [];
    const autoCostCenterId = projectCostCenters?.[0]?.id ?? "";

    setCostCenters(projectCostCenters);
    setFormData({ ...formData, projectId, costCenterId: autoCostCenterId });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e?.target?.files) {
      const files = Array.from(e?.target?.files ?? []);
      setSelectedFiles([...(selectedFiles ?? []), ...files]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(selectedFiles?.filter?.((_, i) => i !== index) ?? []);
  };

  const uploadDocuments = async (workCutId: string) => {
    if (!selectedFiles || selectedFiles?.length === 0) return;

    setUploadingDocs(true);

    try {
      for (const file of selectedFiles) {
        // 1. Obtener URL presignada
        const presignedRes = await fetch("/api/upload/presigned", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file?.name,
            contentType: file?.type,
            isPublic: false,
          }),
        });

        if (!presignedRes?.ok) throw new Error("Error obteniendo URL de subida");

        const { uploadUrl, cloud_storage_path } = await presignedRes.json();

        // 2. Subir archivo a S3
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": file?.type ?? "application/octet-stream",
          },
          body: file,
        });

        if (!uploadRes?.ok) throw new Error("Error subiendo archivo a S3");

        // 3. Registrar documento en la base de datos y SharePoint
        const docRes = await fetch(`/api/cortes/${workCutId}/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file?.name,
            cloud_storage_path,
            isPublic: false,
          }),
        });

        if (!docRes?.ok) throw new Error("Error registrando documento");
      }
    } catch (err) {
      console.error("Error subiendo documentos:", err);
    } finally {
      setUploadingDocs(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/cortes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response?.ok) {
        const data = await response.json();
        throw new Error(data?.error || "Error al crear corte");
      }

      const workCut = await response.json();

      // Subir documentos si hay
      if (selectedFiles?.length > 0) {
        await uploadDocuments(workCut?.id);
      }

      router.push(`/dashboard/cortes/${workCut?.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Error al crear corte");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/cortes">
          <Button variant="outline" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Nuevo Corte de Obra</h1>
          <p className="text-gray-600 mt-1">Registrar un nuevo corte de obra</p>
        </div>
      </div>

      {/* Formulario */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Información del Corte</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="projectId">Proyecto *</Label>
                <Select
                  value={formData.projectId}
                  onValueChange={handleProjectChange}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar proyecto" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects?.map?.((project) => (
                      <SelectItem key={project?.id} value={project?.id ?? ""}>
                        {project?.name}
                      </SelectItem>
                    )) ?? []}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contractorId">Subcontratista *</Label>
                <Select
                  value={formData.contractorId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, contractorId: value })
                  }
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar subcontratista" />
                  </SelectTrigger>
                  <SelectContent>
                    {contractors?.map?.((contractor) => (
                      <SelectItem key={contractor?.id} value={contractor?.id ?? ""}>
                        {contractor?.name}
                      </SelectItem>
                    )) ?? []}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="requestedAmount">Monto Solicitado (COP) *</Label>
                <Input
                  id="requestedAmount"
                  type="number"
                  step="0.01"
                  value={formData.requestedAmount}
                  onChange={(e) =>
                    setFormData({ ...formData, requestedAmount: e.target.value })
                  }
                  required
                  disabled={isLoading}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="periodStart">Fecha Inicio Período *</Label>
                <Input
                  id="periodStart"
                  type="date"
                  value={formData.periodStart}
                  onChange={(e) =>
                    setFormData({ ...formData, periodStart: e.target.value })
                  }
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="periodEnd">Fecha Fin Período *</Label>
                <Input
                  id="periodEnd"
                  type="date"
                  value={formData.periodEnd}
                  onChange={(e) =>
                    setFormData({ ...formData, periodEnd: e.target.value })
                  }
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción de Trabajos *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                required
                disabled={isLoading}
                placeholder="Describe los trabajos realizados en este período..."
                rows={4}
              />
            </div>

            {/* Documentos Soporte */}
            <div className="space-y-2">
              <Label>Documentos Soporte (Opcional)</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-600 mb-2">
                  Seleccione archivos PDF, imágenes o Excel
                </p>
                <Input
                  type="file"
                  onChange={handleFileChange}
                  multiple
                  disabled={isLoading}
                  className="max-w-xs mx-auto"
                  accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls"
                />
              </div>

              {selectedFiles?.length > 0 && (
                <div className="space-y-2 mt-4">
                  <p className="text-sm font-medium">Archivos seleccionados:</p>
                  {selectedFiles?.map?.((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 border rounded"
                    >
                      <span className="text-sm truncate">{file?.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        disabled={isLoading}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )) ?? []}
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <Button
                type="submit"
                disabled={isLoading || uploadingDocs}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isLoading || uploadingDocs ? (
                  <>
                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                    {uploadingDocs ? "Subiendo documentos..." : "Guardando..."}
                  </>
                ) : (
                  "Crear Corte"
                )}
              </Button>
              <Link href="/dashboard/cortes">
                <Button type="button" variant="outline" disabled={isLoading}>
                  Cancelar
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
