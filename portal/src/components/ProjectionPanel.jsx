import { enumLabels, labels } from "../lib/labels.js";
import Notice from "./Notice.jsx";

const percent = (value) => (value === null ? "—" : `${(value * 100).toFixed(1).replace(".", ",")} %`);
const count = (value) => (value === null ? "—" : value);

function Rows({ items, nameOf }) {
  return items.map((item) => (
    <tr key={nameOf(item)}>
      <th scope="row">{nameOf(item)}</th>
      <td>{item.validated}</td>
      <td>{item.delivered}</td>
      <td>{percent(item.rate)}</td>
      <td className="matrix-total">{count(item.projected)}</td>
    </tr>
  ));
}

function ProjectionTable({ firstColumn, items, nameOf, totals }) {
  const p = labels.analytics.projection;
  return (
    <div className="table-scroll">
      <table className="matrix">
        <thead>
          <tr>
            <th scope="col">{firstColumn}</th>
            <th scope="col">{p.validated}</th>
            <th scope="col">{p.delivered}</th>
            <th scope="col">{p.currentRate}</th>
            <th scope="col">{p.projected}</th>
          </tr>
        </thead>
        <tbody>
          <Rows items={items} nameOf={nameOf} />
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">{labels.dashboard.planningTotal}</th>
            <td>{totals.validated}</td>
            <td>{totals.delivered}</td>
            <td>{percent(totals.rate)}</td>
            <td className="matrix-total">{count(totals.projected)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default function ProjectionPanel({ projection }) {
  const p = labels.analytics.projection;

  return (
    <div className="stack">
      <p className="cell-sub">{p.intro}</p>
      {projection.hasReference ? (
        <Notice>{p.reference(projection.referenceName)}</Notice>
      ) : (
        <Notice>{p.noReference}</Notice>
      )}
      {projection.unprojectedValidated > 0 ? (
        <Notice>{p.unprojected(projection.unprojectedValidated)}</Notice>
      ) : null}

      <h4>{p.bySegment}</h4>
      <ProjectionTable
        firstColumn={p.segment}
        items={projection.segments}
        nameOf={(item) => `${enumLabels.ageRange[item.ageRange]} · ${enumLabels.sex[item.sex]}`}
        totals={projection.totals}
      />

      <details>
        <summary>{p.byTerritory}</summary>
        <ProjectionTable
          firstColumn={labels.dashboard.planningTerritory}
          items={projection.territories}
          nameOf={(item) => item.name}
          totals={projection.totals}
        />
      </details>
    </div>
  );
}
