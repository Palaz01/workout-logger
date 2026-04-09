# Workout Logger

## Overview

Mobile-first workout tracking web app (English UI) with exercise library, plan builder, step-by-step session logging, history with monthly grouping, and full multi-tenant multi-user support. Trainers manage clients, assign plans, and track progress. Includes authentication, organization-scoped data isolation, and email verification via Resend. Deployed to Railway via Docker.

## User Preferences

- Iterative development, working features delivered incrementally
- Maintainable code with best practices
- Ask before making major architectural changes
- User speaks Hungarian, app UI is in English
- NO command line or config file editing from user side — everything must be click-based
- GitHub pushes use the Replit GitHub connector (blob+tree+commit API pattern via `listConnections('github')`)

## Workspace Structure (pnpm monorepo)

```
├── artifacts/
│   ├── api-server/          # @workspace/api-server — Express 5 backend
│   │   ├── src/
│   │   │   ├── app.ts       # Express app setup, session store, CORS, static serving
│   │   │   ├── index.ts     # Server entry point (listens on PORT)
│   │   │   ├── routes/      # API route handlers (see API Routes below)
│   │   │   ├── middlewares/  # auth.ts — session auth middleware, attaches req.user
│   │   │   └── lib/         # email.ts — Resend email helper
│   │   └── build.ts         # esbuild production bundler (see Build Pipeline)
│   ├── workout-tracker/     # @workspace/workout-tracker — React + Vite frontend
│   │   ├── src/
│   │   │   ├── pages/       # Page components (see Frontend Pages below)
│   │   │   ├── hooks/       # React Query hooks per domain
│   │   │   ├── components/  # Shared UI: Button, Input, Modal, Select, Layout, PersonSwitcher
│   │   │   └── components/ui/ # Lower-level UI primitives
│   │   └── public/          # manifest.json, PWA icons
│   └── mockup-sandbox/      # @workspace/mockup-sandbox — Design preview server (dev only)
├── lib/
│   ├── db/                  # @workspace/db — Drizzle ORM schema + shared pool
│   │   └── src/schema/      # All table definitions (see Database Schema)
│   ├── api-spec/            # @workspace/api-spec — OpenAPI spec + Orval codegen config
│   │   ├── openapi.yaml     # OpenAPI 3.0 specification
│   │   └── orval.config.ts  # Generates api-zod + api-client-react
│   ├── api-zod/             # @workspace/api-zod — Generated Zod schemas from OpenAPI
│   │   └── src/generated/   # Auto-generated, do NOT edit manually
│   └── api-client-react/    # @workspace/api-client-react — Generated React Query hooks
│       └── src/generated/   # Auto-generated, do NOT edit manually
├── Dockerfile               # Multi-stage production build
├── start.sh                 # Production startup: schema push + migrations + server
├── railway.json             # Railway deployment config
└── .dockerignore
```

## Code Generation Pipeline

`lib/api-spec` → `lib/api-zod` → `lib/api-client-react`

1. Edit `lib/api-spec/openapi.yaml` (the OpenAPI spec)
2. Run `pnpm --filter @workspace/api-spec run codegen` to regenerate both `api-zod` and `api-client-react`
3. The generated code in `lib/api-zod/src/generated/` and `lib/api-client-react/src/generated/` should never be edited manually

## Database Schema

PostgreSQL with Drizzle ORM. Schema files in `lib/db/src/schema/`. All IDs are `serial` (auto-increment integer).

### Tables

**organizations** — Multi-tenancy root. One org per trainer registration.
- `id`, `name`, `created_at`

**users** — All users belong to an organization.
- `id`, `organization_id` (FK → organizations, CASCADE), `name`, `email` (unique), `username` (unique), `password_hash`, `role` (enum: trainer/client), `email_verified`, `verification_token` (unique), `verification_token_expires_at`, `created_at`

**exercises** — Exercise definitions scoped to org.
- `id`, `organization_id` (FK → organizations, CASCADE), `name`, `measurement_type` (default: "reps"), `created_at`

**plans** — Workout plan definitions.
- `id`, `organization_id` (FK → organizations, CASCADE), `name`, `created_by` (FK → users, SET NULL), `is_global`, `created_at`, `updated_at`

**plan_assignments** — Links plans to users (many-to-many).
- `id`, `plan_id` (FK → plans, CASCADE), `user_id` (FK → users, CASCADE)
- Unique index on (plan_id, user_id)

**plan_sets** — Sets within a plan (straight, superset, triset).
- `id`, `plan_id` (FK → plans, CASCADE), `type` (default: "straight"), `rounds` (default: 1), `rest_seconds`, `order_index`

**set_exercises** — Exercises within a set.
- `id`, `set_id` (FK → plan_sets, CASCADE), `exercise_id` (FK → exercises, CASCADE), `target_value` (default: "10"), `order_index`

**sessions** — Workout session records. ⚠️ Uses SET NULL FKs for history preservation.
- `id`, `organization_id` (FK → organizations, CASCADE), `plan_id` (FK → plans, **SET NULL**), `user_id` (FK → users, SET NULL), `status` (enum: active/completed/cancelled), `started_at`, `completed_at`, `snapshot_plan_name`

