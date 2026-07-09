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

export function securityLandingInsights(_data: DashboardData) {
  void _data;

  return {
    infrastructure: [
      {
        label: "Community watch coverage",
        value: "74%",
        caption: "Estimated ward-level vigilante and neighbourhood-watch coverage.",
      },
      {
        label: "Emergency readiness",
        value: "69%",
        caption: "Composite readiness across vehicles, joint ops capacity and response protocols.",
      },
      {
        label: "Asset protection coverage",
        value: "82%",
        caption: "Share of priority critical assets under active protection arrangements.",
      },
      {
        label: "Patrols completed",
        value: "87%",
        caption: "Share of planned security patrols completed in the latest cycle.",
      },
    ] satisfies SecurityStat[],
    incidents: [
      { label: "Kidnapping cases", value: "3", trend: "Down from prior reporting cycle", tone: "watch" },
      { label: "Violent crime incidents", value: "19", trend: "Improving against baseline", tone: "watch" },
      { label: "Armed robbery incidents", value: "8", trend: "Still above weekly target of 5", tone: "watch" },
      { label: "Cult-related incidents", value: "4", trend: "Needs sustained joint operations", tone: "critical" },
      { label: "Planned patrols completed", value: "87%", trend: "Operational tempo holding", tone: "good" },
      { label: "Average response time", value: "18 mins", trend: "Target is 15 minutes", tone: "critical" },
    ] satisfies SecurityIncident[],
    readiness: [
      { label: "Patrol completion", value: 87 },
      { label: "Community watch coverage", value: 74 },
      { label: "Tip-off response (24h)", value: 71 },
      { label: "Emergency readiness", value: 69 },
      { label: "Asset protection", value: 82 },
    ],
    urgentMatters: [] as Array<{
      location: string;
      lga: string;
      issue: string;
      severity: "High" | "Critical";
      action: string;
    }>,
    publicSummary: [
      "Security indicators track crime, response capacity, community policing and road safety at state level.",
      "The public safety story separates incidents from readiness so citizens can see both risk and response.",
      "Kidnapping, violent crime, cult activity, patrol completion and response time are the first priority indicators to keep updated.",
    ],
  };
}
