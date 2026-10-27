import { labels } from "./labels.js";

// La navegación se gobierna con permisos, nunca con nombres de rol
export const NAV_ITEMS = Object.freeze([
  { key: "dashboard", label: labels.nav.dashboard, isVisible: () => true },
  {
    key: "inscriptions",
    label: labels.nav.inscriptions,
    isVisible: (can) => can("inscription.read_own_council") || can("inscription.read_all"),
  },
  {
    key: "newInscription",
    label: labels.nav.newInscription,
    isVisible: (can) => can("inscription.create"),
  },
  { key: "delivery", label: labels.nav.delivery, isVisible: (can) => can("delivery.confirm") },
  { key: "audit", label: labels.nav.audit, isVisible: (can) => can("audit.read") },
  {
    key: "users",
    label: labels.nav.users,
    isVisible: (can) => can("user.read") || can("user.manage"),
  },
  { key: "catalogs", label: labels.nav.catalogs, isVisible: (can) => can("catalog.manage") },
  { key: "campaign", label: labels.nav.campaign, isVisible: (can) => can("catalog.manage") },
  { key: "roles", label: labels.nav.roles, isVisible: (can) => can("role.manage") },
]);

export function getVisibleNavItems(can) {
  return NAV_ITEMS.filter((item) => item.isVisible(can));
}
