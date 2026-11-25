# Technology stack

Status: proposed choices, not proof of installation. Keep npm. Adopt only when needed; track actual progress in MIGRATION_CHECKLIST.md.

| Layer | Choice | Priority |
|---|---|---|
| Language/runtime | TypeScript, Node.js LTS compatible with dependencies | Keep |
| Web | React + Vite now; Next.js target | Incremental |
| Mobile | React Native + Expo, Expo Location, EAS | Product priority |
| API | NestJS + Fastify, REST/OpenAPI, modular monolith | Foundation |
| Data | Supabase PostgreSQL, PostGIS, Drizzle where justified | Keep/add |
| Auth/storage/realtime | Supabase Auth, Storage, Realtime as needed | Keep |
| Migrations/tests | Supabase CLI SQL, pgTAP | Keep |
| Images | Sharp or managed transforms | Launch |
| Web/API hosting | Vercel / Railway | Foundation |
| Containers | Docker, Compose, GHCR as needed | Foundation |
| Monorepo | npm workspaces, Turborepo | Foundation |
| Maps/transit | Google Maps Platform, MBTA API | Keep |
| UI | Tailwind, shadcn/Radix; native StyleSheet | Keep/add |
| State/validation | TanStack Query, Zustand when needed, Zod | As needed |
| Search | PostgreSQL full-text + PostGIS | As needed |
| Monitoring/logs | Sentry, Pino | Launch |
| Analytics/flags | PostHog | Launch |
| Email/push | Resend, Expo Notifications | As needed |
| Testing | Vitest/Jest, Bruno, Playwright, Maestro | Incremental |
| CI/CD | GitHub Actions, Dependabot | Foundation |
| DNS | Cloudflare | As needed |
| AI | Vercel AI SDK + OpenRouter candidates; model TBD | Benchmark first |
| Deferred | R2, Redis, BullMQ, workers, pgvector, Stripe, dedicated search | Demand-driven |

Use existing Vite until a Next.js migration solves a real need; native beta can precede web cutover. No Kubernetes or microservices initially.

Actual installed/locked versions, runtime requirements and missing target tooling are recorded in [BASELINE.md](BASELINE.md). Existing telemetry is Vercel Analytics; target PostHog/Sentry are not installed. Turborepo is optional (M05), not a prerequisite for the workspace move.
