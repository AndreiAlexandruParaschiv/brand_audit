// lib/compare.js
// Client-side comparison between the app's Tavily-cited sources and a ChatGPT reference CSV.
// Browser-safe pure JS.

import { normalizeUrl, classifySource, isBranded } from "./sources.js";

function parseQuotedCsvLine(line) {
  const cols = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      i++;
      let val = "";
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') { val += '"'; i += 2; }
        else if (line[i] === '"') { i++; break; }
        else { val += line[i++]; }
      }
      cols.push(val);
      if (line[i] === ',') i++;
    } else {
      const start = i;
      while (i < line.length && line[i] !== ',') i++;
      cols.push(line.slice(start, i));
      i++;
    }
  }
  return cols;
}

// Parse the ChatGPT reference CSV exported from Adobe LLM Optimizer (or similar).
// Expected columns: URL, Content Type, Times Cited, Prompts Cited In, Categories, Markets
export function parseReferenceCsv(text) {
  const clean = text.replace(/^﻿/, "");
  const lines = clean.split(/\r?\n/);
  const result = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cols = parseQuotedCsvLine(line);
    if (cols.length < 4) continue;
    const url = cols[0]?.trim();
    if (!url) continue;
    result.push({
      url,
      contentType: cols[1]?.trim() || "",
      timesCited: parseInt(cols[2]) || 0,
      promptsCitedIn: parseInt(cols[3]) || 0,
      categories: cols[4]?.trim() || "",
    });
  }
  return result;
}

// Content Types in LLMO that count as "off-site" — Owned (brand's own pages) is excluded.
// Anything else (Earned, Others, Social, blank, unknown) is treated as off-site by default.
const OFFSITE_CONTENT_TYPE_EXCLUDE = new Set(["owned"]);

function isOffSite(row) {
  const ct = (row.contentType || "").trim().toLowerCase();
  return !OFFSITE_CONTENT_TYPE_EXCLUDE.has(ct);
}

// Compare the app's aggregated sources against a parsed reference CSV.
// Returns per-kind (url/reddit/youtube): overlap, appOnly, refOnly arrays + totals.
// LLMO rows with Content Type "Owned" are excluded so counts reflect true off-site sources.
export function compareWithReference(sourcesAggregate, referenceRows, exclusion = {}) {
  if (!sourcesAggregate || !referenceRows?.length) return null;

  const refMaps = { url: new Map(), reddit: new Map(), youtube: new Map() };
  for (const row of referenceRows) {
    if (!row.url) continue;
    if (isBranded(row.url, exclusion)) continue;
    if (!isOffSite(row)) continue; // skip Owned content — we're comparing off-site only
    const norm = normalizeUrl(row.url);
    if (!norm) continue;
    const kind = classifySource(row.url);
    if (!refMaps[kind].has(norm)) {
      refMaps[kind].set(norm, row);
    }
  }

  const comparison = {};
  for (const kind of ["url", "reddit", "youtube"]) {
    const appEntries = sourcesAggregate[kind] || [];
    const refMap = refMaps[kind];
    const appNorms = new Set(appEntries.map((e) => normalizeUrl(e.url)));

    const overlap = appEntries
      .filter((e) => refMap.has(normalizeUrl(e.url)))
      .map((e) => {
        const ref = refMap.get(normalizeUrl(e.url));
        return { ...e, refTimesCited: ref.timesCited, refPromptsCitedIn: ref.promptsCitedIn, refCategories: ref.categories };
      })
      .sort((a, b) => b.refTimesCited - a.refTimesCited);

    const appOnly = appEntries
      .filter((e) => !refMap.has(normalizeUrl(e.url)))
      .sort((a, b) => b.count - a.count);

    const refOnly = Array.from(refMap.entries())
      .filter(([norm]) => !appNorms.has(norm))
      .map(([, row]) => row)
      .sort((a, b) => b.timesCited - a.timesCited);

    comparison[kind] = { overlap, appOnly, refOnly, refTotal: refMap.size, appTotal: appEntries.length };
  }

  return comparison;
}
