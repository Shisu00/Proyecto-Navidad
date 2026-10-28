import { useState } from "react";
import { useAdminUsers, useRoleCatalog } from "../hooks/useAdminData.js";
import { usePermissions } from "../hooks/useAccount.jsx";
import { useAsyncAction } from "../hooks/useAsyncAction.js";
import { useAuth } from "../hooks/useAuth.jsx";
import { useCatalogs } from "../hooks/useCatalogs.jsx";
import { assignableRoles, canManageUser, filterUsers, userStatus } from "../lib/adminForms.js";
import { errorMessage, labels } from "../lib/labels.js";
import * as adminService from "../services/adminService.js";
import FormDialog from "./FormDialog.jsx";
import Notice from "./Notice.jsx";
import ReasonDialog from "./ReasonDialog.jsx";
import SearchBox from "./SearchBox.jsx";
import TempPasswordDialog from "./TempPasswordDialog.jsx";
import UserCreateDialog from "./UserCreateDialog.jsx";
import UserRow from "./UserRow.jsx";

const STATUS_OPTIONS = ["ACTIVE", "MUST_CHANGE", "INACTIVE"];

export default function UsersAdmin() {
  const { can } = usePermissions();
  const { userId } = useAuth();
  const { councilNames } = useCatalogs();
  const users = useAdminUsers();
  const catalog = useRoleCatalog();

  const [search, setSearch] = useState("");
  const [roleId, setRoleId] = useState("");
  const [status, setStatus] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [secret, setSecret] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [toggleTarget, setToggleTarget] = useState(null);

  const reset = useAsyncAction(adminService.resetPassword);
  const toggle = useAsyncAction(adminService.setProfileActive);

  const roles = catalog.data?.roles ?? [];
  const canManage = can("user.manage");
  const rows = users.data ? filterUsers(users.data, { search, roleId, status }) : [];

  function closeReset() {
    setResetTarget(null);
    reset.reset();
  }

  function closeToggle() {
    setToggleTarget(null);
    toggle.reset();
  }

  async function confirmReset() {
    const result = await reset.run({ userId: resetTarget.id });
    if (result.status === "success") {
      setSecret({
        title: labels.admin.users.resetDone,
        email: resetTarget.email,
        temporaryPassword: result.data.temporaryPassword,
      });
      closeReset();
      users.reload();
    }
  }

  async function confirmToggle(reason) {
    const result = await toggle.run({
      userId: toggleTarget.id,
      active: !toggleTarget.is_active,
      reason,
    });
    if (result.status === "success") {
      closeToggle();
      users.reload();
    }
  }

  function handleCreated(created) {
    setIsCreating(false);
    setSecret({
      title: labels.admin.users.createdDone,
      email: created.email,
      temporaryPassword: created.temporaryPassword,
    });
    users.reload();
  }

  function locationText(user) {
    return user.council_id ? councilNames.get(user.council_id) : null;
  }

  return (
    <section className="stack-large" aria-labelledby="users-title">
      <div className="stack">
        <h2 id="users-title">{labels.admin.users.title}</h2>
        <p>{labels.admin.users.intro}</p>
      </div>

      {users.status === "error" ? (
        <div className="stack">
          <Notice tone="error">{errorMessage(users.errorCode)}</Notice>
          <button type="button" className="button button-primary" onClick={users.reload}>
            {labels.app.retry}
          </button>
        </div>
      ) : null}

      <div className="list-card">
        <div className="list-bar">
          <p className="list-total" aria-live="polite">
            <span className="list-total-label">{labels.admin.users.totalLabel}</span>
            <strong>
              {users.data ? labels.admin.users.total(rows.length) : labels.app.loading}
            </strong>
          </p>
          <div className="list-tools">
            <label className="select-pill">
              <span className="visually-hidden">{labels.admin.users.role}</span>
              <select value={roleId} onChange={(event) => setRoleId(event.target.value)}>
                <option value="">{labels.admin.users.roleAll}</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="select-pill">
              <span className="visually-hidden">{labels.admin.users.columnStatus}</span>
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">{labels.admin.users.statusAll}</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {labels.admin.users.status[option]}
                  </option>
                ))}
              </select>
            </label>
            <div className="search-block">
              <SearchBox
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onClear={() => setSearch("")}
                label={labels.admin.users.search}
                placeholder={labels.admin.users.searchPlaceholder}
              />
            </div>
            {canManage ? (
              <button
                type="button"
                className="button button-primary list-tools-action"
                disabled={!catalog.data}
                onClick={() => setIsCreating(true)}
              >
                {labels.admin.users.create}
              </button>
            ) : null}
          </div>
        </div>

        {users.data ? (
          rows.length === 0 ? (
            <p className="empty">{labels.admin.users.empty}</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">{labels.admin.users.columnUser}</th>
                  <th scope="col">{labels.admin.users.columnRole}</th>
                  <th scope="col">{labels.admin.users.columnStatus}</th>
                  <th scope="col" className="th-actions">
                    {labels.inscription.columnActions}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    status={userStatus(user)}
                    locationText={locationText(user)}
                    isSelf={user.id === userId}
                    canAct={canManage && canManageUser(user, roles, can)}
                    onResetPassword={setResetTarget}
                    onToggleActive={setToggleTarget}
                  />
                ))}
              </tbody>
            </table>
          )
        ) : null}
      </div>

      {isCreating ? (
        <UserCreateDialog
          roles={assignableRoles(roles, can)}
          onCreated={handleCreated}
          onCancel={() => setIsCreating(false)}
        />
      ) : null}

      {resetTarget ? (
        <FormDialog
          title={labels.admin.users.resetTitle}
          description={labels.admin.users.resetDescription(resetTarget.full_name)}
          submitLabel={labels.admin.users.resetConfirm}
          isPending={reset.state.status === "pending"}
          error={reset.state.status === "error" ? reset.state.error : null}
          onSubmit={confirmReset}
          onCancel={closeReset}
        />
      ) : null}

      {toggleTarget ? (
        <ReasonDialog
          title={
            toggleTarget.is_active
              ? labels.admin.users.deactivateTitle
              : labels.admin.users.reactivateTitle
          }
          description={
            toggleTarget.is_active
              ? labels.admin.users.deactivateDescription(toggleTarget.full_name)
              : labels.admin.users.reactivateDescription(toggleTarget.full_name)
          }
          reasonLabel={labels.admin.users.reason}
          confirmLabel={
            toggleTarget.is_active ? labels.admin.users.deactivate : labels.admin.users.reactivate
          }
          isRequired
          isPending={toggle.state.status === "pending"}
          errorCode={toggle.state.status === "error" ? toggle.state.error.code : null}
          onConfirm={confirmToggle}
          onCancel={closeToggle}
        />
      ) : null}

      {secret ? (
        <TempPasswordDialog
          title={secret.title}
          email={secret.email}
          temporaryPassword={secret.temporaryPassword}
          onClose={() => setSecret(null)}
        />
      ) : null}
    </section>
  );
}
