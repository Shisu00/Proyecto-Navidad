import { useState } from "react";
import { useAsyncAction } from "../hooks/useAsyncAction.js";
import { useCatalogs } from "../hooks/useCatalogs.jsx";
import { validateName } from "../lib/adminForms.js";
import { labels, validationMessage } from "../lib/labels.js";
import * as adminService from "../services/adminService.js";
import Field from "./Field.jsx";
import FormDialog from "./FormDialog.jsx";

// council = null crea una JJVV nueva; al editar, el territorio no cambia
export default function CouncilDialog({ council, defaultTerritoryId, onSaved, onCancel }) {
  const { territories } = useCatalogs();
  const [name, setName] = useState(council?.name ?? "");
  const [territoryId, setTerritoryId] = useState(council?.territory_id ?? defaultTerritoryId ?? "");
  const [errors, setErrors] = useState({});
  const { state, run } = useAsyncAction(adminService.upsertCouncil);

  async function submit() {
    const found = { ...validateName(name), ...(territoryId ? {} : { territoryId: "REQUIRED" }) };
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const result = await run({ id: council?.id, territoryId, name: name.trim() });
    if (result.status === "success") onSaved();
  }

  return (
    <FormDialog
      title={council ? labels.admin.catalogs.councilEdit : labels.admin.catalogs.councilNew}
      submitLabel={labels.admin.save}
      isPending={state.status === "pending"}
      error={state.status === "error" ? state.error : null}
      onSubmit={submit}
      onCancel={onCancel}
    >
      <Field
        label={labels.admin.users.territory}
        error={errors.territoryId ? validationMessage(errors.territoryId) : null}
      >
        {(props) => (
          <select
            {...props}
            value={territoryId}
            disabled={Boolean(council)}
            onChange={(event) => setTerritoryId(event.target.value)}
          >
            <option value="">{labels.admin.choose}</option>
            {territories
              .filter((item) => item.is_active || item.id === territoryId)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
          </select>
        )}
      </Field>

      <Field
        label={labels.admin.catalogs.councilName}
        error={errors.name ? validationMessage(errors.name) : null}
      >
        {(props) => (
          <input {...props} type="text" value={name} onChange={(event) => setName(event.target.value)} />
        )}
      </Field>
    </FormDialog>
  );
}
