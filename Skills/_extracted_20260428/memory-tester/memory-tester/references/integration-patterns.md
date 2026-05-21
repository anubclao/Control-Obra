# Integration Patterns — Memory Tester

## Python

### Errores de compilación frecuentes y sus fixes documentados

```
ERR-TYPE: SyntaxError
Pattern: "invalid syntax" en línea X
Causas comunes: 
  - Paréntesis no cerrados
  - Indentación mixta (tabs + espacios)
  - f-strings mal formateadas
Fix: Revisar línea X-1 (el error suele estar una línea antes)
Anti-patrón: No mezclar tabs y espacios → usar `autopep8` o `black`

ERR-TYPE: ImportError / ModuleNotFoundError
Pattern: "No module named 'X'"
Fix documentado: pip install X (verificar entorno virtual activo)
Anti-patrón: Instalar en el entorno global cuando hay venv activo

ERR-TYPE: TypeError
Pattern: "X() takes N positional arguments but M were given"
Fix: Revisar firma de función vs. llamada
Anti-patrón: Cambiar firma sin actualizar todos los call sites
```

### Checklist pre-push Python
```
□ pytest pasa sin errores
□ No hay `print()` de debug sin comentar
□ requirements.txt actualizado
□ Variables de entorno documentadas
□ Type hints consistentes si el proyecto los usa
```

---

## JavaScript / Node.js

### Errores frecuentes

```
ERR-TYPE: ReferenceError
Pattern: "X is not defined"
Fix: Verificar scope, imports, o typo en nombre
Anti-patrón: Usar variables antes de declararlas (var hoisting)

ERR-TYPE: TypeError: Cannot read property 'X' of undefined
Fix: Agregar null check o optional chaining (?.)
Anti-patrón: Asumir que fetch/async siempre retorna datos válidos

ERR-TYPE: Module not found
Pattern: "Cannot find module './X'"
Fix: Verificar path relativo y extensión del archivo
Anti-patrón: Olvidar la extensión en imports de archivos locales
```

### Checklist pre-push JS/TS
```
□ npm test pasa
□ npm run build sin warnings
□ No hay console.log de debug
□ .env.example actualizado si se agregaron vars
□ package-lock.json incluido en commit
```

---

## Rust

### Errores frecuentes

```
ERR-TYPE: borrow checker
Pattern: "cannot borrow X as mutable because it is also borrowed as immutable"
Fix: Reestructurar el scope del borrow o usar clone()
Anti-patrón: Clonar innecesariamente — primero entender el lifetime

ERR-TYPE: lifetime
Pattern: "missing lifetime specifier"
Fix: Agregar 'a a referencias en structs/funciones
Anti-patrón: Ignorar los lifetimes hasta el final del desarrollo

ERR-TYPE: type mismatch
Pattern: "expected X, found Y"
Fix: Verificar conversiones con .into(), as, o From/Into traits
```

### Checklist pre-push Rust
```
□ cargo test pasa
□ cargo clippy sin warnings
□ cargo fmt aplicado
□ No hay unwrap() sin justificación en código de producción
```

---

## Go

### Errores frecuentes

```
ERR-TYPE: unused import / variable
Pattern: "X declared and not used"
Fix: Remover o usar la variable/import
Anti-patrón: Dejar imports comentados — Go no lo permite

ERR-TYPE: nil pointer dereference
Fix: Verificar nil antes de acceder a campos de struct
Anti-patrón: Retornar structs sin inicializar
```

---

## Git / GitHub Actions

### Pre-push checklist universal
```
□ git status limpio (no hay archivos sin commitear que debían ir)
□ Branch name sigue convención del proyecto
□ Commit messages son descriptivos
□ No hay secrets/API keys en el código
□ CI/CD local simulation pasa (si aplica)
```

### Errores de Actions frecuentes
```
ERR-TYPE: secrets not found
Fix: Verificar que el secret está definido en Settings > Secrets
Anti-patrón: Hardcodear valores que deberían ser secrets

ERR-TYPE: permission denied
Fix: Verificar `permissions` en el workflow YAML
Anti-patrón: Asumir que el token tiene todos los permisos
```

---

## Frameworks de Testing

### pytest
```
Comandos útiles para debug:
  pytest -x          → parar en primer fallo
  pytest -s          → mostrar prints
  pytest -v          → verbose
  pytest --tb=short  → traceback corto
```

### Jest
```
Comandos útiles:
  jest --watch       → modo interactivo
  jest --verbose     → detalles por test
  jest --coverage    → reporte de cobertura
```

### cargo test (Rust)
```
Comandos útiles:
  cargo test -- --nocapture   → mostrar println!
  cargo test nombre_test      → correr un test específico
```
