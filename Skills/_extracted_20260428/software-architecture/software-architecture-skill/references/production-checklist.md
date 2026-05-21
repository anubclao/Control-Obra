# Checklist de Producción — Software Architecture Quality Gates

## Instrucciones de uso
Para cada dimensión, evalúa el estado actual: ✅ Implementado | ⚠️ Parcial | ❌ Faltante | N/A No aplica
Calcula el score por sección y prioriza las más críticas.

---

## 1. OBSERVABILIDAD (Peso: Alto)

### Logging
- [ ] Logs en formato JSON estructurado (no texto libre)
- [ ] Correlation ID propagado en todos los requests (X-Request-ID o equivalente)
- [ ] Contexto mínimo en cada log: {timestamp, level, service, version, requestId, userId}
- [ ] Niveles correctamente usados: ERROR para alertar, WARN para investigar, INFO para auditoría, DEBUG para desarrollo
- [ ] Sin información sensible en logs (PII, secrets, tokens)
- [ ] Logs centralizados (ELK, Grafana Loki, CloudWatch, Datadog)

### Métricas
- [ ] Métricas de las 4 señales doradas: Latencia, Tráfico, Errores, Saturación
- [ ] Métricas de negocio (ej: órdenes por minuto, usuarios activos, conversión)
- [ ] Histogramas para latencia (no solo promedios — p50, p90, p99, p999)
- [ ] Instrumentación con OpenTelemetry o equivalente (prometheus, statsd)
- [ ] Alertas definidas con umbrales basados en SLO

### Trazas distribuidas
- [ ] Trace propagation entre servicios (W3C Trace Context o B3)
- [ ] Spans con atributos relevantes (userId, orderId, etc.)
- [ ] Integrado con Jaeger, Zipkin, AWS X-Ray, o Datadog APM

### SLI/SLO/SLA
- [ ] SLIs definidos (qué medir: availability, latency, error rate)
- [ ] SLOs establecidos con valores concretos (ej: 99.9% uptime, p99 < 200ms)
- [ ] Error budget calculado y monitoreado
- [ ] Alertas de error budget burn rate configuradas

---

## 2. RESILIENCIA (Peso: Alto)

### Patrones de protección
- [ ] Circuit Breakers en todas las llamadas a servicios externos
- [ ] Retry con exponential backoff + jitter (no retry sin límite)
- [ ] Timeouts configurados en todas las llamadas de red (no defaults infinitos)
- [ ] Bulkhead: pools de threads/conexiones separados por servicio externo
- [ ] Graceful degradation: el sistema funciona con capacidad reducida si un dependiente falla

### Gestión de estado
- [ ] Aplicación sin estado en capa de computo (sesiones en Redis, no en memoria)
- [ ] Caché con TTL y política de invalidación explícita
- [ ] Idempotencia en endpoints que reciben retries (PUT, DELETE, y POST críticos)
- [ ] Manejo de exactly-once o at-least-once con idempotency keys

### Testing de resiliencia
- [ ] Tests de chaos planeados (kill pod, inyección de latencia, partición de red)
- [ ] Game days programados para simular fallos mayores
- [ ] Postmortems documentados con acción items tracked

---

## 3. SEGURIDAD (Peso: Crítico)

### Gestión de secretos
- [ ] Cero secretos en código fuente o repositorio
- [ ] Cero secretos hardcodeados en variables de entorno en Docker/K8s (usar Secret Manager)
- [ ] Rotación de secretos automatizada o planeada
- [ ] Vault, AWS Secrets Manager, GCP Secret Manager, o equivalente

### Autenticación y autorización
- [ ] Autenticación en cada servicio (zero-trust, no confiar en red interna)
- [ ] JWT con tiempo de expiración corto + refresh tokens
- [ ] Autorización basada en roles/permisos (RBAC o ABAC)
- [ ] Rate limiting por usuario/IP para prevenir abuso
- [ ] mTLS en comunicación entre servicios (o service mesh que lo gestione)

### Protección de datos
- [ ] TLS 1.2+ en todo tráfico externo (TLS 1.3 preferido)
- [ ] TLS en tráfico interno entre servicios
- [ ] Datos PII encriptados en reposo
- [ ] GDPR/LGPD/CCPA: mecanismos de borrado y exportación de datos de usuario
- [ ] Validación de inputs en boundaries del sistema (no confiar en clientes)

### Infraestructura
- [ ] Imágenes de contenedor con CVE scanning en CI/CD
- [ ] Dependencias auditadas (npm audit, snyk, dependabot)
- [ ] Principio de least privilege en IAM roles y service accounts
- [ ] Sin containers ejecutándose como root
- [ ] Network policies que limiten comunicación entre pods/servicios

---

## 4. DEPLOYABILIDAD (Peso: Alto)

### Pipeline CI/CD
- [ ] Build automatizado en cada commit/PR
- [ ] Tests automáticos en pipeline (unit + integration mínimo)
- [ ] Quality gates: cobertura mínima, sin críticos de seguridad, sin lint errors
- [ ] Artefacto inmutable (misma imagen de Docker va a todos los ambientes)
- [ ] Environments separados: dev, staging, producción

