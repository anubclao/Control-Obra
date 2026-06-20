"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Building2,
  Truck,
  Calendar,
  FileText,
  Plus,
  Trash2,
  Pause,
  Play,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  useContractsStore,
  CONTRACT_TYPE_LABELS,
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_VARIANTS,
  CONTRACT_DOCUMENT_TYPE_LABELS,
  REQUIRED_CONTRACT_DOCS,
} from "@/lib/contracts-store";
import { useProjectsStore } from "@/lib/projects-store";
import { useProvidersStore } from "@/lib/providers-store";
import { useCutsStore } from "@/lib/cuts-store";
import { ContractForm } from "@/components/contracts/contract-form";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import type { ContractDocument, ContractDocumentType } from "@/types";

export default function ContractDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { getContract, setStatus, addDocument, removeDocument } = useContractsStore();
  const { getProject } = useProjectsStore();
  const { getProvider } = useProvidersStore();
  const { cuts } = useCutsStore();
  const [editOpen, setEditOpen] = useState(false);
  const [addDocOpen, setAddDocOpen] = useState(false);

  const contract = getContract(id);

  if (!contract) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/tecnico/contratos">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Volver
          </Link>
        </Button>
        <div className="rounded-lg border border-dashed p-12 text-center">
          <h2 className="text-lg font-semibold">Contrato no encontrado</h2>
        </div>
      </div>
    );
  }

  const project = getProject(contract.projectId);
  const provider = getProvider(contract.providerId);
  const myCuts = cuts.filter((c) => c.providerId === contract.providerId && c.projectId === contract.projectId);
  const variant = CONTRACT_STATUS_VARIANTS[contract.status];
  const docsByType = new Map(contract.documents.map((d) => [d.type, d]));
  const missingRequired = REQUIRED_CONTRACT_DOCS.filter((t) => !docsByType.has(t));
  const retentionAmount = (contract.value * contract.retentionPercent) / 100;
  const advanceAmount = (contract.value * contract.advancePercent) / 100;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/tecnico/contratos">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Contratos
          </Link>
        </Button>
        <Button onClick={() => setEditOpen(true)} variant="outline" size="sm">
          <Pencil className="mr-2 h-4 w-4" />
          Editar
        </Button>
      </div>

      {/* Header */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-xs text-muted-foreground">{contract.contractNumber}</p>
              <Badge variant={variant}>{CONTRACT_STATUS_LABELS[contract.status]}</Badge>
              <span className="text-xs text-muted-foreground">{CONTRACT_TYPE_LABELS[contract.type]}</span>
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Alcance del contrato</h1>
            <p className="mt-2 text-sm">{contract.scopeOfWork}</p>
            <div className="mt-3 flex flex-col gap-1.5 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-4">
              {project && (
                <p className="flex items-center gap-1.5">
                  <Building2 className="h-4 w-4" />
                  {project.code} · {project.name}
                </p>
              )}
              {provider && (
                <p className="flex items-center gap-1.5">
                  <Truck className="h-4 w-4" />
                  {provider.name}
                </p>
              )}
              <p className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {formatDate(contract.startDate)} → {formatDate(contract.endDate)}
              </p>
            </div>
            {contract.notes && (
              <p className="mt-3 rounded-md bg-secondary/40 p-2 text-sm">{contract.notes}</p>
            )}
          </div>

          <div className="rounded-lg bg-secondary/50 p-4 sm:min-w-[240px]">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Valor contrato</p>
            <p className="mt-1 text-2xl font-bold">{formatCurrency(contract.value)}</p>
            <div className="mt-3 space-y-1 text-xs">
              <Row label={`Anticipo (${contract.advancePercent}%)`} value={formatCurrency(advanceAmount)} color="text-amber-600" />
              <Row label={`Retención (${contract.retentionPercent}%)`} value={formatCurrency(retentionAmount)} color="text-red-600" />
            </div>
          </div>
        </div>

        {/* Acciones de estado */}
        <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
          {contract.status === "ACTIVE" && (
            <Button variant="outline" size="sm" onClick={() => setStatus(contract.id, "SUSPENDED")}>
              <Pause className="mr-2 h-4 w-4" />
              Suspender
            </Button>
          )}
          {contract.status === "SUSPENDED" && (
            <Button variant="outline" size="sm" onClick={() => setStatus(contract.id, "ACTIVE")}>
              <Play className="mr-2 h-4 w-4" />
              Reactivar
            </Button>
          )}
          {contract.status !== "COMPLETED" && contract.status !== "CANCELLED" && (
            <Button variant="outline" size="sm" onClick={() => setStatus(contract.id, "COMPLETED")}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Marcar completado
            </Button>
          )}
          {contract.status !== "CANCELLED" && (
            <Button variant="destructive" size="sm" onClick={() => setStatus(contract.id, "CANCELLED")}>
              <XCircle className="mr-2 h-4 w-4" />
              Cancelar contrato
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info" className="space-y-4">
        <TabsList>
          <TabsTrigger value="info">Información</TabsTrigger>
          <TabsTrigger value="documentos">
            Documentos ({contract.documents.length})
            {missingRequired.length > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 text-xs text-white">
                {missingRequired.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="cortes">
            Cortes ({myCuts.length})
          </TabsTrigger>
        </TabsList>

        {/* Info */}
        <TabsContent value="info" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Datos del contrato</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Tipo" value={CONTRACT_TYPE_LABELS[contract.type]} />
                <Row label="Estado" value={CONTRACT_STATUS_LABELS[contract.status]} />
                <Row label="Inicio" value={formatDate(contract.startDate)} />
                <Row label="Fin" value={formatDate(contract.endDate)} />
                <Row label="Valor" value={formatCurrency(contract.value)} />
                <Row label="Anticipo" value={`${contract.advancePercent}% (${formatCurrency(advanceAmount)})`} />
                <Row label="Retención" value={`${contract.retentionPercent}% (${formatCurrency(retentionAmount)})`} />
                <Row label="Creado" value={formatDate(contract.createdAt)} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Vínculos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {project && (
                  <Link
                    href={`/tecnico/proyectos/${project.id}`}
                    className="block rounded-md border bg-secondary/30 p-3 hover:bg-accent"
                  >
                    <p className="text-xs text-muted-foreground">Proyecto</p>
                    <p className="font-medium">{project.code} · {project.name}</p>
                  </Link>
                )}
                {provider && (
                  <Link
                    href={`/tecnico/proveedores/${provider.id}`}
                    className="block rounded-md border bg-secondary/30 p-3 hover:bg-accent"
                  >
                    <p className="text-xs text-muted-foreground">Contratista</p>
                    <p className="font-medium">{provider.name}</p>
                    <p className="text-xs text-muted-foreground">NIT {provider.nit}</p>
                  </Link>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Documentos */}
        <TabsContent value="documentos">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Documentos contractuales</CardTitle>
                  <CardDescription>
                    Contrato firmado, pólizas, acta de inicio
                  </CardDescription>
                </div>
                <Button onClick={() => setAddDocOpen(true)} size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {missingRequired.length > 0 && (
                <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-50 p-3 text-sm">
                  <XCircle className="mt-0.5 h-4 w-4 text-amber-600" />
                  <div>
                    <p className="font-medium text-amber-900">Documentos obligatorios faltantes</p>
                    <p className="text-amber-800">
                      {missingRequired.map((t) => CONTRACT_DOCUMENT_TYPE_LABELS[t]).join(", ")}
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {REQUIRED_CONTRACT_DOCS.map((type) => {
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
                        {doc ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-amber-600" />
                        )}
                        <div>
                          <p className="text-sm font-medium">
                            {CONTRACT_DOCUMENT_TYPE_LABELS[type]}
                            <span className="ml-1.5 text-xs text-muted-foreground">(obligatorio)</span>
                          </p>
                          {doc ? (
                            <p className="text-xs text-muted-foreground">
                              {doc.fileName} · Subido {formatDate(doc.uploadedAt)}
                              {doc.expirationDate && ` · Vence ${formatDate(doc.expirationDate)}`}
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
                          onClick={() => removeDocument(contract.id, doc.id)}
                          className="h-7 w-7"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  );
                })}

                {contract.documents
                  .filter((d) => !REQUIRED_CONTRACT_DOCS.includes(d.type))
                  .map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between rounded-md border p-3">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-blue-600" />
                        <div>
                          <p className="text-sm font-medium">{CONTRACT_DOCUMENT_TYPE_LABELS[doc.type]}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.fileName} · {formatDate(doc.uploadedAt)}
                            {doc.expirationDate && ` · Vence ${formatDate(doc.expirationDate)}`}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeDocument(contract.id, doc.id)}
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

        {/* Cortes */}
        <TabsContent value="cortes">
          <Card>
            <CardHeader>
              <CardTitle>Cortes asociados</CardTitle>
              <CardDescription>
                Cortes de obra generados bajo este contrato
              </CardDescription>
            </CardHeader>
            <CardContent>
              {myCuts.length === 0 ? (
                <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Sin cortes asociados a este contrato
                </p>
              ) : (
                <div className="space-y-2">
                  {myCuts.map((cut) => (
                    <Link
                      key={cut.id}
                      href={`/tecnico/cortes/${cut.id}`}
                      className="flex items-center justify-between rounded-md border p-3 hover:bg-accent"
                    >
                      <div>
                        <p className="font-mono text-xs text-muted-foreground">{cut.cutNumber}</p>
                        <p className="text-sm font-medium">{cut.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(cut.netValue)}</p>
                        <Badge variant="outline" className="mt-1">
                          {cut.status}
                        </Badge>
                      </div>
                    </Link>
                  ))}
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
            <DialogTitle>Editar contrato</DialogTitle>
            <DialogDescription>{contract.contractNumber}</DialogDescription>
          </DialogHeader>
          <ContractForm contract={contract} onSuccess={() => setEditOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Modal agregar documento */}
      <AddDocDialog
        open={addDocOpen}
        onOpenChange={setAddDocOpen}
        onAdd={(doc) => {
          addDocument(contract.id, doc);
          setAddDocOpen(false);
        }}
        existingTypes={contract.documents.map((d) => d.type)}
      />
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between border-b pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium", color)}>{value}</span>
    </div>
  );
}

function AddDocDialog({
  open,
  onOpenChange,
  onAdd,
  existingTypes,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAdd: (doc: Omit<ContractDocument, "id" | "uploadedAt">) => void;
  existingTypes: ContractDocumentType[];
}) {
  const [type, setType] = useState<ContractDocumentType>("CONTRATO_FIRMADO");
  const [fileName, setFileName] = useState("");
  const [expirationDate, setExpirationDate] = useState("");

  const availableTypes = Object.keys(CONTRACT_DOCUMENT_TYPE_LABELS) as ContractDocumentType[];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onAdd({
      type,
      fileName: fileName || `${type.toLowerCase()}.pdf`,
      expirationDate: expirationDate || undefined,
    });
    setType("CONTRATO_FIRMADO");
    setFileName("");
    setExpirationDate("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar documento contractual</DialogTitle>
          <DialogDescription>Sube o registra un documento del contrato</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label className="mb-1.5 block">Tipo de documento</Label>
            <Select value={type} onValueChange={(v) => setType(v as ContractDocumentType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableTypes.map((t) => (
                  <SelectItem key={t} value={t} disabled={existingTypes.includes(t)}>
                    {CONTRACT_DOCUMENT_TYPE_LABELS[t]}
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
              placeholder="contrato.pdf"
            />
            <p className="mt-1 text-xs text-muted-foreground">(Mock: la carga real se conectará después)</p>
          </div>
          <div>
            <Label className="mb-1.5 block">Vencimiento (opcional)</Label>
            <Input type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">Agregar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
