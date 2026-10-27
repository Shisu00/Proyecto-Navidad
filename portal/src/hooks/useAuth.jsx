import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as authService from "../services/authService.js";

const AuthContext = createContext(null);

const LOADING = { status: "loading", userId: null, email: null };

export function AuthProvider({ children }) {
  const [state, setState] = useState(LOADING);

  // onAuthStateChange emite INITIAL_SESSION al suscribirse: es la única fuente de verdad
  useEffect(
    () =>
      authService.onAuthChange((session) => {
        setState((previous) => {
          if (!session) return { status: "signedOut", userId: null, email: null };
          if (previous.userId === session.user.id) return previous;
          return { status: "signedIn", userId: session.user.id, email: session.user.email };
        });
      }),
    [],
  );

  const changePassword = useCallback(
    ({ newPassword, currentPassword }) =>
      authService.changePassword({ email: state.email, newPassword, currentPassword }),
    [state.email],
  );

  const value = useMemo(
    () => ({
      ...state,
      signIn: authService.signIn,
      signOut: authService.signOut,
      changePassword,
    }),
    [state, changePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
