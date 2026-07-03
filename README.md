# Abia State Dashboard

Abia State Dashboard is a mobile-first executive performance dashboard for the
Government of Abia State. It aggregates sector performance into a single
statewide view, supports drill-down by sector, MDA, LGA, entity and indicator,
and can run either against a built-in demo dataset or a live Supabase backend.

The app is built with Next.js App Router, React 19, TypeScript, Tailwind CSS 4,
Supabase and Prisma migrations.

## What the app does

The dashboard is designed to answer a simple question: how is the state
performing against official targets?

It models data as:

```text
Sector -> MDA -> Entity (located in an LGA)
Sector -> Thematic Area -> Domain -> Indicator
Indicator x Time Period -> Result (+ optional evidence images)
```

Each result can store:

- `abia_value`: the primary value being reported
- `nigeria_value`: an optional national comparison
- `target_value`: an optional period-specific override for the indicator target
- `notes`: free-form context
- evidence images stored in Supabase Storage

Those results are normalized into a `0-100` score and rolled up into composite
scores for:

- State
- Sector
- MDA
- LGA
- Entity
- Individual indicator trends

## Key features

- Executive overview page with a composite state score, trend chart, sector
  summary and attention list
- Sector, LGA, MDA, entity and indicator drill-down pages
- Demo mode with seeded sample data so the UI works with zero setup
- Live mode backed by Supabase Postgres
- Result entry forms and CSV bulk upload
- Evidence image upload for result records
- PDF report generation for state, sector and LGA views
- Responsive app shell with desktop sidebar and mobile bottom navigation

## Routes

### Dashboard routes

- `/` - statewide overview
- `/sectors` - sector comparison view
- `/sectors/[slug]` - sector drill-down
- `/lgas` - LGA ranking and filtering
- `/lgas/[id]` - LGA detail
- `/mdas` - MDA list
- `/mdas/[id]` - MDA detail
- `/indicators` - indicator list and sector filtering
- `/indicators/[id]` - indicator detail and trend view
- `/entities/[id]` - entity detail

### Management routes

- `/manage` - management hub for datasets and data entry
- `/manage/results` - single-result entry and CSV upload
- `/manage/[dataset]` - dataset configuration pages for sectors, LGAs, MDAs,
  entities, thematic areas, domains, indicators and time periods

### API routes

- `POST /api/data-mode` - switch between demo and live mode
- `GET /api/csv-template` - download a prefilled CSV template
- `GET /api/reports/state` - state PDF report
- `GET /api/reports/sector/[slug]` - sector PDF report
- `GET /api/reports/lga/[id]` - LGA PDF report

## Data modes

The app supports two data sources:

### Demo mode

No environment variables are required. The app serves a built-in demo dataset so
all screens render immediately.

### Live mode

The app reads from Supabase using the public client keys and performs writes
through server actions using the service role key. The active mode can be
toggled from the sidebar or mobile header.

If Supabase is configured, the app defaults to live mode unless the user has
explicitly chosen demo mode via cookie.

## Scoring model

Indicators are normalized against target values:

- `higher_is_better`: `score = 100 * value / target`, capped at `100`
- `lower_is_better`: `score = 100` when `value <= target`, otherwise
  `100 * target / value`

Roll-ups are weighted means across indicators, domains and thematic areas.

Current rating bands:

- `>= 85` Excellent
- `>= 70` Good
- `>= 50` Fair
- `< 50` Poor

## Tech stack

- Next.js 16 with App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase (`@supabase/supabase-js`)
- Prisma 7 for schema management and migrations
- Recharts for charts
- `@react-pdf/renderer` for PDF exports

## Getting started

### Requirements

- Node.js 20 recommended
- npm
- A Supabase project if you want to use live mode

### Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

With no configuration, the app runs in demo mode with built-in sample data.

## Environment variables

Copy `.env.example` to `.env` and fill in the values from your Supabase
project:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL used by the client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public/publishable Supabase key for reads |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase key for writes and storage uploads |
| `DATABASE_URL` | Pooled Postgres connection for Prisma-compatible runtime access |
| `DIRECT_URL` | Direct Postgres connection for Prisma migrations |
| `NEXT_PUBLIC_EVIDENCE_BUCKET` | Supabase Storage bucket for evidence images |

Notes:

- `NEXT_PUBLIC_SUPABASE_ANON_KEY` maps to the Supabase publishable or anon key.
- `SUPABASE_SERVICE_ROLE_KEY` maps to the Supabase secret or service-role key.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.

## Going live with Supabase

1. Create a Supabase project.
2. Copy `.env.example` to `.env` and fill in the API and database values.
3. Apply the schema:

   ```bash
   npm run db:deploy
   ```

4. Optionally generate a seed SQL file from the demo dataset:

   ```bash
   npm run seed:generate
   ```

5. Load `supabase/seed.sql` into Supabase if you want starter data.
6. Restart the app and switch the UI to Live mode.

The Prisma schema of record lives at `prisma/schema.prisma`. A plain-SQL
reference copy is kept at `supabase/schema.sql`.

## Data entry and admin workflows

### Dataset configuration

Use `/manage` and `/manage/[dataset]` to create and delete records for:

- sectors
- LGAs
- MDAs
- entities
- thematic areas
- domains
- indicators
- time periods

### Result entry

Use `/manage/results` to:

- add or update a single result
- attach optional evidence images
- bulk import results from CSV

The CSV template endpoint can generate both state-level and entity-level import
templates. Blank `abia_value` rows are skipped, and existing matching results
are updated.

In demo mode, management forms are visible but writes are disabled.

## Reports

The app can render PDF "state of things" reports for:

- state
- sector
- LGA

Download actions are exposed from the relevant pages and backed by server-side
API routes.

## Database model

The Supabase database includes the following main tables:

- `sectors`
- `lgas`
- `mdas`
- `entities`
- `thematic_areas`
- `domains`
- `indicators`
- `time_periods`
- `results`
- `result_evidence`

Prisma is currently used as the migration and schema tool. Runtime reads and
writes are handled through Supabase clients rather than Prisma Client.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Build the app |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run seed:generate` | Generate `supabase/seed.sql` from demo data |
| `npm run db:migrate` | Create and apply a Prisma development migration |
| `npm run db:deploy` | Apply committed Prisma migrations |
| `npm run db:push` | Push schema changes without creating a migration |

## Project structure

```text
prisma/               Prisma schema and migrations
scripts/              Utility scripts, including demo seed generation
supabase/             SQL schema reference and generated seed SQL
src/app/              App Router pages and API routes
src/components/       Layout, charts, forms and score UI
src/lib/              Data loading, scoring, reports, demo data and helpers
```

## Current limitations

- `/manage` is not authenticated yet
- live-mode writes rely on the presence of `SUPABASE_SERVICE_ROLE_KEY`
- dataset management currently supports create and delete flows, but not full
  edit/update flows for every config record
- there is no `/entities` index page yet
- PDF exports currently exist for state, sector and LGA views only
- there are no automated tests in the repository yet

## Security warning

This project should not be exposed publicly in its current admin state.

Before deploying management features to the internet, add proper authentication
and authorization, for example:

- Supabase Auth
- Next.js middleware or route protection
- role-based access checks for management actions

Until then, treat `/manage` as trusted-environment functionality only.
