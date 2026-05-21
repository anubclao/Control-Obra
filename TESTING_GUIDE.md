# Guía de Testing - Sistema Distribuido de Reportes

## Testing Local (Sin Redis)

### 1. Validar que el servidor inicia correctamente

```bash
npm run dev
# Esperar hasta: "ready - started server on 0.0.0.0:3000"
```

Verificar en logs:
- ✅ Sin menciones de Redis errors
- ✅ Sin compilación errors

### 2. Testing de Cache de Reportes

```bash
# Terminal 1: Cliente HTTP (ej. usando curl o Postman)

# Obtener token de autenticación (skip si acceso anónimo)
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# Obtener reporte (primera vez, sin cache)
time curl "http://localhost:3000/api/reportes/financiero?projectId=proj-123"
# Debería tomar ~200-500ms (primer build)

# Obtener reporte (segunda vez, desde cache)
time curl "http://localhost:3000/api/reportes/financiero?projectId=proj-123"
# Debería tomar <50ms (desde cache en memoria)

# Limpiar cache
curl -X POST http://localhost:3000/api/reportes/financiero/cache-clear

# Obtener reporte (nueva vez, sin cache)
time curl "http://localhost:3000/api/reportes/financiero?projectId=proj-123"
# Debería tomar ~200-500ms de nuevo
```

### 3. Testing de Cola en Memoria

```bash
# Encolar un job
curl -X POST http://localhost:3000/api/reportes/financiero/jobs \
  -H "Content-Type: application/json" \
  -d '{"projectId":"proj-123"}'

# Respuesta esperada:
# 202 Accepted
# {
#   "id": "abc123...",
#   "projectId": "proj-123",
#   "status": "queued",
#   "createdAt": "2024-01-15T10:30:00Z"
# }

# Guardar el ID de job

JOB_ID="abc123..."

# Obtener estado del job (debería estar processing o completed)
curl "http://localhost:3000/api/reportes/financiero/jobs/$JOB_ID"

# Respuesta esperada:
# 200 OK
# {
#   "id": "abc123...",
#   "projectId": "proj-123",
#   "status": "processing|completed|failed",
#   "createdAt": "2024-01-15T10:30:00Z",
#   "startedAt": "2024-01-15T10:30:05Z",
#   "finishedAt": "2024-01-15T10:30:35Z" (si completed/failed),
#   "result": {...}
# }

# Listar jobs recientes
curl "http://localhost:3000/api/reportes/financiero/jobs?limit=10"

# Respuesta esperada:
# 200 OK
# [
#   {"id": "abc123...", "projectId": "proj-123", "status": "completed", ...},
#   ...
# ]
```

### 4. Testing de Validación de Concurrencia

Modificar env en .env.local:
```env
FINANCIAL_REPORT_JOB_CONCURRENCY=1
```

Reiniciar servidor:
```bash
# Ctrl+C en terminal de dev
npm run dev
```

Script de testing (bash o PowerShell):

```bash
# Encolar 5 jobs
for i in {1..5}; do
  curl -X POST http://localhost:3000/api/reportes/financiero/jobs \
    -H "Content-Type: application/json" \
    -d "{\"projectId\":\"proj-$i\"}" \
    -s | jq -r '.id'
done > job_ids.txt

# Verificar que solo 1 se procesa al mismo tiempo
sleep 1

while IFS= read -r job_id; do
  status=$(curl -s "http://localhost:3000/api/reportes/financiero/jobs/$job_id" | jq -r '.status')
  echo "$job_id: $status"
done < job_ids.txt

# Esperar y verificar cambios de estado
sleep 30

while IFS= read -r job_id; do
  status=$(curl -s "http://localhost:3000/api/reportes/financiero/jobs/$job_id" | jq -r '.status')
  echo "$job_id: $status"
done < job_ids.txt
```

## Testing con Redis (Desarrollo Distribuido)

### Setup

```bash
# Opción 1: Docker
docker run -d -p 6379:6379 --name redis redis:latest

# Opción 2: Windows Subsystem for Linux
# Ver: https://learn.microsoft.com/en-us/windows/wsl/tutorials/wsl-database#install-redis

# Opción 3: Instalar Redis nativo
# Ver: https://redis.io/docs/install/install-redis-on-windows/
```

