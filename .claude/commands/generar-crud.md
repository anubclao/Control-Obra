# Skill: Generar CRUD

Genera las operaciones CRUD completas (API + UI) para un modelo Prisma existente en ControlObra.

## Uso

Indica el modelo Prisma del que quieres generar el CRUD. Lee el schema de `nextjs_space/prisma/schema.prisma` para entender la estructura exacta del modelo.

## Lo que genera

### API Routes
Lee el modelo Prisma y genera rutas que:
1. Usan los tipos correctos del cliente Prisma (sin `any`)
2. Validan con Zod (schemas en `modules/<nombre>/validations.ts`)
3. Verifican sesión y rol antes de cada operación
4. Usan transacciones cuando hay múltiples escrituras
5. Devuelven siempre `{ data: T }` en éxito o `{ error: string }` en error

### Componente de Tabla (`<Nombre>Table.tsx`)
Tabla responsiva con:
- Columnas configurables via `ColumnDef[]` de TanStack si hay muchos campos, o tabla simple con `<Table>` de `@/components/ui/table`
- Badges de estado con colores según `status`
- Acciones por fila: Ver, Editar, Eliminar (con confirmación)
- Búsqueda client-side para datasets pequeños (<200 registros), server-side para grandes
- Formato de moneda COP para campos `Float` que representen dinero
- Fechas en formato colombiano (dd/MM/yyyy)

### Componente de Formulario (`<Nombre>Form.tsx`)
Formulario con React Hook Form que:
- Usa `zodResolver` para validación
- Muestra errores inline bajo cada campo
- Deshabilita el botón submit mientras envía
- Muestra toast de éxito con `sonner` al completar
- Maneja modo creación y edición (prop `initialData?: Xxx`)
- Campos Select para enums con labels en español
- DatePicker para fechas (usa `react-day-picker` ya instalado)

### Dialog de Creación/Edición
```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button><Plus /> Nuevo</Button>
  </DialogTrigger>
  <DialogContent className="max-w-2xl">
    <DialogHeader>
      <DialogTitle>Nuevo/Editar [Módulo]</DialogTitle>
    </DialogHeader>
    <NombreForm onSuccess={() => { /* refetch o router.refresh */ }} />
  </DialogContent>
</Dialog>
```

## Convenciones de UI

- **Badges de estado**: `PENDING`=amber, `APPROVED`=green, `REJECTED`=red, `DRAFT`=gray
- **Acciones destructivas**: Siempre usar `<AlertDialog>` para confirmar eliminación
- **Loading**: Usar `Skeleton` de Radix UI mientras carga
- **Tablas vacías**: Mostrar estado vacío con ícono y texto descriptivo
- **Responsive**: Ocultar columnas secundarias en mobile con `hidden md:table-cell`

## Ejemplo

```
/generar-crud modelo="PaymentRequest" area="tesoreria"
```

Esto generará:
- `app/api/pagos/route.ts` (si no existe)
- `app/api/pagos/[id]/route.ts` (si no existe)
- `modules/pagos/validations.ts`
- `app/dashboard/tesoreria/pagos/_components/PagosTable.tsx`
- `app/dashboard/tesoreria/pagos/_components/PagoForm.tsx`
