import { AGE_RANGES, SEXES } from "./dashboardStats.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const toNullableNumber = (value) => (value === null || value === undefined ? null : toNumber(value));

// Fechas "yyyy-mm-dd" operadas en UTC para que la zona horaria del navegador no las corra
function addDays(isoDate, days) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day) + days * DAY_MS).toISOString().slice(0, 10);
}

// Rellena con ceros los periodos sin actividad, para que el gráfico muestre las pausas
export function fillSeries(rows, stepDays, valueKeys) {
  if (rows.length === 0) return [];
  const byDate = new Map(rows.map((row) => [row.date, row]));
  const dates = rows.map((row) => row.date).sort();
  const filled = [];
  for (let date = dates[0]; date <= dates[dates.length - 1]; date = addDays(date, stepDays)) {
    const found = byDate.get(date);
    filled.push({
      date,
      ...Object.fromEntries(valueKeys.map((key) => [key, found?.[key] ?? 0])),
    });
  }
  return filled;
}

export function normalizeWeeklyRows(data) {
  return (data ?? []).map((row) => ({ date: row.week_start, registered: toNumber(row.registered) }));
}

export function normalizeDailyRows(data) {
  return (data ?? []).map((row) => ({
    date: row.day,
    delivered: toNumber(row.delivered),
    voided: toNumber(row.voided),
  }));
}

export function buildWeeklySeries(data) {
  return withTotal(fillSeries(normalizeWeeklyRows(data), 7, ["registered"]), "registered");
}

export function buildDailySeries(data) {
  return withTotal(fillSeries(normalizeDailyRows(data), 1, ["delivered", "voided"]), "delivered");
}

// Acumulado de la columna principal, para ver el avance contra el total
function withTotal(series, key) {
  let running = 0;
  return series.map((point) => {
    running += point[key];
    return { ...point, cumulative: running };
  });
}

export function normalizeProjectionRows(data) {
  return (data ?? []).map((row) => ({
    territoryId: row.territory_id,
    territoryName: row.territory_name,
    ageRange: row.age_range,
    sex: row.sex,
    validated: toNumber(row.validated),
    delivered: toNumber(row.delivered),
    referenceName: row.reference_campaign_name ?? null,
    referenceValidated: toNumber(row.reference_validated),
    referenceRate: toNullableNumber(row.reference_rate),
    projected: toNullableNumber(row.projected),
  }));
}

const rate = (delivered, validated) => (validated > 0 ? delivered / validated : null);

// Proyección agregada por rango etario y sexo (lo que se licita) y por territorio (detalle).
// Un segmento sin referencia no suma a la proyección: sus validados se informan aparte.
export function summarizeProjection(rows) {
  const referenceName = rows.find((row) => row.referenceName)?.referenceName ?? null;
  const hasReference = rows.some((row) => row.referenceRate !== null);

  const segments = new Map(
    AGE_RANGES.flatMap((ageRange) =>
      SEXES.map((sex) => [`${ageRange}|${sex}`, { ageRange, sex, validated: 0, delivered: 0, projected: 0 }]),
    ),
  );
  const territories = new Map();
  let unprojectedValidated = 0;

  for (const row of rows) {
    const segment = segments.get(`${row.ageRange}|${row.sex}`);
    if (!segment) continue;

    segment.validated += row.validated;
    segment.delivered += row.delivered;

    const territory = territories.get(row.territoryId) ?? {
      id: row.territoryId,
      name: row.territoryName,
      validated: 0,
      delivered: 0,
      projected: 0,
    };
    territory.validated += row.validated;
    territory.delivered += row.delivered;
    territories.set(row.territoryId, territory);

    if (row.projected !== null) {
      segment.projected += row.projected;
      territory.projected += row.projected;
    } else {
      unprojectedValidated += row.validated;
    }
  }

  const finish = (item) => ({
    ...item,
    rate: rate(item.delivered, item.validated),
    projected: hasReference ? item.projected : null,
  });
  const segmentList = [...segments.values()].map(finish);
  const territoryList = [...territories.values()]
    .sort((a, b) => a.name.localeCompare(b.name, "es"))
    .map(finish);

  const totals = finish(
    segmentList.reduce(
      (sum, item) => ({
        validated: sum.validated + item.validated,
        delivered: sum.delivered + item.delivered,
        projected: sum.projected + (item.projected ?? 0),
      }),
      { validated: 0, delivered: 0, projected: 0 },
    ),
  );

  return {
    referenceName,
    hasReference,
    unprojectedValidated: hasReference ? unprojectedValidated : 0,
    segments: segmentList,
    territories: territoryList,
    totals,
  };
}
