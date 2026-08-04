# Environment & Architecture

## Tech Stack
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript (strict mode)
- **Styling:** TailwindCSS
- **State Management:** React Context / Zustand
- **AI Integration:** MiniMax-M3 API
- **Testing:** Vitest, React Testing Library, Playwright
- **Package Manager:** pnpm

## Directory Structure
```
/src
  /app              # Next.js App Router pages
  /components       # Reusable UI components
  /services         # API calls and business logic
  /hooks            # Custom React hooks
  /utils            # Helper functions
  /types            # TypeScript type definitions
/docs
  /env              # Environment and architecture docs
  /specs            # Feature specifications
/tests
  /verifiers        # Test files (TDD approach)
```

## Key Patterns
1. **Server Components:** Use for data fetching and static content
2. **Client Components:** Use for interactivity (add 'use client' directive)
3. **API Routes:** Use `/src/app/api/` for backend endpoints
4. **Service Layer:** All AI calls go through `/src/services/ai.ts`
5. **Type Safety:** All components and functions must be fully typed
