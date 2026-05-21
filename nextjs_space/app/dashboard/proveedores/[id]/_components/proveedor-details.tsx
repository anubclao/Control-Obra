"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Truck,
  ArrowLeft,
  FileText,
  Upload,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Mail,
  Phone,
  Globe,
  MapPin,
  User,
  DollarSign,
  Users,
  Calendar,
  Download,
  Trash2,
  Edit,
  Package,
} from "lucide-react";
import {
  SUPPLIER_STATUS,
  SUPPLIER_CATEGORY,
  SUPPLIER_DOCUMENT_TYPE,
} from "@/lib/constants";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { DocumentUploadDialog } from "./document-upload-dialog";

type Document = {
  id: string;
  type: keyof typeof SUPPLIER_DOCUMENT_TYPE;
  fileName: string;
  cloudStoragePath: string;
  expirationDate: string | null;
  uploadedAt: string;
  isExpired: boolean;
  isExpiringSoon: boolean;
  daysUntil: number | null;
};

type Supplier = {
  id: string;
  name: string;
  nit: string;
  contact: string;
  email: string;
  phone: string;
  status: keyof typeof SUPPLIER_STATUS;
  category: keyof typeof SUPPLIER_CATEGORY;
  address: string | null;
  city: string | null;
  department: string | null;
  postalCode: string | null;
  website: string | null;
  legalRepName: string | null;
  legalRepCedula: string | null;
  legalRepEmail: string | null;
  legalRepPhone: string | null;
  reportedIncome: number | null;
  incomeYear: number | null;
  paymentTerms: string | null;
  deliveryTerms: string | null;
  minOrderValue: number | null;
  ref1Name: string | null;
  ref1Company: string | null;
  ref1Phone: string | null;
  ref1Email: string | null;
  ref2Name: string | null;
  ref2Company: string | null;
  ref2Phone: string | null;
  ref2Email: string | null;
  ref3Name: string | null;
  ref3Company: string | null;
  ref3Phone: string | null;
  ref3Email: string | null;
  documents: Document[];
  createdAt: string;
};

type Props = {
  supplier: Supplier;
  documentAlerts: Document[];
  userRole: string;
};

