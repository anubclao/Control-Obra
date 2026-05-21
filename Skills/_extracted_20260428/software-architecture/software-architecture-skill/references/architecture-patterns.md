# Guía de Estilos Arquitectónicos

## Monolito Modular

### Cuándo elegirlo
- Equipo ≤ 10 ingenieros
- Dominio no completamente explorado (startup, MVP, nuevo producto)
- Necesidad de velocidad de iteración alta
- Sin justificación clara para complejidad de microservicios

### Estructura de módulos
```
src/
├── modules/
│   ├── catalog/
│   │   ├── domain/
│   │   │   ├── product.entity.ts
│   │   │   ├── product.repository.ts    ← interfaz
│   │   │   └── product-created.event.ts
│   │   ├── application/
│   │   │   ├── create-product.command.ts
│   │   │   ├── create-product.handler.ts
│   │   │   └── get-product.query.ts
│   │   ├── infrastructure/
│   │   │   ├── postgres-product.repository.ts
│   │   │   └── catalog.module.ts
│   │   └── api/
│   │       └── catalog.controller.ts
│   ├── orders/
│   └── payments/
├── shared/
│   ├── domain/          ← Value Objects compartidos (Money, Email, etc.)
│   └── infrastructure/  ← Utilities genéricas (Logger, EventBus, etc.)
└── app.module.ts
```

### Reglas del monolito modular
1. **Sin imports cruzados** entre módulos (usar eventos o interfaces)
2. **API pública explícita** por módulo (barrel exports controlados)
3. **Base de datos compartida** está bien, pero **esquemas separados** por módulo
4. **Tests de boundaries**: lint rules que detecten imports ilegales

```typescript
// tsconfig paths para enforcer boundaries
{
  "@catalog/*": ["modules/catalog/*"],
  "@orders/*": ["modules/orders/*"],
  // Nunca: import { Product } from '../catalog/domain/product.entity'
  // Siempre: import { Product } from '@catalog/domain'
}
```

---

## Clean Architecture

### Capas y sus responsabilidades

```
┌──────────────────────────────────────────────────────────┐
│  FRAMEWORKS & DRIVERS                                    │
│  Express, NestJS, React, PostgreSQL, Redis, S3           │
│  ┌────────────────────────────────────────────────────┐  │
│  │  INTERFACE ADAPTERS                                │  │
│  │  Controllers, Presenters, Repository Implementations│  │
│  │  ┌──────────────────────────────────────────────┐  │  │
│  │  │  APPLICATION BUSINESS RULES                  │  │  │
│  │  │  Use Cases, Application Services             │  │  │
│  │  │  ┌──────────────────────────────────────┐   │  │  │
│  │  │  │  ENTERPRISE BUSINESS RULES           │   │  │  │
│  │  │  │  Entities, Value Objects, Domain Events│  │  │  │
│  │  │  └──────────────────────────────────────┘   │  │  │
│  │  └──────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
         ↑ Las dependencias solo apuntan hacia adentro
```

### Regla de dependencias en código
```typescript
// ✅ CORRECTO: Dominio no importa nada de afuera
// src/domain/user.entity.ts
export class User {
  private constructor(
    readonly id: UserId,
    private email: Email,
    private name: UserName,
    private status: UserStatus,
  ) {}
  
  static create(email: string, name: string): Result<User, DomainError> {
    // Lógica de negocio pura — sin imports de frameworks
    const emailResult = Email.create(email);
    if (emailResult.isFailure) return Result.fail(emailResult.error);
    return Result.ok(new User(UserId.generate(), emailResult.value, UserName.from(name), UserStatus.ACTIVE));
  }
}

// ✅ CORRECTO: Use case depende de interfaces, no implementaciones
// src/application/create-user.use-case.ts
export class CreateUserUseCase {
  constructor(
    private readonly userRepo: UserRepository,     // ← interfaz del dominio
    private readonly eventBus: EventBus,           // ← interfaz de la app
    private readonly hasher: PasswordHasher,       // ← interfaz de la app
  ) {}
}

// ❌ INCORRECTO: Use case importando framework directamente
import { PrismaClient } from '@prisma/client'; // ← violación de clean arch
```

