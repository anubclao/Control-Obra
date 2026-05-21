# Arquitectura de Cola Distribuida con BullMQ

## Descripción General

El sistema de reportes financieros ahora soporta cola distribuida usando **BullMQ + Redis** con fallback automático a cola en memoria cuando Redis no está disponible.

### Beneficios

1. **Escalabilidad**: Múltiples procesos workers pueden procesar jobs en paralelo
2. **Resiliencia**: Jobs persisten en Redis, sobreviven reinicios de servidor
3. **Flexibilidad**: Fallback automático a memoria para desarrollo local sin Redis
4. **Observabilidad**: Tracking de progreso, reintentos automáticos, historial de jobs

## Configuración

### Variables de Entorno

```env
# Opcional: URL de conexión Redis (si no está configurada, usa cola en memoria)
REDIS_URL=redis://localhost:6379

# Configuración de concurrencia (opcional, valores por defecto)
FINANCIAL_REPORT_JOB_CONCURRENCY=2          # Workers concurrentes por proceso
FINANCIAL_REPORT_JOB_HISTORY=200            # Jobs históricos en memoria
FINANCIAL_REPORT_TTL_MS=30000               # TTL del cache de reportes
FINANCIAL_REPORT_CONCURRENCY=4              # Proyectos procesados en paralelo
```

## Arquitectura

```
Client Request
    ↓
Next.js API Endpoint (/api/reportes/financiero/jobs)
    ↓
enqueueFinancialReportJob()  ← Intenta BullMQ primero
    ↓
    ├─ Si REDIS_URL configurado y BullMQ disponible:
    │  └─ Envía job a cola Redis
    │     └─ Worker procesa en background
    │
    └─ Si no está disponible:
       └─ Usa cola en memoria (fallback automático)
          └─ Procesa con activeWorkers concurrentes
```

## Uso

### Desarrollo Local (sin Redis)

No se requiere configuración extra. El sistema automáticamente usa cola en memoria:

```bash
npm run dev
# La cola funciona en memoria, jobs se procesan en el mismo proceso
```

### Desarrollo Local (con Redis)

Opcional, para simular ambiente distribuido:

```bash
# Instalar Redis (ej. Windows Subsystem for Linux o Docker)
docker run -d -p 6379:6379 redis:latest

# En .env.local:
REDIS_URL=redis://localhost:6379

npm run dev
# La cola usa Redis, pero sin workers separados aún

# En otra terminal (opcional):
npm run worker:financial-reports
# Workers procesan jobs de la cola en background
```

### Producción

```bash
# Iniciar servidor web
npm start

# En proceso/contenedor separado, iniciar worker
npm run worker:financial-reports
```

O en Kubernetes/Docker Compose:

```yaml
services:
  # Servidor web
  app:
    command: npm start
    environment:
      REDIS_URL: redis://redis:6379

  # Worker separado
  worker:
    command: npm run worker:financial-reports
    environment:
      REDIS_URL: redis://redis:6379

  # Redis
  redis:
    image: redis:latest
```

## API de Jobs

### Encolar un job

```typescript
POST /api/reportes/financiero/jobs
Content-Type: application/json

{
  "projectId": "proj-123"  // opcional, null para todos los proyectos
}

Response 202 Accepted:
{
  "id": "job-uuid",
  "projectId": "proj-123",
  "status": "queued",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### Obtener estado de un job

```typescript
GET /api/reportes/financiero/jobs/job-uuid

Response 200:
{
  "id": "job-uuid",
  "projectId": "proj-123",
  "status": "processing|completed|failed|queued",
  "createdAt": "2024-01-15T10:30:00Z",
  "startedAt": "2024-01-15T10:30:05Z",
  "finishedAt": "2024-01-15T10:30:35Z",
  "progress": 45,
  "error": null,
  "result": { /* reporte financiero */ }
}
```

### Listar jobs recientes

```typescript
GET /api/reportes/financiero/jobs?limit=20

Response 200:
[
  { id, projectId, status, createdAt, startedAt, finishedAt },
  ...
]
```

## Flujo de Procesamiento

### 1. Encolamiento
```
POST /api/reportes/financiero/jobs
  ↓
enqueueFinancialReportJob(projectId)
  ↓
enqueueFinancialReportJobBullMQ(projectId)  [intenta primero]
  ├─ Si Redis disponible → crea job en BullMQ, devuelve inmediatamente
  └─ Si no disponible → retorna null
  ↓
