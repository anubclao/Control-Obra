"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Upload, CheckCircle, AlertTriangle, FileSpreadsheet, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

interface ContractorPresupuestoUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId: string;
  onUploaded?: () => void;
}

interface ParsedLayer {
  code: string;
  name: string;
  items: ParsedItem[];
}

interface ParsedItem {
  itemNumber: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface ParsedAIU {
  adminPercentage: number;
  imprevistoPercentage: number;
  utilidadPercentage: number;
  ivaUtilityPercentage: number;
}

interface ParseResult {
  layers: ParsedLayer[];
  aiu: ParsedAIU;
}

const SUMMARY_KEYWORDS = [
  "subtotal", "sub-total", "sub total",
  "administracion", "administración",
  "imprevistos", "imprevisto",
  "utilidad",
  "total antes", "total general", "total obra",
  "iva sobre", "iva utilidad", "iva s/",
  "costo directo total",
  "total a.i.u", "total aiu",
  "costo directo",
  "condiciones comerciales", "forma de pago",
  "tiempo de entrega", "validez",
  "cordialmente",
  "gerente de proyecto", "gerente de obra",
  "opcional",
  "segun administracion", "según administracion", "según administración",
];

export function ContractorPresupuestoUploadDialog({
  open,
  onOpenChange,
  contractId,
  onUploaded,
}: ContractorPresupuestoUploadDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [importResult, setImportResult] = useState<{
    itemsImported: number;
    layersImported: number;
  } | null>(null);

  const resetForm = () => {
    setSelectedFile(null);
    setError("");
    setSuccess(false);
    setImportResult(null);
  };

  const isChapterNumber = (value: any): boolean => {
    if (value === null || value === undefined) return false;
    const str = String(value).trim();
    return /^\d+$/.test(str) && parseInt(str, 10) > 0;
  };

  const isItemNumber = (value: any): boolean => {
    if (value === null || value === undefined) return false;
    const str = String(value).trim();
    return /^\d+([\.,]\d+){1,2}$/.test(str);
  };

  const isSummaryRow = (description: string): boolean => {
    const descLower = description.toLowerCase().trim();
    return SUMMARY_KEYWORDS.some((kw) => descLower.includes(kw));
  };

  const extractPercentageFromRow = (row: any[], qtyCol: number, unitPriceCol: number): number => {
    for (const col of [qtyCol, unitPriceCol]) {
      if (col >= 0) {
        const val = row[col];
        if (typeof val === "number" && val > 0 && val < 100) return val;
        const str = String(val || "");
        const match = str.match(/(\d+(?:\.\d+)?)\s*%/);
        if (match) return parseFloat(match[1]);
        if (typeof val === "number" && val > 0 && val < 1) return val * 100;
      }
    }

    for (const cell of row) {
      const str = String(cell || "");
      const match = str.match(/(\d+(?:\.\d+)?)\s*%/);
      if (match) return parseFloat(match[1]);
    }

    return 0;
  };

  const parseExcelFile = async (file: File): Promise<ParseResult> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

          let headerRowIndex = -1;
          for (let i = 0; i < Math.min(15, rows.length); i++) {
            const row = rows[i];
            if (
              row &&
              row.some((cell: any) => {
                const cellStr = String(cell || "").toLowerCase().trim();
                return (
                  cellStr === "item" ||
                  cellStr === "ítem" ||
                  cellStr.includes("descripcion") ||
                  cellStr.includes("descripción")
                );
              })
            ) {
              headerRowIndex = i;
              break;
            }
          }

          if (headerRowIndex === -1) {
            throw new Error("No se encontró la fila de encabezados (ITEM, DESCRIPCION, etc.)");
          }

          const headerRow = rows[headerRowIndex] || [];
          const headers: string[] = [];
          for (let j = 0; j < headerRow.length; j++) {
            headers.push(String(headerRow[j] || "").toLowerCase().trim());
          }

          const findColumnIndex = (keywords: string[]) => {
            return headers.findIndex((h: string) => {
              if (!h) return false;
              return keywords.some((k) => h.includes(k) || h === k);
            });
          };

          const itemCol = findColumnIndex(["item", "ítem", "no.", "numero", "número"]);
          const descCol = findColumnIndex(["descripcion", "descripción", "detalle", "actividad"]);
          const unitCol = findColumnIndex(["unidad", "und", "un"]);
          const qtyCol = findColumnIndex(["cantidad", "cant", "qty"]);
          const unitPriceCol = findColumnIndex([
            "vr unitario",
            "unitario",
            "precio",
            "vr unit",
            "p. unitario",
            "precio unitario",
          ]);
          const totalPriceCol = findColumnIndex(["vr total", "total", "valor total", "p. total", "precio total"]);
          const classCol = findColumnIndex(["clasificacion", "clasificación", "frente", "frente de trabajo"]);
          const useClassificationAsFront = classCol !== -1;

          if (itemCol === -1 || descCol === -1) {
            throw new Error("No se encontraron las columnas ITEM y DESCRIPCION");
          }

          const layers: ParsedLayer[] = [];
          let currentLayer: ParsedLayer | null = null;
          const layerByFront = new Map<string, ParsedLayer>();

          const aiu: ParsedAIU = {
            adminPercentage: 8,
            imprevistoPercentage: 5,
            utilidadPercentage: 5,
            ivaUtilityPercentage: 19,
          };

          for (let i = headerRowIndex + 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row) continue;

            const itemValue = row[itemCol];
            const description = String(row[descCol] || "").trim();
            const frontRaw = classCol >= 0 ? String(row[classCol] || "").trim() : "";

            if (!description) continue;

            const descLower = description.toLowerCase().trim();
            if (descLower.includes("administracion") || descLower.includes("administración")) {
              const pct = extractPercentageFromRow(row, qtyCol, unitPriceCol);
              if (pct > 0) aiu.adminPercentage = pct;
              continue;
            }
            if (descLower.includes("imprevisto")) {
              const pct = extractPercentageFromRow(row, qtyCol, unitPriceCol);
              if (pct > 0) aiu.imprevistoPercentage = pct;
              continue;
            }
            if (descLower === "utilidad" || (descLower.includes("utilidad") && !descLower.includes("iva"))) {
              const pct = extractPercentageFromRow(row, qtyCol, unitPriceCol);
              if (pct > 0) aiu.utilidadPercentage = pct;
              continue;
            }
            if (descLower.includes("iva sobre") || descLower.includes("iva utilidad") || descLower.includes("iva s/")) {
              const pct = extractPercentageFromRow(row, qtyCol, unitPriceCol);
              if (pct > 0) aiu.ivaUtilityPercentage = pct;
              continue;
            }

            if (isSummaryRow(description)) continue;

            const getOrCreateFrontLayer = () => {
              const frontName = frontRaw || "Sin Frente";
              const frontKey = frontName.toUpperCase();
              const existing = layerByFront.get(frontKey);
              if (existing) return existing;

              const layer: ParsedLayer = {
                code: `FRT-${String(layers.length + 1).padStart(2, "0")}`,
                name: frontName,
                items: [],
              };

              layerByFront.set(frontKey, layer);
              layers.push(layer);
              return layer;
            };

            if (!useClassificationAsFront && isChapterNumber(itemValue)) {
              const layerNum = String(itemValue).trim();
              currentLayer = {
                code: `CAP${layerNum}`,
                name: description,
                items: [],
              };
              layers.push(currentLayer);
            } else if (
              isItemNumber(itemValue) &&
              (useClassificationAsFront ? Boolean(frontRaw) : Boolean(currentLayer))
            ) {
              const targetLayer = useClassificationAsFront ? getOrCreateFrontLayer() : currentLayer;
              if (!targetLayer) continue;

              const unit = row[unitCol] ? String(row[unitCol]).toUpperCase().trim() : "UN";
              const quantity = parseFloat(row[qtyCol]) || 0;

              let unitPrice = 0;
              let totalPrice = 0;

              if (unitPriceCol >= 0) {
                const upVal = row[unitPriceCol];
                unitPrice = typeof upVal === "number" ? upVal : parseFloat(upVal) || 0;
              }

              if (totalPriceCol >= 0) {
                const tpVal = row[totalPriceCol];
                totalPrice = typeof tpVal === "number" ? tpVal : parseFloat(tpVal) || 0;
              }

              if (totalPrice === 0 && unitPrice > 0 && quantity > 0) {
                totalPrice = unitPrice * quantity;
              }
              if (unitPrice === 0 && totalPrice > 0 && quantity > 0) {
                unitPrice = totalPrice / quantity;
              }

              const normalizedItemNumber = String(itemValue).trim().replace(/,/g, ".");
              const isStructuralItem =
                totalPrice <= 0 &&
                quantity === 0 &&
                unitPrice === 0 &&
                /^\d+\.\d+(\.\d+)?$/.test(normalizedItemNumber);

              if (totalPrice <= 0 && !isStructuralItem) continue;

              targetLayer.items.push({
                itemNumber: normalizedItemNumber,
                description,
                unit: unit || "UN",
                quantity,
                unitPrice,
                totalPrice,
              });
            } else if ((useClassificationAsFront ? Boolean(frontRaw) : Boolean(currentLayer)) && description) {
              const targetLayer = useClassificationAsFront ? getOrCreateFrontLayer() : currentLayer;
              if (!targetLayer) continue;

              const itemStr = String(itemValue || "").toLowerCase().trim();
              const isTramiteTextRow = itemStr.includes("tramite") || itemStr.includes("trámite");
              if (itemStr && !/^\d/.test(itemStr) && !isTramiteTextRow) continue;

              const unit = row[unitCol] ? String(row[unitCol]).toUpperCase().trim() : "";
              const quantity = parseFloat(row[qtyCol]) || 0;

              if ((unit || quantity > 0) && quantity > 0) {
                let unitPrice = 0;
                let totalPrice = 0;

                if (unitPriceCol >= 0) {
                  const upVal = row[unitPriceCol];
                  unitPrice = typeof upVal === "number" ? upVal : parseFloat(upVal) || 0;
                }

                if (totalPriceCol >= 0) {
                  const tpVal = row[totalPriceCol];
                  totalPrice = typeof tpVal === "number" ? tpVal : parseFloat(tpVal) || 0;
                }

                if (totalPrice === 0 && unitPrice > 0 && quantity > 0) {
                  totalPrice = unitPrice * quantity;
                }
                if (unitPrice === 0 && totalPrice > 0 && quantity > 0) {
                  unitPrice = totalPrice / quantity;
                }

                if (totalPrice > 0) {
                  const itemNum = itemValue
                    ? String(itemValue).trim().replace(/,/g, ".")
                    : `${targetLayer.items.length + 1}`;

                  targetLayer.items.push({
                    itemNumber: itemNum,
                    description,
                    unit: unit || "UN",
                    quantity,
                    unitPrice,
                    totalPrice,
                  });
                }
              }
            }
          }

