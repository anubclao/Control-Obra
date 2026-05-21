# Arrays vs Linked Lists

## ¿Cuándo usar Array?
- Acceso aleatorio por índice es frecuente
- Tamaño relativamente estático
- Iteración secuencial predomina
- Memoria contigua beneficia al CPU cache

## ¿Cuándo usar Linked List?
- Inserción/eliminación frecuente al inicio o medio
- Tamaño desconocido o muy variable
- No necesitas acceso aleatorio

## Complejidades comparadas

| Operación | Array | Linked List |
|-----------|-------|-------------|
| Acceso por índice | O(1) | O(n) |
| Búsqueda | O(n) | O(n) |
| Insertar al final | O(1) amortizado | O(1) con tail pointer |
| Insertar al inicio | O(n) | O(1) |
| Insertar en medio | O(n) | O(1) con pointer previo |
| Eliminar al inicio | O(n) | O(1) |
| Memoria | Contigua, eficiente | Fragmentada + overhead punteros |

## Implementación Linked List en JS

```js
class Node {
  constructor(value) {
    this.value = value;
    this.next = null;
  }
}

class LinkedList {
  constructor() {
    this.head = null;
    this.tail = null;
    this.size = 0;
  }

  append(value) {               // O(1)
    const node = new Node(value);
    if (!this.tail) {
      this.head = this.tail = node;
    } else {
      this.tail.next = node;
      this.tail = node;
    }
    this.size++;
  }

  prepend(value) {              // O(1)
    const node = new Node(value);
    node.next = this.head;
    this.head = node;
    if (!this.tail) this.tail = node;
    this.size++;
  }

  removeFirst() {               // O(1)
    if (!this.head) return null;
    const value = this.head.value;
    this.head = this.head.next;
    if (!this.head) this.tail = null;
    this.size--;
    return value;
  }

  toArray() {                   // O(n)
    const result = [];
    let current = this.head;
    while (current) {
      result.push(current.value);
      current = current.next;
    }
    return result;
  }
}
```

## Ejemplo real: lista de reproducción / playlist

```js
// ✅ Linked List para playlist con inserción frecuente
class Playlist {
  constructor() { this.list = new LinkedList(); }

  addSong(song) { this.list.append(song); }        // O(1)
  addNext(song) { this.list.prepend(song); }       // O(1) — "reproducir después"
  nextSong() { return this.list.removeFirst(); }   // O(1)
}
```

## Doubly Linked List — para navegar en ambas direcciones

```js
class DNode {
  constructor(value) {
    this.value = value;
    this.prev = null;
    this.next = null;
  }
}
// Útil para: editores de texto, historial con forward/back
```
