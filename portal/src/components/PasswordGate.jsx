import { usePermissions } from "../hooks/useAccount.jsx";
import { useAuth } from "../hooks/useAuth.jsx";
import { errorMessage, labels } from "../lib/labels.js";
import ChangePassword from "./ChangePassword.jsx";
import StatusScreen from "./StatusScreen.jsx";

// Envuelve todas las rutas operativas: con clave temporal solo se puede cambiarla o salir
export default function PasswordGate({ children }) {
  const { signOut } = useAuth();
  const { status, errorCode, isReady, mustChangePassword, permissions, reload } = usePermissions();

  if (!isReady && status === "error") {
    return (
      <StatusScreen title={labels.app.loadError} body={errorMessage(errorCode)}>
        <div className="screen-actions">
          <button type="button" className="button button-primary" onClick={reload}>
            {labels.app.retry}
          </button>
          <button type="button" className="button button-quiet" onClick={() => signOut()}>
            {labels.nav.signOut}
          </button>
        </div>
      </StatusScreen>
    );
  }

  if (!isReady) return <StatusScreen title={labels.app.loading} />;
  if (mustChangePassword) return <ChangePassword />;

  if (permissions.size === 0) {
    return (
      <StatusScreen title={labels.account.noAccessTitle} body={labels.account.noAccessBody}>
        <div className="screen-actions">
          <button type="button" className="button button-quiet" onClick={() => signOut()}>
            {labels.nav.signOut}
          </button>
        </div>
      </StatusScreen>
    );
  }

  return children;
}
