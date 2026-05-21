"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { getHttpErrorMessage, getRequestErrorMessage } from "@/lib/utils";
import { ContractorPresupuestoUploadDialog } from "./contractor-presupuesto-upload-dialog";
import { ContractorBudgetHistory } from "@/components/contractor-budget-history";

interface ContractorBudgetSectionProps {
  contractId: string;
  contractStatus: string;
  onBudgetLoaded?: () => void;
}

export function ContractorBudgetSection({
  contractId,
  contractStatus,
  onBudgetLoaded,
}: ContractorBudgetSectionProps) {
  const [loading, setLoading] = useState(true);
  const [budget, setBudget] = useState<any>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [refreshHistory, setRefreshHistory] = useState(false);

  // Cargar presupuesto activo si existe
  const loadBudget = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/contratos/${contractId}/presupuesto`);
      if (res.ok) {
        const data = await res.json();
        setBudget(data);
      } else if (res.status === 404) {
        setBudget(null);
      } else {
        const message = await getHttpErrorMessage(
          res,
          "No fue posible cargar el presupuesto del contratista.",
          {
            serverErrorMessage:
              "Error del servidor al cargar el presupuesto. Intenta nuevamente en unos segundos.",
          }
        );
        setLoadError(message);
      }
    } catch (error) {
      console.error("Error loading budget:", error);
      const message = getRequestErrorMessage(
        error,
        "No fue posible cargar el presupuesto del contratista.",
        {
          networkMessage:
            "Error de red al cargar el presupuesto. Verifica tu conexion e intenta de nuevo.",
        }
      );
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBudget();
  }, [contractId]);

  const isEnabled = contractStatus === "ENABLED";

  const handleBudgetUploaded = () => {
    loadBudget();
    onBudgetLoaded?.();
    setRefreshHistory(!refreshHistory);
  };

  const handleBudgetChanged = () => {
    loadBudget();
    onBudgetLoaded?.();
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Presupuesto del Contratista</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">Cargando presupuesto...</p>
        </CardContent>
      </Card>
    );
  }

  if (!budget) {
    return (
      <>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Presupuesto del Contratista</CardTitle>
              {isEnabled && (
                <Button
                  size="sm"
                  onClick={() => setDialogOpen(true)}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Cargar Presupuesto
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loadError && (
              <Alert variant="destructive" className="mb-3">
                <AlertDescription>{loadError}</AlertDescription>
              </Alert>
            )}
            {isEnabled ? (
              <p className="text-sm text-gray-500">
                No hay presupuesto asignado. Carga uno para registrar gastos.
              </p>
            ) : (
              <p className="text-sm text-gray-500">
                No hay presupuesto asignado. Habilita el contrato para poder cargarlo.
              </p>
            )}
            <div className="mt-3">
              <Button size="sm" variant="outline" onClick={loadBudget}>
                Reintentar carga
              </Button>
            </div>
          </CardContent>
        </Card>

        {isEnabled && (
          <ContractorPresupuestoUploadDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            contractId={contractId}
            onUploaded={handleBudgetUploaded}
          />
        )}
      </>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Presupuesto del Contratista (Activo)</CardTitle>
            {isEnabled ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDialogOpen(true)}
              >
                <Upload className="h-4 w-4 mr-2" />
                Cargar Nuevo
              </Button>
            ) : (
              <p className="text-xs text-gray-500">
                Contrato no habilitado (solo lectura)
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadError && (
            <Alert variant="destructive">
              <AlertDescription className="flex items-center justify-between gap-3">
                <span>{loadError}</span>
                <Button size="sm" variant="outline" onClick={loadBudget}>
                  Reintentar
                </Button>
              </AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Costo Directo PC</p>
              <p className="text-lg font-bold text-blue-600">
                {formatCurrency(budget.totalDirectCostPC)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total PC</p>
              <p className="text-lg font-bold text-green-600">
                {formatCurrency(budget.totalPC)}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {budget.layers?.map((layer: any) => (
              <div key={layer.id} className="border-t pt-3 first:border-t-0 first:pt-0 dark:border-gray-700">
                <p className="font-medium text-sm">{layer.code} - {layer.name}</p>
                <p className="text-xs text-gray-500">
                  {layer.items?.length || 0} ítems
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Historial de presupuestos */}
      <ContractorBudgetHistory
        key={refreshHistory.toString()}
        contractId={contractId}
        onBudgetChanged={handleBudgetChanged}
      />

      {/* Diálogo de carga */}
      {isEnabled && (
        <ContractorPresupuestoUploadDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          contractId={contractId}
          onUploaded={handleBudgetUploaded}
        />
      )}
    </>
  );
}
