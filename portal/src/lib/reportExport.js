import { csvFilename, isoDateToCsv, splitLocalDateTime, toCsv } from "./csv.js";
import { formatIdNumber } from "./identification.js";
import { enumLabels, labels } from "./labels.js";

const yesNo = (value) => (value ? labels.reports.yes : labels.reports.no);
const id = (value) => (value ? formatIdNumber(value) : "");

export function inscriptionReportRow(row) {
  const { day, time } = splitLocalDateTime(row.created_at);
  const delivered = splitLocalDateTime(row.delivered_at);
  return [
    day,
    time,
    row.council_name,
    row.territory_name,
    enumLabels.idType[row.beneficiary_id_type] ?? row.beneficiary_id_type,
    id(row.beneficiary_id_number),
    enumLabels.sex[row.sex] ?? row.sex,
    isoDateToCsv(row.birth_date),
    row.age_at_cutoff,
    enumLabels.ageRange[row.age_range] ?? "",
    row.guardian_full_name,
    id(row.guardian_id_number),
    row.guardian_email,
    row.guardian_phone,
    enumLabels.displayStatus[row.display_status] ?? row.display_status,
    yesNo(row.has_observation),
    row.open_cases_count,
    row.duplicate_justification,
    delivered.day,
    delivered.time,
  ];
}

export function buildInscriptionsCsv(rows) {
  // Más recientes primero, igual que el listado
  const sorted = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return toCsv(labels.reports.inscriptionHeaders, sorted.map(inscriptionReportRow));
}

export function deliveryReportRow(row) {
  const { day, time } = splitLocalDateTime(row.delivered_at);
  const voided = splitLocalDateTime(row.voided_at);
  return [
    day,
    time,
    row.council_name,
    row.territory_name,
    enumLabels.withdrawalType[row.withdrawal_type] ?? row.withdrawal_type,
    id(row.withdrawer_id_number),
    enumLabels.idType[row.beneficiary_id_type] ?? row.beneficiary_id_type,
    id(row.beneficiary_id_number),
    row.guardian_full_name,
    id(row.guardian_id_number),
    row.delivered_by_name,
    row.observation,
    yesNo(row.responsibility_confirmed),
    yesNo(row.scanned_from_id_card),
    row.is_voided ? labels.reports.voided : labels.reports.active,
    voided.day,
    voided.time,
    row.voided_by_name,
    row.void_reason,
  ];
}

export function buildDeliveriesCsv(rows) {
  const sorted = [...rows].sort((a, b) => b.delivered_at.localeCompare(a.delivered_at));
  return toCsv(labels.reports.deliveryHeaders, sorted.map(deliveryReportRow));
}

export function reportFilename(kind, campaignName, now = new Date()) {
  return csvFilename(kind, campaignName, now);
}
