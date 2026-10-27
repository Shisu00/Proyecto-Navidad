import { useState } from "react";
import { useCatalogs } from "../hooks/useCatalogs.jsx";
import { useSubmitInscription } from "../hooks/useInscriptions.js";
import { describeAge, todayIsoDate } from "../lib/age.js";
import { canRegisterInscriptions } from "../lib/campaignRules.js";
import { ID_TYPES } from "../lib/identification.js";
import { EMPTY_INSCRIPTION_VALUES, validateInscription } from "../lib/inscriptionForm.js";
import { enumLabels, errorMessage, labels, validationMessage } from "../lib/labels.js";
import { newUuid } from "../lib/uuid.js";
import ChoiceGroup from "./ChoiceGroup.jsx";
import DuplicateJustificationDialog from "./DuplicateJustificationDialog.jsx";
import Field from "./Field.jsx";
import Notice from "./Notice.jsx";

const ID_TYPE_OPTIONS = Object.values(ID_TYPES).map((value) => ({
  value,
  label: enumLabels.idType[value],
}));
const SEX_OPTIONS = ["FEMALE", "MALE"].map((value) => ({ value, label: enumLabels.sex[value] }));
const DUPLICATE_CODE = "DUPLICATE_REQUIRES_JUSTIFICATION";

function successMessage(result) {
  const status = result?.status ?? result?.inscription_status;
  if (status === "VALIDATED") return labels.inscription.successValidated;
  if (status === "OBSERVED") return labels.inscription.successObserved;
  return labels.inscription.successPending;
}

function AgePreview({ birthDate, cutoffDate }) {
  const description = describeAge(birthDate, cutoffDate);
  if (!description) return null;
  if (description.range === null) {
    return <Notice tone="warning">{labels.inscription.ageOutOfRange(description.age)}</Notice>;
  }
  return (
    <p className="field-hint">
      {labels.inscription.agePreview(description.age, enumLabels.ageRange[description.range])}
    </p>
  );
}

