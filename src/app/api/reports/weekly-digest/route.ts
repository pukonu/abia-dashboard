import { renderToBuffer } from "@react-pdf/renderer";
import { loadDashboardData } from "@/lib/datasource";
import { WeeklyDigestReport } from "@/lib/report";
import { computeDashboard } from "@/lib/scoring";

/** Preview / download the combined weekly digest PDF (state + all sectors). */
export async function GET() {
  const data = await loadDashboardData();
  const c = computeDashboard(data);
  const buffer = await renderToBuffer(WeeklyDigestReport({ c }));
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="abia-weekly-digest-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
