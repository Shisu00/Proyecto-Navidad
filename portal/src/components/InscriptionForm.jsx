import { useState } from "react";
import { usePermissions } from "../hooks/useAccount.jsx";
import { useCatalogs } from "../hooks/useCatalogs.jsx";
import { useSubmitInscription } from "../hooks/useInscriptions.js";
import { todayIsoDate } from "../lib/age.js";
import { canRegisterInscriptions } from "../lib/campaignRules.js";
import { EMPTY_INSCRIPTION_VALUES, validateInscription } from "../lib/inscriptionForm.js";
import { errorMessage, labels, validationMessage } from "../lib/labels.js";
import { newUuid } from "../lib/uuid.js";
import DuplicateJustificationDialog from "./DuplicateJustificationDialog.jsx";
import Field from "./Field.jsx";
import InscriptionFields from "./InscriptionFields.jsx";
import Notice from "./Notice.jsx";

const DUPLICATE_CODE = "DUPLICATE_REQUIRES_JUSTIFICATION";

function successMessage(result) {
  const status = result?.status ?? result?.inscription_status;
  if (status === "VALIDATED") return labels.inscription.successValidated;
  if (status === "OBSERVED") return labels.inscription.successObserved;
  return labels.inscription.successPending;
}

export default function InscriptionForm({ onViewList }) {
  const { selectedCampaign, councils, territoryNames } = useCatalogs();
  const { can } = usePermissions();
  const canChooseCouncil = can("inscription.create_any_council");
  const [councilId, setCouncilId] = useState("");
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
      councilId: canChooseCouncil ? councilId : null,
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
    if (canChooseCouncil && !councilId) found.councilId = "REQUIRED";
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

  const showFormError = errorCode && errorCode !== DUPLICATE_CODE && !duplicate;
  const serverReason = state.status === "error" ? state.error.details?.reason : null;
  const formErrorText =
    serverReason && labels.validation[serverReason]
      ? labels.validation[serverReason]
      : errorMessage(errorCode);
  const activeCouncils = councils.filter((council) => council.is_active);

  return (
    <section className="panel" aria-labelledby="inscription-title">
      <h2 id="inscription-title">{labels.inscription.formTitle}</h2>
      <p>{labels.inscription.formIntro}</p>

      {!isOpen ? <Notice tone="warning">{labels.inscription.closedNotice}</Notice> : null}

      <form className="stack-large" onSubmit={handleSubmit} noValidate>
        {canChooseCouncil ? (
          <fieldset className="form-section" disabled={!isOpen || isPending}>
            <legend>{labels.inscription.councilField}</legend>
            <Field label={labels.inscription.councilField} error={fieldError("councilId")}>
              {(props) => (
                <select
                  {...props}
                  value={councilId}
                  onChange={(event) => {
                    setOperationId(newUuid());
                    setCouncilId(event.target.value);
                    setErrors((previous) => ({ ...previous, councilId: undefined }));
                  }}
                >
                  <option value="">{labels.inscription.councilChoose}</option>
                  {activeCouncils.map((council) => (
                    <option key={council.id} value={council.id}>
                      {territoryNames.get(council.territory_id)} · {council.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </fieldset>
        ) : null}

        <InscriptionFields
          values={values}
          fieldError={fieldError}
          disabled={!isOpen || isPending}
          cutoffDate={selectedCampaign?.age_cutoff_date}
          onChange={setField}
        />

        {showFormError ? <Notice tone="error">{formErrorText}</Notice> : null}

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