**session_logs** — Individual exercise log entries within a session. ⚠️ Uses SET NULL FKs.
- `id`, `session_id` (FK → sessions, CASCADE), `plan_set_id` (FK → plan_sets, **SET NULL**), `exercise_id` (FK → exercises, **SET NULL**), `round_number`, `weight` (real), `value` (real), `snapshot_exercise_name`, `snapshot_measurement_type`
- Unique index on (session_id, plan_set_id, exercise_id, round_number)

**session_set_notes** — Notes per set within a session.
- `id`, `session_id` (FK → sessions, CASCADE), `plan_set_id` (FK → plan_sets, **SET NULL**), `note`
- Unique index on (session_id, plan_set_id)

**invitations** — Email invitations for new users.
- `id`, `organization_id` (FK → organizations, CASCADE), `email`, `name`, `role` (enum: trainer/client), `token` (unique), `expires_at`, `accepted_at`, `invited_by` (FK → users, SET NULL), `created_at`

**session** (non-Drizzle) — `connect-pg-simple` session store table. Created by `start.sh`, NOT managed by Drizzle.
- `sid` (PK), `sess` (JSON), `expire` (timestamp)

## Snapshot / History Preservation System

**Problem:** When a plan or exercise is deleted/modified, completed session history would lose context.

**Solution:** Session tables use `ON DELETE SET NULL` for plan/exercise FKs, and store snapshot copies of names:
- `sessions.snapshot_plan_name` — plan name at completion time
- `session_logs.snapshot_exercise_name` — exercise name at completion time
- `session_logs.snapshot_measurement_type` — measurement type at completion time

**How it works:**
- On session completion, the API unconditionally writes snapshot values from live data
- When reading completed sessions, the API prefers snapshot values over live (joined) data
- When reading active sessions, the API prefers live data over snapshots
- The "Last Stats" feature matches by `exerciseId` (not `planSetId`) to survive plan restructuring
- `start.sh` runs a backfill migration on every startup to fill snapshots for any sessions that predate this feature

## API Routes

All routes are prefixed with `/api` (configured in `app.ts`). Auth middleware runs on all `/api` routes — public routes (register, login, verify-email, healthz) skip auth internally.

| Route File | Endpoints |
|---|---|
| `health.ts` | `GET /healthz` |
| `auth.ts` | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `GET /auth/verify-email`, `POST /auth/resend-verification` |
| `exercises.ts` | `GET /exercises`, `POST /exercises`, `GET /exercises/:id`, `PUT /exercises/:id`, `DELETE /exercises/:id` |
| `plans.ts` | `GET /plans`, `POST /plans`, `GET /plans/:id`, `PUT /plans/:id`, `DELETE /plans/:id` |
| `sessions.ts` | `GET /sessions`, `POST /sessions`, `GET /sessions/:id`, `PATCH /sessions/:id`, `DELETE /sessions/:id`, `POST /sessions/:id/logs`, `POST /sessions/:id/set-note`, `GET /plans/:id/active-session`, `GET /plans/:id/last-session` |
| `users.ts` | `GET /users`, `POST /users`, `PUT /users/:id`, `DELETE /users/:id` |
| `invitations.ts` | `POST /invitations`, `GET /invitations/:token`, `POST /invitations/:token/accept` |

## Frontend Pages

| File | Route | Description |
|---|---|---|
| `home.tsx` | `/` | Plans list (main page), plan cards with start/edit/delete |
| `plan-detail.tsx` | `/plans/:id` | View plan details (sets, exercises, rounds) |
| `plan-form.tsx` | `/plans/new`, `/plans/:id/edit` | Create/edit workout plans |
| `exercises.tsx` | `/exercises` | Exercise library CRUD |
| `session.tsx` | `/session/:planId` | Step-by-step guided workout logging with Last Stats |
| `session-detail.tsx` | `/sessions/:id` | Review completed session details |
| `history.tsx` | `/history` | Session history with monthly grouping |
| `log-past.tsx` | `/log-past/:planId` | Log a past workout with date picker |
| `users.tsx` | `/users` | User management (trainer only) |
| `login.tsx` | `/login` | Login form |
| `register.tsx` | `/register` | Registration form |
| `verify-email.tsx` | `/verify-email` | Email verification handler |
| `check-email.tsx` | `/check-email` | Post-registration "check your email" page |
| `invite.tsx` | `/invite/:token` | Accept invitation flow |
| `not-found.tsx` | `*` | 404 page |

## Frontend Hooks

Each domain has a dedicated hook file in `artifacts/workout-tracker/src/hooks/`:
- `use-plans.ts` — `usePlans()`, `usePlan(id)`, plan mutations
- `use-exercises.ts` — `useExercises()`, exercise mutations
- `use-sessions.ts` — `useSessionMutations()`, `useLastSession(planId)`, `useActiveSession(planId)`, `useSessions()`
- `use-users.ts` — `useUsers()`, user mutations
- `use-history.ts` — `useHistory()` with monthly grouping
- `use-toast.ts` — Toast notification system
- `use-keyboard-height.ts` — iOS keyboard height detection for mobile UX
- `use-mobile.tsx` — Mobile device detection