Verificar conexión:
```bash
# En PowerShell (si Redis instalado localmente)
redis-cli ping
# Debería responder: PONG
```

Configurar en .env.local:
```env
REDIS_URL=redis://localhost:6379
FINANCIAL_REPORT_JOB_CONCURRENCY=2
```

### 1. Testing de Cola Distribuida

Terminal 1: Servidor web
```bash
npm run dev
# Esperar "ready - started server on 0.0.0.0:3000"
```

Terminal 2: Worker
```bash
npm run worker:financial-reports
# Esperar "Financial Report Worker started with concurrency=2"
```

Terminal 3: Cliente
```bash
# Encolar jobs
curl -X POST http://localhost:3000/api/reportes/financiero/jobs \
  -H "Content-Type: application/json" \
  -d '{"projectId":"proj-123"}'

# Observar en Terminal 2:
# [2024-01-15T10:30:05Z] Processing job job-uuid for project proj-123
# [2024-01-15T10:30:35Z] Job job-uuid completed successfully

# Verificar status
JOB_ID="job-uuid"
curl "http://localhost:3000/api/reportes/financiero/jobs/$JOB_ID" | jq
```

### 2. Testing de Redundancia

```bash
# Terminal 1: Worker 1
npm run worker:financial-reports

# Terminal 2 (después que Worker 1 esté ready): Worker 2
npm run worker:financial-reports

# Terminal 3: Encolar 10 jobs y verificar que ambos workers procesan
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/reportes/financiero/jobs \
    -H "Content-Type: application/json" \
    -d "{\"projectId\":\"proj-$i\"}" \
    -s > /dev/null
done

# Observar en ambas terminales de workers:
# Worker 1 procesa jobs: job-1, job-3, job-5, ...
# Worker 2 procesa jobs: job-2, job-4, job-6, ...
# Los trabajos se distribuyen automáticamente
```

### 3. Testing de Persistencia

```bash
# Encolar 5 jobs
for i in {1..5}; do
  curl -X POST http://localhost:3000/api/reportes/financiero/jobs \
    -H "Content-Type: application/json" \
    -d "{\"projectId\":\"proj-$i\"}" \
    -s > /dev/null
done

# MATAR Worker (Ctrl+C en Terminal 2)

# Verificar jobs en Redis aún existen
redis-cli KEYS "bull:financial-reports:*" | head -5

# Reiniciar Worker
npm run worker:financial-reports

# Observar que Worker procesa los jobs pendientes:
# [2024-01-15T10:35:00Z] Processing job job-uuid...
# Los jobs no se pierden al reiniciar
```

## Testing de Cache Invalidation

### 1. Invalidación por Mutaciones de Pagos

```bash
# 1. Obtener reporte (llena cache)
curl "http://localhost:3000/api/reportes/financiero?projectId=proj-123"

# 2. Crear pago
curl -X POST http://localhost:3000/api/pagos \
  -H "Content-Type: application/json" \
  -d '{
    "projectId":"proj-123",
    "amount":1000,
    ...
  }'

# 3. Cache debería haberse invalidado automáticamente
# Verificar que siguiente reporte recalcula (toma >200ms en lugar de <50ms)
time curl "http://localhost:3000/api/reportes/financiero?projectId=proj-123"
```

### 2. Invalidación por Mutaciones de Impuestos

```bash
# Similar a pagos
curl "http://localhost:3000/api/reportes/financiero?projectId=proj-123"

curl -X PUT http://localhost:3000/api/impuestos/tax-123 \
  -H "Content-Type: application/json" \
  -d '{"percentage":21}'

time curl "http://localhost:3000/api/reportes/financiero?projectId=proj-123"
# Cache invalidado
```

### 3. Invalidación por Mutaciones de Cortes

```bash
curl "http://localhost:3000/api/reportes/financiero?projectId=proj-123"

curl -X POST http://localhost:3000/api/cortes/cut-123/approve \
  -H "Content-Type: application/json" \
  -d '{}'

time curl "http://localhost:3000/api/reportes/financiero?projectId=proj-123"
# Cache invalidado
```

## Testing de Limitación de Memoria

### Escenario: Muchos Jobs en Memoria

