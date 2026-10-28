import { formatDate } from "../lib/format.js";

// Barras por periodo con tabla equivalente debajo (el gráfico no es la única forma de leerlo)
export default function TimeSeriesChart({ title, series, valueKey, valueLabel, columns, emptyText }) {
  if (series.length === 0) return <p className="empty">{emptyText}</p>;

  const max = Math.max(1, ...series.map((point) => point[valueKey]));
  const peak = series.reduce((best, point) => (point[valueKey] > best[valueKey] ? point : best));

  return (
    <div className="stack">
      <div
        className="bars"
        role="img"
        aria-label={`${title}. ${valueLabel}: máximo ${peak[valueKey]} el ${formatDate(peak.date)}.`}
      >
        {series.map((point) => (
          <div
            key={point.date}
            className="bar"
            style={{ height: `${(point[valueKey] / max) * 100}%` }}
            title={`${formatDate(point.date)}: ${point[valueKey]}`}
          />
        ))}
      </div>
      <details>
        <summary>{title}</summary>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key} scope="col">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...series].reverse().map((point) => (
                <tr key={point.date}>
                  {columns.map((column) => (
                    <td key={column.key}>
                      {column.key === "date" ? formatDate(point.date) : point[column.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
