# Handover Guide — Workout Logger

This document is for a Replit agent (or developer) picking up this project in a **new Replit account** after importing the zip export. It explains how to bootstrap the project, reconnect account-specific integrations, and continue working — including pushing changes to the existing Railway deployment.

For deep technical reference (DB schema, API routes, frontend pages/hooks, build pipeline), see `replit.md` after completing the setup below.

---

## TL;DR — What's portable vs. what isn't

**Portable (travels in the zip):**
- All source code (`artifacts/`, `lib/`, `scripts/`)
- `Dockerfile`, `start.sh`, `railway.json`, `pnpm-workspace.yaml`, `package.json`
- `replit.md` (technical reference) and this `HANDOVER.md`

**NOT portable (must be reconnected/recreated in the new account):**
- Replit PostgreSQL database (must be provisioned fresh)
- Replit Secrets (`SESSION_SECRET`, `RESEND_API_KEY`, etc.)
- Replit GitHub connector (must be reauthorized to the same repo)
- Workflows (Replit recreates these from `.replit` / artifacts on import, but verify them)
- Railway access (the new owner must be added as a collaborator on the existing Railway project, OR ownership must be transferred)

---

## Step 1 — Import the project

Two options, both work:

**Option A: Import the zip**
1. In the new Replit account, create a new Repl from the zip file.
2. Replit unpacks the codebase and detects it as a pnpm monorepo.

**Option B: Clone from GitHub** (preferred if you want git history)
1. In the new Replit account, create a new Repl from `https://github.com/Palaz01/workout-logger`.
2. The GitHub connector still needs to be authorized separately (see Step 4).

After import, run `pnpm install` from the project root if dependencies aren't auto-installed.

---

## Step 2 — Provision PostgreSQL on Replit

The project requires a PostgreSQL database for development.

1. In the Replit workspace, open the **Database** tool and create a PostgreSQL database. Replit will set `DATABASE_URL` automatically as an environment variable.
2. Verify the env var exists by opening **Secrets** in the Replit UI.
3. Push the schema to the new DB:
   - The first time the API server workflow runs, the connection will be live but the tables won't exist.
   - Easiest path: use the **Database** tool's schema management, OR ask the agent to run `pnpm --filter @workspace/db exec drizzle-kit push --config ./drizzle.config.ts` once.
   - All schema definitions live in `lib/db/src/schema/`. See `replit.md` → "Database Schema" for the table list.

---

## Step 3 — Add Replit Secrets

Open the **Secrets** tool in the Replit UI and add the following. **Never paste secrets in chat or edit config files directly — always use the Secrets UI.**

| Secret | Value | Notes |
|---|---|---|
| `DATABASE_URL` | (auto-set by Replit DB tool) | Don't set manually if the DB tool created it |
| `SESSION_SECRET` | Long random string | Used to sign session cookies. Generate any random ~32+ char string. |
| `RESEND_API_KEY` | Resend API key | Get from https://resend.com → API Keys. Required even in dev for email features to work. |
| `WEB_BASE_URL` | The Replit dev domain | For dev, set to your `*.replit.dev` URL. Used by email links (verification, invites). |
| `RESEND_FROM_EMAIL` | (Optional) Sender address | Defaults to `onboarding@resend.dev`. Only change if you have a verified custom domain in Resend. |

---

## Step 4 — Reconnect integrations

Replit integrations are account-scoped and do NOT carry over from the zip.

### GitHub connector
1. In the Replit workspace, open the **Integrations** panel and add the **GitHub** connector.
2. Authorize access to `Palaz01/workout-logger` (or whichever fork the new owner uses).
3. The agent pushes commits using the connector via `listConnections('github')` in the code execution sandbox, with the blob → tree → commit → ref-update pattern (GitHub Git Data API). **Do NOT use git CLI for pushes** — the user's convention is connector-based pushes only.

### Resend
1. The `RESEND_API_KEY` from Step 3 is enough for the API to call Resend.
2. **Important caveat:** without a verified custom domain in Resend, the only sender allowed is `onboarding@resend.dev`, and emails can only be delivered to the Resend account owner's email. This is fine for development but limits multi-user testing. For real production multi-user email, verify a custom domain in Resend and set `RESEND_FROM_EMAIL` accordingly.

