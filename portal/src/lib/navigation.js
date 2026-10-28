import { labels } from "./labels.js";

// La navegación se gobierna con permisos, nunca con nombres de rol.
// Barra superior: el trabajo diario. Barra lateral: administración, análisis y control.
export const TOP_NAV_ITEMS = Object.freeze([
  { key: "dashboard", label: labels.nav.dashboard, icon: "chart", isVisible: () => true },
  {
    key: "newInscription",
    label: labels.nav.newInscription,
    shortLabel: labels.nav.newInscriptionShort,
    icon: "plus",
    isVisible: (can) => can("inscription.create"),
  },
  {
    key: "inscriptions",
    label: labels.nav.inscriptions,
    icon: "list",
    isVisible: (can) => can("inscription.read_own_council") || can("inscription.read_all"),
  },
  {
    key: "delivery",
    label: labels.nav.delivery,
    icon: "gift",
    isVisible: (can) => can("delivery.confirm"),
  },
]);

export const SIDE_NAV_ITEMS = Object.freeze([
  { key: "catalogs", label: labels.nav.catalogs, isVisible: (can) => can("catalog.manage") },
  { key: "roles", label: labels.nav.roles, isVisible: (can) => can("role.manage") },
  {
    key: "users",
    label: labels.nav.users,
    isVisible: (can) => can("user.read") || can("user.manage"),
  },
  { key: "campaign", label: labels.nav.campaign, isVisible: (can) => can("catalog.manage") },
  { key: "analytics", label: labels.nav.analytics, isVisible: (can) => can("planning.read") },
  { key: "reports", label: labels.nav.reports, isVisible: (can) => can("data.export") },
  { key: "audit", label: labels.nav.audit, isVisible: (can) => can("audit.read") },
]);

export function getTopNavItems(can) {
  return TOP_NAV_ITEMS.filter((item) => item.isVisible(can));
}

export function getSideNavItems(can) {
  return SIDE_NAV_ITEMS.filter((item) => item.isVisible(can));
}

export function getVisibleNavItems(can) {
  return [...getTopNavItems(can), ...getSideNavItems(can)];
}
