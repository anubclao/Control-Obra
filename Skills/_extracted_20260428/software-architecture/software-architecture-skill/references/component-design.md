# Principios de Diseño de Componentes

## Los 5 principios SOLID aplicados a arquitectura

### S – Single Responsibility (a nivel de módulo)
```
Pregunta clave: ¿Cuántas razones tiene este módulo para cambiar?

Si un módulo cambia por:
- Cambio en regla de negocio → bien
- Cambio en regla de negocio Y cambio de DB → mal
- Requisito de múltiples stakeholders diferentes → separar

Ejemplo de violación:
class ReportService {
  generatePDF() {...}     // → cambia si cambia la librería de PDF
  formatData() {...}      // → cambia si cambian las reglas de negocio
  sendByEmail() {...}     // → cambia si cambia el proveedor de email
  saveToS3() {...}        // → cambia si cambia la infraestructura de archivos
}

Solución:
class ReportGenerator { generateReport(data): ReportDocument {...} }
class PDFRenderer { render(doc: ReportDocument): Buffer {...} }
class ReportDistributor { distribute(report: Buffer, recipients: Email[]): Promise<void> {...} }
class ReportStorage { store(report: Buffer, key: StorageKey): Promise<URL> {...} }
```

### O – Open/Closed Principle
```typescript
// Abierto para extensión, cerrado para modificación
// En lugar de switch/if-else que crece con cada nuevo tipo:

// ❌ Violación
function calculateDiscount(order: Order, type: string): Money {
  if (type === 'LOYALTY') return order.total.multiply(0.1);
  if (type === 'COUPON') return order.total.multiply(0.15);
  if (type === 'VIP') return order.total.multiply(0.2);
  // Cada nuevo tipo requiere modificar esta función
  return Money.ZERO;
}

// ✅ Solución con Strategy
interface DiscountStrategy {
  apply(order: Order): Money;
}

// Añadir nuevas estrategias sin modificar código existente
class LoyaltyDiscount implements DiscountStrategy {
  apply(order: Order): Money { return order.total.multiply(0.1); }
}
```

### L – Liskov Substitution
```typescript
// Los subtipos deben ser sustituibles por sus tipos base
// Las implementaciones deben cumplir el contrato de la interfaz

// ❌ Violación
class ReadOnlyRepository implements UserRepository {
  save(user: User): Promise<void> {
    throw new Error('This repository is read-only!'); // Viola el contrato
  }
}

// ✅ Solución: segregar la interfaz
interface UserReadRepository {
  findById(id: UserId): Promise<Option<User>>;
}

interface UserWriteRepository {
  save(user: User): Promise<void>;
}
```

### I – Interface Segregation
```typescript
// Muchas interfaces específicas > una interfaz general

// ❌ Demasiado amplia
interface UserRepository {
  findById(id: UserId): Promise<User>;
  findAll(): Promise<User[]>;
  findByEmail(email: Email): Promise<User>;
  save(user: User): Promise<void>;
  delete(id: UserId): Promise<void>;
  findWithOrders(id: UserId): Promise<UserWithOrders>;
  findTopCustomers(limit: number): Promise<User[]>;
  generateReport(): Promise<Buffer>;  // ← esto no es un repositorio
}

// ✅ Segregadas por uso
interface UserFinder {
  findById(id: UserId): Promise<Option<User>>;
  findByEmail(email: Email): Promise<Option<User>>;
}

interface UserPersistence {
  save(user: User): Promise<void>;
  delete(id: UserId): Promise<void>;
}

interface UserAnalytics {
  findTopCustomers(limit: number): Promise<CustomerSummary[]>;
}
```

### D – Dependency Inversion
```typescript
// Los módulos de alto nivel no deben depender de módulos de bajo nivel
// Ambos deben depender de abstracciones

// ❌ Violación: Use case depende de implementación concreta
class CreateOrderUseCase {
  private readonly db = new PostgresDatabase(); // ← acoplado a Postgres
  
  async execute(cmd: CreateOrderCommand): Promise<void> {
    await this.db.query('INSERT INTO orders ...');
  }
}

// ✅ Correcto: depende de abstracción
class CreateOrderUseCase {
  constructor(
    private readonly orderRepo: OrderRepository,  // ← interfaz
    private readonly paymentGateway: PaymentGateway, // ← interfaz
    private readonly eventBus: EventBus,           // ← interfaz
  ) {}
  
  async execute(cmd: CreateOrderCommand): Promise<Result<OrderId, OrderError>> {
    // Lógica de negocio sin conocimiento de implementaciones
  }
}
```

---

## Value Objects

Usa Value Objects en lugar de primitivos para el dominio:

```typescript
// ❌ Primitive Obsession
function createOrder(userId: string, amount: number, currency: string) { ... }
// ¿Qué pasa si amount es negativo? ¿Y si currency no es válida?

// ✅ Value Objects con validación en construcción
class Money {
  private constructor(
    readonly amount: number,
    readonly currency: Currency,
  ) {}
  
  static create(amount: number, currency: string): Result<Money, DomainError> {
    if (amount < 0) return Result.fail(new InvalidAmountError(amount));
    const curr = Currency.from(currency);
    if (!curr) return Result.fail(new InvalidCurrencyError(currency));
    return Result.ok(new Money(amount, curr));
  }
  
  add(other: Money): Money {
    if (!this.currency.equals(other.currency)) throw new CurrencyMismatchError();
    return new Money(this.amount + other.amount, this.currency);
  }
  
  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency.equals(other.currency);
  }
}

// Otros Value Objects comunes:
class Email { /* validación de formato */ }
class PhoneNumber { /* normalización + validación */ }
class Percentage { /* 0-100, no negativo */ }
class PositiveInteger { /* entero > 0 */ }
class DateRange { /* start < end */ }
class Url { /* validación de URL */ }
```

