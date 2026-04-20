<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Hundred and Ten Web Frontend

## Stack

- Next.js 16, React 19, TypeScript, Tailwind CSS v4
- Firebase auth (client-side only, Google sign-in)

## Project Structure

- `app/` at repo root (no `src/` directory)
- `components/` for shared UI components
- `lib/` for API client, hooks, and utilities
- `docs/solutions/` — documented solutions to past problems, organized by category with YAML frontmatter (`module`, `tags`, `problem_type`)
- Path alias: `@/*` maps to `./*`

## Commands

```bash
npm run dev        # Start dev server
npm run build      # Build for deployment
npm run lint       # ESLint check
npm run lint:fix   # ESLint autofix
npm run clean      # Remove .next and out directories
```

## Conventions

- SSR by default; add `'use client'` only to components that use hooks or event handlers (not pure display components)
- API base URL from `NEXT_PUBLIC_API_URL` env var (never hardcoded)
- Auth tokens managed in-memory by Firebase SDK
- Tailwind v4 configured via CSS (`@import 'tailwindcss'` + `@theme` in `app/globals.css`), not `tailwind.config.js`
- PostCSS plugin: `@tailwindcss/postcss`
- ESLint 9 flat config with prettier
- Mobile-first design — 44px minimum touch targets, horizontal scroll for card hand

## API Patterns

- Backend at `NEXT_PUBLIC_API_URL`, all endpoints scoped under `/players/{player_id}/...`
- Search endpoints are POST with JSON body `{ searchText, offset, limit }`
- Action/start endpoints return `Event[]`, not updated game — must re-fetch after
- Backend enforces all authorization; frontend role checks are cosmetic

## Testing

- Unit tests required for API client (`lib/api/client.ts`) and polling hook (`lib/hooks/use-polling.ts`)
- Type checking: `npx tsc --noEmit`
- Build verification: `npm run build` must produce `.next/` directory