export default function InscriptionForm({ onViewList }) {
  const { selectedCampaign } = useCatalogs();
  const { state, run } = useSubmitInscription();
  const [values, setValues] = useState(EMPTY_INSCRIPTION_VALUES);
  const [errors, setErrors] = useState({});
  const [operationId, setOperationId] = useState(newUuid);
  const [duplicate, setDuplicate] = useState(null);
  const [created, setCreated] = useState(null);

  const isOpen = canRegisterInscriptions(selectedCampaign?.status);
  const isPending = state.status === "pending";
  const errorCode = state.status === "error" ? state.error.code : null;

  function setField(field, value) {
    // Un cambio de datos es una operación distinta: nueva clave de idempotencia
    setOperationId(newUuid());
    setValues((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
  }

  async function submit(justification) {
    const result = await run({
      operationId,
      campaignId: selectedCampaign.id,
      values,
      justification,
    });

    if (result.status === "success") {
      setDuplicate(null);
      setCreated(result.data ?? {});
      setValues(EMPTY_INSCRIPTION_VALUES);
      setOperationId(newUuid());
      return;
    }
    if (result.error.code === DUPLICATE_CODE) {
      setDuplicate({ isSameCouncil: Boolean(result.error.details?.same_council) });
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    const found = validateInscription(values, todayIsoDate());
    setErrors(found);
    if (Object.keys(found).length === 0) submit(null);
  }

  function fieldError(field) {
    return errors[field] ? validationMessage(errors[field]) : null;
  }

  if (created) {
    return (
      <section className="panel stack" aria-live="polite">
        <h2>{labels.inscription.successTitle}</h2>
        <p>{successMessage(created)}</p>
        <div className="actions">
          <button type="button" className="button button-primary" onClick={() => setCreated(null)}>
            {labels.inscription.another}
          </button>
          <button type="button" className="button button-quiet" onClick={onViewList}>
            {labels.inscription.viewList}
          </button>
        </div>
      </section>
    );
  }

  const isIpe = values.idType === ID_TYPES.IPE;
  const showFormError = errorCode && errorCode !== DUPLICATE_CODE && !duplicate;

  return (
    <section className="panel" aria-labelledby="inscription-title">
      <h2 id="inscription-title">{labels.inscription.formTitle}</h2>
      <p>{labels.inscription.formIntro}</p>

      {!isOpen ? <Notice tone="warning">{labels.inscription.closedNotice}</Notice> : null}

      <form className="stack-large" onSubmit={handleSubmit} noValidate>
        <fieldset className="form-section" disabled={!isOpen || isPending}>
          <legend>{labels.inscription.childSection}</legend>
          <ChoiceGroup
            legend={labels.inscription.idType}
            name="idType"
            options={ID_TYPE_OPTIONS}
            value={values.idType}
            onChange={(value) => setField("idType", value)}
          />
          <Field
            label={labels.inscription.idNumber}
            hint={isIpe ? labels.inscription.idHintIpe : labels.inscription.idHintRut}
            error={fieldError("idNumber")}
          >
            {(props) => (
              <input
                {...props}
                type="text"
                inputMode={isIpe ? "numeric" : "text"}
                autoComplete="off"
                value={values.idNumber}
                onChange={(event) => setField("idNumber", event.target.value)}
              />
            )}
          </Field>
          <ChoiceGroup
            legend={labels.inscription.sex}
            name="sex"
            options={SEX_OPTIONS}
            value={values.sex}
            onChange={(value) => setField("sex", value)}
            error={fieldError("sex")}
          />
          <Field label={labels.inscription.birthDate} error={fieldError("birthDate")}>
            {(props) => (
              <input
                {...props}
                type="date"
                max={todayIsoDate()}
                value={values.birthDate}
                onChange={(event) => setField("birthDate", event.target.value)}
              />
            )}
          </Field>
          <AgePreview birthDate={values.birthDate} cutoffDate={selectedCampaign?.age_cutoff_date} />
        </fieldset>

        <fieldset className="form-section" disabled={!isOpen || isPending}>
          <legend>{labels.inscription.guardianSection}</legend>
          <Field label={labels.inscription.guardianName} error={fieldError("guardianName")}>
            {(props) => (
              <input
                {...props}
                type="text"
                autoComplete="off"
                value={values.guardianName}
                onChange={(event) => setField("guardianName", event.target.value)}
              />
            )}
          </Field>
          <Field
            label={labels.inscription.guardianIdNumber}
            hint={labels.inscription.idHintRut}
            error={fieldError("guardianIdNumber")}
          >
            {(props) => (
              <input
                {...props}
                type="text"
                autoComplete="off"
                value={values.guardianIdNumber}
                onChange={(event) => setField("guardianIdNumber", event.target.value)}
              />
            )}
          </Field>
          <Field label={labels.inscription.guardianEmail} error={fieldError("guardianEmail")}>
            {(props) => (
              <input
                {...props}
                type="email"
                autoComplete="off"
                value={values.guardianEmail}
                onChange={(event) => setField("guardianEmail", event.target.value)}
              />
            )}
          </Field>
          <Field label={labels.inscription.guardianPhone} error={fieldError("guardianPhone")}>
            {(props) => (
              <input
                {...props}
                type="tel"
                autoComplete="off"
                value={values.guardianPhone}
                onChange={(event) => setField("guardianPhone", event.target.value)}
              />
            )}
          </Field>
        </fieldset>

        {showFormError ? <Notice tone="error">{errorMessage(errorCode)}</Notice> : null}

        <button type="submit" className="button button-primary" disabled={!isOpen || isPending}>
          {isPending && !duplicate ? labels.inscription.submitting : labels.inscription.submit}
        </button>
      </form>

      {duplicate ? (
        <DuplicateJustificationDialog
          isSameCouncil={duplicate.isSameCouncil}
          isPending={isPending}
          errorCode={errorCode && errorCode !== DUPLICATE_CODE ? errorCode : null}
          onConfirm={submit}
          onCancel={() => setDuplicate(null)}
        />
      ) : null}
    </section>
  );
}
