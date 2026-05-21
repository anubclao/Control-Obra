'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';
import {
  EMPLOYEE_DEPARTMENT,
  EMPLOYEE_CONTRACT_TYPE,
  EMPLOYEE_STATUS
} from '@/lib/constants';

interface Employee {
  id: string;
  position: string;
  department: string;
  contractType: string;
  startDate: Date | string;
  endDate?: Date | string | null;
  salary?: number | null;
  legalBonus?: number | null;
  extraLegalBonus?: number | null;
  eps?: string | null;
  pensionFund?: string | null;
  arl?: string | null;
  riskLevel: number;
  bankName?: string | null;
  accountType?: string | null;
  accountNumber?: string | null;
  status: string;
}

interface EditEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee;
  onSuccess: () => void;
}

export default function EditEmployeeDialog({
  open,
  onOpenChange,
  employee,
  onSuccess
}: EditEmployeeDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    position: '',
    department: '',
    contractType: '',
    startDate: '',
    endDate: '',
    salary: '',
    legalBonus: '',
    extraLegalBonus: '',
    eps: '',
    pensionFund: '',
    arl: '',
    riskLevel: '1',
    bankName: '',
    accountType: '',
    accountNumber: '',
    status: ''
  });

  useEffect(() => {
    if (employee) {
      const startDate = employee.startDate ? new Date(employee.startDate).toISOString().split('T')[0] : '';
      const endDate = employee.endDate ? new Date(employee.endDate).toISOString().split('T')[0] : '';
      
      setFormData({
        position: employee.position || '',
        department: employee.department || '',
        contractType: employee.contractType || '',
        startDate,
        endDate,
        salary: employee.salary?.toString() || '',
        legalBonus: employee.legalBonus?.toString() || '',
        extraLegalBonus: employee.extraLegalBonus?.toString() || '',
        eps: employee.eps || '',
        pensionFund: employee.pensionFund || '',
        arl: employee.arl || '',
        riskLevel: employee.riskLevel?.toString() || '1',
        bankName: employee.bankName || '',
        accountType: employee.accountType || '',
        accountNumber: employee.accountNumber || '',
        status: employee.status || ''
      });
    }
  }, [employee]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/empleados/${employee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          salary: formData.salary || null,
          legalBonus: formData.legalBonus || null,
          extraLegalBonus: formData.extraLegalBonus || null,
          endDate: formData.endDate || null
        })
      });

      if (res.ok) {
        onSuccess();
      } else {
        const data = await res.json();
        setError(data.error || 'Error al actualizar');
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Error al actualizar empleado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Editar Empleado</DialogTitle>
          <DialogDescription>
            Actualizar información del empleado
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] pr-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">
                {error}
              </div>
            )}

            {/* Información Laboral */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-gray-700">Información Laboral</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cargo *</Label>
                  <Input
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Departamento *</Label>
                  <Select
                    value={formData.department}
                    onValueChange={(value) => setFormData({ ...formData, department: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(EMPLOYEE_DEPARTMENT).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Contrato *</Label>
                  <Select
                    value={formData.contractType}
                    onValueChange={(value) => setFormData({ ...formData, contractType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(EMPLOYEE_CONTRACT_TYPE).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Estado *</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(EMPLOYEE_STATUS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fecha de Ingreso *</Label>
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha de Terminación</Label>
                  <Input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Información Salarial */}
            <div className="space-y-4 pt-4 border-t">
              <h4 className="font-medium text-sm text-gray-700">Información Salarial</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Salario Base (COP)</Label>
                  <Input
                    type="number"
                    value={formData.salary}
                    onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Auxilio Legal (COP)</Label>
                  <Input
                    type="number"
                    value={formData.legalBonus}
                    onChange={(e) => setFormData({ ...formData, legalBonus: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Auxilio Extralegal (COP)</Label>
                  <Input
                    type="number"
                    value={formData.extraLegalBonus}
                    onChange={(e) => setFormData({ ...formData, extraLegalBonus: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Seguridad Social */}
            <div className="space-y-4 pt-4 border-t">
              <h4 className="font-medium text-sm text-gray-700">Seguridad Social</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>EPS</Label>
                  <Input
                    value={formData.eps}
                    onChange={(e) => setFormData({ ...formData, eps: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fondo de Pensiones</Label>
                  <Input
                    value={formData.pensionFund}
                    onChange={(e) => setFormData({ ...formData, pensionFund: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>ARL</Label>
                  <Input
                    value={formData.arl}
                    onChange={(e) => setFormData({ ...formData, arl: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nivel de Riesgo</Label>
                  <Select
                    value={formData.riskLevel}
                    onValueChange={(value) => setFormData({ ...formData, riskLevel: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((level) => (
                        <SelectItem key={level} value={level.toString()}>Nivel {level}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Información Bancaria */}
            <div className="space-y-4 pt-4 border-t">
              <h4 className="font-medium text-sm text-gray-700">Información Bancaria</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Banco</Label>
                  <Input
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Cuenta</Label>
                  <Select
                    value={formData.accountType || ''}
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
                <div className="space-y-2">
                  <Label>Número de Cuenta</Label>
                  <Input
                    value={formData.accountNumber}
                    onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Guardar Cambios
              </Button>
            </DialogFooter>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
