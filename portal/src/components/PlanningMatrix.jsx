import { AGE_RANGES, SEXES } from "../lib/dashboardStats.js";
import { enumLabels, labels } from "../lib/labels.js";

function Cells({ cells }) {
  return AGE_RANGES.flatMap((range) =>
    SEXES.map((sex) => <td key={`${range}-${sex}`}>{cells[range][sex]}</td>),
  );
}

export default function PlanningMatrix({ matrix }) {
  if (matrix.territories.length === 0) {
    return <p className="empty">{labels.dashboard.planningEmpty}</p>;
  }

  return (
    <div className="table-scroll">
      <table className="matrix">
        <thead>
          <tr>
            <th rowSpan={2} scope="col">
              {labels.dashboard.planningTerritory}
            </th>
            {AGE_RANGES.map((range) => (
              <th key={range} colSpan={SEXES.length} scope="colgroup">
                {enumLabels.ageRange[range]}
              </th>
            ))}
            <th rowSpan={2} scope="col">
              {labels.dashboard.planningTotal}
            </th>
          </tr>
          <tr>
            {AGE_RANGES.flatMap((range) =>
              SEXES.map((sex) => (
                <th key={`${range}-${sex}`} scope="col">
                  {enumLabels.sex[sex]}
                </th>
              )),
            )}
          </tr>
        </thead>
        <tbody>
          {matrix.territories.map((territory) => (
            <tr key={territory.key}>
              <th scope="row">{territory.name}</th>
              <Cells cells={territory.cells} />
              <td className="matrix-total">{territory.total}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">{labels.dashboard.planningTotal}</th>
            <Cells cells={matrix.totals.cells} />
            <td className="matrix-total">{matrix.totals.total}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