---

## Result Type (evitar excepciones para control de flujo)

```typescript
// Evitar excepciones como control de flujo (solo para errores inesperados)

class Result<T, E> {
  private constructor(
    private readonly _value?: T,
    private readonly _error?: E,
  ) {}
  
  static ok<T>(value: T): Result<T, never> {
    return new Result<T, never>(value);
  }
  
  static fail<E>(error: E): Result<never, E> {
    return new Result<never, E>(undefined, error);
  }
  
  get isSuccess(): boolean { return this._error === undefined; }
  get isFailure(): boolean { return !this.isSuccess; }
  get value(): T { if (this.isFailure) throw new Error('Cannot get value of failure'); return this._value!; }
  get error(): E { if (this.isSuccess) throw new Error('Cannot get error of success'); return this._error!; }
  
  map<U>(fn: (value: T) => U): Result<U, E> {
    if (this.isSuccess) return Result.ok(fn(this.value));
    return Result.fail(this.error);
  }
  
  flatMap<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    if (this.isSuccess) return fn(this.value);
    return Result.fail(this.error);
  }
}

// Uso en use case
async function createUser(cmd: CreateUserCommand): Promise<Result<UserId, CreateUserError>> {
  const emailResult = Email.create(cmd.email);
  if (emailResult.isFailure) return Result.fail(CreateUserError.invalidEmail(cmd.email));
  
  const existingUser = await userRepo.findByEmail(emailResult.value);
  if (existingUser.isSome) return Result.fail(CreateUserError.emailAlreadyExists());
  
  const user = User.create(emailResult.value, cmd.name);
  await userRepo.save(user);
  return Result.ok(user.id);
}
```

---

## Domain Events internos

```typescript
// Los eventos del dominio capturan intenciones del negocio
// Se nombran en pasado porque ya ocurrieron

class UserRegisteredEvent {
  readonly occurredAt: Date;
  readonly eventId: string;
  
  constructor(
    readonly userId: UserId,
    readonly email: Email,
    readonly registrationSource: RegistrationSource,
  ) {
    this.occurredAt = new Date();
    this.eventId = crypto.randomUUID();
  }
}

// La entidad acumula eventos
class User {
  private _domainEvents: DomainEvent[] = [];
  
  get domainEvents(): ReadonlyArray<DomainEvent> {
    return this._domainEvents;
  }
  
  clearEvents(): void {
    this._domainEvents = [];
  }
  
  protected raise(event: DomainEvent): void {
    this._domainEvents.push(event);
  }
  
  static register(email: Email, name: UserName): User {
    const user = new User(UserId.generate(), email, name);
    user.raise(new UserRegisteredEvent(user.id, email, RegistrationSource.WEB));
    return user;
  }
}

// El repositorio o el use case publica los eventos después de guardar
class CreateUserHandler {
  async handle(cmd: CreateUserCommand): Promise<Result<UserId, DomainError>> {
    const user = User.register(email, name);
    await this.userRepo.save(user);
    
    // Publicar después de persistir exitosamente
    for (const event of user.domainEvents) {
      await this.eventBus.publish(event);
    }
    user.clearEvents();
    
    return Result.ok(user.id);
  }
}
```

---

## Estructura de directorios recomendada

### Por dominio (recomendada)
```
src/
├── modules/
│   └── {domain}/
│       ├── domain/
│       │   ├── {entity}.entity.ts         ← Entidad con lógica de negocio
│       │   ├── {entity}.repository.ts     ← Interfaz del repositorio
│       │   ├── value-objects/
│       │   │   └── {vo}.value-object.ts
│       │   └── events/
│       │       └── {event}.event.ts
│       ├── application/
│       │   ├── commands/
│       │   │   ├── {action}.command.ts
│       │   │   └── {action}.handler.ts
│       │   ├── queries/
│       │   │   ├── {get-x}.query.ts
│       │   │   └── {get-x}.handler.ts
│       │   └── {domain}.service.ts        ← Orquestador (opcional)
│       ├── infrastructure/
│       │   ├── persistence/
│       │   │   ├── {orm}-{entity}.repository.ts
│       │   │   └── {entity}.mapper.ts
│       │   └── {adapters}/
│       └── presentation/
│           ├── {domain}.controller.ts
│           ├── dto/
│           │   ├── create-{entity}.dto.ts
│           │   └── {entity}-response.dto.ts
│           └── {domain}.module.ts
├── shared/
│   ├── domain/
│   │   ├── result.ts
│   │   ├── option.ts
│   │   └── value-objects/
│   │       ├── entity-id.ts
│   │       └── money.ts
│   └── infrastructure/
│       ├── logger/
│       ├── event-bus/
│       └── cache/
└── config/
    ├── database.config.ts
    └── app.config.ts
```
