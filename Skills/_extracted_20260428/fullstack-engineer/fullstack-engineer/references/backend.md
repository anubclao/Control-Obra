# Backend Reference

## APIs REST — Buenas Prácticas

### Diseño de Endpoints
```
GET    /api/v1/users          # Lista paginada
GET    /api/v1/users/:id      # Recurso individual
POST   /api/v1/users          # Crear
PUT    /api/v1/users/:id      # Reemplazar completo
PATCH  /api/v1/users/:id      # Actualización parcial
DELETE /api/v1/users/:id      # Eliminar
```

### Respuestas Consistentes
```json
// Éxito con lista
{ "data": [...], "meta": { "total": 100, "page": 1, "limit": 20 } }

// Éxito con recurso
{ "data": { "id": "1", "name": "...", "createdAt": "2024-01-01T00:00:00Z" } }

// Error
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...] } }
```

### Códigos HTTP Correctos
- `200 OK`: GET exitoso, PUT/PATCH exitoso.
- `201 Created`: POST exitoso. Header `Location: /api/v1/users/123`.
- `204 No Content`: DELETE exitoso.
- `400 Bad Request`: Validación fallida.
- `401 Unauthorized`: No autenticado.
- `403 Forbidden`: Autenticado pero sin permisos.
- `404 Not Found`: Recurso no existe.
- `409 Conflict`: Duplicado o conflicto de estado.
- `422 Unprocessable Entity`: Datos semánticamente incorrectos.
- `429 Too Many Requests`: Rate limiting.
- `500 Internal Server Error`: Error no manejado (no exponer detalles en producción).

---

## Node.js / Express

```javascript
// Estructura recomendada
src/
  routes/       # Solo definición de rutas + validación
  controllers/  # Lógica de request/response
  services/     # Lógica de negocio (testeable sin HTTP)
  repositories/ # Acceso a datos
  middleware/   # Auth, logging, error handling
  models/       # Tipos/esquemas

// Middleware de error centralizado
app.use((err, req, res, next) => {
  if (err instanceof ValidationError) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: err.message } });
  }
  logger.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Error interno' } });
});
```

---

## Python

### FastAPI (recomendado para APIs nuevas)
```python
from fastapi import FastAPI, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr

class UserCreate(BaseModel):
    email: EmailStr
    name: str
    age: int

@app.post("/users", response_model=UserResponse, status_code=201)
async def create_user(user: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.scalar(select(User).where(User.email == user.email))
    if existing:
        raise HTTPException(status_code=409, detail="Email ya registrado")
    # ...
```

### Django / Django REST Framework
```python
# Serializers para validación + serialización
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'name', 'created_at']
        read_only_fields = ['id', 'created_at']

# ViewSets para CRUD completo
class UserViewSet(viewsets.ModelViewSet):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['status']
    ordering_fields = ['created_at', 'name']
```

---

## Autenticación y Autorización

### JWT (stateless)
```javascript
// Generación
const token = jwt.sign(
  { sub: user.id, email: user.email, roles: user.roles },
  process.env.JWT_SECRET,
  { expiresIn: '15m' } // Access token corto
);
const refreshToken = jwt.sign({ sub: user.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

// Middleware de verificación
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
};
```

### Sesiones con cookies (stateful, más simple para apps monolíticas)
```javascript
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,   // No accesible desde JS
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 días
  },
  store: new RedisStore({ client: redis }) // Persiste sesiones
}));
```

### OAuth 2.0 / OIDC
- Usa librerías establecidas: Passport.js (Node), python-social-auth (Django), Devise (Rails).
- Nunca implementes OAuth desde cero.
- Para auth de terceros en proyectos nuevos, considera Auth0, Clerk, o Supabase Auth.

---

## Rate Limiting
```javascript
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  store: new RedisStore({ sendCommand: (...args) => redis.sendCommand(args) }),
  keyGenerator: (req) => req.user?.id || req.ip,
});
```

---

## Validación de Entradas

### Zod (Node.js/TS) — Recomendado
```typescript
const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  role: z.enum(['admin', 'user', 'viewer']).default('user'),
});

type CreateUserDTO = z.infer<typeof CreateUserSchema>;
```

### Joi (Node.js)
```javascript
const schema = Joi.object({
  email: Joi.string().email().required(),
  age: Joi.number().integer().min(0).max(150),
});
const { error, value } = schema.validate(req.body);
```

---

## Manejo de Errores Asíncronos

```typescript
// Wrapper para evitar try/catch repetitivo en Express
const asyncHandler = (fn: RequestHandler): RequestHandler =>
  (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await userService.findById(req.params.id);
  if (!user) throw new NotFoundError('Usuario no encontrado');
  res.json({ data: user });
}));
```

---

## Logging

```javascript
// Winston configuración básica
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    process.env.NODE_ENV === 'production'
      ? winston.format.json()
      : winston.format.colorize()
  ),
  transports: [new winston.transports.Console()],
});

// Loguea contexto útil, no datos sensibles
logger.info('Usuario autenticado', { userId: user.id, ip: req.ip });
// NUNCA: logger.info('Login', { password: req.body.password });
```