Si null, usa fallback en memoria
  ├─ Crea job en Map local
  ├─ Agrega a queue
  └─ Inicia processQueue() async
```

### 2. Procesamiento (en memoria)
```
processQueue()
  ├─ Si activeWorkers < JOB_CONCURRENCY y queue no vacía
  │  ├─ Extrae primer job
  │  ├─ Marca como "processing"
  │  ├─ Inicia buildFinancialReport() async
  │  └─ Incrementa activeWorkers
  │
  ├─ Si se completa
  │  ├─ Marca como "completed"
  │  ├─ Almacena result
  │  └─ Decrementa activeWorkers
  │
  └─ Si falla
     ├─ Marca como "failed"
     ├─ Almacena error message
     └─ Decrementa activeWorkers
```

### 3. Procesamiento (BullMQ con Worker)
```
BullMQ Queue (Redis)
  ↓
Worker observa jobs
  ├─ Procesa con concurrency = FINANCIAL_REPORT_JOB_CONCURRENCY
  ├─ Reintentos automáticos (3x con backoff exponencial)
  ├─ Auto-limpia jobs completados después de 1 hora
  └─ Mantiene jobs fallidos por 24 horas
```

## Monitoreo

### En Desarrollo

Logs en consola indican:
- Inicialización de cola
- Jobs encolados, procesados, completados o fallidos
- Fallbacks automáticos a memoria

```bash
# Cola en memoria
FINANCIAL_REPORT_JOB_CONCURRENCY=2 npm run dev

# BullMQ + Redis
REDIS_URL=redis://localhost:6379 npm run dev
# En otra terminal:
npm run worker:financial-reports
```

### En Producción

Use herramientas de monitoreo de Redis + logs:

```bash
# Ver jobs en cola (requiere redis-cli)
redis-cli KEYS "bull:financial-reports:*"

# Ver jobs activos
redis-cli --raw HGETALL bull:financial-reports:active

# Ver jobs completados
redis-cli --raw HGETALL bull:financial-reports:completed
```

## Configuración Recomendada

### Desarrollo Local
```env
# Sin Redis - Cola en memoria
FINANCIAL_REPORT_JOB_CONCURRENCY=2
FINANCIAL_REPORT_TTL_MS=30000
```

### Staging
```env
REDIS_URL=redis://redis:6379
FINANCIAL_REPORT_JOB_CONCURRENCY=4
FINANCIAL_REPORT_TTL_MS=30000
# Workers: 2 procesos separados
```

### Producción
```env
REDIS_URL=redis://redis-cluster:6379
FINANCIAL_REPORT_JOB_CONCURRENCY=8
FINANCIAL_REPORT_JOB_HISTORY=500
FINANCIAL_REPORT_TTL_MS=60000
# Workers: Auto-escalable según demanda (Kubernetes HPA)
```

## Troubleshooting

### "REDIS_URL not set, BullMQ queue disabled"

**Síntoma**: Jobs procesan en memoria en lugar de distribuidos
**Causa**: Variable REDIS_URL no configurada
**Solución**:
```bash
# .env.local o variables de entorno del servidor
REDIS_URL=redis://localhost:6379
```

### "Failed to initialize BullMQ queue, falling back to in-memory"

**Síntoma**: BullMQ intenta inicializar pero falla
**Causa**: Redis no accesible o problemas de conexión
**Solución**:
```bash
# Verificar Redis está corriendo
redis-cli ping
# Debería responder: PONG

# Verificar REDIS_URL
echo $REDIS_URL
```

### Jobs nunca se procesan en BullMQ

**Síntoma**: Jobs encolados pero no se procesan
**Causa**: Worker no iniciado
**Solución**:
```bash
# Debe ejecutar en proceso separado
npm run worker:financial-reports &
```

### Memoria se llena (fallback en memoria)

**Síntoma**: Proceso Node consume mucha memoria después de muchos jobs
**Causa**: Historial de jobs crece sin límite en memoria
**Solución**:
- Usar Redis (soluciona problema completamente)
- O reducir FINANCIAL_REPORT_JOB_HISTORY en .env

## Migración a Producción

1. **Fase 1**: Desplegar código (automático, usa fallback en memoria)
2. **Fase 2**: Configurar Redis y REDIS_URL
3. **Fase 3**: Desplegar primer worker (`npm run worker:financial-reports`)
4. **Fase 4**: Monitorear y escalar workers según carga

No se requiere cambio de código, la migración es gradual y segura.
