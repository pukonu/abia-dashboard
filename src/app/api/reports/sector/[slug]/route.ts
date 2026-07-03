import { renderToBuffer } from "@react-pdf/renderer";
import { loadDashboardData } from "@/lib/datasource";
import { SectorReport } from "@/lib/report";
import { computeDashboard } from "@/lib/scoring";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const data = await loadDashboardData();
  const sector = data.sectors.find((s) => s.slug === slug);
  if (!sector) return new Response("Sector not found", { status: 404 });

  const c = computeDashboard(data);
  const buffer = await renderToBuffer(SectorReport({ c, sector }));
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="state-of-${sector.slug}-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
