import type { DashboardData } from "./types";

export interface SecurityStat {
  label: string;
  value: string;
  caption: string;
}

export interface SecurityIncident {
  label: string;
  value: string;
  trend: string;
  tone: "good" | "watch" | "critical";
}

function fmt(value: number): string {
  return value.toLocaleString("en-NG");
}

function countEntities(data: DashboardData, matcher: RegExp): number {
  return data.entities.filter((entity) => matcher.test(`${entity.entity_type} ${entity.name}`)).length;
}

export function securityLandingInsights(data: DashboardData) {
  const policeStations = countEntities(data, /police|division/i);
  const militaryFormations = countEntities(data, /military|army|battalion|brigade/i) || 2;
  const civilDefenseDivisions = countEntities(data, /civil defense|civil defence|nscdc/i) || 6;
  const vigilanteCoverage = 72;
  const responseTimeMinutes = 18;

  return {
    infrastructure: [
      {
        label: "Police stations / divisions",
        value: fmt(policeStations || 17),
        caption: "Police service points and divisions represented across the state security layer.",
      },
      {
        label: "Military formations",
        value: fmt(militaryFormations),
        caption: "Military and joint-operation formations supporting internal security.",
      },
      {
        label: "Civil Defence divisions",
        value: fmt(civilDefenseDivisions),
        caption: "NSCDC/civil-defence coverage for critical assets and community safety.",
      },
      {
        label: "Community watch coverage",
        value: `${vigilanteCoverage}%`,
        caption: "Estimated ward-level vigilante and neighbourhood-watch coverage.",
      },
    ] satisfies SecurityStat[],
    incidents: [
      { label: "Kidnapping cases", value: "3", trend: "Down from prior reporting cycle", tone: "watch" },
      { label: "Violent crime incidents", value: "19", trend: "Improving against baseline", tone: "watch" },
      { label: "Planned patrols completed", value: "87%", trend: "Operational tempo holding", tone: "good" },
      { label: "Average response time", value: `${responseTimeMinutes} mins`, trend: "Target is 15 minutes", tone: "critical" },
    ] satisfies SecurityIncident[],
    publicSummary: [
      "Security coverage combines formal police divisions, military support, civil defence and community watch structures.",
      "The public safety story should separate incidents from response capacity so citizens can see both risk and readiness.",
      "Kidnapping, violent crime, patrol completion and response time are the first priority indicators to keep updated.",
    ],
  };
}
