"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Download,
  Loader2,
  Eye,
  Clock,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { WORK_CUT_STATUS, DOCUMENT_TYPE } from "@/lib/constants";

type WorkCutData = any;
type ValidationData = {
  documentationOk: boolean;
  missingDocs: string[];
  expiredDocs: { type: string; expirationDate: Date | null }[];
  budgetOk: boolean;
  availableBudget: number;
};

type Props = {
  workCut: WorkCutData;
  validation: ValidationData;
  userRole: string;
};

export default function CorteDetailsClient({
  workCut,
  validation,
  userRole,
}: Props) {
  const router = useRouter();
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [error, setError] = useState("");

  const canApprove = validation?.documentationOk && validation?.budgetOk;
  const isPending = workCut?.status === "PENDING" || workCut?.status === "IN_REVIEW";

  const getStatusBadge = (status: string) => {
    const statusMap: Record<
      string,
      { variant: any; label: string; icon: any }
    > = {
      PENDING: {
        variant: "secondary",
        label: WORK_CUT_STATUS.PENDING,
        icon: Clock,
      },
      IN_REVIEW: {
        variant: "default",
        label: WORK_CUT_STATUS.IN_REVIEW,
        icon: Eye,
      },
      APPROVED: {
        variant: "success",
        label: WORK_CUT_STATUS.APPROVED,
        icon: CheckCircle,
      },
      REJECTED: {
        variant: "destructive",
        label: WORK_CUT_STATUS.REJECTED,
        icon: XCircle,
      },
    };
    const config = statusMap?.[status] ?? {
      variant: "secondary",
      label: status,
      icon: FileText,
    };
    const Icon = config?.icon;
    return (
      <Badge variant={config?.variant} className="text-base py-1 px-3">
        <Icon className="w-4 h-4 mr-2" />
        {config?.label}
      </Badge>
    );
  };

  const handleApprove = async () => {
    setError("");
    setIsApproving(true);

    try {
      const response = await fetch(`/api/cortes/${workCut?.id}/approve`, {
        method: "POST",
      });

      if (!response?.ok) {
        const data = await response.json();
        throw new Error(data?.error || "Error al aprobar corte");
      }

      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Error al aprobar corte");
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason?.trim?.()) {
      setError("Debe proporcionar una razón para el rechazo");
      return;
    }

    setError("");
    setIsRejecting(true);

    try {
      const response = await fetch(`/api/cortes/${workCut?.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectionReason }),
      });

      if (!response?.ok) {
        const data = await response.json();
        throw new Error(data?.error || "Error al rechazar corte");
      }

      setShowRejectDialog(false);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Error al rechazar corte");
    } finally {
      setIsRejecting(false);
    }
  };

  const handleSendToReview = async () => {
    try {
      const response = await fetch(`/api/cortes/${workCut?.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "IN_REVIEW" }),
      });

      if (response?.ok) {
        router.refresh();
      }
    } catch (err) {
      console.error("Error enviando a revisión:", err);
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
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">
              Corte #{workCut?.cutNumber}
            </h1>
            {getStatusBadge(workCut?.status ?? "")}
          </div>
          <p className="text-gray-600 mt-1">Proyecto: {workCut?.project?.name}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600">Monto Solicitado</p>
          <p className="text-3xl font-bold text-gray-900">
            {formatCurrency(workCut?.requestedAmount ?? 0)}
          </p>
        </div>
      </div>

      {/* VALIDACIÓN CRÍTICA DE DOCUMENTACIÓN */}
      {isPending && userRole === "ADMIN" && (
        <>
          {/* Validación OK */}
          {canApprove && (
            <Alert className="bg-green-50 border-green-300">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <AlertDescription className="text-green-800 font-medium">
                ✅ Documentación OK - El subcontratista tiene toda la documentación
                completa y vigente. Puede proceder con la aprobación del corte.
              </AlertDescription>
            </Alert>
          )}

          {/* Validación FALLA - Documentación */}
          {!validation?.documentationOk && (
            <Alert variant="destructive" className="border-2">
              <AlertTriangle className="w-5 h-5" />
              <div>
                <AlertDescription className="font-bold text-lg mb-2">
                  ❌ NO SE PUEDE APROBAR ESTE CORTE
                </AlertDescription>
                <AlertDescription>
                  El subcontratista tiene problemas con su documentación:
                </AlertDescription>

                {validation?.missingDocs?.length > 0 && (
                  <div className="mt-3">
                    <p className="font-semibold mb-2">Documentos Faltantes:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {validation?.missingDocs?.map?.((docType) => (
                        <li key={docType} className="text-sm">
                          {DOCUMENT_TYPE[docType as keyof typeof DOCUMENT_TYPE]}
                        </li>
                      )) ?? []}
                    </ul>
                  </div>
                )}

                {validation?.expiredDocs?.length > 0 && (
                  <div className="mt-3">
                    <p className="font-semibold mb-2">Documentos Vencidos:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {validation?.expiredDocs?.map?.((doc) => (
                        <li key={doc?.type} className="text-sm">
                          {DOCUMENT_TYPE[doc?.type as keyof typeof DOCUMENT_TYPE]} -{" "}
                          venció el {doc?.expirationDate ? formatDate(doc?.expirationDate) : "N/A"}
                        </li>
                      )) ?? []}
                    </ul>
                  </div>
                )}

                <div className="mt-4">
                  <Link href={`/dashboard/subcontratistas/${workCut?.contractor?.id}`}>
                    <Button
                      variant="outline"
                      className="bg-white hover:bg-red-50 border-white"
                    >
                      Ir al Perfil del Subcontratista
                    </Button>
                  </Link>
                </div>
              </div>
            </Alert>
          )}

          {/* Validación FALLA - Presupuesto */}
          {!validation?.budgetOk && (
            <Alert variant="destructive" className="border-2">
              <AlertTriangle className="w-5 h-5" />
              <div>
                <AlertDescription className="font-bold text-lg mb-2">
                  ❌ PRESUPUESTO INSUFICIENTE
                </AlertDescription>
                <AlertDescription>
                  El monto del corte ({formatCurrency(workCut?.requestedAmount ?? 0)})
                  excede el presupuesto disponible del centro de costo (
                  {formatCurrency(validation?.availableBudget ?? 0)}).
                </AlertDescription>
              </div>
            </Alert>
          )}
        </>
      )}

      {/* Error de acciones */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Información del Corte */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Información del Corte</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Subcontratista</p>
              <p className="font-semibold">{workCut?.contractor?.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Centro de Costo</p>
              <p className="font-semibold">{workCut?.costCenter?.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Período</p>
              <p className="font-semibold">
                {formatDate(workCut?.periodStart)} - {formatDate(workCut?.periodEnd)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Creado el</p>
              <p className="font-semibold">{formatDate(workCut?.createdAt)}</p>
            </div>
            {workCut?.status === "APPROVED" && (
              <>
                <div>
                  <p className="text-sm text-gray-600">Aprobado por</p>
                  <p className="font-semibold">{workCut?.approvedBy?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Fecha de Aprobación</p>
                  <p className="font-semibold">{formatDate(workCut?.approvedAt)}</p>
                </div>
              </>
            )}
          </div>

          <Separator className="my-4" />

          <div>
            <p className="text-sm text-gray-600 mb-2">Descripción de Trabajos</p>
            <p className="text-gray-900 whitespace-pre-wrap">
              {workCut?.description}
            </p>
          </div>

          {workCut?.status === "REJECTED" && workCut?.rejectionReason && (
            <>
              <Separator className="my-4" />
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="text-sm font-semibold text-red-900 mb-2">
                  Razón del Rechazo:
                </p>
                <p className="text-red-800">{workCut?.rejectionReason}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Documentos del Corte */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Documentos del Corte ({workCut?.documents?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {workCut?.documents?.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              No hay documentos adjuntos
            </p>
          ) : (
            <div className="space-y-2">
              {workCut?.documents?.map?.((doc: any) => (
                <div key={doc?.id} className="p-3 border rounded flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="font-medium">{doc?.fileName}</p>
                      <p className="text-xs text-gray-500">
                        Subido el {formatDate(doc?.uploadedAt)}
                      </p>
                      {doc?.description && (
                        <p className="text-xs text-gray-600 mt-1">{doc?.description}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/download?path=${encodeURIComponent(doc?.cloudStoragePath)}&isPublic=${doc?.isPublic}&format=json`);
                        if (res.ok) {
                          const data = await res.json();
                          window.open(data.url, "_blank", "noopener,noreferrer");
                        }
                      } catch (err) {
                        console.error("Error descargando:", err);
                      }
                    }}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              )) ?? []}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Botones de Acción (Solo para Admin) */}
      {userRole === "ADMIN" && isPending && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Acciones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 flex-wrap">
              {/* Botón Aprobar - Solo si pasa validaciones */}
              <Button
                onClick={handleApprove}
                disabled={!canApprove || isApproving}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300"
              >
                {isApproving ? (
                  <>
                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                    Aprobando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Aprobar Corte
                  </>
                )}
              </Button>

              {/* Botón Enviar a Revisión */}
              {workCut?.status === "PENDING" && (
                <Button
                  onClick={handleSendToReview}
                  variant="outline"
                  className="border-blue-600 text-blue-600 hover:bg-blue-50"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Enviar a Revisión
                </Button>
              )}

              {/* Botón Rechazar */}
              <Button
                onClick={() => setShowRejectDialog(!showRejectDialog)}
                variant="outline"
                className="border-red-600 text-red-600 hover:bg-red-50"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Rechazar Corte
              </Button>
            </div>

            {/* Diálogo de Rechazo */}
            {showRejectDialog && (
              <div className="mt-4 p-4 border rounded-lg bg-gray-50">
                <p className="font-semibold mb-2">Razón del Rechazo</p>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e?.target?.value ?? "")}
                  placeholder="Especifique la razón del rechazo..."
                  rows={3}
                  className="mb-3"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleReject}
                    disabled={isRejecting}
                    variant="destructive"
                  >
                    {isRejecting ? (
                      <>
                        <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                        Rechazando...
                      </>
                    ) : (
                      "Confirmar Rechazo"
                    )}
                  </Button>
                  <Button
                    onClick={() => setShowRejectDialog(false)}
                    variant="outline"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {!canApprove && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-sm text-yellow-800">
                  ⚠️ El botón de aprobar está deshabilitado porque no se cumplen
                  todas las validaciones requeridas.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
