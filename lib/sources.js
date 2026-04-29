// lib/sources.js
// Classify, normalize, filter, and aggregate cited sources from the execute-prompts pipeline.
// Browser-safe pure JS — used by the BrandAudit client component.

const REDDIT_HOSTS = ["reddit.com", "redd.it", "old.reddit.com"];
const YOUTUBE_HOSTS = ["youtube.com", "youtu.be", "m.youtube.com", "music.youtube.com"];

function safeUrl(input) {
  if (!input || typeof input !== "string") return null;
  try {
    return new URL(input);
  } catch {
    return null;
  }
}

export function extractHost(url) {
  const u = safeUrl(url);
  if (!u) return "";
  return u.hostname.toLowerCase().replace(/^www\./, "");
}

function hostMatches(host, list) {
  if (!host) return false;
  return list.some((h) => host === h || host.endsWith(`.${h}`));
}

export function classifySource(url) {
  const host = extractHost(url);
  if (hostMatches(host, REDDIT_HOSTS)) return "reddit";
  if (hostMatches(host, YOUTUBE_HOSTS)) return "youtube";
  return "url";
}

export function normalizeUrl(url) {
  const u = safeUrl(url);
  if (!u) return "";
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  let pathname = u.pathname.replace(/\/+$/, "");
  if (!pathname) pathname = "";
  return `${u.protocol}//${host}${pathname}`;
}

