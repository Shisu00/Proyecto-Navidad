import { useState } from "react";
import { toBusinessError } from "../lib/errors.js";
import { errorMessage } from "../lib/labels.js";
import Notice from "./Notice.jsx";

// Botón de exportación con progreso y resultado. run(onProgress) hace todo el trabajo
// (traer filas, dejar constancia, descargar) y devuelve cuántos registros exportó.
// Falla cerrado: quien lo usa debe registrar la exportación antes de descargar.
export default function CsvExportButton({
  idleLabel,
  pendingLabel,
  doneLabel,
  hint,
  disabled = false,
  run,
}) {
  const [state, setState] = useState({ status: "idle", done: 0, count: 0, errorCode: null });
  const isPending = state.status === "pending";

  async function start() {
    setState({ status: "pending", done: 0, count: 0, errorCode: null });
    try {
      const count = await run((done) => setState((previous) => ({ ...previous, done })));
      setState({ status: "success", done: count, count, errorCode: null });
    } catch (caught) {
      setState({ status: "error", done: 0, count: 0, errorCode: toBusinessError(caught).code });
    }
  }

  return (
    <div className="stack">
      <div className="actions">
        <button
          type="button"
          className="button button-primary"
          disabled={isPending || disabled}
          onClick={start}
        >
          {isPending ? pendingLabel(state.done) : idleLabel}
        </button>
        {hint ? <span className="cell-sub">{hint}</span> : null}
      </div>
      {state.status === "success" ? <Notice>{doneLabel(state.count)}</Notice> : null}
      {state.status === "error" ? <Notice tone="error">{errorMessage(state.errorCode)}</Notice> : null}
    </div>
  );
}
