// Adultos con más de un regalo pendiente entre los resultados de la búsqueda
export function pendingGroups(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (row.status !== "VALIDATED" || row.delivery_id) continue;
    const group = groups.get(row.guardian_id_number) ?? {
      guardianIdNumber: row.guardian_id_number,
      guardianName: row.guardian_full_name,
      count: 0,
    };
    group.count += 1;
    groups.set(row.guardian_id_number, group);
  }
  return [...groups.values()].filter((group) => group.count >= 2);
}
