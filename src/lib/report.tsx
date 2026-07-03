/**
 * PDF "state of things" reports, rendered server-side with @react-pdf/renderer.
 * Serif (Times) headings echo the dashboard's executive styling.
 */
import { join } from "node:path";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Computed } from "./scoring";
import { delta, fmt, fmtValue, ratingFor } from "./scoring";
import type { Lga, Sector } from "./types";

const LOGO_PATH = join(process.cwd(), "public", "abia-logo.png");

const styles = StyleSheet.create({
  page: { padding: 42, fontSize: 9.5, fontFamily: "Helvetica", color: "#27272a" },
  header: {
    marginBottom: 18,
    borderBottom: "1.5 solid #18181b",
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  logo: { width: 52, height: 52 },
  brand: { fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: "#71717a", marginBottom: 6 },
  title: { fontFamily: "Times-Bold", fontSize: 22, color: "#09090b" },
  subtitle: { marginTop: 4, fontSize: 9.5, color: "#52525b" },
  section: { marginTop: 16 },
  sectionTitle: { fontFamily: "Times-Bold", fontSize: 13, marginBottom: 6, color: "#09090b" },
  row: { flexDirection: "row", borderBottom: "0.5 solid #e4e4e7", paddingVertical: 4.5, alignItems: "center" },
  headRow: { flexDirection: "row", borderBottom: "1 solid #18181b", paddingVertical: 4, marginTop: 2 },
  headCell: { fontFamily: "Helvetica-Bold", fontSize: 8, textTransform: "uppercase", letterSpacing: 0.5, color: "#52525b" },
  big: { fontFamily: "Times-Bold", fontSize: 30, color: "#09090b" },
  ratingChip: { fontSize: 8.5, fontFamily: "Helvetica-Bold" },
  footer: {
    position: "absolute", bottom: 24, left: 42, right: 42,
    fontSize: 8, color: "#a1a1aa", flexDirection: "row", justifyContent: "space-between",
    borderTop: "0.5 solid #e4e4e7", paddingTop: 6,
  },
  summaryBox: {
    flexDirection: "row", gap: 24, alignItems: "center",
    backgroundColor: "#fafafa", border: "0.5 solid #e4e4e7", borderRadius: 6, padding: 14,
  },
});

function ratingColor(score: number | null): string {
  return ratingFor(score).color;
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.header}>
      {/* React PDF's Image is not a DOM image, so the jsx-a11y alt rule does not apply. */}
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <Image src={LOGO_PATH} style={styles.logo} />
      <View style={{ flex: 1 }}>
        <Text style={styles.brand}>The Government of Abia State · Executive Dashboard</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

function Footer({ generatedAt }: { generatedAt: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text>Generated {generatedAt} · Abia State Dashboard</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}

function Summary({ label, score, note }: { label: string; score: number | null; note: string }) {
  return (
    <View style={styles.summaryBox}>
      <View>
        <Text style={styles.big}>{score == null ? "—" : fmt(score, 1)}</Text>
        <Text style={[styles.ratingChip, { color: ratingColor(score) }]}>
          {ratingFor(score).label.toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10, marginBottom: 3 }}>{label}</Text>
        <Text style={{ color: "#52525b", lineHeight: 1.5 }}>{note}</Text>
      </View>
    </View>
  );
}

interface Col {
  label: string;
  width: number | string;
  align?: "left" | "right";
}

function Table({ cols, rows }: { cols: Col[]; rows: Array<Array<{ text: string; color?: string; bold?: boolean }>> }) {
  return (
    <View>
      <View style={styles.headRow}>
        {cols.map((c, i) => (
          <Text key={i} style={[styles.headCell, { width: c.width, textAlign: c.align ?? "left" }]}>
            {c.label}
          </Text>
        ))}
      </View>
      {rows.map((cells, r) => (
        <View key={r} style={styles.row} wrap={false}>
          {cells.map((cell, i) => (
            <Text
              key={i}
              style={{
                width: cols[i].width,
                textAlign: cols[i].align ?? "left",
                color: cell.color ?? "#27272a",
                fontFamily: cell.bold ? "Helvetica-Bold" : "Helvetica",
                paddingRight: 6,
              }}
            >
              {cell.text}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function generatedAt(): string {
  return new Date().toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });
}

function deltaText(pair: { score: number | null; prevScore: number | null }): string {
  const d = delta(pair);
  if (d == null) return "—";
  if (Math.abs(d) < 0.05) return "steady";
  // stick to Helvetica-safe glyphs — arrows render as substitution chars in PDF
  return `${d > 0 ? "+" : "-"}${fmt(Math.abs(d), 1)} pts`;
}

/* ------------------------------------------------------------------ */

export function StateReport({ c }: { c: Computed }) {
  const attention = [...c.indicators]
    .filter((i) => i.score != null)
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
    .slice(0, 8);
  const lgas = c.lgaScores.filter((l) => l.score != null);

  return (
    <Document title="State of Abia — Executive Report">
      <Page size="A4" style={styles.page}>
        <Header
          title="The State of Abia"
          subtitle={`Whole-of-government performance summary · ${generatedAt()}`}
        />
        <Summary
          label="Abia State Performance Index"
          score={c.stateScore.score}
          note={`Composite of ${c.indicators.length} indicators across ${c.data.sectors.length} sectors, scored 0–100 against WHO, SDG and State Plan targets. Change vs previous period: ${deltaText(c.stateScore)}.`}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sector performance</Text>
          <Table
            cols={[
              { label: "Sector", width: "40%" },
              { label: "Score", width: "15%", align: "right" },
              { label: "Rating", width: "20%", align: "right" },
              { label: "Change", width: "25%", align: "right" },
            ]}
            rows={c.data.sectors.map((s) => {
              const pair = c.sectorScores.get(s.id) ?? { score: null, prevScore: null };
              return [
                { text: s.name, bold: true },
                { text: pair.score == null ? "—" : fmt(pair.score, 1) },
                { text: ratingFor(pair.score).label, color: ratingColor(pair.score) },
                { text: deltaText(pair) },
              ];
            })}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>LGA composite ranking</Text>
          <Table
            cols={[
              { label: "#", width: "8%" },
              { label: "Local Government Area", width: "42%" },
              { label: "Zone", width: "25%" },
              { label: "Score", width: "12%", align: "right" },
              { label: "Rating", width: "13%", align: "right" },
            ]}
            rows={lgas.map((l, i) => [
              { text: String(i + 1) },
              { text: l.lga.name, bold: true },
              { text: l.lga.zone },
              { text: fmt(l.score, 1) },
              { text: ratingFor(l.score).label, color: ratingColor(l.score) },
            ])}
          />
        </View>

        <View style={styles.section} break>
          <Text style={styles.sectionTitle}>Indicators requiring attention</Text>
          <Table
            cols={[
              { label: "Indicator", width: "34%" },
              { label: "Sector", width: "16%" },
              { label: "Abia", width: "14%", align: "right" },
              { label: "Nigeria", width: "13%", align: "right" },
              { label: "Target", width: "13%", align: "right" },
              { label: "Score", width: "10%", align: "right" },
            ]}
            rows={attention.map((i) => [
              { text: i.indicator.name, bold: true },
              { text: i.sector.name },
              { text: fmtValue(i.latest?.abia ?? null, i.indicator.unit) },
              { text: fmtValue(i.latest?.nigeria ?? null, i.indicator.unit) },
              { text: fmtValue(i.latest?.target ?? null, i.indicator.unit) },
              { text: i.score == null ? "—" : fmt(i.score, 0), color: ratingColor(i.score) },
            ])}
          />
        </View>
        <Footer generatedAt={generatedAt()} />
      </Page>
    </Document>
  );
}

export function SectorReport({ c, sector }: { c: Computed; sector: Sector }) {
  const pair = c.sectorScores.get(sector.id) ?? { score: null, prevScore: null };
  const thematics = c.data.thematicAreas.filter((t) => t.sector_id === sector.id);
  const mdas = c.mdaScores.filter((m) => m.sector.id === sector.id);
  const indicators = c.indicators.filter((i) => i.sector.id === sector.id);

  return (
    <Document title={`State of ${sector.name} — Abia State`}>
      <Page size="A4" style={styles.page}>
        <Header
          title={`The State of ${sector.name}`}
          subtitle={`Sector performance report · ${generatedAt()}`}
        />
        <Summary
          label={`${sector.name} sector composite`}
          score={pair.score}
          note={`Weighted roll-up of ${thematics.length} thematic areas, ${indicators.length} indicators and ${mdas.length} MDAs. Change vs previous period: ${deltaText(pair)}.`}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ministries, Departments & Agencies</Text>
          <Table
            cols={[
              { label: "MDA", width: "55%" },
              { label: "Entities", width: "15%", align: "right" },
              { label: "Score", width: "15%", align: "right" },
              { label: "Rating", width: "15%", align: "right" },
            ]}
            rows={mdas.map((m) => [
              { text: `${m.mda.name} (${m.mda.abbreviation})`, bold: true },
              { text: String(m.entityCount) },
              { text: m.score == null ? "—" : fmt(m.score, 1) },
              { text: ratingFor(m.score).label, color: ratingColor(m.score) },
            ])}
          />
        </View>

        {thematics.map((ta) => {
          const taPair = c.thematicScores.get(ta.id) ?? { score: null, prevScore: null };
          const taIndicators = indicators.filter((i) => i.thematicArea.id === ta.id);
          return (
            <View key={ta.id} style={styles.section}>
              <Text style={styles.sectionTitle}>
                {ta.name} — {taPair.score == null ? "—" : fmt(taPair.score, 1)} ({ratingFor(taPair.score).label})
              </Text>
              <Table
                cols={[
                  { label: "Indicator", width: "32%" },
                  { label: "Domain", width: "18%" },
                  { label: "Abia", width: "14%", align: "right" },
                  { label: "Nigeria", width: "13%", align: "right" },
                  { label: "Target", width: "13%", align: "right" },
                  { label: "Score", width: "10%", align: "right" },
                ]}
                rows={taIndicators.map((i) => [
                  { text: i.indicator.name, bold: true },
                  { text: i.domain.name },
                  { text: fmtValue(i.latest?.abia ?? null, i.indicator.unit) },
                  { text: fmtValue(i.latest?.nigeria ?? null, i.indicator.unit) },
                  { text: fmtValue(i.latest?.target ?? null, i.indicator.unit) },
                  { text: i.score == null ? "—" : fmt(i.score, 0), color: ratingColor(i.score) },
                ])}
              />
            </View>
          );
        })}
        <Footer generatedAt={generatedAt()} />
      </Page>
    </Document>
  );
}

export function LgaReport({ c, lga }: { c: Computed; lga: Lga }) {
  const lc = c.lgaScores.find((l) => l.lga.id === lga.id);
  const entities = c.entityScores.filter((e) => e.lga.id === lga.id);
  const rank = c.lgaScores.filter((l) => l.score != null).findIndex((l) => l.lga.id === lga.id);

  return (
    <Document title={`State of ${lga.name} LGA — Abia State`}>
      <Page size="A4" style={styles.page}>
        <Header
          title={`The State of ${lga.name}`}
          subtitle={`Local Government Area report · ${lga.zone} · ${generatedAt()}`}
        />
        <Summary
          label={`${lga.name} composite score`}
          score={lc?.score ?? null}
          note={`${rank >= 0 ? `Ranked ${rank + 1} of ${c.lgaScores.filter((l) => l.score != null).length} LGAs. ` : ""}Aggregated from ${lc?.readings ?? 0} latest readings across ${entities.length} measured entities. Change vs previous period: ${lc ? deltaText(lc) : "—"}.`}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Measured entities in {lga.name}</Text>
          <Table
            cols={[
              { label: "Entity", width: "38%" },
              { label: "Type", width: "20%" },
              { label: "MDA", width: "14%" },
              { label: "Readings", width: "13%", align: "right" },
              { label: "Score", width: "15%", align: "right" },
            ]}
            rows={entities.map((e) => [
              { text: e.entity.name, bold: true },
              { text: e.entity.entity_type },
              { text: e.mda.abbreviation },
              { text: String(e.readings) },
              { text: e.score == null ? "—" : fmt(e.score, 1), color: ratingColor(e.score) },
            ])}
          />
        </View>
        <Footer generatedAt={generatedAt()} />
      </Page>
    </Document>
  );
}
