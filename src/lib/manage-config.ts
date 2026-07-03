import type { DashboardData } from "./types";

export type FieldType = "text" | "number" | "textarea" | "select";

export interface FieldSpec {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  help?: string;
  /** for selects: fixed options or a reference to another dataset */
  options?: Array<{ value: string; label: string }>;
  optionsFrom?: "sectors" | "lgas" | "mdas" | "thematic_areas" | "domains";
}

export interface DatasetSpec {
  slug: string;
  table: string;
  label: string;
  labelSingular: string;
  description: string;
  fields: FieldSpec[];
  /** builds the list rows shown under the form */
  list: (data: DashboardData) => Array<{ id: string; title: string; subtitle: string }>;
}

const FREQUENCY_OPTIONS = ["daily", "weekly", "monthly", "quarterly", "yearly"].map((f) => ({
  value: f,
  label: f[0].toUpperCase() + f.slice(1),
}));

const DIRECTION_OPTIONS = [
  { value: "higher_is_better", label: "Higher is better" },
  { value: "lower_is_better", label: "Lower is better" },
];

export const DATASETS: DatasetSpec[] = [
  {
    slug: "sectors",
    table: "sectors",
    label: "Sectors",
    labelSingular: "Sector",
    description: "Top-level areas being measured — Health, Education, Security…",
    fields: [
      { name: "name", label: "Name", type: "text", required: true, placeholder: "e.g. Health" },
      { name: "slug", label: "Slug", type: "text", required: true, placeholder: "e.g. health", help: "Lowercase identifier used in URLs" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "icon", label: "Icon (emoji)", type: "text", placeholder: "🏥" },
      { name: "color", label: "Accent color (hex)", type: "text", placeholder: "#14683c" },
      { name: "sort_order", label: "Sort order", type: "number", placeholder: "0" },
    ],
    list: (d) => d.sectors.map((s) => ({ id: s.id, title: `${s.icon ?? ""} ${s.name}`.trim(), subtitle: s.slug })),
  },
  {
    slug: "lgas",
    table: "lgas",
    label: "LGAs",
    labelSingular: "LGA",
    description: "The 17 Local Government Areas of Abia State.",
    fields: [
      { name: "name", label: "Name", type: "text", required: true, placeholder: "e.g. Aba South" },
      {
        name: "zone",
        label: "Senatorial zone",
        type: "select",
        options: ["Abia North", "Abia Central", "Abia South"].map((z) => ({ value: z, label: z })),
      },
      { name: "population", label: "Population (approx.)", type: "number" },
    ],
    list: (d) => d.lgas.map((l) => ({ id: l.id, title: l.name, subtitle: `${l.zone} · pop. ${l.population?.toLocaleString() ?? "—"}` })),
  },
  {
    slug: "mdas",
    table: "mdas",
    label: "MDAs",
    labelSingular: "MDA",
    description: "Ministries, Departments & Agencies, each under a sector.",
    fields: [
      { name: "sector_id", label: "Sector", type: "select", required: true, optionsFrom: "sectors" },
      { name: "name", label: "Name", type: "text", required: true, placeholder: "e.g. Ministry of Health" },
      { name: "abbreviation", label: "Abbreviation", type: "text", placeholder: "e.g. MOH" },
      { name: "description", label: "Description", type: "textarea" },
    ],
    list: (d) =>
      d.mdas.map((m) => ({
        id: m.id,
        title: `${m.name} (${m.abbreviation ?? "—"})`,
        subtitle: d.sectors.find((s) => s.id === m.sector_id)?.name ?? "",
      })),
  },
  {
    slug: "entities",
    table: "entities",
    label: "Entities",
    labelSingular: "Entity",
    description: "Concrete units being measured — a hospital, school, project — each under an MDA and located in an LGA.",
    fields: [
      { name: "mda_id", label: "MDA", type: "select", required: true, optionsFrom: "mdas" },
      { name: "lga_id", label: "LGA", type: "select", required: true, optionsFrom: "lgas" },
      { name: "name", label: "Name", type: "text", required: true, placeholder: "e.g. Aba General Hospital" },
      { name: "entity_type", label: "Type", type: "text", placeholder: "e.g. General Hospital" },
      { name: "description", label: "Description", type: "textarea" },
    ],
    list: (d) =>
      d.entities.map((e) => ({
        id: e.id,
        title: e.name,
        subtitle: `${e.entity_type ?? ""} · ${d.mdas.find((m) => m.id === e.mda_id)?.abbreviation ?? ""} · ${d.lgas.find((l) => l.id === e.lga_id)?.name ?? ""}`,
      })),
  },
  {
    slug: "thematic-areas",
    table: "thematic_areas",
    label: "Thematic Areas",
    labelSingular: "Thematic Area",
    description: "Measurement themes under a sector; the frequency here drives which time periods apply.",
    fields: [
      { name: "sector_id", label: "Sector", type: "select", required: true, optionsFrom: "sectors" },
      { name: "name", label: "Name", type: "text", required: true, placeholder: "e.g. Primary Healthcare" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "frequency", label: "Reporting frequency", type: "select", required: true, options: FREQUENCY_OPTIONS },
      { name: "weight", label: "Weight within sector", type: "number", placeholder: "1" },
    ],
    list: (d) =>
      d.thematicAreas.map((t) => ({
        id: t.id,
        title: t.name,
        subtitle: `${d.sectors.find((s) => s.id === t.sector_id)?.name ?? ""} · ${t.frequency}`,
      })),
  },
  {
    slug: "domains",
    table: "domains",
    label: "Domains",
    labelSingular: "Domain",
    description: "Measurement domains under a thematic area.",
    fields: [
      { name: "thematic_area_id", label: "Thematic area", type: "select", required: true, optionsFrom: "thematic_areas" },
      { name: "name", label: "Name", type: "text", required: true, placeholder: "e.g. Maternal & Child Health" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "weight", label: "Weight within thematic area", type: "number", placeholder: "1" },
    ],
    list: (d) =>
      d.domains.map((x) => ({
        id: x.id,
        title: x.name,
        subtitle: d.thematicAreas.find((t) => t.id === x.thematic_area_id)?.name ?? "",
      })),
  },
  {
    slug: "indicators",
    table: "indicators",
    label: "Indicators & Targets",
    labelSingular: "Indicator",
    description: "What is actually measured under each domain, with its unit, direction and official target.",
    fields: [
      { name: "domain_id", label: "Domain", type: "select", required: true, optionsFrom: "domains" },
      { name: "name", label: "Name", type: "text", required: true, placeholder: "e.g. Immunization coverage (Penta-3)" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "unit", label: "Unit", type: "text", required: true, placeholder: "%, per 1,000, NGN bn…" },
      { name: "direction", label: "Direction", type: "select", required: true, options: DIRECTION_OPTIONS },
      { name: "target_value", label: "Target value", type: "number", help: "The level Abia should reach" },
      { name: "target_source", label: "Target source", type: "text", placeholder: "SDG, WHO, UN, State Plan…" },
      { name: "weight", label: "Weight within domain", type: "number", placeholder: "1" },
    ],
    list: (d) =>
      d.indicators.map((i) => ({
        id: i.id,
        title: i.name,
        subtitle: `${d.domains.find((x) => x.id === i.domain_id)?.name ?? ""} · target ${i.target_value ?? "—"} ${i.unit} (${i.target_source ?? "—"})`,
      })),
  },
  {
    slug: "time-periods",
    table: "time_periods",
    label: "Time Periods",
    labelSingular: "Time Period",
    description: "The reporting windows results are recorded against, per frequency.",
    fields: [
      { name: "frequency", label: "Frequency", type: "select", required: true, options: FREQUENCY_OPTIONS },
      { name: "label", label: "Label", type: "text", required: true, placeholder: "e.g. 2026 Q3, Jul 2026, 2026" },
      { name: "start_date", label: "Start date", type: "text", required: true, placeholder: "YYYY-MM-DD" },
      { name: "end_date", label: "End date", type: "text", required: true, placeholder: "YYYY-MM-DD" },
    ],
    list: (d) =>
      [...d.timePeriods]
        .sort((a, b) => b.start_date.localeCompare(a.start_date))
        .map((p) => ({ id: p.id, title: p.label, subtitle: `${p.frequency} · ${p.start_date} → ${p.end_date}` })),
  },
];

export function getDataset(slug: string): DatasetSpec | undefined {
  return DATASETS.find((d) => d.slug === slug);
}

export function optionsFor(
  data: DashboardData,
  source: NonNullable<FieldSpec["optionsFrom"]>
): Array<{ value: string; label: string }> {
  switch (source) {
    case "sectors":
      return data.sectors.map((s) => ({ value: s.id, label: s.name }));
    case "lgas":
      return data.lgas.map((l) => ({ value: l.id, label: l.name }));
    case "mdas":
      return data.mdas.map((m) => ({ value: m.id, label: `${m.name} (${m.abbreviation ?? ""})` }));
    case "thematic_areas":
      return data.thematicAreas.map((t) => ({
        value: t.id,
        label: `${t.name} — ${data.sectors.find((s) => s.id === t.sector_id)?.name ?? ""}`,
      }));
    case "domains":
      return data.domains.map((d) => ({
        value: d.id,
        label: `${d.name} — ${data.thematicAreas.find((t) => t.id === d.thematic_area_id)?.name ?? ""}`,
      }));
  }
}
