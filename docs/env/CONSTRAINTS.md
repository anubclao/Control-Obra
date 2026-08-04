# Project Constraints & Rules

## TypeScript Rules
- ✅ Strict mode enabled (noImplicitAny, strictNullChecks)
- ❌ No `any` types allowed
- ✅ Use interfaces for component props
- ✅ Use type guards for runtime type checking

## Component Rules
- ✅ Functional components only (no class components)
- ✅ Props must be destructured in function signature
- ✅ Keep components under 150 lines (split if larger)

## State Management Rules
- ✅ Use React Context for global state
- ✅ Use Zustand for complex state (if needed)
- ❌ No Redux

## API Rules
- ✅ All API calls go through service layer
- ✅ Use async/await (no .then() chains)
- ✅ Handle errors explicitly
- ✅ Type all API responses

## Testing Rules
- ✅ Write tests BEFORE implementation (TDD)
- ✅ Test all acceptance criteria from Spec
- ✅ Mock external APIs (MiniMax, etc.)

## AI Integration Rules (MiniMax-M3)
- ✅ Abstract all AI calls in /src/services/ai.ts
- ✅ Handle rate limiting and retries
- ✅ Stream responses when possible
- ✅ Show loading states during AI calls
- ✅ Handle API errors gracefully
