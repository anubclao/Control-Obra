---
name: data-structures-optimizer
description: >
  Aplica esta skill SIEMPRE que el usuario quiera mejorar, optimizar, o refactorizar el código de una app o página web usando estructuras de datos eficientes. Úsala cuando el usuario mencione: rendimiento lento, búsquedas ineficientes, listas, colas, pilas, tablas hash, árboles, grafos, arrays vs linked lists, LIFO, FIFO, o cuando el código tenga loops anidados innecesarios, búsquedas O(n) que podrían ser O(1), o manejo ineficiente de colecciones. También activa cuando el usuario diga "hazlo más eficiente", "optimiza esto", "el código está lento", o pide elegir entre estructuras de datos.
---

# Data Structures Optimizer

Esta skill convierte código ineficiente en código optimizado eligiendo la estructura de datos correcta para cada situación. Aplica principios de Computer Science a apps y páginas web reales.

## Proceso de análisis

Cuando recibas código para optimizar:

1. **Identifica el bottleneck** — ¿Dónde están los O(n²) o búsquedas repetidas?
2. **Clasifica el patrón de acceso** — ¿Busca por key? ¿Orden importa? ¿LIFO o FIFO? ¿Relaciones entre nodos?
3. **Elige la estructura correcta** — Usa la tabla de decisión abajo
4. **Refactoriza** — Muestra antes/después con complejidad Big-O explícita
5. **Explica el trade-off** — Memoria vs velocidad, simplicidad vs performance

## Tabla de decisión rápida

| Situación | Estructura | Complejidad |
|-----------|-----------|-------------|
| Buscar elemento por ID/key | Hash Table (Map/Object) | O(1) |
| Historial / deshacer (undo) | Stack (LIFO) | O(1) push/pop |
| Cola de tareas / requests | Queue (FIFO) | O(1) enqueue/dequeue |
| Datos ordenados + búsqueda rápida | BST / Array ordenado | O(log n) |
| Relaciones entre entidades | Grafo (Graph) | Depende del algoritmo |
| Navegación jerárquica (menú, DOM) | Árbol (Tree) | O(log n) a O(n) |
| Acceso por índice numérico | Array | O(1) |
| Inserción/eliminación frecuente en medio | Linked List | O(1) con pointer |
| Deduplicación rápida | Set | O(1) |

## Estructuras de datos — Guía de implementación

Lee el archivo de referencia correspondiente según la estructura detectada:
- Arrays vs Linked Lists → `references/arrays-linkedlists.md`
- Stack y Queue (LIFO/FIFO) → `references/stack-queue.md`
- Hash Tables → `references/hash-tables.md`
- Árboles → `references/trees.md`
- Grafos → `references/graphs.md`

## Reglas de oro

### 1. Nunca busques en un array si puedes usar un Map
```js
// ❌ ANTES — O(n) en cada búsqueda
const user = users.find(u => u.id === targetId);

// ✅ DESPUÉS — O(1)
const userMap = new Map(users.map(u => [u.id, u]));
const user = userMap.get(targetId);
```

### 2. Usa Set para deduplicar y verificar existencia
```js
// ❌ ANTES — O(n) por verificación
if (!seen.includes(item)) seen.push(item);

// ✅ DESPUÉS — O(1)
const seen = new Set();
if (!seen.has(item)) seen.add(item);
```

### 3. Stack para operaciones reversibles (undo/redo)
```js
// ✅ Patrón undo con Stack
const undoStack = [];
const redoStack = [];

function doAction(action) {
  action.execute();
  undoStack.push(action);
  redoStack.length = 0; // clear redo on new action
}

function undo() {
  const action = undoStack.pop(); // LIFO
  action.rollback();
  redoStack.push(action);
}
```

### 4. Queue para procesar en orden (FIFO)
```js
// ✅ Queue para requests, notificaciones, tasks
class Queue {
  constructor() { this.items = []; this.head = 0; }
  enqueue(item) { this.items.push(item); }
  dequeue() { return this.items[this.head++]; } // O(1) sin shift()
  get size() { return this.items.length - this.head; }
}
```

> ⚠️ **Nunca uses `array.shift()`** para simular una queue — es O(n). Usa un pointer o una librería.

## Formato de respuesta

Al optimizar código siempre muestra:

```
### Diagnóstico
- Problema detectado: [descripción]
- Complejidad actual: O(?)
- Complejidad optimizada: O(?)

### Código optimizado
[código con comentarios explicando cada cambio]

### Por qué esta estructura
[explicación breve del trade-off]
```

## Casos de uso frecuentes en apps web

- **Autocompletado / search**: Trie o Map indexado
- **Rutas de navegación**: Grafo con BFS/DFS
- **Menú / estructura de carpetas**: Árbol N-ario
- **Historial del browser / undo**: Stack
- **Cola de notificaciones**: Queue
- **Cache de resultados API**: Map con TTL (LRU Cache)
- **Filtros de tags únicos**: Set
- **Permisos y roles anidados**: Árbol de herencia
- **Algoritmo de pathfinding (mapas)**: Grafo + Dijkstra / A*
