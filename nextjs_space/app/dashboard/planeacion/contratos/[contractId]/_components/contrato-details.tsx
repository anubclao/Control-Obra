"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Building2,
  Calendar,
  DollarSign,
  FileText,
  User,
  Phone,
  Mail,
  CheckCircle,
  Clock,
  Edit,
  Trash2,
  Loader2,
} from "lucide-react";
import { formatCurrency, formatDate, formatShortDate } from "@/lib/format";
import {
  CONTRACT_STATUS,
  CONTRACT_TYPE,
  PAYMENT_METHOD,
  CONTRACTOR_STATUS,
  CONTRACT_DOCUMENT_TYPE,
  REQUIRED_CONTRACT_DOCUMENTS,
} from "@/lib/constants";
import { ContractDocumentUploadDialog } from "./contract-document-upload-dialog";
import { ContractorBudgetSection } from "./contractor-budget-section";
import { ContractorProgressSection } from "./contractor-progress-section";

interface ContratoDetailsProps {
  contract: any;
  userRole: string;
}

export function ContratoDetails({ contract, userRole }: ContratoDetailsProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const router = useRouter();
  const isAdmin = userRole === "ADMIN";

  const normalizeDocumentType = (value?: string | null) => {
    if (!value) return "";
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toUpperCase();
  };

  const contractDocTypes = new Set(
    contract.documents.map((doc: any) => normalizeDocumentType(doc.documentType))
  );

  const missingRequiredDocs = REQUIRED_CONTRACT_DOCUMENTS.filter(
    (docType) => !contractDocTypes.has(docType)
  );

  const canEnableContract = missingRequiredDocs.length === 0;

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning"> = {
      DRAFT: "secondary",
      ENABLED: "success",
      SUSPENDED: "warning",
      CLOSED: "default",
      CANCELLED: "destructive",
    };
    return (
      <Badge variant={variants[status] || "default"} className="text-sm">
        {CONTRACT_STATUS[status as keyof typeof CONTRACT_STATUS] || status}
      </Badge>
    );
  };

  const handleStatusChange = async (newStatus: string) => {
    setStatusError("");

    if (newStatus === "ENABLED" && !canEnableContract) {
      setStatusError("Para habilitar el contrato debes cargar los documentos obligatorios: Contrato y Póliza.");
      return;
    }

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/contratos/${contract.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        router.refresh();
      } else {
        const data = await response.json();
        setStatusError(data?.error || "No se pudo actualizar el estado del contrato.");
      }
    } catch (error) {
      console.error("Error updating status:", error);
      setStatusError("Ocurrió un error actualizando el estado del contrato.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/contratos/${contract.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        router.push("/dashboard/planeacion/contratos");
      }
    } catch (error) {
      console.error("Error deleting contract:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/planeacion/contratos">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {contract.contractNumber}
              </h1>
              {getStatusBadge(contract.status)}
            </div>
            <p className="text-gray-600">{contract.contractor.name}</p>
          </div>
        </div>

        {isAdmin && (
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-3">
            <Select
              value={contract.status}
              onValueChange={handleStatusChange}
              disabled={isUpdating}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Cambiar estado" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CONTRACT_STATUS).map(([key, value]) => (
                  <SelectItem key={key} value={key} disabled={key === "ENABLED" && !canEnableContract}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="icon">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminar contrato</AlertDialogTitle>
                  <AlertDialogDescription>
                    ¿Está seguro de eliminar el contrato {contract.contractNumber}?
                    Esta acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-red-600 hover:bg-red-700"
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Eliminar"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            </div>
            {statusError && (
              <p className="max-w-[320px] text-right text-xs text-red-600">{statusError}</p>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Información del Contrato */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Información del Contrato
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Tipo de Contrato</p>
                  <p className="font-medium">
                    {CONTRACT_TYPE[contract.contractType as keyof typeof CONTRACT_TYPE]}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Forma de Pago</p>
                  <p className="font-medium">
                    {PAYMENT_METHOD[contract.paymentMethod as keyof typeof PAYMENT_METHOD]}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Fecha Inicio</p>
                  <p className="font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    {formatDate(contract.startDate)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Fecha Fin</p>
                  <p className="font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    {contract.endDate
                      ? formatDate(contract.endDate)
                      : "No definida"}
                  </p>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-sm text-gray-500 mb-2">Valor del Contrato</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(contract.contractValue)}
                </p>
              </div>

              <Separator />

              <div>
                <p className="text-sm text-gray-500 mb-2">Objeto del Contrato</p>
                <p className="text-gray-700 whitespace-pre-wrap">
                  {contract.contractObject}
                </p>
              </div>

              {contract.observations && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Observaciones</p>
                    <p className="text-gray-700 whitespace-pre-wrap">
                      {contract.observations}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Documentos */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Documentos del Contrato
                </CardTitle>
                {isAdmin && (
                  <Button
                    size="sm"
                    onClick={() => setUploadDialogOpen(true)}
                    className="gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    Cargar documento
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {missingRequiredDocs.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="font-medium">Documentos obligatorios pendientes</p>
                  <p className="mt-1">
                    Debes cargar {missingRequiredDocs.map((type) => CONTRACT_DOCUMENT_TYPE[type as keyof typeof CONTRACT_DOCUMENT_TYPE]).join(" y ")} para habilitar el contrato y poder asignar presupuesto al subcontratista.
                  </p>
                </div>
              )}

              {contract.documents.length > 0 ? (
                <div className="space-y-3">
                  {contract.documents.map((doc: any) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-blue-500" />
                        <div>
                          <p className="font-medium">{doc.fileName}</p>
                          <p className="text-xs text-gray-500">
                            {CONTRACT_DOCUMENT_TYPE[normalizeDocumentType(doc.documentType) as keyof typeof CONTRACT_DOCUMENT_TYPE] || doc.documentType || "Documento"} • Subido{" "}
                            {formatShortDate(doc.uploadedAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>No hay documentos adjuntos</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Presupuesto del Contratista */}
          <ContractorBudgetSection
            contractId={contract.id}
            contractStatus={contract.status}
          />

          {/* Avances del Contratista */}
          <ContractorProgressSection
            contractId={contract.id}
            contractStatus={contract.status}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Proyecto */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Proyecto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="font-medium">{contract.project.name}</p>
                {contract.project.code && (
                  <p className="text-sm text-gray-500">{contract.project.code}</p>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-500">Cliente</p>
                <p className="font-medium">{contract.project.client}</p>
              </div>
              {contract.project.budget && (
                <div>
                  <p className="text-sm text-gray-500">Presupuesto</p>
                  <p className="font-medium">
                    {formatCurrency(contract.project.budget.totalPC)}
                  </p>
                </div>
              )}
              <Button asChild variant="outline" size="sm" className="w-full mt-2">
                <Link href={`/dashboard/proyectos/${contract.project.id}`}>
                  Ver Proyecto
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Contratista */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-5 h-5" />
                Contratista
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-medium">{contract.contractor.name}</p>
                <Badge
                  variant={
                    contract.contractor.status === "COMPLETE"
                      ? "success"
                      : contract.contractor.status === "EXPIRED"
                      ? "destructive"
                      : "warning"
                  }
                >
                  {CONTRACTOR_STATUS[contract.contractor.status as keyof typeof CONTRACTOR_STATUS]}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">NIT</p>
                <p className="font-mono">{contract.contractor.nit}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Contacto</p>
                <p>{contract.contractor.contact}</p>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-gray-400" />
                <a
                  href={`mailto:${contract.contractor.email}`}
                  className="text-blue-600 hover:underline"
                >
                  {contract.contractor.email}
                </a>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-gray-400" />
                <a
                  href={`tel:${contract.contractor.phone}`}
                  className="text-blue-600 hover:underline"
                >
                  {contract.contractor.phone}
                </a>
              </div>
              <Button asChild variant="outline" size="sm" className="w-full mt-2">
                <Link href={`/dashboard/subcontratistas/${contract.contractor.id}`}>
                  Ver Subcontratista
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Fechas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Registro
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Creado</span>
                <span>{formatShortDate(contract.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Actualizado</span>
                <span>{formatShortDate(contract.updatedAt)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <ContractDocumentUploadDialog
        open={uploadDialogOpen}
        onOpenChange={(open) => {
          setUploadDialogOpen(open);
          if (!open) {
            router.refresh();
          }
        }}
        contractId={contract.id}
      />
    </div>
  );
}
