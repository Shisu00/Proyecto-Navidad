import { useState } from "react";
import { useAsyncAction } from "../hooks/useAsyncAction.js";
import { useCatalogs } from "../hooks/useCatalogs.jsx";
import { validateNewUser } from "../lib/adminForms.js";
import { labels, validationMessage } from "../lib/labels.js";
import * as adminService from "../services/adminService.js";
import Field from "./Field.jsx";
import FormDialog from "./FormDialog.jsx";

const EMPTY_VALUES = { email: "", fullName: "", roleId: "", territoryId: "", councilId: "" };

export default function UserCreateDialog({ roles, onCreated, onCancel }) {
  const { territories, councils } = useCatalogs();
  const [values, setValues] = useState(EMPTY_VALUES);
  const [errors, setErrors] = useState({});
  const { state, run } = useAsyncAction(adminService.createUser);

  const role = roles.find((item) => item.id === values.roleId);
  const requiresCouncil = Boolean(role?.requires_council);
  const availableTerritories = territories.filter((item) => item.is_active);
  const availableCouncils = councils.filter(
    (item) => item.is_active && item.territory_id === values.territoryId,
  );

  function update(field, value) {
    setValues((previous) => ({ ...previous, [field]: value }));
  }

  function changeRole(roleId) {
    // Un rol sin JJVV no debe arrastrar una JJVV elegida antes
    setValues((previous) => ({ ...previous, roleId, territoryId: "", councilId: "" }));
  }

  function changeTerritory(territoryId) {
    setValues((previous) => ({ ...previous, territoryId, councilId: "" }));
  }

  async function submit() {
    const found = validateNewUser(values, { requiresCouncil });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const result = await run({
      email: values.email.trim(),
      fullName: values.fullName.trim(),
      roleId: values.roleId,
      territoryId: requiresCouncil ? values.territoryId : null,
      councilId: requiresCouncil ? values.councilId : null,
    });
    if (result.status === "success") {
      onCreated({ email: values.email.trim().toLowerCase(), ...result.data });
    }
  }

  const fieldError = (name) => (errors[name] ? validationMessage(errors[name]) : null);

  return (
    <FormDialog
      title={labels.admin.users.createTitle}
      description={labels.admin.users.createDescription}
      submitLabel={labels.admin.users.createSubmit}
      isPending={state.status === "pending"}
      error={state.status === "error" ? state.error : null}
      onSubmit={submit}
      onCancel={onCancel}
    >
      <Field label={labels.admin.users.email} error={fieldError("email")}>
        {(props) => (
          <input
            {...props}
            type="email"
            autoComplete="off"
            value={values.email}
            onChange={(event) => update("email", event.target.value)}
          />
        )}
      </Field>

      <Field label={labels.admin.users.fullName} error={fieldError("fullName")}>
        {(props) => (
          <input
            {...props}
            type="text"
            autoComplete="off"
            value={values.fullName}
            onChange={(event) => update("fullName", event.target.value)}
          />
        )}
      </Field>

      <Field label={labels.admin.users.role} error={fieldError("roleId")}>
        {(props) => (
          <select {...props} value={values.roleId} onChange={(event) => changeRole(event.target.value)}>
            <option value="">{labels.admin.choose}</option>
            {roles.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        )}
      </Field>

      {requiresCouncil ? (
        <>
          <Field label={labels.admin.users.territory} error={fieldError("territoryId")}>
            {(props) => (
              <select
                {...props}
                value={values.territoryId}
                onChange={(event) => changeTerritory(event.target.value)}
              >
                <option value="">{labels.admin.choose}</option>
                {availableTerritories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field label={labels.admin.users.council} error={fieldError("councilId")}>
            {(props) => (
              <select
                {...props}
                value={values.councilId}
                disabled={!values.territoryId}
                onChange={(event) => update("councilId", event.target.value)}
              >
                <option value="">{labels.admin.choose}</option>
                {availableCouncils.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </>
      ) : null}
    </FormDialog>
  );
}
