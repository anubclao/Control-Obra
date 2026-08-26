"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useBudgetsStore } from "@/lib/data-store";
import { useProjectsStore } from "@/lib/data-store";
import { parseExcelContent, buildBudgetLayers, SAMPLE_EXCEL_DATA, type ParsedExcel } from "@/lib/excel-parser";
import { formatCurrency } from "@/lib/utils";

export default function CargarPresupuestoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") || "";
  const { createPT, hasBudget } = useBudgetsStore();
  const { getProject, projects } = useProjectsStore();

  const [step, setStep] = useState<"upload" | "preview" | "confirm">("upload");
  const [parsed, setParsed] = useState<ParsedExcel | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const project = getProject(projectId);
  const alreadyHasPT = projectId ? hasBudget(projectId) : false;

  function loadSample() {
    setError(null);
    const result = parseExcelContent(SAMPLE_EXCEL_DATA);
    setParsed(result);
    setStep("preview");
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Mock: en producción se leería el archivo con xlsx/SheetJS
    // Por ahora asumimos que el archivo tiene la misma estructura que SAMPLE_EXCEL_DATA
    setError(
      `Mock: la carga real con "${file.name}" se conectará cuando integremos la librería Excel. Por ahora usa "Cargar muestra" para probar el flujo.`
    );
  }

  function handleConfirm() {
    if (!parsed || !projectId) return;
    setError(null);
    setSubmitting(true);

    const layers = buildBudgetLayers(parsed.rows);
    const result = createPT(projectId, layers, notes);

    if (!result.ok) {
      setError(result.error || "Error al crear el presupuesto");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    router.push(`/tecnico/presupuestos/${projectId}`);
  }

  if (!projectId) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/tecnico/presupuestos">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Presupuestos
          </Link>
        </Button>
        <div className="rounded-lg border bg-card p-6">
          <h1 className="text-xl font-semibold">Selecciona un proyecto</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Primero elige un proyecto desde la lista de presupuestos.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/tecnico/presupuestos/cargar?projectId=${p.id}`}
                className="rounded-md border bg-secondary/30 p-3 text-sm hover:bg-accent"
              >
                <p className="font-mono text-xs text-muted-foreground">{p.code}</p>
                <p className="font-medium">{p.name}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (alreadyHasPT && step !== "preview" && step !== "confirm") {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/tecnico/presupuestos">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Presupuestos
          </Link>
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Este proyecto ya tiene un PT</AlertTitle>
          <AlertDescription>
            <p className="mb-2">
              El proyecto <strong>{project?.name}</strong> ya tiene un Presupuesto Tope cargado.
              No se puede cargar otro. Para reemplazarlo, abre el presupuesto existente y crea una nueva versión.
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href={`/tecnico/presupuestos/${projectId}`}>
                Ir al presupuesto existente
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/tecnico/presupuestos">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Presupuestos
        </Link>
      </Button>

      <div>
        <p className="font-mono text-xs text-muted-foreground">{project?.code}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Cargar Presupuesto Tope (PT)
        </h1>
        <p className="text-sm text-muted-foreground">{project?.name}</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stepper */}
      <div className="flex items-center gap-2 text-sm">
        <Step n={1} label="Subir archivo" active={step === "upload"} done={step !== "upload"} />
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        <Step n={2} label="Previsualizar" active={step === "preview"} done={step === "confirm"} />
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        <Step n={3} label="Confirmar" active={step === "confirm"} done={false} />
      </div>

      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Subir archivo Excel
            </CardTitle>
            <CardDescription>
              El archivo debe tener columnas: Código, Descripción, Unidad, Cantidad, Precio Unitario
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block">
              <div className="rounded-lg border-2 border-dashed bg-secondary/30 p-8 text-center cursor-pointer transition-colors hover:bg-accent">
                <FileSpreadsheet className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">Arrastra un archivo .xlsx aquí</p>
                <p className="text-xs text-muted-foreground">o haz click para seleccionar</p>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </label>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">O prueba con</span>
              </div>
            </div>

            <Button onClick={loadSample} variant="outline" className="w-full">
              <Sparkles className="mr-2 h-4 w-4 text-amber-500" />
              Cargar archivo de muestra (3 capítulos, 8 ítems)
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "preview" && parsed && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Previsualización</CardTitle>
                <CardDescription>
                  Revisa los datos antes de confirmar
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setStep("upload")}>
                <X className="mr-1 h-4 w-4" />
                Cambiar archivo
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Resumen */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-md border bg-secondary/40 p-3">
                <p className="text-xs text-muted-foreground">Capítulos</p>
                <p className="text-2xl font-semibold">{parsed.chapterCount}</p>
              </div>
              <div className="rounded-md border bg-secondary/40 p-3">
                <p className="text-xs text-muted-foreground">Ítems</p>
                <p className="text-2xl font-semibold">{parsed.itemCount}</p>
              </div>
              <div className="rounded-md border bg-secondary/40 p-3">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-semibold">{formatCurrency(parsed.totalValue)}</p>
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

            {/* Tabla de preview */}
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-secondary/30 text-left text-xs uppercase text-muted-foreground">
                    <th className="px-3 py-2">Fila</th>
                    <th className="px-3 py-2">Código</th>
                    <th className="px-3 py-2">Descripción</th>
                    <th className="px-3 py-2 text-center">Tipo</th>
                    <th className="px-3 py-2 text-center">Unidad</th>
                    <th className="px-3 py-2 text-right">Cantidad</th>
                    <th className="px-3 py-2 text-right">P. Unit.</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.map((row) => (
                    <tr key={row.rowNumber} className="border-b last:border-0">
                      <td className="px-3 py-1.5 text-muted-foreground text-xs">{row.rowNumber}</td>
                      <td className="px-3 py-1.5 font-mono text-xs">{row.code}</td>
                      <td className="px-3 py-1.5">{row.description}</td>
                      <td className="px-3 py-1.5 text-center">
                        {row.layerType === "CHAPTER" ? (
                          <Badge variant="info" className="text-[10px]">CAP</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">ITEM</Badge>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-center font-mono text-xs">{row.unit}</td>
                      <td className="px-3 py-1.5 text-right">
                        {row.quantity ? row.quantity.toLocaleString("es-CO") : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        {row.unitPrice ? formatCurrency(row.unitPrice) : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right font-semibold">
                        {row.totalPrice ? formatCurrency(row.totalPrice) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between gap-2 border-t pt-4">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Atrás
              </Button>
              <Button onClick={() => setStep("confirm")}>
                Continuar
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "confirm" && parsed && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Confirmar carga
            </CardTitle>
            <CardDescription>
              Se creará el PT v1 para {project?.name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Resumen</AlertTitle>
              <AlertDescription>
                <p>Se creará el Presupuesto Tope con {parsed.chapterCount} capítulos y {parsed.itemCount} ítems por un total de <strong>{formatCurrency(parsed.totalValue)}</strong>.</p>
              </AlertDescription>
            </Alert>

            <div>
              <Label className="mb-1.5 block">Notas / versión (opcional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: PT inicial del proyecto, v1 basado en APU oficial…"
                rows={2}
              />
            </div>

            <div className="flex justify-between gap-2 border-t pt-4">
              <Button variant="outline" onClick={() => setStep("preview")}>
                Atrás
              </Button>
              <Button onClick={handleConfirm} disabled={submitting}>
                {submitting ? "Creando…" : "Crear Presupuesto Tope"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Step({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
          done
            ? "bg-emerald-600 text-white"
            : active
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-muted-foreground"
        }`}
      >
        {done ? "✓" : n}
      </div>
      <span className={active || done ? "font-medium" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}
