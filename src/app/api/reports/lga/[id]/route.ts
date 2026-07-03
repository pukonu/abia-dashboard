import { renderToBuffer } from "@react-pdf/renderer";
import { loadDashboardData } from "@/lib/datasource";
import { LgaReport } from "@/lib/report";
import { computeDashboard } from "@/lib/scoring";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const data = await loadDashboardData();
  const lga = data.lgas.find((l) => l.id === id);
  if (!lga) return new Response("LGA not found", { status: 404 });

  const c = computeDashboard(data);
  const buffer = await renderToBuffer(LgaReport({ c, lga }));
  const slug = lga.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="state-of-${slug}-lga-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
