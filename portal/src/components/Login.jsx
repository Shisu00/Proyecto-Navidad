import { useState } from "react";
import { useAsyncAction } from "../hooks/useAsyncAction.js";
import { useAuth } from "../hooks/useAuth.jsx";
import { errorMessage, labels } from "../lib/labels.js";
import Field from "./Field.jsx";
import Notice from "./Notice.jsx";

export default function Login() {
  const { signIn } = useAuth();
  const { state, run } = useAsyncAction(signIn);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const isPending = state.status === "pending";

  function handleSubmit(event) {
    event.preventDefault();
    run({ email: email.trim(), password });
  }

  return (
    <main className="screen">
      <div className="screen-panel">
        <p className="screen-brand">{labels.app.municipality}</p>
        <h1>{labels.login.title}</h1>
        <p>{labels.login.intro}</p>

        <form className="stack" onSubmit={handleSubmit} noValidate>
          <Field label={labels.login.email}>
            {(props) => (
              <input
                {...props}
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            )}
          </Field>
          <Field label={labels.login.password}>
            {(props) => (
              <input
                {...props}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            )}
          </Field>

          {state.status === "error" ? (
            <Notice tone="error">{errorMessage(state.error.code)}</Notice>
          ) : null}

          <button type="submit" className="button button-primary" disabled={isPending}>
            {isPending ? labels.login.pending : labels.login.submit}
          </button>
        </form>

        <p className="screen-footnote">{labels.login.noAccount}</p>
      </div>
    </main>
  );
}
