# Skill: Generar Reporte

Crea un nuevo reporte o exportación para el ERP ControlObra usando las vistas MySQL existentes.

## Tipos de reporte disponibles

### 1. Reporte de pantalla (UI)
Página de dashboard con gráficos y tablas usando Recharts (ya instalado).

### 2. Exportación Excel
Endpoint que genera un archivo XLSX usando la librería `xlsx` (ya instalada).

### 3. Exportación CSV
Endpoint que genera CSV usando la librería `csv` (ya instalada).

## Cómo crear un reporte

### Paso 1: Identifica la fuente de datos
- Si existe una vista MySQL (`v_*`) en `database/mysql/views.sql`, úsala con Prisma `$queryRaw`
- Si no existe, créala primero con `/mysql-schema`

### Paso 2: Crea el endpoint
En `app/api/reportes/<nombre>/route.ts`:

```typescript
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { prisma } from "@/lib/db";
import { ROLES_CAN_VIEW_FINANCIAL } from "@/lib/constants";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "No autorizado" }, { status: 401 });
  
  const userRole = (session.user as any).role;
  if (!ROLES_CAN_VIEW_FINANCIAL.includes(userRole)) {
    return Response.json({ error: "Sin permisos" }, { status: 403 });
  }
  
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const format = searchParams.get("format") || "json"; // json | xlsx | csv
  
  // Query a vista MySQL
  const data = await prisma.$queryRaw`
    SELECT * FROM v_financial_summary 
    WHERE projectId = ${projectId}
  `;
  
  if (format === "xlsx") {
    // Generar XLSX con librería xlsx
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(data as any[]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="reporte-${Date.now()}.xlsx"`,
      },
    });
  }
  
  return Response.json({ data });
}
```

### Paso 3: Crea la UI del reporte

En `app/dashboard/reportes/<nombre>/page.tsx`:
- Server component que obtiene datos del endpoint
- Pasa datos a client component con gráficos

En `app/dashboard/reportes/<nombre>/_components/<Nombre>ReporteClient.tsx`:
- Usa `Recharts` para gráficos (BarChart, LineChart, PieChart)
- Botón "Exportar Excel" que llama al endpoint con `format=xlsx`
- Filtros de fecha con `DateRangePicker`
- Tabla resumen con totales

### Paso 4: Agrega a la navegación
Si es un reporte importante, agrégalo en la sección Administrativo del nav.

## Convenciones de reportes

- **Montos**: Siempre en COP, sin decimales
- **Fechas**: Rango configurable, default último mes
- **Permisos**: Solo `ROLES_CAN_VIEW_FINANCIAL` pueden ver reportes financieros
- **Gráficos**: Usar paleta de colores del proyecto (blue=#2563eb, amber=#d97706, green=#16a34a)
- **Exportaciones**: Incluir fecha de generación en el nombre del archivo

## Ejemplo

```
/generar-reporte nombre="flujo-caja" tipo="pantalla+excel" descripcion="Flujo de caja mensual por proyecto con pagos aprobados y pendientes"
```
