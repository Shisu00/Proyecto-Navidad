import { createContext, useContext, useMemo } from "react";
import * as accountService from "../services/accountService.js";
import { useAsyncData } from "./useAsyncData.js";
import { useAuth } from "./useAuth.jsx";

const AccountContext = createContext(null);

const NO_PERMISSIONS = new Set();

export function AccountProvider({ children }) {
  const { userId } = useAuth();
  const { status, data, errorCode, reload } = useAsyncData(
    () => accountService.fetchAccount(userId),
    [userId],
  );

  const value = useMemo(() => {
    const permissions = data ? new Set(data.permissions) : NO_PERMISSIONS;
    return {
      status,
      errorCode,
      isReady: data !== null,
      permissions,
      mustChangePassword: data?.mustChangePassword ?? false,
      profile: data?.profile ?? null,
      // La interfaz solo muestra u oculta; la seguridad real vive en RLS y RPC
      can: (permissionCode) => permissions.has(permissionCode),
      reload,
    };
  }, [status, data, errorCode, reload]);

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function usePermissions() {
  const context = useContext(AccountContext);
  if (!context) throw new Error("usePermissions must be used inside AccountProvider");
  return context;
}
