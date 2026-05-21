# Grafos (Graphs)

## ¿Cuándo usar un grafo en una app web?

- Redes sociales (amigos, seguidores, relaciones)
- Sistemas de rutas / navegación (mapas, GPS)
- Dependencias entre módulos o tareas
- Recomendaciones ("usuarios que compraron X también compraron Y")
- Permisos y roles con herencia
- Flujos de trabajo (pipelines, workflows)
- Detección de ciclos (validar formularios multi-paso)

## Representaciones

### Lista de adyacencia (recomendada para grafos dispersos)

```js
class Graph {
  constructor(directed = false) {
    this.adjacency = new Map();
    this.directed = directed;
  }

  addNode(node) {
    if (!this.adjacency.has(node)) {
      this.adjacency.set(node, new Map()); // Map para pesos
    }
  }

  addEdge(from, to, weight = 1) {
    this.addNode(from);
    this.addNode(to);
    this.adjacency.get(from).set(to, weight);
    if (!this.directed) {
      this.adjacency.get(to).set(from, weight);
    }
  }

  getNeighbors(node) {
    return this.adjacency.get(node) ?? new Map();
  }

  hasEdge(from, to) {
    return this.adjacency.get(from)?.has(to) ?? false;
  }
}
```

---

## BFS — Breadth-First Search (niveles/distancia mínima)

**Usa Queue. Ideal para:**
- Camino más corto en grafo no ponderado
- Encontrar todos los amigos de amigos (social graph)
- Recorrer menús / DOM por niveles

```js
function bfs(graph, start) {
  const visited = new Set();
  const queue = [start];     // usar Queue eficiente en producción
  const order = [];

  visited.add(start);

  while (queue.length > 0) {
    const node = queue.shift(); // ⚠️ O(n) — ver nota abajo
    order.push(node);

    for (const [neighbor] of graph.getNeighbors(node)) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return order;
}

// ⚠️ Para grafos grandes, usar Queue eficiente en vez de array.shift()
```

### Camino más corto BFS

```js
function shortestPath(graph, start, end) {
  const visited = new Set([start]);
  const queue = [[start, [start]]]; // [nodo, camino]

  while (queue.length > 0) {
    const [node, path] = queue.shift();
    if (node === end) return path;

    for (const [neighbor] of graph.getNeighbors(node)) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([neighbor, [...path, neighbor]]);
      }
    }
  }
  return null; // sin camino
}
```

---

## DFS — Depth-First Search (exploración profunda)

**Usa Stack (o recursión). Ideal para:**
- Detección de ciclos
- Topological sort (dependencias)
- Encontrar componentes conectados
- Backtracking (puzzles, laberintos)

```js
function dfs(graph, start, visited = new Set()) {
  visited.add(start);
  const order = [start];

  for (const [neighbor] of graph.getNeighbors(start)) {
    if (!visited.has(neighbor)) {
      order.push(...dfs(graph, neighbor, visited));
    }
  }
  return order;
}

// Detectar ciclo (útil en formularios multi-paso, pipelines)
function hasCycle(graph) {
  const WHITE = 0, GRAY = 1, BLACK = 2; // no visitado, en proceso, completado
  const color = new Map();
  for (const node of graph.adjacency.keys()) color.set(node, WHITE);

  function dfsCheck(node) {
    color.set(node, GRAY);
    for (const [neighbor] of graph.getNeighbors(node)) {
      if (color.get(neighbor) === GRAY) return true;  // ciclo!
      if (color.get(neighbor) === WHITE && dfsCheck(neighbor)) return true;
    }
    color.set(node, BLACK);
    return false;
  }

  for (const node of graph.adjacency.keys()) {
    if (color.get(node) === WHITE && dfsCheck(node)) return true;
  }
  return false;
}
```

---

## Dijkstra — Camino más corto ponderado

Para rutas con costos (tiempo, distancia, prioridad).

```js
function dijkstra(graph, start) {
  const dist = new Map();
  const prev = new Map();
  const unvisited = new Set();

  for (const node of graph.adjacency.keys()) {
    dist.set(node, Infinity);
    unvisited.add(node);
  }
  dist.set(start, 0);

  while (unvisited.size > 0) {
    // Obtener nodo no visitado con menor distancia
    let current = null;
    for (const node of unvisited) {
      if (current === null || dist.get(node) < dist.get(current)) {
        current = node;
      }
    }

    if (dist.get(current) === Infinity) break;
    unvisited.delete(current);

    for (const [neighbor, weight] of graph.getNeighbors(current)) {
      const newDist = dist.get(current) + weight;
      if (newDist < dist.get(neighbor)) {
        dist.set(neighbor, newDist);
        prev.set(neighbor, current);
      }
    }
  }

  return { dist, prev };
}

function getPath(prev, end) {
  const path = [];
  let current = end;
  while (current !== undefined) {
    path.unshift(current);
    current = prev.get(current);
  }
  return path;
}

// Uso: rutas entre ciudades, entre páginas de un wizard, entre nodos de workflow
const g = new Graph(true);
g.addEdge('login', 'dashboard', 1);
g.addEdge('dashboard', 'products', 2);
g.addEdge('dashboard', 'checkout', 5);
g.addEdge('products', 'checkout', 1);

const { dist, prev } = dijkstra(g, 'login');
console.log(getPath(prev, 'checkout')); // ['login', 'dashboard', 'products', 'checkout']
```

---

## Ejemplo real: Red social / sistema de recomendaciones

```js
class SocialGraph extends Graph {
  constructor() { super(false); } // no dirigido

  follow(user, target) { this.addEdge(user, target); }
  unfollow(user, target) { this.adjacency.get(user)?.delete(target); }

  // Amigos de amigos (sugerencias)
  suggestFriends(user, limit = 5) {
    const friends = new Set(this.getNeighbors(user).keys());
    const suggestions = new Map();

    for (const friend of friends) {
      for (const [fof] of this.getNeighbors(friend)) {
        if (fof !== user && !friends.has(fof)) {
          suggestions.set(fof, (suggestions.get(fof) ?? 0) + 1);
        }
      }
    }

    return [...suggestions.entries()]
      .sort((a, b) => b[1] - a[1])   // más amigos en común primero
      .slice(0, limit)
      .map(([user]) => user);
  }

  // Grados de separación (Kevin Bacon problem)
  degreesOfSeparation(from, to) {
    const path = shortestPath(this, from, to);
    return path ? path.length - 1 : -1;
  }
}
```

## Complejidades

| Algoritmo | Tiempo | Espacio | Cuándo usarlo |
|-----------|--------|---------|---------------|
| BFS | O(V + E) | O(V) | Camino más corto sin pesos |
| DFS | O(V + E) | O(V) | Exploración, ciclos, toposort |
| Dijkstra | O((V + E) log V) | O(V) | Camino más corto con pesos |
| A* | O(E) | O(V) | Pathfinding con heurística |

V = vértices, E = aristas
