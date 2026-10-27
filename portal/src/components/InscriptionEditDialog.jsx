import { useState } from "react";
import { useUpdateInscription } from "../hooks/useInscriptions.js";
import { todayIsoDate } from "../lib/age.js";
import { hasChanges, validateInscription, valuesFromRow } from "../lib/inscriptionForm.js";
import { MIN_REASON_LENGTH } from "../lib/inscriptionRules.js";
import { labels, validationMessage } from "../lib/labels.js";
import Field from "./Field.jsx";
import FormDialog from "./FormDialog.jsx";
import InscriptionFields from "./InscriptionFields.jsx";
import Notice from "./Notice.jsx";

const DUPLICATE_CODE = "DUPLICATE_REQUIRES_JUSTIFICATION";

// Corrección de una inscripción existente. Si el RUN nuevo ya está inscrito en la
// campaña, el servidor lo avisa y el formulario pide la justificación del duplicado.
export default function InscriptionEditDialog({ row, cutoffDate, onSaved, onCancel }) {
  const [values, setValues] = useState(() => valuesFromRow(row));
  const [reason, setReason] = useState("");
  const [justification, setJustification] = useState("");
  const [needsJustification, setNeedsJustification] = useState(false);
  const [errors, setErrors] = useState({});
  const [textErrors, setTextErrors] = useState({});
  const { state, run } = useUpdateInscription();

  function setField(field, value) {
    setValues((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
  }

  async function submit() {
    const found = validateInscription(values, todayIsoDate());
    const textFound = {};
    if (reason.trim().length < MIN_REASON_LENGTH) {
      textFound.reason = labels.validation.reasonTooShort(MIN_REASON_LENGTH);
    }
    if (needsJustification && justification.trim().length < MIN_REASON_LENGTH) {
      textFound.justification = labels.validation.reasonTooShort(MIN_REASON_LENGTH);
    }
    setErrors(found);
    setTextErrors(textFound);
    if (Object.keys(found).length > 0 || Object.keys(textFound).length > 0) return;

    if (!hasChanges(values, row)) {
      setTextErrors({ form: labels.inscription.noChanges });
      return;
    }

    const result = await run({
      inscriptionId: row.id,
      values,
      reason: reason.trim(),
      justification: needsJustification ? justification.trim() : null,
    });
    if (result.status === "success") {
      onSaved(result.data ?? {});
    } else if (result.error.code === DUPLICATE_CODE) {
      setNeedsJustification(true);
    }
  }

  const fieldError = (field) => (errors[field] ? validationMessage(errors[field]) : null);

  return (
    <FormDialog
      title={labels.inscription.correctTitle}
      description={labels.inscription.correctDescription}
      submitLabel={labels.inscription.correctSubmit}
      isPending={state.status === "pending"}
      error={state.status === "error" ? state.error : null}
      onSubmit={submit}
      onCancel={onCancel}
    >
      <InscriptionFields
        values={values}
        fieldError={fieldError}
        disabled={state.status === "pending"}
        cutoffDate={cutoffDate}
        onChange={setField}
      />

      {needsJustification ? (
        <Field label={labels.inscription.duplicateReason} error={textErrors.justification}>
          {(props) => (
            <textarea
              {...props}
              rows={3}
              maxLength={500}
              value={justification}
              onChange={(event) => setJustification(event.target.value)}
            />
          )}
        </Field>
      ) : null}

      <Field label={labels.inscription.correctReason} error={textErrors.reason}>
        {(props) => (
          <textarea
            {...props}
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        )}
      </Field>

      {textErrors.form ? <Notice tone="warning">{textErrors.form}</Notice> : null}
    </FormDialog>
  );
}
