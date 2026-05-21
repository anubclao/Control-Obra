---
name: claude-code-context-manager
description: >
  Experto en gestión de contexto, caché y rendimiento en Claude Code. Usa este skill
  SIEMPRE que el usuario mencione problemas con contexto largo, conversaciones extensas,
  prompts que consumen mucho espacio, lentitud en Claude Code, necesidad de limpiar
  historial, hacer compact o clear, o cuando notes que el usuario tiene una sesión muy
  larga activa. También actívalo cuando pregunten sobre /compact, /clear, /context,
  CLAUDE.md, caché de prompts, subagentes, tokens, o cómo optimizar Claude Code.
  Si el usuario dice frases como "se está llenando el contexto", "Claude está olvidando
  cosas", "la sesión está muy larga", "cómo limpio el contexto" — usa este skill de
  inmediato. No esperes a que lo pidan explícitamente.
---

# Claude Code Context Manager

Skill para detectar, diagnosticar y resolver problemas de contexto largo en Claude Code,
aplicando las mejores prácticas de gestión de tokens, caché y compactación.

---

## 🔍 Diagnóstico primero: ¿qué está pasando?

Antes de recomendar una acción, identifica el patrón del usuario:

| Señal | Diagnóstico | Acción prioritaria |
|-------|------------|-------------------|
| "Claude olvidó lo que dijimos antes" | Contexto saturado | `/compact` inmediato |
| "La sesión está muy larga" | Acumulación de historial | Evaluar `/compact` vs `/clear` |
| "Voy a cambiar de tarea" | Contexto irrelevante | `/clear` |
| "Claude está lento / inconsistente" | >70% contexto usado | `/compact` proactivo |
| "Cómo veo cuánto contexto tengo" | Monitoreo | `/context` o barra de estado |
| "Se reinicia solo / auto-compact" | Auto-compactación tardía | Enseñar compactación manual |

---

## ⚡ Comandos esenciales (referencia rápida)

```bash
/compact                    # Comprime historial, preserva decisiones clave
/compact Focus on API changes  # Compact con instrucción específica
/clear                      # Borra todo el historial (hard reset, sin recovery)
/context                    # Muestra desglose de tokens usados por categoría
/cost                       # Estimado de costo de la sesión actual
/status                     # Estado de la suscripción / uso
/model                      # Cambiar modelo (Sonnet ↔ Opus)
/btw <pregunta>             # Pregunta rápida sin agregar al contexto
/rewind                     # Retrocede a un checkpoint + opción "Summarize from here"
```

---

## 🧠 Reglas de oro del contexto

Lee `references/context-rules.md` para la guía detallada. Resumen ejecutivo:

### Cuándo hacer `/compact`
- Al llegar al **60-70% de uso** (no esperes al 90%)
- Al terminar una fase del proyecto (función completa, bug resuelto, módulo listo)
- Cada 30-45 minutos de sesión activa
- Antes de iniciar una subtarea compleja

### Cuándo hacer `/clear`
- Al **cambiar completamente de tarea** (el contexto anterior no aporta)
- Cuando el contexto está "envenenado" (Claude contradice decisiones previas)
- Antes de una sesión nueva no relacionada
- ⚠️ **Advertencia**: `/clear` no tiene recovery. Guarda lo importante en `CLAUDE.md` primero.

### Cuándo NO hacer nada
- Estás en medio de un problema complejo y el historial es valioso
- Recién comenzaste la sesión (<30% contexto)
- La tarea es exploratoria y quieres que Claude "vea" el camino recorrido

---

## 📁 CLAUDE.md: memoria persistente

El archivo `CLAUDE.md` en la raíz del proyecto se carga automáticamente en cada sesión.
Es la **única forma de preservar contexto entre sesiones**.

### Estructura recomendada de CLAUDE.md

```markdown
# Proyecto: [nombre]

## Stack y convenciones
- Lenguaje: TypeScript, 2-space indent
- Endpoints: snake_case
- Tests: pnpm test

## Comandos frecuentes
- Dev: pnpm dev
- Build: pnpm build
- Typecheck: pnpm typecheck

## Decisiones arquitectónicas clave
- Usamos composición sobre herencia
- Auth con JWT, no sessions
- La capa de datos va SOLO en /services

## Estado actual del proyecto
- [Actualizar antes de /clear]
- Módulo auth: ✅ completo
- Módulo pagos: 🚧 en progreso

## Instrucciones de compactación
Cuando hagas /compact, preserva siempre:
- Lista completa de archivos modificados
- Comandos de test relevantes
- Decisiones de arquitectura tomadas en esta sesión
```

---

## 🚫 Qué NO hacer (errores comunes)

```
❌ Pegar logs completos en el contexto  →  Filtra solo los errores relevantes
❌ Leer archivos completos grandes       →  Usa rg, head, tail, grep primero
❌ Muchos screenshots a la vez          →  Uno a la vez, cuando sea necesario
❌ CLAUDE.md muy largo                  →  Mantenerlo conciso y actualizado
❌ Demasiados servidores MCP activos    →  Desactiva los que no uses con /mcp
❌ Esperar al 90% para compact          →  Hazlo a los 60-70%
❌ Usar /clear sin guardar nada          →  Siempre actualiza CLAUDE.md antes
❌ Correr todo con Opus en contexto largo →  Usa Sonnet por defecto; Opus solo cuando sea necesario
```

---

## 🤖 Subagentes: delegar sin contaminar el contexto

Los subagentes corren en **ventanas de contexto separadas** y reportan solo resúmenes.
Son ideales para investigación que consumiría mucho contexto principal.

```
# Ejemplos de uso con subagentes
"usa subagentes para investigar cómo funciona el sistema de auth"
"investiga con subagentes qué patrones de OAuth ya tenemos implementados"
"usa subagentes para comparar las librerías X, Y, Z y dame solo el resumen"
```

---

## 📊 Señales de degradación de calidad

Cuando Claude Code muestra estos síntomas, el contexto está saturado:

1. **Olvido activo**: Pide información que ya se dio antes en la sesión
2. **Contradicciones**: Genera código que viola decisiones arquitectónicas previas
3. **Pérdida de estructura**: Olvida la organización de archivos del proyecto
4. **Respuestas genéricas**: Las respuestas se vuelven menos específicas al proyecto
5. **Auto-compact frecuente**: Si se activa solo cada pocos minutos, la sesión está al límite

**Intervenir a los 60%** previene todos estos síntomas.

---

## 🔄 Flujo de decisión rápido

```
¿El contexto está >60%?
├── SÍ → ¿La tarea actual sigue en progreso?
│         ├── SÍ  → /compact (con instrucción si aplica)
│         └── NO  → ¿La próxima tarea es relacionada?
│                   ├── SÍ  → /compact
│                   └── NO  → Actualizar CLAUDE.md → /clear
└── NO → ¿Claude muestra señales de degradación?
          ├── SÍ  → /compact inmediato (independiente del %)
          └── NO  → Continuar normalmente
```

---

## 📚 Referencias adicionales

- `references/context-rules.md` — Guía detallada de reglas y umbrales
- `references/claudemd-templates.md` — Plantillas de CLAUDE.md por tipo de proyecto
- `references/cache-optimization.md` — Optimización de caché de prompts (API)
