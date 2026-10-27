import * as auditService from "../services/auditService.js";
import { useAsyncData } from "./useAsyncData.js";

export function useAuditLog({ filters, page, pageSize }) {
  return useAsyncData(
    () => auditService.listAuditLog({ filters, page, pageSize }),
    [JSON.stringify(filters), page, pageSize],
  );
}
