import { useEffect, useRef, useState } from "react";
import { formatIdNumber } from "../lib/identification.js";
import { MIN_REASON_LENGTH } from "../lib/inscriptionRules.js";
import { enumLabels, errorMessage, labels, validationMessage } from "../lib/labels.js";
import { isValidRut, normalizeRut } from "../lib/rut.js";
import ChoiceGroup from "./ChoiceGroup.jsx";
import Field from "./Field.jsx";
import Notice from "./Notice.jsx";

const TYPE_OPTIONS = [
  { value: "STANDARD", label: labels.delivery.standard },
  { value: "SUBSIDIARY", label: labels.delivery.subsidiary },
];

export default function ConfirmDeliveryDialog({
  rows,
  scannedRun,
  isPending,
  errorCode,
  onConfirm,
  onCancel,
}) {
  const dialogRef = useRef(null);
  const [type, setType] = useState("STANDARD");
  const [withdrawer, setWithdrawer] = useState(scannedRun ?? "");
  const [observation, setObservation] = useState("");
  const [isResponsible, setIsResponsible] = useState(false);
  const [errors, setErrors] = useState({});
  const isSubsidiary = type === "SUBSIDIARY";
  const [first] = rows;
  const isMany = rows.length > 1;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  function handleSubmit(event) {
    event.preventDefault();
    const found = {};
    const hasWithdrawer = withdrawer.trim() !== "";

    if (!isSubsidiary && !hasWithdrawer) found.withdrawer = "REQUIRED";
    else if (hasWithdrawer && !isValidRut(withdrawer)) found.withdrawer = "INVALID_RUT";
    if (isSubsidiary && observation.trim().length < MIN_REASON_LENGTH) found.observation = "SHORT";
    if (isSubsidiary && !isResponsible) found.responsibility = "REQUIRED";

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const normalized = hasWithdrawer ? normalizeRut(withdrawer) : null;
    onConfirm({
      inscriptionIds: rows.map((item) => item.id),
      withdrawalType: type,
      withdrawerIdNumber: normalized,
      observation: isSubsidiary ? observation.trim() : null,
      responsibilityConfirmed: isSubsidiary && isResponsible,
      // Solo cuenta como escaneado si el RUN enviado es el que leyó la cámara
      scanned: normalized !== null && normalized === scannedRun,
    });
  }

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      onCancel={(event) => {
        event.preventDefault();
        if (!isPending) onCancel();
      }}
      aria-labelledby="confirm-title"
    >
      <form className="stack" onSubmit={handleSubmit} noValidate>
        <h2 id="confirm-title">
          {isMany ? labels.delivery.confirmManyTitle(rows.length) : labels.delivery.confirmTitle}
        </h2>
        <p>
          {labels.delivery.expectedGuardian(
            first.guardian_full_name,
            formatIdNumber(first.guardian_id_number),
          )}
        </p>
        {isMany ? (
          <ul className="batch-list">
            {rows.map((item) => (
              <li key={item.id}>
                {formatIdNumber(item.beneficiary_id_number)} · {enumLabels.sex[item.sex]} ·{" "}
                {enumLabels.ageRange[item.age_range]}
              </li>
            ))}
          </ul>
        ) : null}

        <ChoiceGroup
          legend={labels.delivery.withdrawalType}
          name="withdrawalType"
          options={TYPE_OPTIONS}
          value={type}
          onChange={setType}
        />
        {isSubsidiary ? <p className="field-hint">{labels.delivery.subsidiaryHint}</p> : null}

        <Field
          label={isSubsidiary ? labels.delivery.withdrawerIdOptional : labels.delivery.withdrawerId}
          error={errors.withdrawer ? validationMessage(errors.withdrawer) : null}
        >
          {(props) => (
            <input
              {...props}
              type="text"
              autoComplete="off"
              value={withdrawer}
              onChange={(event) => setWithdrawer(event.target.value)}
            />
          )}
        </Field>

        {isSubsidiary ? (
          <>
            <Field
              label={labels.delivery.observation}
              hint={labels.delivery.observationHint}
              error={
                errors.observation ? labels.validation.reasonTooShort(MIN_REASON_LENGTH) : null
              }
            >
              {(props) => (
                <textarea
                  {...props}
                  rows={3}
                  maxLength={500}
                  value={observation}
                  onChange={(event) => setObservation(event.target.value)}
                />
              )}
            </Field>
            <label className="choice">
              <input
                type="checkbox"
                checked={isResponsible}
                onChange={(event) => setIsResponsible(event.target.checked)}
              />
              <span>{labels.delivery.responsibility}</span>
            </label>
            {errors.responsibility ? (
              <p className="field-error" role="alert">
                {errorMessage("RESPONSIBILITY_NOT_CONFIRMED")}
              </p>
            ) : null}
          </>
        ) : null}

        {errorCode ? <Notice tone="error">{errorMessage(errorCode)}</Notice> : null}

        <div className="dialog-actions">
          <button
            type="button"
            className="button button-quiet"
            onClick={onCancel}
            disabled={isPending}
          >
            {labels.app.cancel}
          </button>
          <button type="submit" className="button button-primary" disabled={isPending}>
            {isPending
              ? labels.dialog.pending
              : isMany
                ? labels.delivery.confirmMany(rows.length)
                : labels.delivery.confirm}
          </button>
        </div>
      </form>
    </dialog>
  );
}
