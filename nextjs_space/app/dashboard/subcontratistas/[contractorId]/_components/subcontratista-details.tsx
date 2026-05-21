"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Upload,
  AlertTriangle,
  FileText,
  CheckCircle,
  XCircle,
  Calendar,
  Building2,
  MapPin,
  User,
  DollarSign,
  Users,
  Phone,
  Mail,
  Globe,
  Pencil,
  Trash2,
  Loader2,
  Eye,
  Download,
} from "lucide-react";
import Link from "next/link";
import { CONTRACTOR_STATUS, DOCUMENT_TYPE } from "@/lib/constants";
import { formatDate, formatCurrency } from "@/lib/format";
import { DocumentUploadDialog } from "./document-upload-dialog";
import { EditContractorDialog } from "./edit-contractor-dialog";

interface SubcontratistaDetailsProps {
  contractor: any;
  documentAlerts: any[];
  userRole: string;
}

export function SubcontratistaDetails({
  contractor,
  documentAlerts,
  userRole,
}: SubcontratistaDetailsProps) {
  const router = useRouter();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingDocType, setEditingDocType] = useState<string | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [deletingDoc, setDeletingDoc] = useState(false);
  const isAdmin = userRole === "ADMIN";

  const handleDeleteDocument = async () => {
    if (!deletingDocId) return;
    setDeletingDoc(true);
    try {
      const response = await fetch(
        `/api/subcontratistas/${contractor.id}/documents/${deletingDocId}`,
        { method: "DELETE" }
      );
      if (response.ok) {
        router.refresh();
      }
    } catch (error) {
      console.error("Error al eliminar documento:", error);
    } finally {
      setDeletingDoc(false);
      setDeletingDocId(null);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/subcontratistas/${contractor.id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        router.push("/dashboard/subcontratistas");
      }
    } catch (error) {
      console.error("Error al eliminar:", error);
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETE":
        return <CheckCircle className="w-5 h-5" />;
      case "EXPIRED":
        return <AlertTriangle className="w-5 h-5" />;
      case "INCOMPLETE":
        return <XCircle className="w-5 h-5" />;
      default:
        return null;
    }
  };

  const getStatusVariant = (status: string): "success" | "destructive" | "warning" => {
    switch (status) {
      case "COMPLETE":
        return "success";
      case "EXPIRED":
        return "destructive";
      case "INCOMPLETE":
        return "warning";
      default:
        return "warning";
    }
  };

  // Documentos requeridos actualizados
  const requiredDocs = ["CEDULA", "RUT", "CAMARA_COMERCIO", "CERTIFICADO_BANCARIO"];
  const existingDocs = contractor.documents.map((d: any) => d.type);
  const missingDocs = requiredDocs.filter((type) => !existingDocs.includes(type));

  const expiredDocs = documentAlerts.filter((d) => d.isExpired);
  const expiringSoonDocs = documentAlerts.filter((d) => d.isExpiringSoon);

  // Referencias comerciales
  const references = [
    { name: contractor.ref1Name, company: contractor.ref1Company, phone: contractor.ref1Phone, email: contractor.ref1Email },
    { name: contractor.ref2Name, company: contractor.ref2Company, phone: contractor.ref2Phone, email: contractor.ref2Email },
    { name: contractor.ref3Name, company: contractor.ref3Company, phone: contractor.ref3Phone, email: contractor.ref3Email },
  ].filter(ref => ref.name || ref.company);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/subcontratistas">
            <Button variant="outline" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-bold text-gray-900">
                {contractor.name}
              </h1>
              <Badge
                variant={getStatusVariant(contractor.status)}
                className="gap-1"
              >
                {getStatusIcon(contractor.status)}
                {CONTRACTOR_STATUS[contractor.status as keyof typeof CONTRACTOR_STATUS]}
              </Badge>
            </div>
            <p className="text-gray-600">NIT: {contractor.nit}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setEditDialogOpen(true)}
            className="gap-2"
          >
            <Pencil className="w-4 h-4" />
            Editar
          </Button>
          {isAdmin && (
            <>
              <Button
                onClick={() => setUploadDialogOpen(true)}
                className="gap-2 bg-blue-600 hover:bg-blue-700"
              >
                <Upload className="w-4 h-4" />
                Subir Documento
              </Button>
              <Button
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
                className="gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Alertas */}
      {(expiredDocs.length > 0 || expiringSoonDocs.length > 0 || missingDocs.length > 0) && (
        <div className="space-y-3">
          {expiredDocs.length > 0 && (
            <Card className="shadow-md border-red-200">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-red-900 mb-1">
                      Documentos Vencidos
                    </p>
                    <ul className="text-sm text-red-700 space-y-1">
                      {expiredDocs.map((doc) => (
                        <li key={doc.id}>
                          {DOCUMENT_TYPE[doc.type as keyof typeof DOCUMENT_TYPE]} -
                          Venció hace {Math.abs(doc.daysUntil)} días
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {expiringSoonDocs.length > 0 && (
            <Card className="shadow-md border-yellow-200">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-yellow-900 mb-1">
                      Documentos Próximos a Vencer
                    </p>
                    <ul className="text-sm text-yellow-700 space-y-1">
                      {expiringSoonDocs.map((doc) => (
                        <li key={doc.id}>
                          {DOCUMENT_TYPE[doc.type as keyof typeof DOCUMENT_TYPE]} -
                          Vence en {doc.daysUntil} días
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {missingDocs.length > 0 && (
            <Card className="shadow-md border-orange-200">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-orange-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-orange-900 mb-1">
                      Documentos Faltantes
                    </p>
                    <ul className="text-sm text-orange-700 space-y-1">
                      {missingDocs.map((type) => (
                        <li key={type}>
                          {DOCUMENT_TYPE[type as keyof typeof DOCUMENT_TYPE]}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Primera fila: Información básica y Documentos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Información de Contacto */}
        <Card className="shadow-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              <CardTitle>Información de Contacto</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">Persona de Contacto</p>
              <p className="font-medium text-gray-900">{contractor.contact}</p>
            </div>
            <Separator />
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">Correo Electrónico</p>
                <p className="font-medium text-gray-900">{contractor.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">Teléfono</p>
                <p className="font-medium text-gray-900">{contractor.phone}</p>
              </div>
            </div>
            {contractor.website && (
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-600">Sitio Web</p>
                  <a href={contractor.website} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline">
                    {contractor.website}
                  </a>
                </div>
              </div>
            )}
            <Separator />
            <div>
              <p className="text-sm text-gray-600">Cortes Registrados</p>
              <p className="font-medium text-gray-900">
                {contractor.workCuts?.length ?? 0}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Documentos */}
        <Card className="shadow-md lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-green-600" />
              <CardTitle>Documentación</CardTitle>
            </div>
            <CardDescription>Cédula, RUT, Cámara de Comercio, Certificado Bancario</CardDescription>
          </CardHeader>
          <CardContent>
            {contractor.documents.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">No hay documentos cargados</p>
                {isAdmin && (
                  <Button
                    onClick={() => setUploadDialogOpen(true)}
                    className="mt-4"
                    variant="outline"
                  >
                    Subir Primer Documento
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {contractor.documents.map((doc: any) => {
                  const alert = documentAlerts.find((a) => a.id === doc.id);
                  const hasAlert = alert && (alert.isExpired || alert.isExpiringSoon);

                  return (
                    <div
                      key={doc.id}
                      className={`p-4 rounded-lg border ${
                        hasAlert
                          ? alert.isExpired
                            ? "border-red-200 bg-red-50"
                            : "border-yellow-200 bg-yellow-50"
                          : "border-gray-200 bg-gray-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <FileText className="w-4 h-4 text-gray-600 flex-shrink-0" />
                            <p className="font-medium text-gray-900">
                              {DOCUMENT_TYPE[doc.type as keyof typeof DOCUMENT_TYPE]}
                            </p>
                            {hasAlert && (
                              <Badge
                                variant={alert.isExpired ? "destructive" : "warning"}
                                className="gap-1"
                              >
                                <AlertTriangle className="w-3 h-3" />
                                {alert.isExpired ? "Vencido" : "Por Vencer"}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-2 truncate">{doc.fileName}</p>
                          <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                            {doc.expirationDate && (
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Vence: {formatDate(doc.expirationDate)}
                              </div>
                            )}
                            <div>Subido: {formatDate(doc.uploadedAt)}</div>
                          </div>
                        </div>
                        {/* Acciones del documento */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {/* Ver / Descargar */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                            title="Ver documento"
                            onClick={async () => {
                              try {
                                const res = await fetch(`/api/download?path=${encodeURIComponent(doc.cloudStoragePath)}&isPublic=${doc.isPublic}&format=json`);
                                if (res.ok) {
                                  const data = await res.json();
                                  window.open(data.url, "_blank", "noopener,noreferrer");
                                } else {
                                  console.error("Error obteniendo URL del documento");
                                }
                              } catch (err) {
                                console.error("Error:", err);
                              }
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {/* Resubir / Editar */}
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-amber-600 hover:text-amber-800 hover:bg-amber-50"
                              title="Reemplazar documento"
                              onClick={() => {
                                setEditingDocType(doc.type);
                                setUploadDialogOpen(true);
                              }}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          )}
                          {/* Eliminar */}
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-800 hover:bg-red-50"
                              title="Eliminar documento"
                              onClick={() => setDeletingDocId(doc.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Segunda fila: Dirección y Representante Legal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dirección */}
        <Card className="shadow-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-green-600" />
              <CardTitle>Dirección</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {contractor.address || contractor.city || contractor.department ? (
              <div className="space-y-3">
                {contractor.address && (
                  <div>
                    <p className="text-sm text-gray-600">Dirección</p>
                    <p className="font-medium text-gray-900">{contractor.address}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  {contractor.city && (
                    <div>
                      <p className="text-sm text-gray-600">Ciudad</p>
                      <p className="font-medium text-gray-900">{contractor.city}</p>
                    </div>
                  )}
                  {contractor.department && (
                    <div>
                      <p className="text-sm text-gray-600">Departamento</p>
                      <p className="font-medium text-gray-900">{contractor.department}</p>
                    </div>
                  )}
                  {contractor.postalCode && (
                    <div>
                      <p className="text-sm text-gray-600">Código Postal</p>
                      <p className="font-medium text-gray-900">{contractor.postalCode}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">Sin información de dirección</p>
            )}
          </CardContent>
        </Card>

        {/* Representante Legal */}
        <Card className="shadow-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-purple-600" />
              <CardTitle>Representante Legal</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {contractor.legalRepName ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Nombre</p>
                  <p className="font-medium text-gray-900">{contractor.legalRepName}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {contractor.legalRepCedula && (
                    <div>
                      <p className="text-sm text-gray-600">Cédula</p>
                      <p className="font-medium text-gray-900">{contractor.legalRepCedula}</p>
                    </div>
                  )}
                  {contractor.legalRepPhone && (
                    <div>
                      <p className="text-sm text-gray-600">Teléfono</p>
                      <p className="font-medium text-gray-900">{contractor.legalRepPhone}</p>
                    </div>
                  )}
                </div>
                {contractor.legalRepEmail && (
                  <div>
                    <p className="text-sm text-gray-600">Correo Electrónico</p>
                    <p className="font-medium text-gray-900">{contractor.legalRepEmail}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">Sin información del representante legal</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tercera fila: Información Financiera y Referencias */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Información Financiera */}
        <Card className="shadow-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-yellow-600" />
              <CardTitle>Información Financiera</CardTitle>
            </div>
            <CardDescription>Ingresos reportados en declaración de renta</CardDescription>
          </CardHeader>
          <CardContent>
            {contractor.reportedIncome ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Ingresos Reportados</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(contractor.reportedIncome)}
                  </p>
                </div>
                {contractor.incomeYear && (
                  <div>
                    <p className="text-sm text-gray-600">Año del Reporte</p>
                    <p className="font-medium text-gray-900">{contractor.incomeYear}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">Sin información financiera</p>
            )}
          </CardContent>
        </Card>

        {/* Referencias Comerciales */}
        <Card className="shadow-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-orange-600" />
              <CardTitle>Referencias Comerciales</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {references.length > 0 ? (
              <div className="space-y-4">
                {references.map((ref, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg">
                    <p className="font-medium text-gray-900">{ref.name || "Sin nombre"}</p>
                    {ref.company && (
                      <p className="text-sm text-gray-600">{ref.company}</p>
                    )}
                    <div className="flex gap-4 mt-2 text-sm text-gray-500">
                      {ref.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {ref.phone}
                        </span>
                      )}
                      {ref.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {ref.email}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">Sin referencias comerciales</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Diálogo de Subir Documento */}
      <DocumentUploadDialog
        open={uploadDialogOpen}
        onClose={() => {
          setUploadDialogOpen(false);
          setEditingDocType(null);
          router.refresh();
        }}
        contractorId={contractor.id}
        defaultDocType={editingDocType}
      />

      {/* Diálogo de Editar */}
      <EditContractorDialog
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          router.refresh();
        }}
        contractor={contractor}
      />

      {/* Diálogo de Confirmación de Eliminación del Subcontratista */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar Subcontratista?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el
              subcontratista <strong>{contractor.name}</strong> y todos sus
              documentos asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de Confirmación de Eliminación de Documento */}
      <AlertDialog open={!!deletingDocId} onOpenChange={(open) => { if (!open) setDeletingDocId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar Documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El documento será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingDoc}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDocument}
              disabled={deletingDoc}
              className="bg-red-600 hover:bg-red-700"
            >
              {deletingDoc && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
