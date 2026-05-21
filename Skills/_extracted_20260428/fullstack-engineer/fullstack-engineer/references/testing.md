# Testing Reference

## Pirámide de Tests

```
        E2E (pocos, lentos, costosos)
       ────────────────────────────
      Integration (medianos)
     ──────────────────────────────
    Unit (muchos, rápidos, baratos)
```

**Regla práctica**: 70% unit, 20% integration, 10% e2e.

---

## Testing de Backend

### Vitest (Node.js/TS — Recomendado)
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserService } from './user.service';

describe('UserService', () => {
  let userService: UserService;
  let mockUserRepo: MockUserRepository;

  beforeEach(() => {
    mockUserRepo = {
      findByEmail: vi.fn(),
      save: vi.fn(),
    };
    userService = new UserService(mockUserRepo);
  });

  it('debería crear un usuario con contraseña hasheada', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(null);
    mockUserRepo.save.mockImplementation(user => Promise.resolve(user));

    const result = await userService.createUser({
      email: 'test@example.com',
      password: 'plaintext123',
    });

    expect(result.email).toBe('test@example.com');
    expect(result.password).not.toBe('plaintext123'); // Hasheado
    expect(mockUserRepo.save).toHaveBeenCalledOnce();
  });

  it('debería lanzar error si el email ya existe', async () => {
    mockUserRepo.findByEmail.mockResolvedValue({ id: '1', email: 'test@example.com' });

    await expect(
      userService.createUser({ email: 'test@example.com', password: 'pass' })
    ).rejects.toThrow('Email ya registrado');
  });
});
```

### Jest (alternativa, más común en proyectos legacy)
```javascript
jest.mock('../repositories/user.repository');
const mockFind = jest.spyOn(UserRepository.prototype, 'findByEmail').mockResolvedValue(null);
```

### Supertest para Integration Tests de API
```typescript
import request from 'supertest';
import app from '../app';

describe('POST /api/users', () => {
  it('debería crear usuario y retornar 201', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({ email: 'test@example.com', name: 'Test User', password: 'SecurePass123!' })
      .expect(201)
      .expect('Content-Type', /json/);

    expect(response.body.data).toMatchObject({
      email: 'test@example.com',
      name: 'Test User',
    });
    expect(response.body.data.password).toBeUndefined(); // No exponer contraseña
  });

  it('debería retornar 400 con email inválido', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({ email: 'not-an-email', name: 'Test' })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
```

---

## Testing de Frontend

### React Testing Library
```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './LoginForm';

describe('LoginForm', () => {
  it('muestra errores de validación al enviar vacío', async () => {
    const user = userEvent.setup();
    render(<LoginForm onSubmit={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    expect(screen.getByText(/el email es requerido/i)).toBeInTheDocument();
    expect(screen.getByText(/la contraseña es requerida/i)).toBeInTheDocument();
  });

  it('llama onSubmit con las credenciales correctas', async () => {
    const user = userEvent.setup();
    const mockSubmit = vi.fn();
    render(<LoginForm onSubmit={mockSubmit} />);

    await user.type(screen.getByLabelText(/email/i), 'user@example.com');
    await user.type(screen.getByLabelText(/contraseña/i), 'password123');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'password123',
      });
    });
  });
});
```

### MSW (Mock Service Worker) para APIs
```typescript
// handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/users', () => {
    return HttpResponse.json({ data: [{ id: '1', name: 'Test User' }] });
  }),
  http.post('/api/users', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ data: { id: '2', ...body } }, { status: 201 });
  }),
];

// En tests: el fetch real se intercepta sin modificar el código de producción
```

---

## E2E con Playwright

```typescript
import { test, expect } from '@playwright/test';

test('flujo de login completo', async ({ page }) => {
  await page.goto('/login');

  await page.fill('[name=email]', 'user@example.com');
  await page.fill('[name=password]', 'password123');
  await page.click('button[type=submit]');

  await expect(page).toHaveURL('/dashboard');
  await expect(page.locator('h1')).toContainText('Dashboard');
});

test('muestra error con credenciales inválidas', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name=email]', 'wrong@example.com');
  await page.fill('[name=password]', 'wrongpass');
  await page.click('button[type=submit]');

  await expect(page.locator('[role=alert]')).toContainText('Credenciales inválidas');
  await expect(page).toHaveURL('/login'); // No redirige
});
```

---

## Testing de Base de Datos

```typescript
// Tests de repositorio con base de datos real (usar DB de test)
describe('UserRepository', () => {
  beforeEach(async () => {
    await db.query('BEGIN'); // Transacción para rollback al final
  });

  afterEach(async () => {
    await db.query('ROLLBACK'); // Limpieza automática
  });

  it('debería encontrar usuario por email', async () => {
    // Arrange
    await db.query("INSERT INTO users (email, name) VALUES ('test@test.com', 'Test')");
    
    // Act
    const user = await userRepo.findByEmail('test@test.com');
    
    // Assert
    expect(user).toMatchObject({ email: 'test@test.com', name: 'Test' });
  });
});
```

---

## Cobertura y CI

```json
// vitest.config.ts
{
  "test": {
    "coverage": {
      "provider": "v8",
      "reporter": ["text", "lcov"],
      "thresholds": {
        "lines": 80,
        "branches": 75,
        "functions": 80
      },
      "exclude": ["node_modules", "dist", "**/*.config.*", "**/*.d.ts"]
    }
  }
}
```
