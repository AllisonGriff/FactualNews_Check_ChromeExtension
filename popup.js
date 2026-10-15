/**
 * Toolbar popup: score for the active tab, risk flags, and the per-site badge toggle.
 */
"use strict";

const panels = {
  loading: document.querySelector("#panel-loading"),
  unsupported: document.querySelector("#panel-unsupported"),
  error: document.querySelector("#panel-error"),
  result: document.querySelector("#panel-result"),
};

const domainNode = document.querySelector("#domain");
const scoreNode = document.querySelector("#score");
const statusNode = document.querySelector("#status");
const headlineNode = document.querySelector("#headline");
const summaryNode = document.querySelector("#summary");
const flagsNode = document.querySelector("#flags");
const factorsNode = document.querySelector("#factors");
const whyWrap = document.querySelector("#why-wrap");
const sourcesNode = document.querySelector("#sources");
const sourcesWrap = document.querySelector("#sources-wrap");
const enabledNode = document.querySelector("#enabled");
const refreshNode = document.querySelector("#refresh");

let currentDomain = "";

enabledNode.addEventListener("change", async () => {
  if (!currentDomain) return;
  enabledNode.disabled = true;
  try {
    await chrome.runtime.sendMessage({
      type: "SET_ENABLED",
      domain: currentDomain,
      enabled: enabledNode.checked,
    });
  } finally {
    enabledNode.disabled = false;
  }
});

refreshNode.addEventListener("click", () => {
  load(true);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.disabledDomains || !currentDomain) return;
  const disabled = new Set(changes.disabledDomains.newValue || []);
  enabledNode.checked = !disabled.has(currentDomain);
});

load(false);

async function load(bypassCache) {
  show("loading");
  domainNode.textContent = "Checking this tab…";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:\/\//i.test(tab.url || "")) {
      domainNode.textContent = "This tab cannot be checked";
      show("unsupported");
      return;
    }

    const page = await extractPage(tab.id);
    const [analysis, access] = await Promise.all([
      chrome.runtime.sendMessage({ type: "ANALYZE", page, bypassCache }),
      chrome.runtime.sendMessage({ type: "GET_ENABLED", domain: page.domain }),
    ]);

    if (!analysis?.ok || !access?.ok) throw new Error(analysis?.error || "Analysis failed");

    currentDomain = analysis.result.domain || access.domain;
    render(analysis.result, access.enabled);
    show("result");

    if (access.enabled) {
      chrome.tabs.sendMessage(tab.id, { type: "SHOW_RESULT", result: analysis.result }).catch(() => {});
    }
  } catch (_error) {
    domainNode.textContent = "Something went wrong";
    show("error");
  }
}

async function extractPage(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: "EXTRACT" });
    if (response?.ok && response.page) return response.page;
  } catch (_error) {
    /* The content script is not on this page yet. Inject it below. */
  }

  await chrome.scripting.executeScript({ target: { tabId }, files: ["extract.js"] });
  const [injected] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => globalThis.fndExtractPage(),
  });

  if (!injected?.result) throw new Error("Could not read this page");
  return injected.result;
}

function render(result, enabled) {
  domainNode.textContent = result.domain || "Unknown site";
  panels.result.className = result.status;
  scoreNode.textContent = result.score == null ? "—" : `${result.score}%`;
  statusNode.textContent = result.label;
  statusNode.className = `status ${result.status}`;
  summaryNode.textContent = result.summary;

  headlineNode.hidden = !result.headline;
  headlineNode.textContent = result.headline ? `“${result.headline}”` : "";

  fillList(flagsNode, result.flags?.length ? result.flags.map((flag) => flag.label) : ["No major risk flags."]);

  whyWrap.hidden = !result.factors?.length;
  factorsNode.replaceChildren();
  if (result.factors?.length) {
    const base = document.createElement("li");
    base.textContent = "Starts at 50";
    factorsNode.appendChild(base);
    result.factors.forEach((factor) => {
      const row = document.createElement("li");
      const impact = document.createElement("span");
      impact.className = factor.impact > 0 ? "up" : "down";
      impact.textContent = factor.impact > 0 ? `+${factor.impact}` : String(factor.impact);
      row.append(impact, document.createTextNode(` ${factor.label}`));
      factorsNode.appendChild(row);
    });
  }

  const links = (result.sources || []).filter((source) => isSafeSource(source.url));
  sourcesWrap.hidden = links.length === 0;
  sourcesNode.replaceChildren();
  links.forEach((source) => {
    const row = document.createElement("li");
    const anchor = document.createElement("a");
    anchor.href = source.url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.textContent = source.name;
    row.appendChild(anchor);
    sourcesNode.appendChild(row);
  });

  enabledNode.checked = enabled;
  enabledNode.disabled = false;
}

function fillList(list, labels) {
  list.replaceChildren();
  labels.forEach((label) => {
    const row = document.createElement("li");
    row.textContent = label;
    list.appendChild(row);
  });
}

function show(name) {
  Object.entries(panels).forEach(([key, panel]) => {
    panel.hidden = key !== name;
  });
}

function isSafeSource(url) {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      ["www.factcheck.org", "factcheck.org", "www.politifact.com", "politifact.com", "www.snopes.com", "snopes.com"].includes(
        parsed.hostname
      )
    );
  } catch (_error) {
    return false;
  }
}