```bash
# Terminal 1: Servidor sin Redis (fallback en memoria)
npm run dev
# SIN: REDIS_URL configurado

# Terminal 2: Script que genera 1000 jobs
for i in {1..1000}; do
  curl -X POST http://localhost:3000/api/reportes/financiero/jobs \
    -H "Content-Type: application/json" \
    -d "{\"projectId\":\"proj-$i\"}" \
    -s > /dev/null
  
  if (( i % 100 == 0 )); then
    echo "Encolados: $i jobs"
    sleep 1
  fi
done

# Terminal 1: Observar uso de memoria
# Con FINANCIAL_REPORT_JOB_HISTORY=200:
# - Primeros 200 jobs se mantienen en memoria
# - Jobs 201+ se descartan automáticamente
# - Memoria no crece indefinidamente
```

## Métricas de Performance

### Tiempos Esperados

| Operación | Sin Cache | Con Cache | Con Queue |
|-----------|-----------|-----------|-----------|
| GET /reportes/financiero | 200-500ms | <50ms | - |
| POST /reportes/financiero/jobs | - | - | <100ms |
| GET /reportes/financiero/jobs/{id} | - | - | <50ms |
| Job Processing (single) | - | - | 200-500ms |
| Job Processing (queue) | - | - | 200-500ms × concurrency |

### Concurrencia

| Config | Concurrency | Proyectos/Batch | Workers | Max Throughput |
|--------|-------------|-----------------|---------|----------------|
| Dev | 1 | 4 | 1 | 4 jobs/min |
| Dev (con Redis) | 2 | 4 | 2 | 24 jobs/min |
| Production | 4 | 4 | 4+ | 96+ jobs/min |

## Checklist de Validación

- [ ] Servidor inicia sin errores de Redis
- [ ] Cache funciona (primera llamada lenta, segunda rápida)
- [ ] Cache se invalida después de mutations
- [ ] Cola en memoria procesa jobs secuencialmente
- [ ] Concurrencia respeta límite (max activeWorkers)
- [ ] Con Redis: Jobs distribuidos entre múltiples workers
- [ ] Con Redis: Jobs persisten tras reinicio de worker
- [ ] Con Redis: Múltiples workers no procesan mismo job
- [ ] Historial de jobs se trimmed a máximo configurado
- [ ] Logs indican fallback automático cuando Redis no disponible

## Scripts Útiles

### PowerShell - Encolar y monitorear 5 jobs

```powershell
$jobIds = @()

# Encolar 5 jobs
for ($i = 1; $i -le 5; $i++) {
  $response = Invoke-WebRequest -Uri "http://localhost:3000/api/reportes/financiero/jobs" `
    -Method POST `
    -Headers @{"Content-Type"="application/json"} `
    -Body "{`"projectId`":`"proj-$i`"}" `
    -UseBasicParsing | ConvertFrom-Json
  $jobIds += $response.id
  Write-Host "Job $i encolado: $($response.id)"
}

# Monitorear estado
Write-Host "Monitoreando jobs..."
Start-Sleep -Seconds 1

foreach ($jobId in $jobIds) {
  $status = Invoke-WebRequest -Uri "http://localhost:3000/api/reportes/financiero/jobs/$jobId" `
    -UseBasicParsing | ConvertFrom-Json
  Write-Host "Job $jobId: $($status.status)"
}
```

### Bash - Encolar muchos jobs y verificar distribución

```bash
#!/bin/bash

# Encolar 20 jobs
echo "Encolando 20 jobs..."
for i in {1..20}; do
  curl -s -X POST http://localhost:3000/api/reportes/financiero/jobs \
    -H "Content-Type: application/json" \
    -d "{\"projectId\":\"proj-$i\"}" > /dev/null
  echo -n "."
done
echo ""

# Esperar procesamiento
echo "Esperar 30 segundos para procesamiento..."
sleep 30

# Verificar que todos se completaron
echo "Verificando resultados..."
jobs=$(curl -s "http://localhost:3000/api/reportes/financiero/jobs?limit=20")
echo "$jobs" | jq '[.[] | .status] | group_by(.) | map({status: .[0], count: length})'

# Esperado:
# [
#   {
#     "status": "completed",
#     "count": 20
#   }
# ]
```
