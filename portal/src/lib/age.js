function parseIsoDate(isoDate) {
  const [year, month, day] = String(isoDate).split("-").map(Number);
  return { year, month, day };
}

export function todayIsoDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

// Edad cumplida a la fecha de corte, igual que private.calculate_age
export function calculateAge(birthDate, referenceDate) {
  const birth = parseIsoDate(birthDate);
  const reference = parseIsoDate(referenceDate);
  const hasHadBirthday =
    reference.month > birth.month || (reference.month === birth.month && reference.day >= birth.day);
  return reference.year - birth.year - (hasHadBirthday ? 0 : 1);
}

// Devuelve null fuera de 0-10 (regla de calidad Q003)
export function ageRangeForAge(age) {
  if (age >= 0 && age <= 3) return "AGE_0_3";
  if (age >= 4 && age <= 7) return "AGE_4_7";
  if (age >= 8 && age <= 10) return "AGE_8_10";
  return null;
}

export function describeAge(birthDate, cutoffDate) {
  if (!birthDate || !cutoffDate) return null;
  const age = calculateAge(birthDate, cutoffDate);
  return { age, range: ageRangeForAge(age) };
}
