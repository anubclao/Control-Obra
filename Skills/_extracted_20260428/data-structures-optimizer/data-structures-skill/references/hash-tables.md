# Hash Tables (Map, Object, Set)

## ¿Qué son?

Estructuras que mapean claves a valores usando una función hash. Permiten búsqueda, inserción y eliminación en **O(1) promedio**.

## Cuándo usar en apps web

- Índices de búsqueda (buscar usuario por ID, producto por SKU)
- Cache de resultados API (memoización)
- Contar frecuencias (analytics, votos)
- Deduplicación (emails únicos, IDs únicos)
- Configuración dinámica (feature flags)
- Relaciones many-to-one

## Map vs Object vs Set en JavaScript

| | Map | Object | Set |
|--|-----|--------|-----|
| Keys | Cualquier tipo | Solo strings/Symbols | Solo valores únicos |
| Orden | Inserción | No garantizado (moderno: sí) | Inserción |
| Iteración | `.forEach`, `for...of` | `Object.keys()` | `.forEach`, `for...of` |
| Tamaño | `.size` | `Object.keys().length` | `.size` |
| Performance | Mejor para mutación frecuente | Mejor para datos estáticos | Mejor para unicidad |

### Usa **Map** cuando:
- Las claves no son strings (números, objetos)
- Necesitas iterar en orden de inserción garantizado
- Hay muchas inserciones/eliminaciones

### Usa **Object** cuando:
- Las claves son siempre strings conocidos
- Es configuración o datos JSON-like

### Usa **Set** cuando:
- Solo necesitas verificar existencia o unicidad

---

## Patrones comunes

### 1. Indexar array para búsqueda O(1)

```js
// ❌ ANTES — O(n) cada vez
function getUser(id) {
  return users.find(u => u.id === id); // O(n)
}

// ✅ DESPUÉS — O(1) tras indexar
const userIndex = new Map(users.map(u => [u.id, u])); // O(n) una vez

function getUser(id) {
  return userIndex.get(id); // O(1)
}
```

### 2. Memoización / Cache de API

```js
class ApiCache {
  constructor(ttlMs = 60_000) {
    this.cache = new Map();
    this.ttl = ttlMs;
  }

  async get(key, fetchFn) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.data;                     // cache hit O(1)
    }
    const data = await fetchFn();
    this.cache.set(key, { data, timestamp: Date.now() });
    return data;
  }

  invalidate(key) { this.cache.delete(key); }
  clear() { this.cache.clear(); }
}

// Uso:
const cache = new ApiCache(30_000); // 30 segundos TTL
const products = await cache.get('products', () => fetch('/api/products').then(r => r.json()));
```

### 3. Contar frecuencias

```js
// Contar clicks por elemento, votos, ocurrencias de tags
function countFrequency(items) {
  const freq = new Map();
  for (const item of items) {
    freq.set(item, (freq.get(item) ?? 0) + 1);
  }
  return freq;
}

// Obtener top N más frecuentes
function topN(items, n) {
  const freq = countFrequency(items);
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([item, count]) => ({ item, count }));
}
```

### 4. Deduplicar rápidamente

```js
// ❌ ANTES — O(n²)
const unique = items.filter((item, i) => items.indexOf(item) === i);

// ✅ DESPUÉS — O(n)
const unique = [...new Set(items)];

// Para objetos por propiedad:
const uniqueById = [...new Map(items.map(i => [i.id, i])).values()];
```

### 5. Agrupar por propiedad (groupBy)

```js
// O(n) — mucho más rápido que filter() por cada grupo
function groupBy(items, key) {
  return items.reduce((map, item) => {
    const group = item[key];
    if (!map.has(group)) map.set(group, []);
    map.get(group).push(item);
    return map;
  }, new Map());
}

const byCategory = groupBy(products, 'category');
const electronics = byCategory.get('electronics'); // O(1)
```

### 6. LRU Cache (Least Recently Used)

```js
// Para cache con límite de tamaño — O(1) get y set
class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.cache = new Map(); // Map mantiene orden de inserción
  }

  get(key) {
    if (!this.cache.has(key)) return -1;
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value); // mover al final (más reciente)
    return value;
  }

  set(key, value) {
    if (this.cache.has(key)) this.cache.delete(key);
    else if (this.cache.size >= this.capacity) {
      this.cache.delete(this.cache.keys().next().value); // eliminar el más antiguo
    }
    this.cache.set(key, value);
  }
}
```

## Trade-offs

| Ventaja | Desventaja |
|---------|-----------|
| Búsqueda O(1) | Sin orden natural por valor |
| Inserción O(1) | Colisiones pueden degradar a O(n) |
| Eliminación O(1) | Mayor uso de memoria que array |
| Muy flexible | No eficiente para range queries |
