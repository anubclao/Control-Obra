# Discovery Checklist por Tipo de Sistema

## Preguntas universales (siempre hacer)

### Contexto del negocio
1. ¿Cuál es el problema de negocio que resuelve este sistema?
2. ¿Quiénes son los usuarios? ¿Cuántos? ¿Qué nivel técnico tienen?
3. ¿Cuáles son los casos de uso más críticos (los que no pueden fallar)?
4. ¿Cuáles son los casos de uso más frecuentes (los que más se ejecutan)?
5. ¿Qué dominios de negocio se pueden identificar? ¿Quién "posee" cada uno?

### Estado actual
6. ¿Es un sistema existente o uno nuevo?
7. ¿Cuáles son los principales pain points actuales?
8. ¿Qué partes del sistema cambian con más frecuencia?
9. ¿Qué partes son más difíciles de mantener o entender?
10. ¿Ha habido incidentes mayores recientes? ¿Por qué?

### Restricciones
11. ¿Qué tecnologías están en uso y cuáles son mandatorias mantener?
12. ¿Cuál es el presupuesto de infraestructura?
13. ¿Cuántas personas hay en el equipo de desarrollo?
14. ¿Cuál es el nivel de experiencia del equipo?
15. ¿Hay restricciones regulatorias? (GDPR, PCI-DSS, HIPAA, SOC2)

### Escala y disponibilidad
16. ¿Cuántos usuarios concurrentes en pico?
17. ¿Cuántas transacciones por segundo en pico?
18. ¿Cuál es el volumen de datos actual y proyectado?
19. ¿Cuál es el SLA requerido? (uptime, latencia máxima)
20. ¿Cuál es el RTO/RPO en caso de desastre? (Recovery Time/Point Objective)

---

## Por tipo de sistema

### APIs y Backends

```
PREGUNTAS ADICIONALES:
□ ¿Cuántos clientes consume esta API? ¿Son internos, externos, o ambos?
□ ¿Hay versionamiento de API? ¿Cuál es la política de deprecación?
□ ¿Cuál es la granularidad de autenticación? (token por usuario, por aplicación, por scopes)
□ ¿Hay paginación en todos los endpoints de colecciones?
□ ¿Existe documentación OpenAPI/Swagger actualizada?
□ ¿Cómo se manejan los errores? ¿Hay formato estándar de error response?

SEÑALES A BUSCAR EN EL CÓDIGO:
- Imports circulares entre módulos
- Lógica de negocio en controllers
- Acceso directo a BD desde múltiples capas
- Ausencia de tipos de error explícitos (solo throw new Error('string'))
- Queries sin límite de resultados (SELECT * sin LIMIT)
- Ausencia de validación de inputs en el borde del sistema
```

### Aplicaciones Web (Frontend)

```
PREGUNTAS ADICIONALES:
□ ¿Qué frameworks/librerías de UI están en uso?
□ ¿Existe un design system o component library?
□ ¿Cómo se maneja el estado global? (Redux, Zustand, Pinia, Context API)
□ ¿Hay SSR/SSG? ¿O es pure SPA?
□ ¿Cuáles son los Core Web Vitals actuales? (LCP, FID, CLS)
□ ¿Cómo se manejan las traducciones/i18n?
□ ¿Hay lazy loading de rutas y componentes?
□ ¿Cómo se manejan los errores de red (offline, timeout)?

SEÑALES A BUSCAR:
- Componentes con >300 líneas de JSX/template
- Estado compartido via prop drilling (>3 niveles)
- Fetch de datos directamente en componentes de presentación
- Ausencia de error boundaries
- Bundle size no optimizado (chunks muy grandes)
- Sin code splitting por ruta
```

### Sistemas de Microservicios

```
PREGUNTAS ADICIONALES:
□ ¿Cómo se descubren los servicios entre sí? (Service Registry, DNS, hardcoded)
□ ¿Hay API Gateway? ¿Qué responsabilidades tiene?
□ ¿Cómo se propagan los errores a través de los servicios?
□ ¿Existe distributed tracing implementado?
□ ¿Cómo se manejan las transacciones distribuidas?
□ ¿Cada servicio tiene su propia base de datos?
□ ¿Cómo se gestiona la consistencia eventual?
□ ¿Hay un event broker? ¿Qué garantías de delivery tiene?

SEÑALES A BUSCAR:
- Servicios que comparten base de datos (distributed monolith)
- Cadenas de llamadas síncronas de más de 3 saltos
- Servicios demasiado pequeños (nano-services)
- Ausencia de circuit breakers
- Schemas de eventos sin versionamiento
- Ausencia de idempotencia en consumers
```

