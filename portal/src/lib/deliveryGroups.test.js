import { describe, expect, it } from "vitest";
import { pendingGroups } from "./deliveryGroups.js";

const row = (id, run, overrides = {}) => ({
  id,
  status: "VALIDATED",
  delivery_id: null,
  guardian_id_number: run,
  guardian_full_name: `Adulto ${run}`,
  ...overrides,
});

describe("pendingGroups", () => {
  it("agrupa a los adultos con dos o más regalos pendientes", () => {
    const groups = pendingGroups([row("a", "111"), row("b", "111"), row("c", "222")]);
    expect(groups).toEqual([{ guardianIdNumber: "111", guardianName: "Adulto 111", count: 2 }]);
  });

  it("no cuenta los ya entregados ni los no validados", () => {
    const groups = pendingGroups([
      row("a", "111"),
      row("b", "111", { delivery_id: "d1" }),
      row("c", "111", { status: "OBSERVED" }),
    ]);
    expect(groups).toEqual([]);
  });
});
