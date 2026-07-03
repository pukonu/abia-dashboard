import { renderToBuffer } from "@react-pdf/renderer";
import { loadDashboardData } from "@/lib/datasource";
import { StateReport } from "@/lib/report";
import { computeDashboard } from "@/lib/scoring";

export async function GET() {
  const data = await loadDashboardData();
  const c = computeDashboard(data);
  const buffer = await renderToBuffer(StateReport({ c }));
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="state-of-abia-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
