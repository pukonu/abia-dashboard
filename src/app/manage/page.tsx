import {
  ArrowRight,
  Database,
  Layers,
  LayoutDashboard,
  Mail,
  PenLine,
  RefreshCw,
  Shield,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { DemoModeNotice } from "@/components/forms";
import { DatasetIcon } from "@/components/manage/dataset-icons";
import StatCard from "@/components/manage/StatCard";
import { PageHeader, SectionTitle } from "@/components/ui";
import { loadDashboardData } from "@/lib/datasource";
import { DATASETS } from "@/lib/manage-config";

export const metadata = { title: "Manage" };

export default async function ManagePage() {
  const data = await loadDashboardData();

  const counts: Record<string, number> = {
    sectors: data.sectors.length,
    lgas: data.lgas.length,
    mdas: data.mdas.length,
    entities: data.entities.length,
    "thematic-areas": data.thematicAreas.length,
    domains: data.domains.length,
    indicators: data.indicators.length,
    "time-periods": data.timePeriods.length,
  };

  const structureTotal =
    counts.sectors + counts.lgas + counts.mdas + counts.entities;
  const frameworkTotal =
    counts["thematic-areas"] + counts.domains + counts.indicators + counts["time-periods"];
  const configTotal = structureTotal + frameworkTotal;

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Management console"
        subtitle="Configure the measurement framework, maintain government structure, and record performance data."
      />
      <DemoModeNotice show={data.mode !== "live"} />

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Database}
          label="Configuration records"
          value={configTotal}
          hint="Sectors through time periods"
        />
        <StatCard
          icon={Layers}
          label="Government structure"
          value={structureTotal}
          hint={`${counts.sectors} sectors · ${counts.entities} entities`}
          accent="blue"
        />
        <StatCard
          icon={Database}
          label="Measurement framework"
          value={frameworkTotal}
          hint={`${counts.indicators} indicators configured`}
          accent="green"
        />
        <StatCard
          icon={PenLine}
          label="Results recorded"
          value={data.results.length}
          hint="Indicator values entered"
          accent="amber"
        />
      </div>

      <SectionTitle hint="Capture performance data">Data entry</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/manage/sector-dashboard"
          className="card card-pad group flex items-start gap-4 border-l-4 border-l-emerald-600 transition-shadow hover:shadow-md"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <LayoutDashboard className="h-4 w-4" strokeWidth={1.5} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="display text-base font-semibold text-zinc-900 group-hover:underline">
              Sector Dashboard data
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              Enter monthly statewide values for Health (and other) Sector Dashboard indicators — the
              simplest place to fill the executive dashboard.
            </p>
          </div>
          <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-zinc-300" strokeWidth={1.5} />
        </Link>
        <Link
          href="/manage/results"
          className="card card-pad group flex items-start gap-4 transition-shadow hover:shadow-md"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            <PenLine className="h-4 w-4" strokeWidth={1.5} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="display text-base font-semibold text-zinc-900 group-hover:underline">
              Record results
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              Guided wizard for statewide or entity-level results, with optional evidence images.
            </p>
          </div>
          <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-zinc-300" strokeWidth={1.5} />
        </Link>
        <Link
          href="/manage/results#csv"
          className="card card-pad group flex items-start gap-4 transition-shadow hover:shadow-md"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            <Upload className="h-4 w-4" strokeWidth={1.5} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="display text-base font-semibold text-zinc-900 group-hover:underline">
              Bulk CSV upload
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              Download a prefilled template and import a whole reporting period at once.
            </p>
          </div>
          <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-zinc-300" strokeWidth={1.5} />
        </Link>
      </div>

      <SectionTitle hint="Curated chart layouts for sector and LGA pages">Presentation</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/manage/sector-facts"
          className="card card-pad group flex items-start gap-4 transition-shadow hover:shadow-md"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            <PenLine className="h-4 w-4" strokeWidth={1.5} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="display text-base font-semibold text-zinc-900 group-hover:underline">
              Sector facts
              <span className="ml-2 rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-zinc-600">
                {data.sectorFacts.length}
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              Enter executive numbers for sector landing pages, including values not yet tracked through entities.
            </p>
          </div>
          <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-zinc-300" strokeWidth={1.5} />
        </Link>
        <Link
          href="/manage/dashboards"
          className="card card-pad group flex items-start gap-4 transition-shadow hover:shadow-md"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            <LayoutDashboard className="h-4 w-4" strokeWidth={1.5} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="display text-base font-semibold text-zinc-900 group-hover:underline">
              Dashboard builder
              <span className="ml-2 rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-zinc-600">
                {data.dashboards.length}
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              Compose custom dashboards — pick chart types, drag to arrange, and publish them to a
              sector or LGA page.
            </p>
          </div>
          <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-zinc-300" strokeWidth={1.5} />
        </Link>
      </div>

      <SectionTitle hint="Who can access the console">Access control</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/manage/users"
          className="card card-pad group flex items-start gap-4 transition-shadow hover:shadow-md"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            <Shield className="h-4 w-4" strokeWidth={1.5} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="display text-base font-semibold text-zinc-900 group-hover:underline">
              Manage users
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              Create accounts for the management console and control who can enter data.
            </p>
          </div>
          <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-zinc-300" strokeWidth={1.5} />
        </Link>
        <Link
          href="/manage/subscriptions"
          className="card card-pad group flex items-start gap-4 transition-shadow hover:shadow-md"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            <Mail className="h-4 w-4" strokeWidth={1.5} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="display text-base font-semibold text-zinc-900 group-hover:underline">
              Digest subscribers
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              View weekly digest signups, preview the PDF, and send a test email to a subscriber.
            </p>
          </div>
          <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-zinc-300" strokeWidth={1.5} />
        </Link>
        <Link
          href="/manage/pwa-release"
          className="card card-pad group flex items-start gap-4 transition-shadow hover:shadow-md"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            <RefreshCw className="h-4 w-4" strokeWidth={1.5} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="display text-base font-semibold text-zinc-900 group-hover:underline">
              PWA releases
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              Force installed apps to reload or reinstall after a critical deploy.
            </p>
          </div>
          <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-zinc-300" strokeWidth={1.5} />
        </Link>
      </div>

      {(
        [
          { id: "structure", title: "Government structure", hint: "Who delivers, and where" },
          { id: "framework", title: "Measurement framework", hint: "What is measured, and when" },
        ] as const
      ).map((group) => (
        <div key={group.id}>
          <SectionTitle hint={group.hint}>{group.title}</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {DATASETS.filter((d) => d.group === group.id).map((d) => (
              <Link
                key={d.slug}
                href={`/manage/${d.slug}`}
                className="card card-pad group transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    <DatasetIcon slug={d.slug} />
                  </span>
                  <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-zinc-600">
                    {counts[d.slug] ?? 0}
                  </span>
                </div>
                <div className="mt-3 display text-base font-semibold text-zinc-900 group-hover:underline">
                  {d.label}
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-zinc-500">{d.description}</p>
              </Link>
            ))}
          </div>
        </div>
      ))}

      <p className="mt-8 text-xs leading-relaxed text-zinc-400">
        Schema changes (new columns, tables) are managed with Prisma — edit{" "}
        <code className="rounded bg-zinc-100 px-1">prisma/schema.prisma</code> and run{" "}
        <code className="rounded bg-zinc-100 px-1">yarn db:migrate</code>. This console only
        edits data.
      </p>
    </>
  );
}
