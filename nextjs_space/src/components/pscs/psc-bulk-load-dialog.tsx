"use client";

// src/components/pscs/psc-bulk-load-dialog.tsx
//
// Dialog de carga masiva de PSC (Corte 6). 2-step flow:
//   Step 1 (actions): Descargar plantilla / Subir Excel
//   Step 2 (preview): 3 stat cards + tabla matched (verde) + tabla unmatched (amarillo)
//
// Spec: docs/specs/audit-corte-6-psc-carga-masiva.md §4.3

import { useState } from "react";
import {
  Download,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  parsePscExcelFile,
  generatePscTemplate,
  type PscImportPtItem,
  type PscImportItem,
  type PscImportResult,
} from "@/lib/psc-excel";
import { formatCurrency } from "@/lib/utils";

interface PscBulkLoadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ptItems: PscImportPtItem[];
  projectName: string;
  onConfirm: (items: PscImportItem[]) => void;
}

export function PscBulkLoadDialog({
  open,
  onOpenChange,
  ptItems,
  projectName,
  onConfirm,
}: PscBulkLoadDialogProps) {
  const [step, setStep] = useState<"actions" | "preview">("actions");
  const [parsed, setParsed] = useState<PscImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function resetDialog() {
    setStep("actions");
    setParsed(null);
    setError(null);
    setLoading(false);
  }

  function handleDownload() {
    if (ptItems.length === 0) return;
    try {
      const blob = generatePscTemplate(ptItems, projectName);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = projectName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      a.download = `PSC-${safeName || "proyecto"}-plantilla.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al generar la plantilla",
      );
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const result = await parsePscExcelFile(file, ptItems);
      setParsed(result);
      setStep("preview");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `No se pudo leer el archivo "${file.name}".`,
      );
    } finally {
      setLoading(false);
      // Resetear el input para permitir re-subir el mismo archivo
      e.target.value = "";
    }
  }

  function handleConfirm() {
    if (!parsed) return;
    const included = parsed.items.filter((it) => it.included);
    onConfirm(included);
    resetDialog();
    onOpenChange(false);
  }

  function handleBack() {
    setStep("actions");
    setParsed(null);
  }

  function handleCancel() {
    resetDialog();
    onOpenChange(false);
  }

  const matchedItems = parsed?.items.filter((it) => it.ptItem) ?? [];
  const unmatchedItems = parsed?.items.filter((it) => !it.ptItem) ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetDialog();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Carga masiva de PSC</DialogTitle>
          <DialogDescription>
            Proyecto: <span className="font-mono">{projectName || "(sin nombre)"}</span>
            {ptItems.length > 0 && ` — ${ptItems.length} items disponibles en el PT`}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {step === "actions" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Download className="h-4 w-4" />
                    1. Descargar plantilla
                  </CardTitle>
                  <CardDescription>
                    Genera un Excel con los {ptItems.length} items del PT.
                    El contratista marca con S los que va a ejecutar y llena la cantidad.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={handleDownload}
                    className="w-full"
                    disabled={ptItems.length === 0}
                  >
                    Descargar plantilla
                    <Download className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Upload className="h-4 w-4" />
                    2. Subir Excel
                  </CardTitle>
                  <CardDescription>
                    Sube el Excel del contratista (plantilla llenada o Excel propio
                    con la misma estructura: 5 columnas).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <label className="block">
                    <div className="rounded-lg border-2 border-dashed bg-secondary/30 p-6 text-center cursor-pointer transition-colors hover:bg-accent">
                      <FileSpreadsheet className="mx-auto h-8 w-8 text-muted-foreground" />
                      <p className="mt-2 text-sm font-medium">
                        {loading ? "Procesando..." : "Arrastra un archivo .xlsx aquí"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        o haz click para seleccionar
                      </p>
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleFileUpload}
                        className="hidden"
                        disabled={loading}
                      />
                    </div>
                  </label>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {step === "preview" && parsed && (
          <div className="space-y-4">
            {/* Stat cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-center">
                <p className="text-2xl font-semibold text-emerald-700">
                  {parsed.matchedCount}
                </p>
                <p className="text-xs text-muted-foreground">Encontrados</p>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-center">
                <p className="text-2xl font-semibold text-amber-700">
                  {parsed.unmatchedCount}
                </p>
                <p className="text-xs text-muted-foreground">No encontrados</p>
              </div>
              <div className="rounded-md border bg-secondary/40 p-3 text-center">
                <p className="text-lg font-semibold">
                  {formatCurrency(parsed.totalValue)}
                </p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>

            {parsed.warnings.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Advertencias</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4 text-xs">
                    {parsed.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Tabla matched (verde) */}
            {matchedItems.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-emerald-700">
                  ✓ Items encontrados en el PT ({matchedItems.length})
                </h3>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-emerald-50 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">Fila</th>
                        <th className="px-3 py-2 text-left">Descripción</th>
                        <th className="px-3 py-2 text-center">Unidad</th>
                        <th className="px-3 py-2 text-right">P. Unit.</th>
                        <th className="px-3 py-2 text-right">Cantidad</th>
                        <th className="px-3 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matchedItems.map((it) => (
                        <tr key={it.excelRow} className="border-t">
                          <td className="px-3 py-1.5 text-muted-foreground text-xs">
                            {it.excelRow}
                          </td>
                          <td className="px-3 py-1.5">{it.description}</td>
                          <td className="px-3 py-1.5 text-center font-mono text-xs">
                            {it.unit}
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            {formatCurrency(it.unitPrice)}
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            {it.quantity.toLocaleString("es-CO")}
                          </td>
                          <td className="px-3 py-1.5 text-right font-semibold">
                            {formatCurrency(it.totalPrice)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tabla unmatched (amarillo) */}
            {unmatchedItems.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-amber-700">
                  ⚠ No encontrados en el PT ({unmatchedItems.length})
                </h3>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-amber-50 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">Fila</th>
                        <th className="px-3 py-2 text-left">Descripción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unmatchedItems.map((it) => (
                        <tr key={it.excelRow} className="border-t">
                          <td className="px-3 py-1.5 text-muted-foreground text-xs">
                            {it.excelRow}
                          </td>
                          <td className="px-3 py-1.5">
                            {it.description || "(vacío)"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {parsed.matchedCount === 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Ningún item del Excel matchea con el PT</AlertTitle>
                <AlertDescription>
                  Verifica que sea el Excel correcto del proyecto {projectName}.
                  Estos items NO se agregarán al PSC.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "actions" && (
            <Button variant="outline" onClick={handleCancel}>
              Cancelar
            </Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={handleBack}>
                Atrás
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={parsed?.matchedCount === 0 || loading}
              >
                Confirmar {parsed?.matchedCount ?? 0} items
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
