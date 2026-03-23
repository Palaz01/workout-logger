# Workout Tracker

## Overview

Workout Tracker is a mobile-first web application designed for creating workout plans and logging exercise sessions. It aims to provide a comprehensive tool for users to manage their fitness routines, track progress, and review historical workout data. The project emphasizes a clean, intuitive user experience and robust data management, built to support both individual users and trainers managing multiple clients within a multi-tenant architecture.

## User Preferences

I prefer iterative development, with a focus on delivering working features incrementally. Please prioritize clear, concise communication and detailed explanations when necessary. I value maintainable code written with best practices. I am open to suggestions for improvements or alternative approaches, but please ask before making major architectural changes.

## System Architecture

The project is structured as a pnpm workspace monorepo, utilizing TypeScript for type safety across all components.

**UI/UX Decisions:**
- **Mobile-first design:** Frontend is built with React and Vite, styled using Tailwind CSS, ensuring responsiveness across devices.
- **Navigation:** Uses a bottom navigation bar with tabs for Plans, History, and Exercises. Trainers also have a "Users" tab.
- **Interaction patterns:** Includes a "Person Switcher" component for trainers to manage different users, bottom sheets for selections, and clear confirmation dialogs for destructive actions.
- **Design consistency:** Adheres to a clean, modern aesthetic with clear visual hierarchy.

**Technical Implementations:**
- **Monorepo:** pnpm workspaces facilitate shared code and consistent dependency management.
- **Backend:** Express 5 API server handles all business logic and data persistence.
- **Frontend:** React with Vite for fast development and optimized builds, leveraging React Query for efficient data fetching and caching.
- **Database:** PostgreSQL is used as the primary data store, with Drizzle ORM providing a type-safe interface for database interactions.
- **Authentication:** Session-based authentication using `express-session` and `connect-pg-simple`, with `bcryptjs` for password hashing. `trust proxy` is set to `1` for production (Replit's HTTPS reverse proxy).
- **Multi-tenancy:** Core architectural decision where each trainer registration creates a new `organization`, and all content tables are scoped by `organization_id`.
- **API Design:** RESTful API with Zod for validation and Orval for generating API clients and schemas from an OpenAPI specification, ensuring type safety between frontend and backend.
- **Role-Based Access Control (RBAC):** Differentiates between 'trainer' and 'client' roles, impacting UI visibility (e.g., person switcher, edit/delete actions, navigation tabs) and API access.
- **Workout Session Logging:** Implements a step-by-step guided workout flow with real-time logging, "Last Stats" display, and flexible session completion/cancellation.
- **Historical Data:** Comprehensive history tracking for sessions, with detailed review pages and options for deleting historical records.
- **Retroactive Logging:** Allows logging past workouts with a date picker, seamlessly integrating into the history.
- **TypeScript:** Extensive use of TypeScript across the entire stack for improved code quality and maintainability.
- **Build System:** `esbuild` for efficient JavaScript bundling, with `tsc --build --emitDeclarationOnly` for type-checking and declaration file generation.

**Key Features:**
- **Exercise Management:** Create, edit, and delete exercises with various measurement types.
- **Workout Plan Builder:** Construct complex workout plans including straight sets, supersets, and trisets with specified rounds and target values.
- **Workout Session Logging:** Guided, step-by-step logging of active workouts, including weight and value tracking.
- **Workout History & Review:** Detailed chronological history of completed sessions with full breakdown of logged data.
- **User Management:** Trainers can manage clients, invite new users, and update user profiles.
- **Auth & User Roles:** Secure authentication, multi-user support with client/trainer roles, and a person switcher for trainers.
- **Email Verification:** New user registrations require email verification before login. Verification emails sent via Resend. Unverified users see a 403 error on login with option to resend. Existing users (pre-feature) are marked as verified.
- **Invite Emails:** Trainer-created invitations automatically send email to the invitee via Resend with a link to accept. Accepted invitations mark the user as email-verified.
- **Log Past Workout:** Capability to log workouts that occurred on a previous date.

## External Dependencies

- **Database:** PostgreSQL
- **ORM:** Drizzle ORM
- **Frontend Framework:** React
- **Build Tools:** Vite, esbuild
- **Styling:** Tailwind CSS
- **API Framework:** Express 5
- **Data Fetching/State Management (Frontend):** React Query
- **Validation:** Zod
- **API Code Generation:** Orval (from OpenAPI spec)
- **Session Management:** `express-session`, `connect-pg-simple`
- **Password Hashing:** `bcryptjs`
- **Email:** Resend (`resend` npm package) — lazy-initialized, requires `RESEND_API_KEY` secret. `RESEND_FROM_EMAIL` optional (defaults to `onboarding@resend.dev`). `WEB_BASE_URL` optional env var for email link generation.