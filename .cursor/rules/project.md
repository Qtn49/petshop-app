# Petshop App — Cursor Rules

## Stack
- Next.js 14 App Router · TypeScript · Tailwind CSS
- Supabase (PostgreSQL + Storage) · Vercel deployment
- Square API · Anthropic API · OpenAI API
- Functional components only · async/await · no raw promises
- ESLint + Prettier enforced

## Conventions
- All API routes in src/app/api/[route]/route.ts
- Reusable components in src/components/
- Lib utilities in src/lib/
- Types in src/types/
- Never use class components
- Always handle loading + error states
- Console.log with emoji prefix for debugging (keep existing pattern)

## URLs
- Every entity must have a slug and follow the pattern: /[slug]/[page]
- Example: /dashboard, /invoices/[id], /aquariums/[slug]

## Critical
- Never break existing Square integration
- Never break existing Supabase auth (PIN system)
- Always keep existing invoice_items / invoices table structure
- ANTHROPIC_API_KEY is already in .env