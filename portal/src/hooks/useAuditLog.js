import * as auditService from "../services/auditService.js";
import { useAsyncData } from "./useAsyncData.js";

export function useAuditLog({ action, page, pageSize }) {
  return useAsyncData(
    () => auditService.listAuditLog({ action, page, pageSize }),
    [action, page, pageSize],
  );
}
