import type { DashboardData } from "./types";
import { formatScoreOptionsText } from "./indicator-input";

export type FieldType = "text" | "number" | "textarea" | "select" | "checkbox";

export interface FieldSpec {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  help?: string;
  /** for selects: fixed options or a reference to another dataset */
  options?: Array<{ value: string; label: string }>;
  optionsFrom?: "sectors" | "lgas" | "mdas" | "thematic_areas" | "domains" | "state_indicators";
}

/** A related dataset shown as a tab on a record's detail page. */
export interface ChildSpec {
  /** slug of the child dataset */
  slug: string;
  /** column on the child that references the parent record's id */
  foreignKey: string;
}

export interface DatasetSpec {
  slug: string;
  table: string;
  label: string;
  labelSingular: string;
  description: string;
  /** section of the manage hub this dataset belongs to */
  group: "structure" | "framework";
  /** DashboardData collection holding this dataset's records */
  collection: "sectors" | "lgas" | "mdas" | "entities" | "thematicAreas" | "domains" | "indicators" | "timePeriods";
  fields: FieldSpec[];
  /** builds the list rows shown under the form */
  list: (data: DashboardData) => Array<{ id: string; title: string; subtitle: string }>;
  /** related datasets managed from this record's detail page */
  children?: ChildSpec[];
  /** field edited inline on the detail overview (defaults to "name") */
  primaryField?: string;
}

/** Primary display/edit field for a dataset record. */
export function primaryField(spec: DatasetSpec): string {
  return spec.primaryField ?? "name";
}

/** Non-primary fields shown on the settings tab / overview detail grid. */
export function secondaryFields(spec: DatasetSpec): FieldSpec[] {
  const primary = primaryField(spec);
  return spec.fields.filter((f) => f.name !== primary);
}

const FREQUENCY_OPTIONS = ["daily", "weekly", "monthly", "quarterly", "yearly"].map((f) => ({
  value: f,
  label: f[0].toUpperCase() + f.slice(1),
}));

const DIRECTION_OPTIONS = [
  { value: "higher_is_better", label: "Higher is better" },
  { value: "lower_is_better", label: "Lower is better" },
];

const INDICATOR_SCOPE_OPTIONS = [
  { value: "state", label: "State-level indicator" },
  { value: "entity", label: "Entity-level indicator" },
];

const INDICATOR_VALUE_TYPE_OPTIONS = [
  { value: "score", label: "Score (choose from options)" },
  { value: "percentage", label: "Percentage" },
  { value: "number", label: "Number" },
];

