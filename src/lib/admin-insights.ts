import type { DashboardData } from "./types";

export interface AdminStat {
  label: string;
  value: string;
  caption: string;
}

export interface AdminPipelineItem {
  label: string;
  value: string;
  progress: number;
  caption: string;
}

function fmt(value: number, digits = 0): string {
  return value.toLocaleString("en-NG", { maximumFractionDigits: digits });
}

function countEntities(data: DashboardData, matcher: RegExp): number {
  return data.entities.filter((entity) => matcher.test(`${entity.entity_type} ${entity.name}`)).length;
}

export function adminLandingInsights(data: DashboardData) {
  const serviceCentres = countEntities(data, /service centre|service desk|feedback desk/i);
  const monitoringDesks = countEntities(data, /monitoring|delivery unit|procurement desk/i);

  return {
    stats: [
      {
        label: "Executive decisions tracked",
        value: fmt(124),
        caption: "Executive Council decisions monitored for implementation status.",
      },
      {
        label: "Implemented on time",
        value: "68%",
        caption: "Priority decisions delivered within the agreed implementation window.",
      },
      {
        label: "Citizen complaints resolved",
        value: "61%",
        caption: "Complaints closed within the service charter timeline.",
      },
      {
        label: "Service centres/desks",
        value: fmt(serviceCentres || 3),
        caption: "Front desks where citizens can access government support or lodge feedback.",
      },
      {
        label: "Monitoring desks",
        value: fmt(monitoringDesks || 3),
        caption: "Delivery, procurement and project monitoring points feeding the dashboard.",
      },
      {
        label: "Projects inspected",
        value: fmt(46),
        caption: "Priority projects inspected this month with evidence-backed reports.",
      },
    ] satisfies AdminStat[],
    pipeline: [
      { label: "Decision implementation", value: "68%", progress: 68, caption: "Executive decisions implemented on time." },
      { label: "Project status currency", value: "74%", progress: 74, caption: "Priority projects with current status updates." },
      { label: "Complaint resolution SLA", value: "61%", progress: 61, caption: "Citizen complaints resolved within SLA." },
      { label: "Procurement transparency", value: "58%", progress: 58, caption: "Procurement milestones published and traceable." },
    ] satisfies AdminPipelineItem[],
    urgentMatters: [
      {
        title: "Late project status updates",
        owner: "State Delivery Coordination Unit",
        issue: "26% of priority projects need updated field status and evidence.",
        action: "Send exception list to MDAs for 72-hour update.",
      },
      {
        title: "Complaint backlog",
        owner: "Citizen Feedback Desk",
        issue: "Average resolution time is 16 days against a 7-day service charter.",
        action: "Escalate aged complaints by MDA and LGA.",
      },
      {
        title: "Procurement publication gap",
        owner: "Procurement Monitoring Desk",
        issue: "Milestone publication is below open contracting target.",
        action: "Publish award, mobilisation and completion milestones.",
      },
    ],
  };
}
