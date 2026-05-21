'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { PAYMENT_TYPE, PAYMENT_PRIORITY } from '@/lib/constants';

interface NuevoPagoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: { id: string; name: string; code: string | null }[];
  contractors: { id: string; name: string; nit: string }[];
  onSuccess: () => void;
}

export function NuevoPagoDialog({
  open,
  onOpenChange,
  projects,
  contractors,
  onSuccess
}: NuevoPagoDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    projectId: '',
    concept: '',
    amount: '',
    paymentType: 'CORTE_OBRA',
    priority: 'NORMAL',
    dueDate: '',
    contractorId: '',
    beneficiaryName: '',
    beneficiaryNit: '',
    bankName: '',
    accountType: '',
    accountNumber: '',
    notes: '',
    requiredApprovalLevel: '2'
  });

  const resetForm = () => {
    setFormData({
      projectId: '',
      concept: '',
      amount: '',
      paymentType: 'CORTE_OBRA',
      priority: 'NORMAL',
      dueDate: '',
      contractorId: '',
      beneficiaryName: '',
      beneficiaryNit: '',
      bankName: '',
      accountType: '',
      accountNumber: '',
      notes: '',
      requiredApprovalLevel: '2'
    });
    setError('');
    setSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
          requiredApprovalLevel: parseInt(formData.requiredApprovalLevel),
          contractorId: formData.contractorId || null,
          dueDate: formData.dueDate || null
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al crear solicitud');
      }

      setSuccess(true);
      setTimeout(() => {
        resetForm();
        onSuccess();
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva Solicitud de Pago</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Solicitud creada exitosamente
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="projectId">Proyecto *</Label>
              <Select
                value={formData.projectId}
                onValueChange={(value) => setFormData({ ...formData, projectId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar proyecto" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.code ? `${project.code} - ` : ''}{project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label htmlFor="concept">Concepto del Pago *</Label>
              <Textarea
                id="concept"
                value={formData.concept}
                onChange={(e) => setFormData({ ...formData, concept: e.target.value })}
                placeholder="Descripción detallada del concepto de pago"
                rows={2}
                required
              />
            </div>

            <div>
              <Label htmlFor="amount">Monto (COP) *</Label>
              <Input
                id="amount"
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0"
                min="0"
                step="0.01"
                required
              />
            </div>

            <div>
              <Label htmlFor="paymentType">Tipo de Pago</Label>
              <Select
                value={formData.paymentType}
                onValueChange={(value) => setFormData({ ...formData, paymentType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_TYPE).map(([key, value]) => (
                    <SelectItem key={key} value={key}>{value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="priority">Prioridad</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_PRIORITY).map(([key, value]) => (
                    <SelectItem key={key} value={key}>{value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="dueDate">Fecha Límite</Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="requiredApprovalLevel">Niveles de Aprobación</Label>
              <Select
                value={formData.requiredApprovalLevel}
                onValueChange={(value) => setFormData({ ...formData, requiredApprovalLevel: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 nivel (Director)</SelectItem>
                  <SelectItem value="2">2 niveles (Director + Gerente)</SelectItem>
                  <SelectItem value="3">3 niveles (Director + Gerente + Admin)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="contractorId">Subcontratista</Label>
              <Select
                value={formData.contractorId}
                onValueChange={(value) => setFormData({ ...formData, contractorId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ninguno (pago a terceros)</SelectItem>
                  {contractors.map((contractor) => (
                    <SelectItem key={contractor.id} value={contractor.id}>
                      {contractor.name} ({contractor.nit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Datos del beneficiario (si no es subcontratista) */}
          {formData.contractorId === '' || formData.contractorId === 'none' ? (
            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium mb-3">Datos del Beneficiario</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="beneficiaryName">Nombre del Beneficiario</Label>
                  <Input
                    id="beneficiaryName"
                    value={formData.beneficiaryName}
                    onChange={(e) => setFormData({ ...formData, beneficiaryName: e.target.value })}
                    placeholder="Nombre o razón social"
                  />
                </div>
                <div>
                  <Label htmlFor="beneficiaryNit">NIT / Cédula</Label>
                  <Input
                    id="beneficiaryNit"
                    value={formData.beneficiaryNit}
                    onChange={(e) => setFormData({ ...formData, beneficiaryNit: e.target.value })}
                    placeholder="123456789-0"
                  />
                </div>
                <div>
                  <Label htmlFor="bankName">Banco</Label>
                  <Input
                    id="bankName"
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    placeholder="Nombre del banco"
                  />
                </div>
                <div>
                  <Label htmlFor="accountType">Tipo de Cuenta</Label>
                  <Select
                    value={formData.accountType}
                    onValueChange={(value) => setFormData({ ...formData, accountType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AHORROS">Ahorros</SelectItem>
                      <SelectItem value="CORRIENTE">Corriente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label htmlFor="accountNumber">Número de Cuenta</Label>
                  <Input
                    id="accountNumber"
                    value={formData.accountNumber}
                    onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                    placeholder="Número de cuenta bancaria"
                  />
                </div>
              </div>
            </div>
          ) : null}

          <div>
            <Label htmlFor="notes">Notas Adicionales</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Observaciones o notas adicionales"
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || success}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                'Crear Solicitud'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
