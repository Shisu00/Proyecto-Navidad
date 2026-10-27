import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv.js";
import { auditEntryToCsvRow, auditExportFilename, splitLocalDateTime } from "./auditExport.js";

describe("csvCell", () => {
  it("cita los campos con ; comillas o saltos de línea", () => {
    expect(csvCell("a;b")).toBe('"a;b"');
    expect(csvCell('dijo "hola"')).toBe('"dijo ""hola"""');
    expect(csvCell("línea 1\nlínea 2")).toBe('"línea 1\nlínea 2"');
  });

  it("neutraliza textos que Excel leería como fórmula", () => {
    expect(csvCell("=SUMA(A1:A2)")).toBe("'=SUMA(A1:A2)");
    expect(csvCell("@usuario")).toBe("'@usuario");
    expect(csvCell("+56 9 1234")).toBe("'+56 9 1234");
  });

  it("deja vacíos null y undefined", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });
});

describe("toCsv", () => {
  it("usa ; BOM UTF-8 y saltos CRLF", () => {
    const csv = toCsv(["a", "b"], [["1", "x;y"]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe('﻿a;b\r\n1;"x;y"\r\n');
  });
});

describe("exportación de auditoría", () => {
  const councilNames = new Map([["c1", "JJVV Centro"]]);
  const entry = {
    id: 1,
    occurred_at: "2026-10-27T21:30:05Z",
    actor_user_id: "u1",
    actorName: "Ana Pérez",
    action: "INSCRIPTION_VALIDATED",
    entity_type: "inscriptions",
    entity_id: "11111111-2222-3333-4444-555555555555",
    previous_state: { status: "OBSERVED", guardian_id: "g1" },
    new_state: { status: "VALIDATED", guardian_id: "g1" },
    reason: "Datos verificados",
  };

  it("arma una fila con las 10 columnas y sin datos personales", () => {
    const row = auditEntryToCsvRow(entry, { councilNames });
    expect(row).toHaveLength(10);
    expect(row[2]).toBe("Ana Pérez");
    expect(row[3]).toBe("Inscripciones");
    expect(row[6]).toBe("11111111-2222-3333-4444-555555555555");
    expect(row[7]).toBe("Datos verificados");
    expect(row[9]).toContain("Estado:");
    expect(row[9]).not.toContain("guardian");
  });

  it("nombra el archivo sin tildes ni espacios", () => {
    expect(auditExportFilename("Campañas y catálogos", new Date(2026, 9, 27))).toBe(
      "auditoria_campanas-y-catalogos_2026-10-27.csv",
    );
  });

  it("separa fecha y hora locales", () => {
    const { day, time } = splitLocalDateTime("2026-10-27T21:30:05Z");
    expect(day).toMatch(/^\d{2}-\d{2}-\d{4}$/);
    expect(time).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });
});
