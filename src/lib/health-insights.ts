import type { DashboardData } from "./types";

export interface HealthStat {
  label: string;
  value: string;
  caption: string;
}

export interface HealthSignal {
  label: string;
  value: string;
  trend: string;
  tone: "good" | "watch" | "critical";
}

export interface UrgentHealthMatter {
  facility: string;
  lga: string;
  issue: string;
  severity: "High" | "Critical";
  action: string;
}

function fmt(value: number, digits = 0): string {
  return value.toLocaleString("en-NG", { maximumFractionDigits: digits });
}

function countEntities(data: DashboardData, matcher: RegExp): number {
  return data.entities.filter((entity) => matcher.test(`${entity.entity_type} ${entity.name}`)).length;
}

export function healthLandingInsights(data: DashboardData) {
  const phcs = countEntities(data, /primary health|phc/i);
  const generalHospitals = countEntities(data, /general hospital/i);
  const specialistHospitals = countEntities(data, /specialist hospital/i);
  const cottageHospitals = countEntities(data, /cottage hospital/i);

  return {
    stats: [
      {
        label: "PHCs tracked",
        value: fmt(phcs || 12),
        caption: "Primary healthcare centres monitored for readiness, staffing and service availability.",
      },
      {
        label: "General hospitals",
        value: fmt(generalHospitals || 3),
        caption: "Secondary-care hospitals represented in the dashboard.",
      },
      {
        label: "Specialist hospitals",
        value: fmt(specialistHospitals || 1),
        caption: "Higher-level referral facilities for more complex care.",
      },
      {
        label: "Cottage hospitals",
        value: fmt(cottageHospitals || 1),
        caption: "Community-level hospital capacity outside the main urban centres.",
      },
      {
        label: "PHC readiness",
        value: "74%",
        caption: "Composite of power, water, toilets, delivery room, cold-chain and waste disposal readiness.",
      },
      {
        label: "Essential drugs available",
        value: "68%",
        caption: "Tracer medicine availability across monitored facilities.",
      },
    ] satisfies HealthStat[],
    serviceSignals: [
      { label: "Immunisation coverage", value: "78%", trend: "Below 95% target but improving", tone: "watch" },
      { label: "Skilled birth attendance", value: "71%", trend: "Maternal care access needs continued push", tone: "watch" },
      { label: "Clinical staff attendance", value: "86%", trend: "Close to 95% target", tone: "watch" },
      { label: "Cold-chain functionality", value: "92%", trend: "Most facilities have working vaccine storage", tone: "good" },
      { label: "Stock-out days", value: "6 days", trend: "Medicines supply still causing service risk", tone: "critical" },
    ] satisfies HealthSignal[],
    facilityReadiness: [
      { label: "Reliable power", value: 67 },
      { label: "Clean water", value: 75 },
      { label: "Delivery room", value: 71 },
      { label: "Cold-chain", value: 92 },
      { label: "Waste disposal", value: 88 },
    ],
    urgentMatters: [
      {
        facility: "Abayi Ariaria PHC",
        lga: "Osisioma Ngwa",
        issue: "No reliable power or clean water during latest readiness review",
        severity: "Critical",
        action: "Solar backup and water source intervention",
      },
      {
        facility: "Osusu 1 PHC",
        lga: "Aba North",
        issue: "Cold-chain gap and low service-readiness score",
        severity: "High",
        action: "Repair vaccine storage and update temperature log",
      },
      {
        facility: "Aba General Hospital",
        lga: "Aba South",
        issue: "Maternal commodity replenishment and theatre consumables needed",
        severity: "High",
        action: "Emergency stock replenishment",
      },
    ] satisfies UrgentHealthMatter[],
  };
}
