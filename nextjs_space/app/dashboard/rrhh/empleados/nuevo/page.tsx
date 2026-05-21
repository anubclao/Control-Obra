'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Loader2, UserPlus, Building2, CreditCard, Heart } from 'lucide-react';
import { EMPLOYEE_DEPARTMENT, EMPLOYEE_CONTRACT_TYPE } from '@/lib/constants';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function NuevoEmpleadoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Form state
  const [formData, setFormData] = useState({
    userId: '',
    position: '',
    department: 'OPERACIONES',
    contractType: 'INDEFINIDO',
    startDate: new Date().toISOString().split('T')[0],
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
    accountNumber: ''
  });

  // Fetch users without employee records
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch('/api/usuarios');
        if (response.ok) {
          const allUsers = await response.json();
          // Filter users that don't have an employee record
          const employeesResponse = await fetch('/api/empleados');
          const employees = employeesResponse.ok ? await employeesResponse.json() : [];
          const employeeUserIds = employees.map((e: { userId?: string }) => e.userId).filter(Boolean);
          const availableUsers = allUsers.filter((u: User) => !employeeUserIds.includes(u.id));
          setUsers(availableUsers);
        }
      } catch (err) {
        console.error('Error fetching users:', err);
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, []);

  const handleChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/empleados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          userId: formData.userId || null
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al crear empleado');
      }

      const employee = await response.json();
      router.push(`/dashboard/rrhh/empleados/${employee.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear empleado');
    } finally {
      setLoading(false);
    }
  };

  const commonEPS = ['Sura', 'Sanitas', 'Nueva EPS', 'Compensar', 'Coomeva', 'Famisanar', 'Salud Total', 'Medimás'];
  const commonPensions = ['Porvenir', 'Protección', 'Colfondos', 'Skandia', 'Old Mutual'];
  const commonARL = ['Sura', 'Positiva', 'Colmena', 'Bolívar', 'Liberty', 'Axxa Colpatria'];
  const banks = ['Bancolombia', 'Davivienda', 'BBVA', 'Banco de Bogotá', 'Banco de Occidente', 'Banco Popular', 'Nequi', 'Daviplata'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/rrhh/empleados">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UserPlus className="h-7 w-7" />
            Nuevo Empleado
          </h1>
          <p className="text-gray-500">Registrar un nuevo empleado en el sistema</p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Información Básica */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Información Laboral
            </CardTitle>
            <CardDescription>Datos del cargo y contrato</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Usuario del Sistema (Opcional)</Label>
                <Select value={formData.userId} onValueChange={(value) => handleChange('userId', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Vincular con usuario existente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin vincular</SelectItem>
                    {loadingUsers ? (
                      <SelectItem value="loading" disabled>Cargando...</SelectItem>
                    ) : (
                      users.map(user => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name} ({user.email})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="position">Cargo *</Label>
                <Input
                  id="position"
                  value={formData.position}
                  onChange={(e) => handleChange('position', e.target.value)}
                  placeholder="Ej: Ingeniero Residente"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Departamento *</Label>
                <Select value={formData.department} onValueChange={(value) => handleChange('department', value)}>
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

              <div className="space-y-2">
                <Label>Tipo de Contrato *</Label>
                <Select value={formData.contractType} onValueChange={(value) => handleChange('contractType', value)}>
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
                <Label htmlFor="startDate">Fecha de Ingreso *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => handleChange('startDate', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">Fecha de Terminación</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => handleChange('endDate', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="salary">Salario Base</Label>
                <Input
                  id="salary"
                  type="number"
                  value={formData.salary}
                  onChange={(e) => handleChange('salary', e.target.value)}
                  placeholder="Ej: 3500000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legalBonus">Auxilio Legal (COP)</Label>
                <Input
                  id="legalBonus"
                  type="number"
                  value={formData.legalBonus}
                  onChange={(e) => handleChange('legalBonus', e.target.value)}
                  placeholder="Ej: 162000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="extraLegalBonus">Auxilio Extralegal (COP)</Label>
                <Input
                  id="extraLegalBonus"
                  type="number"
                  value={formData.extraLegalBonus}
                  onChange={(e) => handleChange('extraLegalBonus', e.target.value)}
                  placeholder="Opcional"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Seguridad Social */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Heart className="h-5 w-5" />
              Seguridad Social
            </CardTitle>
            <CardDescription>Afiliaciones a EPS, Pensión y ARL</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>EPS</Label>
                <Select value={formData.eps} onValueChange={(value) => handleChange('eps', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar EPS" />
                  </SelectTrigger>
                  <SelectContent>
                    {commonEPS.map(eps => (
                      <SelectItem key={eps} value={eps}>{eps}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Fondo de Pensiones</Label>
                <Select value={formData.pensionFund} onValueChange={(value) => handleChange('pensionFund', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar Fondo" />
                  </SelectTrigger>
                  <SelectContent>
                    {commonPensions.map(pension => (
                      <SelectItem key={pension} value={pension}>{pension}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>ARL</Label>
                <Select value={formData.arl} onValueChange={(value) => handleChange('arl', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar ARL" />
                  </SelectTrigger>
                  <SelectContent>
                    {commonARL.map(arl => (
                      <SelectItem key={arl} value={arl}>{arl}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Nivel de Riesgo ARL</Label>
                <Select value={formData.riskLevel} onValueChange={(value) => handleChange('riskLevel', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Nivel I - Riesgo Mínimo</SelectItem>
                    <SelectItem value="2">Nivel II - Riesgo Bajo</SelectItem>
                    <SelectItem value="3">Nivel III - Riesgo Medio</SelectItem>
                    <SelectItem value="4">Nivel IV - Riesgo Alto</SelectItem>
                    <SelectItem value="5">Nivel V - Riesgo Máximo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Información Bancaria */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Información Bancaria
            </CardTitle>
            <CardDescription>Datos para pago de nómina</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Banco</Label>
                <Select value={formData.bankName} onValueChange={(value) => handleChange('bankName', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar Banco" />
                  </SelectTrigger>
                  <SelectContent>
                    {banks.map(bank => (
                      <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tipo de Cuenta</Label>
                <Select value={formData.accountType} onValueChange={(value) => handleChange('accountType', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AHORROS">Ahorros</SelectItem>
                    <SelectItem value="CORRIENTE">Corriente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="accountNumber">Número de Cuenta</Label>
                <Input
                  id="accountNumber"
                  value={formData.accountNumber}
                  onChange={(e) => handleChange('accountNumber', e.target.value)}
                  placeholder="Ej: 1234567890"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Buttons */}
        <div className="flex justify-end gap-4">
          <Link href="/dashboard/rrhh/empleados">
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </Link>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                Crear Empleado
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
