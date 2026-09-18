"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Upload,
  History,
  ChevronRight,
  Layers,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Download,
  Plus,
  FileSpreadsheet,
  FileText,
  TrendingUp,
  Trash2,
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBudgetsStore } from "@/lib/data-store";
import { useAiuStore } from "@/lib/data-store";
import { useProjectsStore } from "@/lib/data-store";
import { useIsSuperAdmin } from "@/lib/permissions";
import {
  parseExcelContent,
  buildBudgetLayers,
  SAMPLE_EXCEL_DATA,
  type ParsedExcel,
} from "@/lib/excel-parser";
import { AiuForm } from "@/components/aiu/aiu-form";
import { formatCurrency, formatDate, formatPercent, cn } from "@/lib/utils";
import type { BudgetLayer, BudgetItem } from "@/types";

export default function BudgetDetailPage() {
  const params = useParams();
  const projectId = params.id as string;
  const isSuperAdmin = useIsSuperAdmin();
  const {
    getBudgetByProject,
    createNewVersion,
    addUnforeseenItem,
    removeUnforeseenItem,
  } = useBudgetsStore();
  const { getConfig } = useAiuStore();
  const { getProject } = useProjectsStore();

  const [newVersionOpen, setNewVersionOpen] = useState(false);
  const [parsed, setParsed] = useState<ParsedExcel | null>(null);
  const [versionNotes, setVersionNotes] = useState("");
  const [versionError, setVersionError] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [unforeseenOpen, setUnforeseenOpen] = useState(false);

  const project = getProject(projectId);
  const budget = getBudgetByProject(projectId);
  const aiuConfig = getConfig(projectId);

  const totals = useMemo(() => {
    if (!budget)
      return { itemCount: 0, chapterCount: 0, executed: 0, executedPercent: 0 };
    const allItems = budget.layers.flatMap((l) => l.items);
    const executed = allItems.reduce((s, it) => s + it.executedAmount, 0);
    return {
      itemCount: allItems.length,
      chapterCount: budget.layers.length,
      executed,
      executedPercent:
        budget.totalValue > 0 ? (executed / budget.totalValue) * 100 : 0,
    };
  }, [budget]);

  if (!project || !budget) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/tecnico/presupuestos">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Presupuestos
          </Link>
        </Button>
        <div className="rounded-lg border border-dashed p-12 text-center">
          <h2 className="text-lg font-semibold">Presupuesto no encontrado</h2>
        </div>
      </div>
    );
  }

  const activeVersion = budget.versions.find(
    (v) => v.id === budget.activeVersionId,
  );
  const overBudget = totals.executed > budget.totalValue;
  const clientLayers = budget.clientLayers ?? [];
  const unforeseenItems = budget.unforeseenItems ?? [];

  function startNewVersion() {
    setVersionError(null);
    setNewVersionOpen(true);
    const sample = parseExcelContent(SAMPLE_EXCEL_DATA);
    setParsed(sample);
  }

  function confirmNewVersion() {
    if (!parsed) return;
    setVersionError(null);
    const layers = buildBudgetLayers(parsed.rows);
    const result = createNewVersion(projectId, layers, versionNotes);
    if (!result.ok) {
      setVersionError(result.error || "Error");
      return;
    }
    setNewVersionOpen(false);
    setVersionNotes("");
  }

  function exportAs(format: "excel" | "pdf") {
    // Mock: en producción esto descargaría el archivo
    alert(
      `Exportando presupuesto en formato ${format.toUpperCase()} (mock)\n\n` +
        `Proyecto: ${project?.name}\n` +
        `Total Tope: ${formatCurrency(budget?.totalValue ?? 0)}\n` +
        `Total Cliente: ${formatCurrency(budget?.clientValue ?? 0)}\n` +
        `Ítems: ${totals.itemCount}`,
    );
    setExportOpen(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/tecnico/presupuestos">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Presupuestos
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => setExportOpen(true)}
            variant="outline"
            size="sm"
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          {isSuperAdmin && (
            <Button onClick={startNewVersion} variant="outline" size="sm">
              <Upload className="mr-2 h-4 w-4" />
              Nueva versión
            </Button>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-xs text-muted-foreground">
                {project.code}
              </p>
              <Badge variant="info">PT v{activeVersion?.version}</Badge>
              {activeVersion?.isActive && (
                <Badge variant="success">Activa</Badge>
              )}
              {overBudget && (
                <Badge variant="destructive">
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  Sobre tope
                </Badge>
              )}
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              {project.name}
            </h1>
            <p className="text-sm text-muted-foreground">{project.client}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:min-w-[300px]">
            <div className="rounded-lg bg-secondary/50 p-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Cliente
              </p>
              <p className="mt-1 text-lg font-bold">
                {formatCurrency(budget.clientValue ?? 0)}
              </p>
            </div>
            <div className="rounded-lg bg-secondary/50 p-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Tope
              </p>
              <p className="mt-1 text-lg font-bold">
                {formatCurrency(budget.totalValue)}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-md border bg-secondary/30 p-3">
            <p className="text-xs text-muted-foreground">Capítulos</p>
            <p className="text-xl font-semibold">{totals.chapterCount}</p>
          </div>
          <div className="rounded-md border bg-secondary/30 p-3">
            <p className="text-xs text-muted-foreground">Ítems</p>
            <p className="text-xl font-semibold">{totals.itemCount}</p>
          </div>
          <div className="rounded-md border bg-secondary/30 p-3">
            <p className="text-xs text-muted-foreground">Ejecutado</p>
            <p
              className={cn(
                "text-xl font-semibold",
                overBudget ? "text-red-600" : "text-emerald-600",
              )}
            >
              {formatCurrency(totals.executed)}
            </p>
          </div>
          <div className="rounded-md border bg-secondary/30 p-3">
            <p className="text-xs text-muted-foreground">% Ejecución</p>
            <p className="text-xl font-semibold">
              {formatPercent(totals.executedPercent)}
            </p>
          </div>
        </div>
      </div>

      {/* Alerta Super Admin cuando ejecutado > tope (PDF p.6) */}
      {overBudget && isSuperAdmin && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Gasto por encima del tope</AlertTitle>
          <AlertDescription>
            El ejecutado ({formatCurrency(totals.executed)}) supera el
            Presupuesto Tope ({formatCurrency(budget.totalValue)}) por{" "}
            <strong>
              {formatCurrency(totals.executed - budget.totalValue)}
            </strong>
            . Revisa los ítems no previstos.
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs defaultValue="cliente" className="space-y-4">
        <TabsList>
          <TabsTrigger value="cliente">
            <Briefcase className="mr-1.5 h-4 w-4" />
            Presupuesto Cliente
          </TabsTrigger>
          <TabsTrigger value="tope">
            <TrendingUp className="mr-1.5 h-4 w-4" />
            Presupuesto Tope
          </TabsTrigger>
          <TabsTrigger value="capitulos">
            <Layers className="mr-1.5 h-4 w-4" />
            Capítulos
          </TabsTrigger>
          <TabsTrigger value="no-previstos">
            <AlertCircle className="mr-1.5 h-4 w-4" />
            Ítems No Previstos
            {unforeseenItems.length > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 text-xs text-white">
                {unforeseenItems.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="aiu">
            <TrendingUp className="mr-1.5 h-4 w-4" />
            AIU
          </TabsTrigger>
          <TabsTrigger value="versiones">
            <History className="mr-1.5 h-4 w-4" />
            Versiones ({budget.versions.length})
          </TabsTrigger>
        </TabsList>

        {/* PRESUPUESTO CLIENTE */}
        <TabsContent value="cliente" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle>Presupuesto Cliente</CardTitle>
              <CardDescription>
                Lo que el cliente aprobó al inicio del proyecto. Los totales se
                usan como referencia y no se modifican durante la obra.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {clientLayers.length === 0 ? (
                <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Aún no se ha cargado el presupuesto cliente para este
                  proyecto.
                </p>
              ) : (
                clientLayers.map((layer) => (
                  <ChapterCard
                    key={layer.id}
                    layer={layer}
                    budgetTotal={budget.clientValue ?? 0}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PRESUPUESTO TOPE */}
        <TabsContent value="tope" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle>Presupuesto Tope</CardTitle>
              <CardDescription>
                Con el que se trabaja en obra para contratar. Incluye los ítems
                no previstos que se hayan creado durante la ejecución.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {budget.layers.map((layer) => (
                <ChapterCard
                  key={layer.id}
                  layer={layer}
                  budgetTotal={budget.totalValue}
                />
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CAPÍTULOS — vista jerárquica (alias del tope para navegación rápida) */}
        <TabsContent value="capitulos" className="space-y-3">
          {budget.layers.map((layer) => (
            <ChapterCard
              key={layer.id}
              layer={layer}
              budgetTotal={budget.totalValue}
              defaultOpen
            />
          ))}
        </TabsContent>

        {/* ITEMS NO PREVISTOS */}
        <TabsContent value="no-previstos" className="space-y-3">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Ítems No Previstos</CardTitle>
                  <CardDescription>
                    Al crear un ítem no previsto, se suma automáticamente al
                    Presupuesto Tope con el porcentaje definido en la tabla
                    resumen.
                  </CardDescription>
                </div>
                {isSuperAdmin && (
                  <Button onClick={() => setUnforeseenOpen(true)} size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Nuevo ítem no previsto
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {unforeseenItems.length === 0 ? (
                <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No hay ítems no previstos registrados.
                </p>
              ) : (
                <div className="space-y-2">
                  {unforeseenItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-md border bg-secondary/30 p-3"
                    >
                      <div>
                        <p className="text-xs font-mono text-amber-700">
                          CAP### - ITEM NO PREVISTO
                        </p>
                        <p className="text-sm font-medium">
                          {item.description}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity} {item.unit} ×{" "}
                          {formatCurrency(item.unitPrice)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-semibold">
                            {formatCurrency(item.totalPrice)}
                          </p>
                          <p className="text-xs text-muted-foreground">Total</p>
                        </div>
                        {isSuperAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              removeUnforeseenItem(budget.id, item.id)
                            }
                            className="h-7 w-7"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-end rounded-md border bg-amber-50 p-3">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        Total no previstos
                      </p>
                      <p className="text-lg font-bold text-amber-700">
                        {formatCurrency(budget.unforeseenValue ?? 0)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* AIU — integrado (PDF p.15) */}
        <TabsContent value="aiu" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle>AIU — Administración, Imprevistos, Utilidad</CardTitle>
              <CardDescription>
                Configurado a nivel de proyecto. Se aplica sobre el presupuesto
                base.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AiuForm
                projectId={projectId}
                existing={aiuConfig}
                onSuccess={() => {
                  // refrescar no necesario — zustand ya actualiza
                }}
              />
              {aiuConfig && (
                <div className="mt-6 grid grid-cols-3 gap-3 border-t pt-4">
                  <div className="rounded-md bg-blue-50 p-3">
                    <p className="text-xs text-blue-700">Administración</p>
                    <p className="text-2xl font-bold text-blue-700">
                      {aiuConfig.administration}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(
                        (budget.totalValue * aiuConfig.administration) / 100,
                      )}
                    </p>
                  </div>
                  <div className="rounded-md bg-amber-50 p-3">
                    <p className="text-xs text-amber-700">Imprevistos</p>
                    <p className="text-2xl font-bold text-amber-700">
                      {aiuConfig.imprevistos}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(
                        (budget.totalValue * aiuConfig.imprevistos) / 100,
                      )}
                    </p>
                  </div>
                  <div className="rounded-md bg-emerald-50 p-3">
                    <p className="text-xs text-emerald-700">Utilidad</p>
                    <p className="text-2xl font-bold text-emerald-700">
                      {aiuConfig.utilidad}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(
                        (budget.totalValue * aiuConfig.utilidad) / 100,
                      )}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* VERSIONES */}
        <TabsContent value="versiones">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de versiones</CardTitle>
              <CardDescription>
                Cada cambio en el PT crea una nueva versión. Solo una está
                activa a la vez.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[...budget.versions]
                  .sort((a, b) => b.version - a.version)
                  .map((v) => (
                    <div
                      key={v.id}
                      className={cn(
                        "flex items-center justify-between rounded-md border p-3",
                        v.isActive
                          ? "bg-emerald-50 border-emerald-200"
                          : "bg-secondary/20",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {v.isActive ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                        <div>
                          <p className="text-sm font-medium">
                            Versión {v.version}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {v.notes} · {formatDate(v.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          {formatCurrency(v.totalValue)}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog nueva versión */}
      <Dialog open={newVersionOpen} onOpenChange={setNewVersionOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crear nueva versión del PT</DialogTitle>
            <DialogDescription>
              La versión actual quedará como histórica. La nueva v
              {(activeVersion?.version ?? 0) + 1} será la activa.
            </DialogDescription>
          </DialogHeader>
          {versionError && (
            <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              {versionError}
            </div>
          )}
          {parsed && (
            <div className="space-y-3">
              <p className="text-sm">
                Detectadas <strong>{parsed.rows.length}</strong> filas. Ajusta
                notas y confirma.
              </p>
              <div className="space-y-1.5">
                <Label>Notas de la versión</Label>
                <Input
                  value={versionNotes}
                  onChange={(e) => setVersionNotes(e.target.value)}
                  placeholder="Ej: revisión tras negociación con proveedor X"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewVersionOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmNewVersion}>Crear nueva versión</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog exportar */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exportar presupuesto</DialogTitle>
            <DialogDescription>
              Genera un archivo con la estructura actual del proyecto.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-20 flex-col gap-2"
              onClick={() => exportAs("excel")}
            >
              <FileSpreadsheet className="h-6 w-6" />
              Excel
            </Button>
            <Button
              variant="outline"
              className="h-20 flex-col gap-2"
              onClick={() => exportAs("pdf")}
            >
              <FileText className="h-6 w-6" />
              PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog nuevo ítem no previsto */}
      <UnforeseenDialog
        open={unforeseenOpen}
        onOpenChange={setUnforeseenOpen}
        onAdd={(item) => {
          addUnforeseenItem(budget.id, item);
          setUnforeseenOpen(false);
        }}
      />
    </div>
  );
}

function ChapterCard({
  layer,
  budgetTotal,
  defaultOpen = false,
}: {
  layer: BudgetLayer;
  budgetTotal: number;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const layerTotal = layer.items.reduce((s, it) => s + it.totalPrice, 0);
  const layerExecuted = layer.items.reduce((s, it) => s + it.executedAmount, 0);
  const percent = budgetTotal > 0 ? (layerTotal / budgetTotal) * 100 : 0;

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-md border bg-card"
    >
      <CollapsibleTrigger asChild>
        <button className="flex w-full items-center justify-between p-3 hover:bg-accent/50">
          <div className="flex items-center gap-2">
            <ChevronRight
              className={cn(
                "h-4 w-4 transition-transform",
                open && "rotate-90",
              )}
            />
            <div className="text-left">
              <p className="font-mono text-xs text-muted-foreground">
                CAP {layer.code}
              </p>
              <p className="text-sm font-semibold">{layer.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-right">
            <div>
              <p className="text-xs text-muted-foreground">Peso</p>
              <p className="text-sm font-semibold">{percent.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ejecutado</p>
              <p className="text-sm font-semibold text-emerald-600">
                {formatCurrency(layerExecuted)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-sm font-semibold">
                {formatCurrency(layerTotal)}
              </p>
            </div>
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-secondary/30 text-left text-xs uppercase text-muted-foreground">
              <th className="px-3 py-2">Descripción</th>
              <th className="px-3 py-2 text-center">Unidad</th>
              <th className="px-3 py-2 text-right">Cant.</th>
              <th className="px-3 py-2 text-right">Vr Unit</th>
              <th className="px-3 py-2 text-right">Vr Total</th>
            </tr>
          </thead>
          <tbody>
            {layer.items.map((it) => (
              <tr key={it.id} className="border-b last:border-0">
                <td className="px-3 py-2">{it.description}</td>
                <td className="px-3 py-2 text-center font-mono text-xs">
                  {it.unit}
                </td>
                <td className="px-3 py-2 text-right">
                  {it.quantity.toLocaleString("es-CO")}
                </td>
                <td className="px-3 py-2 text-right">
                  {formatCurrency(it.unitPrice)}
                </td>
                <td className="px-3 py-2 text-right font-semibold">
                  {formatCurrency(it.totalPrice)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CollapsibleContent>
    </Collapsible>
  );
}

function UnforeseenDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAdd: (
    item: Omit<
      BudgetItem,
      "id" | "layerId" | "totalPrice" | "executedQuantity" | "executedAmount"
    >,
  ) => void;
}) {
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState("GL");
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description) return;
    onAdd({ description, unit, quantity, unitPrice });
    setDescription("");
    setUnit("GL");
    setQuantity(1);
    setUnitPrice(0);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo ítem no previsto</DialogTitle>
          <DialogDescription>
            Se creará con el código <strong>CAP### - ITEM NO PREVISTO</strong> y
            se sumará automáticamente al Presupuesto Tope.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Descripción *</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción del ítem"
              required
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Unidad</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GL">GL</SelectItem>
                  <SelectItem value="UN">UN</SelectItem>
                  <SelectItem value="M2">M²</SelectItem>
                  <SelectItem value="M3">M³</SelectItem>
                  <SelectItem value="ML">ML</SelectItem>
                  <SelectItem value="KG">KG</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cantidad</Label>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Vr Unit</Label>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={unitPrice}
                onChange={(e) => setUnitPrice(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="rounded-md bg-secondary/40 p-2 text-right text-sm">
            Total: <strong>{formatCurrency(quantity * unitPrice)}</strong>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit">Crear ítem</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
