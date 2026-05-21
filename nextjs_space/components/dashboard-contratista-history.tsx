"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";

type ContratistaProyecto = {
  id: string;
  name: string;
  nit: string;
  contractId: string;
  contractNumber: string;
  contractStatus: string;
  hasBudget: boolean;
};

type ProgressEntry = {
  quantityToday: number;
  status: string;
};

type BudgetItem = {
  id: string;
  itemNumber: string;
  description: string;
  unit: string;
  quantity: number;
  totalPC: number;
  totalPT: number;
  progressEntries?: ProgressEntry[];
};

type BudgetLayer = {
  id: string;
  items: BudgetItem[];
};

type PresupuestoContratista = {
  id: string;
  layers?: BudgetLayer[];
};

type PresupuestoProyectoItem = {
  id: string;
  itemNumber: string;
  description: string;
  unit: string;
  quantity: number;
  totalPC: number;
  totalPT: number;
};

export default function HistorialAvanceContratista({ projectId }: { projectId: string }) {
  const [contratistas, setContratistas] = useState<ContratistaProyecto[]>([]);
  const [contratistaFiltro, setContratistaFiltro] = useState("");
  const [modoFiltro, setModoFiltro] = useState<"all" | "enabled" | "with-budget" | "enabled-with-budget">(
    "enabled-with-budget"
  );
  const [contratistaSeleccionado, setContratistaSeleccionado] = useState<ContratistaProyecto | null>(null);
  const [presupuesto, setPresupuesto] = useState<PresupuestoContratista | null>(null);
  const [presupuestoProyectoItems, setPresupuestoProyectoItems] = useState<PresupuestoProyectoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingContratistas, setLoadingContratistas] = useState(false);
  const [loadingPresupuestoProyecto, setLoadingPresupuestoProyecto] = useState(false);
  const [error, setError] = useState("");
  const [errorPresupuestoProyecto, setErrorPresupuestoProyecto] = useState("");

  // --- estado del formulario de registro de avance ---
  const [mostrarFormAvance, setMostrarFormAvance] = useState(false);
  const [fechaAvance, setFechaAvance] = useState(() => new Date().toISOString().split("T")[0]);
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const [ultimasCantidadesGuardadas, setUltimasCantidadesGuardadas] = useState<Record<string, string>>({});
  const [notasAvance, setNotasAvance] = useState("");
  const [personalCount, setPersonalCount] = useState("");
  const [savingAvance, setSavingAvance] = useState(false);
  const [errorAvance, setErrorAvance] = useState("");
  const [successAvance, setSuccessAvance] = useState("");

  useEffect(() => {
    setLoadingContratistas(true);
    setError("");

    axios
      .get(`/api/proyectos/${projectId}/contratistas`)
      .then((res) => {
        setContratistas(res.data || []);
      })
      .catch(() => {
        setError("No se pudieron cargar los contratistas del proyecto.");
      })
      .finally(() => {
        setLoadingContratistas(false);
      });
  }, [projectId]);

  useEffect(() => {
    setLoadingPresupuestoProyecto(true);
    setErrorPresupuestoProyecto("");

    axios
      .get(`/api/presupuestos/${projectId}`)
      .then((res) => {
        const layers = res?.data?.project?.budget?.layers || [];
        const items = layers.flatMap((layer: { items?: PresupuestoProyectoItem[] }) => layer.items || []);
        setPresupuestoProyectoItems(items);
      })
      .catch(() => {
        setPresupuestoProyectoItems([]);
        setErrorPresupuestoProyecto("No se pudo cargar el presupuesto inicial del proyecto para comparar.");
      })
      .finally(() => {
        setLoadingPresupuestoProyecto(false);
      });
  }, [projectId]);

  const cargarPresupuesto = useCallback((contractId: string) => {
    setLoading(true);
    setError("");
    axios
      .get(`/api/contratos/${contractId}/presupuesto`)
      .then((res) => {
        setPresupuesto(res.data);
      })
      .catch(() => {
        setPresupuesto(null);
        setError("No se encontró presupuesto para este contratista.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (contratistaSeleccionado) {
      cargarPresupuesto(contratistaSeleccionado.contractId);
      // resetear form al cambiar contratista
      setMostrarFormAvance(false);
      setCantidades({});
      setUltimasCantidadesGuardadas({});
      setNotasAvance("");
      setPersonalCount("");
      setErrorAvance("");
      setSuccessAvance("");
    }
  }, [contratistaSeleccionado, cargarPresupuesto]);

  const contratistasFiltrados = useMemo(
    () =>
      contratistas.filter((contratista) => {
        const isEnabled = contratista.contractStatus === "ENABLED";
        const hasBudget = contratista.hasBudget;

        if (modoFiltro === "enabled" && !isEnabled) return false;
        if (modoFiltro === "with-budget" && !hasBudget) return false;
        if (modoFiltro === "enabled-with-budget" && (!isEnabled || !hasBudget)) return false;

        const text = contratistaFiltro.trim().toLowerCase();
        if (!text) return true;

        return (
          contratista.name.toLowerCase().includes(text) ||
          contratista.contractNumber.toLowerCase().includes(text) ||
          contratista.nit.toLowerCase().includes(text)
        );
      }),
    [contratistas, contratistaFiltro, modoFiltro]
  );

  useEffect(() => {
    if (!contratistaSeleccionado) return;

    const sigueDisponible = contratistasFiltrados.some(
      (contratista) => contratista.contractId === contratistaSeleccionado.contractId
    );

    if (!sigueDisponible) {
      setContratistaSeleccionado(null);
      setPresupuesto(null);
    }
  }, [contratistaSeleccionado, contratistasFiltrados]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(value || 0);

  const getApprovedExecutedQuantity = (item: BudgetItem) =>
    (item.progressEntries || [])
      .filter((entry) => !entry.status || entry.status === "APPROVED")
      .reduce((sum, entry) => sum + (entry.quantityToday || 0), 0);

  const getRemainingQuantity = (item: BudgetItem) =>
    Math.max(0, item.quantity - getApprovedExecutedQuantity(item));

  const getItemProgress = (item: BudgetItem) => {
    const totalEjecutado = getApprovedExecutedQuantity(item);

    if (!item.quantity || item.quantity <= 0) {
      return "-";
    }

    const avance = (totalEjecutado / item.quantity) * 100;
    return `${avance.toFixed(2)}%`;
  };

  const getApprovedExecutedLabel = (item: BudgetItem) => {
    const totalEjecutado = getApprovedExecutedQuantity(item);

    return `${totalEjecutado.toFixed(2)} / ${item.quantity.toFixed(2)} ${item.unit || ""}`.trim();
  };

  const getApprovedProgressMeta = (item: BudgetItem) => {
    const totalEjecutado = getApprovedExecutedQuantity(item);

    if (!item.quantity || item.quantity <= 0) {
      return {
        textClass: "text-gray-500",
      };
    }

    const ratio = totalEjecutado / item.quantity;

    if (ratio <= 0) {
      return {
        textClass: "text-gray-500",
      };
    }

    if (ratio < 1) {
      return {
        textClass: "text-amber-700 font-medium",
      };
    }

    if (ratio === 1) {
      return {
        textClass: "text-green-700 font-semibold",
      };
    }

    return {
      textClass: "text-blue-700 font-semibold",
    };
  };

  const budgetItems = presupuesto?.layers?.flatMap((layer) => layer.items) || [];

  const contractorStats = useMemo(() => {
    const totalItems = budgetItems.length;
    let completedItems = 0;
    let inProgressItems = 0;
    let pendingItems = 0;
    let totalQuantity = 0;
    let totalApprovedExecuted = 0;
    let totalPC = 0;
    let totalPT = 0;
    let executedPC = 0;
    let executedPT = 0;

    budgetItems.forEach((item) => {
      const approved = getApprovedExecutedQuantity(item);
      const boundedApproved = Math.min(approved, item.quantity);
      const executionFactor = item.quantity > 0 ? boundedApproved / item.quantity : 0;

      totalQuantity += item.quantity;
      totalApprovedExecuted += boundedApproved;
      totalPC += item.totalPC;
      totalPT += item.totalPT;
      executedPC += item.totalPC * executionFactor;
      executedPT += item.totalPT * executionFactor;

      if (approved >= item.quantity && item.quantity > 0) {
        completedItems += 1;
      } else if (approved > 0) {
        inProgressItems += 1;
      } else {
        pendingItems += 1;
      }
    });

    const overallProgress = totalQuantity > 0 ? (totalApprovedExecuted / totalQuantity) * 100 : 0;
    const pendingPC = Math.max(0, totalPC - executedPC);
    const pendingPT = Math.max(0, totalPT - executedPT);
    const pcProgress = totalPC > 0 ? (executedPC / totalPC) * 100 : 0;
    const ptProgress = totalPT > 0 ? (executedPT / totalPT) * 100 : 0;

    return {
      totalItems,
      completedItems,
      inProgressItems,
      pendingItems,
      overallProgress,
      executedPC,
      executedPT,
      pendingPC,
      pendingPT,
      pcProgress,
      ptProgress,
    };
  }, [budgetItems]);

  const itemsConExceso = useMemo(() => {
    return budgetItems.reduce((count, item) => {
      const qty = Number(cantidades[item.id] || 0);
      if (qty > getRemainingQuantity(item)) {
        return count + 1;
      }
      return count;
    }, 0);
  }, [budgetItems, cantidades]);

  const getProgressTone = (percentage: number) => {
    if (percentage >= 80) {
      return {
        border: "border-cyan-200",
        label: "text-cyan-700",
        value: "text-cyan-800",
        track: "bg-cyan-100",
        bar: "bg-cyan-500",
        meta: "text-cyan-700",
      };
    }

    if (percentage >= 40) {
      return {
        border: "border-indigo-200",
        label: "text-indigo-700",
        value: "text-indigo-800",
        track: "bg-indigo-100",
        bar: "bg-indigo-500",
        meta: "text-indigo-700",
      };
    }

    return {
      border: "border-slate-300",
      label: "text-slate-700",
      value: "text-slate-800",
      track: "bg-slate-200",
      bar: "bg-slate-500",
      meta: "text-slate-700",
    };
  };

  const presupuestoProyectoPorItem = useMemo(() => {
    const map = new Map<string, PresupuestoProyectoItem>();
    presupuestoProyectoItems.forEach((item) => {
      map.set(item.itemNumber, item);
    });
    return map;
  }, [presupuestoProyectoItems]);

  const handleGuardarAvance = async () => {
    if (!contratistaSeleccionado) return;

    const entries = Object.entries(cantidades)
      .filter(([, val]) => val !== "" && Number(val) > 0)
      .map(([budgetItemId, quantityToday]) => {
        const item = budgetItems.find((it) => it.id === budgetItemId);
        const qty = Number(quantityToday);
        const exceedsQuantity = item ? qty > getRemainingQuantity(item) : false;
        return { budgetItemId, quantityToday: qty, exceedsQuantity };
      });

    if (entries.length === 0) {
      setErrorAvance("Debes ingresar al menos una cantidad mayor que cero.");
      return;
    }
    if (!fechaAvance) {
      setErrorAvance("La fecha es requerida.");
      return;
    }

    const totalItems = entries.length;
    const totalCantidad = entries.reduce((sum, entry) => sum + entry.quantityToday, 0);
    const totalExcedidos = entries.filter((entry) => entry.exceedsQuantity).length;
    const confirmacion = window.confirm(
      `Se guardara un avance con ${totalItems} item(s) y cantidad total ${totalCantidad.toFixed(2)}.${totalExcedidos > 0 ? `\n\nAtencion: ${totalExcedidos} item(s) exceden el pendiente y quedaran sujetos a aprobacion del administrador.` : ""}\n\nDeseas continuar?`
    );

    if (!confirmacion) {
      return;
    }

    setSavingAvance(true);
    setErrorAvance("");
    setSuccessAvance("");

    try {
      await axios.post(`/api/contratos/${contratistaSeleccionado.contractId}/avances`, {
        date: fechaAvance,
        generalNotes: notasAvance || undefined,
        personnelCount: personalCount ? Number(personalCount) : undefined,
        entries,
      });
      const cantidadesGuardadas = entries.reduce<Record<string, string>>((acc, entry) => {
        acc[entry.budgetItemId] = String(entry.quantityToday);
        return acc;
      }, {});
      setUltimasCantidadesGuardadas(cantidadesGuardadas);
      setCantidades(cantidadesGuardadas);
      const totalExcedidos = entries.filter((entry) => entry.exceedsQuantity).length;
      setSuccessAvance(
        totalExcedidos > 0
          ? `Avance registrado. ${totalExcedidos} item(s) quedaron sujetos a aprobacion del administrador por exceder la cantidad pendiente.`
          : "Avance registrado correctamente."
      );
      setNotasAvance("");
      setPersonalCount("");
      setMostrarFormAvance(false);
      cargarPresupuesto(contratistaSeleccionado.contractId);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setErrorAvance(msg || "Error al registrar el avance.");
    } finally {
      setSavingAvance(false);
    }
  };

  return (
    <div className="p-4 rounded-lg bg-white text-gray-900 dark:bg-slate-950 dark:text-slate-100">
      <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-slate-100">Historial avance Contratista</h2>
      <input
        type="text"
        placeholder="Buscar contratista..."
        className="input input-bordered w-full mb-4 bg-white text-gray-900 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700"
        value={contratistaFiltro}
        onChange={(e) => setContratistaFiltro(e.target.value)}
      />

      {loadingContratistas && <div className="mb-3 text-sm text-gray-500">Cargando contratistas...</div>}
      {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

      <div className="mb-4">
        {contratistasFiltrados.map((c) => (
          <button
            key={c.contractId}
            className={`btn mr-2 mb-2 ${contratistaSeleccionado?.id === c.id ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setContratistaSeleccionado(c)}
          >
            {c.name} ({c.contractNumber})
          </button>
        ))}
        {!loadingContratistas && contratistasFiltrados.length === 0 && (
          <div className="text-sm text-gray-500">No hay contratistas que coincidan con la búsqueda.</div>
        )}
      </div>

      {loading && <div>Cargando presupuesto...</div>}
      {!loading && presupuesto && (
        <div>
          {(() => {
            const pcTone = getProgressTone(contractorStats.pcProgress);
            const ptTone = getProgressTone(contractorStats.ptProgress);

            return (
              <>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="text-xs text-blue-700">Avance general</p>
              <p className="text-2xl font-bold text-blue-800">{contractorStats.overallProgress.toFixed(2)}%</p>
              <p className="text-[11px] text-blue-700">Base: cantidad aprobada</p>
            </div>
            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-xs text-green-700">Completados</p>
              <p className="text-2xl font-bold text-green-800">{contractorStats.completedItems}</p>
              <p className="text-[11px] text-green-700">de {contractorStats.totalItems} items</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs text-amber-700">En progreso</p>
              <p className="text-2xl font-bold text-amber-800">{contractorStats.inProgressItems}</p>
              <p className="text-[11px] text-amber-700">con ejecucion parcial</p>
            </div>
            <div className="rounded-lg border border-gray-300 bg-gray-50 p-3">
              <p className="text-xs text-gray-600">Pendientes</p>
              <p className="text-2xl font-bold text-gray-800">{contractorStats.pendingItems}</p>
              <p className="text-[11px] text-gray-600">sin avance aprobado</p>
            </div>
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 col-span-2 lg:col-span-1">
              <p className="text-xs text-indigo-700">PC Ejecutado / Pendiente</p>
              <p className="text-sm font-semibold text-indigo-900">
                {formatCurrency(contractorStats.executedPC)}
              </p>
              <p className="text-[11px] text-indigo-700">
                Pendiente: {formatCurrency(contractorStats.pendingPC)}
              </p>
            </div>
            <div className="rounded-lg border border-fuchsia-200 bg-fuchsia-50 p-3 col-span-2 lg:col-span-1">
              <p className="text-xs text-fuchsia-700">PT Ejecutado / Pendiente</p>
              <p className="text-sm font-semibold text-fuchsia-900">
                {formatCurrency(contractorStats.executedPT)}
              </p>
              <p className="text-[11px] text-fuchsia-700">
                Pendiente: {formatCurrency(contractorStats.pendingPT)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
            <div className={`rounded-lg border ${pcTone.border} bg-white dark:bg-slate-900 p-3`}>
              <div className="flex items-center justify-between mb-2">
                <p className={`text-xs font-medium ${pcTone.label}`}>Progreso economico PC</p>
                <p className={`text-xs font-semibold ${pcTone.value}`}>{contractorStats.pcProgress.toFixed(2)}%</p>
              </div>
              <div className={`h-2 rounded-full ${pcTone.track} overflow-hidden`}>
                <div
                  className={`h-full ${pcTone.bar} transition-all`}
                  style={{ width: `${Math.min(100, contractorStats.pcProgress)}%` }}
                />
              </div>
              <div className={`mt-2 flex items-center justify-between text-[11px] ${pcTone.meta}`}>
                <span>Ejecutado: {formatCurrency(contractorStats.executedPC)}</span>
                <span>Pendiente: {formatCurrency(contractorStats.pendingPC)}</span>
              </div>
            </div>

            <div className={`rounded-lg border ${ptTone.border} bg-white dark:bg-slate-900 p-3`}>
              <div className="flex items-center justify-between mb-2">
                <p className={`text-xs font-medium ${ptTone.label}`}>Progreso economico PT</p>
                <p className={`text-xs font-semibold ${ptTone.value}`}>{contractorStats.ptProgress.toFixed(2)}%</p>
              </div>
              <div className={`h-2 rounded-full ${ptTone.track} overflow-hidden`}>
                <div
                  className={`h-full ${ptTone.bar} transition-all`}
                  style={{ width: `${Math.min(100, contractorStats.ptProgress)}%` }}
                />
              </div>
              <div className={`mt-2 flex items-center justify-between text-[11px] ${ptTone.meta}`}>
                <span>Ejecutado: {formatCurrency(contractorStats.executedPT)}</span>
                <span>Pendiente: {formatCurrency(contractorStats.pendingPT)}</span>
              </div>
            </div>
          </div>

              </>
            );
          })()}

          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Avance por ítem Contratista</h3>
            {contratistaSeleccionado?.contractStatus === "ENABLED" && (
              <button
                type="button"
                className={`btn btn-sm ${
                  mostrarFormAvance
                    ? "btn-outline"
                    : "btn-primary"
                }`}
                onClick={() => {
                  setMostrarFormAvance((v) => {
                    const nextValue = !v;
                    if (nextValue && Object.keys(cantidades).length === 0 && Object.keys(ultimasCantidadesGuardadas).length > 0) {
                      setCantidades(ultimasCantidadesGuardadas);
                    }
                    return nextValue;
                  });
                  setErrorAvance("");
                  setSuccessAvance("");
                }}
              >
                {mostrarFormAvance ? "Cancelar" : "+ Registrar Avance"}
              </button>
            )}
          </div>

          {successAvance && (
            <div className="mb-3 p-3 rounded bg-green-50 border border-green-200 text-green-800 text-sm">
              {successAvance}
            </div>
          )}

          {mostrarFormAvance && (
            <div className="mb-6 p-4 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100">
              <div className="sticky top-2 z-10 -mx-2 mb-3 px-2 py-2 rounded-md bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-gray-200 dark:border-slate-700 flex items-center justify-between gap-3">
                <h4 className="font-semibold text-sm text-gray-900 dark:text-slate-100">Nuevo registro de avance</h4>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={savingAvance}
                  onClick={handleGuardarAvance}
                >
                  {savingAvance ? "Guardando..." : "Guardar avance"}
                </button>
              </div>

              <label className="mb-3 flex items-center gap-2 text-xs text-gray-700 dark:text-slate-300">
                Se solicitara confirmacion antes de guardar el avance.
              </label>

              <div className="flex flex-wrap gap-4 mb-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-600 dark:text-slate-300">Fecha *</label>
                  <input
                    type="date"
                    className="input input-bordered input-sm bg-white text-gray-900 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
                    value={fechaAvance}
                    onChange={(e) => setFechaAvance(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-600 dark:text-slate-300">Personal en obra</label>
                  <input
                    type="number"
                    min="0"
                    className="input input-bordered input-sm w-28 bg-white text-gray-900 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
                    placeholder="0"
                    value={personalCount}
                    onChange={(e) => setPersonalCount(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                  <label className="text-xs font-medium text-gray-600 dark:text-slate-300">Notas generales</label>
                  <input
                    type="text"
                    className="input input-bordered input-sm w-full bg-white text-gray-900 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
                    placeholder="Opcional..."
                    value={notasAvance}
                    onChange={(e) => setNotasAvance(e.target.value)}
                  />
                </div>
              </div>

              <table className="table table-sm w-full mb-3 text-gray-900 dark:text-slate-100">
                <thead>
                  <tr>
                    <th className="w-16">Ítem</th>
                    <th>Descripción</th>
                    <th className="w-24 text-right">Cant. total</th>
                    <th className="w-28 text-right">Ejecutado</th>
                    <th className="w-24 text-right">Pendiente</th>
                    <th className="w-32 text-right">Cant. hoy</th>
                  </tr>
                </thead>
                <tbody>
                  {budgetItems.map((item) => {
                    const ejecutadoAprobado = getApprovedExecutedQuantity(item);
                    const pendiente = getRemainingQuantity(item);
                    const qtyIngresada = Number(cantidades[item.id] || 0);
                    const excedePendiente = qtyIngresada > pendiente;

                    return (
                      <tr key={item.id} className={excedePendiente ? "bg-amber-50 dark:bg-amber-900/20" : ""}>
                        <td className="text-xs">{item.itemNumber}</td>
                        <td className="text-xs">{item.description}</td>
                        <td className="text-xs text-right">{item.quantity.toFixed(2)} {item.unit}</td>
                        <td className="text-xs text-right">{ejecutadoAprobado.toFixed(2)} {item.unit}</td>
                        <td className={`text-xs text-right ${pendiente <= 0 ? "text-green-700 font-semibold" : ""}`}>
                          {pendiente.toFixed(2)} {item.unit}
                        </td>
                        <td className="text-right">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            className={`input input-bordered input-xs w-24 text-right bg-white text-gray-900 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600 ${excedePendiente ? "input-warning" : ""}`}
                            placeholder={pendiente > 0 ? pendiente.toFixed(2) : "0"}
                            value={cantidades[item.id] ?? ""}
                            onChange={(e) =>
                              setCantidades((prev) => ({ ...prev, [item.id]: e.target.value }))
                            }
                          />
                          {excedePendiente && (
                            <div className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">
                              Excede pendiente. Se guarda para aprobacion.
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {itemsConExceso > 0 && (
                <div className="mb-3 p-2 rounded border border-amber-300 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-xs">
                  Tienes {itemsConExceso} item(s) con cantidad mayor al pendiente. Se pueden guardar, pero quedaran sujetos a aprobacion del administrador.
                </div>
              )}

              {errorAvance && (
                <div className="mb-3 text-sm text-red-600">{errorAvance}</div>
              )}
            </div>
          )}

          <table className="table w-full text-gray-900 dark:text-slate-100">
            <thead>
              <tr>
                <th>Ítem</th>
                <th>Descripción</th>
                <th>PC Inicial</th>
                <th>PC Contratista</th>
                <th>Dif. PC</th>
                <th>PT Inicial</th>
                <th>PT Contratista</th>
                <th>Dif. PT</th>
                <th>Ejecutado aprobado</th>
                <th>Avance (%)</th>
              </tr>
            </thead>
            <tbody>
              {budgetItems.map((item) => (
                  (() => {
                    const progressMeta = getApprovedProgressMeta(item);
                    const itemProyecto = presupuestoProyectoPorItem.get(item.itemNumber);
                    const pcInicial = itemProyecto?.totalPC ?? 0;
                    const ptInicial = itemProyecto?.totalPT ?? 0;
                    const diffPc = item.totalPC - pcInicial;
                    const diffPt = item.totalPT - ptInicial;

                    const diffClassPc = diffPc > 0 ? "text-red-700 dark:text-red-300" : diffPc < 0 ? "text-green-700 dark:text-green-300" : "text-gray-700 dark:text-slate-300";
                    const diffClassPt = diffPt > 0 ? "text-red-700 dark:text-red-300" : diffPt < 0 ? "text-green-700 dark:text-green-300" : "text-gray-700 dark:text-slate-300";

                    const formatDelta = (value: number) => `${value > 0 ? "+" : ""}${formatCurrency(value)}`;

                    return (
                  <tr key={item.id}>
                    <td>{item.itemNumber}</td>
                    <td>{item.description}</td>
                    <td>{itemProyecto ? formatCurrency(pcInicial) : "N/A"}</td>
                    <td>{formatCurrency(item.totalPC)}</td>
                    <td className={diffClassPc}>{itemProyecto ? formatDelta(diffPc) : "N/A"}</td>
                    <td>{itemProyecto ? formatCurrency(ptInicial) : "N/A"}</td>
                    <td>{formatCurrency(item.totalPT)}</td>
                    <td className={diffClassPt}>{itemProyecto ? formatDelta(diffPt) : "N/A"}</td>
                    <td className={progressMeta.textClass}>{getApprovedExecutedLabel(item)}</td>
                    <td className={progressMeta.textClass}>{getItemProgress(item)}</td>
                  </tr>
                    );
                  })()
                ))}
            </tbody>
          </table>
          {loadingPresupuestoProyecto && (
            <div className="mt-3 text-sm text-gray-500">Cargando comparación contra presupuesto inicial...</div>
          )}
          {errorPresupuestoProyecto && (
            <div className="mt-3 text-sm text-amber-700">{errorPresupuestoProyecto}</div>
          )}
          {!loading && budgetItems.length === 0 && (
            <div className="mt-3 text-sm text-gray-500">El presupuesto no tiene ítems registrados.</div>
          )}
        </div>
      )}
    </div>
  );
}
