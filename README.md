# Abia State Dashboard

An executive performance dashboard for the Governor of Abia State. It presents
data from every sector of government in composite, glanceable form — on desktop
and on the phone.

## How the data is organised

```
Sector  →  MDA  →  Entity (located in an LGA)
Sector  →  Thematic Area (with a reporting frequency)  →  Domain  →  Indicator
Indicator × Time Period  →  Result  (+ evidence images)
```

- **Result** carries three numbers: the **Abia value** (the main input), the
  **Nigeria value** (national comparison) and a **target** (WHO / SDG / UN /
  State Plan — set on the indicator, overridable per period).
- Every result is normalized to a **0–100 score against its target**
  (respecting whether higher or lower is better), then rolled up with weights:
  indicator → domain → thematic area → sector → state, plus composite scores
  per **entity**, **MDA** and **LGA** (all 17 LGAs).
- Thematic areas set the reporting **frequency**: daily, weekly, monthly,
  quarterly or yearly.

## Running it

```bash
npm install
npm run dev
```

With no configuration the app serves a rich built-in **demo dataset**
(6 sectors, 10 MDAs, 44 entities, 43 indicators, ~2,500 results) so every
screen works immediately. The **Demo / Live** switch lives in the sidebar.

## Going live with Supabase

1. Create a Supabase project, then copy `.env.example` to `.env` and fill in:

   | Variable | Where to find it | Used for |
   | --- | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API | reading data |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API | reading data (RLS read-only) |
   | `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API | server-side writes: manage forms, CSV import, evidence uploads |
   | `DATABASE_URL` | Project Settings → Database (pooled, port 6543) | Prisma runtime |
   | `DIRECT_URL` | Project Settings → Database (direct, port 5432) | Prisma migrations |
   | `NEXT_PUBLIC_EVIDENCE_BUCKET` | any bucket name (default `evidence`) | evidence image storage |

2. Apply the schema with **Prisma migrations** (the schema of record is
   [prisma/schema.prisma](prisma/schema.prisma)):

   ```bash
   npm run db:deploy      # applies prisma/migrations (tables + RLS policies)
   ```

   Future schema changes: edit `prisma/schema.prisma`, then `npm run db:migrate`.

3. Optionally seed with the demo dataset:

   ```bash
   npm run seed:generate  # writes supabase/seed.sql from the demo data
   # paste supabase/seed.sql into the Supabase SQL editor (or psql)
   ```

4. Restart the app and flip the sidebar switch to **Live**.

`supabase/schema.sql` is kept as a plain-SQL reference of the same schema.

## Entering data

- **Manage → datasets** (`/manage`): forms to configure Sectors, LGAs, MDAs,
  Entities, Thematic Areas, Domains, Indicators (incl. targets and target
  source) and Time Periods.
- **Manage → Record results** (`/manage/results`): enter a result for an
  indicator + period (state-level or per entity), with optional **evidence
  images** uploaded to Supabase Storage.
- **CSV bulk upload**: download a template prefilled with every indicator and
  the current reporting period (state-level or entity-level variants), fill the
  `abia_value` column, and upload. Rows left blank are skipped; existing
  results are updated.

Writes require Live mode and `SUPABASE_SERVICE_ROLE_KEY`. In demo mode all
forms are visible but disabled.

> ⚠️ `/manage` has no authentication yet — add auth (e.g. Supabase Auth +
> middleware) before exposing this to the internet.

## Reports

Every level has a "state of things" **PDF download**:

- `/api/reports/state` — whole-of-government report (sectors, LGA ranking, attention list)
- `/api/reports/sector/[slug]` — sector deep-dive
- `/api/reports/lga/[id]` — LGA report with its measured entities

CTAs are on the Overview, Sector and LGA pages.

## Scoring methodology

- `higher_is_better`: score = 100 × value ÷ target (capped at 100)
- `lower_is_better`: score = 100 if value ≤ target, else 100 × target ÷ value
- Roll-ups are weighted means (weights on indicators, domains and thematic
  areas). Ratings: ≥85 Excellent · ≥70 Good · ≥50 Fair · <50 Poor.
- Radar charts draw the target as the dashed outer ring (100) so distance to
  target is visible at a glance.

## Project structure

```
prisma/               Prisma schema + migrations (source of truth for the DB)
supabase/             Plain-SQL reference schema + generated seed
scripts/              seed.sql generator
src/lib/              types, demo data, datasource (demo/live), scoring, reports
src/components/       app shell, charts (incl. radar), score widgets, forms
src/app/              pages: overview, sectors, LGAs, MDAs, indicators,
                      entities, manage; API routes: reports, CSV, data-mode
```
# abia-dashboard
