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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Upload,
  Building2,
  MapPin,
  FileText,
  Eye,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Layers,
  FileSpreadsheet,
  Calendar,
  Plus,
  AlertTriangle,
  CheckCircle,
  Circle,
  Save,
  Loader2,
  Pencil,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { UploadBudgetDialog } from "../../_components/upload-budget-dialog";

interface PresupuestoDetailClientProps {
  project: any;
  itemStats: {
    total: number;
    green: number;
    yellow: number;
    red: number;
  };
  userRole: string;
  allProjects: any[];
}

export function PresupuestoDetailClient({
  project,
  itemStats,
  userRole,
  allProjects,
}: PresupuestoDetailClientProps) {
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("resumen");
  const [ptIndexInput, setPtIndexInput] = useState<string>("");
  const [editingPtIndex, setEditingPtIndex] = useState(false);
  const [savingPtIndex, setSavingPtIndex] = useState(false);
  const [editingAiu, setEditingAiu] = useState(false);
  const [savingAiu, setSavingAiu] = useState(false);
  const router = useRouter();
  const isAdmin = userRole === "ADMIN";
  const budget = project.budget;
  const [aiuInputs, setAiuInputs] = useState({
    admin: String(project.budget?.adminPercentage ?? 8),
    imprevistos: String(project.budget?.imprevistoPercentage ?? 5),
    utilidad: String(project.budget?.utilidadPercentage ?? 5),
    iva: String(project.budget?.ivaUtilityPercentage ?? 19),
  });
  const activeVersion = budget?.versions?.find((v: any) => v.isActive);

  // Initialize ptIndexInput from budget
  const currentPtIndex = budget?.ptIndexPercentage ?? 100;

  // Calcular diferencia PC vs PT
  const pcVsPtDiff = budget
    ? ((budget.totalPT - budget.totalPC) / budget.totalPC) * 100
    : 0;

  const handleSavePtIndex = async () => {
    const val = parseFloat(ptIndexInput);
    if (isNaN(val) || val < 0 || val > 999) return;
    setSavingPtIndex(true);
    try {
      const res = await fetch(`/api/presupuestos/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ptIndexPercentage: val }),
      });
      if (res.ok) {
        setEditingPtIndex(false);
        router.refresh();
      }
    } catch (err) {
      console.error("Error saving PT index:", err);
    } finally {
      setSavingPtIndex(false);
    }
  };

  const handleSaveAiu = async () => {
    const admin = parseFloat(aiuInputs.admin);
    const imprevistos = parseFloat(aiuInputs.imprevistos);
    const utilidad = parseFloat(aiuInputs.utilidad);
    const iva = parseFloat(aiuInputs.iva);
    if ([admin, imprevistos, utilidad, iva].some((v) => isNaN(v) || v < 0 || v > 100)) return;
    setSavingAiu(true);
    try {
      const res = await fetch(`/api/presupuestos/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminPercentage: admin,
          imprevistoPercentage: imprevistos,
          utilidadPercentage: utilidad,
          ivaUtilityPercentage: iva,
        }),
      });
      if (res.ok) {
        setEditingAiu(false);
        router.refresh();
      }
    } catch (err) {
      console.error("Error saving AIU:", err);
    } finally {
      setSavingAiu(false);
    }
  };

  // Determinar estado del presupuesto
  const getBudgetStatus = () => {
    if (itemStats.red > 0) return { label: "Rojo", color: "text-red-600", icon: TrendingDown };
    if (itemStats.yellow > 0) return { label: "Amarillo", color: "text-yellow-600", icon: AlertTriangle };
    return { label: "Verde", color: "text-green-600", icon: CheckCircle };
  };

  const budgetStatus = getBudgetStatus();
  const StatusIcon = budgetStatus.icon;
  const projectDetailHref = project?.id
    ? `/dashboard/proyectos/${project.id}`
    : "/dashboard/proyectos";

  return (
    <div className="space-y-6">
      {/* Header con navegación */}
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/presupuestos">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Volver
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Presupuesto</span>
            <span>-</span>
            <span>{project.name}</span>
          </div>
          {project.code && (
            <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">
              {project.code}
            </span>
          )}
        </div>
        {isAdmin && (
          <Button onClick={() => setShowUploadDialog(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Cargar presupuesto
          </Button>
        )}
      </div>

      {/* Info del Proyecto */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Building2 className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-600">
                  {project.code && (
                    <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
                      {project.code}
                    </span>
                  )}
                  {project.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {project.location}
                    </span>
                  )}
                </div>
                {/* Capas/Layers */}
                {budget && budget.layers.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {budget.layers.map((layer: any) => (
                      <Badge key={layer.id} variant="outline" className="text-xs">
                        {layer.code} - {layer.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Versión Activa */}
            {activeVersion && (
              <div className="text-right border-l pl-4">
                <p className="text-xs text-gray-500 flex items-center gap-1 justify-end">
                  <FileText className="w-3 h-3" />
                  Versión Activa
                </p>
                <p className="font-semibold">{activeVersion.name}</p>
                <p className="text-xs text-gray-500 flex items-center gap-1 justify-end">
                  <Calendar className="w-3 h-3" />
                  {formatShortDate(activeVersion.createdAt)}
                </p>
                <Button asChild variant="outline" size="sm" className="mt-2">
                  <Link href={projectDetailHref}>
                    <Eye className="w-3 h-3 mr-1" />
                    Ver Detalle del Proyecto
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      {budget ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
            <TabsTrigger value="resumen" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Resumen
            </TabsTrigger>
            <TabsTrigger value="matriz" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Matriz PSC/PT
            </TabsTrigger>
            <TabsTrigger value="adicionales" className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Adicionales
            </TabsTrigger>
            <TabsTrigger value="importar" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Importar
            </TabsTrigger>
          </TabsList>

          {/* Tab Resumen */}
          <TabsContent value="resumen" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* AIU Discriminado */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm text-gray-500">AIU Discriminado</CardTitle>
                    {isAdmin && !editingAiu && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-gray-400 hover:text-gray-700"
                        onClick={() => {
                          setAiuInputs({
                            admin: String(budget.adminPercentage ?? 8),
                            imprevistos: String(budget.imprevistoPercentage ?? 5),
                            utilidad: String(budget.utilidadPercentage ?? 5),
                            iva: String(budget.ivaUtilityPercentage ?? 19),
                          });
                          setEditingAiu(true);
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {editingAiu ? (
                    <div className="space-y-2">
                      {[
                        { key: "admin" as const, label: "Administración" },
                        { key: "imprevistos" as const, label: "Imprevistos" },
                        { key: "utilidad" as const, label: "Utilidad" },
                        { key: "iva" as const, label: "IVA s/Utilidad" },
                      ].map((field) => (
                        <div key={field.key} className="flex items-center justify-between gap-2">
                          <span className="text-sm text-gray-600">{field.label}</span>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              max="100"
                              value={aiuInputs[field.key]}
                              onChange={(e) => setAiuInputs({ ...aiuInputs, [field.key]: e.target.value })}
                              className="w-20 h-7 text-right text-sm"
                              disabled={savingAiu}
                            />
                            <span className="text-xs text-gray-500">%</span>
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-end gap-2 mt-3">
                        <Button size="sm" variant="ghost" onClick={() => setEditingAiu(false)} disabled={savingAiu}>
                          Cancelar
                        </Button>
                        <Button size="sm" onClick={handleSaveAiu} disabled={savingAiu}>
                          {savingAiu ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                          Guardar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Administración</span>
                        <span className="font-semibold">{budget.adminPercentage ?? 8}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Imprevistos</span>
                        <span className="font-semibold">{budget.imprevistoPercentage ?? 5}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Utilidad</span>
                        <span className="font-semibold">{budget.utilidadPercentage ?? 5}%</span>
                      </div>
                      <div className="flex justify-between text-sm border-t pt-1.5">
                        <span className="text-gray-600">IVA s/Utilidad</span>
                        <span className="font-semibold">{budget.ivaUtilityPercentage ?? 19}%</span>
                      </div>
                      <div className="flex justify-between text-sm border-t pt-1.5">
                        <span className="font-medium text-gray-700">Total AIU (A+I+U)</span>
                        <span className="font-bold text-lg">{budget.aiuPercentage}%</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Estado del Presupuesto */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-500">Estado del Presupuesto</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <StatusIcon className={`w-6 h-6 ${budgetStatus.color}`} />
                    <span className={`text-2xl font-bold ${budgetStatus.color}`}>
                      {budgetStatus.label}
                    </span>
                  </div>
                  <div className="flex gap-4 mt-2 text-sm">
                    <span className="text-green-600">{itemStats.green} verdes</span>
                    <span className="text-yellow-600">{itemStats.yellow} amarillos</span>
                    <span className="text-red-600">{itemStats.red} rojos</span>
                  </div>
                </CardContent>
              </Card>

              {/* Total Items */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-500">Total Items</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-bold">{itemStats.total}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    en {budget.layers.length} capas
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* PC y PT */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* PSC - Presupuesto Contratista */}
              <Card className="border-l-4 border-l-green-500">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-green-600" />
                      PSC - Presupuesto Contratista
                    </CardTitle>
                    <Badge variant="outline" className="text-green-600 border-green-300">
                      Referencia
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Costo Directo</span>
                    <span className="font-semibold">
                      {formatCurrency(budget.totalDirectCostPC)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 pl-2">Administración ({budget.adminPercentage ?? 8}%)</span>
                    <span>{formatCurrency(budget.totalDirectCostPC * ((budget.adminPercentage ?? 8) / 100))}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 pl-2">Imprevistos ({budget.imprevistoPercentage ?? 5}%)</span>
                    <span>{formatCurrency(budget.totalDirectCostPC * ((budget.imprevistoPercentage ?? 5) / 100))}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 pl-2">Utilidad ({budget.utilidadPercentage ?? 5}%)</span>
                    <span>{formatCurrency(budget.totalDirectCostPC * ((budget.utilidadPercentage ?? 5) / 100))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">AIU ({budget.aiuPercentage}%)</span>
                    <span className="font-semibold">
                      {formatCurrency(budget.totalAIU_PC)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 pl-2">IVA s/Utilidad ({budget.ivaUtilityPercentage ?? 19}%)</span>
                    <span>{formatCurrency(budget.totalIvaUtilidad_PC ?? 0)}</span>
                  </div>
                  <div className="border-t pt-3 flex justify-between">
                    <span className="font-semibold">Total</span>
                    <span className="text-xl font-bold text-green-700">
                      {formatCurrency(budget.totalPC)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* PT - Presupuesto Tope */}
              <Card className="border-l-4 border-l-blue-500">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingDown className="w-5 h-5 text-blue-600" />
                      PT - Presupuesto Tope
                    </CardTitle>
                    <Badge variant="outline" className="text-blue-600 border-blue-300">
                      Control Interno
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Índice PT editable */}
                  <div className="flex items-center justify-between bg-blue-50 rounded-lg px-3 py-2">
                    <span className="text-sm font-medium text-blue-700">Índice PT</span>
                    {editingPtIndex ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="999"
                          value={ptIndexInput}
                          onChange={(e) => setPtIndexInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSavePtIndex();
                            if (e.key === "Escape") setEditingPtIndex(false);
                          }}
                          className="w-24 h-8 text-right text-sm font-semibold"
                          autoFocus
                          disabled={savingPtIndex}
                        />
                        <span className="text-sm text-blue-700 font-semibold">%</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                          onClick={handleSavePtIndex}
                          disabled={savingPtIndex}
                        >
                          {savingPtIndex ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-blue-700">
                          {currentPtIndex}%
                        </span>
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-blue-500 hover:text-blue-700"
                            onClick={() => {
                              setPtIndexInput(String(currentPtIndex));
                              setEditingPtIndex(true);
                            }}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-600">Costo Directo</span>
                    <span className="font-semibold">
                      {formatCurrency(budget.totalDirectCostPT)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">AIU ({budget.aiuPercentage}%)</span>
                    <span className="font-semibold">
                      {formatCurrency(budget.totalAIU_PT)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 pl-2">IVA s/Utilidad ({budget.ivaUtilityPercentage ?? 19}%)</span>
                    <span>{formatCurrency(budget.totalIvaUtilidad_PT ?? 0)}</span>
                  </div>
                  <div className="border-t pt-3 flex justify-between">
                    <span className="font-semibold">Total</span>
                    <span className="text-xl font-bold text-blue-700">
                      {formatCurrency(budget.totalPT)}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    vs PC:{" "}
                    <span className={pcVsPtDiff < 0 ? "text-red-600" : "text-green-600"}>
                      {pcVsPtDiff > 0 ? "+" : ""}
                      {pcVsPtDiff.toFixed(1)}%
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Nota PCS */}
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-blue-900">PSC vs PT</p>
                    <p className="text-sm text-blue-700 mt-1">
                      <strong>PSC</strong> es lo que el contratista cobra al cliente.{" "}
                      <strong>PT</strong> es el techo interno de costos. El margen se obtiene cuando PSC &gt; PT.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Matriz PSC/PT */}
          <TabsContent value="matriz" className="space-y-6">
            {budget.layers.map((layer: any) => (
              <Card key={layer.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Layers className="w-5 h-5" />
                    {layer.code} - {layer.name}
                    <Badge variant="outline" className="ml-2">
                      {layer.items.length} items
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Item</TableHead>
                          <TableHead>Descripción</TableHead>
                          <TableHead className="w-20 text-center">Und</TableHead>
                          <TableHead className="w-24 text-right">Cant.</TableHead>
                          <TableHead className="w-32 text-right">VR Unit PSC</TableHead>
                          <TableHead className="w-32 text-right">VR Unit PT</TableHead>
                          <TableHead className="w-36 text-right">Total PSC</TableHead>
                          <TableHead className="w-36 text-right">Total PT</TableHead>
                          <TableHead className="w-20 text-center">Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {layer.items.map((item: any) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono text-xs">
                              {item.itemNumber}
                            </TableCell>
                            <TableCell className="max-w-[300px] truncate">
                              {item.description}
                            </TableCell>
                            <TableCell className="text-center">{item.unit}</TableCell>
                            <TableCell className="text-right">
                              {item.quantity.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(item.unitPricePC)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(item.unitPricePT)}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-green-700">
                              {formatCurrency(item.totalPC)}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-blue-700">
                              {formatCurrency(item.totalPT)}
                            </TableCell>
                            <TableCell className="text-center">
                              {item.status === "GREEN" && (
                                <Circle className="w-4 h-4 fill-green-500 text-green-500 mx-auto" />
                              )}
                              {item.status === "YELLOW" && (
                                <Circle className="w-4 h-4 fill-yellow-500 text-yellow-500 mx-auto" />
                              )}
                              {item.status === "RED" && (
                                <Circle className="w-4 h-4 fill-red-500 text-red-500 mx-auto" />
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Subtotales de la capa */}
                        <TableRow className="bg-gray-50 font-semibold">
                          <TableCell colSpan={6} className="text-right">
                            Subtotal {layer.code}
                          </TableCell>
                          <TableCell className="text-right text-green-700">
                            {formatCurrency(layer.totalDirectCostPC)}
                          </TableCell>
                          <TableCell className="text-right text-blue-700">
                            {formatCurrency(layer.totalDirectCostPT)}
                          </TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Tab Adicionales */}
          <TabsContent value="adicionales">
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <Plus className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium">Adicionales</h3>
                <p className="mt-2">
                  La gestión de adicionales estará disponible próximamente.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Importar */}
          <TabsContent value="importar">
            <Card>
              <CardHeader>
                <CardTitle>Archivos Importados</CardTitle>
              </CardHeader>
              <CardContent>
                {project.budgetFiles && project.budgetFiles.length > 0 ? (
                  <div className="space-y-3">
                    {project.budgetFiles.map((file: any) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <FileSpreadsheet className="w-8 h-8 text-green-600" />
                          <div>
                            <p className="font-medium">{file.fileName}</p>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <span>Capa: {file.layerCode || "N/A"}</span>
                              <span>•</span>
                              <span>{file.itemsImported} items</span>
                              <span>•</span>
                              <span>{formatShortDate(file.uploadedAt)}</span>
                            </div>
                          </div>
                        </div>
                        {file.sharepointPath && (
                          <Badge variant="outline" className="text-blue-600">
                            SharePoint ✓
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-gray-500">
                    <Upload className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No hay archivos importados aún.</p>
                    {isAdmin && (
                      <Button
                        className="mt-4"
                        onClick={() => setShowUploadDialog(true)}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Importar Presupuesto
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        /* Sin presupuesto */
        <Card>
          <CardContent className="py-12 text-center">
            <FileSpreadsheet className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-xl font-semibold text-gray-700">Sin Presupuesto</h3>
            <p className="text-gray-500 mt-2 max-w-md mx-auto">
              Este proyecto aún no tiene un presupuesto cargado.
              Importe un archivo Excel para comenzar a gestionar el presupuesto.
            </p>
            {isAdmin && (
              <Button className="mt-6" onClick={() => setShowUploadDialog(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Cargar Primer Presupuesto
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog de Carga */}
      <UploadBudgetDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        projects={allProjects.map((p) => ({ ...p, budget: null }))}
      />
    </div>
  );
}