---

## Arquitectura Hexagonal (Ports & Adapters)

### Puertos (Ports)
```typescript
// Puerto primario (driving) — define cómo el exterior usa el dominio
interface OrderApplicationPort {
  placeOrder(cmd: PlaceOrderCommand): Promise<Result<OrderId, OrderError>>;
  cancelOrder(cmd: CancelOrderCommand): Promise<Result<void, OrderError>>;
  getOrderStatus(id: OrderId): Promise<Option<OrderStatusDTO>>;
}

// Puerto secundario (driven) — define qué necesita el dominio del exterior
interface OrderRepository {
  save(order: Order): Promise<void>;
  findById(id: OrderId): Promise<Option<Order>>;
}

interface PaymentPort {
  charge(amount: Money, method: PaymentMethod): Promise<Result<PaymentId, PaymentError>>;
}
```

### Adaptadores (Adapters)
```typescript
// Adaptador primario: REST API
@Controller('/orders')
class OrderRestAdapter {
  constructor(private readonly app: OrderApplicationPort) {}
  
  @Post()
  async placeOrder(@Body() dto: PlaceOrderDTO): Promise<ResponseDTO> {
    const result = await this.app.placeOrder(PlaceOrderCommand.from(dto));
    return result.isSuccess ? ResponseDTO.ok(result.value) : ResponseDTO.error(result.error);
  }
}

// Adaptador secundario: implementación real del repositorio
class PrismaOrderRepository implements OrderRepository {
  async save(order: Order): Promise<void> {
    await this.prisma.order.upsert({
      where: { id: order.id.value },
      create: OrderMapper.toPersistence(order),
      update: OrderMapper.toPersistence(order),
    });
  }
}

// Adaptador secundario: Stripe para pagos
class StripePaymentAdapter implements PaymentPort {
  async charge(amount: Money, method: PaymentMethod): Promise<Result<PaymentId, PaymentError>> {
    try {
      const intent = await this.stripe.paymentIntents.create({...});
      return Result.ok(PaymentId.from(intent.id));
    } catch (e) {
      return Result.fail(PaymentError.from(e));
    }
  }
}
```

---

## Event-Driven Architecture

### Tipos de eventos
```
Domain Events:    Algo ocurrió en el dominio (OrderPlaced, UserRegistered)
                  → Síncronos dentro del mismo bounded context
                  → Asíncronos entre bounded contexts

Integration Events: Para comunicación entre servicios/contextos
                    → Publicados en message broker (Kafka, RabbitMQ, SNS/SQS)
                    → Garantía de entrega configurable (at-least-once)

Commands:         Solicitudes de acción (PlaceOrder, SendEmail)
                  → Tienen un solo destinatario
                  → Pueden ser rechazados

Queries:          Consultas sin efecto (GetOrder, ListProducts)
                  → Múltiples receptores posibles (read replicas, caches)
```

### Event Schema Management
```typescript
// Versionar eventos para backward compatibility
interface OrderPlacedV1 {
  version: 1;
  orderId: string;
  customerId: string;
  totalAmount: number;
  items: Array<{ productId: string; quantity: number; price: number }>;
  placedAt: string; // ISO 8601
}

// Nueva versión agrega campos, nunca elimina
interface OrderPlacedV2 {
  version: 2;
  orderId: string;
  customerId: string;
  totalAmount: number;
  currency: string; // ← nuevo campo
  items: Array<{ productId: string; quantity: number; price: number; sku: string }>;
  placedAt: string;
  metadata?: Record<string, unknown>; // ← extensión futura
}
```

