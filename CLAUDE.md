# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Start dev server on 0.0.0.0
npm run build        # Production build
npm run lint         # ESLint
npm test             # Run tests with Vitest

# Database migrations
npm run db:push:dev  # Push migrations to dev Supabase
npm run db:push:prod # Push migrations to prod Supabase
npm run db:push:all  # Push to both environments
```

## Architecture Overview

**Pet Shop Management SaaS** — multi-tenant Next.js 14 App Router app where each organization gets a `/[slug]/` URL prefix.

### Multi-Tenant Routing

- **Public routes**: `/`, `/login`, `/register`, `/onboarding`, `/connect`
- **Tenant routes**: `/[slug]/...` — all protected by middleware
- `src/middleware.ts` validates: (1) slug exists in DB, (2) device token (30-day JWT) for `/[slug]/select-user`, (3) session token (8-hour JWT) for all other tenant routes
- Middleware sets `x-organization-id`, `x-organization-slug`, `x-user-id` request headers
- `src/app/[slug]/layout.tsx` loads the organization from DB and provides it via `OrganizationContext`
- `src/app/[slug]/(app)/` is the app shell group — all pages here get `AppLayout` (sidebar + navbar)

### Authentication

PIN-based (4–6 digits), not password-based:
- `src/lib/auth/jwt-session.ts` — JWT signing/verification (HS256, `JWT_SECRET` env var, min 32 chars)
  - Device tokens: 30 days, cookie `ps_device_<slug>`
  - Session tokens: 8 hours, cookie `ps_session_<slug>`
- `src/lib/auth/device-session.ts` — localStorage cache (`petshop_session_<slug>`) for client-side access
- `src/lib/auth/pin.ts` — bcrypt PIN hashing (10 rounds), validates 4–6 digit format
- `src/lib/auth/client-auth.ts` — `switchUserSession()` and `signOutFromDevice()` utilities
- Auth flow: select-user page → PIN entry → session token issued → access granted

### Database (Supabase PostgreSQL)

All tables have RLS enabled. Key tables:
- `organization` — tenants; `slug` column drives URL routing
- `users` — PIN-based auth with `role: admin | staff`, FK to `organization_id`
- `invoices` / `invoice_items` — uploaded files (PDF/Excel/CSV) with AI-parsed line items
- `day_tasks` — calendar tasks with `frequency: once | daily | weekly | monthly`
- `tasks` — general to-do list
- `tanks` / `tank_events` — aquarium management
- `square_connections` — Square OAuth tokens per org
- `sku_mapping` — vendor SKU ↔ Square catalog mapping per org
- `chat_conversations` / `chat_messages` — chatbot history

Migrations live in `supabase/migrations/`. The latest (`20260322120000_multitenant.sql`) added slug-based routing and SKU mapping.

### External Integrations

- **Square** (`src/app/api/square/`): OAuth 2.0 flow, catalog sync, purchase order generation. Never break the Square OAuth callback or `invoice_items`/`invoices` table structure.
- **Anthropic Claude** (`src/lib/invoice/parseWithClaude.ts` + chatbot): Invoice parsing via `ANTHROPIC_API_KEY`. The README mentions OpenAI but the code uses Anthropic SDK.
- **Supabase Storage**: Invoice file uploads

### State Management

React Context providers (applied in `src/app/layout.tsx`):
- `AuthContext` — current user, `loginWithUserId()`, fetches `/api/auth/me`
- `OrganizationContext` — current tenant (id, company_name, slug, currency)
- `SidebarContext` — sidebar open/close state
- `CalculatorContext` — floating calculator visibility
- `QueryProvider` — React Query (TanStack Query)

### Key Conventions

- Path alias: `@/*` → `src/*`
- API routes in `src/app/api/`; all protected routes read org/user from request headers set by middleware
- Tenant-aware links use `useTenantHref` hook (`src/hooks/useTenantHref.ts`) to prefix paths with `/[slug]`
- Functional components only, async/await throughout
- Tailwind primary color is amber (`#f59e0b`), sidebar background is deep brown (`#1C1008`)
