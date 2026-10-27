import { useState } from "react";
import { useAsyncAction } from "../hooks/useAsyncAction.js";
import { usePermissions } from "../hooks/useAccount.jsx";
import { useAuth } from "../hooks/useAuth.jsx";
import { errorMessage, labels, validationMessage } from "../lib/labels.js";
import Field from "./Field.jsx";
import Notice from "./Notice.jsx";

const MIN_PASSWORD_LENGTH = 10;

export default function ChangePassword() {
  const { changePassword, signOut } = useAuth();
  const { reload } = usePermissions();
  const { state, run } = useAsyncAction(changePassword);
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [validationCode, setValidationCode] = useState(null);
  const isPending = state.status === "pending";

  async function handleSubmit(event) {
    event.preventDefault();
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setValidationCode("PASSWORD_TOO_SHORT");
      return;
    }
    if (newPassword !== confirmation) {
      setValidationCode("PASSWORD_MISMATCH");
      return;
    }
    setValidationCode(null);
    const result = await run({ newPassword });
    // La bandera must_change_password ya bajó en el servidor: se vuelven a pedir los permisos
    if (result.status === "success") reload();
  }

  return (
    <main className="screen">
      <div className="screen-panel">
        <h1>{labels.changePassword.title}</h1>
        <p>{labels.changePassword.intro}</p>

        <form className="stack" onSubmit={handleSubmit} noValidate>
          <Field
            label={labels.changePassword.newPassword}
            hint={labels.changePassword.hint}
            error={validationCode === "PASSWORD_TOO_SHORT" ? validationMessage(validationCode) : null}
          >
            {(props) => (
              <input
                {...props}
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            )}
          </Field>
          <Field
            label={labels.changePassword.confirmPassword}
            error={validationCode === "PASSWORD_MISMATCH" ? validationMessage(validationCode) : null}
          >
            {(props) => (
              <input
                {...props}
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            )}
          </Field>

          {state.status === "error" ? (
            <Notice tone="error">{errorMessage(state.error.code)}</Notice>
          ) : null}

          <button type="submit" className="button button-primary" disabled={isPending}>
            {isPending ? labels.changePassword.pending : labels.changePassword.submit}
          </button>
        </form>

        <button type="button" className="button button-quiet" onClick={() => signOut()}>
          {labels.nav.signOut}
        </button>
      </div>
    </main>
  );
}
