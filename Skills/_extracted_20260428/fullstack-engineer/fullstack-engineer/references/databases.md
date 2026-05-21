# Bases de Datos Reference

## Elección de Base de Datos

| Necesidad | Recomendación |
|---|---|
| App web general con relaciones | PostgreSQL |
| Alto volumen de escritura, escala horizontal | MongoDB, Cassandra |
| Caché, sesiones, pub/sub | Redis |
| Búsqueda full-text | Elasticsearch, pgvector (si ya tienes Postgres) |
| App serverless/edge | Supabase, PlanetScale, Neon, Turso |
| Tiempo real | Firebase Realtime DB, Supabase Realtime |
| Analítica / OLAP | ClickHouse, BigQuery, DuckDB |
| Grafos | Neo4j, AWS Neptune |
| Embedded / local | SQLite |

---

## PostgreSQL

### Tipos de Datos Útiles
```sql
-- Prefiere tipos específicos de Postgres
uuid          -- Para PKs distribuidas: gen_random_uuid()
timestamptz   -- SIEMPRE con timezone, no timestamp
jsonb         -- JSON con índices (vs json sin índices)
text          -- varchar sin límite arbitrario (a menos que necesites restricción)
numeric(10,2) -- Para dinero, NUNCA float
boolean       -- No simules con 0/1
```

### Índices
```sql
-- Índice simple
CREATE INDEX idx_users_email ON users(email);

-- Índice parcial (más eficiente)
CREATE INDEX idx_active_users ON users(created_at) WHERE status = 'active';

-- Índice compuesto (orden importa: column más selectiva primero)
CREATE INDEX idx_orders_user_status ON orders(user_id, status);

-- Índice para LIKE solo con texto al inicio
CREATE INDEX idx_users_name_prefix ON users(name text_pattern_ops);

-- Full-text search
CREATE INDEX idx_products_search ON products USING gin(to_tsvector('spanish', name || ' ' || description));
```

### EXPLAIN ANALYZE
```sql
-- Para diagnosticar queries lentas
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM orders WHERE user_id = $1 AND status = 'pending';
-- Busca: Seq Scan en tablas grandes (agregar índice), Sort con cost alto (índice compuesto)
```

### Migraciones
```sql
-- NUNCA: DROP COLUMN en producción directamente (puede bloquear)
-- Estrategia segura para columnas grandes:
-- 1. Hacer la columna nullable
ALTER TABLE users ALTER COLUMN old_field DROP NOT NULL;
-- 2. Deprecar en código
-- 3. En siguiente release: DROP COLUMN
ALTER TABLE users DROP COLUMN old_field;

-- Agregar columna con default sin bloquear (Postgres 11+)
ALTER TABLE users ADD COLUMN preferences jsonb DEFAULT '{}' NOT NULL;
```

### Transacciones
```sql
BEGIN;
  UPDATE accounts SET balance = balance - 100 WHERE id = $1;
  UPDATE accounts SET balance = balance + 100 WHERE id = $2;
  -- Verifica que no quede negativo
  SELECT balance FROM accounts WHERE id = $1 AND balance >= 0;
COMMIT;
-- Si algo falla: ROLLBACK automático
```

---

## MongoDB

### Modelado de Documentos
```javascript
// EMBED cuando: datos se acceden siempre juntos, relación 1:pocos, no se actualiza independientemente
const postSchema = {
  title: String,
  comments: [{ // Embebido - máx ~100 comentarios
    author: String,
    body: String,
    createdAt: Date,
  }]
};

// REFERENCIA cuando: datos se reutilizan, relación 1:muchos (>100), se actualiza independientemente
const orderSchema = {
  userId: ObjectId, // Referencia a users
  products: [{ productId: ObjectId, qty: Number }], // Referencia a products
};
```

