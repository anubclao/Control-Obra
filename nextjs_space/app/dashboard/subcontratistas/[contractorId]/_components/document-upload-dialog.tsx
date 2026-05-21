"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Upload, CheckCircle } from "lucide-react";
import { DOCUMENT_TYPE } from "@/lib/constants";

interface DocumentUploadDialogProps {
  open: boolean;
  onClose: () => void;
  contractorId: string;
  defaultDocType?: string | null;
}

export function DocumentUploadDialog({
  open,
  onClose,
  contractorId,
  defaultDocType,
}: DocumentUploadDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [formData, setFormData] = useState({
    type: "",
    expirationDate: "",
  });

  const ALLOWED_MIME_TYPES = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  const MAX_FILE_SIZE_MB = 10;
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

  // Pre-seleccionar tipo de documento cuando se edita
  useEffect(() => {
    if (defaultDocType && open) {
      setFormData((prev) => ({ ...prev, type: defaultDocType }));
    }
  }, [defaultDocType, open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e?.target?.files?.[0];
    setFileError("");
    setSelectedFile(null);

    if (!file) return;

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setFileError("Tipo de archivo no permitido. Solo se aceptan PDF, JPG, PNG, DOC o DOCX.");
      e.target.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFileError(`El archivo excede el tamaño máximo de ${MAX_FILE_SIZE_MB} MB.`);
      e.target.value = "";
      return;
    }

    setSelectedFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !formData.type) {
      setError("Por favor selecciona un tipo de documento y un archivo");
      return;
    }
    if (fileError) {
      setError(fileError);
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccess(false);

    try {
      // 1. Obtener URL presignada para subir a S3
      const presignedResponse = await fetch("/api/upload/presigned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: selectedFile.name,
          contentType: selectedFile.type,
          isPublic: false,
        }),
      });

      if (!presignedResponse?.ok) {
        throw new Error("Error al generar URL de carga");
      }

      const { uploadUrl, cloud_storage_path } = await presignedResponse.json();

      // 2. Subir archivo a S3
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": selectedFile.type,
        },
        body: selectedFile,
      });

      if (!uploadResponse?.ok) {
        throw new Error("Error al subir el archivo");
      }

      // 3. Registrar documento en la base de datos y subir a SharePoint
      const docResponse = await fetch(
        `/api/subcontratistas/${contractorId}/documents`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: formData.type,
            fileName: selectedFile.name,
            cloud_storage_path,
            isPublic: false,
            expirationDate: formData.expirationDate || null,
          }),
        }
      );

      if (!docResponse?.ok) {
        const data = await docResponse.json();
        throw new Error(data?.error || "Error al registrar el documento");
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
        // Reset form
        setFormData({ type: "", expirationDate: "" });
        setSelectedFile(null);
        setSuccess(false);
      }, 2000);
    } catch (err: any) {
      setError(err?.message || "Error al subir el documento");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setFormData({ type: "", expirationDate: "" });
      setSelectedFile(null);
      setError("");
      setFileError("");
      setSuccess(false);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{defaultDocType ? "Reemplazar Documento" : "Subir Documento"}</DialogTitle>
          {defaultDocType && (
            <DialogDescription>
              Se reemplazará el documento existente de tipo {DOCUMENT_TYPE[defaultDocType as keyof typeof DOCUMENT_TYPE]}.
            </DialogDescription>
          )}
        </DialogHeader>

        {success ? (
          <div className="py-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-900">Documento subido exitosamente</p>
            <p className="text-sm text-gray-600 mt-2">
              El documento también se ha subido a SharePoint
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="type">Tipo de Documento *</Label>
              <Select
                value={formData.type}
                onValueChange={(value) =>
                  setFormData({ ...formData, type: value })
                }
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el tipo" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DOCUMENT_TYPE).map(([key, value]) => (
                    <SelectItem key={key} value={key}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="file">Archivo *</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="file"
                  type="file"
                  onChange={handleFileChange}
                  disabled={isLoading}
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                />
              </div>
              {fileError && (
                <p className="text-sm text-red-600">{fileError}</p>
              )}
              {selectedFile && !fileError && (
                <p className="text-sm text-gray-600">
                  Archivo seleccionado: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
              <p className="text-xs text-gray-500">Formatos: PDF, JPG, PNG, DOC, DOCX. Máximo 10 MB.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expirationDate">Fecha de Vencimiento</Label>
              <Input
                id="expirationDate"
                type="date"
                value={formData.expirationDate}
                onChange={(e) =>
                  setFormData({ ...formData, expirationDate: e.target.value })
                }
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500">
                Si aplica, ingresa la fecha de vencimiento del documento (pólizas, certificados)
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={isLoading || !selectedFile || !formData.type}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 w-4 h-4" />
                    Subir Documento
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
              >
                Cancelar
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
