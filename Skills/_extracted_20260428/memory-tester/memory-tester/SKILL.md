---
name: memory-tester
description: |
  Skill de memoria persistente para control de prompts, bitácora de correcciones de código y prevención de errores repetidos. Usa esta skill SIEMPRE que el usuario esté depurando código (debug), corrigiendo errores de compilación, haciendo push a repositorios, iterando sobre código con ajustes repetidos, o cuando mencione que ya corrigió algo antes. También úsala cuando el usuario diga "ya te dije", "esto ya lo corregimos", "no repitas el error", "recuerda que", "lleva un registro", "bitácora", "memoria de cambios", o cuando detectes que Claude está a punto de repetir un ajuste o error que ya ocurrió en la conversación. Esta skill actúa como tester inteligente en memoria: registra cada corrección, busca patrones de error, y evita regresiones.
---

# Memory Tester — Skill de Memoria y Bitácora de Código

## Propósito

Esta skill convierte a Claude en un **tester con memoria persistente** dentro de la sesión. Su trabajo es:

1. **Registrar** cada corrección de código, ajuste de prompt o fix aplicado
2. **Buscar** en la bitácora antes de proponer soluciones para no repetir errores
3. **Detectar** errores de compilación y corregirlos usando el historial
4. **Alertar** cuando se está a punto de repetir un error ya documentado
5. **Mantener** el contexto de ajustes para no pedir al usuario que repita instrucciones

---

## Activación Automática

Esta skill se activa cuando:
- El usuario corrige código por segunda vez o más
- Aparece un error de compilación o runtime
- El usuario menciona "ya lo corregimos", "recuerda que", "otra vez el mismo error"
- Se detecta un patrón de error ya registrado en la bitácora
- Se va a hacer un `git push` o deploy

---

## Estructura de la Bitácora en Memoria

Mantén siempre en tu contexto activo esta estructura. Actualízala en CADA iteración:

```
BITÁCORA DE MEMORIA — SESIÓN ACTIVA
=====================================
[PROMPT_CONTEXT]
- Ajustes de instrucciones ya dados: []
- Restricciones confirmadas: []
- Preferencias del usuario: []

[ERRORES_REGISTRADOS]
- ID: ERR-001
  Tipo: (compilación | runtime | lógico | lint | test)
  Descripción: ...
  Archivo/Línea: ...
  Causa raíz: ...
  Fix aplicado: ...
  Estado: (resuelto | recurrente | pendiente)

[CORRECCIONES_DE_CÓDIGO]
- ID: FIX-001
  Fecha_relativa: (inicio | hace N turnos)
  Archivo: ...
  Qué cambió: ...
  Por qué: ...
  No_repetir: (descripción del anti-patrón)

[AJUSTES_DE_PROMPTS]
- Instrucción dada: ...
  Vigente: (sí | no)
  Razón: ...

[ESTADO_ACTUAL]
- Último error activo: ...
- Próximo paso acordado: ...
- Advertencias activas: []
```

---

## Flujo de Trabajo

### Al recibir código para revisar o debuggear:

1. **ANTES de proponer cualquier fix** → Busca en `[ERRORES_REGISTRADOS]` y `[CORRECCIONES_DE_CÓDIGO]`
2. Si encuentras un match → **Alerta al usuario**: "⚠️ Este error ya ocurrió (ERR-XXX). El fix anterior fue: ..."
3. Si el fix anterior no funcionó → Escala la solución, no repitas lo mismo
4. Aplica el fix → Registra en la bitácora con nuevo ID
5. **Después de cada fix** → Verifica que no rompa correcciones anteriores (regresión)

### Al detectar error de compilación:

```
PROTOCOLO DE COMPILACIÓN
─────────────────────────
1. Identificar tipo de error (sintaxis, tipos, imports, dependencias)
2. Buscar en bitácora: ¿Ya vimos este error?
   → SÍ: Mostrar fix anterior + razón por la que recurrió
   → NO: Analizar, proponer fix, registrar
3. Aplicar corrección mínima (no reescribir lo que funciona)
4. Confirmar que el fix no introduce regresión
5. Actualizar [ERRORES_REGISTRADOS]
```

