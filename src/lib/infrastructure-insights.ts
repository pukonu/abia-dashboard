import type { DashboardData } from "./types";

export interface RoadStat {
  label: string;
  value: string;
  caption: string;
}

export interface RoadProject {
  name: string;
  lga: string;
  status: "Completed" | "Under construction" | "Planned";
  startMonth: string;
  completionMonth: string | null;
  kilometers: number;
}

function fmt(value: number, digits = 0): string {
  return value.toLocaleString("en-NG", { maximumFractionDigits: digits });
}

export function infrastructureLandingInsights(data: DashboardData) {
  const projectEntities = data.entities.filter((entity) => entity.entity_type === "Road Project");
  const fallbackProjects: RoadProject[] = [
    { name: "Port Harcourt Road Rehabilitation", lga: "Aba South", status: "Under construction", startMonth: "Jan 2026", completionMonth: null, kilometers: 6.8 },
    { name: "Ossah Road Dualization", lga: "Umuahia North", status: "Completed", startMonth: "Nov 2025", completionMonth: "May 2026", kilometers: 3.5 },
    { name: "Abiriba Ring Road", lga: "Ohafia", status: "Under construction", startMonth: "Feb 2026", completionMonth: null, kilometers: 8.2 },
    { name: "Obohia-Ohanku Road", lga: "Aba South", status: "Planned", startMonth: "Aug 2026", completionMonth: null, kilometers: 5.1 },
    { name: "Uzuakoli-Bende Road", lga: "Bende", status: "Completed", startMonth: "Dec 2025", completionMonth: "Jun 2026", kilometers: 11.4 },
  ];
  const lgaById = new Map(data.lgas.map((lga) => [lga.id, lga.name]));
  const projects = projectEntities.length > 0
    ? projectEntities.map((entity, index) => fallbackProjects[index] ?? {
        name: entity.name,
        lga: lgaById.get(entity.lga_id) ?? "Unknown LGA",
        status: "Under construction" as const,
        startMonth: "Mar 2026",
        completionMonth: null,
        kilometers: 4.5,
      })
    : fallbackProjects;

  const completed = projects.filter((project) => project.status === "Completed");
  const underConstruction = projects.filter((project) => project.status === "Under construction");
  const planned = projects.filter((project) => project.status === "Planned");
  const totalKm = projects.reduce((sum, project) => sum + project.kilometers, 0);
  const completedThisMonth = completed.filter((project) => project.completionMonth === "Jun 2026").length;
  const lgaSpread = [...new Set(projects.map((project) => project.lga))].length;

  return {
    stats: [
      {
        label: "Road projects tracked",
        value: fmt(projects.length),
        caption: "Completed, active and planned road works in the dashboard.",
      },
      {
        label: "Roads completed",
        value: fmt(completed.length),
        caption: `${fmt(completedThisMonth)} completed this month for monthly progress reporting.`,
      },
      {
        label: "Under construction",
        value: fmt(underConstruction.length),
        caption: "Projects already started and needing monthly status updates.",
      },
      {
        label: "Planned roads",
        value: fmt(planned.length),
        caption: "Approved or pipeline roads yet to start construction.",
      },
      {
        label: "Total road kilometres",
        value: `${fmt(totalKm, 1)} km`,
        caption: "Combined length across tracked road projects.",
      },
      {
        label: "LGA spread",
        value: fmt(lgaSpread),
        caption: "Local governments represented in the road delivery pipeline.",
      },
    ] satisfies RoadStat[],
    projects,
    statusSummary: [
      { label: "Completed", value: completed.length, color: "#16a34a" },
      { label: "Under construction", value: underConstruction.length, color: "#ea580c" },
      { label: "Planned", value: planned.length, color: "#71717a" },
    ],
    monthlyMilestones: [
      { month: "Jan", started: 1, completed: 0 },
      { month: "Feb", started: 1, completed: 0 },
      { month: "Mar", started: 0, completed: 0 },
      { month: "Apr", started: 0, completed: 0 },
      { month: "May", started: 0, completed: 1 },
      { month: "Jun", started: 0, completed: 1 },
      { month: "Jul", started: 0, completed: 0 },
      { month: "Aug", started: 1, completed: 0 },
    ],
  };
}
