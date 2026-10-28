import { describe, expect, it } from "vitest";
import { isoDateToCsv, csvFilename } from "./csv.js";
import { buildDeliveriesCsv, buildInscriptionsCsv, deliveryReportRow, inscriptionReportRow } from "./reportExport.js";
import { labels } from "./labels.js";

const inscription = {
  id: "i1",
  created_at: "2026-10-27T21:30:05Z",
  council_name: "JJVV Centro",
  territory_name: "Norte",
  beneficiary_id_type: "RUT",
  beneficiary_id_number: "123456785",
  sex: "FEMALE",
  birth_date: "2020-03-05",
  age_at_cutoff: 6,
  age_range: "AGE_4_7",
  guardian_full_name: "Ana Pérez",
  guardian_id_number: "111111111",
  guardian_email: "ana@example.cl",
  guardian_phone: "+56912345678",
  display_status: "DELIVERED",
  has_observation: false,
  open_cases_count: 0,
  duplicate_justification: null,
  delivered_at: "2026-12-01T15:00:00Z",
};

describe("informe de inscripciones", () => {
  it("lleva el RUN del niño y del adulto y una columna por encabezado", () => {
    const row = inscriptionReportRow(inscription);
    expect(row).toHaveLength(labels.reports.inscriptionHeaders.length);
    expect(row[5]).toBe("12.345.678-5");
    expect(row[7]).toBe("05-03-2020");
    expect(row[11]).toBe("11.111.111-1");
    expect(row[14]).toBe("Entregado");
    expect(row[15]).toBe("No");
  });

  it("neutraliza fórmulas en teléfonos que empiezan con +", () => {
    const csv = buildInscriptionsCsv([inscription]);
    expect(csv).toContain("'+56912345678");
  });

  it("deja vacías las fechas de entrega si no hay entrega", () => {
    const row = inscriptionReportRow({ ...inscription, delivered_at: null });
    expect(row.slice(-2)).toEqual(["", ""]);
  });
});

describe("informe de entregas", () => {
  const delivery = {
    id: "d1",
    delivered_at: "2026-12-01T15:00:00Z",
    council_name: "JJVV Centro",
    territory_name: "Norte",
    withdrawal_type: "STANDARD",
    withdrawer_id_number: "111111111",
    beneficiary_id_type: "RUT",
    beneficiary_id_number: "123456785",
    guardian_full_name: "Ana Pérez",
    guardian_id_number: "111111111",
    delivered_by_name: "Luis Soto",
    observation: null,
    responsibility_confirmed: false,
    scanned_from_id_card: true,
    is_voided: false,
    voided_at: null,
    voided_by_name: null,
    void_reason: null,
  };

  it("incluye el RUN de quien retira y marca la entrega vigente", () => {
    const row = deliveryReportRow(delivery);
    expect(row).toHaveLength(labels.reports.deliveryHeaders.length);
    expect(row[5]).toBe("11.111.111-1");
    expect(row[7]).toBe("12.345.678-5");
    expect(row[13]).toBe("Sí");
    expect(row[14]).toBe("Vigente");
  });

  it("marca las anuladas con su motivo", () => {
    const row = deliveryReportRow({
      ...delivery,
      is_voided: true,
      voided_at: "2026-12-02T10:00:00Z",
      voided_by_name: "Ana",
      void_reason: "Retiro erróneo",
    });
    expect(row[14]).toBe("Anulada");
    expect(row[18]).toBe("Retiro erróneo");
  });

  it("ordena la más reciente primero", () => {
    const older = { ...delivery, id: "d0", delivered_at: "2026-11-30T15:00:00Z", council_name: "Antigua" };
    const csv = buildDeliveriesCsv([older, delivery]);
    expect(csv.indexOf("JJVV Centro")).toBeLessThan(csv.indexOf("Antigua"));
  });
});

describe("utilidades de CSV", () => {
  it("convierte fechas ISO sin zona horaria", () => {
    expect(isoDateToCsv("2020-03-05")).toBe("05-03-2020");
    expect(isoDateToCsv(null)).toBe("");
  });

  it("arma el nombre del archivo", () => {
    expect(csvFilename("inscripciones", "Navidad 2026", new Date(2026, 9, 27))).toBe(
      "inscripciones_navidad-2026_2026-10-27.csv",
    );
  });
});
