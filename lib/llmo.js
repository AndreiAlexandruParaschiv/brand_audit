// lib/llmo.js
// LLMO API client — looks up site metadata (imsOrgId, baseURL) for DRS requests

/**
 * Reads the Spacecat API configuration from environment variables.
 *
 * @returns {{ baseUrl: string, apiKey: string }}
 * @throws {Error} When the API base URL or key is missing.
 */
function getLlmoConfig() {
  const baseUrl = process.env.LLMO_BASE_API?.replace(/\/+$/, "");
  const apiKey = process.env.LLMO_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error("LLMO is not configured. Set LLMO_BASE_API and LLMO_API_KEY environment variables.");
  }
  return { baseUrl, apiKey };
}

/**
 * Fetches the Spacecat site list.
 *
 * The Spacecat REST API returns an array of site DTOs. Each site uses camelCase
 * fields, with the Spacecat site UUID exposed as `id`.
 *
 * @param {{ baseUrl: string, apiKey: string }} config
 * @returns {Promise<object[]>}
 */
async function fetchSites({ baseUrl, apiKey }) {
  const res = await fetch(`${baseUrl}/sites`, {
    headers: { "x-api-key": apiKey },
  });
  if (!res.ok) {
    throw new Error(`LLMO /sites request failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

/**
 * Fetches a Spacecat organization by its Spacecat organization UUID.
 *
 * @param {{ baseUrl: string, apiKey: string }} config
 * @param {string} organizationId Spacecat organization UUID from a site DTO.
 * @returns {Promise<object>} Organization DTO, including `imsOrgId`.
 */
async function fetchOrganization({ baseUrl, apiKey }, organizationId) {
  const res = await fetch(`${baseUrl}/organizations/${organizationId}`, {
    headers: { "x-api-key": apiKey },
  });
  if (!res.ok) {
    throw new Error(`LLMO /organizations/${organizationId} request failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

/**
 * Normalizes names for loose brand comparisons.
 *
 * @param {string} value
 * @returns {string}
 */
function compact(value) {
  return value.trim().toLowerCase().replaceAll(/[^a-z0-9]/g, "");
}

/**
 * Extracts normalized hostname labels from a site base URL.
 *
 * @param {string} baseURL
 * @returns {string[]}
 */
function getHostnameLabels(baseURL) {
  try {
    const hostname = new URL(baseURL).hostname.toLowerCase().replace(/^www\./, "");
    return hostname.split(".");
  } catch {
    return [];
  }
}

/**
 * Finds a Spacecat site for a brand name using ranked, intentionally limited matching.
 *
 * Exact hostname-label matches rank highest (for example, "Nike" -> nike.com),
 * followed by exact site-name matches, then partial hostname-label matches. If
 * the best score has more than one candidate, the lookup fails instead of
 * guessing the wrong Spacecat site.
 *
 * @param {object[]} siteList Spacecat site DTOs from `/sites`.
 * @param {string} brand Brand name provided by the caller.
 * @returns {object} Matching Spacecat site DTO.
 * @throws {Error} When no site matches or the best match is ambiguous.
 */
function findSiteByBrand(siteList, brand) {
  const brandKey = compact(brand);

  if (!brandKey) {
    throw new Error("Brand is required.");
  }

  const matches = siteList
    .map((site) => {
      const labels = getHostnameLabels(site.baseURL);
      const siteNameKey = compact(site.name || "");

      let score = 0;

      if (labels.some((label) => compact(label) === brandKey)) {
        score = 100;
      } else if (siteNameKey === brandKey) {
        score = 90;
      } else if (labels.some((label) => compact(label).includes(brandKey))) {
        score = 50;
      }

      return { site, score };
    })
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score);

  if (matches.length === 0) {
    const available = siteList.map((s) => s.baseURL).filter(Boolean).join(", ");
    throw new Error(
      `No LLMO site found matching "${brand}". Available sites: ${available || "(none)"}`
    );
  }

  const bestScore = matches[0].score;
  const bestMatches = matches.filter((match) => match.score === bestScore);

  if (bestMatches.length > 1) {
    const candidates = bestMatches.map((match) => match.site.baseURL).join(", ");
    throw new Error(
      `Ambiguous LLMO site found matching "${brand}". Candidates: ${candidates}`
    );
  }

  return matches[0].site;
}

/**
 * Looks up the Spacecat metadata required for DRS requests from a brand name.
 *
 * Spacecat REST DTO fields are used directly:
 * - `/sites` returns an array.
 * - Site UUID is `site.id`.
 * - Organization IMS org ID is `organization.imsOrgId`.
 *
 * @param {string} brand Brand name, such as "Nike" or "Land Rover".
 * @returns {Promise<{ imsOrgId: string, brand: string, siteId: string, site: string }>}
 */
export async function lookupSiteMetadata(brand) {
  const config = getLlmoConfig();

  const sites = await fetchSites(config);
  if (!Array.isArray(sites)) {
    throw new TypeError(`Expected LLMO /sites to return an array. Response: ${JSON.stringify(sites).slice(0, 200)}`);
  }

  const matchedSite = findSiteByBrand(sites, brand);

  const org = await fetchOrganization(config, matchedSite.organizationId);

  if (!org.imsOrgId) {
    throw new Error(
      `Organization ${matchedSite.organizationId} has no imsOrgId. Response: ${JSON.stringify(org).slice(0, 200)}`
    );
  }

  if (!matchedSite.id) {
    throw new Error(
      `Matched site for "${brand}" has no id. Response: ${JSON.stringify(matchedSite).slice(0, 200)}`
    );
  }

  return {
    imsOrgId: org.imsOrgId,
    brand: brand.trim(),
    siteId: matchedSite.id,
    site: matchedSite.baseURL,
  };
}
