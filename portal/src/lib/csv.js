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
