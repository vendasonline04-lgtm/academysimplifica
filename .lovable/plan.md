## Problem

Clicking "Ver como Aluno" (or opening any `/modulos/:id` URL without `?aula=...`) crashes with:

```
ZodError: expected nonoptional, received undefined  (path: "aula")
```

The route renders the global "This page didn't load" fallback instead of the lesson UI.

## Root cause

In `src/routes/_app/modulos.$id.tsx`:

```ts
const searchSchema = z.object({
  aula: fallback(z.string().optional(), undefined),
});
```

With the current Zod version, `fallback(..., undefined)` produces a non-optional schema, so when `aula` is absent the search-param validator throws and TanStack Router's `VALIDATE_SEARCH` error bubbles up to the root catch boundary — the module page never renders.

## Fix

Replace the search schema with a plain optional string (no `fallback` wrapper):

```ts
const searchSchema = z.object({
  aula: z.string().optional(),
});
```

That's the only change needed. The rest of the page already handles `aulaParam` being `undefined` (it auto-selects the first lesson).

## Technical notes

- File touched: `src/routes/_app/modulos.$id.tsx` (lines 21 area only).
- No changes to `AppSidebar` "Ver como Aluno" link — it correctly points to `/dashboard`; the crash happened because the user was already on a `/modulos/:id` URL with no `aula` search param.
- No DB, auth, or admin-flow changes.
