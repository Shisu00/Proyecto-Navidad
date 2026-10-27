import { useAdminUsers } from "../hooks/useAdminData.js";
import { actionsInCategory, CATEGORY_ORDER } from "../lib/auditCategories.js";
import { SYSTEM_ACTOR } from "../lib/auditLog.js";
import { labels } from "../lib/labels.js";

export const EMPTY_AUDIT_FILTERS = Object.freeze({
  category: "",
  action: "",
  from: "",
  to: "",
  actorId: "",
});

export function hasActiveFilters(filters) {
  return Object.values(filters).some(Boolean);
}

export default function AuditFilters({ filters, onChange }) {
  // Si el usuario no puede listar cuentas, el filtro por persona simplemente no aparece
  const users = useAdminUsers();
  const subActions = actionsInCategory(filters.category);

  function update(changes) {
    onChange({ ...filters, ...changes });
  }

  return (
    <div className="stack">
      <div className="filter-chips" role="group" aria-label={labels.audit.filterCategory}>
        {["", ...CATEGORY_ORDER].map((category) => (
          <button
            key={category || "ALL"}
            type="button"
            className="filter-chip"
            aria-pressed={filters.category === category}
            onClick={() => update({ category, action: "" })}
          >
            {category ? labels.audit.categories[category] : labels.audit.filterAll}
          </button>
        ))}
      </div>

      <div className="audit-filters">
        {subActions.length > 0 ? (
          <label className="field">
            <span className="field-label">{labels.audit.filterAction}</span>
            <select value={filters.action} onChange={(event) => update({ action: event.target.value })}>
              <option value="">{labels.audit.filterActionAll}</option>
              {subActions.map((action) => (
                <option key={action} value={action}>
                  {labels.audit.actions[action]}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="field">
          <span className="field-label">{labels.audit.filterFrom}</span>
          <input
            type="date"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(event) => update({ from: event.target.value })}
          />
        </label>

        <label className="field">
          <span className="field-label">{labels.audit.filterTo}</span>
          <input
            type="date"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(event) => update({ to: event.target.value })}
          />
        </label>

        {users.data ? (
          <label className="field">
            <span className="field-label">{labels.audit.filterActor}</span>
            <select value={filters.actorId} onChange={(event) => update({ actorId: event.target.value })}>
              <option value="">{labels.audit.filterActorAll}</option>
              <option value={SYSTEM_ACTOR}>{labels.audit.filterActorSystem}</option>
              {users.data.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {hasActiveFilters(filters) ? (
          <button
            type="button"
            className="button button-quiet audit-clear"
            onClick={() => onChange({ ...EMPTY_AUDIT_FILTERS })}
          >
            {labels.audit.clearFilters}
          </button>
        ) : null}
      </div>
    </div>
  );
}
