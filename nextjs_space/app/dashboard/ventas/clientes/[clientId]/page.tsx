'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Building2,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Edit,
  Loader2,
  FileText,
  Plus,
  Briefcase,
  Tag
} from 'lucide-react';
import { formatDate, formatShortDate, formatCurrency } from '@/lib/format';
import {
  CLIENT_STATUS,
  CLIENT_STATUS_COLORS,
  CLIENT_SOURCE,
  QUOTATION_STATUS,
  QUOTATION_STATUS_COLORS
} from '@/lib/constants';
import Link from 'next/link';

type ClientStatusColorKey = keyof typeof CLIENT_STATUS_COLORS;
type QuotationStatusColorKey = keyof typeof QUOTATION_STATUS_COLORS;

interface Quotation {
  id: string;
  quotationNumber: string;
  title: string;
  status: string;
  total: number;
  validUntil: string;
  createdAt: string;
}

interface Client {
  id: string;
  clientNumber: string;
  companyName: string;
  nit?: string;
  contactName: string;
  contactPosition?: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
  sector?: string;
  source: string;
  status: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  quotations: Quotation[];
}

export default function ClienteDetailPage() {
  const params = useParams();
  const { clientId } = params;
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editData, setEditData] = useState<Partial<Client>>({});

  const fetchClient = useCallback(async () => {
    try {
      const res = await fetch(`/api/clientes/${clientId}`);
      if (res.ok) {
        const data = await res.json();
        setClient(data);
        setEditData(data);
      } else {
        router.push('/dashboard/ventas/clientes');
      }
    } catch (error) {
      console.error('Error fetching client:', error);
    } finally {
      setLoading(false);
    }
  }, [clientId, router]);

  useEffect(() => {
    fetchClient();
  }, [fetchClient]);

  const handleSave = async () => {
    setError('');
    setSaving(true);

    try {
      const res = await fetch(`/api/clientes/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      });

      if (res.ok) {
        fetchClient();
        setShowEditDialog(false);
      } else {
        const data = await res.json();
        setError(data.error || 'Error al actualizar');
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Error al actualizar cliente');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!client) {
    return null;
  }

  const totalQuotationValue = client.quotations.reduce((sum, q) => sum + q.total, 0);
  const acceptedQuotations = client.quotations.filter(q => q.status === 'ACCEPTED');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/ventas/clientes">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{client.companyName}</h1>
              <Badge variant={CLIENT_STATUS_COLORS[client.status as ClientStatusColorKey] as "default" | "secondary" | "success" | "destructive" | "warning" | "outline" | null | undefined}>
                {CLIENT_STATUS[client.status as keyof typeof CLIENT_STATUS]}
              </Badge>
            </div>
            <p className="text-muted-foreground">{client.clientNumber}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/dashboard/ventas/cotizaciones/nueva?clientId=${client.id}`}>
            <Button variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Nueva Cotización
            </Button>
          </Link>
          <Button onClick={() => setShowEditDialog(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Editar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Información del Cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">{client.contactName}</p>
                      {client.contactPosition && (
                        <p className="text-sm text-muted-foreground">{client.contactPosition}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <a href={`mailto:${client.email}`} className="text-primary hover:underline">
                      {client.email}
                    </a>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <span>{client.phone}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  {client.nit && (
                    <div className="flex items-center gap-3">
                      <Briefcase className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">NIT</p>
                        <p className="font-medium">{client.nit}</p>
                      </div>
                    </div>
                  )}
                  {(client.city || client.address) && (
                    <div className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        {client.city && <p className="font-medium">{client.city}</p>}
                        {client.address && <p className="text-sm text-muted-foreground">{client.address}</p>}
                      </div>
                    </div>
                  )}
                  {client.sector && (
                    <div className="flex items-center gap-3">
                      <Tag className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Sector</p>
                        <p>{client.sector}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {client.notes && (
                <>
                  <Separator className="my-4" />
                  <div>
                    <h4 className="font-medium mb-2">Notas</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{client.notes}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Quotations */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Cotizaciones ({client.quotations.length})
              </CardTitle>
              <Link href={`/dashboard/ventas/cotizaciones/nueva?clientId=${client.id}`}>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Nueva
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {client.quotations.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No hay cotizaciones para este cliente
                </p>
              ) : (
                <div className="space-y-3">
                  {client.quotations.map((quotation) => (
                    <div
                      key={quotation.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => router.push(`/dashboard/ventas/cotizaciones/${quotation.id}`)}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">{quotation.quotationNumber}</span>
                          <Badge variant={QUOTATION_STATUS_COLORS[quotation.status as QuotationStatusColorKey] as "default" | "secondary" | "success" | "destructive" | "warning" | "outline" | null | undefined}>
                            {QUOTATION_STATUS[quotation.status as keyof typeof QUOTATION_STATUS]}
                          </Badge>
                        </div>
                        <p className="text-sm mt-1">{quotation.title}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatCurrency(quotation.total)}</p>
                        <p className="text-xs text-muted-foreground">{formatShortDate(quotation.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Cotizado</p>
                <p className="text-2xl font-bold">{formatCurrency(totalQuotationValue)}</p>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold">{client.quotations.length}</p>
                  <p className="text-xs text-muted-foreground">Cotizaciones</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{acceptedQuotations.length}</p>
                  <p className="text-xs text-muted-foreground">Aceptadas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4" />
                Información
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Origen:</span>
                <span>{CLIENT_SOURCE[client.source as keyof typeof CLIENT_SOURCE]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Registrado:</span>
                <span>{formatDate(client.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Actualizado:</span>
                <span>{formatDate(client.updatedAt)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
            <DialogDescription>
              Actualizar información del cliente
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Empresa *</Label>
                <Input
                  value={editData.companyName || ''}
                  onChange={(e) => setEditData({ ...editData, companyName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>NIT</Label>
                <Input
                  value={editData.nit || ''}
                  onChange={(e) => setEditData({ ...editData, nit: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Contacto *</Label>
                <Input
                  value={editData.contactName || ''}
                  onChange={(e) => setEditData({ ...editData, contactName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Cargo</Label>
                <Input
                  value={editData.contactPosition || ''}
                  onChange={(e) => setEditData({ ...editData, contactPosition: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={editData.email || ''}
                  onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Teléfono *</Label>
                <Input
                  value={editData.phone || ''}
                  onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ciudad</Label>
                <Input
                  value={editData.city || ''}
                  onChange={(e) => setEditData({ ...editData, city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select
                  value={editData.status}
                  onValueChange={(value) => setEditData({ ...editData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CLIENT_STATUS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                value={editData.notes || ''}
                onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