---

## Step 5 — Verify workflows

After importing, the project should have three workflows configured:

| Workflow | Command | Purpose |
|---|---|---|
| `artifacts/api-server: API Server` | `pnpm --filter @workspace/api-server run dev` | Express backend |
| `artifacts/workout-tracker: web` | `pnpm --filter @workspace/workout-tracker run dev` | React + Vite frontend |
| `artifacts/mockup-sandbox: Component Preview Server` | `pnpm --filter @workspace/mockup-sandbox run dev` | Design preview (dev only) |

Restart all three after secrets are in place. The API server will fail to start without `SESSION_SECRET` and `DATABASE_URL`.

---

## Step 6 — (Optional) Seed test users for dev

The production Railway database starts empty — real users register normally. For local dev, you can recreate the test users we use:

- Trainer: `palazoli` (password: `admin`)
- Client: `anna`
- Organization: "Default Gym"

These can be created either by registering via the UI, or by running the seed script in `scripts/src/seed-trainer.ts`.

---

## Step 7 — Take over the Railway deployment

The app is deployed on Railway and auto-deploys from the `main` branch of `Palaz01/workout-logger`. To take over the existing deployment without disrupting users:

1. **Get Railway access** — either:
   - Be added as a collaborator on the existing Railway project, OR
   - Have the previous owner transfer the Railway project to the new owner's Railway account.

2. **Verify Railway environment variables** in the Railway dashboard (Settings → Variables). These should already exist; just confirm them:

   | Variable | Notes |
   |---|---|
   | `DATABASE_URL` | Railway Postgres addon connection string (do not change) |
   | `SESSION_SECRET` | Production session secret (do not regenerate — it would log everyone out) |
   | `RESEND_API_KEY` | Production Resend key |
   | `NODE_ENV` | `production` |
   | `PORT` | Set automatically by Railway |
   | `WEB_BASE_URL` | The public Railway URL (e.g. `https://your-app.up.railway.app`) — used for email links |
   | `RESEND_FROM_EMAIL` | (Optional) custom sender if a domain is verified in Resend |

3. **Verify auto-deploy** — Railway is set to build from `Dockerfile` with health check `/api/healthz`. Confirm in Railway Settings that the GitHub repo is connected and auto-deploy on push to `main` is enabled.

4. **Test the deploy pipeline** with a small commit:
   - Make a trivial doc edit (e.g. add a line to this file).
   - Use the GitHub connector to push to `main`.
   - Watch Railway redeploy automatically.
   - Once the deploy is green, `/api/healthz` should return 200.

5. **Production startup behavior** — on every Railway deploy, `start.sh` runs:
   1. `drizzle-kit push --force` (schema sync; uses `--force` to skip prompts)
   2. Session table creation (if missing)
   3. Snapshot backfill migration (idempotent — fills history snapshot columns for any sessions that predate the snapshot feature)
   4. Starts the Node server

   This means schema changes pushed to `main` will sync to the production DB automatically. **Be careful with destructive schema changes** — `--force` will apply them.

---

## Current project state (as of this handover)

### Major features completed
- **Auth** — Registration, login, logout, email verification via Resend
- **Multi-tenancy** — Organization-scoped data isolation; every query filters by `organization_id`
- **RBAC** — Trainer vs. client roles with different UI affordances
- **PersonSwitcher** — Trainers can view the app "as" any client in their org (passes `?userId=` to API)
- **Exercise library** — CRUD for org-scoped exercises with measurement types (reps, time, etc.)
- **Plan builder** — Workout plans with straight sets, supersets, trisets, rounds, rest seconds
- **Plan assignments** — Many-to-many between plans and users
- **Session logging** — Step-by-step guided workout flow with weight + value entry
- **Last Stats** — Shows previous session's stats for the same exercise (matched by `exerciseId`, survives plan restructuring)
- **Set notes** — Per-set notes during a session, shown in Last Stats modal
- **History** — Monthly-grouped list of past sessions; detail view with full breakdown
- **Log past workout** — Backfill a session with a custom date
- **Invitations** — Trainers email-invite new users (trainer or client role) via tokenized links
- **Snapshot / history preservation** — Completed sessions store snapshot copies of plan/exercise names, so deleting/renaming a plan or exercise doesn't lose historical context. Session FKs use `ON DELETE SET NULL`.
- **PWA support** — `manifest.json`, icons, theme color, installable on iOS home screen

