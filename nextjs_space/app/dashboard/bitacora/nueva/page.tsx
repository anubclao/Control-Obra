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
import { ArrowLeft, Loader2, Upload, X, Image as ImageIcon } from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Project = { id: string; name: string };
type Contractor = { id: string; name: string };

export default function NuevaBitacoraPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<
    { file: File; description: string }[]
  >([]);

  const [formData, setFormData] = useState({
    projectId: "",
    date: new Date().toISOString().split("T")?.[0] ?? "",
    activities: "",
    weather: "Soleado",
    personnel: "",
    observations: "",
    contractorId: "",
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

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e?.target?.files) {
      const files = Array.from(e?.target?.files ?? []);
      const newPhotos = files?.map?.((file) => ({ file, description: "" })) ?? [];
      setSelectedPhotos([...(selectedPhotos ?? []), ...newPhotos]);
    }
  };

  const removePhoto = (index: number) => {
    setSelectedPhotos(selectedPhotos?.filter?.((_, i) => i !== index) ?? []);
  };

  const updatePhotoDescription = (index: number, description: string) => {
    const updated = [...(selectedPhotos ?? [])];
    if (updated?.[index]) {
      updated[index] = { ...updated[index], description };
      setSelectedPhotos(updated);
    }
  };

  const uploadPhotos = async (workLogId: string) => {
    if (!selectedPhotos || selectedPhotos?.length === 0) return;

    setUploadingPhotos(true);

    try {
      for (const photo of selectedPhotos) {
        // 1. Obtener URL presignada
        const presignedRes = await fetch("/api/upload/presigned", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: photo?.file?.name,
            contentType: photo?.file?.type,
            isPublic: false,
          }),
        });

        if (!presignedRes?.ok) throw new Error("Error obteniendo URL de subida");

        const { uploadUrl, cloud_storage_path } = await presignedRes.json();

        // 2. Subir archivo a S3
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": photo?.file?.type ?? "image/jpeg",
          },
          body: photo?.file,
        });

        if (!uploadRes?.ok) throw new Error("Error subiendo foto a S3");

        // 3. Registrar foto en la base de datos y SharePoint
        const photoRes = await fetch(`/api/bitacora/${workLogId}/photos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: photo?.file?.name,
            cloud_storage_path,
            isPublic: false,
            description: photo?.description || null,
          }),
        });

        if (!photoRes?.ok) throw new Error("Error registrando foto");
      }
    } catch (err) {
      console.error("Error subiendo fotos:", err);
    } finally {
      setUploadingPhotos(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/bitacora", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          contractorId: formData.contractorId === "none" ? null : formData.contractorId,
        }),
      });

      if (!response?.ok) {
        const data = await response.json();
        throw new Error(data?.error || "Error al crear entrada de bitácora");
      }

      const workLog = await response.json();

      // Subir fotos si hay
      if (selectedPhotos?.length > 0) {
        await uploadPhotos(workLog?.id);
      }

      router.push(`/dashboard/bitacora/${workLog?.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Error al crear entrada");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/bitacora">
          <Button variant="outline" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Nueva Entrada de Bitácora</h1>
          <p className="text-gray-600 mt-1">Registrar actividades del día</p>
        </div>
      </div>

      {/* Formulario */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Información de la Entrada</CardTitle>
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
                  onValueChange={(value) =>
                    setFormData({ ...formData, projectId: value })
                  }
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
                <Label htmlFor="date">Fecha *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData({ ...formData, date: e.target.value })
                  }
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="weather">Clima *</Label>
                <Select
                  value={formData.weather}
                  onValueChange={(value) =>
                    setFormData({ ...formData, weather: value })
                  }
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Soleado">☀️ Soleado</SelectItem>
                    <SelectItem value="Nublado">☁️ Nublado</SelectItem>
                    <SelectItem value="Lluvioso">🌧️ Lluvioso</SelectItem>
                    <SelectItem value="Parcialmente Nublado">
                      ⛅ Parcialmente Nublado
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="personnel">Personal Presente *</Label>
                <Input
                  id="personnel"
                  value={formData.personnel}
                  onChange={(e) =>
                    setFormData({ ...formData, personnel: e.target.value })
                  }
                  required
                  disabled={isLoading}
                  placeholder="Ej: 5 albañiles, 2 ayudantes, 1 ingeniero"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="contractorId">Subcontratista (Opcional)</Label>
                <Select
                  value={formData.contractorId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, contractorId: value })
                  }
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Ninguno" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ninguno</SelectItem>
                    {contractors?.map?.((contractor) => (
                      <SelectItem key={contractor?.id} value={contractor?.id ?? ""}>
                        {contractor?.name}
                      </SelectItem>
                    )) ?? []}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="activities">Actividades Realizadas *</Label>
              <Textarea
                id="activities"
                value={formData.activities}
                onChange={(e) =>
                  setFormData({ ...formData, activities: e.target.value })
                }
                required
                disabled={isLoading}
                placeholder="Describe las actividades realizadas durante el día..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="observations">Observaciones (Opcional)</Label>
              <Textarea
                id="observations"
                value={formData.observations}
                onChange={(e) =>
                  setFormData({ ...formData, observations: e.target.value })
                }
                disabled={isLoading}
                placeholder="Notas adicionales, incidentes, o detalles relevantes..."
                rows={3}
              />
            </div>

            {/* Fotos */}
            <div className="space-y-2">
              <Label>Fotos (Opcional)</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <ImageIcon className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-600 mb-2">
                  Seleccione múltiples fotos del progreso de obra
                </p>
                <Input
                  type="file"
                  onChange={handlePhotoChange}
                  multiple
                  disabled={isLoading}
                  className="max-w-xs mx-auto"
                  accept="image/*"
                />
              </div>

              {selectedPhotos?.length > 0 && (
                <div className="space-y-3 mt-4">
                  <p className="text-sm font-medium">
                    Fotos seleccionadas ({selectedPhotos?.length}):
                  </p>
                  {selectedPhotos?.map?.((photo, index) => (
                    <div
                      key={index}
                      className="p-3 border rounded flex items-start gap-3"
                    >
                      <div className="flex-shrink-0 w-16 h-16 bg-gray-100 rounded flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-gray-400" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <p className="text-sm font-medium truncate">
                          {photo?.file?.name}
                        </p>
                        <Input
                          placeholder="Descripción de la foto (opcional)"
                          value={photo?.description}
                          onChange={(e) =>
                            updatePhotoDescription(index, e?.target?.value ?? "")
                          }
                          disabled={isLoading}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removePhoto(index)}
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
                disabled={isLoading || uploadingPhotos}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isLoading || uploadingPhotos ? (
                  <>
                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                    {uploadingPhotos ? "Subiendo fotos..." : "Guardando..."}
                  </>
                ) : (
                  "Crear Entrada"
                )}
              </Button>
              <Link href="/dashboard/bitacora">
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