### Índices
```javascript
// Índice compuesto para queries frecuentes
db.orders.createIndex({ userId: 1, status: 1, createdAt: -1 });

// Índice único
db.users.createIndex({ email: 1 }, { unique: true });

// TTL para datos temporales (expiración automática)
db.sessions.createIndex({ createdAt: 1 }, { expireAfterSeconds: 86400 });

// Text search
db.products.createIndex({ name: 'text', description: 'text' }, { default_language: 'spanish' });
```

### Aggregation Pipeline
```javascript
db.orders.aggregate([
  { $match: { status: 'completed', createdAt: { $gte: startDate } } },
  { $group: { _id: '$userId', totalSpent: { $sum: '$total' }, orderCount: { $sum: 1 } } },
  { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
  { $unwind: '$user' },
  { $sort: { totalSpent: -1 } },
  { $limit: 10 }
]);
```

---

## Redis

### Patrones Comunes
```javascript
// Cache con TTL
await redis.set(`user:${id}`, JSON.stringify(user), 'EX', 3600);
const cached = await redis.get(`user:${id}`);

// Cache-Aside Pattern
async function getUser(id) {
  const cacheKey = `user:${id}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);
  
  const user = await db.users.findById(id);
  if (user) await redis.set(cacheKey, JSON.stringify(user), 'EX', 3600);
  return user;
}

// Invalidación al actualizar
async function updateUser(id, data) {
  const user = await db.users.update(id, data);
  await redis.del(`user:${id}`); // Invalida cache
  return user;
}

// Rate limiting con sliding window
async function checkRateLimit(key, max, windowSecs) {
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, windowSecs);
  return count <= max;
}

// Pub/Sub para notificaciones
const pub = redis.duplicate();
await pub.publish('notifications', JSON.stringify({ userId, message }));
redis.subscribe('notifications', (message) => { /* handle */ });
```

---

## ORMs y Query Builders

### Prisma (Node.js/TS — Recomendado para proyectos nuevos)
```typescript
// schema.prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  orders    Order[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// Queries type-safe
const users = await prisma.user.findMany({
  where: { status: 'active', orders: { some: { total: { gt: 100 } } } },
  include: { orders: { orderBy: { createdAt: 'desc' }, take: 5 } },
  orderBy: { createdAt: 'desc' },
  skip: (page - 1) * limit,
  take: limit,
});
```

### SQLAlchemy (Python)
```python
# Async con SQLAlchemy 2.0
async with AsyncSession(engine) as session:
    result = await session.execute(
        select(User)
        .where(User.status == 'active')
        .options(selectinload(User.orders))
        .order_by(User.created_at.desc())
        .limit(20)
    )
    users = result.scalars().all()
```

### Knex.js (Query builder, más control que ORM)
```javascript
const users = await knex('users')
  .join('orders', 'users.id', 'orders.user_id')
  .where('users.status', 'active')
  .andWhere('orders.total', '>', 100)
  .select('users.*', knex.raw('COUNT(orders.id) as order_count'))
  .groupBy('users.id')
  .orderBy('order_count', 'desc');
```

---

## Migraciones de Base de Datos

### Principios
1. **Siempre hacia adelante**: Diseña migraciones que no requieran rollback de datos.
2. **Compatibilidad hacia atrás**: La nueva versión del schema debe ser compatible con la versión anterior del código durante el deploy.
3. **Transaccionales**: Cada migración en una transacción.
4. **Idempotentes**: `IF NOT EXISTS`, `IF EXISTS` cuando sea posible.

### Estrategia para Zero Downtime
```sql
-- FASE 1 (deploy v1 → v2): Agregar columna nullable
ALTER TABLE users ADD COLUMN phone text;

-- FASE 2 (código v2): Poblar datos nuevos, leer de ambas columnas
-- FASE 3 (deploy v2 → v3): Hacer columna NOT NULL + agregar DEFAULT
ALTER TABLE users ALTER COLUMN phone SET DEFAULT '';
UPDATE users SET phone = '' WHERE phone IS NULL;
ALTER TABLE users ALTER COLUMN phone SET NOT NULL;

-- FASE 4 (deploy v3 → v4): Eliminar columna vieja si aplica
```
