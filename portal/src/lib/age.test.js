import { describe, expect, it } from "vitest";
import { ageRangeForAge, calculateAge, describeAge } from "./age.js";

describe("age", () => {
  it("calcula la edad cumplida a la fecha de corte", () => {
    expect(calculateAge("2020-06-15", "2026-12-01")).toBe(6);
    expect(calculateAge("2015-12-02", "2026-12-01")).toBe(10);
    expect(calculateAge("2015-12-01", "2026-12-01")).toBe(11);
  });

  it("asigna el rango etario o null fuera de 0-10", () => {
    expect(ageRangeForAge(0)).toBe("AGE_0_3");
    expect(ageRangeForAge(7)).toBe("AGE_4_7");
    expect(ageRangeForAge(10)).toBe("AGE_8_10");
    expect(ageRangeForAge(11)).toBeNull();
    expect(ageRangeForAge(-1)).toBeNull();
  });

  it("describe la edad solo con ambas fechas", () => {
    expect(describeAge("", "2026-12-01")).toBeNull();
    expect(describeAge("2022-01-01", "2026-12-01")).toEqual({ age: 4, range: "AGE_4_7" });
  });
});
