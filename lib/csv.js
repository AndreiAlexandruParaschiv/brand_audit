// lib/csv.js
// Client-side CSV generation + download. RFC-4180 escaping. Browser-only.

function escapeCell(value) {
  if (value == null) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows, columns) {
  const header = columns.map((c) => escapeCell(c.header)).join(",");
  const body = rows.map((r) => columns.map((c) => escapeCell(r[c.key])).join(","));
  return [header, ...body].join("\r\n");
}

export function downloadCsv(filename, rows, columns) {
  if (typeof window === "undefined") return;
  const csv = toCsv(rows, columns);
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(href), 0);
}

export function todayStamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

export function slugifyForFile(name) {
  return (name || "brand").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "brand";
}
