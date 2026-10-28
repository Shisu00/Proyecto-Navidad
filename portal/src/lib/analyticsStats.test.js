import { describe, expect, it } from "vitest";
import {
  buildDailySeries,
  buildWeeklySeries,
  fillSeries,
  normalizeProjectionRows,
  summarizeProjection,
} from "./analyticsStats.js";

describe("series de tiempo", () => {
  it("rellena con cero las semanas sin inscripciones", () => {
    const series = buildWeeklySeries([
      { week_start: "2026-09-28", registered: 5 },
      { week_start: "2026-10-12", registered: 3 },
    ]);
    expect(series.map((p) => p.date)).toEqual(["2026-09-28", "2026-10-05", "2026-10-12"]);
    expect(series.map((p) => p.registered)).toEqual([5, 0, 3]);
    expect(series.map((p) => p.cumulative)).toEqual([5, 5, 8]);
  });

  it("rellena los días de entrega y acumula solo las vigentes", () => {
    const series = buildDailySeries([
      { day: "2026-11-30", delivered: 10, voided: 1 },
      { day: "2026-12-02", delivered: 4, voided: 0 },
    ]);
    expect(series).toHaveLength(3);
    expect(series[1]).toEqual({ date: "2026-12-01", delivered: 0, voided: 0, cumulative: 10 });
    expect(series[2].cumulative).toBe(14);
  });

  it("cruza el cambio de mes sin errores de zona horaria", () => {
    const filled = fillSeries(
      [
        { date: "2026-10-30", n: 1 },
        { date: "2026-11-02", n: 2 },
      ],
      1,
      ["n"],
    );
    expect(filled.map((p) => p.date)).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
  });

  it("devuelve vacío sin datos", () => {
    expect(buildWeeklySeries([])).toEqual([]);
    expect(buildDailySeries(null)).toEqual([]);
  });
});

const row = (overrides) => ({
  territory_id: "t1",
  territory_name: "Norte",
  age_range: "AGE_0_3",
  sex: "FEMALE",
  validated: 10,
  delivered: 4,
  reference_campaign_name: null,
  reference_validated: 0,
  reference_rate: null,
  projected: null,
  ...overrides,
});

describe("proyección de compras", () => {
  it("sin campaña de referencia no proyecta y conserva las tasas actuales", () => {
    const summary = summarizeProjection(normalizeProjectionRows([row({})]));
    expect(summary.hasReference).toBe(false);
    expect(summary.totals.projected).toBeNull();
    expect(summary.totals.validated).toBe(10);
    expect(summary.totals.rate).toBe(0.4);
    expect(summary.segments).toHaveLength(6);
  });

  it("suma la proyección por segmento y por territorio", () => {
    const summary = summarizeProjection(
      normalizeProjectionRows([
        row({ reference_campaign_name: "Navidad 2025", reference_rate: 0.9, projected: 9 }),
        row({
          territory_id: "t2",
          territory_name: "Sur",
          reference_campaign_name: "Navidad 2025",
          reference_rate: 0.8,
          projected: 8,
        }),
      ]),
    );
    expect(summary.hasReference).toBe(true);
    expect(summary.referenceName).toBe("Navidad 2025");
    expect(summary.segments[0].projected).toBe(17);
    expect(summary.totals.projected).toBe(17);
    expect(summary.territories.map((t) => t.projected)).toEqual([9, 8]);
  });

  it("informa los validados de grupos sin referencia", () => {
    const summary = summarizeProjection(
      normalizeProjectionRows([
        row({ reference_campaign_name: "Navidad 2025", reference_rate: 0.9, projected: 9 }),
        row({ sex: "MALE", validated: 6, delivered: 0 }),
      ]),
    );
    expect(summary.unprojectedValidated).toBe(6);
    expect(summary.totals.projected).toBe(9);
  });
});
