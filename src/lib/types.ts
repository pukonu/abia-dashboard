export type Frequency = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
export type Direction = "higher_is_better" | "lower_is_better";
export type IndicatorScope = "state" | "entity";
export type IndicatorValueType = "score" | "percentage" | "number";

export interface IndicatorScoreOption {
  code?: string;
  label: string;
  value: number;
}

export interface Sector {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  sort_order: number;
}

export interface Lga {
  id: string;
  name: string;
  zone: string;
  population: number;
}

export interface Mda {
  id: string;
  sector_id: string;
  name: string;
  abbreviation: string;
  description: string;
}

export interface Entity {
  id: string;
  mda_id: string;
  lga_id: string;
  name: string;
  entity_type: string;
}

export interface ThematicArea {
  id: string;
  sector_id: string;
  name: string;
  description: string;
  frequency: Frequency;
  weight: number;
  /** Executive sector dashboard thematic area — at most one per sector. */
  is_sector_dashboard: boolean;
}

export interface Domain {
  id: string;
  thematic_area_id: string;
  name: string;
  description?: string | null;
  /** national comparison value, free text (e.g. "993 / 100,000 (UN MMEIG 2023)") */
  benchmark_nigeria?: string | null;
  /** official target, free text (e.g. "≤70 / 100,000") */
  benchmark_target?: string | null;
  weight: number;
}

export interface Indicator {
  id: string;
  domain_id: string;
  indicator_scope: IndicatorScope;
  /** for entity indicators: the state-level indicator they roll up into */
  state_indicator_id?: string | null;
  name: string;
  description?: string | null;
  value_type: IndicatorValueType;
  score_options?: IndicatorScoreOption[] | null;
  unit: string;
  direction: Direction;
  target_value: number | null;
  target_source: string | null;
  weight: number;
  /**
   * Reporting cadence for this indicator. Defaults to monthly; change manually
   * when the true cadence differs (weekly, quarterly, yearly, etc.).
   */
  frequency?: Frequency | null;
  /** MDA accountable for reporting this indicator (Sector Dashboard ownership). */
  responsible_mda_id?: string | null;
}

export interface TimePeriod {
  id: string;
  frequency: Frequency;
  label: string;
  start_date: string; // ISO date
  end_date: string;
}

export interface Result {
  id: string;
  indicator_id: string;
  time_period_id: string;
  entity_id: string | null; // null = state-level result
  abia_value: number;
  nigeria_value: number | null;
  target_value: number | null; // period override; falls back to indicator.target_value
  notes?: string | null;
}

export interface ResultEvidence {
  id: string;
  result_id: string;
  storage_path: string;
  caption: string | null;
  /** public URL resolved from the Supabase Storage bucket */
  url: string;
}

export type DashboardScope = "sector" | "lga";
export type DashboardChartType = "trend" | "bar" | "radar" | "stat" | "pie";

/** Admin-built custom dashboard displayed on a sector or LGA page. */
export interface CustomDashboard {
  id: string;
  name: string;
  description: string | null;
  scope: DashboardScope;
  sector_id: string | null;
  lga_id: string | null;
  published: boolean;
  sort_order: number;
}

/** One chart on a custom dashboard. */
export interface DashboardWidget {
  id: string;
  dashboard_id: string;
  chart_type: DashboardChartType;
  title: string | null;
  /** indicator ids plotted by this widget */
  indicator_ids: string[];
  /** grid columns occupied (1 = half width, 2 = full width) */
  span: number;
  /**
   * Stat tiles only: when true, show period-over-period change (▲/▼/steady).
   * Default false = simple value-only view.
   */
  show_change: boolean;
  position: number;
}

export interface SectorFact {
  id: string;
  sector_id: string;
  label: string;
  value: string;
  caption: string | null;
  source: string | null;
  sort_order: number;
}

export type DataMode = "demo" | "live";

/** Full snapshot of dashboard data, loaded once per request. */
export interface DashboardData {
  sectors: Sector[];
  lgas: Lga[];
  mdas: Mda[];
  entities: Entity[];
  thematicAreas: ThematicArea[];
  domains: Domain[];
  indicators: Indicator[];
  timePeriods: TimePeriod[];
  results: Result[];
  evidence: ResultEvidence[];
  dashboards: CustomDashboard[];
  dashboardWidgets: DashboardWidget[];
  sectorFacts: SectorFact[];
  /** which dataset is being served */
  mode: DataMode;
  /** whether Supabase credentials are configured (live mode possible) */
  supabaseConfigured: boolean;
}