          const validLayers = layers.filter((layer) => layer.items.length > 0);
          if (validLayers.length === 0) {
            throw new Error(
              "No se encontraron capítulos con ítems válidos. Verifica que el Excel tenga la estructura correcta: capítulos (1, 2, 3...) con ítems (1.1, 1.2...)"
            );
          }

          resolve({ layers: validLayers, aiu });
        } catch (err: any) {
          console.error("Error parsing Excel:", err);
          reject(new Error(err.message || "Error al procesar el archivo Excel"));
        }
      };

      reader.onerror = (e) => {
        const err = (reader.error as DOMException | null);
        console.error("FileReader onerror:", err, e);
        reject(new Error(`Error al leer el archivo: ${err?.name ?? ""} - ${err?.message ?? "desconocido"}`));
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".xlsx") && !selectedFile.name.endsWith(".xls")) {
      setError("Solo se permiten archivos Excel (.xlsx, .xls)");
      return;
    }

    if (selectedFile.size > 20 * 1024 * 1024) {
      setError("El archivo no puede superar los 20 MB");
      return;
    }

    setSelectedFile(selectedFile);
    setError("");
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Seleccione un archivo Excel");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const { layers, aiu } = await parseExcelFile(selectedFile);

      const mappedLayers = layers.map((layer) => ({
        code: layer.code,
        name: layer.name,
        items: layer.items.map((item) => ({
          itemNumber: item.itemNumber,
          description: item.description,
          unit: item.unit,
          quantity: item.quantity,
          unitPricePC: item.unitPrice,
          unitPricePT: item.unitPrice,
        })),
      }));

      const aiuPercentage = aiu.adminPercentage + aiu.imprevistoPercentage + aiu.utilidadPercentage;

      const response = await fetch(`/api/contratos/${contractId}/presupuesto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiuPercentage,
          adminPercentage: aiu.adminPercentage,
          imprevistoPercentage: aiu.imprevistoPercentage,
          utilidadPercentage: aiu.utilidadPercentage,
          ivaUtilityPercentage: aiu.ivaUtilityPercentage,
          layers: mappedLayers,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Error al cargar presupuesto");
      }

      const totalItems = mappedLayers.reduce((sum, layer) => sum + layer.items.length, 0);
      setSuccess(true);
      setImportResult({
        itemsImported: totalItems,
        layersImported: mappedLayers.length,
      });

      toast({
        title: "Importación exitosa",
        description: `Se importaron ${mappedLayers.length} capítulos con ${totalItems} ítems`,
      });

      setTimeout(() => {
        onOpenChange(false);
        resetForm();
        onUploaded?.();
        router.refresh();
      }, 1500);
    } catch (error) {
      console.error("Error importing contractor budget:", error);
      setError(error instanceof Error ? error.message : "No se pudo cargar el presupuesto");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        if (!newOpen) resetForm();
        onOpenChange(newOpen);
      }}
    >
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            Cargar Presupuesto del Contratista
          </DialogTitle>
          <DialogDescription>
            Importa el presupuesto desde Excel (.xlsx). El sistema detectará automáticamente los capítulos e ítems.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-6 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-green-700">Importación Exitosa</h3>
            <p className="text-gray-600 mt-2">
              Se importaron <strong>{importResult?.layersImported}</strong> capítulos con <strong>{importResult?.itemsImported}</strong> ítems
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <Alert>
              <Info className="w-4 h-4" />
              <AlertDescription className="text-xs">
                <strong>Estructura esperada:</strong> ITEM, DESCRIPCION, UNIDAD, CANTIDAD, VR UNITARIO, VR TOTAL.
                Si existe la columna CLASIFICACIÓN, se usa como frente de trabajo para agrupar los ítems.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Archivo Excel *</Label>
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => document.getElementById("contractor-budget-file-input")?.click()}
              >
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                {selectedFile ? (
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">{selectedFile.name}</span>
                    <br />
                    <span className="text-gray-500">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-gray-600">Arrastra tu Excel aquí o selecciona un archivo</p>
                    <p className="text-xs text-gray-400 mt-1">Solo archivos .xlsx (máx. 20 MB)</p>
                  </>
                )}
                <input
                  id="contractor-budget-file-input"
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleFileSelect}
                  disabled={isLoading}
                />
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  resetForm();
                }}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button onClick={handleUpload} disabled={isLoading || !selectedFile}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Importar
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
