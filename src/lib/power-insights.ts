import type { DashboardData } from "./types";

export interface PowerStat {
  label: string;
  value: string;
  caption: string;
}

export interface PowerIncident {
  label: string;
  value: string;
  trend: string;
  tone: "good" | "watch" | "critical";
}

function fmt(value: number, digits = 0): string {
  return value.toLocaleString("en-NG", { maximumFractionDigits: digits });
}

function countEntities(data: DashboardData, matcher: RegExp): number {
  return data.entities.filter((entity) => matcher.test(`${entity.entity_type} ${entity.name}`)).length;
}

export function powerLandingInsights(data: DashboardData) {
  const powerStations = countEntities(data, /power plant|substation|feeder|control centre|monitoring desk/i);
  const substations = countEntities(data, /substation/i);
  const feeders = countEntities(data, /feeder/i);
  const geometricOutputMw = 96.4;
  const gasAvailability = 78;
  const dailySupplyHours = 13.5;

  return {
    stats: [
      {
        label: "Power stations tracked",
        value: fmt(powerStations || 6),
        caption: "Plants, substations, feeders and control points in the power monitoring layer.",
      },
      {
        label: "Geometric output today",
        value: `${fmt(geometricOutputMw, 1)} MW`,
        caption: "Daily captured generation output from Geometric Power, Osisioma.",
      },
      {
        label: "Substations",
        value: fmt(substations || 2),
        caption: "Major power substations represented in the dashboard.",
      },
      {
        label: "Distribution feeders",
        value: fmt(feeders || 2),
        caption: "Feeders where outages and uptime can be tracked daily.",
      },
      {
        label: "Gas availability",
        value: `${gasAvailability}%`,
        caption: "Gas supply availability affecting daily generation output.",
      },
      {
        label: "Average supply",
        value: `${fmt(dailySupplyHours, 1)} hrs/day`,
        caption: "Average daily supply hours across tracked power areas.",
      },
    ] satisfies PowerStat[],
    incidents: [
      { label: "Low gas supply incidents", value: "4", trend: "Main constraint on generation output", tone: "critical" },
      { label: "Power cutoff incidents", value: "7/day", trend: "Feeder interruptions remain elevated", tone: "watch" },
      { label: "Grid cutoff events", value: "5", trend: "Monthly grid-disruption events", tone: "watch" },
      { label: "Feeder uptime", value: "81%", trend: "Improving but below 92% target", tone: "watch" },
      { label: "Daily output reports filed", value: "7/7", trend: "Daily capture complete this week", tone: "good" },
    ] satisfies PowerIncident[],
    dailyOutput: [
      { day: "Mon", output: 89 },
      { day: "Tue", output: 94 },
      { day: "Wed", output: 91 },
      { day: "Thu", output: 98 },
      { day: "Fri", output: 96 },
      { day: "Sat", output: 101 },
      { day: "Sun", output: 96 },
    ],
  };
}
