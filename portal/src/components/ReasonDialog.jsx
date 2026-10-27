import { useEffect, useRef, useState } from "react";
import { MIN_REASON_LENGTH } from "../lib/inscriptionRules.js";
import { errorMessage, labels } from "../lib/labels.js";
import Field from "./Field.jsx";
import Notice from "./Notice.jsx";

// Diálogo modal con un motivo de texto. Lo usan la revisión, los duplicados y la campaña.
export default function ReasonDialog({
  title,
  description,
  reasonLabel,
  confirmLabel,
  isRequired,
  isPending,
  errorCode,
  onConfirm,
  onCancel,
}) {
  const dialogRef = useRef(null);
  const [reason, setReason] = useState("");
  const [isTooShort, setIsTooShort] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  function handleSubmit(event) {
    event.preventDefault();
    const trimmed = reason.trim();
    if (isRequired && trimmed.length < MIN_REASON_LENGTH) {
      setIsTooShort(true);
      return;
    }
    setIsTooShort(false);
    onConfirm(trimmed || null);
  }

  function handleCancel(event) {
    // Escape pasa por el estado del padre para que el diálogo se desmonte
    event.preventDefault();
    if (!isPending) onCancel();
  }

  return (
    <dialog ref={dialogRef} className="dialog" onCancel={handleCancel} aria-labelledby="dialog-title">
      <form className="stack" onSubmit={handleSubmit} noValidate>
        <h2 id="dialog-title">{title}</h2>
        {description ? <p>{description}</p> : null}

        <Field
          label={reasonLabel}
          error={isTooShort ? labels.validation.reasonTooShort(MIN_REASON_LENGTH) : null}
        >
          {(props) => (
            <textarea
              {...props}
              rows={4}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          )}
        </Field>

        {errorCode ? <Notice tone="error">{errorMessage(errorCode)}</Notice> : null}

        <div className="dialog-actions">
          <button type="button" className="button button-quiet" onClick={onCancel} disabled={isPending}>
            {labels.app.cancel}
          </button>
          <button type="submit" className="button button-primary" disabled={isPending}>
            {isPending ? labels.dialog.pending : confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
