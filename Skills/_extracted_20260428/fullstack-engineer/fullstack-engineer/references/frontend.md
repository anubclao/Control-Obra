# Frontend Reference

## Frameworks y Cuándo Usar Cada Uno

### React / Next.js
- **React puro**: SPAs con estado complejo, cuando ya existe el backend por separado.
- **Next.js**: Apps con SSR/SSG, SEO importante, full-stack con API Routes.
- Patrones clave: hooks personalizados, context API, React Query/SWR para server state, Zustand/Redux para estado global complejo.

### Vue / Nuxt
- **Vue 3 + Composition API**: Componentes interactivos, equipos con experiencia en Vue.
- **Nuxt**: SSR/SSG equivalente a Next.js en el ecosistema Vue.
- Patrones: `<script setup>`, composables, Pinia para estado.

### Svelte / SvelteKit
- Ideal para performance máxima con bundle mínimo.
- SvelteKit para full-stack.

### Astro
- Contenido estático + islas de interactividad.
- Multi-framework: mezcla React, Vue, Svelte en el mismo proyecto.

### HTML/CSS/JS Vanilla
- Proyectos sin build step, prototipos rápidos, widgets embebibles.
- Usa ES Modules nativos cuando sea posible.

---

## CSS y Estilos

### Tailwind CSS
```html
<!-- Clases utilitarias, mobile-first -->
<div class="flex flex-col md:flex-row gap-4 p-6 bg-white dark:bg-gray-900 rounded-xl shadow-lg">
```

### CSS Modules (React/Next)
```css
/* Button.module.css */
.button { padding: 0.5rem 1rem; border-radius: 0.375rem; }
.primary { background: #3b82f6; color: white; }
```

### CSS Custom Properties para temas
```css
:root { --color-primary: #3b82f6; --spacing-base: 1rem; }
[data-theme="dark"] { --color-primary: #93c5fd; }
```

---

## Performance Web

### Core Web Vitals
- **LCP** (Largest Contentful Paint) < 2.5s: Prioriza imágenes above-the-fold, preload fonts.
- **FID/INP** < 100ms: Evita JavaScript bloqueante en el main thread.
- **CLS** < 0.1: Reserva espacio para imágenes y ads con `aspect-ratio`.

### Lazy Loading
```javascript
// React
const HeavyComponent = React.lazy(() => import('./HeavyComponent'));

// Imágenes HTML
<img src="large.jpg" loading="lazy" decoding="async" />
```

### Bundle Optimization
- Analiza con `webpack-bundle-analyzer` o `vite-plugin-visualizer`.
- Code splitting por rutas es gratuito en Next.js/Nuxt.
- Tree shaking: importa solo lo necesario: `import { debounce } from 'lodash-es'`.

---

## Accesibilidad (a11y)

```html
<!-- Siempre: roles, aria-labels en iconos sin texto, foco visible -->
<button aria-label="Cerrar modal" type="button">
  <XIcon aria-hidden="true" />
</button>

<!-- Formularios con labels asociados -->
<label for="email">Correo electrónico</label>
<input id="email" type="email" autocomplete="email" required />

<!-- Imágenes con alt descriptivo -->
<img src="chart.png" alt="Gráfico de ventas Q3: $2.4M, +15% vs Q2" />
```

---

## Estado y Data Fetching

### React Query / TanStack Query (recomendado para server state)
```javascript
const { data, isLoading, error } = useQuery({
  queryKey: ['users', filters],
  queryFn: () => fetchUsers(filters),
  staleTime: 5 * 60 * 1000, // 5 minutos
});

const mutation = useMutation({
  mutationFn: createUser,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
});
```

### SWR (alternativa más ligera)
```javascript
const { data, error, isLoading } = useSWR('/api/users', fetcher, {
  revalidateOnFocus: false,
  dedupingInterval: 60000,
});
```

---

## Formularios

### React Hook Form + Zod (stack recomendado)
```javascript
const schema = z.object({
  email: z.string().email('Email inválido'),
  age: z.number().min(18, 'Debes ser mayor de edad'),
});

const { register, handleSubmit, formState: { errors } } = useForm({
  resolver: zodResolver(schema),
});
```

---

## Animaciones

### CSS Transitions (preferir para simplicidad)
```css
.card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
.card:hover { transform: translateY(-4px); box-shadow: 0 20px 40px rgba(0,0,0,0.12); }
```

### Framer Motion (React)
```javascript
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0 }}
  transition={{ duration: 0.3 }}
/>
```

---

## Testing Frontend

```javascript
// Vitest + Testing Library (recomendado)
import { render, screen, userEvent } from '@testing-library/react';

test('muestra error cuando el formulario es inválido', async () => {
  render(<LoginForm />);
  await userEvent.click(screen.getByRole('button', { name: /ingresar/i }));
  expect(screen.getByText(/el email es requerido/i)).toBeInTheDocument();
});
```
