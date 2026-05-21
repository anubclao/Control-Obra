"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, History, CheckCircle2, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getHttpErrorMessage, getRequestErrorMessage } from "@/lib/utils";

interface BudgetVersion {
  id: string;
  versionNumber: number;
  isActive: boolean;
  totalPC: number;
  totalPT: number;
  totalDirectCostPC: number;
  totalDirectCostPT: number;
  createdAt: string;
}

interface ContractorBudgetHistoryProps {
  contractId: string;
  onBudgetChanged?: () => void;
}

export function ContractorBudgetHistory({
  contractId,
  onBudgetChanged,
}: ContractorBudgetHistoryProps) {
  const { toast } = useToast();
  const [budgets, setBudgets] = useState<BudgetVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const fetchBudgetHistory = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch(
        `/api/contratos/${contractId}/presupuestos`
      );

      if (!response.ok) {
        const message = await getHttpErrorMessage(
          response,
          "Error al cargar historial de presupuestos"
        );
        throw new Error(message);
      }

      const data = await response.json();
      setBudgets(data.budgets || []);
    } catch (err) {
      const message = getRequestErrorMessage(
        err,
        "Error al cargar historial de presupuestos",
        { networkMessage: "Error de red al cargar el historial. Verifica tu conexion e intenta de nuevo." }
      );
      setError(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgetHistory();
  }, [contractId]);

  const handleActivateBudget = async (budgetId: string, versionNumber: number) => {
    try {
      setActivatingId(budgetId);
      const response = await fetch(
        `/api/contratos/${contractId}/presupuestos/${budgetId}`,
        {
          method: "PUT",
        }
      );

      if (!response.ok) {
        const message = await getHttpErrorMessage(
          response,
          "Error al cambiar presupuesto activo"
        );
        throw new Error(message);
      }

      await fetchBudgetHistory();
      onBudgetChanged?.();

      toast({
        title: "Éxito",
        description: `Presupuesto v${versionNumber} activado exitosamente`,
      });
    } catch (err) {
      const message = getRequestErrorMessage(
        err,
        "Error al cambiar presupuesto activo",
        { networkMessage: "Error de red al cambiar presupuesto activo. Verifica tu conexion e intenta de nuevo." }
      );
      setError(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setActivatingId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historial de Presupuestos
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (budgets.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historial de Presupuestos
          </CardTitle>
          <CardDescription>
            No hay presupuestos cargados para este contratista
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && (
            <Alert variant="destructive">
              <AlertDescription className="flex items-center justify-between gap-3">
                <span>{error}</span>
                <Button size="sm" variant="outline" onClick={fetchBudgetHistory}>
                  Reintentar
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {!error && (
            <Button size="sm" variant="outline" onClick={fetchBudgetHistory}>
              Recargar historial
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Historial de Presupuestos
        </CardTitle>
        <CardDescription>
          {budgets.length} presupuesto{budgets.length !== 1 ? "s" : ""} cargado
          {budgets.length !== 1 ? "s" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <Alert variant="destructive">
            <AlertDescription className="flex items-center justify-between gap-3">
              <span>{error}</span>
              <Button size="sm" variant="outline" onClick={fetchBudgetHistory}>
                Reintentar
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          {budgets.map((budget) => (
            <div
              key={budget.id}
              className="border rounded-lg p-4 space-y-3 dark:border-gray-700"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">
                      Versión {budget.versionNumber}
                    </span>
                    {budget.isActive && (
                      <Badge className="bg-green-600 hover:bg-green-700 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Activo
                      </Badge>
                    )}
                    {!budget.isActive && (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Anterior
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {new Date(budget.createdAt).toLocaleDateString("es-ES", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>

              {/* Resumen de montos */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <p className="text-gray-600 dark:text-gray-400">
                    Costo Directo
                  </p>
                  <p className="font-semibold">
                    PC: ${budget.totalDirectCostPC.toLocaleString("es-ES", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                  <p className="font-semibold text-sm">
                    PT: ${budget.totalDirectCostPT.toLocaleString("es-ES", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-gray-600 dark:text-gray-400">Total</p>
                  <p className="font-semibold text-green-600">
                    PC: ${budget.totalPC.toLocaleString("es-ES", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                  <p className="font-semibold text-sm text-green-600">
                    PT: ${budget.totalPT.toLocaleString("es-ES", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
              </div>

              {/* Botón de activación */}
              {!budget.isActive && (
                <Button
                  onClick={() =>
                    handleActivateBudget(budget.id, budget.versionNumber)
                  }
                  disabled={activatingId === budget.id}
                  size="sm"
                  className="w-full"
                >
                  {activatingId === budget.id && (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  )}
                  Usar esta versión
                </Button>
              )}
            </div>
          ))}
        </div>

        {budgets.length > 1 && (
          <Alert className="mt-4">
            <AlertDescription>
              Tienes {budgets.length} versiones de presupuesto. Solo la versión
              activa se usará para registrar avances del contratista.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
