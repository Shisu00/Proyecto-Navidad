import { useEffect, useRef, useState } from "react";
import { labels } from "../lib/labels.js";
import Notice from "./Notice.jsx";

// Muestra la clave temporal una sola vez. El estado vive solo mientras el diálogo está abierto.
export default function TempPasswordDialog({ title, email, temporaryPassword, onClose }) {
  const dialogRef = useRef(null);
  const [copyState, setCopyState] = useState("idle");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(temporaryPassword);
      setCopyState("copied");
    } catch {
      // Sin permiso de portapapeles: la clave sigue visible para copiarla a mano
      setCopyState("failed");
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby="temp-password-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="stack">
        <h2 id="temp-password-title">{title}</h2>
        <p>{labels.admin.users.tempPasswordIntro(email)}</p>
        <p className="secret" aria-label={labels.admin.users.tempPasswordLabel}>
          {temporaryPassword}
        </p>
        <Notice tone="warning">{labels.admin.users.tempPasswordWarning}</Notice>
        {copyState === "copied" ? <Notice>{labels.admin.users.copied}</Notice> : null}
        {copyState === "failed" ? <Notice tone="error">{labels.admin.users.copyFailed}</Notice> : null}
        <div className="dialog-actions">
          <button type="button" className="button button-quiet" onClick={copy}>
            {labels.admin.users.copy}
          </button>
          <button type="button" className="button button-primary" onClick={onClose}>
            {labels.admin.users.tempPasswordDone}
          </button>
        </div>
      </div>
    </dialog>
  );
}
