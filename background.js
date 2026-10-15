/**
 * Service worker: runs the analyzer and remembers recent scores.
 * Disabled-domain choices are stored here so the popup and the page stay in sync.
 */
"use strict";

importScripts("analyzer.js");

const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_LIMIT = 80;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== "string") return;

  const jobs = {
    ANALYZE: () => analyzeCached(message.page, Boolean(message.bypassCache)),
    GET_ENABLED: () => getEnabled(message.domain),
    SET_ENABLED: () => setEnabled(message.domain, Boolean(message.enabled)),
  };

  const job = jobs[message.type];
  if (!job) return;

  job()
    .then((payload) => sendResponse({ ok: true, ...payload }))
    .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Request failed" }));

  return true;
});

async function analyzeCached(page, bypassCache) {
  if (!page || typeof page.url !== "string" || !page.url) {
    throw new Error("Missing page details");
  }

  const domain = FNDAnalyzer.normalizeDomain(page.domain || page.url);
  const cacheKey = `${stripTracking(page.url)}|${String(page.headline || "").slice(0, 160)}`;

  if (!bypassCache) {
    const cached = await readCache(cacheKey);
    if (cached) return { result: cached };
  }

  const result = FNDAnalyzer.analyze({ ...page, domain });
  await writeCache(cacheKey, result);
  return { result };
}

async function getEnabled(domain) {
  const normalized = FNDAnalyzer.normalizeDomain(domain);
  const disabled = await disabledSet();
  return { domain: normalized, enabled: !disabled.has(normalized) };
}

async function setEnabled(domain, enabled) {
  const normalized = FNDAnalyzer.normalizeDomain(domain);
  if (!/^[a-z0-9.-]{1,253}$/.test(normalized)) {
    throw new Error("Invalid domain");
  }

  const disabled = await disabledSet();
  if (enabled) disabled.delete(normalized);
  else disabled.add(normalized);

  await chrome.storage.local.set({ disabledDomains: [...disabled] });
  return { domain: normalized, enabled };
}

async function disabledSet() {
  const stored = await chrome.storage.local.get({ disabledDomains: [] });
  return new Set(stored.disabledDomains);
}

async function readCache(key) {
  const stored = await chrome.storage.session.get({ scoreCache: {} });
  const hit = stored.scoreCache[key];
  if (!hit) return null;
  if (Date.now() - hit.savedAt > CACHE_TTL_MS) return null;
  return hit.result;
}

async function writeCache(key, result) {
  const stored = await chrome.storage.session.get({ scoreCache: {} });
  const cache = stored.scoreCache;
  cache[key] = { result, savedAt: Date.now() };

  const keys = Object.keys(cache);
  if (keys.length > CACHE_LIMIT) {
    keys
      .sort((a, b) => cache[a].savedAt - cache[b].savedAt)
      .slice(0, keys.length - CACHE_LIMIT)
      .forEach((stale) => delete cache[stale]);
  }

  await chrome.storage.session.set({ scoreCache: cache });
}

function stripTracking(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"].forEach((key) => {
      parsed.searchParams.delete(key);
    });
    return parsed.toString();
  } catch (_error) {
    return url;
  }
}
