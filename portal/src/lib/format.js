const dateTimeFormat = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "short",
  timeStyle: "short",
});

const dateFormat = new Intl.DateTimeFormat("es-CL", { dateStyle: "medium" });

export function formatDateTime(isoTimestamp) {
  if (!isoTimestamp) return "";
  return dateTimeFormat.format(new Date(isoTimestamp));
}

// Las fechas sin hora se arman con año/mes/día para no depender de la zona horaria
export function formatDate(isoDate) {
  if (!isoDate) return "";
  const [year, month, day] = String(isoDate).split("-").map(Number);
  return dateFormat.format(new Date(year, month - 1, day));
}
