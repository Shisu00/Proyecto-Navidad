import { useState } from "react";
import { useAsyncAction } from "../hooks/useAsyncAction.js";
import { validateRole } from "../lib/adminForms.js";
import { labels, validationMessage } from "../lib/labels.js";
import * as adminService from "../services/adminService.js";
import Field from "./Field.jsx";
import FormDialog from "./FormDialog.jsx";

// role = null crea un rol nuevo; el código no cambia después
export default function RoleDialog({ role, onSaved, onCancel }) {
  const isNew = !role;
  const [values, setValues] = useState({
    code: role?.code ?? "",
    name: role?.name ?? "",
    requiresCouncil: role?.requires_council ?? false,
  });
  const [errors, setErrors] = useState({});
  const { state, run } = useAsyncAction(adminService.upsertRole);

  function update(field, value) {
    setValues((previous) => ({ ...previous, [field]: value }));
  }

  async function submit() {
    const found = validateRole(values, { isNew });
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const result = await run({
      id: role?.id,
      code: values.code.trim().toUpperCase(),
      name: values.name.trim(),
      requiresCouncil: values.requiresCouncil,
    });
    if (result.status === "success") onSaved(result.data);
  }

  const fieldError = (name) => (errors[name] ? validationMessage(errors[name]) : null);

  return (
    <FormDialog
      title={isNew ? labels.admin.roles.createTitle : labels.admin.roles.editTitle}
      description={isNew ? labels.admin.roles.createDescription : null}
      submitLabel={labels.admin.save}
      isPending={state.status === "pending"}
      error={state.status === "error" ? state.error : null}
      onSubmit={submit}
      onCancel={onCancel}
    >
      <Field
        label={labels.admin.roles.code}
        hint={isNew ? labels.admin.roles.codeHint : null}
        error={fieldError("code")}
      >
        {(props) => (
          <input
            {...props}
            type="text"
            autoCapitalize="characters"
            disabled={!isNew}
            value={values.code}
            onChange={(event) => update("code", event.target.value)}
          />
        )}
      </Field>

      <Field label={labels.admin.roles.name} error={fieldError("name")}>
        {(props) => (
          <input
            {...props}
            type="text"
            value={values.name}
            onChange={(event) => update("name", event.target.value)}
          />
        )}
      </Field>

      <label className="choice">
        <input
          type="checkbox"
          checked={values.requiresCouncil}
          onChange={(event) => update("requiresCouncil", event.target.checked)}
        />
        <span>{labels.admin.roles.requiresCouncil}</span>
      </label>
    </FormDialog>
  );
}
