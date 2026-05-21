'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  FileText,
  Percent,
  Building2,
  AlertCircle,
  CheckCircle,
  Wand2
} from 'lucide-react';
import { TAX_TYPE, TAX_APPLIES_TO, ROLES_CAN_CONFIGURE_TAXES } from '@/lib/constants';

type TaxTypeKey = keyof typeof TAX_TYPE;
type TaxAppliesToKey = keyof typeof TAX_APPLIES_TO;
type TaxRoleKey = (typeof ROLES_CAN_CONFIGURE_TAXES)[number];

interface Tax {
  id: string;
  name: string;
  rate: number;
  type: string;
  appliesTo: string;
  isActive: boolean;
  project: { id: string; name: string; code: string | null };
}

interface TaxGroup {
  project: { id: string; name: string; code: string | null };
  taxes: Tax[];
}

interface ImpuestosClientProps {
  taxesByProject: TaxGroup[];
  projects: { id: string; name: string; code: string | null }[];
  userRole: string;
}

export function ImpuestosClient({ taxesByProject, projects, userRole }: ImpuestosClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showInitDialog, setShowInitDialog] = useState(false);
  const [selectedProjectForInit, setSelectedProjectForInit] = useState('');

  const canConfigureTaxes = ROLES_CAN_CONFIGURE_TAXES.includes(userRole as TaxRoleKey);

  const getErrorMessage = (err: unknown, fallback: string) => {
    if (err instanceof Error && err.message) {
      return err.message;
    }
    return fallback;
  };

  const [newTax, setNewTax] = useState({
    projectId: '',
    name: '',
    rate: '',
    type: 'IVA',
    appliesTo: 'VENTAS'
  });

  // Proyectos sin impuestos configurados
  const projectsWithTaxes = taxesByProject.map(g => g.project.id);
  const projectsWithoutTaxes = projects.filter(p => !projectsWithTaxes.includes(p.id));

  const handleCreateTax = async () => {
    if (!newTax.projectId || !newTax.name || !newTax.rate) {
      setError('Complete todos los campos requeridos');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/impuestos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newTax,
          rate: parseFloat(newTax.rate)
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al crear impuesto');
      }

      setSuccess('Impuesto creado exitosamente');
      setShowNewDialog(false);
      setNewTax({ projectId: '', name: '', rate: '', type: 'IVA', appliesTo: 'VENTAS' });
      setTimeout(() => {
        setSuccess('');
        router.refresh();
      }, 1500);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Error al crear impuesto'));
    } finally {
      setLoading(false);
    }
  };

  const handleInitializeTaxes = async () => {
    if (!selectedProjectForInit) {
      setError('Seleccione un proyecto');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/impuestos/inicializar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: selectedProjectForInit })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al inicializar impuestos');
      }

      setSuccess('Impuestos predeterminados creados');
      setShowInitDialog(false);
      setSelectedProjectForInit('');
      setTimeout(() => {
        setSuccess('');
        router.refresh();
      }, 1500);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Error al inicializar impuestos'));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (taxId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/impuestos/${taxId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive })
      });

      if (!response.ok) {
        throw new Error('Error al actualizar impuesto');
      }

      router.refresh();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Error al actualizar impuesto'));
    }
  };

  const handleDeleteTax = async (taxId: string) => {
    if (!confirm('¿Está seguro de eliminar este impuesto?')) return;

    try {
      const response = await fetch(`/api/impuestos/${taxId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Error al eliminar impuesto');
      }

      router.refresh();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Error al eliminar impuesto'));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/reportes/financiero">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Configuración de Impuestos</h1>
            <p className="text-gray-500 mt-1">Administre los impuestos por proyecto</p>
          </div>
        </div>
        {canConfigureTaxes && (
          <div className="flex gap-2">
            {projectsWithoutTaxes.length > 0 && (
              <Button variant="outline" onClick={() => setShowInitDialog(true)}>
                <Wand2 className="h-4 w-4 mr-2" />
                Inicializar Colombia
              </Button>
            )}
            <Button onClick={() => setShowNewDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Impuesto
            </Button>
          </div>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Impuestos por proyecto */}
      {taxesByProject.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No hay impuestos configurados</p>
              <p className="text-sm mt-2">Configure impuestos para calcular los reportes financieros correctamente</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {taxesByProject.map((group) => (
            <Card key={group.project.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {group.project.code ? `${group.project.code} - ` : ''}{group.project.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {group.taxes.map((tax) => (
                    <div
                      key={tax.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        tax.isActive ? 'bg-white' : 'bg-gray-50 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Percent className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">{tax.name}</p>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Badge variant="secondary">{TAX_TYPE[tax.type as TaxTypeKey]}</Badge>
                            <span>•</span>
                            <span>Aplica a: {TAX_APPLIES_TO[tax.appliesTo as TaxAppliesToKey]}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="text-lg font-bold text-blue-600">
                          {tax.rate}%
                        </span>

                        {canConfigureTaxes && (
                          <>
                            <Switch
                              checked={tax.isActive}
                              onCheckedChange={() => handleToggleActive(tax.id, tax.isActive)}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDeleteTax(tax.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog para nuevo impuesto */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Impuesto</DialogTitle>
            <DialogDescription>
              Configure un nuevo impuesto para un proyecto
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Proyecto *</Label>
              <Select
                value={newTax.projectId}
                onValueChange={(value) => setNewTax({ ...newTax, projectId: value })}
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

            <div>
              <Label>Nombre del Impuesto *</Label>
              <Input
                value={newTax.name}
                onChange={(e) => setNewTax({ ...newTax, name: e.target.value })}
                placeholder="Ej: IVA 19%"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tasa (%) *</Label>
                <Input
                  type="number"
                  value={newTax.rate}
                  onChange={(e) => setNewTax({ ...newTax, rate: e.target.value })}
                  placeholder="19"
                  step="0.01"
                />
              </div>

              <div>
                <Label>Tipo</Label>
                <Select
                  value={newTax.type}
                  onValueChange={(value) => setNewTax({ ...newTax, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TAX_TYPE).map(([key, value]) => (
                      <SelectItem key={key} value={key}>{value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Aplica a</Label>
              <Select
                value={newTax.appliesTo}
                onValueChange={(value) => setNewTax({ ...newTax, appliesTo: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TAX_APPLIES_TO).map(([key, value]) => (
                    <SelectItem key={key} value={key}>{value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleCreateTax} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Crear Impuesto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para inicializar impuestos de Colombia */}
      <Dialog open={showInitDialog} onOpenChange={setShowInitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inicializar Impuestos de Colombia</DialogTitle>
            <DialogDescription>
              Crear automáticamente los impuestos estándar de Colombia para un proyecto
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Proyecto *</Label>
              <Select
                value={selectedProjectForInit}
                onValueChange={setSelectedProjectForInit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar proyecto" />
                </SelectTrigger>
                <SelectContent>
                  {projectsWithoutTaxes.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.code ? `${project.code} - ` : ''}{project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm font-medium mb-2">Impuestos que se crearán:</p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• IVA 19% (Ventas)</li>
                <li>• Retención Fuente 11% (Compras)</li>
                <li>• Retención IVA 15% (Compras)</li>
                <li>• Retención ICA 0.966% (Compras)</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInitDialog(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleInitializeTaxes} disabled={loading || !selectedProjectForInit}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Inicializar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
