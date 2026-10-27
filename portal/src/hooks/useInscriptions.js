import { buildSubmitInput } from "../lib/inscriptionForm.js";
import * as inscriptionsService from "../services/inscriptionsService.js";
import { useAsyncAction } from "./useAsyncAction.js";
import { useAsyncData } from "./useAsyncData.js";

export function useInscriptionList({ campaignId, status, search, page, pageSize }) {
  return useAsyncData(async () => {
    if (!campaignId) return { rows: [], total: 0 };
    return inscriptionsService.listInscriptions({ campaignId, status, search, page, pageSize });
  }, [campaignId, status, search, page, pageSize]);
}

export function useSubmitInscription() {
  return useAsyncAction((params) =>
    inscriptionsService.submitInscription(buildSubmitInput(params)),
  );
}

export function useResolveInscription() {
  return useAsyncAction(inscriptionsService.resolveInscription);
}
