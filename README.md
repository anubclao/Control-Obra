# Control de Obra Pro

Sistema ERP para la gestión integral de proyectos de construcción.

**Stack:** Next.js 14 · TypeScript · Tailwind CSS · shadcn/ui

**Estado:** Esqueleto UI sin base de datos (Fase 1).

## Comandos

```bash
npm run dev      # Servidor de desarrollo (http://localhost:3000)
npm run build    # Build de producción
npm run start    # Servidor de producción
npm run lint     # Lint
```

## Estructura

```
src/
├── app/                    # Rutas (App Router)
│   ├── (auth)/            # Login, registro
│   ├── (dashboard)/       # Layout autenticado + áreas
│   │   ├── tecnico/
│   │   ├── administrativo/
│   │   └── ventas/
│   └── layout.tsx
├── components/             # Componentes UI reutilizables
│   └── ui/                # shadcn/ui components
├── lib/                    # Utilidades, helpers
├── mocks/                  # Datos de prueba (mientras no hay BD)
└── types/                  # TypeScript types
```

## Áreas

- **Técnico** — Proyectos, presupuestos, AIU, contratos, subcontratistas, cortes, bitácora, programación
- **Administrativo** — Tesorería, pagos, reportes, impuestos, RRHH, administración
- **Ventas** — CRM, clientes, cotizaciones, pipeline

## Roles

ADMIN, GERENTE, DIRECTOR, RESIDENTE, CONTABILIDAD, TESORERIA, HSEQ, CLIENTE, USER
