# Stack (LIFO) y Queue (FIFO)

## Stack — Last In, First Out

**Casos de uso web/app:**
- Undo/Redo (editor de texto, Figma, etc.)
- Navegación hacia atrás (browser history)
- Evaluación de expresiones / parsers
- Call stack de funciones (debug)
- Depth-First Search (DFS)

```js
class Stack {
  constructor() { this.items = []; }

  push(item) { this.items.push(item); }          // O(1)
  pop() { return this.items.pop(); }             // O(1)
  peek() { return this.items.at(-1); }           // O(1)
  isEmpty() { return this.items.length === 0; }
  get size() { return this.items.length; }
}
```

### Ejemplo real: sistema Undo/Redo

```js
class Editor {
  constructor() {
    this.content = '';
    this.undoStack = new Stack();
    this.redoStack = new Stack();
  }

  type(text) {
    this.undoStack.push(this.content);   // guarda estado anterior
    this.redoStack = new Stack();        // invalida redo
    this.content += text;
  }

  undo() {
    if (this.undoStack.isEmpty()) return;
    this.redoStack.push(this.content);
    this.content = this.undoStack.pop(); // restaura estado
  }

  redo() {
    if (this.redoStack.isEmpty()) return;
    this.undoStack.push(this.content);
    this.content = this.redoStack.pop();
  }
}
```

### Ejemplo real: validar paréntesis / brackets en un parser

```js
function isBalanced(str) {
  const stack = new Stack();
  const pairs = { ')': '(', ']': '[', '}': '{' };

  for (const char of str) {
    if ('([{'.includes(char)) stack.push(char);
    else if (')]}'.includes(char)) {
      if (stack.pop() !== pairs[char]) return false;
    }
  }
  return stack.isEmpty();
}
```

---

## Queue — First In, First Out

**Casos de uso web/app:**
- Cola de notificaciones
- Request queue / rate limiter
- Job queue (subir archivos, procesar imágenes)
- Breadth-First Search (BFS)
- Event loop del browser

```js
// ✅ Queue eficiente — O(1) enqueue y dequeue
class Queue {
  constructor() {
    this.items = {};
    this.head = 0;
    this.tail = 0;
  }

  enqueue(item) {                         // O(1)
    this.items[this.tail++] = item;
  }

  dequeue() {                             // O(1) — sin shift()!
    if (this.isEmpty()) return null;
    const item = this.items[this.head];
    delete this.items[this.head++];
    return item;
  }

  peek() { return this.items[this.head]; }
  isEmpty() { return this.head === this.tail; }
  get size() { return this.tail - this.head; }
}
```

### Ejemplo real: sistema de notificaciones

```js
class NotificationQueue {
  constructor(displayFn, delay = 3000) {
    this.queue = new Queue();
    this.processing = false;
    this.displayFn = displayFn;
    this.delay = delay;
  }

  add(notification) {
    this.queue.enqueue(notification);
    if (!this.processing) this.process();
  }

  async process() {
    this.processing = true;
    while (!this.queue.isEmpty()) {
      const notif = this.queue.dequeue();
      this.displayFn(notif);
      await new Promise(r => setTimeout(r, this.delay));
    }
    this.processing = false;
  }
}
```

### Ejemplo real: rate limiter para API calls

```js
class RateLimiter {
  constructor(maxPerSecond) {
    this.queue = new Queue();
    this.max = maxPerSecond;
    this.processing = false;
  }

  async call(apiFn) {
    return new Promise((resolve) => {
      this.queue.enqueue({ apiFn, resolve });
      if (!this.processing) this.flush();
    });
  }

  async flush() {
    this.processing = true;
    while (!this.queue.isEmpty()) {
      const batch = [];
      while (!this.queue.isEmpty() && batch.length < this.max) {
        batch.push(this.queue.dequeue());
      }
      await Promise.all(batch.map(({ apiFn, resolve }) => apiFn().then(resolve)));
      await new Promise(r => setTimeout(r, 1000));
    }
    this.processing = false;
  }
}
```

## Deque (Double-ended Queue)

Permite insertar y eliminar por ambos extremos — O(1).

```js
// En JS: usar una LinkedList doblemente enlazada, o simplemente:
const deque = [];
deque.push(item);       // agregar al final
deque.unshift(item);    // agregar al inicio — ⚠️ O(n), mejor usar Linked List
deque.pop();            // quitar del final
deque.shift();          // quitar del inicio — ⚠️ O(n)
```

Para Deque eficiente en producción, usa la implementación con Linked List doblemente enlazada.