function slugifyBrand(name) {
  return (name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isBranded(url, exclusion = {}) {
  const host = extractHost(url);
  if (!host) return false;

  const officialDomains = (exclusion.officialDomains || [])
    .map((d) => String(d).toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, ""))
    .filter(Boolean);

  for (const dom of officialDomains) {
    if (host === dom || host.endsWith(`.${dom}`)) return true;
  }

  // Social handle exclusion: if there's an explicit YouTube/Reddit handle for the brand,
  // filter URLs that target that exact channel/subreddit.
  const handles = exclusion.socialHandles || [];
  for (const h of handles) {
    if (!h?.handle) continue;
    const handle = String(h.handle).toLowerCase().replace(/^@/, "").replace(/^r\//, "");
    const platform = String(h.platform || "").toLowerCase();
    if (!handle) continue;
    const lowerUrl = url.toLowerCase();
    if (platform === "youtube" && hostMatches(host, YOUTUBE_HOSTS)) {
      if (lowerUrl.includes(`/@${handle}`) || lowerUrl.includes(`/c/${handle}`) || lowerUrl.includes(`/user/${handle}`)) return true;
    }
    if (platform === "reddit" && hostMatches(host, REDDIT_HOSTS)) {
      if (lowerUrl.includes(`/r/${handle}/`) || lowerUrl.endsWith(`/r/${handle}`)) return true;
    }
  }

  // Heuristic fallback: when no officialDomains supplied, treat host containing brand slug as branded.
  if (!officialDomains.length && exclusion.brandSlug) {
    const slug = exclusion.brandSlug;
    if (slug.length >= 3 && host.replace(/[.-]/g, "").includes(slug)) return true;
  }
  return false;
}

export function extractSubreddit(url) {
  const u = safeUrl(url);
  if (!u) return "";
  const m = u.pathname.match(/\/r\/([^/]+)/i);
  return m ? `r/${m[1]}` : "";
}

export function extractYoutubeId(url) {
  const u = safeUrl(url);
  if (!u) return "";
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "youtu.be") return u.pathname.replace(/^\//, "").split("/")[0] || "";
  if (host.endsWith("youtube.com")) {
    const v = u.searchParams.get("v");
    if (v) return v;
    const m = u.pathname.match(/\/(?:embed|shorts|live)\/([^/?#]+)/i);
    if (m) return m[1];
  }
  return "";
}

function addToSet(target, key, value) {
  if (!target[key]) target[key] = new Set();
  target[key].add(value);
}

/**
 * Aggregate raw per-result sources into kind-keyed lists with category/topic counts.
 *
 * @param {Array<{category: string, topic: string, sources?: Array<{url:string,title?:string,score?:number}>}>} results
 * @param {{ officialDomains?: string[], socialHandles?: Array<{platform:string,handle:string}>, brandSlug?: string }} exclusion
 * @returns {{
 *   reddit: AggregatedSource[],
 *   youtube: AggregatedSource[],
 *   url: AggregatedSource[],
 *   byCategory: Record<string, { reddit: AggregatedSource[], youtube: AggregatedSource[], url: AggregatedSource[] }>,
 *   totals: { reddit: number, youtube: number, url: number, raw: number, branded: number }
 * }}
 */
export function aggregateSources(results, exclusion = {}) {
  const slug = exclusion.brandSlug || "";
  const exc = { ...exclusion, brandSlug: slug };

  // Map keyed by `${kind}::${normalizedUrl}` (global) and `${cat}::${kind}::${url}` (per-cat).
  const global = { reddit: new Map(), youtube: new Map(), url: new Map() };
  const perCat = {};
  const totals = { reddit: 0, youtube: 0, url: 0, raw: 0, branded: 0 };

  if (!Array.isArray(results)) {
    return { reddit: [], youtube: [], url: [], byCategory: {}, totals };
  }

  for (const r of results) {
    const cat = r?.category || "Uncategorized";
    const topic = r?.topic || "";
    const sources = Array.isArray(r?.sources) ? r.sources : [];
    for (const s of sources) {
      if (!s?.url) continue;
      totals.raw++;
      if (isBranded(s.url, exc)) { totals.branded++; continue; }
      const norm = normalizeUrl(s.url);
      if (!norm) continue;
      const kind = classifySource(s.url);
      totals[kind]++;

      // Global aggregation
      const gKey = norm;
      const gMap = global[kind];
      const existing = gMap.get(gKey);
      if (existing) {
        existing.count++;
        addToSet(existing, "categories", cat);
        if (topic) addToSet(existing, "topics", topic);
        existing.perTopic[topic] = (existing.perTopic[topic] || 0) + 1;
        existing.perCategory[cat] = (existing.perCategory[cat] || 0) + 1;
      } else {
        gMap.set(gKey, {
          url: norm,
          originalUrl: s.url,
          host: extractHost(s.url),
          title: s.title || "",
          count: 1,
          categories: new Set([cat]),
          topics: new Set(topic ? [topic] : []),
          perTopic: topic ? { [topic]: 1 } : {},
          perCategory: { [cat]: 1 },
        });
      }

      // Per-category aggregation
      if (!perCat[cat]) perCat[cat] = { reddit: new Map(), youtube: new Map(), url: new Map() };
      const cMap = perCat[cat][kind];
      const cExisting = cMap.get(gKey);
      if (cExisting) {
        cExisting.count++;
        if (topic) cExisting.topics.add(topic);
        cExisting.perTopic[topic] = (cExisting.perTopic[topic] || 0) + 1;
      } else {
        cMap.set(gKey, {
          url: norm,
          originalUrl: s.url,
          host: extractHost(s.url),
          title: s.title || "",
          count: 1,
          topics: new Set(topic ? [topic] : []),
          perTopic: topic ? { [topic]: 1 } : {},
        });
      }
    }
  }

  const sorter = (a, b) => b.count - a.count || a.host.localeCompare(b.host);
  const finalize = (m) => Array.from(m.values()).sort(sorter);

  const byCategory = {};
  for (const cat of Object.keys(perCat)) {
    byCategory[cat] = {
      reddit: finalize(perCat[cat].reddit),
      youtube: finalize(perCat[cat].youtube),
      url: finalize(perCat[cat].url),
    };
  }

  return {
    reddit: finalize(global.reddit),
    youtube: finalize(global.youtube),
    url: finalize(global.url),
    byCategory,
    totals,
  };
}

export function buildExclusion(discovery) {
  if (!discovery) return { officialDomains: [], socialHandles: [], brandSlug: "" };
  return {
    officialDomains: Array.isArray(discovery.officialDomains) ? discovery.officialDomains : [],
    socialHandles: Array.isArray(discovery.socialHandles) ? discovery.socialHandles : [],
    brandSlug: slugifyBrand(discovery.brand || ""),
  };
}