### Al hacer push / deploy:

```
CHECKLIST PRE-PUSH (desde bitácora)
─────────────────────────────────────
□ ¿Todos los ERR con estado "resuelto"?
□ ¿Hay FIX pendientes de verificar?
□ ¿Los ajustes de prompt están aplicados?
□ ¿Se aplicaron las restricciones del usuario?
□ ¿Hay advertencias activas que bloqueen el push?
```

---

## Reglas de No-Repetición

Claude debe seguir estas reglas al usar esta skill:

| Situación | Acción |
|-----------|--------|
| Ajuste de prompt ya dado | No pedirlo de nuevo. Buscarlo en `[AJUSTES_DE_PROMPTS]` |
| Error ya corregido que vuelve | Marcarlo como "recurrente", escalar solución |
| Fix propuesto = fix anterior fallido | Bloquearlo y proponer alternativa |
| Usuario dice "ya te lo dije" | Reconocer, registrar, no volver a omitirlo |
| Error de compilación conocido | Aplicar fix documentado directamente |

---

## Formato de Respuesta con Memoria Activa

Cuando la skill esté activa, **comienza cada respuesta relevante con un bloque de estado**:

```
🧠 MEMORIA ACTIVA
├── Errores en bitácora: N
├── Fixes aplicados: N  
├── Ajustes de prompt vigentes: N
└── Advertencias: [lista o "ninguna"]
```

Luego procede con el análisis o fix.

---

## Anti-Patrones Conocidos (Registrar siempre)

Al documentar un error, incluye el **anti-patrón** para detección futura:

- **Imports circulares**: Registrar el par de módulos involucrados
- **Variables no inicializadas**: Registrar el nombre de variable y scope
- **Tipos incompatibles**: Registrar la conversión que falló
- **Dependencias faltantes**: Registrar el paquete y versión correcta
- **Lógica de negocio incorrecta**: Registrar la regla de negocio correcta

---

## Instrucciones de Actualización de Bitácora

La bitácora se mantiene **en el contexto de la conversación**. Claude debe:

1. **Al inicio de sesión**: Inicializar bitácora vacía y anunciarlo
2. **Después de cada fix**: Actualizar el registro correspondiente
3. **Si el usuario corrige a Claude**: Registrar en `[AJUSTES_DE_PROMPTS]` inmediatamente
4. **Cada 5 turnos**: Mostrar resumen compacto de bitácora si hay entradas activas
5. **Al detectar recurrencia**: Emitir alerta visible antes de cualquier otra cosa

---

## Referencia Rápida de Comandos

El usuario puede invocar comandos especiales:

| Comando | Acción |
|---------|--------|
| `"muestra bitácora"` | Mostrar toda la bitácora actual |
| `"resumen de errores"` | Solo errores y su estado |
| `"qué correcciones hicimos"` | Solo FIX aplicados |
| `"limpia bitácora"` | Resetear (pedir confirmación) |
| `"estado del push"` | Ejecutar checklist pre-push |
| `"errores recurrentes"` | Listar solo los marcados como recurrentes |

---

## Integración con Flujos de Desarrollo

Ver `references/integration-patterns.md` para patrones de integración con:
- Git / GitHub Actions
- Python / Node.js / Rust / Go
- Frameworks de testing (pytest, jest, cargo test)
- Linters y formateadores

---

## Notas Importantes

- La bitácora **vive en la conversación**: se pierde al cerrar el chat (esto es esperado)
- Para persistencia entre sesiones, el usuario puede pedir `"exportar bitácora"` y se genera un bloque de texto para guardar
- Esta skill **no reemplaza** tu sistema de control de versiones — lo complementa
- Si hay contradicción entre la bitácora y el código actual, **priorizar el código actual** y actualizar la bitácora
