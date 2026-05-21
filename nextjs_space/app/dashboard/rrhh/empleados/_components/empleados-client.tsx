'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Users, 
  UserPlus, 
  Search, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Clock,
  Briefcase,
  Building2,
  ChevronRight
} from 'lucide-react';
import {
  EMPLOYEE_STATUS,
  EMPLOYEE_STATUS_COLORS,
  EMPLOYEE_DEPARTMENT,
  EMPLOYEE_CONTRACT_TYPE,
  ROLES_CAN_MANAGE_HR
} from '@/lib/constants';
import { formatShortDate } from '@/lib/format';

type UserRole = keyof typeof import('@/lib/constants').USER_ROLE;

interface Alert {
  type: 'missing' | 'expired' | 'expiring';
  message: string;
  documentType?: string;
}

interface Employee {
  id: string;
  employeeNumber: string;
  position: string;
  department: string;
  contractType: string;
  startDate: Date | string;
  endDate?: Date | string | null;
  status: string;
  eps?: string | null;
  arl?: string | null;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  documents: Array<{
    id: string;
    type: string;
    fileName: string;
    expirationDate?: Date | string | null;
  }>;
  alerts: Alert[];
  hasAlerts: boolean;
}

interface Stats {
  total: number;
  active: number;
  withAlerts: number;
  onLeave: number;
}

interface EmpleadosClientProps {
  employees: Employee[];
  stats: Stats;
  userRole: string;
}

export default function EmpleadosClient({ employees, stats, userRole }: EmpleadosClientProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');

  const canManage = ROLES_CAN_MANAGE_HR.includes(userRole as (typeof ROLES_CAN_MANAGE_HR)[number]);

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = 
      emp.employeeNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.user?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.user?.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || emp.status === statusFilter;
    const matchesDepartment = departmentFilter === 'all' || emp.department === departmentFilter;

    return matchesSearch && matchesStatus && matchesDepartment;
  });

  const getStatusBadge = (status: string) => {
    const colorKey = status as keyof typeof EMPLOYEE_STATUS_COLORS;
    const variant = EMPLOYEE_STATUS_COLORS[colorKey] as 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
    const statusKey = status as keyof typeof EMPLOYEE_STATUS;
    return (
      <Badge variant={variant}>
        {EMPLOYEE_STATUS[statusKey] || status}
      </Badge>
    );
  };

  const getAlertIcon = (hasAlerts: boolean, alerts: Alert[]) => {
    if (!hasAlerts) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
    
    const hasExpired = alerts.some(a => a.type === 'expired');
    if (hasExpired) {
      return <XCircle className="h-5 w-5 text-red-500" />;
    }
    
    return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-7 w-7" />
            Empleados
          </h1>
          <p className="text-gray-500 mt-1">Gestión de personal y documentos corporativos</p>
        </div>
        {canManage && (
          <Link href="/dashboard/rrhh/empleados/nuevo">
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Nuevo Empleado
            </Button>
          </Link>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Activos</p>
                <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Con Alertas</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.withAlerts}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">En Licencia</p>
                <p className="text-2xl font-bold text-blue-600">{stats.onLeave}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por número, nombre, cargo o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {Object.entries(EMPLOYEE_STATUS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Departamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(EMPLOYEE_DEPARTMENT).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Employee List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Listado de Empleados ({filteredEmployees.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredEmployees.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">No se encontraron empleados</p>
              {canManage && (
                <Link href="/dashboard/rrhh/empleados/nuevo">
                  <Button variant="outline" className="mt-4">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Crear Primer Empleado
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEmployees.map((emp) => (
                <Link key={emp.id} href={`/dashboard/rrhh/empleados/${emp.id}`}>
                  <div className="border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {getAlertIcon(emp.hasAlerts, emp.alerts)}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-gray-500">{emp.employeeNumber}</span>
                            {getStatusBadge(emp.status)}
                          </div>
                          <p className="font-semibold mt-1">
                            {emp.user?.name || 'Sin usuario vinculado'}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                            <span className="flex items-center gap-1">
                              <Briefcase className="h-4 w-4" />
                              {emp.position}
                            </span>
                            <span className="flex items-center gap-1">
                              <Building2 className="h-4 w-4" />
                              {EMPLOYEE_DEPARTMENT[emp.department as keyof typeof EMPLOYEE_DEPARTMENT] || emp.department}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                          <p className="text-sm text-gray-500">
                            {EMPLOYEE_CONTRACT_TYPE[emp.contractType as keyof typeof EMPLOYEE_CONTRACT_TYPE] || emp.contractType}
                          </p>
                          <p className="text-xs text-gray-400">
                            Desde: {formatShortDate(emp.startDate)}
                          </p>
                          <p className="text-xs text-gray-400">
                            {emp.documents.length} documentos
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      </div>
                    </div>
                    {emp.hasAlerts && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex flex-wrap gap-2">
                          {emp.alerts.slice(0, 3).map((alert, idx) => (
                            <Badge 
                              key={idx} 
                              variant={alert.type === 'expired' ? 'destructive' : alert.type === 'missing' ? 'secondary' : 'warning'}
                              className="text-xs"
                            >
                              {alert.message}
                            </Badge>
                          ))}
                          {emp.alerts.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{emp.alerts.length - 3} más
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
