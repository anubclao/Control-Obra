# Catálogo de Patrones de Arquitectura y Diseño

## Tabla de contenidos
1. [Patrones creacionales](#creacionales)
2. [Patrones estructurales](#estructurales)
3. [Patrones de comportamiento](#comportamiento)
4. [Patrones de integración](#integracion)
5. [Patrones de resiliencia](#resiliencia)
6. [Antipatrones con solución](#antipatrones)

---

## Patrones creacionales

### Factory Method
**Cuándo usar:** Cuando el tipo exacto del objeto a crear se determina en tiempo de ejecución.
```typescript
interface NotificationSender {
  send(message: Message): Promise<void>;
}

class NotificationFactory {
  static create(channel: 'email' | 'sms' | 'push'): NotificationSender {
    const senders = {
      email: () => new EmailSender(emailConfig),
      sms:   () => new SmsSender(smsConfig),
      push:  () => new PushSender(pushConfig),
    };
    return senders[channel]();
  }
}
```

### Builder
**Cuándo usar:** Objetos complejos con muchos parámetros opcionales.
```typescript
const query = new QueryBuilder()
  .from('orders')
  .where('status', OrderStatus.PENDING)
  .orderBy('createdAt', 'DESC')
  .limit(20)
  .offset(0)
  .build();
```

### Singleton (con precaución)
**Cuándo usar:** Recursos compartidos únicos (conexión DB, config). **Evitar** en lógica de negocio.
```typescript
// Preferir injection sobre singleton explícito
// Usar contenedor DI para gestionar el scope
container.register(Database, { scope: Scope.Singleton });
```

---

## Patrones estructurales

### Repository Pattern
**Propósito:** Abstraer la capa de persistencia del dominio.
```typescript
// Interfaz en el dominio
interface UserRepository {
  findById(id: UserId): Promise<Option<User>>;
  findByEmail(email: Email): Promise<Option<User>>;
  save(user: User): Promise<void>;
  delete(id: UserId): Promise<void>;
}

// Implementación en infraestructura
class PostgresUserRepository implements UserRepository {
  constructor(private readonly db: DatabaseConnection) {}
  
  async findById(id: UserId): Promise<Option<User>> {
    const row = await this.db.query('SELECT * FROM users WHERE id = $1', [id.value]);
    return row ? Option.some(UserMapper.toDomain(row)) : Option.none();
  }
}
```

### Adapter Pattern
**Propósito:** Traducir entre interfaces incompatibles (especialmente para integraciones externas).
```typescript
// Puerto (interfaz del dominio)
interface PaymentGateway {
  charge(amount: Money, card: CardToken): Promise<PaymentResult>;
}

// Adaptador para Stripe
class StripeAdapter implements PaymentGateway {
  constructor(private readonly stripe: Stripe) {}
  
  async charge(amount: Money, card: CardToken): Promise<PaymentResult> {
    const charge = await this.stripe.charges.create({
      amount: amount.inCents(),
      currency: amount.currency.toLowerCase(),
      source: card.value,
    });
    return PaymentResult.fromStripeCharge(charge);
  }
}
```

### Facade Pattern
**Propósito:** Simplificar una interfaz compleja para casos de uso comunes.
```typescript
// En lugar de coordinar múltiples servicios en el controller:
class OrderFacade {
  async placeOrder(cmd: PlaceOrderCommand): Promise<OrderConfirmation> {
    const order = await this.orderService.create(cmd);
    await this.inventoryService.reserve(order.items);
    const payment = await this.paymentService.charge(order.total, cmd.paymentMethod);
    await this.notificationService.sendConfirmation(order, payment);
    return OrderConfirmation.from(order, payment);
  }
}
```

### Decorator Pattern
**Propósito:** Añadir comportamiento sin modificar la clase original.
```typescript
class LoggingUserRepository implements UserRepository {
  constructor(
    private readonly inner: UserRepository,
    private readonly logger: Logger,
  ) {}
  
  async findById(id: UserId): Promise<Option<User>> {
    this.logger.info('Finding user', { userId: id.value });
    const start = Date.now();
    const result = await this.inner.findById(id);
    this.logger.info('User found', { userId: id.value, durationMs: Date.now() - start });
    return result;
  }
}
```

---

## Patrones de comportamiento

### Command Pattern (con CQRS)
```typescript
// Command (modifica estado)
interface Command { readonly type: string; }
interface CommandHandler<C extends Command, R> {
  handle(command: C): Promise<R>;
}

class CreateUserCommand implements Command {
  readonly type = 'CREATE_USER';
  constructor(
    readonly email: string,
    readonly name: string,
    readonly roleId: string,
  ) {}
}

class CreateUserHandler implements CommandHandler<CreateUserCommand, UserId> {
  async handle(cmd: CreateUserCommand): Promise<UserId> {
    const user = User.create(cmd.email, cmd.name, cmd.roleId);
    await this.userRepo.save(user);
    await this.eventBus.publish(new UserCreatedEvent(user.id));
    return user.id;
  }
}

// Query (solo lectura, sin efectos)
class GetUserByIdQuery {
  constructor(readonly userId: string) {}
}

class GetUserByIdHandler {
  async handle(query: GetUserByIdQuery): Promise<UserDTO | null> {
    // Puede usar una proyección optimizada para lectura
    return this.userReadModel.findById(query.userId);
  }
}
```

### Observer / Event-Driven
```typescript
// Domain Event
class OrderShippedEvent {
  constructor(
    readonly orderId: string,
    readonly trackingNumber: string,
    readonly shippedAt: Date,
  ) {}
}

// Handlers desacoplados
class SendShippingNotificationHandler {
  async handle(event: OrderShippedEvent): Promise<void> {
    await this.notificationService.sendShippingConfirmation(event.orderId, event.trackingNumber);
  }
}

class UpdateInventoryHandler {
  async handle(event: OrderShippedEvent): Promise<void> {
    await this.inventoryService.confirmShipment(event.orderId);
  }
}
```

### Strategy Pattern
```typescript
interface PricingStrategy {
  calculate(basePrice: Money, context: PricingContext): Money;
}

class BlackFridayStrategy implements PricingStrategy {
  calculate(basePrice: Money, context: PricingContext): Money {
    return basePrice.multiply(0.7); // 30% descuento
  }
}

class LoyaltyStrategy implements PricingStrategy {
  calculate(basePrice: Money, context: PricingContext): Money {
    const discount = Math.min(context.loyaltyPoints * 0.001, 0.20);
    return basePrice.multiply(1 - discount);
  }
}
```

---

## Patrones de integración

### Anti-Corruption Layer (ACL)
**Propósito:** Proteger el dominio de modelos externos contaminantes.
```typescript
// El modelo externo (legado o de terceros)
interface LegacyUserData {
  usr_id: number;
  usr_nm: string;
  usr_email: string;
  actv_flg: 0 | 1;
}

// ACL que traduce al modelo del dominio
class LegacyUserACL {
  translate(legacy: LegacyUserData): User {
    return new User(
      UserId.from(String(legacy.usr_id)),
      UserName.from(legacy.usr_nm),
      Email.from(legacy.usr_email),
      legacy.actv_flg === 1 ? UserStatus.ACTIVE : UserStatus.INACTIVE,
    );
  }
}
```

### Saga Pattern (transacciones distribuidas)
```typescript
// Orchestrated Saga para proceso de compra
class PlaceOrderSaga {
  async execute(cmd: PlaceOrderCommand): Promise<void> {
    const sagaId = SagaId.generate();
    
    try {
      // Paso 1: Reservar inventario
      await this.inventoryService.reserve(cmd.items);
      
      // Paso 2: Procesar pago
      const payment = await this.paymentService.charge(cmd.total, cmd.paymentMethod);
      
      // Paso 3: Crear orden confirmada
      await this.orderService.confirm(cmd, payment.id);
      
      // Paso 4: Iniciar envío
      await this.shippingService.schedule(cmd.orderId, cmd.address);
      
    } catch (error) {
      // Compensating transactions
      await this.rollback(sagaId, error);
    }
  }
  
  private async rollback(sagaId: SagaId, error: Error): Promise<void> {
    // Ejecutar en orden inverso
    await this.shippingService.cancel(sagaId);
    await this.orderService.reject(sagaId);
    await this.paymentService.refund(sagaId);
    await this.inventoryService.release(sagaId);
  }
}
```

### Outbox Pattern (garantía de exactly-once delivery)
```typescript
// En la misma transacción que el cambio de estado:
async function createUser(cmd: CreateUserCommand, db: Transaction): Promise<void> {
  await db.users.insert(userRecord);
  
  // En la misma transacción → nunca se pierde el evento
  await db.outbox.insert({
    eventType: 'USER_CREATED',
    payload: JSON.stringify({ userId: userRecord.id }),
    status: 'PENDING',
    createdAt: new Date(),
  });
}

// Proceso separado publica eventos del outbox (at-least-once)
// El consumidor es idempotente para manejar duplicados
```

---

## Patrones de resiliencia

### Circuit Breaker
```typescript
class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime?: Date;
  
  constructor(
    private readonly threshold: number = 5,
    private readonly timeout: number = 60_000,
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime!.getTime() > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new CircuitOpenError('Service unavailable');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }
  
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
    }
  }
}
```

### Retry con Exponential Backoff
```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts: number; baseDelayMs: number; maxDelayMs: number }
): Promise<T> {
  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === options.maxAttempts) throw error;
      if (!isRetryable(error)) throw error;
      
      const jitter = Math.random() * 100;
      const delay = Math.min(
        options.baseDelayMs * Math.pow(2, attempt - 1) + jitter,
        options.maxDelayMs
      );
      await sleep(delay);
    }
  }
  throw new Error('unreachable');
}
```

---

## Antipatrones con solución

### God Service → Descomposición por responsabilidad

```
PROBLEMA:
UserService {
  register(), login(), updateProfile(), sendEmail(),
  generateReport(), deleteAccount(), uploadAvatar()
}

SOLUCIÓN:
RegistrationService  { register(), verifyEmail() }
AuthenticationService { login(), logout(), refreshToken() }
ProfileService       { getProfile(), updateProfile(), uploadAvatar() }
AccountService       { deactivate(), delete(), exportData() }
// Email y reportes → servicios separados con sus propios bounded contexts
```

### Shared Database → Database per Service + API

```
PROBLEMA:
OrderService  → SELECT * FROM users WHERE ...   (acceso directo a tabla de Users)
ProductService → UPDATE users SET ...            (mutación directa)

SOLUCIÓN:
OrderService  → GET /api/users/{id}             (API call o event)
ProductService → publica evento, UserService suscribe y actualiza su propia BD
```

### Synchronous Chain → Async + Event-Driven

```
PROBLEMA (cadena síncrona frágil):
PlaceOrder → [sync] PaymentService → [sync] InventoryService → [sync] ShippingService → [sync] NotificationService

SOLUCIÓN (async con saga):
PlaceOrder → publica OrderPlaced
  ├── PaymentService suscribe → procesa → publica PaymentProcessed
  ├── InventoryService suscribe → reserva → publica InventoryReserved
  └── ShippingService suscribe → agenda → publica ShipmentScheduled
      └── NotificationService suscribe → envía confirmación
```
