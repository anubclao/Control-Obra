# Seguridad Reference

## Top 10 Vulnerabilidades Web (OWASP)

### 1. Inyección (SQL, NoSQL, Command)
```javascript
// MAL - SQL Injection
const users = await db.query(`SELECT * FROM users WHERE email = '${email}'`);

// BIEN - Parameterized query
const users = await db.query('SELECT * FROM users WHERE email = $1', [email]);

// MAL - Command injection
exec(`convert ${filename} output.pdf`);

// BIEN
execFile('convert', [filename, 'output.pdf']); // Array de args, no shell
```

### 2. Broken Authentication
```javascript
// Contraseñas: siempre bcrypt/argon2, NUNCA md5/sha1
const hash = await bcrypt.hash(password, 12); // cost factor 12 mínimo
const valid = await bcrypt.compare(password, storedHash);

// Tokens seguros para reset de contraseña
const token = crypto.randomBytes(32).toString('hex');
const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos
```

### 3. XSS (Cross-Site Scripting)
```javascript
// En React: JSX escapa automáticamente. EVITAR dangerouslySetInnerHTML.
// Si necesitas HTML del servidor, sanitiza:
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(htmlContent) }} />

// Backend: si generas HTML, escapa siempre
import { escape } from 'html-escaper';
const safeText = escape(userInput);
```

### 4. CSRF (Cross-Site Request Forgery)
```javascript
// Con cookies de sesión: usa tokens CSRF
app.use(csrf({ cookie: { httpOnly: true, sameSite: 'strict' } }));

// Con JWT en Authorization header: naturalmente protegido (browsers no envían headers automáticamente)
// Con SameSite=Lax/Strict cookies: protección básica suficiente para muchos casos
```

### 5. Security Misconfiguration
```javascript
// Headers de seguridad con Helmet.js
import helmet from 'helmet';
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "trusted-cdn.com"],
      imgSrc: ["'self'", "data:", "https:"],
    }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));

// Variables de entorno: NUNCA en código
// ✅ process.env.DATABASE_URL
// ❌ const DB = 'postgresql://user:pass@host/db'
```

### 6. Datos Sensibles Expuestos
```javascript
// Nunca devuelvas campos sensibles en APIs
const { password, refreshToken, twoFactorSecret, ...safeUser } = user;
return res.json({ data: safeUser });

// Logs: nunca loguees datos sensibles
// MAL:
logger.info('Login attempt', { email, password }); 
// BIEN:
logger.info('Login attempt', { email, userAgent: req.headers['user-agent'] });
```

### 7. IDOR (Insecure Direct Object Reference)
```javascript
// Siempre verifica que el recurso pertenece al usuario autenticado
router.get('/orders/:id', authenticate, async (req, res) => {
  const order = await Order.findOne({
    id: req.params.id,
    userId: req.user.id  // CRÍTICO: filtrar por usuario actual
  });
  if (!order) return res.status(404).json({ error: 'No encontrado' });
  res.json({ data: order });
});
```

---

## CORS Configuración

```javascript
import cors from 'cors';

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://miapp.com', 'https://www.miapp.com']
    : 'http://localhost:3000',
  credentials: true, // Permite cookies cross-origin
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
```

---

## Variables de Entorno y Secretos

```bash
# .env.example (sí en git)
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
JWT_SECRET=your-secret-here
REDIS_URL=redis://localhost:6379

# .env (NUNCA en git — agregar a .gitignore)
DATABASE_URL=postgresql://realuser:realpass@prod-host:5432/proddb
JWT_SECRET=super-random-256-bit-secret
```

```javascript
// Valida variables de entorno al inicio (fail-fast)
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'REDIS_URL'];
requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    throw new Error(`Variable de entorno requerida: ${varName}`);
  }
});
```

---

## Upload de Archivos Seguro

```javascript
import multer from 'multer';
import path from 'path';

const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB máximo
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Tipo de archivo no permitido'));
    }
    cb(null, true);
  },
  storage: multer.memoryStorage(), // No guardes en disco directamente
});

// Valida TAMBIÉN la extensión y el contenido real del archivo
// Usa un servicio externo (S3, Cloudinary) para servir archivos, nunca desde tu servidor directamente
```

---

## Checklist de Seguridad para Deploy

- [ ] HTTPS forzado (redirect HTTP → HTTPS)
- [ ] Headers de seguridad configurados (Helmet o equivalente)
- [ ] Variables de entorno en el servidor, no en código
- [ ] Dependencias actualizadas (`npm audit`, `pip audit`)
- [ ] Rate limiting en rutas de auth
- [ ] Logs sin datos sensibles
- [ ] Backups de base de datos configurados y probados
- [ ] CORS restringido a dominios específicos
- [ ] Error messages sin stack traces en producción