### Idempotencia (obligatoria en consumers)
```typescript
class OrderPlacedConsumer {
  async handle(event: OrderPlacedEvent): Promise<void> {
    // Idempotency check: ¿ya procesé este evento?
    const processed = await this.idempotencyStore.exists(event.eventId);
    if (processed) {
      this.logger.info('Event already processed, skipping', { eventId: event.eventId });
      return;
    }
    
    // Procesar...
    await this.processOrder(event);
    
    // Marcar como procesado (en misma transacción si posible)
    await this.idempotencyStore.mark(event.eventId, { processedAt: new Date() });
  }
}
```

---

## CQRS (Command Query Responsibility Segregation)

### CQRS Lite (sin Event Sourcing)
```typescript
// Write side: modelo optimizado para escrituras
class OrderWriteService {
  async placeOrder(cmd: PlaceOrderCommand): Promise<void> {
    const order = Order.create(cmd);
    await this.orderWriteRepo.save(order); // Escribe en tabla principal
    await this.eventBus.publish(new OrderPlacedEvent(order)); // Dispara proyecciones
  }
}

// Read side: modelo desnormalizado optimizado para consultas
interface OrderListView {
  orderId: string;
  customerName: string;      // Desnormalizado desde customer
  customerEmail: string;     // Desnormalizado desde customer
  itemCount: number;         // Calculado
  totalFormatted: string;    // Formateado
  statusLabel: string;       // Localizado
  placedAtFormatted: string; // Formateado
}

// Projection que mantiene sincronizado el read model
class OrderListProjection {
  async on(event: OrderPlacedEvent): Promise<void> {
    await this.readDb.orderListViews.insert(
      await this.buildView(event.orderId)
    );
  }
}
```

### CQRS + Event Sourcing (avanzado)
```typescript
// El estado se deriva de los eventos, no se almacena directamente
class Order {
  private events: DomainEvent[] = [];
  
  static fromEvents(events: DomainEvent[]): Order {
    const order = new Order();
    events.forEach(e => order.apply(e));
    return order;
  }
  
  place(cmd: PlaceOrderCommand): void {
    // Validaciones de negocio...
    this.raise(new OrderPlacedEvent(cmd));
  }
  
  private apply(event: DomainEvent): void {
    if (event instanceof OrderPlacedEvent) {
      this.id = event.orderId;
      this.status = OrderStatus.PENDING;
    }
    if (event instanceof OrderShippedEvent) {
      this.status = OrderStatus.SHIPPED;
    }
    // etc.
  }
  
  private raise(event: DomainEvent): void {
    this.apply(event);
    this.events.push(event);
  }
}
```

---

## Microservicios

### Cuándo tiene sentido
- Múltiples equipos que necesitan deployment independiente
- Requerimientos de escalabilidad muy diferentes por componente
- Tecnologías diferentes requeridas por dominio
- Organización Conway alineada (equipo = servicio)

### Qué NO son los microservicios
- No es "una clase = un servicio"
- No es dividir por capa técnica
- No es la solución a problemas de código mal estructurado
- No es obligatorio para ser "moderno"

### Tamaño correcto de un microservicio
```
Un microservicio debe:
✓ Ser desplegable de forma independiente
✓ Tener una base de datos propia (o schema propio)
✓ Corresponder a un bounded context o subdomain
✓ Ser mantenido por un equipo (≤ 8 personas)
✗ NO comunicarse con más de 3-4 servicios síncronamente
✗ NO compartir base de datos con otros servicios
✗ NO tener solo 1-2 endpoints (probablemente nano-service)
```

### Service Mesh y comunicación
```
Síncrono (REST/gRPC): Para queries que necesitan respuesta inmediata
Asíncrono (Kafka/RabbitMQ): Para comandos y eventos entre servicios
Service Mesh (Istio/Linkerd): Para observabilidad, retries, mTLS sin código

Patrón de comunicación recomendado:
├── API Gateway → servicios (REST/gRPC para queries de usuario)
├── Servicios internos → eventos (Kafka para cambios de estado)
└── Datos de referencia → cache (Redis, no llamadas síncronas)
```
