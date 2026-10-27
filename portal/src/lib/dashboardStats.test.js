import { describe, expect, it } from "vitest";
import { buildPlanningMatrix, groupProgressByTerritory, percentOf } from "./dashboardStats.js";

const lookups = {
  territoryNames: new Map([["t1", "Territorio 1"]]),
  councilNames: new Map([
    ["c1", "JJVV A"],
    ["c2", "JJVV B"],
  ]),
};

describe("dashboardStats", () => {
  it("calcula porcentajes sin dividir por cero", () => {
    expect(percentOf(1, 3)).toBe(33);
    expect(percentOf(0, 0)).toBe(0);
  });

  it("agrupa el avance por territorio y suma sus JJVV", () => {
    const rows = [
      { territoryId: "t1", councilId: "c1", validated: 10, delivered: 5, pendingDelivery: 5 },
      { territoryId: "t1", councilId: "c2", validated: 10, delivered: 10, pendingDelivery: 0 },
    ];
    const [group] = groupProgressByTerritory(rows, lookups);
    expect(group.name).toBe("Territorio 1");
    expect(group.validated).toBe(20);
    expect(group.delivered).toBe(15);
    expect(group.percent).toBe(75);
    expect(group.councils.map((council) => council.name)).toEqual(["JJVV A", "JJVV B"]);
  });

  it("arma la matriz de planificación e ignora filas desconocidas", () => {
    const rows = [
      { territoryId: "t1", ageRange: "AGE_0_3", sex: "FEMALE", validated: 4 },
      { territoryId: "t1", ageRange: "AGE_0_3", sex: "MALE", validated: 6 },
      { territoryId: "t1", ageRange: "AGE_99", sex: "MALE", validated: 100 },
    ];
    const matrix = buildPlanningMatrix(rows, lookups.territoryNames);
    expect(matrix.territories[0].total).toBe(10);
    expect(matrix.totals.cells.AGE_0_3.MALE).toBe(6);
    expect(matrix.totals.total).toBe(10);
  });
});
