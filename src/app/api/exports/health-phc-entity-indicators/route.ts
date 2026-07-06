import ExcelJS from "exceljs";
import { loadDashboardData } from "@/lib/datasource";
import { resolveIndicatorScoreOptions } from "@/lib/indicator-input";
import type { Indicator } from "@/lib/types";

function questionKey(name: string): [number, number, string] {
  const match = name.match(/^(\d+)\.(\d+)\s+/);
  if (!match) return [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, name];
  return [Number(match[1]), Number(match[2]), name];
}

function displayValueType(valueType: string): string {
  if (valueType === "score") return "Score";
  if (valueType === "percentage") return "Percentage";
  return "Number";
}

function formatOptionsOrUnit(indicator: Indicator): string {
  if (indicator.value_type === "score") {
    const options = resolveIndicatorScoreOptions(indicator);
    if (options?.length) {
      return options
        .map((option) => `${option.code ? `${option.code}. ` : ""}${option.label} = ${option.value}`)
        .join(" | ");
    }
  }
  return indicator.unit;
}

export async function GET() {
  const data = await loadDashboardData();

  const healthSector = data.sectors.find((sector) => sector.slug === "health");
  if (!healthSector) {
    return new Response("Health sector not found.", { status: 404 });
  }

  const thematicArea = data.thematicAreas.find(
    (item) =>
      item.sector_id === healthSector.id && item.name === "Primary Healthcare Facilities (PHCs)"
  );
  if (!thematicArea) {
    return new Response("PHC thematic area not found.", { status: 404 });
  }

  const asphcda = data.mdas.find(
    (mda) =>
      mda.abbreviation === "ASPHCDA" ||
      mda.name.toLowerCase().includes("primary health care development agency")
  );
  if (!asphcda) {
    return new Response("ASPHCDA MDA not found.", { status: 404 });
  }

  const entities = [...data.entities]
    .filter((entity) => entity.mda_id === asphcda.id)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));

  const domains = [...data.domains]
    .filter((domain) => domain.thematic_area_id === thematicArea.id)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));

  const indicatorsByDomain = new Map(
    domains.map((domain) => [
      domain.id,
      [...data.indicators]
        .filter(
          (indicator) => indicator.domain_id === domain.id && indicator.indicator_scope === "entity"
        )
        .sort((a, b) => {
          const [ad, aq, an] = questionKey(a.name);
          const [bd, bq, bn] = questionKey(b.name);
          return ad - bd || aq - bq || an.localeCompare(bn);
        }),
    ])
  );

  const latestPeriod =
    [...data.timePeriods]
      .filter((period) => period.frequency === thematicArea.frequency)
      .sort((a, b) => b.start_date.localeCompare(a.start_date))[0] ?? null;

  const resultsByKey = new Map<string, number | null>();
  if (latestPeriod) {
    for (const result of data.results) {
      if (result.time_period_id !== latestPeriod.id || result.entity_id == null) continue;
      resultsByKey.set(`${result.indicator_id}|${result.entity_id}`, result.abia_value);
    }
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Cursor";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("PHC Entity Indicators", {
    views: [{ state: "frozen", ySplit: 4, xSplit: 3 }],
  });

  const totalColumns = 3 + entities.length;

  sheet.mergeCells(1, 1, 1, totalColumns);
  sheet.getCell(1, 1).value = thematicArea.name;
  sheet.getCell(1, 1).font = { bold: true, size: 16 };
  sheet.getCell(1, 1).alignment = { vertical: "middle" };

  sheet.mergeCells(2, 1, 2, totalColumns);
  sheet.getCell(2, 1).value = latestPeriod
    ? `Reporting period: ${latestPeriod.label}`
    : "Reporting period: none available";
  sheet.getCell(2, 1).font = { italic: true, color: { argb: "FF666666" } };

  sheet.getRow(4).values = [
    "Question",
    "Value type",
    "Options / unit",
    ...entities.map((entity) => entity.name),
  ];
  sheet.getRow(4).font = { bold: true };
  sheet.getRow(4).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF4F4F5" },
  };
  sheet.getRow(4).alignment = { vertical: "middle", wrapText: true };

  let rowIndex = 5;
  for (const domain of domains) {
    const indicators = indicatorsByDomain.get(domain.id) ?? [];
    if (indicators.length === 0) continue;

    sheet.mergeCells(rowIndex, 1, rowIndex, totalColumns);
    const domainCell = sheet.getCell(rowIndex, 1);
    domainCell.value = domain.name;
    domainCell.font = { bold: true, color: { argb: "FF111827" } };
    domainCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFAFAFA" },
    };
    rowIndex += 1;

    for (const indicator of indicators) {
      const row = [
        indicator.name,
        displayValueType(indicator.value_type),
        formatOptionsOrUnit(indicator),
        ...entities.map((entity) => resultsByKey.get(`${indicator.id}|${entity.id}`) ?? null),
      ];
      sheet.getRow(rowIndex).values = row;
      sheet.getRow(rowIndex).alignment = { vertical: "top", wrapText: true };
      rowIndex += 1;
    }
  }

  sheet.columns = [
    { width: 52 },
    { width: 14 },
    { width: 34 },
    ...entities.map(() => ({ width: 18 })),
  ];

  for (let col = 4; col <= totalColumns; col++) {
    sheet.getColumn(col).numFmt = "0.00";
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `health-phc-entity-indicators-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
