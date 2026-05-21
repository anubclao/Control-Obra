# Árboles (Trees)

## Tipos de árboles y sus usos en apps web

| Tipo | Uso principal |
|------|--------------|
| Árbol N-ario | Menús, carpetas, DOM, comentarios anidados |
| BST (Binary Search Tree) | Datos ordenados + búsqueda rápida |
| Trie | Autocompletado, búsqueda de prefijos |
| Heap | Priority queue, scheduling |
| Segment Tree | Queries sobre rangos (analytics, juegos) |

---

## Árbol N-ario — Menús y estructuras jerárquicas

```js
class TreeNode {
  constructor(data) {
    this.data = data;
    this.children = [];
  }

  addChild(node) {
    this.children.push(node);
    return this;
  }
}

// Ejemplo: árbol de menú de navegación
const menu = new TreeNode({ label: 'Root' });
const products = new TreeNode({ label: 'Productos', path: '/products' });
const electronics = new TreeNode({ label: 'Electrónica', path: '/products/electronics' });
const phones = new TreeNode({ label: 'Teléfonos', path: '/products/electronics/phones' });

menu.addChild(products);
products.addChild(electronics);
electronics.addChild(phones);

// Recorrer en profundidad (DFS) — para renderizar menú
function renderMenu(node, depth = 0) {
  console.log('  '.repeat(depth) + node.data.label);
  for (const child of node.children) {
    renderMenu(child, depth + 1);
  }
}
```

### Comentarios anidados (Reddit-style)

```js
function buildCommentTree(comments) {
  const map = new Map(comments.map(c => [c.id, { ...c, children: [] }]));
  const roots = [];

  for (const comment of map.values()) {
    if (comment.parentId) {
      map.get(comment.parentId)?.children.push(comment);
    } else {
      roots.push(comment);
    }
  }
  return roots; // O(n) — sin recursión costosa
}
```

---

## BST — Binary Search Tree

Mantiene los datos ordenados. Búsqueda, inserción, eliminación en **O(log n)** promedio.

```js
class BSTNode {
  constructor(value) {
    this.value = value;
    this.left = null;
    this.right = null;
  }
}

class BST {
  constructor() { this.root = null; }

  insert(value) {
    const node = new BSTNode(value);
    if (!this.root) { this.root = node; return; }
    let current = this.root;
    while (true) {
      if (value < current.value) {
        if (!current.left) { current.left = node; return; }
        current = current.left;
      } else {
        if (!current.right) { current.right = node; return; }
        current = current.right;
      }
    }
  }

  search(value) {              // O(log n)
    let current = this.root;
    while (current) {
      if (value === current.value) return current;
      current = value < current.value ? current.left : current.right;
    }
    return null;
  }

  // Recorrido inorder = valores ordenados
  inorder(node = this.root, result = []) {
    if (!node) return result;
    this.inorder(node.left, result);
    result.push(node.value);
    this.inorder(node.right, result);
    return result;
  }
}
```

---

## Trie — Autocompletado y búsqueda de prefijos

**O(m)** para inserción y búsqueda, donde m = longitud del string.

```js
class TrieNode {
  constructor() {
    this.children = new Map();
    this.isEnd = false;
    this.data = null; // metadata del término
  }
}

class Trie {
  constructor() { this.root = new TrieNode(); }

  insert(word, data = null) {   // O(m)
    let node = this.root;
    for (const char of word.toLowerCase()) {
      if (!node.children.has(char)) {
        node.children.set(char, new TrieNode());
      }
      node = node.children.get(char);
    }
    node.isEnd = true;
    node.data = data;
  }

  search(word) {                // O(m) exacto
    let node = this.root;
    for (const char of word.toLowerCase()) {
      if (!node.children.has(char)) return null;
      node = node.children.get(char);
    }
    return node.isEnd ? node.data : null;
  }

  autocomplete(prefix, limit = 10) {  // O(m + k) donde k = resultados
    let node = this.root;
    for (const char of prefix.toLowerCase()) {
      if (!node.children.has(char)) return [];
      node = node.children.get(char);
    }
    const results = [];
    this._collect(node, prefix.toLowerCase(), results, limit);
    return results;
  }

  _collect(node, prefix, results, limit) {
    if (results.length >= limit) return;
    if (node.isEnd) results.push({ word: prefix, data: node.data });
    for (const [char, child] of node.children) {
      this._collect(child, prefix + char, results, limit);
    }
  }
}

// Uso en barra de búsqueda:
const searchTrie = new Trie();
products.forEach(p => searchTrie.insert(p.name, p));

searchInput.addEventListener('input', (e) => {
  const suggestions = searchTrie.autocomplete(e.target.value, 5);
  renderSuggestions(suggestions);
});
```

---

## Min-Heap — Priority Queue

Para procesar elementos por prioridad (notificaciones urgentes, tareas críticas).

```js
class MinHeap {
  constructor() { this.heap = []; }

  push(item) {
    this.heap.push(item);
    this._bubbleUp(this.heap.length - 1);
  }

  pop() {
    if (this.heap.length === 1) return this.heap.pop();
    const min = this.heap[0];
    this.heap[0] = this.heap.pop();
    this._sinkDown(0);
    return min;
  }

  get size() { return this.heap.length; }
  peek() { return this.heap[0]; }

  _bubbleUp(i) {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.heap[parent] <= this.heap[i]) break;
      [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
      i = parent;
    }
  }

  _sinkDown(i) {
    const n = this.heap.length;
    while (true) {
      let min = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this.heap[l] < this.heap[min]) min = l;
      if (r < n && this.heap[r] < this.heap[min]) min = r;
      if (min === i) break;
      [this.heap[i], this.heap[min]] = [this.heap[min], this.heap[i]];
      i = min;
    }
  }
}

// Priority Queue para notificaciones
class PriorityNotifications extends MinHeap {
  push({ priority, message }) {
    super.push([priority, message]); // menor número = mayor prioridad
  }
  pop() { return super.pop()?.[1]; }
}
```
