'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
  Calendar,
  Edit,
  Send,
  CheckCircle,
  XCircle,
  Loader2,
  User,
  Mail,
  Phone,
  FileText,
  DollarSign,
  Trash2
} from 'lucide-react';
import { formatCurrency, formatDate, formatShortDate } from '@/lib/format';
import { QUOTATION_STATUS, QUOTATION_STATUS_COLORS, CLIENT_STATUS } from '@/lib/constants';
import Link from 'next/link';

type StatusColorKey = keyof typeof QUOTATION_STATUS_COLORS;

interface QuotationItem {
  id: string;
  itemNumber: number;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
}

interface Client {
  id: string;
  clientNumber: string;
  companyName: string;
  contactName: string;
  contactPosition?: string;
  email: string;
  phone: string;
  status: string;
}

interface Quotation {
  id: string;
  quotationNumber: string;
  title: string;
  description?: string;
  status: string;
  validUntil: string;
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  ivaPercent: number;
  ivaAmount: number;
  total: number;
  paymentTerms?: string;
  deliveryTerms?: string;
  warranty?: string;
  observations?: string;
  sentAt?: string;
  respondedAt?: string;
  createdAt: string;
  client: Client;
  items: QuotationItem[];
}

export default function CotizacionDetailPage() {
  const params = useParams();
  const { quotationId } = params;
  const router = useRouter();
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const fetchQuotation = useCallback(async () => {
    try {
      const res = await fetch(`/api/cotizaciones/${quotationId}`);
      if (res.ok) {
        const data = await res.json();
        setQuotation(data);
      } else {
        router.push('/dashboard/ventas/cotizaciones');
      }
    } catch (error) {
      console.error('Error fetching quotation:', error);
    } finally {
      setLoading(false);
    }
  }, [quotationId, router]);

  useEffect(() => {
    fetchQuotation();
  }, [fetchQuotation]);

  const updateStatus = async () => {
    if (!newStatus) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/cotizaciones/${quotationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchQuotation();
        setShowStatusDialog(false);
      }
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setUpdating(false);
    }
  };

  const deleteQuotation = async () => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/cotizaciones/${quotationId}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/dashboard/ventas/cotizaciones');
      }
    } catch (error) {
      console.error('Error deleting quotation:', error);
    } finally {
      setUpdating(false);
    }
  };

  const isExpired = quotation ? new Date(quotation.validUntil) < new Date() : false;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!quotation) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/ventas/cotizaciones">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{quotation.quotationNumber}</h1>
              <Badge variant={QUOTATION_STATUS_COLORS[quotation.status as StatusColorKey] as "default" | "secondary" | "success" | "destructive" | "warning" | "outline" | null | undefined}>
                {QUOTATION_STATUS[quotation.status as keyof typeof QUOTATION_STATUS]}
              </Badge>
              {isExpired && !['ACCEPTED', 'REJECTED', 'CANCELLED'].includes(quotation.status) && (
                <Badge variant="destructive">Vencida</Badge>
              )}
            </div>
            <p className="text-muted-foreground">{quotation.title}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {quotation.status === 'DRAFT' && (
            <>
              <Button variant="outline" onClick={() => { setNewStatus('SENT'); setShowStatusDialog(true); }}>
                <Send className="h-4 w-4 mr-2" />
                Enviar
              </Button>
              <Button variant="destructive" size="icon" onClick={() => setShowDeleteDialog(true)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
          {quotation.status === 'SENT' && (
            <>
              <Button variant="outline" className="text-green-600" onClick={() => { setNewStatus('ACCEPTED'); setShowStatusDialog(true); }}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Aceptada
              </Button>
              <Button variant="outline" className="text-red-600" onClick={() => { setNewStatus('REJECTED'); setShowStatusDialog(true); }}>
                <XCircle className="h-4 w-4 mr-2" />
                Rechazada
              </Button>
            </>
          )}
          <Button onClick={() => setShowStatusDialog(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Cambiar Estado
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {quotation.description && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Descripción</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{quotation.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Items Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Ítems ({quotation.items.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">#</th>
                      <th className="text-left py-2 px-2">Descripción</th>
                      <th className="text-center py-2 px-2">Unidad</th>
                      <th className="text-right py-2 px-2">Cantidad</th>
                      <th className="text-right py-2 px-2">P. Unitario</th>
                      <th className="text-right py-2 px-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotation.items.map((item) => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="py-3 px-2 text-muted-foreground">{item.itemNumber}</td>
                        <td className="py-3 px-2">
                          <p>{item.description}</p>
                          {item.notes && (
                            <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>
                          )}
                        </td>
                        <td className="py-3 px-2 text-center">{item.unit}</td>
                        <td className="py-3 px-2 text-right">{item.quantity}</td>
                        <td className="py-3 px-2 text-right">{formatCurrency(item.unitPrice)}</td>
                        <td className="py-3 px-2 text-right font-medium">{formatCurrency(item.totalPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Separator className="my-4" />

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span>{formatCurrency(quotation.subtotal)}</span>
                  </div>
                  {quotation.discountPercent > 0 && (
                    <div className="flex justify-between text-sm text-red-600">
                      <span>Descuento ({quotation.discountPercent}%):</span>
                      <span>-{formatCurrency(quotation.discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">IVA ({quotation.ivaPercent}%):</span>
                    <span>{formatCurrency(quotation.ivaAmount)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total:</span>
                    <span>{formatCurrency(quotation.total)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Terms */}
          {(quotation.paymentTerms || quotation.deliveryTerms || quotation.warranty || quotation.observations) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Condiciones Comerciales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {quotation.paymentTerms && (
                  <div>
                    <h4 className="font-medium text-sm">Forma de Pago</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quotation.paymentTerms}</p>
                  </div>
                )}
                {quotation.deliveryTerms && (
                  <div>
                    <h4 className="font-medium text-sm">Condiciones de Entrega</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quotation.deliveryTerms}</p>
                  </div>
                )}
                {quotation.warranty && (
                  <div>
                    <h4 className="font-medium text-sm">Garantía</h4>
                    <p className="text-sm text-muted-foreground">{quotation.warranty}</p>
                  </div>
                )}
                {quotation.observations && (
                  <div>
                    <h4 className="font-medium text-sm">Observaciones</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quotation.observations}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Client Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4" />
                Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Link
                  href={`/dashboard/ventas/clientes/${quotation.client.id}`}
                  className="font-medium hover:underline"
                >
                  {quotation.client.companyName}
                </Link>
                <p className="text-xs text-muted-foreground">{quotation.client.clientNumber}</p>
              </div>
              <Separator />
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{quotation.client.contactName}</span>
                </div>
                {quotation.client.contactPosition && (
                  <p className="text-muted-foreground pl-6">{quotation.client.contactPosition}</p>
                )}
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${quotation.client.email}`} className="text-primary hover:underline">
                    {quotation.client.email}
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{quotation.client.phone}</span>
                </div>
              </div>
              <Badge variant="outline">
                {CLIENT_STATUS[quotation.client.status as keyof typeof CLIENT_STATUS]}
              </Badge>
            </CardContent>
          </Card>

          {/* Dates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4" />
                Fechas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Creada:</span>
                <span>{formatDate(quotation.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Válida hasta:</span>
                <span className={isExpired ? 'text-red-600' : ''}>
                  {formatShortDate(quotation.validUntil)}
                </span>
              </div>
              {quotation.sentAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Enviada:</span>
                  <span>{formatShortDate(quotation.sentAt)}</span>
                </div>
              )}
              {quotation.respondedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Respuesta:</span>
                  <span>{formatShortDate(quotation.respondedAt)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Value Summary */}
          <Card className="bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign className="h-4 w-4" />
                Valor Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{formatCurrency(quotation.total)}</p>
              <p className="text-sm text-muted-foreground">
                {quotation.items.length} ítem(s) | IVA {quotation.ivaPercent}%
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Status Change Dialog */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar Estado</DialogTitle>
            <DialogDescription>
              Seleccione el nuevo estado de la cotización
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar estado" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(QUOTATION_STATUS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={updateStatus} disabled={!newStatus || updating}>
              {updating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Cotización</DialogTitle>
            <DialogDescription>
              ¿Está seguro que desea eliminar esta cotización? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={deleteQuotation} disabled={updating}>
              {updating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
