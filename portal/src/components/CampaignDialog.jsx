import { useState } from "react";
import { useAsyncAction } from "../hooks/useAsyncAction.js";
import { MAX_YEAR, MIN_YEAR, validateCampaign } from "../lib/adminForms.js";
import { labels, validationMessage } from "../lib/labels.js";
import * as adminService from "../services/adminService.js";
import Field from "./Field.jsx";
import FormDialog from "./FormDialog.jsx";

// campaign = null crea una campaña nueva (siempre nace PLANIFICADA)
export default function CampaignDialog({ campaign, onSaved, onCancel }) {
  const [values, setValues] = useState({
    year: campaign ? String(campaign.year) : String(new Date().getFullYear()),
    name: campaign?.name ?? "",
    ageCutoffDate: campaign?.age_cutoff_date ?? "",
    autoValidate: campaign?.auto_validate_clean_inscriptions ?? true,
  });
  const [errors, setErrors] = useState({});
  const { state, run } = useAsyncAction(adminService.upsertCampaign);

  function update(field, value) {
    setValues((previous) => ({ ...previous, [field]: value }));
  }

  async function submit() {
    const found = validateCampaign(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const result = await run({
      id: campaign?.id,
      year: Number(values.year),
      name: values.name.trim(),
      ageCutoffDate: values.ageCutoffDate,
      autoValidate: values.autoValidate,
    });
    if (result.status === "success") onSaved();
  }

  const fieldError = (name) => (errors[name] ? validationMessage(errors[name]) : null);

  return (
    <FormDialog
      title={campaign ? labels.admin.catalogs.campaignEdit : labels.admin.catalogs.campaignNew}
      description={labels.admin.catalogs.campaignDescription}
      submitLabel={labels.admin.save}
      isPending={state.status === "pending"}
      error={state.status === "error" ? state.error : null}
      onSubmit={submit}
      onCancel={onCancel}
    >
      <Field label={labels.admin.catalogs.campaignName} error={fieldError("name")}>
        {(props) => (
          <input
            {...props}
            type="text"
            value={values.name}
            onChange={(event) => update("name", event.target.value)}
          />
        )}
      </Field>

      <Field label={labels.admin.catalogs.campaignYear} error={fieldError("year")}>
        {(props) => (
          <input
            {...props}
            type="number"
            inputMode="numeric"
            min={MIN_YEAR}
            max={MAX_YEAR}
            value={values.year}
            onChange={(event) => update("year", event.target.value)}
          />
        )}
      </Field>

      <Field
        label={labels.admin.catalogs.campaignCutoff}
        hint={labels.admin.catalogs.campaignCutoffHint}
        error={fieldError("ageCutoffDate")}
      >
        {(props) => (
          <input
            {...props}
            type="date"
            value={values.ageCutoffDate}
            onChange={(event) => update("ageCutoffDate", event.target.value)}
          />
        )}
      </Field>

      <label className="choice">
        <input
          type="checkbox"
          checked={values.autoValidate}
          onChange={(event) => update("autoValidate", event.target.checked)}
        />
        <span>{labels.admin.catalogs.campaignAutoValidate}</span>
      </label>
    </FormDialog>
  );
}
