import { isValidIdNumber, normalizeIdNumber, ID_TYPES } from "./identification.js";
import { isValidRut, normalizeRut } from "./rut.js";

export const EMPTY_INSCRIPTION_VALUES = Object.freeze({
  idType: ID_TYPES.RUT,
  idNumber: "",
  sex: "",
  birthDate: "",
  guardianName: "",
  guardianIdNumber: "",
  guardianEmail: "",
  guardianPhone: "",
});

// Mismo patrón que guardians_email_format
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_PATTERN = /^[0-9+()\s-]{7,20}$/;

// Validación local de UX: el servidor vuelve a validar todo
export function validateInscription(values, todayIso) {
  const errors = {};

  if (!values.idNumber.trim()) errors.idNumber = "REQUIRED";
  else if (!isValidIdNumber(values.idType, values.idNumber)) {
    errors.idNumber = values.idType === ID_TYPES.RUT ? "INVALID_RUT" : "INVALID_IPE";
  }

  if (!values.sex) errors.sex = "REQUIRED";

  if (!values.birthDate) errors.birthDate = "REQUIRED";
  else if (values.birthDate > todayIso) errors.birthDate = "FUTURE_DATE";

  if (!values.guardianName.trim()) errors.guardianName = "REQUIRED";

  if (!values.guardianIdNumber.trim()) errors.guardianIdNumber = "REQUIRED";
  else if (!isValidRut(values.guardianIdNumber)) errors.guardianIdNumber = "INVALID_RUT";

  const email = values.guardianEmail.trim();
  if (email && !EMAIL_PATTERN.test(email)) errors.guardianEmail = "INVALID_EMAIL";

  const phone = values.guardianPhone.trim();
  if (phone && !PHONE_PATTERN.test(phone)) errors.guardianPhone = "INVALID_PHONE";

  return errors;
}

export function buildSubmitInput({ operationId, campaignId, values, justification, councilId }) {
  return {
    clientOperationId: operationId,
    campaignId,
    beneficiaryIdType: values.idType,
    beneficiaryIdNumber: normalizeIdNumber(values.idNumber),
    sex: values.sex,
    birthDate: values.birthDate,
    guardianFullName: values.guardianName.trim(),
    guardianIdNumber: normalizeRut(values.guardianIdNumber),
    guardianEmail: values.guardianEmail.trim() || null,
    guardianPhone: values.guardianPhone.trim() || null,
    duplicateJustification: justification ?? null,
    councilId: councilId ?? null,
  };
}

// Valores del formulario a partir de una fila de inscription_overview
export function valuesFromRow(row) {
  return {
    idType: row.beneficiary_id_type,
    idNumber: row.beneficiary_id_number,
    sex: row.sex,
    birthDate: row.birth_date,
    guardianName: row.guardian_full_name,
    guardianIdNumber: row.guardian_id_number,
    guardianEmail: row.guardian_email ?? "",
    guardianPhone: row.guardian_phone ?? "",
  };
}

export function buildUpdateInput({ inscriptionId, values, reason, justification }) {
  return {
    inscriptionId,
    reason,
    beneficiaryIdType: values.idType,
    beneficiaryIdNumber: normalizeIdNumber(values.idNumber),
    sex: values.sex,
    birthDate: values.birthDate,
    guardianFullName: values.guardianName.trim(),
    guardianIdNumber: normalizeRut(values.guardianIdNumber),
    guardianEmail: values.guardianEmail.trim() || null,
    guardianPhone: values.guardianPhone.trim() || null,
    duplicateJustification: justification ?? null,
  };
}

// Compara lo que el formulario enviaría con lo que ya está guardado
export function hasChanges(values, row) {
  const current = valuesFromRow(row);
  const norm = (value) => value.trim();
  return (
    values.idType !== current.idType ||
    normalizeIdNumber(values.idNumber) !== normalizeIdNumber(current.idNumber) ||
    values.sex !== current.sex ||
    values.birthDate !== current.birthDate ||
    norm(values.guardianName) !== norm(current.guardianName) ||
    normalizeRut(values.guardianIdNumber) !== normalizeRut(current.guardianIdNumber) ||
    norm(values.guardianEmail) !== norm(current.guardianEmail) ||
    norm(values.guardianPhone) !== norm(current.guardianPhone)
  );
}
