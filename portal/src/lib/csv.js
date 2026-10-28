// CSV para Excel en español: separador ";" y BOM UTF-8 para que las tildes y la ñ se vean bien
const SEPARATOR = ";";
const FORMULA_START = /^[=+\-@\t\r]/;

// Un texto que empieza con = + - @ se interpretaría como fórmula al abrirlo en Excel
export function csvCell(value) {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  if (/[;"\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(headers, rows) {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(SEPARATOR));
  return `﻿${lines.join("\r\n")}\r\n`;
}

export function downloadCsv(filename, csv) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const pad = (value) => String(value).padStart(2, "0");

// Fecha y hora locales en columnas separadas: Excel (es-CL) reconoce dd-mm-aaaa como fecha
export function splitLocalDateTime(isoTimestamp) {
  if (!isoTimestamp) return { day: "", time: "" };
  const date = new Date(isoTimestamp);
  return {
    day: `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
  };
}

// "2018-03-05" → "05-03-2018", sin pasar por Date para no depender de la zona horaria
export function isoDateToCsv(isoDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(isoDate ?? ""));
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
}

export function slugify(text) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function csvFilename(prefix, detail, now = new Date()) {
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const parts = [prefix, detail ? slugify(detail) : "", stamp].filter(Boolean);
  return `${parts.join("_")}.csv`;
}