### Estrategia de deployment
- [ ] Zero-downtime deployments (rolling update, blue/green, o canary)
- [ ] Health checks configurados (liveness + readiness probes)
- [ ] Rollback automatizado si health checks fallan
- [ ] Feature flags para habilitar/deshabilitar funcionalidad sin deploy

### Database migrations
- [ ] Migraciones backward-compatible (nunca romper API de BD en el mismo deploy)
- [ ] Patrón Expand-Contract para cambios breaking:
  1. Expand: agregar nueva columna/tabla sin quitar vieja
  2. Deploy nueva versión de la aplicación
  3. Contract: quitar lo viejo en siguiente release
- [ ] Migraciones versionadas y auditadas (Flyway, Liquibase, Alembic)
- [ ] Rollback de migraciones posible (o plan de recuperación)

### Configuración
- [ ] 12-Factor App: configuración desde variables de entorno, no hardcodeada
- [ ] Configuración diferenciada por ambiente sin cambio de código
- [ ] Validación de configuración al arrancar (fail-fast si falta algo crítico)

---

## 5. PERFORMANCE (Peso: Medio-Alto)

### Medición
- [ ] Baseline de performance medida antes de optimizar
- [ ] Load testing con herramientas (k6, JMeter, Locust, Artillery)
- [ ] Profiling realizado en ambiente similar a producción

### Base de datos
- [ ] Índices justificados con EXPLAIN ANALYZE (no índices a ciegas)
- [ ] N+1 queries eliminadas (eager loading donde corresponde)
- [ ] Connection pooling configurado correctamente (PgBouncer, HikariCP)
- [ ] Queries lentas monitoreadas y alertadas

### Caché
- [ ] Cache en puntos calientes identificados (no cache prematuro)
- [ ] Política de invalidación explícita y documentada
- [ ] TTL apropiado según volatilidad de los datos
- [ ] Cache stampede prevention (probabilistic early expiration o lock)

### API Design
- [ ] Paginación en todos los endpoints de colecciones (nunca retornar listas ilimitadas)
- [ ] Operaciones pesadas asíncronas (responder 202 Accepted + polling o webhook)
- [ ] Compresión gzip/brotli en respuestas grandes
- [ ] CDN para assets estáticos

---

## 6. TESTABILIDAD (Peso: Alto)

### Pirámide de tests
- [ ] **Unit tests:** lógica de dominio y casos de negocio (sin infraestructura, rápidos)
- [ ] **Integration tests:** adapters contra infraestructura real (testcontainers recomendado)
- [ ] **Contract tests:** entre servicios (Pact o schema validation)
- [ ] **E2E tests:** happy paths críticos del negocio (pocos, lentos, valiosos)

### Calidad de tests
- [ ] Tests determinísticos (no flaky tests)
- [ ] Tests independientes entre sí (no dependen de orden de ejecución)
- [ ] Cobertura medida (objetivo mínimo: 80% en dominio/aplicación)
- [ ] Mutation testing para verificar que los tests realmente prueban algo
- [ ] Tests de regresión para cada bug reportado

### Diseño testeable
- [ ] Dependency injection en todos los componentes
- [ ] Sin side effects en constructores
- [ ] Tiempo y aleatoriedad inyectados (no usar Date.now() directamente en dominio)
- [ ] Interfaces para todas las dependencias externas (permite mocking)

---

## 7. MANTENIBILIDAD (Peso: Medio)

### Código
- [ ] Linter y formatter configurados y aplicados en CI
- [ ] Complejidad ciclomática controlada (< 10 por función)
- [ ] Sin code smells críticos (duplicación masiva, métodos >50 líneas, clases >300 líneas)
- [ ] Dependencias de terceros auditadas y actualizadas

### Documentación
- [ ] README actualizado: setup, arquitectura básica, cómo correr localmente
- [ ] ADRs para decisiones arquitectónicas importantes
- [ ] Contratos de API documentados (OpenAPI/Swagger o equivalente)
- [ ] Runbook de operaciones para equipo de on-call
- [ ] Diagramas de arquitectura actualizados (C4 o equivalente)

### Operabilidad
- [ ] Proceso de on-boarding documentado para nuevos devs
- [ ] Procedimiento de rollback claro y practicado
- [ ] Contacto de on-call claro en caso de incidentes
- [ ] Post-mortems de incidentes anteriores disponibles

---

## Scoring

| Dimensión | Total checks | Implementados | Score |
|-----------|-------------|---------------|-------|
| Observabilidad | 15 | ? | ?% |
| Resiliencia | 12 | ? | ?% |
| Seguridad | 18 | ? | ?% |
| Deployabilidad | 14 | ? | ?% |
| Performance | 13 | ? | ?% |
| Testabilidad | 13 | ? | ?% |
| Mantenibilidad | 12 | ? | ?% |
| **TOTAL** | **97** | ? | ?% |

### Interpretación
- **85-100%:** Listo para producción de alta criticidad
- **70-84%:** Listo para producción con deuda técnica manejable
- **50-69%:** En producción con riesgo moderado, plan de mejora requerido
- **<50%:** Riesgo alto — no recomendado para producción crítica sin plan inmediato
