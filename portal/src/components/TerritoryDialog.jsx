import { useState } from "react";
import { useAsyncAction } from "../hooks/useAsyncAction.js";
import { validateName } from "../lib/adminForms.js";
import { labels, validationMessage } from "../lib/labels.js";
import * as adminService from "../services/adminService.js";
import Field from "./Field.jsx";
import FormDialog from "./FormDialog.jsx";

// territory = null crea uno nuevo
export default function TerritoryDialog({ territory, onSaved, onCancel }) {
  const [name, setName] = useState(territory?.name ?? "");
  const [errors, setErrors] = useState({});
  const { state, run } = useAsyncAction(adminService.upsertTerritory);

  async function submit() {
    const found = validateName(name);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const result = await run({ id: territory?.id, name: name.trim() });
    if (result.status === "success") onSaved();
  }

  return (
    <FormDialog
      title={territory ? labels.admin.catalogs.territoryEdit : labels.admin.catalogs.territoryNew}
      submitLabel={labels.admin.save}
      isPending={state.status === "pending"}
      error={state.status === "error" ? state.error : null}
      onSubmit={submit}
      onCancel={onCancel}
    >
      <Field
        label={labels.admin.catalogs.territoryName}
        error={errors.name ? validationMessage(errors.name) : null}
      >
        {(props) => (
          <input {...props} type="text" value={name} onChange={(event) => setName(event.target.value)} />
        )}
      </Field>
    </FormDialog>
  );
}
