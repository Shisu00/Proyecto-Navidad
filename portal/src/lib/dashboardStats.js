export const AGE_RANGES = Object.freeze(["AGE_0_3", "AGE_4_7", "AGE_8_10"]);
export const SEXES = Object.freeze(["FEMALE", "MALE"]);

export function percentOf(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function byName(a, b) {
  return a.name.localeCompare(b.name, "es");
}

// Agrupa el avance por territorio y deja las JJVV dentro de cada uno
export function groupProgressByTerritory(rows, { territoryNames, councilNames }) {
  const groups = new Map();

  for (const row of rows) {
    const key = row.territoryId ?? "unknown";
    const group = groups.get(key) ?? {
      key,
      name: row.territoryName ?? territoryNames.get(key) ?? key,
      validated: 0,
      delivered: 0,
      pendingDelivery: 0,
      councils: [],
    };

    group.validated += row.validated;
    group.delivered += row.delivered;
    group.pendingDelivery += row.pendingDelivery;
    group.councils.push({
      key: row.councilId ?? `${key}-${group.councils.length}`,
      name: row.councilName ?? councilNames.get(row.councilId) ?? String(row.councilId),
      validated: row.validated,
      delivered: row.delivered,
      pendingDelivery: row.pendingDelivery,
      percent: percentOf(row.delivered, row.validated),
    });
    groups.set(key, group);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      percent: percentOf(group.delivered, group.validated),
      councils: [...group.councils].sort(byName),
    }))
    .sort(byName);
}

function emptyCells() {
  return Object.fromEntries(
    AGE_RANGES.map((range) => [range, Object.fromEntries(SEXES.map((sex) => [sex, 0]))]),
  );
}

// Validados por territorio, rango etario y sexo: base para la compra
export function buildPlanningMatrix(rows, territoryNames) {
  const territories = new Map();
  const totals = { cells: emptyCells(), total: 0 };

  for (const row of rows) {
    if (!AGE_RANGES.includes(row.ageRange) || !SEXES.includes(row.sex)) continue;
    const key = row.territoryId ?? "unknown";
    const entry = territories.get(key) ?? {
      key,
      name: row.territoryName ?? territoryNames.get(key) ?? key,
      cells: emptyCells(),
      total: 0,
    };

    entry.cells[row.ageRange][row.sex] += row.validated;
    entry.total += row.validated;
    totals.cells[row.ageRange][row.sex] += row.validated;
    totals.total += row.validated;
    territories.set(key, entry);
  }

  return { territories: [...territories.values()].sort(byName), totals };
}
