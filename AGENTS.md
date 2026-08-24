# pixel-marketplace

## Cursor Cloud specific instructions

This repository now contains a Next.js App Router application, Drizzle/Neon
database model, Stripe Checkout integration, Canvas 2D client, and automated
tests.

The base Cloud Agent VM already provides common toolchains, so no extra system
setup is needed to begin development here: Node 22 (`npm`, `pnpm`), Python 3.12,
Go 1.22, Rust 1.83, JDK 21, and Docker.

Use Node 22 and `npm ci` for dependencies. Common commands:

- `npm run dev` — local Next.js server
- `npm run lint` — ESLint
- `npm run typecheck` — strict TypeScript
- `npm test` — Vitest unit/property tests
- `npm run test:db` — real Postgres integration tests when `TEST_DATABASE_URL` is set
- `npm run test:e2e` — Playwright desktop/mobile tests
- `npm run build` — production build
- `npm run db:migrate` — apply the hand-authored PostgreSQL migration

The home page can render without environment values, but its manifest displays
an unavailable state. Checkout and server data paths require the values
documented in `.env.example`. Never point `TEST_DATABASE_URL` at production.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
