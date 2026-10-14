"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Globe,
  Pencil,
  Star,
  FileText,
  Briefcase,
  Activity,
  Scissors,
  Trash2,
  Plus,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useProvidersStore,
  PROVIDER_STATUS_LABELS,
  PROVIDER_STATUS_VARIANTS,
  PERSON_TYPE_LABELS,
  CATEGORY_LABELS,
  DOCUMENT_TYPE_LABELS,
  requiredDocsFor,
} from "@/lib/data-store";
import { ProviderForm } from "@/components/providers/provider-form";
import { useCutsStore } from "@/lib/data-store";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import type { ProviderDocument, ProviderDocumentType } from "@/types";

export default function ProveedorDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { getProvider, addDocument, removeDocument } = useProvidersStore();
  const { cuts: allCuts, load: loadCuts } = useCutsStore();

  // Cargar cortes desde BD si no están en cache
  useEffect(() => {
    if (!allCuts || allCuts.length === 0) loadCuts();
  }, [allCuts, loadCuts]);
  const [editOpen, setEditOpen] = useState(false);
  const [addDocOpen, setAddDocOpen] = useState(false);

  const provider = getProvider(id);

  if (!provider) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/tecnico/proveedores">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Volver
          </Link>
        </Button>
        <div className="rounded-lg border border-dashed p-12 text-center">
          <h2 className="text-lg font-semibold">Proveedor no encontrado</h2>
        </div>
      </div>
    );
  }

  const variant = PROVIDER_STATUS_VARIANTS[provider.status];
  const docsByType = new Map((provider.documents ?? []).map((d) => [d.type, d]));
  const requiredDocs = requiredDocsFor(provider.personType);
  const missingRequired = requiredDocs.filter((t) => !docsByType.has(t));

  // Cortes del proveedor (filtrados por providerId desde BD)
  const myCuts = (allCuts || []).filter((c) => c.providerId === provider.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/tecnico/proveedores">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Proveedores
          </Link>
        </Button>
        <Button onClick={() => setEditOpen(true)} variant="outline" size="sm">
          <Pencil className="mr-2 h-4 w-4" />
          Editar
        </Button>
      </div>

      {/* Header */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={variant}>{PROVIDER_STATUS_LABELS[provider.status]}</Badge>
              <Badge variant="outline">{PERSON_TYPE_LABELS[provider.personType]}</Badge>
              {provider.category && (
                <Badge variant="secondary">
                  {CATEGORY_LABELS[provider.category]}
                  {provider.subcategory && (
                    <span className="ml-1 text-xs">
                      ·{" "}
                      {provider.subcategory === "OTROS" && provider.subcategoryOther
                        ? provider.subcategoryOther
                        : provider.subcategory.replace(/_/g, " ").toLowerCase()}
                    </span>
                  )}
                </Badge>
              )}
              {provider.rating ? (
                <div className="flex items-center gap-0.5 text-amber-500">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${i < (provider.rating ?? 0) ? "fill-current" : "opacity-30"}`}
                    />
                  ))}
                </div>
              ) : null}
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{provider.name}</h1>
            <p className="font-mono text-xs text-muted-foreground">
              {provider.personType === "JURIDICA" ? "NIT" : "CC"} {provider.nit}
            </p>
            <p className="mt-2 text-sm font-medium">{provider.contact}</p>
            <div className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-4">
              <p className="flex items-center gap-1.5">
                <Mail className="h-4 w-4" />
                {provider.email}
                {provider.email2 && <span className="text-xs">· {provider.email2}</span>}
              </p>
              <p className="flex items-center gap-1.5">
                <Phone className="h-4 w-4" />
                {provider.phone}
                {provider.phone2 && <span className="text-xs">· {provider.phone2}</span>}
              </p>
              {provider.city && (
                <p className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {provider.city}
                  {provider.department ? `, ${provider.department}` : ""}
                </p>
              )}
              {provider.website && (
                <p className="flex items-center gap-1.5">
                  <Globe className="h-4 w-4" />
                  <a href={provider.website} target="_blank" rel="noreferrer" className="hover:underline">
                    {provider.website}
                  </a>
                </p>
              )}
            </div>
          </div>

          <div className="rounded-lg bg-secondary/50 p-4 sm:min-w-[200px]">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Documentación</p>
            <p className="mt-1 text-3xl font-semibold">
              {(provider.documents ?? []).filter((d) => requiredDocs.includes(d.type)).length}
              <span className="text-base text-muted-foreground">/{requiredDocs.length}</span>
            </p>
            <p className="text-xs text-muted-foreground">documentos obligatorios</p>
            {missingRequired.length > 0 && (
              <p className="mt-1 text-xs text-amber-600">Faltan {missingRequired.length}</p>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info" className="space-y-4">
        <TabsList>
          <TabsTrigger value="info">
            <Activity className="mr-1.5 h-4 w-4" />
            Información
          </TabsTrigger>
          <TabsTrigger value="documentos">
            <FileText className="mr-1.5 h-4 w-4" />
            Documentos
            {missingRequired.length > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 text-xs text-white">
                {missingRequired.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="contratos">
            <Briefcase className="mr-1.5 h-4 w-4" />
            Contratos
          </TabsTrigger>
          <TabsTrigger value="cortes">
            <Scissors className="mr-1.5 h-4 w-4" />
            Cortes
            {myCuts.length > 0 && (
              <span className="ml-1.5 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                {myCuts.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Info */}
        <TabsContent value="info" className="space-y-4">
          {provider.personType === "JURIDICA" && (
            <Card>
              <CardHeader>
                <CardTitle>Representante legal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Nombre" value={provider.legalRepName} />
                <Row label="Cédula" value={provider.legalRepCedula} />
                <Row label="Email" value={provider.legalRepEmail} />
                <Row label="Teléfono" value={provider.legalRepPhone} />
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Información financiera</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row
                  label="Renta reportada"
                  value={provider.reportedIncome ? formatCurrency(provider.reportedIncome) : undefined}
                />
                <Row label="Año gravable" value={provider.incomeYear?.toString()} />
                <Row label="Calificación" value={provider.rating ? `${provider.rating}/5 ★` : undefined} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Categoría</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Tipo" value={provider.category ? CATEGORY_LABELS[provider.category] : undefined} />
                <Row
                  label="Subcategoría"
                  value={
                    provider.subcategory
                      ? provider.subcategory === "OTROS" && provider.subcategoryOther
                        ? provider.subcategoryOther
                        : provider.subcategory.replace(/_/g, " ").toLowerCase()
                      : undefined
                  }
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Referencias comerciales</CardTitle>
              <CardDescription>
                {(provider.references ?? []).length} de 3 referencias registradas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(provider.references ?? []).length === 0 ? (
                <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Sin referencias registradas
                </p>
              ) : (
                <div className="space-y-2">
                  {(provider.references ?? []).map((ref, i) => (
                    <div key={i} className="rounded-md border bg-secondary/30 p-3 text-sm">
                      <p className="font-medium">{ref.name}</p>
                      <p className="text-muted-foreground">{ref.company}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {ref.phone} · {ref.email}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {provider.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{provider.notes}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Documentos */}
        <TabsContent value="documentos">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Documentos</CardTitle>
                  <CardDescription>
                    {provider.personType === "JURIDICA"
                      ? "Cédula, RUT, Certificado Bancario, Cámara de Comercio"
                      : "Cédula, RUT, Certificado Bancario"}
                  </CardDescription>
                </div>
                <Button onClick={() => setAddDocOpen(true)} size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar documento
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {missingRequired.length > 0 && (
                <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-50 p-3 text-sm">
                  <AlertCircle className="mt-0.5 h-4 w-4 text-amber-600" />
                  <div>
                    <p className="font-medium text-amber-900">Documentos faltantes</p>
                    <p className="text-amber-800">
                      {missingRequired.map((t) => DOCUMENT_TYPE_LABELS[t]).join(", ")}
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {requiredDocs.map((type) => {
                  const doc = docsByType.get(type);
                  return (
                    <div
                      key={type}
                      className={cn(
                        "flex items-center justify-between rounded-md border p-3",
                        doc ? "bg-card" : "bg-secondary/20 border-dashed"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {doc as any ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-amber-600" />
                        )}
                        <div>
                          <p className="text-sm font-medium">
                            {DOCUMENT_TYPE_LABELS[type]}
                            <span className="ml-1.5 text-xs text-muted-foreground">(obligatorio)</span>
                          </p>
                          {doc as any ? (
                            <p className="text-xs text-muted-foreground">
                              {(doc as any).fileName} · Subido {formatDate((doc as any).uploadedAt)}
                              {(doc as any).expirationDate && (
                                <>
                                  {" · "}
                                  Vence {formatDate((doc as any).expirationDate)}
                                </>
                              )}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">No cargado</p>
                          )}
                        </div>
                      </div>
                      {doc && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeDocument(provider.id, (doc as any).id)}
                          className="h-7 w-7"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  );
                })}

                {/* Documentos opcionales */}
                {provider.documents
                  .filter((d) => !requiredDocs.includes(d.type))
                  .map((doc) => (
                    <div key={(doc as any).id} className="flex items-center justify-between rounded-md border p-3">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-blue-600" />
                        <div>
                          <p className="text-sm font-medium">{DOCUMENT_TYPE_LABELS[(doc as any).type]}</p>
                          <p className="text-xs text-muted-foreground">
                            {(doc as any).fileName} · {formatDate((doc as any).uploadedAt)}
                            {(doc as any).expirationDate && ` · Vence ${formatDate((doc as any).expirationDate)}`}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeDocument(provider.id, (doc as any).id)}
                        className="h-7 w-7"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contratos (placeholder por ahora) */}
        <TabsContent value="contratos">
          <Card>
            <CardHeader>
              <CardTitle>Contratos</CardTitle>
              <CardDescription>Próximamente</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                Módulo de contratos en construcción
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cortes */}
        <TabsContent value="cortes">
          <Card>
            <CardHeader>
              <CardTitle>Cortes de obra</CardTitle>
              <CardDescription>{myCuts.length} cortes registrados para este proveedor</CardDescription>
            </CardHeader>
            <CardContent>
              {myCuts.length === 0 ? (
                <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Sin cortes asociados
                </p>
              ) : (
                <div className="space-y-2">
                  {myCuts.map((cut) => {
                    const statusVariant: "success" | "destructive" | "default" | "warning" =
                      cut.status === "APPROVED" || cut.status === "PAID"
                        ? "success"
                        : cut.status === "REJECTED"
                        ? "destructive"
                        : cut.status === "DRAFT"
                        ? "default"
                        : "warning";
                    return (
                      <div key={cut.id} className="flex items-center justify-between rounded-md border p-3">
                        <div>
                          <p className="font-mono text-xs text-muted-foreground">{cut.cutNumber}</p>
                          <p className="text-sm font-medium">{cut.description}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrency(cut.netValue)}</p>
                          <Badge variant={statusVariant} className="mt-1">
                            {cut.status}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal editar */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar proveedor</DialogTitle>
            <DialogDescription>{provider.nit}</DialogDescription>
          </DialogHeader>
          <ProviderForm provider={provider} onSuccess={() => setEditOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Modal agregar documento */}
      <AddDocumentDialog
        open={addDocOpen}
        onOpenChange={setAddDocOpen}
        onAdd={(doc) => {
          addDocument(provider.id, doc);
          setAddDocOpen(false);
        }}
        existingTypes={(provider.documents ?? []).map((d) => d.type)}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between border-b pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium", !value && "text-muted-foreground italic")}>
        {value || "No registrado"}
      </span>
    </div>
  );
}

function AddDocumentDialog({
  open,
  onOpenChange,
  onAdd,
  existingTypes,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAdd: (doc: Omit<ProviderDocument, "id" | "uploadedAt">) => void;
  existingTypes: ProviderDocumentType[];
}) {
  const [type, setType] = useState<ProviderDocumentType>("CEDULA");
  const [fileName, setFileName] = useState("");
  const [expirationDate, setExpirationDate] = useState("");

  const availableTypes = Object.keys(DOCUMENT_TYPE_LABELS) as ProviderDocumentType[];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onAdd({
      type,
      fileName: fileName || `${type.toLowerCase()}.pdf`,
      expirationDate: expirationDate || undefined,
    });
    setType("CEDULA");
    setFileName("");
    setExpirationDate("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar documento</DialogTitle>
          <DialogDescription>Sube o registra un documento del proveedor</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label className="mb-1.5 block">Tipo de documento</Label>
            <Select value={type} onValueChange={(v) => setType(v as ProviderDocumentType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableTypes.map((t) => (
                  <SelectItem key={t} value={t} disabled={existingTypes.includes(t)}>
                    {DOCUMENT_TYPE_LABELS[t]}
                    {existingTypes.includes(t) && " (ya existe)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block">Nombre del archivo</Label>
            <Input
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="cedula.pdf"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              (Mock: la carga real se conectará después)
            </p>
          </div>
          <div>
            <Label className="mb-1.5 block">Fecha de vencimiento (opcional)</Label>
            <Input type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">Agregar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
