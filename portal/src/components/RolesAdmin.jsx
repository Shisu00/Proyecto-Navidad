import { useEffect, useState } from "react";
import { useRoleCatalog } from "../hooks/useAdminData.js";
import { useAsyncAction } from "../hooks/useAsyncAction.js";
import { groupGrants, sameSet } from "../lib/adminForms.js";
import { errorMessage, labels } from "../lib/labels.js";
import * as adminService from "../services/adminService.js";
import Notice from "./Notice.jsx";
import RoleDialog from "./RoleDialog.jsx";

const EMPTY_SET = new Set();

export default function RolesAdmin() {
  const catalog = useRoleCatalog();
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(EMPTY_SET);
  const [dialog, setDialog] = useState(null); // { role: objeto | null }
  const [saved, setSaved] = useState(false);
  const savePermissions = useAsyncAction(adminService.setRolePermissions);
  const toggleActive = useAsyncAction(adminService.setRoleActive);

  const roles = catalog.data?.roles ?? [];
  const permissions = catalog.data?.permissions ?? [];
  const grants = catalog.data ? groupGrants(catalog.data.grants) : new Map();
  const selected = roles.find((role) => role.id === selectedId) ?? roles[0] ?? null;
  const stored = selected ? (grants.get(selected.id) ?? EMPTY_SET) : EMPTY_SET;
  const isDirty = !sameSet(draft, stored);

  // Al cambiar de rol o recargar, el borrador parte de lo guardado
  useEffect(() => {
    setDraft(new Set(stored));
    setSaved(false);
  }, [selected?.id, catalog.data]);

  function togglePermission(code) {
    setSaved(false);
    setDraft((previous) => {
      const next = new Set(previous);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  async function save() {
    const result = await savePermissions.run({
      roleId: selected.id,
      permissionCodes: [...draft].sort(),
    });
    if (result.status === "success") {
      setSaved(true);
      catalog.reload();
    }
  }

  async function changeActive() {
    const result = await toggleActive.run({ roleId: selected.id, active: !selected.is_active });
    if (result.status === "success") catalog.reload();
  }

  function handleRoleSaved(roleId) {
    setDialog(null);
    if (roleId) setSelectedId(roleId);
    catalog.reload();
  }

  if (catalog.status === "error") {
    return (
      <div className="stack">
        <Notice tone="error">{errorMessage(catalog.errorCode)}</Notice>
        <button type="button" className="button button-primary" onClick={catalog.reload}>
          {labels.app.retry}
        </button>
      </div>
    );
  }
  if (!catalog.data) return <p className="empty">{labels.app.loading}</p>;

  const readOnly = Boolean(selected?.is_system);
  const actionError =
    savePermissions.state.status === "error"
      ? savePermissions.state.error
      : toggleActive.state.status === "error"
        ? toggleActive.state.error
        : null;

  return (
    <section className="stack-large" aria-labelledby="roles-title">
      <div className="stack">
        <h2 id="roles-title">{labels.admin.roles.title}</h2>
        <p>{labels.admin.roles.intro}</p>
      </div>

      <div className="roles-layout">
        <div className="stack roles-list">
          <button
            type="button"
            className="button button-primary"
            onClick={() => setDialog({ role: null })}
          >
            {labels.admin.roles.create}
          </button>
          <ul className="role-picker">
            {roles.map((role) => (
              <li key={role.id}>
                <button
                  type="button"
                  className="role-option"
                  aria-current={role.id === selected?.id ? "true" : undefined}
                  onClick={() => setSelectedId(role.id)}
                >
                  <strong>{role.name}</strong>
                  <span>
                    {role.is_system ? labels.admin.roles.system : labels.admin.roles.custom}
                    {role.is_active ? "" : ` · ${labels.admin.catalogs.inactive}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {selected ? (
          <div className="stack-large">
            <div className="stack">
              <h3>{selected.name}</h3>
              <p className="cell-sub">
                {selected.code} ·{" "}
                {selected.requires_council ? labels.admin.roles.territorial : labels.admin.roles.general}
              </p>
              {readOnly ? <Notice>{labels.admin.roles.systemReadOnly}</Notice> : null}
            </div>

            <fieldset className="permission-list" disabled={readOnly}>
              <legend>{labels.admin.roles.permissions}</legend>
              {permissions.map((permission) => (
                <label key={permission.code} className="choice">
                  <input
                    type="checkbox"
                    checked={draft.has(permission.code)}
                    onChange={() => togglePermission(permission.code)}
                  />
                  <span>
                    {permission.description}
                    <small>{permission.code}</small>
                  </span>
                </label>
              ))}
            </fieldset>

            {actionError ? (
              <Notice tone="error">{errorMessage(actionError.code, actionError.details)}</Notice>
            ) : null}
            {saved && !isDirty ? <Notice>{labels.admin.roles.saved}</Notice> : null}

            {!readOnly ? (
              <div className="actions">
                <button
                  type="button"
                  className="button button-primary"
                  disabled={!isDirty || savePermissions.state.status === "pending"}
                  onClick={save}
                >
                  {savePermissions.state.status === "pending"
                    ? labels.dialog.pending
                    : labels.admin.roles.savePermissions}
                </button>
                <button
                  type="button"
                  className="button button-quiet"
                  onClick={() => setDialog({ role: selected })}
                >
                  {labels.admin.roles.editRole}
                </button>
                <button
                  type="button"
                  className="button button-quiet"
                  disabled={toggleActive.state.status === "pending"}
                  onClick={changeActive}
                >
                  {selected.is_active ? labels.admin.catalogs.deactivate : labels.admin.catalogs.activate}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {dialog ? (
        <RoleDialog role={dialog.role} onSaved={handleRoleSaved} onCancel={() => setDialog(null)} />
      ) : null}
    </section>
  );
}
