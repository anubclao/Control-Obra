# Reglas detalladas de gestión de contexto en Claude Code

## Umbrales de intervención

| % Contexto usado | Estado | Acción recomendada |
|-----------------|--------|-------------------|
| 0–40% | 🟢 Saludable | Continuar normalmente |
| 40–60% | 🟡 Monitorear | Considerar compact al finalizar fase |
| 60–70% | 🟠 Atención | `/compact` proactivo ANTES de nueva tarea |
| 70–80% | 🔴 Urgente | `/compact` inmediato con instrucción específica |
| >80% | ⛔ Crítico | Auto-compact inminente; calidad degradada |

**Umbral oficial de auto-compact**: ~80-90% (varía por versión del CLI).
**Recomendación práctica**: actuar a los 60-70% para que el compact corra con buen headroom.

---

## Caché de prompts: cómo aprovecharlo

Claude Code usa caché de prompts automáticamente para contenido repetido (CLAUDE.md,
system prompts, definiciones de tools). Para aprovecharlo:

- **Coloca el contenido estático al inicio**: system prompts, CLAUDE.md, instrucciones fijas
- **El contenido dinámico va al final**: el mensaje del usuario, contexto variable
- La caché se invalida cuando cambia cualquier bloque anterior al breakpoint
- Cada `/clear` o compactación puede invalidar partes de la caché → tiene costo de re-escritura

### Cuando NO limpiar el caché innecesariamente
- Si tienes un CLAUDE.md largo y el proyecto es el mismo, el caché ahorra tokens en cada turno
- Cambiar de proyecto = nuevo caché = costo de entrada más alto en las primeras solicitudes

---

## Qué hace `/compact` internamente

1. Claude lee TODO el historial de conversación actual
2. Genera un resumen condensado (decisiones, código cambiado, estado de la tarea)
3. Reemplaza la conversación completa con ese resumen como nuevo punto de partida
4. El nuevo contexto es ~10-20% del tamaño original

**Costo**: Se factura como una solicitud sobre el contexto completo actual.
**Por eso**: Compactar a 60% es más barato que a 90%, y produce mejores resúmenes.

### Customizar qué preserva el compact

En CLAUDE.md puedes agregar:
```markdown
## Instrucciones de compactación
Cuando hagas /compact, preserva siempre:
- Lista completa de archivos modificados en esta sesión
- Comandos de test y cómo correrlos
- Cualquier decisión de arquitectura tomada
- El estado actual de cada módulo en progreso
```

O en el momento del compact:
```
/compact Preserve the full list of modified files, test commands, and current API endpoint decisions
```

---

## `/compact` vs `/clear`: tabla de decisión

| Criterio | `/compact` | `/clear` |
|---------|-----------|---------|
| Preserva contexto | ✅ Resumen | ❌ Nada |
| Recuperable | ✅ El resumen queda | ❌ No |
| Cuándo usar | Tarea continúa | Cambio total de tema |
| Costo | Moderado (compact call) | Cero |
| Riesgo | Bajo | Alto si no guardaste nada |
| CLAUDE.md necesario antes | Opcional | ✅ Recomendado siempre |

---

## `/rewind` + "Summarize from here": compact parcial

Útil cuando solo quieres compactar una parte de la conversación:

1. Presiona `Esc + Esc` o escribe `/rewind`
2. Selecciona el checkpoint (mensaje) desde donde quieres compactar
3. Elige "Summarize from here"
4. Condensa desde ese punto hacia adelante, manteniendo lo anterior intacto

Ideal para: "El debug de esta función ya terminó, compacta esa parte pero mantén el contexto del diseño general."

---

## Heurísticas de tiempo

- **Cada 30-45 minutos** de trabajo activo → revisar contexto y compactar si aplica
- **Al finalizar cada milestone** (función completa, bug cerrado, PR listo) → compact o clear
- **Antes de cerrar la sesión** → siempre hacer handoff: actualizar CLAUDE.md + compact

---

## Gestión de MCP servers

Los MCP servers cargan definiciones de herramientas que consumen tokens en cada request.

```bash
/mcp          # Ver todos los MCP servers activos
# Desactiva los que no necesitas para la tarea actual
```

Regla: solo activa los MCP servers que vas a usar en la sesión actual.

---

## Estrategia de lectura de archivos

Claude Code puede leer archivos enteros, pero eso consume mucho contexto.
Prioridad de herramientas para minimizar tokens:

```bash
# 1. Búsqueda primero
rg "función que busco"          # grep recursivo
rg -l "patrón"                  # solo nombres de archivos

# 2. Vista parcial
head -50 archivo.ts             # primeras 50 líneas
tail -30 archivo.ts             # últimas 30 líneas
sed -n '100,150p' archivo.ts    # líneas 100-150

# 3. Solo si es necesario: leer el archivo completo
```

Instrucción a Claude: "Usa rg y head/tail para explorar antes de leer archivos completos."

---

## Recuperación cuando el contexto ya se degradó

Si Claude ya está mostrando síntomas de saturación:

```
1. /compact (si hay >10% de contexto libre)
2. Si el compact no ayuda: actualizar CLAUDE.md con el estado actual
3. /clear para reset total
4. Retomar con: "Continúa el trabajo en [módulo]. 
   El estado actual está en CLAUDE.md. 
   Los archivos modificados hasta ahora son: [lista]"
```

---

## El comando `/btw`: preguntas sin contaminar el contexto

Para preguntas rápidas que no deben quedar en el historial:

```
/btw ¿qué hace exactamente Array.prototype.flat?
/btw ¿cuál es la diferencia entre useEffect y useLayoutEffect?
```

La respuesta aparece en un overlay temporal. No entra al historial de conversación.
Perfecto para consultas de referencia que no son parte de la tarea actual.