export function ProveedorDetails({ supplier, documentAlerts, userRole }: Props) {
  const router = useRouter();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canManage = ["ADMIN", "GERENTE", "DIRECTOR", "CONTABILIDAD"].includes(userRole);
  const canDelete = ["ADMIN", "GERENTE"].includes(userRole);

  const requiredDocs = ["CEDULA", "RUT", "CAMARA_COMERCIO", "CERTIFICADO_BANCARIO"];
  const uploadedTypes = supplier.documents.map((d) => d.type);
  const missingDocs = requiredDocs.filter(
    (type) => !uploadedTypes.includes(type as any)
  );

  const getStatusBadge = (status: keyof typeof SUPPLIER_STATUS) => {
    switch (status) {
      case "COMPLETE":
        return (
          <Badge variant="success" className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            {SUPPLIER_STATUS[status]}
          </Badge>
        );
      case "INCOMPLETE":
        return (
          <Badge variant="warning" className="flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {SUPPLIER_STATUS[status]}
          </Badge>
        );
      case "EXPIRED":
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            {SUPPLIER_STATUS[status]}
          </Badge>
        );
    }
  };

  const handleDelete = async () => {
    if (!confirm("¿Está seguro de eliminar este proveedor?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/proveedores/${supplier.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push("/dashboard/proveedores");
      }
    } catch (error) {
      console.error("Error deleting supplier:", error);
    } finally {
      setDeleting(false);
    }
  };

  const references = [
    {
      name: supplier.ref1Name,
      company: supplier.ref1Company,
      phone: supplier.ref1Phone,
      email: supplier.ref1Email,
    },
    {
      name: supplier.ref2Name,
      company: supplier.ref2Company,
      phone: supplier.ref2Phone,
      email: supplier.ref2Email,
    },
    {
      name: supplier.ref3Name,
      company: supplier.ref3Company,
      phone: supplier.ref3Phone,
      email: supplier.ref3Email,
    },
  ].filter((ref) => ref.name);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900">
                {supplier.name}
              </h1>
              {getStatusBadge(supplier.status)}
            </div>
            <p className="text-gray-600">NIT: {supplier.nit}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {canDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Eliminar
            </Button>
          )}
        </div>
      </div>

      {/* Alertas */}
      {(missingDocs.length > 0 ||
        documentAlerts.some((d) => d.isExpired || d.isExpiringSoon)) && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
              <div>
                <h3 className="font-semibold text-amber-800">Alertas</h3>
                <ul className="mt-2 space-y-1 text-sm text-amber-700">
                  {missingDocs.map((type) => (
                    <li key={type}>
                      • Falta documento:{" "}
                      {SUPPLIER_DOCUMENT_TYPE[type as keyof typeof SUPPLIER_DOCUMENT_TYPE]}
                    </li>
                  ))}
                  {documentAlerts
                    .filter((d) => d.isExpired)
                    .map((d) => (
                      <li key={d.id} className="text-red-700">
                        • Documento vencido: {SUPPLIER_DOCUMENT_TYPE[d.type]}
                      </li>
                    ))}
                  {documentAlerts
                    .filter((d) => d.isExpiringSoon)
                    .map((d) => (
                      <li key={d.id}>
                        • Por vencer ({d.daysUntil} días):{" "}
                        {SUPPLIER_DOCUMENT_TYPE[d.type]}
                      </li>
                    ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Información de Contacto */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-amber-600" />
              <CardTitle>Información de Contacto</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Contacto</p>
              <p className="font-medium">{supplier.contact}</p>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-gray-400" />
              <span>{supplier.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-gray-400" />
              <span>{supplier.phone}</span>
            </div>
            {supplier.website && (
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-gray-400" />
                <a
                  href={supplier.website}
                  target="_blank"
                  className="text-blue-600 hover:underline"
                >
                  {supplier.website}
                </a>
              </div>
            )}
            <Badge variant="outline">
              {SUPPLIER_CATEGORY[supplier.category]}
            </Badge>
          </CardContent>
        </Card>

        {/* Dirección */}
        {(supplier.address || supplier.city) && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-amber-600" />
                <CardTitle>Dirección</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {supplier.address && <p>{supplier.address}</p>}
              <p>
                {[supplier.city, supplier.department].filter(Boolean).join(", ")}
              </p>
              {supplier.postalCode && (
                <p className="text-sm text-gray-500">
                  Código Postal: {supplier.postalCode}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Representante Legal */}
        {supplier.legalRepName && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-amber-600" />
                <CardTitle>Representante Legal</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="font-medium">{supplier.legalRepName}</p>
              {supplier.legalRepCedula && (
                <p className="text-sm">C.C. {supplier.legalRepCedula}</p>
              )}
              {supplier.legalRepEmail && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-3 h-3" />
                  {supplier.legalRepEmail}
                </div>
              )}
              {supplier.legalRepPhone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-3 h-3" />
                  {supplier.legalRepPhone}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Información Comercial */}
        {(supplier.paymentTerms || supplier.deliveryTerms || supplier.minOrderValue) && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-600" />
                <CardTitle>Información Comercial</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {supplier.paymentTerms && (
                <div>
                  <p className="text-sm text-gray-500">Términos de Pago</p>
                  <p className="font-medium">{supplier.paymentTerms}</p>
                </div>
              )}
              {supplier.deliveryTerms && (
                <div>
                  <p className="text-sm text-gray-500">Términos de Entrega</p>
                  <p className="font-medium">{supplier.deliveryTerms}</p>
                </div>
              )}
              {supplier.minOrderValue && (
                <div>
                  <p className="text-sm text-gray-500">Valor Mínimo de Orden</p>
                  <p className="font-medium">
                    {formatCurrency(supplier.minOrderValue)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Información Financiera */}
        {supplier.reportedIncome && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-600" />
                <CardTitle>Información Financiera</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">
                Ingresos Reportados ({supplier.incomeYear})
              </p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(supplier.reportedIncome)}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Referencias Comerciales */}
        {references.length > 0 && (
          <Card className="col-span-2">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-600" />
                <CardTitle>Referencias Comerciales</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                {references.map((ref, idx) => (
                  <div key={idx} className="p-4 border rounded-lg">
                    <p className="font-medium">{ref.name}</p>
                    {ref.company && (
                      <p className="text-sm text-gray-600">{ref.company}</p>
                    )}
                    {ref.phone && (
                      <p className="text-sm flex items-center gap-1 mt-2">
                        <Phone className="w-3 h-3" />
                        {ref.phone}
                      </p>
                    )}
                    {ref.email && (
                      <p className="text-sm flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {ref.email}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Documentos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-600" />
              <CardTitle>Documentos</CardTitle>
            </div>
            {canManage && (
              <Button onClick={() => setUploadDialogOpen(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Subir Documento
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {requiredDocs.map((docType) => {
              const doc = supplier.documents.find((d) => d.type === docType);
              return (
                <div
                  key={docType}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <FileText
                      className={`w-5 h-5 ${
                        doc
                          ? doc.isExpired
                            ? "text-red-500"
                            : doc.isExpiringSoon
                            ? "text-amber-500"
                            : "text-green-500"
                          : "text-gray-300"
                      }`}
                    />
                    <div>
                      <p className="font-medium">
                        {SUPPLIER_DOCUMENT_TYPE[docType as keyof typeof SUPPLIER_DOCUMENT_TYPE]}
                      </p>
                      {doc && (
                        <p className="text-sm text-gray-500">
                          {doc.fileName} • Subido:{" "}
                          {formatShortDate(doc.uploadedAt)}
                          {doc.expirationDate &&
                            ` • Vence: ${formatShortDate(doc.expirationDate)}`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {doc ? (
                      <>
                        {doc.isExpired && (
                          <Badge variant="destructive">Vencido</Badge>
                        )}
                        {doc.isExpiringSoon && !doc.isExpired && (
                          <Badge variant="warning">Por vencer</Badge>
                        )}
                        {!doc.isExpired && !doc.isExpiringSoon && (
                          <Badge variant="success">Vigente</Badge>
                        )}
                      </>
                    ) : (
                      <Badge variant="outline">Pendiente</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <DocumentUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        supplierId={supplier.id}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
