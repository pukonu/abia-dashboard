import type { ThematicArea } from "./types";

/** True when this thematic area is the sector's executive dashboard framework. */
export function isSectorDashboardThematic(t: Pick<ThematicArea, "is_sector_dashboard" | "name">): boolean {
  if (t.is_sector_dashboard) return true;
  // Legacy fallback for data loaded before the flag migration.
  return t.name.trim().toLowerCase() === "sector dashboard";
}

/** The single sector-dashboard thematic area for a sector, if configured. */
export function sectorDashboardThematic(
  thematicAreas: ThematicArea[],
  sectorId: string
): ThematicArea | null {
  return (
    thematicAreas.find((t) => t.sector_id === sectorId && t.is_sector_dashboard) ??
    thematicAreas.find((t) => t.sector_id === sectorId && isSectorDashboardThematic(t)) ??
    null
  );
}

/** Sectors that have a flagged sector-dashboard thematic area. */
export function sectorsWithSectorDashboard(
  sectors: Array<{ id: string }>,
  thematicAreas: ThematicArea[]
): string[] {
  return sectors
    .filter((s) => sectorDashboardThematic(thematicAreas, s.id) != null)
    .map((s) => s.id);
}
