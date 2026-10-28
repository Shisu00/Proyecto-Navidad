import { BusinessError, toBusinessError } from "../lib/errors.js";

export const EXPORT_BATCH_SIZE = 1000;
export const MAX_EXPORT_ROWS = 100000;

// Trae todo el resultado por tandas, paginando por clave (no por posición): si entran
// registros nuevos mientras se exporta, no se repiten ni se saltan filas.
// build() debe devolver una consulta nueva con select y filtros ya aplicados.
export async function fetchAllRows({
  build,
  keyColumn,
  descending = false,
  maxRows = MAX_EXPORT_ROWS,
  onProgress,
}) {
  const rows = [];
  let lastKey = null;

  for (;;) {
    let query = build().order(keyColumn, { ascending: !descending }).limit(EXPORT_BATCH_SIZE);
    if (lastKey !== null) {
      query = descending ? query.lt(keyColumn, lastKey) : query.gt(keyColumn, lastKey);
    }

    const { data, error } = await query;
    if (error) throw toBusinessError(error);
    // Sigue hasta una tanda vacía: el servidor puede limitar filas por consulta
    if (!data || data.length === 0) break;

    rows.push(...data);
    lastKey = data[data.length - 1][keyColumn];
    onProgress?.(rows.length);
    if (rows.length > maxRows) throw new BusinessError("EXPORT_TOO_LARGE");
  }

  return rows;
}
