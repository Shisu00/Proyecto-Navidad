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
  { key: "campaign", label: labels.nav.campaign, isVisible: (can) => can("catalog.manage") },
]);

export function getVisibleNavItems(can) {
  return NAV_ITEMS.filter((item) => item.isVisible(can));
}
