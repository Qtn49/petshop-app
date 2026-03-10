# Pet Shop Management SaaS

A full-stack web application for pet shop management built with Next.js, Tailwind CSS, Supabase, and deployable on Vercel.

**Repository:** [github.com/Qtn49/petshop-app](https://github.com/Qtn49/petshop-app)

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS
- **Database:** Supabase (PostgreSQL)
- **Deployment:** Vercel

## Features

1. **Dashboard** – Calendar with day tasks, to-do list, Outlook quick link, saved links, notifications
2. **Calendar Tasks** – Date-specific tasks with frequency (once, daily, weekly, monthly)
3. **Saved Links** – Save and access supplier URLs
4. **Invoice Upload** – Upload PDF, Excel, CSV invoices
5. **Invoice Parsing** – AI-powered extraction of product name, quantity, price via OpenAI
6. **Square Integration** – OAuth connection, catalog sync, product matching, purchase order creation
7. **Aquarium Management** – Tanks with fish species/count, event logging (deaths, notes)
8. **Floating Calculator** – iPhone-style calculator with percentage support (tablet+)
9. **Settings** – Account management, profile, PIN change

## Authentication

Users log in with a simple 4-digit PIN code.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
OPENAI_API_KEY=your_openai_api_key
SQUARE_APPLICATION_ID=your_square_app_id
SQUARE_APPLICATION_SECRET=your_square_application_secret
NEXT_PUBLIC_SQUARE_ENVIRONMENT=sandbox
SQUARE_REDIRECT_URI=http://localhost:3000/api/square/callback
```

### 3. Supabase setup

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Run the schema in `supabase/schema.sql` in the SQL Editor
3. Run migrations in `supabase/migrations/` if adding to existing schema
4. Create a storage bucket named `invoices` (Dashboard → Storage)
5. Create your first user: `POST /api/auth/setup` with body `{ "pin": "1234" }`

### 4. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
├── app/
│   ├── api/           # API routes
│   │   ├── auth/      # PIN login, setup
│   │   ├── day-tasks/ # Calendar day tasks
│   │   ├── invoices/  # Upload, parse
│   │   ├── square/    # OAuth, catalog, PO
│   │   ├── suppliers/
│   │   ├── tasks/     # To-do list
│   │   ├── tanks/
│   │   ├── notifications/
│   │   └── settings/
│   ├── dashboard/
│   ├── suppliers/
│   ├── invoices/
│   ├── aquariums/
│   └── settings/
├── components/
│   ├── auth/
│   ├── calculator/
│   ├── dashboard/
│   ├── layout/
│   └── ui/
├── contexts/
├── lib/
└── types/
```

## Deployment (Vercel)

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Update `SQUARE_REDIRECT_URI` to your Vercel URL

## Responsive Design

The app is responsive and works on desktop, iPad, and mobile. Mobile uses a bottom navigation bar; desktop uses a collapsible sidebar.
