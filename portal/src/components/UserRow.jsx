import { formatDateTime } from "../lib/format.js";
import { labels } from "../lib/labels.js";

const STATUS_CLASS = { ACTIVE: "chip-registered", MUST_CHANGE: "chip-in_review", INACTIVE: "chip-discarded" };

export default function UserRow({
  user,
  status,
  locationText,
  isSelf,
  canAct,
  onResetPassword,
  onToggleActive,
}) {
  return (
    <tr>
      <td className="cell-user" data-label={labels.admin.users.columnUser}>
        <p className="cell-title">{user.full_name}</p>
        <p className="cell-sub">{user.email}</p>
      </td>
      <td className="cell-role" data-label={labels.admin.users.columnRole}>
        <p className="cell-title">{user.role_name}</p>
        {locationText ? <p className="cell-sub">{locationText}</p> : null}
      </td>
      <td className="cell-status" data-label={labels.admin.users.columnStatus}>
        <span className={`chip ${STATUS_CLASS[status]}`}>{labels.admin.users.status[status]}</span>
        <p className="cell-sub">
          {user.last_sign_in_at
            ? labels.admin.users.lastSignIn(formatDateTime(user.last_sign_in_at))
            : labels.admin.users.neverSignedIn}
        </p>
      </td>
      <td className="cell-actions">
        {canAct ? (
          <>
            {user.is_active ? (
              <button type="button" className="button button-small" onClick={() => onResetPassword(user)}>
                {labels.admin.users.resetPassword}
              </button>
            ) : null}
            {!isSelf || !user.is_active ? (
              <button type="button" className="button button-small" onClick={() => onToggleActive(user)}>
                {user.is_active ? labels.admin.users.deactivate : labels.admin.users.reactivate}
              </button>
            ) : null}
          </>
        ) : null}
      </td>
    </tr>
  );
}
