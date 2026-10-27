import AppShell from "./components/AppShell.jsx";
import Login from "./components/Login.jsx";
import PasswordGate from "./components/PasswordGate.jsx";
import StatusScreen from "./components/StatusScreen.jsx";
import { AccountProvider } from "./hooks/useAccount.jsx";
import { AuthProvider, useAuth } from "./hooks/useAuth.jsx";
import { CatalogProvider } from "./hooks/useCatalogs.jsx";
import { labels } from "./lib/labels.js";

function AuthRouter() {
  const { status } = useAuth();

  if (status === "loading") return <StatusScreen title={labels.app.loading} />;
  if (status === "signedOut") return <Login />;

  return (
    <AccountProvider>
      <PasswordGate>
        <CatalogProvider>
          <AppShell />
        </CatalogProvider>
      </PasswordGate>
    </AccountProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthRouter />
    </AuthProvider>
  );
}
