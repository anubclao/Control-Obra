# DevOps / Deploy Reference

## Docker

### Dockerfile Optimizado para Node.js
```dockerfile
FROM node:20-alpine AS base
WORKDIR /app

# Instala dependencias primero (aprovecha cache de capas)
FROM base AS deps
COPY package*.json ./
RUN npm ci --omit=dev

# Build
FROM base AS builder
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Producción: imagen mínima
FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# No correr como root
USER node

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Dockerfile para Python/FastAPI
```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

USER nobody
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

### Docker Compose para Desarrollo
```yaml
version: '3.9'
services:
  app:
    build: { context: ., target: builder }
    volumes:
      - .:/app
      - /app/node_modules
    ports: ["3000:3000"]
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/myapp
      - REDIS_URL=redis://redis:6379
    depends_on: [db, redis]
    command: npm run dev

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: myapp
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports: ["5432:5432"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

volumes:
  postgres_data:
```

---

## Variables de Entorno por Ambiente

```
.env.example     # Plantilla (en git)
.env             # Local dev (en .gitignore)
.env.test        # Para tests automatizados
# Producción: variables en el proveedor cloud (Railway, Fly.io, Vercel, AWS SSM)
```

---

## CI/CD con GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run lint
      - run: npm run test:coverage
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
      - uses: codecov/codecov-action@v4

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Railway
        run: railway up
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

---

## Plataformas de Deploy Recomendadas

| Caso de Uso | Plataforma | Nota |
|---|---|---|
| Full-stack (Node/Python/Go) | Railway, Fly.io, Render | Simple, barato, prod-ready |
| Frontend estático/Next.js | Vercel, Netlify | DX excelente, edge functions |
| Contenedores gestionados | AWS ECS, Google Cloud Run | Más control |
| VPS simple | DigitalOcean, Hetzner | Más barato, más trabajo |
| Serverless functions | AWS Lambda, Cloudflare Workers | Para funciones específicas |

---

## Health Checks y Monitoreo

```javascript
// Endpoint de health check estándar
app.get('/health', async (req, res) => {
  const checks = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {}
  };

  try {
    await db.query('SELECT 1');
    checks.services.database = 'ok';
  } catch {
    checks.services.database = 'error';
    checks.status = 'degraded';
  }

  try {
    await redis.ping();
    checks.services.redis = 'ok';
  } catch {
    checks.services.redis = 'error';
  }

  const statusCode = checks.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(checks);
});
```

---

## Rollback Strategy

```bash
# Railway / Fly.io: deploy de versión anterior
railway rollback
fly releases --app myapp
fly deploy --image registry/myapp:v1.2.3

# Base de datos: migraciones hacia atrás (si están diseñadas)
npx prisma migrate resolve --rolled-back 20240101_migration

# Blue/Green: mantén la versión anterior corriendo hasta validar
# Canary: envía % del tráfico a la nueva versión primero
```