### Recent task history (most recent first)
- **#38** — Comprehensive rewrite of `replit.md` (~250 lines) as the canonical technical reference
- **#37** — Last Stats modal shows previous session's set note; added subtle Last Stats link on exercise screen badge row
- **#36** — Fixed Last Stats matching to use `exerciseId` instead of `planSetId` (survives plan restructuring)
- **#35** — Snapshot/history preservation system for sessions (SET NULL FKs + snapshot columns + backfill)
- **#34** — PWA icon and manifest for iPhone home screen installation

### Known limitations / gotchas
- **Resend custom domain:** With only the default `onboarding@resend.dev` sender, emails can only be delivered to the Resend account owner. For real multi-user email, verify a custom domain in Resend.
- **Controlled/uncontrolled React input warning** on the session logging page — cosmetic only, no functional impact.
- **`drizzle-kit push --force`** in `start.sh` — fast and convenient, but can apply destructive schema changes silently. For large schema migrations, consider doing them manually first.
- **Session table** is created outside Drizzle (in `start.sh`). If Drizzle ever drops it, `start.sh` recreates it on next startup.
- **esbuild allowlist** — new API dependencies are externalized by default. They work at runtime (the Docker image has `node_modules`), but adding them to the allowlist in `artifacts/api-server/build.ts` reduces cold start times.

---

## Working conventions (please follow these)

These are the user's preferences — keep working this way for a consistent experience:

- **Language:** User speaks **Hungarian**; the app UI is **English**. Reply to the user in Hungarian.
- **No CLI or config-file editing from the user side.** Everything must be click-based. The user uses the Replit UI for secrets, DB, integrations, deploys — never the shell.
- **Iterative delivery.** Ship working features incrementally rather than big-bang rewrites.
- **Ask before major architectural changes.** Small features and bug fixes — just do them. Schema redesigns, swapping major libraries, broad refactors — confirm first.
- **GitHub pushes:** always use the Replit GitHub connector (`listConnections('github')` + Git Data API blob/tree/commit pattern). Never `git push` from the shell.
- **`replit.md` is the canonical technical reference.** Keep it up to date when schema, routes, or deployment behavior changes.

---

## Where to look first when making changes

| Change | Start here |
|---|---|
| New API endpoint | `lib/api-spec/openapi.yaml` → run codegen → implement handler in `artifacts/api-server/src/routes/` |
| Schema change | `lib/db/src/schema/` (Drizzle), then `pnpm --filter @workspace/db exec drizzle-kit push` |
| New frontend page | `artifacts/workout-tracker/src/pages/` (and register the route in the router) |
| New React Query hook | `artifacts/workout-tracker/src/hooks/use-*.ts` |
| Production startup logic | `start.sh` |
| Docker build | `Dockerfile` |
| Railway config | `railway.json` |
| Auth middleware / public paths | `artifacts/api-server/src/middlewares/auth.ts` |
| Session store config | `artifacts/api-server/src/app.ts` |

See `replit.md` for the full file map and architectural details.

---

## Quick smoke test after setup

Once everything is wired up:

1. The three workflows start cleanly (no errors in logs).
2. Browser preview loads the login page.
3. Register a new trainer account → email verification link appears (check Resend dashboard if delivery is restricted to the account owner).
4. Log in → land on the plans list.
5. Create an exercise → create a plan with that exercise → start a session → log a set → complete the session.
6. Open History → see the completed session.
7. (For Railway takeover) Make a trivial doc commit via the GitHub connector → watch Railway redeploy → confirm `/api/healthz` returns 200.

If all 7 pass, the handover is complete and the new agent can continue where we left off.
