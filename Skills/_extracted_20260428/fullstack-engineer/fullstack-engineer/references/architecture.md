# Arquitectura Reference

## Cuándo Usar Cada Arquitectura

### Monolito Modular (default para proyectos nuevos)
**Úsalo cuando**: equipo pequeño (<10 devs), dominio no claro, MVP, presupuesto limitado.
```
src/
  modules/
    users/
      users.routes.ts
      users.service.ts
      users.repository.ts
      users.types.ts
    orders/
      ...
  shared/
    database/
    middleware/
    utils/
```

### Microservicios
**Úsalo cuando**: equipos independientes, necesidades de escala muy distintas por dominio, dominio bien entendido.
- **No migres prematuramente**: un monolito bien estructurado es más fácil de mantener.
- Cada servicio: base de datos propia, desplegable independientemente.
- Comunicación: REST/gRPC síncrono para queries, mensajes async (RabbitMQ, Kafka) para eventos.

### BFF (Backend for Frontend)
**Úsalo cuando**: múltiples clientes (web, mobile, third-party) con necesidades distintas.
```
                    ┌─────────┐
Web App ───────────▶│ Web BFF │──────┐
                    └─────────┘      │
                    ┌──────────┐     ▼
Mobile App ────────▶│ App BFF  │── Services
                    └──────────┘
```

---

## Patrones de Diseño Más Útiles en Web

### Repository Pattern
```typescript
// Abstrae el acceso a datos del servicio
interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<User>;
  delete(id: string): Promise<void>;
}

class PrismaUserRepository implements UserRepository {
  async findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  }
  // ...
}

// Beneficio: puedes swapear la implementación (PostgreSQL → MongoDB) sin tocar servicios
// Beneficio: fácil de mockear en tests
```

### CQRS Ligero (sin event sourcing)
```typescript
// Separa lecturas (queries) de escrituras (commands) cuando tienen requisitos distintos
class UserQueryService {
  async getUserProfile(id: string) { /* lectura optimizada, puede leer de réplica */ }
  async searchUsers(filters: SearchFilters) { /* puede usar Elasticsearch */ }
}

class UserCommandService {
  async createUser(data: CreateUserDTO) { /* escribe en primary, invalida cache */ }
  async updateUser(id: string, data: UpdateUserDTO) { /* ... */ }
}
```

### Event-Driven (para desacoplar efectos secundarios)
```typescript
// En vez de: service A llama directamente a B, C, D después de una acción
// Usa: A emite un evento, B/C/D escuchan independientemente

// Con EventEmitter (en proceso, simple)
eventBus.emit('user.created', { userId, email });
eventBus.on('user.created', sendWelcomeEmail);
eventBus.on('user.created', createDefaultWorkspace);
eventBus.on('user.created', notifySlack);

// Con cola de mensajes (distribuido, resiliente)
await queue.publish('user.created', { userId, email });
```

---

## Escalabilidad

### Horizontal vs Vertical
- **Vertical** (más RAM/CPU): más simple, tiene límite, puede causar SPOF.
- **Horizontal** (más instancias): requiere que la app sea stateless.

### Stateless Application (requisito para escala horizontal)
```javascript
// MAL: Estado en memoria local
const sessions = new Map(); // Se pierde si la instancia muere, no funciona con múltiples instancias

// BIEN: Estado en almacenamiento compartido
// Sesiones en Redis, archivos en S3, estado en base de datos
```

### Caching Strategy
```
Browser Cache → CDN Cache → API Cache (Redis) → Database Cache (pg buffer pool)
```

```javascript
// Cache en capas
const getProduct = async (id: string) => {
  // 1. Memory cache (ms)
  if (memoryCache.has(id)) return memoryCache.get(id);
  
  // 2. Redis (ms-10ms)
  const cached = await redis.get(`product:${id}`);
  if (cached) { memoryCache.set(id, JSON.parse(cached)); return JSON.parse(cached); }
  
  // 3. Database (10ms-100ms)
  const product = await db.products.findById(id);
  await redis.set(`product:${id}`, JSON.stringify(product), 'EX', 300);
  return product;
};
```

### Queue para Trabajos Pesados
```javascript
// No bloquees el request handler con operaciones lentas
// MAL:
app.post('/export', async (req, res) => {
  const data = await generateLargeReport(); // 30 segundos
  res.json(data);
});

// BIEN:
app.post('/export', async (req, res) => {
  const jobId = await queue.add('generate-report', { userId: req.user.id });
  res.json({ jobId, status: 'processing' });
});

// Worker independiente
worker.process('generate-report', async (job) => {
  const data = await generateLargeReport(job.data.userId);
  await notifyUser(job.data.userId, data);
});
```

---

## API Gateway / Proxy Inverso

```nginx
# Nginx como proxy inverso
server {
  listen 80;
  server_name api.miapp.com;
  
  location /api/ {
    proxy_pass http://backend:3000;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Host $host;
  }
  
  location /static/ {
    alias /var/www/static/;
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
}
```

---

## Decisiones de Arquitectura (ADR)

Para cambios importantes, documenta:
1. **Contexto**: ¿Qué problema estamos resolviendo?
2. **Opciones consideradas**: Alternativas evaluadas.
3. **Decisión**: Qué elegimos y por qué.
4. **Consecuencias**: Trade-offs aceptados.
