// Regression checks for indicator collection levels and roll-ups in
// src/lib/scoring.ts. Run with `yarn check:rollups`; exits non-zero on failure.
import { computeDashboard } from "../src/lib/scoring";
import { describeSource } from "../src/lib/indicator-collection";
import type { DashboardData, Indicator, Result } from "../src/lib/types";

const q1 = { id: "p1", frequency: "quarterly" as const, label: "2026 Q1", start_date: "2026-01-01", end_date: "2026-03-31" };
const q2 = { id: "p2", frequency: "quarterly" as const, label: "2026 Q2", start_date: "2026-04-01", end_date: "2026-06-30" };
const base = (id: string, extra: Partial<Indicator>): Indicator => ({
  id, domain_id: "d1", name: id, unit: "%", direction: "higher_is_better", target_value: 80,
  target_source: null, weight: 1, value_type: "percentage", frequency: "quarterly", ...extra,
});
const r = (id: string, ind: string, p: string, v: number, extra: Partial<Result> = {}): Result => ({
  id, indicator_id: ind, time_period_id: p, entity_id: null, lga_id: null, abia_value: v,
  nigeria_value: null, target_value: null, ...extra,
});
const data: DashboardData = {
  sectors: [{ id: "s1", slug: "health", name: "Health", description: "", icon: "", color: "#000", sort_order: 0 }],
  lgas: [
    { id: "L1", name: "Aba North", zone: "Abia South", population: 100 },
    { id: "L2", name: "Umuahia", zone: "Abia Central", population: 300 },
  ],
  mdas: [{ id: "m1", sector_id: "s1", name: "SMoH", abbreviation: "SMoH", description: "" }],
  entities: [
    { id: "E1", mda_id: "m1", lga_id: "L1", name: "PHC 1", entity_type: "PHC" },
    { id: "E2", mda_id: "m1", lga_id: "L1", name: "PHC 2", entity_type: "PHC" },
    { id: "E3", mda_id: "m1", lga_id: "L2", name: "PHC 3", entity_type: "PHC" },
    { id: "E4", mda_id: "m1", lga_id: "L2", name: "PHC 4 (not reporting)", entity_type: "PHC" },
  ],
  thematicAreas: [{ id: "t1", sector_id: "s1", name: "TA", description: "", frequency: "quarterly", weight: 1, is_sector_dashboard: false }],
  domains: [{ id: "d1", thematic_area_id: "t1", name: "Dom", weight: 1 }],
  indicators: [
    base("state", { collected_at: "state" }),
    base("lgaWeighted", { collected_at: "lga", rollup_method: "weighted_average" }),
    base("lgaSum", { collected_at: "lga", rollup_method: "sum", unit: "beds", target_value: 400 }),
    base("facAvg", { collected_at: "facility", rollup_method: "average" }),
    base("facCount", { collected_at: "facility", rollup_method: "count", count_operator: "gte", count_threshold: 50, target_value: 4 }),
    base("facMax", { collected_at: "facility", rollup_method: "max" }),
    base("facNone", { collected_at: "facility", rollup_method: "none" }),
    base("override", { collected_at: "lga", rollup_method: "average" }),
  ],
  timePeriods: [q1, q2],
  results: [
    r("a", "state", "p2", 60),
    r("b1", "lgaWeighted", "p2", 40, { lga_id: "L1" }), r("b2", "lgaWeighted", "p2", 80, { lga_id: "L2" }),
    r("c1", "lgaSum", "p2", 100, { lga_id: "L1" }), r("c2", "lgaSum", "p2", 150, { lga_id: "L2" }),
    ...["facAvg", "facCount", "facMax", "facNone"].flatMap((ind) => [
      r(`${ind}1`, ind, "p2", 30, { entity_id: "E1" }), r(`${ind}2`, ind, "p2", 60, { entity_id: "E2" }),
      r(`${ind}3`, ind, "p2", 90, { entity_id: "E3" }),
    ]),
    r("o1", "override", "p2", 20, { lga_id: "L1" }), r("o2", "override", "p2", 40, { lga_id: "L2" }),
    r("o3", "override", "p2", 75, { entered_by: "A. Okafor", override_note: "LGA returns incomplete", updated_at: "2026-07-03T10:00:00Z" }),
    r("o4", "override", "p1", 10, { lga_id: "L1" }),
  ],
  evidence: [], dashboards: [], dashboardWidgets: [], sectorFacts: [], mode: "live", supabaseConfigured: true,
};

const c = computeDashboard(data);
const latest = (id: string) => c.indicatorById.get(id)!.latest!;
let failures = 0;
const check = (label: string, got: unknown, want: unknown) => {
  const ok = typeof want === "number" ? Math.abs(Number(got) - want) < 1e-6 : got === want;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(got)}${ok ? "" : ` want ${JSON.stringify(want)}`}`);
};
check("state entered", latest("state").source, "entered");
check("lga weighted avg (40*100+80*300)/400", latest("lgaWeighted").abia, 70);
check("lga weighted coverage", latest("lgaWeighted").rollup?.coverage.reported, 2);
check("lga weighted expected", latest("lgaWeighted").rollup?.coverage.expected, 2);
check("lga sum", latest("lgaSum").abia, 250);
check("lga sum score 250/400", latest("lgaSum").score, 62.5);
check("facility average", latest("facAvg").abia, 60);
check("facility coverage 3 of 4", `${latest("facAvg").rollup?.coverage.reported}/${latest("facAvg").rollup?.coverage.expected}`, "3/4");
check("facility count >=50", latest("facCount").abia, 2);
check("facility max", latest("facMax").abia, 90);
check("facility none has no statewide value", c.indicatorById.get("facNone")!.latest, null);
check("facility none not in state", c.indicatorById.get("facNone")!.reportsAtState, false);
check("override wins", latest("override").abia, 75);
check("override source", latest("override").source, "override");
check("override keeps roll-up", latest("override").rollup?.value, 30);
check("override previous period is roll-up", c.indicatorById.get("override")!.previous?.source, "rollup");
check("override label", describeSource(latest("override")), "Manual override · A. Okafor · 3 Jul 2026 — LGA returns incomplete");
check("rollup label", describeSource(latest("facAvg")), "Rolled up (average) from 3 of 4 facilities");
const l1 = c.lgaIndicators.filter((v) => v.lga.id === "L1");
check("L1 facAvg value", l1.find((v) => v.ic.indicator.id === "facAvg")?.value, 45);
check("L1 facNone averages facility scores ((30/80*100)+(60/80*100))/2", l1.find((v) => v.ic.indicator.id === "facNone")?.score, 56.25);
check("L1 lgaSum target by population 400*100/400", l1.find((v) => v.ic.indicator.id === "lgaSum")?.target, 100);
check("L1 composite has values", (c.lgaScores.find((l) => l.lga.id === "L1")?.readings ?? 0) > 0, true);
check("E1 entity score (facCount 0, others scored)", c.entityScores.find((e) => e.entity.id === "E1")!.readings, 4);
console.log(failures ? `\n${failures} FAILED` : "\nALL SCORING CHECKS PASSED");
process.exit(failures ? 1 : 0);
