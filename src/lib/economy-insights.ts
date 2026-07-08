import type { DashboardData } from "./types";

export interface EconomyStat {
  label: string;
  value: string;
  caption: string;
}

export interface EconomyPipelineItem {
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

export function economyLandingInsights(data: DashboardData) {
  const markets = countEntities(data, /market/i);
  const smeHubs = countEntities(data, /sme hub/i);
  const industrialClusters = countEntities(data, /industrial cluster/i);
  const revenueZones = countEntities(data, /revenue zone/i);
  const monthlyIgr = 3.9;
  const targetIgr = 5;

  return {
    stats: [
      {
        label: "Monthly IGR",
        value: `NGN ${fmt(monthlyIgr, 1)}bn`,
        caption: `Against NGN ${fmt(targetIgr)}bn monthly target.`,
      },
      {
        label: "Major markets tracked",
        value: fmt(markets || 2),
        caption: "Commercial markets that anchor daily trade and revenue activity.",
      },
      {
        label: "SME / enterprise hubs",
        value: fmt(smeHubs || 1),
        caption: "Locations where SME growth, credit access and formalisation can be tracked.",
      },
      {
        label: "Industrial clusters",
        value: fmt(industrialClusters || 1),
        caption: "Production and aggregation clusters for investment conversations.",
      },
      {
        label: "Revenue zones",
        value: fmt(revenueZones || 3),
        caption: "Tax and revenue collection zones represented in the dashboard.",
      },
      {
        label: "New businesses",
        value: fmt(335),
        caption: "Monthly business registrations and formalisation pipeline.",
      },
    ] satisfies EconomyStat[],
    pipeline: [
      { label: "IGR target progress", value: "78%", progress: 78, caption: "Monthly collections versus target." },
      { label: "Collection efficiency", value: "74%", progress: 74, caption: "Assessed collections converted into receipts." },
      { label: "Investor pipeline", value: "NGN 42bn", progress: 68, caption: "Active leads across manufacturing, power and trade." },
      { label: "SME credit access", value: "28%", progress: 28, caption: "SMEs in tracked programmes accessing formal credit." },
    ] satisfies EconomyPipelineItem[],
    tradeHubs: [
      { name: "Ariaria International Market", focus: "Leather, garments and wholesale trade", activity: "High", jobs: 42000 },
      { name: "Umuahia Ubani Main Market", focus: "Food, household goods and retail distribution", activity: "Medium", jobs: 11800 },
      { name: "Aba SME Hub", focus: "Light manufacturing, digital trade and formalisation", activity: "Growing", jobs: 6500 },
      { name: "Ohafia Industrial Cluster", focus: "Agro-processing and local production", activity: "Emerging", jobs: 2800 },
    ],
  };
}
