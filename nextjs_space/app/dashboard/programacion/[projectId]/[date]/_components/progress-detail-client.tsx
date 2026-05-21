'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Calendar,
  Cloud,
  User,
  Users,
  FileText,
  Layers,
  Building2,
  Edit,
  Trash2,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  ShieldCheck
} from 'lucide-react';
import { formatDate, formatShortDate } from '@/lib/format';
import { WEATHER_OPTIONS, ROLES_CAN_CREATE_PROGRESS } from '@/lib/constants';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ProgressEntry {
  id: string;
  quantityToday: number;
  notes?: string | null;
  exceedsQuantity: boolean;
  status: string;
  approvedBy?: { name: string } | null;
  approvedAt?: Date | string | null;
  budgetItem: {
    id: string;
    itemNumber: string;
    description: string;
    unit: string;
    quantity: number;
    layer: {
      code: string;
      name: string;
    };
  };
  contractor?: {
    id: string;
    name: string;
  } | null;
}

interface ProgressPhoto {
  id: string;
  fileName: string;
  cloudStoragePath: string;
  caption?: string | null;
}

interface DailyProgress {
  id: string;
  date: Date | string;
  weather?: string | null;
  temperature?: number | null;
  generalNotes?: string | null;
  personnelCount: number;
  createdAt: Date | string;
  project: {
    id: string;
    name: string;
    code?: string | null;
    client: string;
  };
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  entries: ProgressEntry[];
  photos: ProgressPhoto[];
}

interface ProgressDetailClientProps {
  dailyProgress: DailyProgress;
  userRole: string;
  contractors: Array<{ id: string; name: string }>;
}

