import { useState } from "react";
import { usePermissions } from "../hooks/useAccount.jsx";
import { useAuth } from "../hooks/useAuth.jsx";
import { useCatalogs } from "../hooks/useCatalogs.jsx";
import { errorMessage, enumLabels, labels } from "../lib/labels.js";
import { getVisibleNavItems } from "../lib/navigation.js";
import AnalyticsView from "./AnalyticsView.jsx";
import AuditLog from "./AuditLog.jsx";
import CampaignAdmin from "./CampaignAdmin.jsx";
import CatalogsAdmin from "./CatalogsAdmin.jsx";
import Dashboard from "./Dashboard.jsx";
import DeliveryView from "./DeliveryView.jsx";
import InscriptionForm from "./InscriptionForm.jsx";
import InscriptionList from "./InscriptionList.jsx";
import Notice from "./Notice.jsx";
import ReportsView from "./ReportsView.jsx";
import RolesAdmin from "./RolesAdmin.jsx";
import StatusScreen from "./StatusScreen.jsx";
import UsersAdmin from "./UsersAdmin.jsx";

// Vistas que no dependen de tener una campaña creada
const CAMPAIGN_FREE_VIEWS = ["campaign", "audit", "reports", "users", "catalogs", "roles"];

function ActiveView({ view, onNavigate }) {
  switch (view) {
    case "inscriptions":
      return <InscriptionList />;
    case "newInscription":
      return <InscriptionForm onViewList={() => onNavigate("inscriptions")} />;
    case "delivery":
      return <DeliveryView />;
    case "audit":
      return <AuditLog />;
    case "analytics":
      return <AnalyticsView />;
    case "reports":
      return <ReportsView />;
    case "users":
      return <UsersAdmin />;
    case "catalogs":
      return <CatalogsAdmin />;
    case "roles":
      return <RolesAdmin />;
    case "campaign":
      return <CampaignAdmin />;
    default:
      return <Dashboard />;
  }
}

export default function AppShell() {
  const { signOut } = useAuth();
  const { can, profile } = usePermissions();
  const catalogs = useCatalogs();
  const [view, setView] = useState("dashboard");

  if (!catalogs.isReady && catalogs.status === "error") {
    return (
      <StatusScreen title={labels.app.loadError} body={errorMessage(catalogs.errorCode)}>
        <div className="screen-actions">
          <button type="button" className="button button-primary" onClick={catalogs.reload}>
            {labels.app.retry}
          </button>
        </div>
      </StatusScreen>
    );
  }
  if (!catalogs.isReady) return <StatusScreen title={labels.app.loading} />;

  const items = getVisibleNavItems(can);
  const activeView = items.some((item) => item.key === view) ? view : items[0].key;

  return (
    <div className="shell">
      <header className="shell-header">
        <div className="shell-bar">
          <div className="shell-title">
            <strong>{labels.app.name}</strong>
            <span>{labels.app.municipality}</span>
          </div>
          <div className="shell-user">
            <span>{profile?.full_name}</span>
            <button type="button" className="button button-ghost" onClick={() => signOut()}>
              {labels.nav.signOut}
            </button>
          </div>
        </div>

        <div className="shell-tools">
          <nav aria-label={labels.nav.main} className="tabs">
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                className="tab"
                aria-current={item.key === activeView ? "page" : undefined}
                onClick={() => setView(item.key)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {catalogs.campaigns.length > 0 ? (
            <label className="campaign-select">
              <span>{labels.campaign.selectLabel}</span>
              <select
                value={catalogs.selectedCampaign?.id ?? ""}
                onChange={(event) => catalogs.selectCampaign(event.target.value)}
              >
                {catalogs.campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name} ({enumLabels.campaignStatus[campaign.status]})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </header>

      <main className="shell-main">
        {catalogs.campaigns.length === 0 && !CAMPAIGN_FREE_VIEWS.includes(activeView) ? (
          <Notice>{labels.campaign.empty}</Notice>
        ) : (
          <ActiveView view={activeView} onNavigate={setView} />
        )}
      </main>
    </div>
  );
}
