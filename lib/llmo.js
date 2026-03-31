// lib/llmo.js
// LLMO API client — looks up site metadata (imsOrgId, baseURL) for DRS requests

function getLlmoConfig() {
  const baseUrl = process.env.LLMO_BASE_API?.replace(/\/+$/, "");
  const apiKey = process.env.LLMO_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error("LLMO is not configured. Set LLMO_BASE_API and LLMO_API_KEY environment variables.");
  }
  return { baseUrl, apiKey };
}

async function fetchSites({ baseUrl, apiKey }) {
  const res = await fetch(`${baseUrl}/sites`, {
    headers: { "x-api-key": apiKey },
  });
  if (!res.ok) {
    throw new Error(`LLMO /sites request failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

async function fetchOrganization({ baseUrl, apiKey }, organizationId) {
  const res = await fetch(`${baseUrl}/organizations/${organizationId}`, {
    headers: { "x-api-key": apiKey },
  });
  if (!res.ok) {
    throw new Error(`LLMO /organizations/${organizationId} request failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

export async function lookupSiteMetadata(brand) {
  const config = getLlmoConfig();

  const sites = await fetchSites(config);
  const siteList = Array.isArray(sites) ? sites : sites.sites || sites.data || [];

  const brandLower = brand.trim().toLowerCase();
  const matchedSite = siteList.find(
    (s) => s.baseURL && s.baseURL.toLowerCase().includes(brandLower)
  );

  if (!matchedSite) {
    const available = siteList.map((s) => s.baseURL).filter(Boolean).join(", ");
    throw new Error(
      `No LLMO site found matching "${brand}". Available sites: ${available || "(none)"}`
    );
  }

  const org = await fetchOrganization(config, matchedSite.organizationId);
  const imsOrgId = org.imsOrgId || org.ims_org_id;

  if (!imsOrgId) {
    throw new Error(
      `Organization ${matchedSite.organizationId} has no imsOrgId. Response: ${JSON.stringify(org).slice(0, 200)}`
    );
  }

  return {
    imsOrgId,
    brand: brand.trim(),
    site: matchedSite.baseURL,
  };
}
