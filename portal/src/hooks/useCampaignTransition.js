import * as catalogsService from "../services/catalogsService.js";
import { useAsyncAction } from "./useAsyncAction.js";

export function useCampaignTransition() {
  return useAsyncAction(catalogsService.transitionCampaign);
}
