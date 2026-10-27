import { createContext, useContext, useMemo, useState } from "react";
import { pickDefaultCampaign } from "../lib/campaignRules.js";
import * as catalogsService from "../services/catalogsService.js";
import { useAsyncData } from "./useAsyncData.js";

const CatalogContext = createContext(null);

function indexNames(items) {
  return new Map(items.map((item) => [item.id, item.name]));
}

export function CatalogProvider({ children }) {
  const { status, data, errorCode, reload } = useAsyncData(
    () => catalogsService.fetchCatalogs(),
    [],
  );
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);

  const value = useMemo(() => {
    const campaigns = data?.campaigns ?? [];
    const territories = data?.territories ?? [];
    const councils = data?.councils ?? [];
    const selectedCampaign =
      campaigns.find((campaign) => campaign.id === selectedCampaignId) ??
      pickDefaultCampaign(campaigns);

    return {
      status,
      errorCode,
      isReady: data !== null,
      campaigns,
      territories,
      councils,
      territoryNames: indexNames(territories),
      councilNames: indexNames(councils),
      selectedCampaign,
      selectCampaign: setSelectedCampaignId,
      reload,
    };
  }, [status, data, errorCode, selectedCampaignId, reload]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalogs() {
  const context = useContext(CatalogContext);
  if (!context) throw new Error("useCatalogs must be used inside CatalogProvider");
  return context;
}
