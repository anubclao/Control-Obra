# Optimización de caché de prompts en Claude Code (API)

> Esta sección es principalmente para usuarios que usan Claude Code vía API
> o que construyen herramientas sobre la API de Anthropic.
> Si usas Claude Code como CLI interactivo, el caché es automático.

---

## Cómo funciona el prompt caching

La API de Anthropic cachea prefijos de prompts. Si el inicio de tu prompt no cambia
entre requests, se reutiliza el caché y pagas significativamente menos tokens.

**Ahorro típico**: 90% en tokens cacheados (se facturan a 10% del precio normal).

### Orden de cacheo (jerarquía)
```
1. tools (definiciones de herramientas)
2. system (instrucciones del sistema)
3. messages (historial de conversación)
```

El caché se construye de arriba hacia abajo. Cambiar algo arriba invalida todo lo de abajo.

---

## Estrategia básica: cacheo automático

```javascript
const response = await client.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 4096,
  // Agregar cache_control al nivel de la request para cacheo automático
  // El sistema pone el breakpoint en el último bloque cacheável
  messages: conversationHistory,
  // La API mueve el breakpoint automáticamente al crecer la conversación
});
```

---

## Estrategia avanzada: breakpoints explícitos

Para contenido con diferente frecuencia de cambio:

```javascript
// Contenido estático (cambia raramente) → cachear aquí
const systemWithCache = {
  type: "text",
  text: "Eres un experto en TypeScript...",
  cache_control: { type: "ephemeral" }  // TTL: 5 minutos
};

// Herramientas (también estáticas generalmente)
const tools = [
  {
    name: "read_file",
    description: "...",
    // cache_control en la última herramienta del array
    cache_control: { type: "ephemeral" }
  }
];

const response = await client.messages.create({
  model: "claude-sonnet-4-20250514",
  system: [systemWithCache],
  tools: tools,
  messages: [...conversationHistory]
});
```

---

## Limpieza de tool results (Context Editing API)

Para sesiones largas con muchas llamadas a herramientas, los resultados se acumulan.
La API puede limpiarlos automáticamente:

```javascript
const response = await client.beta.messages.create({
  model: "claude-opus-4-7",
  max_tokens: 4096,
  messages: history,
  tools: [...],
  betas: ["context-management-2025-06-27"],
  context_management: {
    edits: [{
      type: "clear_tool_uses_20250919",
      trigger: { type: "input_tokens", value: 30_000 },  // Limpiar al llegar a 30k tokens
      keep: { type: "tool_uses", value: 4 },              // Mantener los 4 más recientes
      clear_at_least: { type: "input_tokens", value: 10_000 }  // Limpiar mínimo 10k tokens
    }]
  }
});
```

### Cuándo usar tool result clearing
- Workflows agenticos con muchas llamadas a herramientas
- Los resultados de búsqueda o lectura de archivos ya fueron procesados
- Necesitas mantener el contexto acotado sin perder el hilo de la conversación

---

## Compactación del lado del cliente (SDK)

Alternativa al clearing: summarizar el historial antes de que crezca demasiado.

```javascript
// Pseudo-código del patrón de compactación manual
async function compactHistory(history, threshold = 0.6) {
  const tokenCount = estimateTokens(history);
  
  if (tokenCount / MAX_CONTEXT > threshold) {
    // Pedir a Claude que resuma el historial
    const summary = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: `Resume esta conversación preservando: decisiones clave, 
                  código escrito, estado actual de la tarea, archivos modificados.
                  Conversación: ${JSON.stringify(history)}`
      }]
    });
    
    // Reemplazar historial con el resumen
    return [{
      role: "assistant", 
      content: `[Resumen de sesión anterior]\n${summary.content[0].text}`
    }];
  }
  
  return history;
}
```

---

## Monitorear el uso del caché

```javascript
// Revisar métricas de caché en cada respuesta
const response = await client.messages.create({...});

console.log({
  input_tokens: response.usage.input_tokens,
  cache_read_tokens: response.usage.cache_read_input_tokens,   // tokens servidos desde caché
  cache_write_tokens: response.usage.cache_creation_input_tokens,  // tokens escritos al caché
  output_tokens: response.usage.output_tokens
});

// Cache hit rate
const hitRate = cache_read_tokens / (input_tokens + cache_read_tokens);
console.log(`Cache hit rate: ${(hitRate * 100).toFixed(1)}%`);
```

---

## Advertencia: caché y clearing

Limpiar tool results puede invalidar prefijos cacheados.
El parámetro `clear_at_least` asegura que se limpien suficientes tokens para que
valga la pena el costo de re-escritura de caché.

**Regla práctica**: si vas a limpiar, limpia suficiente para que el nuevo prefijo
cacheado dure más requests de los que costó la invalidación.
