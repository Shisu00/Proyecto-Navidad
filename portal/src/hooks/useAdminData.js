import * as adminService from "../services/adminService.js";
import { useAsyncData } from "./useAsyncData.js";

export function useAdminUsers() {
  return useAsyncData(() => adminService.listUsers(), []);
}

export function useRoleCatalog() {
  return useAsyncData(() => adminService.fetchRoleCatalog(), []);
}
