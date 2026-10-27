import { callRpc } from "./rpc.js";

// Contrato asumido de las RPC de reportes (SPECS §5.1 no fija los nombres de columna).
// Si tus RPC devuelven otros nombres, se ajusta únicamente aquí.
//   get_campaign_summary   → fila/objeto: enrolled, validated, missing, discarded,
//                            delivered, pending_delivery
//   get_delivery_progress  → filas: territory_id, council_id, validated, delivered,
//                            pending_delivery (opcional: territory_name, council_name)
//   get_planning_counts    → filas: territory_id, age_range, sex, validated
//                            (opcional: territory_name)

function pick(row, keys) {
  for (const key of keys) {
    if (row?.[key] !== undefined && row[key] !== null) return row[key];
  }
  return 0;
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asRows(data) {
  if (Array.isArray(data)) return data;
  return data ? [data] : [];
}

export function normalizeSummary(data) {
  const row = Array.isArray(data) ? data[0] : data;
  return {
    enrolled: toNumber(pick(row, ["enrolled", "total_enrolled", "inscribed", "total_inscribed"])),
    validated: toNumber(pick(row, ["validated"])),
    missing: toNumber(pick(row, ["missing", "pending_validation"])),
    discarded: toNumber(pick(row, ["discarded"])),
    delivered: toNumber(pick(row, ["delivered"])),
    pendingDelivery: toNumber(pick(row, ["pending_delivery", "pending_deliveries"])),
  };
}

export function normalizeProgressRows(data) {
  return asRows(data).map((row) => ({
    territoryId: row.territory_id ?? null,
    territoryName: row.territory_name ?? null,
    councilId: row.council_id ?? null,
    councilName: row.council_name ?? null,
    validated: toNumber(pick(row, ["validated"])),
    delivered: toNumber(pick(row, ["delivered"])),
    pendingDelivery: toNumber(pick(row, ["pending_delivery", "pending"])),
  }));
}

export function normalizePlanningRows(data) {
  return asRows(data).map((row) => ({
    territoryId: row.territory_id ?? null,
    territoryName: row.territory_name ?? null,
    ageRange: row.age_range,
    sex: row.sex,
    validated: toNumber(pick(row, ["validated", "count"])),
  }));
}

export async function getCampaignSummary(campaignId) {
  return normalizeSummary(await callRpc("get_campaign_summary", { p_campaign_id: campaignId }));
}

export async function getDeliveryProgress(campaignId) {
  return normalizeProgressRows(
    await callRpc("get_delivery_progress", { p_campaign_id: campaignId }),
  );
}

export async function getPlanningCounts(campaignId) {
  return normalizePlanningRows(await callRpc("get_planning_counts", { p_campaign_id: campaignId }));
}
