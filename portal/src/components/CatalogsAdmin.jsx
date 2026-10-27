import { useState } from "react";
import { useAsyncAction } from "../hooks/useAsyncAction.js";
import { useCatalogs } from "../hooks/useCatalogs.jsx";
import { CATALOG_ENTITY } from "../lib/adminForms.js";
import { formatDate } from "../lib/format.js";
import { enumLabels, errorMessage, labels } from "../lib/labels.js";
import * as adminService from "../services/adminService.js";
import CampaignDialog from "./CampaignDialog.jsx";
import CouncilDialog from "./CouncilDialog.jsx";
import Notice from "./Notice.jsx";
import TerritoryDialog from "./TerritoryDialog.jsx";

function ActiveBadge({ isActive }) {
  return (
    <span className={`chip ${isActive ? "chip-registered" : "chip-discarded"}`}>
      {isActive ? labels.admin.catalogs.active : labels.admin.catalogs.inactive}
    </span>
  );
}

export default function CatalogsAdmin() {
  const { territories, councils, campaigns, reload } = useCatalogs();
  const [territoryFilter, setTerritoryFilter] = useState("");
  // { kind: "territory" | "council" | "campaign", item: objeto | null }
  const [dialog, setDialog] = useState(null);
  const toggle = useAsyncAction(adminService.setCatalogActive);

  const visibleCouncils = territoryFilter
    ? councils.filter((council) => council.territory_id === territoryFilter)
    : councils;
  const territoryNames = new Map(territories.map((item) => [item.id, item.name]));

  function handleSaved() {
    setDialog(null);
    reload();
  }

  async function toggleActive(entity, item) {
    const result = await toggle.run({ entity, id: item.id, active: !item.is_active });
    if (result.status === "success") reload();
  }

  return (
    <div className="stack-large">
      <div className="stack">
        <h2>{labels.admin.catalogs.title}</h2>
        <p>{labels.admin.catalogs.intro}</p>
      </div>

      {toggle.state.status === "error" ? (
        <Notice tone="error">{errorMessage(toggle.state.error.code, toggle.state.error.details)}</Notice>
      ) : null}

      <section className="stack" aria-labelledby="campaigns-title">
        <div className="section-head">
          <h3 id="campaigns-title">{labels.admin.catalogs.campaigns}</h3>
          <button
            type="button"
            className="button button-primary"
            onClick={() => setDialog({ kind: "campaign", item: null })}
          >
            {labels.admin.catalogs.campaignNew}
          </button>
        </div>
        {campaigns.length === 0 ? (
          <p className="empty">{labels.campaign.empty}</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">{labels.admin.catalogs.campaignName}</th>
                <th scope="col">{labels.admin.catalogs.campaignState}</th>
                <th scope="col">{labels.admin.catalogs.campaignCutoff}</th>
                <th scope="col">{labels.inscription.columnActions}</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id}>
                  <td data-label={labels.admin.catalogs.campaignName}>
                    <p className="cell-title">{campaign.name}</p>
                    <p className="cell-sub">{campaign.year}</p>
                  </td>
                  <td data-label={labels.admin.catalogs.campaignState}>
                    {enumLabels.campaignStatus[campaign.status]}
                  </td>
                  <td data-label={labels.admin.catalogs.campaignCutoff}>
                    {formatDate(campaign.age_cutoff_date)}
                  </td>
                  <td className="cell-actions">
                    {campaign.status !== "CLOSED" ? (
                      <button
                        type="button"
                        className="button button-small"
                        onClick={() => setDialog({ kind: "campaign", item: campaign })}
                      >
                        {labels.admin.edit}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="stack" aria-labelledby="territories-title">
        <div className="section-head">
          <h3 id="territories-title">{labels.admin.catalogs.territories}</h3>
          <button
            type="button"
            className="button button-primary"
            onClick={() => setDialog({ kind: "territory", item: null })}
          >
            {labels.admin.catalogs.territoryNew}
          </button>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">{labels.admin.catalogs.territoryName}</th>
              <th scope="col">{labels.admin.users.columnStatus}</th>
              <th scope="col">{labels.inscription.columnActions}</th>
            </tr>
          </thead>
          <tbody>
            {territories.map((territory) => (
              <tr key={territory.id}>
                <td data-label={labels.admin.catalogs.territoryName}>
                  <p className="cell-title">{territory.name}</p>
                </td>
                <td data-label={labels.admin.users.columnStatus}>
                  <ActiveBadge isActive={territory.is_active} />
                </td>
                <td className="cell-actions">
                  <button
                    type="button"
                    className="button button-small"
                    onClick={() => setDialog({ kind: "territory", item: territory })}
                  >
                    {labels.admin.edit}
                  </button>
                  <button
                    type="button"
                    className="button button-small"
                    disabled={toggle.state.status === "pending"}
                    onClick={() => toggleActive(CATALOG_ENTITY.TERRITORY, territory)}
                  >
                    {territory.is_active ? labels.admin.catalogs.deactivate : labels.admin.catalogs.activate}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="stack" aria-labelledby="councils-title">
        <div className="section-head">
          <h3 id="councils-title">{labels.admin.catalogs.councils}</h3>
          <button
            type="button"
            className="button button-primary"
            onClick={() => setDialog({ kind: "council", item: null })}
          >
            {labels.admin.catalogs.councilNew}
          </button>
        </div>

        <label className="field filter-narrow">
          <span className="field-label">{labels.admin.users.territory}</span>
          <select value={territoryFilter} onChange={(event) => setTerritoryFilter(event.target.value)}>
            <option value="">{labels.admin.all}</option>
            {territories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">{labels.admin.catalogs.councilName}</th>
              <th scope="col">{labels.admin.users.columnStatus}</th>
              <th scope="col">{labels.inscription.columnActions}</th>
            </tr>
          </thead>
          <tbody>
            {visibleCouncils.map((council) => (
              <tr key={council.id}>
                <td data-label={labels.admin.catalogs.councilName}>
                  <p className="cell-title">{council.name}</p>
                  <p className="cell-sub">{territoryNames.get(council.territory_id)}</p>
                </td>
                <td data-label={labels.admin.users.columnStatus}>
                  <ActiveBadge isActive={council.is_active} />
                </td>
                <td className="cell-actions">
                  <button
                    type="button"
                    className="button button-small"
                    onClick={() => setDialog({ kind: "council", item: council })}
                  >
                    {labels.admin.edit}
                  </button>
                  <button
                    type="button"
                    className="button button-small"
                    disabled={toggle.state.status === "pending"}
                    onClick={() => toggleActive(CATALOG_ENTITY.COUNCIL, council)}
                  >
                    {council.is_active ? labels.admin.catalogs.deactivate : labels.admin.catalogs.activate}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {dialog?.kind === "campaign" ? (
        <CampaignDialog campaign={dialog.item} onSaved={handleSaved} onCancel={() => setDialog(null)} />
      ) : null}
      {dialog?.kind === "territory" ? (
        <TerritoryDialog territory={dialog.item} onSaved={handleSaved} onCancel={() => setDialog(null)} />
      ) : null}
      {dialog?.kind === "council" ? (
        <CouncilDialog
          council={dialog.item}
          defaultTerritoryId={territoryFilter}
          onSaved={handleSaved}
          onCancel={() => setDialog(null)}
        />
      ) : null}
    </div>
  );
}