export const DATASETS: DatasetSpec[] = [
  {
    slug: "sectors",
    table: "sectors",
    label: "Sectors",
    labelSingular: "Sector",
    description: "Top-level areas being measured — Health, Education, Security…",
    group: "structure",
    collection: "sectors",
    children: [
      { slug: "mdas", foreignKey: "sector_id" },
      { slug: "thematic-areas", foreignKey: "sector_id" },
    ],
    fields: [
      { name: "name", label: "Name", type: "text", required: true, placeholder: "e.g. Health" },
      { name: "slug", label: "Slug", type: "text", required: true, placeholder: "e.g. health", help: "Lowercase identifier used in URLs" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "color", label: "Accent color (hex)", type: "text", placeholder: "#14683c" },
      { name: "sort_order", label: "Sort order", type: "number", placeholder: "0" },
    ],
    list: (d) => d.sectors.map((s) => ({ id: s.id, title: s.name, subtitle: s.slug })),
  },
  {
    slug: "lgas",
    table: "lgas",
    label: "LGAs",
    labelSingular: "LGA",
    description: "The 17 Local Government Areas of Abia State.",
    group: "structure",
    collection: "lgas",
    children: [{ slug: "entities", foreignKey: "lga_id" }],
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
    group: "structure",
    collection: "mdas",
    children: [{ slug: "entities", foreignKey: "mda_id" }],
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
    group: "structure",
    collection: "entities",
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
    description:
      "Measurement themes under a sector; the frequency here drives which time periods apply. Mark exactly one thematic area per sector as the Sector Dashboard for weekly digests and executive data entry.",
    group: "framework",
    collection: "thematicAreas",
    children: [{ slug: "domains", foreignKey: "thematic_area_id" }],
    fields: [
      { name: "sector_id", label: "Sector", type: "select", required: true, optionsFrom: "sectors" },
      { name: "name", label: "Name", type: "text", required: true, placeholder: "e.g. Primary Healthcare" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "frequency", label: "Reporting frequency", type: "select", required: true, options: FREQUENCY_OPTIONS },
      { name: "weight", label: "Weight within sector", type: "number", placeholder: "1" },
      {
        name: "is_sector_dashboard",
        label: "Sector Dashboard",
        type: "checkbox",
        help: "Only one thematic area per sector. This set is used for executive data entry and the Friday weekly digest.",
      },
    ],
    list: (d) =>
      d.thematicAreas.map((t) => ({
        id: t.id,
        title: t.name,
        subtitle: `${d.sectors.find((s) => s.id === t.sector_id)?.name ?? ""} · ${t.frequency}${
          t.is_sector_dashboard ? " · Sector Dashboard" : ""
        }`,
      })),
  },
  {
    slug: "domains",
    table: "domains",
    label: "Domains",
    labelSingular: "Domain",
    description: "Measurement domains under a thematic area.",
    group: "framework",
    collection: "domains",
    children: [{ slug: "indicators", foreignKey: "domain_id" }],
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
    group: "framework",
    collection: "indicators",
    fields: [
      { name: "domain_id", label: "Domain", type: "select", required: true, optionsFrom: "domains" },
      { name: "indicator_scope", label: "Scope", type: "select", required: true, options: INDICATOR_SCOPE_OPTIONS },
      { name: "state_indicator_id", label: "Rolls up into", type: "select", optionsFrom: "state_indicators", help: "Choose the state-level indicator for entity indicators. Leave empty for state-level indicators." },
      { name: "name", label: "Name", type: "text", required: true, placeholder: "e.g. Immunization coverage (Penta-3)" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "value_type", label: "Value type", type: "select", required: true, options: INDICATOR_VALUE_TYPE_OPTIONS },
      {
        name: "score_options",
        label: "Score options",
        type: "textarea",
        help: "For score-type indicators, one option per line, e.g. 'Yes = 100' or 'A. Fully met = 100'",
        placeholder: "Yes = 100\nNo = 0",
      },
      { name: "unit", label: "Unit", type: "text", required: true, placeholder: "%, per 1,000, NGN bn…" },
      { name: "direction", label: "Direction", type: "select", required: true, options: DIRECTION_OPTIONS },
      {
        name: "frequency",
        label: "Reporting frequency",
        type: "select",
        options: FREQUENCY_OPTIONS,
        help: "Defaults to monthly. Change manually when an indicator reports weekly, quarterly, yearly, etc.",
      },
      { name: "target_value", label: "Target value", type: "number", help: "The level Abia should reach" },
      { name: "target_source", label: "Target source", type: "text", placeholder: "SDG, WHO, UN, State Plan…" },
      { name: "weight", label: "Weight within domain", type: "number", placeholder: "1" },
    ],
    list: (d) =>
      d.indicators.map((i) => {
        const freq = i.frequency ?? "monthly";
        return {
          id: i.id,
          title: i.name,
          subtitle: `${i.indicator_scope === "entity" ? "entity" : "state"} · ${freq} · ${d.domains.find((x) => x.id === i.domain_id)?.name ?? ""} · target ${i.target_value ?? "—"} ${i.unit}`,
        };
      }),
  },
  {
    slug: "time-periods",
    table: "time_periods",
    label: "Time Periods",
    labelSingular: "Time Period",
    description: "The reporting windows results are recorded against, per frequency.",
    group: "framework",
    collection: "timePeriods",
    primaryField: "label",
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

/** Singular label for use mid-sentence — keeps acronyms like MDA/LGA intact. */
export function singularLabel(spec: DatasetSpec): string {
  const s = spec.labelSingular;
  return s === s.toUpperCase() ? s : s.toLowerCase();
}

/** Raw records of a dataset from the loaded dashboard snapshot. */
export function recordsOf(data: DashboardData, spec: DatasetSpec): Array<Record<string, unknown>> {
  return data[spec.collection] as unknown as Array<Record<string, unknown>>;
}

export function findRecord(
  data: DashboardData,
  spec: DatasetSpec,
  id: string
): Record<string, unknown> | undefined {
  return recordsOf(data, spec).find((r) => String(r.id) === id);
}

/** Display rows of a child dataset scoped to one parent record. */
export function childRows(
  data: DashboardData,
  child: ChildSpec,
  parentId: string
): Array<{ id: string; title: string; subtitle: string }> {
  const spec = getDataset(child.slug);
  if (!spec) return [];
  const ids = new Set(
    recordsOf(data, spec)
      .filter((r) => String(r[child.foreignKey]) === parentId)
      .map((r) => String(r.id))
  );
  return spec.list(data).filter((row) => ids.has(row.id));
}

/** Human-readable value for a record field (resolves select references). */
export function displayValue(data: DashboardData, field: FieldSpec, value: unknown): string {
  if (field.type === "checkbox") {
    return value === true || value === "true" || value === "1" ? "Yes" : "No";
  }
  if (value === null || value === undefined || value === "") return "—";
  if (field.name === "score_options") {
    const formatted = formatScoreOptionsText(value);
    return formatted || "—";
  }
  const opts = field.optionsFrom ? optionsFor(data, field.optionsFrom) : field.options;
  if (opts) return opts.find((o) => o.value === String(value))?.label ?? String(value);
  return typeof value === "number" ? value.toLocaleString() : String(value);
}

/** Select options keyed by field name — for modal forms. */
export function optionsByField(
  data: DashboardData,
  fields: FieldSpec[]
): Record<string, Array<{ value: string; label: string }>> {
  const out: Record<string, Array<{ value: string; label: string }>> = {};
  for (const f of fields) {
    if (f.optionsFrom) out[f.name] = optionsFor(data, f.optionsFrom);
    else if (f.options) out[f.name] = f.options;
  }
  return out;
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
    case "state_indicators":
      return data.indicators
        .filter((i) => i.indicator_scope !== "entity")
        .map((i) => ({
          value: i.id,
          label: `${i.name} — ${data.domains.find((d) => d.id === i.domain_id)?.name ?? ""}`,
        }));
  }
}