## Multi-Tenancy & RBAC

- **Organization scoping:** Every data query filters by `organization_id` from the logged-in user's session. Data is fully isolated between organizations.
- **Trainer role:** Can see all users, switch between users (PersonSwitcher component), create/edit/delete plans and exercises, manage invitations, see Users tab in navigation.
- **Client role:** Can only see their own assigned plans, log workouts, view history. Cannot see PersonSwitcher, Users tab, or edit/delete buttons on plans/exercises.
- **PersonSwitcher:** Trainers can view data "as" any user in their org. The selected user context flows through API calls via `?userId=` query param.

## Session Store

- Uses `connect-pg-simple` with the shared Drizzle `pool` from `@workspace/db` (cast as `pool as any` due to type mismatch)
- The `session` table is NOT managed by Drizzle — it's created by `start.sh` before the server starts
- Do NOT add `createTableIfMissing: true` to PgStore config (it has caused issues)
- `trust proxy` is set to `true` in `app.ts` for production HTTPS behind reverse proxies

## Build Pipeline

### Development
- Frontend: `vite dev` (Vite dev server with HMR)
- Backend: `tsx ./src/index.ts` (TypeScript execution)

### Production Build
- Frontend: `pnpm --filter @workspace/workout-tracker run build` → Vite builds to `artifacts/workout-tracker/dist/`
- Backend: `pnpm --filter @workspace/api-server run build` → runs `build.ts` which uses esbuild
  - **esbuild allowlist pattern:** `build.ts` has an `allowlist` array of packages to bundle into the output. Packages NOT in the allowlist are kept as external requires. If you add a new npm dependency to the API server, check if it needs to be in the allowlist (most do, especially pure-JS packages). `pg` and `connect-pg-simple` MUST be in the allowlist.
  - Output: single `artifacts/api-server/dist/index.cjs` file

### Docker Build (Dockerfile)
Multi-stage build:
1. **deps** — Install all pnpm dependencies
2. **build** — Build frontend + API
3. **production** — Copy only needed files: `lib/db/` (for drizzle-kit), built API (`dist/index.cjs`), built frontend (copied into `artifacts/api-server/dist/public/`), `start.sh`

### start.sh (Production Startup)
Runs in order:
1. `drizzle-kit push` — Syncs Drizzle schema to PostgreSQL (safe, non-destructive)
2. Creates `session` table (for connect-pg-simple) if not exists
3. Runs snapshot backfill migration (adds snapshot columns, changes FKs to SET NULL, backfills snapshot values from live data)
4. Starts Node.js server: `node artifacts/api-server/dist/index.cjs`

## Deployment (Railway)

**GitHub Repo:** `https://github.com/Palaz01/workout-logger`

**Push method:** Use Replit GitHub connector via `listConnections('github')` in code_execution sandbox. Use the blob → tree → commit → ref update pattern (GitHub Git Data API). Do NOT use git CLI.

**Railway config:** Single service, Dockerfile builder, health check at `/api/healthz`.

**Required environment variables:**
| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Railway Postgres addon) |
| `SESSION_SECRET` | Random string for session encryption |
| `RESEND_API_KEY` | For email verification/invite emails |
| `NODE_ENV` | `production` (set by Railway) |
| `PORT` | Set automatically by Railway |
| `WEB_BASE_URL` | Public URL for email links (e.g., `https://your-app.up.railway.app`) |
| `RESEND_FROM_EMAIL` | (Optional) Sender email, defaults to `onboarding@resend.dev` |

**Production static serving:** When `NODE_ENV=production`, `app.ts` serves Vite-built frontend from `PUBLIC_DIR` env var (default: `artifacts/api-server/dist/public`). SPA fallback serves `index.html` for all non-API routes.

## PWA Support

- `manifest.json` in `artifacts/workout-tracker/public/` — app name "Workout Logger", standalone display, blue theme
- Icons: 512px, 192px, 180px (Apple touch) blue dumbbell icons in `public/icons/`
- `index.html` has all PWA meta tags (theme-color, apple-mobile-web-app-capable, etc.)

## Known Limitations & Gotchas

- **Resend email:** Without a custom domain verified in Resend, emails can only be sent FROM `onboarding@resend.dev` and only TO the account owner's email. For production multi-user email, a custom domain must be configured in Resend.
- **Session table:** Managed outside Drizzle. If schema push ever drops it, `start.sh` recreates it.
- **esbuild allowlist:** New API dependencies must be added to the allowlist in `build.ts` or they'll be treated as external (and fail in production since they won't be bundled).
- **Controlled/uncontrolled input warning:** React console shows warnings about controlled/uncontrolled inputs in the session logging page — cosmetic, does not affect functionality.
- **Schema sync:** `drizzle-kit push --force` is used in `start.sh` to avoid interactive prompts in production.

## Seed / Test Data (Replit DB only)

- User: `palazoli` (trainer, password: `admin`)
- User: `anna` (client)
- Organization: "Default Gym"
- These do NOT exist in the Railway production database — production starts empty and users register normally.
