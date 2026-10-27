import { useEffect, useRef } from "react";
import { errorMessage, labels } from "../lib/labels.js";
import Notice from "./Notice.jsx";

// Diálogo modal genérico para los formularios de administración.
// error es el BusinessError devuelto por la acción (código y detalles).
export default function FormDialog({
  title,
  description,
  submitLabel,
  isPending,
  error,
  onSubmit,
  onCancel,
  children,
}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit();
  }

  function handleCancel(event) {
    // Escape pasa por el estado del padre para que el diálogo se desmonte
    event.preventDefault();
    if (!isPending) onCancel();
  }

  return (
    <dialog
      ref={dialogRef}
      className="dialog dialog-wide"
      onCancel={handleCancel}
      aria-labelledby="form-dialog-title"
    >
      <form className="stack" onSubmit={handleSubmit} noValidate>
        <h2 id="form-dialog-title">{title}</h2>
        {description ? <p>{description}</p> : null}
        {children}
        {error ? <Notice tone="error">{errorMessage(error.code, error.details)}</Notice> : null}
        <div className="dialog-actions">
          <button type="button" className="button button-quiet" onClick={onCancel} disabled={isPending}>
            {labels.app.cancel}
          </button>
          <button type="submit" className="button button-primary" disabled={isPending}>
            {isPending ? labels.dialog.pending : submitLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