### Aplicaciones de Datos / Analytics

```
PREGUNTAS ADICIONALES:
□ ¿Cuál es el volumen de datos que se procesa? ¿Batch o streaming?
□ ¿Cuál es la latencia aceptable desde que ocurre un evento hasta que es visible?
□ ¿Hay necesidad de reprocessing histórico?
□ ¿Quiénes consumen los datos procesados? ¿Con qué herramientas?
□ ¿Cómo se garantiza la calidad de los datos? ¿Hay data validation?
□ ¿Cuál es la política de retención de datos?
□ ¿Hay PII que requiera anonimización?

SEÑALES A BUSCAR:
- Pipelines sin manejo de errores o dead-letter queues
- Ausencia de idempotencia en jobs de batch
- Transformaciones sin tests
- Schemas de datos no documentados
- Ausencia de data lineage
```

### Mobile Apps (con backend)

```
PREGUNTAS ADICIONALES:
□ ¿iOS, Android, o multiplataforma?
□ ¿Cómo se manejan los updates de la app? ¿Hay force update?
□ ¿Cómo funciona la app offline? ¿Qué datos se cachean localmente?
□ ¿Cómo se sincronizan los datos cuando vuelve la conexión?
□ ¿Cómo se manejan las notificaciones push?
□ ¿Hay deep linking?
□ ¿Cómo se gestiona el estado de autenticación (token refresh)?
□ ¿Cuál es la política de soporte de versiones antiguas de la app?

SEÑALES A BUSCAR:
- API sin versionamiento (cambios breaking afectan usuarios con apps viejas)
- Ausencia de mecanismo de offline-first
- Tokens sin rotación implementada
- Sin graceful degradation para conexiones lentas
```

---

## Herramientas de análisis estático para discovery rápido

### Para proyectos Node.js/TypeScript
```bash
# Detectar imports circulares
npx madge --circular src/

# Visualizar dependencias entre módulos
npx madge --image graph.svg src/

# Métricas de complejidad
npx ts-complexity check src/

# Encontrar código duplicado
npx jscpd src/
```

### Para proyectos Python
```bash
# Dependencias entre módulos
pip install pydeps && pydeps src/

# Complejidad ciclomática
pip install radon && radon cc src/ -a

# Código duplicado
pip install pylint && pylint --disable=all --enable=duplicate-code src/
```

### Para cualquier proyecto
```bash
# Análisis de dependencias del proyecto
cat package.json | jq '.dependencies | keys'

# Buscar TODO/FIXME/HACK (deuda técnica declarada)
grep -r "TODO\|FIXME\|HACK\|XXX" src/ --include="*.ts"

# Archivos más grandes (posibles God Objects)
find src/ -name "*.ts" | xargs wc -l | sort -rn | head -20

# Funciones más largas
grep -n "function\|=>" src/**/*.ts | head -50
```

---

## Plantilla de reporte de discovery

```markdown
# Discovery Report: {Nombre del Sistema}

**Fecha:** YYYY-MM-DD  
**Equipo entrevistado:** {Nombres}  
**Analista:** {Nombre}

## 1. Contexto del negocio
{Resumen del dominio, usuarios, casos de uso críticos}

## 2. Estado actual
### Stack tecnológico
- Frontend: {tecnologías}
- Backend: {tecnologías}
- Base de datos: {tecnologías}
- Infraestructura: {tecnologías}
- Monitoreo: {herramientas}

### Métricas actuales (si disponibles)
- Usuarios activos: X
- Requests/día: X
- Latencia p99: Xms
- Error rate: X%
- Uptime últimos 30 días: X%

## 3. Hallazgos

### Hallazgos críticos (requieren atención inmediata)
1. {Hallazgo}: {Impacto}
2. ...

### Hallazgos importantes (requieren plan)
1. ...

### Hallazgos menores (backlog)
1. ...

## 4. Fortalezas existentes
{Qué está bien hecho y debe preservarse}

## 5. Próximos pasos
{Qué analizar en más profundidad, qué proponer}
```
