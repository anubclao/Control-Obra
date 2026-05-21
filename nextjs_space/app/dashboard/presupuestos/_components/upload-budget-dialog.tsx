"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Info,
} from "lucide-react";
import * as XLSX from "xlsx";

interface UploadBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: any[];
}

interface ParsedChapter {
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
  chapters: ParsedChapter[];
  aiu: ParsedAIU;
}

// Keywords that indicate summary/total rows to skip
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

export function UploadBudgetDialog({
  open,
  onOpenChange,
  projects,
}: UploadBudgetDialogProps) {
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [importResult, setImportResult] = useState<{
    itemsImported: number;
    chaptersImported: number;
  } | null>(null);
  const router = useRouter();

  const resetForm = () => {
    setSelectedProject("");
    setSelectedFile(null);
    setError("");
    setSuccess(false);
    setImportResult(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
        setError("Solo se permiten archivos Excel (.xlsx, .xls)");
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        setError("El archivo no puede superar los 20 MB");
        return;
      }
      setSelectedFile(file);
      setError("");
    }
  };

  // Detectar si un valor es un número de capítulo (entero: 1, 2, 3...)
  const isChapterNumber = (value: any): boolean => {
    if (value === null || value === undefined) return false;
    const str = String(value).trim();
    // Es un entero positivo sin decimales
    return /^\d+$/.test(str) && parseInt(str) > 0;
  };

  // Detectar si un valor es un número de ítem (decimal: 1.1, 1.2, 2.1...)
  const isItemNumber = (value: any): boolean => {
    if (value === null || value === undefined) return false;
    const str = String(value).trim();
    // Tiene formato X.Y o X.Y.Z (acepta punto o coma)
    return /^\d+([\.,]\d+){1,2}$/.test(str);
  };

  // Detectar si una fila es un resumen/total que debe ignorarse
  const isSummaryRow = (description: string): boolean => {
    const descLower = description.toLowerCase().trim();
    return SUMMARY_KEYWORDS.some(kw => descLower.includes(kw));
  };

  // Extraer porcentaje de una fila de texto (busca "8%", "5%", "19%", etc.)
  const extractPercentageFromRow = (row: any[], qtyCol: number, unitPriceCol: number): number => {
    // Buscar en columna de cantidad o precio unitario (donde suele estar el %)
    for (const col of [qtyCol, unitPriceCol]) {
      if (col >= 0) {
        const val = row[col];
        if (typeof val === "number" && val > 0 && val < 100) return val;
        const str = String(val || "");
        const match = str.match(/(\d+(?:\.\d+)?)\s*%/);
        if (match) return parseFloat(match[1]);
        // Si es un porcentaje como 0.08, 0.05
        if (typeof val === "number" && val > 0 && val < 1) return val * 100;
      }
    }
    // También buscar en cualquier celda de la fila
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
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

          const rows = jsonData as any[][];
          
          // Buscar la fila de encabezados
          let headerRowIndex = -1;
          for (let i = 0; i < Math.min(15, rows.length); i++) {
            const row = rows[i];
            if (row && row.some((cell: any) => {
              const cellStr = String(cell || "").toLowerCase().trim();
              return cellStr === "item" || cellStr === "ítem" || 
                     cellStr.includes("descripcion") || cellStr.includes("descripción");
            })) {
              headerRowIndex = i;
              break;
            }
          }

          if (headerRowIndex === -1) {
            throw new Error("No se encontró la fila de encabezados (ITEM, DESCRIPCION, etc.)");
          }

          // Mapear columnas
          const headerRow = rows[headerRowIndex] || [];
          const headers: string[] = [];
          for (let j = 0; j < headerRow.length; j++) {
            headers.push(String(headerRow[j] || "").toLowerCase().trim());
          }

          const findColumnIndex = (keywords: string[]) => {
            return headers.findIndex((h: string) => {
              if (!h) return false;
              return keywords.some(k => h.includes(k) || h === k);
            });
          };

          const itemCol = findColumnIndex(["item", "ítem", "no.", "numero", "número"]);
          const descCol = findColumnIndex(["descripcion", "descripción", "detalle", "actividad"]);
          const unitCol = findColumnIndex(["unidad", "und", "un"]);
          const qtyCol = findColumnIndex(["cantidad", "cant", "qty"]);
          const unitPriceCol = findColumnIndex(["vr unitario", "unitario", "precio", "vr unit", "p. unitario", "precio unitario"]);
          const totalPriceCol = findColumnIndex(["vr total", "total", "valor total", "p. total", "precio total"]);
          const classCol = findColumnIndex(["clasificacion", "clasificación", "frente", "frente de trabajo"]);
          const useClassificationAsFront = classCol !== -1;

          if (itemCol === -1 || descCol === -1) {
            throw new Error("No se encontraron las columnas ITEM y DESCRIPCION");
          }

          const chapters: ParsedChapter[] = [];
          let currentChapter: ParsedChapter | null = null;
          const chapterByFront = new Map<string, ParsedChapter>();

          // AIU detection
          const aiu: ParsedAIU = {
            adminPercentage: 8,
            imprevistoPercentage: 5,
            utilidadPercentage: 5,
            ivaUtilityPercentage: 19,
          };

          // Procesar filas de datos
          for (let i = headerRowIndex + 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row) continue;

            const itemValue = row[itemCol];
            const description = String(row[descCol] || "").trim();
            const frontRaw = classCol >= 0 ? String(row[classCol] || "").trim() : "";

            // Saltar filas vacías
            if (!description) continue;

            // Detectar y extraer AIU de filas resumen
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

            // Saltar filas resumen/total
            if (isSummaryRow(description)) continue;

            const getOrCreateFrontChapter = () => {
              const frontName = frontRaw || "Sin Frente";
              const frontKey = frontName.toUpperCase();
              const existing = chapterByFront.get(frontKey);

              if (existing) return existing;

              const chapter: ParsedChapter = {
                code: `FRT-${String(chapters.length + 1).padStart(2, "0")}`,
                name: frontName,
                items: [],
              };

              chapterByFront.set(frontKey, chapter);
              chapters.push(chapter);
              return chapter;
            };

            // Detectar si es un capítulo (número entero)
            if (!useClassificationAsFront && isChapterNumber(itemValue)) {
              const chapterNum = String(itemValue).trim();
              currentChapter = {
                code: `CAP${chapterNum}`,
                name: description,
                items: [],
              };
              chapters.push(currentChapter);
            }
            // Detectar si es un ítem (número decimal)
            else if (
              isItemNumber(itemValue) &&
              (useClassificationAsFront ? Boolean(frontRaw) : Boolean(currentChapter))
            ) {
              const targetChapter = useClassificationAsFront
                ? getOrCreateFrontChapter()
                : currentChapter;

              if (!targetChapter) continue;

              const unit = row[unitCol] ? String(row[unitCol]).toUpperCase().trim() : "UN";
              const quantity = parseFloat(row[qtyCol]) || 0;
              
              let unitPrice = 0;
              let totalPrice = 0;
              
              // Check if totalPrice cell has an actual value in Excel
              const rawTotalPrice = totalPriceCol >= 0 ? row[totalPriceCol] : null;
              const hasTotalInExcel = rawTotalPrice !== null && rawTotalPrice !== undefined && rawTotalPrice !== "" && rawTotalPrice !== 0;
              
              if (unitPriceCol >= 0) {
                const upVal = row[unitPriceCol];
                unitPrice = typeof upVal === "number" ? upVal : (parseFloat(upVal) || 0);
              }
              
              if (totalPriceCol >= 0) {
                const tpVal = row[totalPriceCol];
                totalPrice = typeof tpVal === "number" ? tpVal : (parseFloat(tpVal) || 0);
              }
              
              // Calcular total cuando viene cantidad y unitario, aunque la celda total esté vacía.
              if (totalPrice === 0 && unitPrice > 0 && quantity > 0) {
                totalPrice = unitPrice * quantity;
              }
              if (unitPrice === 0 && totalPrice > 0 && quantity > 0) {
                unitPrice = totalPrice / quantity;
              }

              // Conservar también filas estructurales tipo 1.1 PRELIMINARES (sin valores).
              const normalizedItemNumber = String(itemValue).trim().replace(/,/g, ".");
              const isStructuralItem =
                totalPrice <= 0 &&
                quantity === 0 &&
                unitPrice === 0 &&
                /^\d+\.\d+(\.\d+)?$/.test(normalizedItemNumber);

              if (totalPrice <= 0 && !isStructuralItem) continue;

              targetChapter.items.push({
                itemNumber: normalizedItemNumber,
                description,
                unit: unit || "UN",
                quantity,
                unitPrice,
                totalPrice,
              });
            }
            // Filas con unidad/cantidad que no son resumen → agregar como ítem
            else if ((useClassificationAsFront ? Boolean(frontRaw) : Boolean(currentChapter)) && description) {
              const targetChapter = useClassificationAsFront
                ? getOrCreateFrontChapter()
                : currentChapter;

              if (!targetChapter) continue;

              // Skip rows where itemValue contains text (e.g. "opcional", "segun administracion")
              const itemStr = String(itemValue || "").toLowerCase().trim();
              const isTramiteTextRow = itemStr.includes("tramite") || itemStr.includes("trámite");
              if (itemStr && !/^\d/.test(itemStr) && !isTramiteTextRow) continue;

              const unit = row[unitCol] ? String(row[unitCol]).toUpperCase().trim() : "";
              const quantity = parseFloat(row[qtyCol]) || 0;
              
              if ((unit || quantity > 0) && quantity > 0) {
                let unitPrice = 0;
                let totalPrice = 0;
                
                const rawTotalPrice = totalPriceCol >= 0 ? row[totalPriceCol] : null;
                const hasTotalInExcel = rawTotalPrice !== null && rawTotalPrice !== undefined && rawTotalPrice !== "" && rawTotalPrice !== 0;
                
                if (unitPriceCol >= 0) {
                  const upVal = row[unitPriceCol];
                  unitPrice = typeof upVal === "number" ? upVal : (parseFloat(upVal) || 0);
                }
                
                if (totalPriceCol >= 0) {
                  const tpVal = row[totalPriceCol];
                  totalPrice = typeof tpVal === "number" ? tpVal : (parseFloat(tpVal) || 0);
                }
                
                // Calcular total cuando viene cantidad y unitario.
                if (totalPrice === 0 && unitPrice > 0 && quantity > 0) {
                  totalPrice = unitPrice * quantity;
                }
                if (unitPrice === 0 && totalPrice > 0 && quantity > 0) {
                  unitPrice = totalPrice / quantity;
                }

                // Solo agregar si tiene un total real en el Excel
                if (totalPrice > 0) {
                  const itemNum = itemValue
                    ? String(itemValue).trim().replace(/,/g, ".")
                    : `${targetChapter.items.length + 1}`;
                  targetChapter.items.push({
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

          // Filtrar capítulos vacíos
          const validChapters = chapters.filter(ch => ch.items.length > 0);
          
          if (validChapters.length === 0) {
            throw new Error("No se encontraron capítulos con ítems válidos. Verifica que el Excel tenga la estructura correcta: capítulos (1, 2, 3...) con ítems (1.1, 1.2...)");
          }

          resolve({ chapters: validChapters, aiu });
        } catch (err: any) {
          reject(new Error(err.message || "Error al procesar el archivo Excel"));
        }
      };
      reader.onerror = () => reject(new Error("Error al leer el archivo"));
      reader.readAsArrayBuffer(file);
    });
  };

  const handleSubmit = async () => {
    if (!selectedProject) {
      setError("Seleccione un proyecto");
      return;
    }
    if (!selectedFile) {
      setError("Seleccione un archivo Excel");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // 1. Parsear el archivo Excel (detectar capítulos e ítems + AIU)
      const { chapters, aiu } = await parseExcelFile(selectedFile);
      
      const totalItems = chapters.reduce((sum, ch) => sum + ch.items.length, 0);
      
      if (totalItems === 0) {
        setError("No se encontraron ítems válidos en el archivo");
        setIsLoading(false);
        return;
      }

      // 2. Subir archivo a S3
      const presignedResponse = await fetch("/api/upload/presigned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: selectedFile.name,
          contentType: selectedFile.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          isPublic: false,
        }),
      });

      let cloud_storage_path = null;

      if (presignedResponse.ok) {
        const { uploadUrl, cloud_storage_path: storagePath } = await presignedResponse.json();
        cloud_storage_path = storagePath;

        // Subir a S3
        await fetch(uploadUrl, {
          method: "PUT",
          body: selectedFile,
          headers: {
            "Content-Type": selectedFile.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          },
        });
      }

      // 3. Importar al presupuesto (nueva estructura con capítulos)
      const importResponse = await fetch(
        `/api/presupuestos/${selectedProject}/import-auto`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: selectedFile.name,
            cloud_storage_path,
            isPublic: false,
            chapters,
            aiu,
          }),
        }
      );

      if (!importResponse.ok) {
        const data = await importResponse.json();
        throw new Error(data.error || "Error al importar presupuesto");
      }

      const result = await importResponse.json();
      setSuccess(true);
      setImportResult({
        itemsImported: result.itemsImported,
        chaptersImported: result.chaptersImported,
      });

      // Refrescar la página después de 2 segundos
      setTimeout(() => {
        onOpenChange(false);
        resetForm();
        router.refresh();
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Error al procesar el presupuesto");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) resetForm();
      onOpenChange(newOpen);
    }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            Cargar presupuesto
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
              Se importaron <strong>{importResult?.chaptersImported}</strong> capítulos con <strong>{importResult?.itemsImported}</strong> ítems
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Selección de Proyecto */}
            <div className="space-y-2">
              <Label>Proyecto *</Label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione un proyecto..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.code ? `${project.code} - ` : ""}
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Info sobre estructura esperada */}
            <Alert>
              <Info className="w-4 h-4" />
              <AlertDescription className="text-xs">
                <strong>Estructura esperada:</strong> ITEM, DESCRIPCION, UNIDAD, CANTIDAD, VR UNITARIO, VR TOTAL. 
                Si existe la columna CLASIFICACIÓN, se usa como frente de trabajo para agrupar los ítems.
              </AlertDescription>
            </Alert>

            {/* Archivo */}
            <div className="space-y-2">
              <Label>Archivo Excel *</Label>
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => document.getElementById("budget-file-input")?.click()}
              >
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                {selectedFile ? (
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">{selectedFile.name}</span>
                    <br />
                    <span className="text-gray-500">
                      ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </span>
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-gray-600">
                      Arrastra tu Excel aquí o selecciona un archivo
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Solo archivos .xlsx (máx. 20 MB)
                    </p>
                  </>
                )}
                <input
                  id="budget-file-input"
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Botones */}
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
              <Button onClick={handleSubmit} disabled={isLoading}>
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
