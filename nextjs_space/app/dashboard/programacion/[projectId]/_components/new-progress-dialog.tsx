'use client';

import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Loader2, Calendar, Plus, CheckCircle, AlertTriangle } from 'lucide-react';

interface BudgetItem {
  id: string;
  itemNumber: string;
  description: string;
  unit: string;
  quantity: number;
}

interface Layer {
  id: string;
  code: string;
  name: string;
  items: BudgetItem[];
}

interface Contractor {
  id: string;
  name: string;
}

interface NewProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  layers: Layer[];
  contractors: Contractor[];
  onSuccess: () => void;
}

interface EntryData {
  budgetItemId: string;
  quantityToday: string;
  notes: string;
  contractorId: string;
  selected: boolean;
}

export default function NewProgressDialog({
  open,
  onOpenChange,
  projectId,
  layers,
  contractors,
  onSuccess
}: NewProgressDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Form state - date is always today, not editable
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const todayDisplay = useMemo(() => new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), []);

  // Entries state
  const [entries, setEntries] = useState<Record<string, EntryData>>(() => {
    const initial: Record<string, EntryData> = {};
    layers.forEach(layer => {
      layer.items.forEach(item => {
        initial[item.id] = {
          budgetItemId: item.id,
          quantityToday: '',
          notes: '',
          contractorId: '',
          selected: false
        };
      });
    });
    return initial;
  });

  const handleEntryChange = (itemId: string, field: keyof EntryData, value: string | boolean) => {
    setEntries(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
      }
    }));
    // Clear validation error for this field
    if (validationErrors[`${itemId}_${field}`]) {
      setValidationErrors(prev => {
        const next = { ...prev };
        delete next[`${itemId}_${field}`];
        return next;
      });
    }
  };

  // Check if a quantity exceeds the budget item total
  const getItemQuantity = (itemId: string): number => {
    for (const layer of layers) {
      for (const item of layer.items) {
        if (item.id === itemId) return item.quantity;
      }
    }
    return 0;
  };

  const isExceeding = (itemId: string): boolean => {
    const entry = entries[itemId];
    if (!entry?.selected || !entry.quantityToday) return false;
    const qty = parseFloat(entry.quantityToday);
    if (isNaN(qty)) return false;
    return qty > getItemQuantity(itemId);
  };

  const hasAnyExceeding = (): boolean => {
    return Object.keys(entries).some(id => isExceeding(id));
  };

  // Validate all selected entries have mandatory fields
  const validateEntries = (): boolean => {
    const errors: Record<string, string> = {};
    const selected = Object.entries(entries).filter(([, e]) => e.selected);

    if (selected.length === 0) {
      setError('Debe seleccionar al menos una actividad');
      return false;
    }

    selected.forEach(([itemId, entry]) => {
      if (!entry.quantityToday || parseFloat(entry.quantityToday) <= 0) {
        errors[`${itemId}_quantityToday`] = 'Cantidad requerida';
      }
      if (!entry.contractorId || entry.contractorId === 'none') {
        errors[`${itemId}_contractorId`] = 'Subcontratista requerido';
      }
      if (!entry.notes || entry.notes.trim() === '') {
        errors[`${itemId}_notes`] = 'Notas requeridas';
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validateEntries()) return;
    setShowConfirm(true);
  };

  const handleSubmit = async () => {
    setShowConfirm(false);
    setLoading(true);
    setError('');

    // Filter only selected entries with quantity
    const selectedEntries = Object.values(entries)
      .filter(e => e.selected && parseFloat(e.quantityToday) > 0)
      .map(e => {
        const exceeds = parseFloat(e.quantityToday) > getItemQuantity(e.budgetItemId);
        return {
          budgetItemId: e.budgetItemId,
          quantityToday: parseFloat(e.quantityToday),
          notes: e.notes || null,
          contractorId: e.contractorId && e.contractorId !== 'none' ? e.contractorId : null,
          exceedsQuantity: exceeds
        };
      });

    try {
      const response = await fetch('/api/programacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          date: todayStr,
          entries: selectedEntries
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al crear registro');
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        resetForm();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear registro');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setError('');
    setSuccess(false);
    setValidationErrors({});
    // Reset entries
    const initial: Record<string, EntryData> = {};
    layers.forEach(layer => {
      layer.items.forEach(item => {
        initial[item.id] = {
          budgetItemId: item.id,
          quantityToday: '',
          notes: '',
          contractorId: '',
          selected: false
        };
      });
    });
    setEntries(initial);
  };

  const selectedCount = Object.values(entries).filter(e => e.selected).length;
  const exceedingCount = Object.keys(entries).filter(id => isExceeding(id)).length;

  return (
    <>
      <Dialog open={open} onOpenChange={(newOpen) => {
        if (!newOpen) resetForm();
        onOpenChange(newOpen);
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Registrar Avance Diario
            </DialogTitle>
            <DialogDescription>
              Registre el avance de las actividades ejecutadas hoy
            </DialogDescription>
          </DialogHeader>

          {success ? (
            <div className="py-8 text-center">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <p className="text-green-600 font-medium">¡Avance registrado exitosamente!</p>
              {exceedingCount > 0 && (
                <p className="text-amber-600 text-sm mt-2">
                  {exceedingCount} ítem(s) con exceso de cantidad quedan pendientes de aprobación del administrador.
                </p>
              )}
            </div>
          ) : (
            <form onSubmit={handlePreSubmit} className="flex-1 flex flex-col overflow-hidden">
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Fecha fija: solo hoy */}
              <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="h-4 w-4" />
                <span className="font-medium">Fecha:</span>
                <span>{todayDisplay}</span>
              </div>

              {/* Warning for exceeding quantities */}
              {hasAnyExceeding() && (
                <Alert className="mb-4 border-amber-400 bg-amber-50">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-700">
                    Hay ítems con cantidad superior a la presupuestada. Estos registros quedarán <strong>pendientes de aprobación</strong> por el administrador.
                  </AlertDescription>
                </Alert>
              )}

              {/* Actividades */}
              <div className="flex-1 overflow-hidden">
                <Label className="mb-2 block">
                  Actividades Ejecutadas ({selectedCount} seleccionadas)
                </Label>
                <ScrollArea className="h-[350px] border rounded-lg">
                  <Accordion type="multiple" className="p-2">
                    {layers.map((layer) => (
                      <AccordionItem key={layer.id} value={layer.id}>
                        <AccordionTrigger className="text-sm font-medium">
                          {layer.code} - {layer.name} ({layer.items.length} ítems)
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-3 pt-2">
                            {layer.items.map((item) => {
                              const exceeds = isExceeding(item.id);
                              const entryData = entries[item.id];
                              return (
                                <div 
                                  key={item.id} 
                                  className={`border rounded-lg p-3 transition-colors ${
                                    exceeds
                                      ? 'border-amber-400 bg-amber-50'
                                      : entryData?.selected
                                        ? 'border-blue-300 bg-blue-50'
                                        : ''
                                  }`}
                                >
                                  <div className="flex items-start gap-3">
                                    <Checkbox
                                      checked={entryData?.selected || false}
                                      onCheckedChange={(checked) => 
                                        handleEntryChange(item.id, 'selected', !!checked)
                                      }
                                      className="mt-1"
                                    />
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium">
                                          {item.itemNumber} - {item.description}
                                        </p>
                                        {exceeds && (
                                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-200 px-2 py-0.5 rounded-full">
                                            <AlertTriangle className="h-3 w-3" />
                                            Excede
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-xs text-gray-500">
                                        Unidad: {item.unit} | Cantidad total: {item.quantity}
                                      </p>
                                      
                                      {entryData?.selected && (
                                        <div className="grid grid-cols-3 gap-2 mt-2">
                                          <div>
                                            <Input
                                              type="number"
                                              step="0.01"
                                              min="0"
                                              placeholder={`Cant. (${item.unit}) *`}
                                              value={entryData?.quantityToday || ''}
                                              onChange={(e) => 
                                                handleEntryChange(item.id, 'quantityToday', e.target.value)
                                              }
                                              className={`text-sm ${
                                                validationErrors[`${item.id}_quantityToday`] 
                                                  ? 'border-red-500' 
                                                  : exceeds 
                                                    ? 'border-amber-400' 
                                                    : ''
                                              }`}
                                            />
                                            {validationErrors[`${item.id}_quantityToday`] && (
                                              <p className="text-[10px] text-red-500 mt-0.5">
                                                {validationErrors[`${item.id}_quantityToday`]}
                                              </p>
                                            )}
                                          </div>
                                          <div>
                                            <Select
                                              value={entryData?.contractorId || ''}
                                              onValueChange={(value) => 
                                                handleEntryChange(item.id, 'contractorId', value)
                                              }
                                            >
                                              <SelectTrigger className={`text-sm ${
                                                validationErrors[`${item.id}_contractorId`] ? 'border-red-500' : ''
                                              }`}>
                                                <SelectValue placeholder="Subcontratista *" />
                                              </SelectTrigger>
                                              <SelectContent>
                                                {contractors.map(c => (
                                                  <SelectItem key={c.id} value={c.id}>
                                                    {c.name}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                            {validationErrors[`${item.id}_contractorId`] && (
                                              <p className="text-[10px] text-red-500 mt-0.5">
                                                {validationErrors[`${item.id}_contractorId`]}
                                              </p>
                                            )}
                                          </div>
                                          <div>
                                            <Input
                                              placeholder="Notas *"
                                              value={entryData?.notes || ''}
                                              onChange={(e) => 
                                                handleEntryChange(item.id, 'notes', e.target.value)
                                              }
                                              className={`text-sm ${
                                                validationErrors[`${item.id}_notes`] ? 'border-red-500' : ''
                                              }`}
                                            />
                                            {validationErrors[`${item.id}_notes`] && (
                                              <p className="text-[10px] text-red-500 mt-0.5">
                                                {validationErrors[`${item.id}_notes`]}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </ScrollArea>
              </div>

              <DialogFooter className="mt-4 gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Registrar Avance
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Está seguro de guardar este avance?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>Se registrarán <strong>{selectedCount}</strong> actividad(es) para el día de hoy.</p>
                {hasAnyExceeding() && (
                  <p className="mt-2 text-amber-600 font-medium">
                    ⚠️ {exceedingCount} ítem(s) superan la cantidad presupuestada y quedarán pendientes de aprobación del administrador.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit}>
              Confirmar y Guardar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