export default function ProgressDetailClient({ dailyProgress, userRole, contractors }: ProgressDetailClientProps) {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editContractorId, setEditContractorId] = useState<string>('none');
  const [savingEntryId, setSavingEntryId] = useState<string | null>(null);

  const canEdit = ROLES_CAN_CREATE_PROGRESS.includes(userRole as (typeof ROLES_CAN_CREATE_PROGRESS)[number]);
  const canApprove = ['ADMIN', 'GERENTE', 'DIRECTOR'].includes(userRole);

  const startEditEntry = (entry: ProgressEntry) => {
    setEditingEntryId(entry.id);
    setEditQuantity(String(entry.quantityToday));
    setEditNotes(entry.notes ?? '');
    setEditContractorId(entry.contractor?.id ?? 'none');
  };

  const cancelEditEntry = () => {
    setEditingEntryId(null);
    setEditQuantity('');
    setEditNotes('');
    setEditContractorId('none');
  };

  const saveEditEntry = async (entryId: string) => {
    const quantity = parseFloat(editQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      alert('La cantidad debe ser mayor a cero');
      return;
    }

    setSavingEntryId(entryId);
    try {
      const response = await fetch(`/api/programacion/entries/${entryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantityToday: quantity,
          notes: editNotes,
          contractorId: editContractorId === 'none' ? null : editContractorId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error || 'No se pudo actualizar el ítem');
      }

      cancelEditEntry();
      router.refresh();
    } catch (error: any) {
      alert(error?.message || 'Error al actualizar el ítem');
    } finally {
      setSavingEntryId(null);
    }
  };

  const handleApproval = async (entryId: string, action: 'approve' | 'reject') => {
    setApprovingId(entryId);
    try {
      const response = await fetch(`/api/programacion/entries/${entryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      if (response.ok) {
        router.refresh();
      }
    } catch (error) {
      console.error('Error updating entry:', error);
    } finally {
      setApprovingId(null);
    }
  };

  // Agrupar entradas por capa
  const entriesByLayer: Record<string, ProgressEntry[]> = {};
  dailyProgress.entries.forEach(entry => {
    const layerCode = entry.budgetItem.layer.code;
    if (!entriesByLayer[layerCode]) {
      entriesByLayer[layerCode] = [];
    }
    entriesByLayer[layerCode].push(entry);
  });

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/programacion/${dailyProgress.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        router.push(`/dashboard/programacion/${dailyProgress.project.id}`);
        router.refresh();
      }
    } catch (error) {
      console.error('Error deleting progress:', error);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/programacion/${dailyProgress.project.id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gray-500" />
              <h1 className="text-2xl font-bold">
                {formatDate(dailyProgress.date)}
              </h1>
            </div>
            <p className="text-gray-500">
              {dailyProgress.project.code && `${dailyProgress.project.code} - `}
              {dailyProgress.project.name}
            </p>
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button 
              variant="destructive" 
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </Button>
          </div>
        )}
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {dailyProgress.weather && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Cloud className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-sm text-gray-500">Clima</p>
                  <p className="font-semibold">
                    {WEATHER_OPTIONS[dailyProgress.weather as keyof typeof WEATHER_OPTIONS] || dailyProgress.weather}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-sm text-gray-500">Actividades</p>
                <p className="font-semibold">{dailyProgress.entries.length} registradas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <User className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-sm text-gray-500">Registrado por</p>
                <p className="font-semibold text-sm truncate">{dailyProgress.createdBy.name}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notas Generales */}
      {dailyProgress.generalNotes && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Notas Generales</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 whitespace-pre-wrap">{dailyProgress.generalNotes}</p>
          </CardContent>
        </Card>
      )}

      {/* Actividades por Capa */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Actividades Ejecutadas
          </CardTitle>
          <CardDescription>
            Detalle de avance por ítem de presupuesto
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dailyProgress.entries.length === 0 ? (
            <p className="text-center py-8 text-gray-500">No hay actividades registradas</p>
          ) : (
            <div className="space-y-6">
              {Object.entries(entriesByLayer).map(([layerCode, entries]) => (
                <div key={layerCode}>
                  <h3 className="font-semibold text-sm text-gray-700 mb-3 flex items-center gap-2">
                    <Badge variant="outline">{layerCode}</Badge>
                    {entries[0].budgetItem.layer.name}
                  </h3>
                  <div className="space-y-3">
                    {entries.map((entry) => {
                      const isPending = entry.status === 'PENDING_APPROVAL';
                      const isRejected = entry.status === 'REJECTED';
                      const isApproved = entry.status === 'APPROVED';
                      return (
                        <div 
                          key={entry.id} 
                          className={`border rounded-lg p-4 ${
                            isPending 
                              ? 'bg-amber-50 border-amber-300' 
                              : isRejected 
                                ? 'bg-red-50 border-red-300' 
                                : 'bg-gray-50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium">
                                  {entry.budgetItem.itemNumber} - {entry.budgetItem.description}
                                </p>
                                {isPending && (
                                  <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Pendiente Aprobación
                                  </Badge>
                                )}
                                {isRejected && (
                                  <Badge variant="destructive" className="text-xs">
                                    <XCircle className="h-3 w-3 mr-1" />
                                    Rechazado
                                  </Badge>
                                )}
                                {entry.exceedsQuantity && isApproved && (
                                  <Badge className="bg-green-100 text-green-800 border-green-300 text-xs">
                                    <ShieldCheck className="h-3 w-3 mr-1" />
                                    Aprobado
                                  </Badge>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-4 mt-2 text-sm">
                                <span className={`px-2 py-1 rounded ${
                                  entry.exceedsQuantity 
                                    ? 'bg-amber-100 text-amber-800' 
                                    : 'bg-blue-100 text-blue-800'
                                }`}>
                                  <strong>{entry.quantityToday.toFixed(2)}</strong> {entry.budgetItem.unit}
                                  {entry.exceedsQuantity && (
                                    <span className="ml-1 text-xs">(Total: {entry.budgetItem.quantity})</span>
                                  )}
                                </span>
                                {entry.contractor && (
                                  <span className="flex items-center gap-1 text-gray-600">
                                    <Building2 className="h-4 w-4" />
                                    {entry.contractor.name}
                                  </span>
                                )}
                              </div>
                              {entry.notes && (
                                <p className="mt-2 text-sm text-gray-600 italic">
                                  &quot;{entry.notes}&quot;
                                </p>
                              )}
                              {entry.approvedBy && (
                                <p className="mt-1 text-xs text-gray-500">
                                  {isApproved ? 'Aprobado' : 'Rechazado'} por: {entry.approvedBy.name}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-2 shrink-0">
                              {canEdit && editingEntryId !== entry.id && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => startEditEntry(entry)}
                                >
                                  <Edit className="h-4 w-4 mr-1" />
                                  Editar
                                </Button>
                              )}
                              {/* Approval buttons for admin */}
                              {isPending && canApprove && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-green-600 border-green-300 hover:bg-green-50"
                                    onClick={() => handleApproval(entry.id, 'approve')}
                                    disabled={approvingId === entry.id}
                                  >
                                    {approvingId === entry.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <>
                                        <CheckCircle className="h-4 w-4 mr-1" />
                                        Aprobar
                                      </>
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-red-600 border-red-300 hover:bg-red-50"
                                    onClick={() => handleApproval(entry.id, 'reject')}
                                    disabled={approvingId === entry.id}
                                  >
                                    <XCircle className="h-4 w-4 mr-1" />
                                    Rechazar
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                          {editingEntryId === entry.id && (
                            <div className="mt-3 border rounded-md p-3 bg-white">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <p className="text-xs text-gray-500">Cantidad ejecutada</p>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={editQuantity}
                                    onChange={(e) => setEditQuantity(e.target.value)}
                                    disabled={savingEntryId === entry.id}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <p className="text-xs text-gray-500">Notas</p>
                                  <Textarea
                                    value={editNotes}
                                    onChange={(e) => setEditNotes(e.target.value)}
                                    rows={2}
                                    disabled={savingEntryId === entry.id}
                                  />
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                  <p className="text-xs text-gray-500">Subcontratista</p>
                                  <Select
                                    value={editContractorId}
                                    onValueChange={setEditContractorId}
                                    disabled={savingEntryId === entry.id}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Sin subcontratista" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">Sin subcontratista</SelectItem>
                                      {contractors.map((contractor) => (
                                        <SelectItem key={contractor.id} value={contractor.id}>
                                          {contractor.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <div className="mt-3 flex gap-2 justify-end">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={cancelEditEntry}
                                  disabled={savingEntryId === entry.id}
                                >
                                  Cancelar
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => saveEditEntry(entry.id)}
                                  disabled={savingEntryId === entry.id}
                                >
                                  {savingEntryId === entry.id ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                      Guardando...
                                    </>
                                  ) : (
                                    'Guardar'
                                  )}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metadatos */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Clock className="h-4 w-4" />
            <span>Creado: {formatShortDate(dailyProgress.createdAt)}</span>
            <span>•</span>
            <span>Por: {dailyProgress.createdBy.email}</span>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Registro de Avance</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de eliminar este registro de avance del {formatShortDate(dailyProgress.date)}?
              Esta acción no se puede deshacer y se perderán todos los datos de las actividades registradas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleting}
            >
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
