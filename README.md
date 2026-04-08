# Kindergarten CRM Admin

Admin-first kindergarten CRM built with React, TypeScript, Vite, Tailwind CSS and Supabase.

## Included in this build

- Admin authentication with Supabase email/password
- First-time school bootstrap flow
- Admin dashboard with live counts and operational summaries
- School setup for profile, academic years, classes, sections, fee plans and holidays
- Student, parent and staff management
- Admissions and inquiry tracking
- Academic timetable and classroom updates
- Student and staff attendance
- Daily care logging for meal, nap, health and pickup updates
- Fee invoices and payment tracking
- Communication log and WhatsApp template management
- Content studio for templates and creatives
- Events, calendar and exports
- Branding and settings

## Tech stack

- React + TypeScript
- Vite
- Tailwind CSS
- Supabase Postgres + Auth

## Environment

The local environment file is already created as `.env.local` using the Supabase URL and anon key you provided.

## Run locally

```bash
npm install
npm run dev
```

The app will start at [http://localhost:5173](http://localhost:5173).

## Build

```bash
npm run build
```

## Supabase migration

Migration file:

- `supabase/migrations/20260331120000_kindergarten_crm_admin.sql`
- `supabase/migrations/20260331133000_staff_parent_portals.sql`
- `supabase/migrations/20260331150000_portal_access_management.sql`
- `supabase/migrations/20260331161000_fix_resolve_user_role_enum_cast.sql`
- `supabase/migrations/20260331172000_public_website_content.sql`
- `supabase/migrations/20260331193000_media_library.sql`
- `supabase/migrations/20260401160000_limit_public_admin_bootstrap.sql`

It creates:

- school bootstrap/auth profile tables
- school-scoped admin data tables
- staff and parent portal account linking
- teacher and parent access status tracking for admin-managed credentials
- request, homework and child progress data
- indexes and update triggers
- row level security policies for admin, staff and parent access

Apply it with the Supabase CLI or the SQL editor in your project dashboard.

## Fresh client database baseline

For a brand-new client database, use:

- `supabase/baseline/full_database_schema.sql`

This file is generated from the ordered migration chain and contains the full schema in one SQL file.

Regenerate it any time you add or change migrations:

```bash
./scripts/build-baseline-migration.sh
```

Use that baseline file by itself for a fresh empty database. Do not combine it with the split files in `supabase/migrations` for the same new setup.

## Notes

- The communication module stores WhatsApp-ready logs and templates, but AiSensy API delivery is not wired yet because API credentials and template contract details were not provided.
- The content studio stores templates/posts metadata and scheduling state; image generation/export can be added once you share the design workflow you want.
- Admin can now create teacher and parent logins from the Teachers and Parents pages, generate a temporary password, send a reset email, and activate or deactivate access.
- Supabase email auth must remain enabled for the teacher and parent credential flow to work.
