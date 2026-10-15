/**
 * Injects the floating credibility badge into the current page.
 */
"use strict";

if (!globalThis.__FND_STARTED) {
  globalThis.__FND_STARTED = true;
  init().catch((error) => {
    console.warn("[Fake News Detector]", error);
  });
}

async function init() {
  const host = createHost();
  let shadow = null;
  let expanded = false;
  const cssText = await loadCss();
  let lastResult = null;
  let lastUrl = "";
  let settledKey = "";
  let settledEnabled = true;
  let domain = "";
  let enabled = true;
  let runId = 0;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "EXTRACT") {
      sendResponse({ ok: true, page: globalThis.fndExtractPage() });
      return;
    }
    if (message?.type === "GET_STATE") {
      sendResponse({ ok: true, domain, enabled, result: lastResult });
      return;
    }
    if (message?.type === "SHOW_RESULT" && message.result) {
      if (enabled && shouldShow(message.result)) {
        lastResult = message.result;
        domain = message.result.domain || domain;
        paint();
      } else {
        host.remove();
      }
      sendResponse({ ok: true });
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.disabledDomains || !domain) return;
    const disabled = new Set(changes.disabledDomains.newValue || []);
    const nextEnabled = !disabled.has(domain);
    if (nextEnabled === enabled) return;
    enabled = nextEnabled;
    if (!enabled) {
      settledEnabled = false;
      runId += 1;
      host.remove();
      return;
    }
    run();
  });

  watchNavigation(() => run());
  await run();

  async function run() {
    const id = ++runId;
    try {
      const page = globalThis.fndExtractPage();
      const key = `${page.url}|${page.headline}`;
      if (key === settledKey && enabled === settledEnabled) return;
      if (page.url !== lastUrl) expanded = false;
      lastUrl = page.url;

      const access = await chrome.runtime.sendMessage({ type: "GET_ENABLED", domain: page.domain });
      if (id !== runId || !access?.ok) return;

      domain = access.domain;
      enabled = access.enabled;
      if (!enabled) {
        host.remove();
        settledKey = key;
        settledEnabled = false;
        return;
      }

      const response = await chrome.runtime.sendMessage({ type: "ANALYZE", page });
      if (id !== runId || !response?.ok) return;

      lastResult = response.result;
      settledKey = key;
      settledEnabled = true;
      if (!shouldShow(lastResult)) {
        host.remove();
        return;
      }
      paint();
    } catch (error) {
      console.warn("[Fake News Detector]", error);
    }
  }

  function paint() {
    if (!lastResult || !enabled) return;
    if (!host.isConnected) document.documentElement.appendChild(host);
    if (!shadow) {
      shadow = host.attachShadow({ mode: "open" });
      const style = document.createElement("style");
      style.textContent = cssText;
      shadow.appendChild(style);
    }

    const wrap = shadow.querySelector(".fnd-wrap") || document.createElement("div");
    wrap.className = "fnd-wrap";
    wrap.replaceChildren();
    const handlers = {
      onToggle: () => {
        expanded = !expanded;
        paint();
      },
      onHide: async () => {
        enabled = false;
        settledEnabled = false;
        runId += 1;
        host.remove();
        await chrome.runtime.sendMessage({ type: "SET_ENABLED", domain, enabled: false });
      },
    };
    wrap.appendChild(expanded ? buildExpanded(lastResult, handlers) : buildPill(lastResult, handlers.onToggle));
    if (!wrap.isConnected) shadow.appendChild(wrap);
  }
}

function createHost() {
  const host = document.createElement("div");
  host.id = "fake-news-detector-root";
  host.setAttribute("role", "complementary");
  host.setAttribute("aria-label", "Fake News Detector credibility score");
  [
    ["position", "fixed"],
    ["bottom", "16px"],
    ["right", "16px"],
    ["z-index", "2147483647"],
    ["margin", "0"],
    ["padding", "0"],
    ["border", "none"],
    ["background", "transparent"],
    ["display", "block"],
    ["width", "max-content"],
    ["max-width", "calc(100vw - 32px)"],
    ["color-scheme", "light"],
  ].forEach(([property, value]) => host.style.setProperty(property, value, "important"));

  host.addEventListener("mousedown", (event) => event.stopPropagation());
  host.addEventListener("click", (event) => event.stopPropagation());
  return host;
}

function watchNavigation(onChange) {
  let token = "";
  window.setInterval(() => {
    const page = globalThis.fndExtractPage();
    const next = `${page.url}|${page.headline}|${page.looksLikeArticle}`;
    if (next === token) return;
    token = next;
    onChange();
  }, 1500);
}

function buildPill(result, onToggle) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `fnd-pill fnd-${result.status}`;
  button.setAttribute("aria-expanded", "false");
  button.append(dot(result.status), textSpan("fnd-pill-label", pillLabel(result)));
  button.addEventListener("click", onToggle);
  return button;
}

function buildExpanded(result, handlers) {
  const card = document.createElement("section");
  card.className = `fnd-card fnd-${result.status}`;
  card.setAttribute("aria-label", "Credibility details");

  const header = document.createElement("div");
  header.className = "fnd-header";
  const title = document.createElement("div");
  title.className = "fnd-title";
  title.textContent = "Fake News Detector";
  const shrink = document.createElement("button");
  shrink.type = "button";
  shrink.className = "fnd-text-btn";
  shrink.textContent = "Shrink";
  shrink.addEventListener("click", handlers.onToggle);
  header.append(title, shrink);

  const scoreRow = document.createElement("div");
  scoreRow.className = "fnd-score-row";
  if (result.score == null) {
    scoreRow.appendChild(textSpan("fnd-neutral-label", result.label));
  } else {
    scoreRow.append(
      textSpan("fnd-score", `${result.score}%`),
      badge(result)
    );
  }

  const domain = textSpan("fnd-domain", result.domain || "");
  const summary = document.createElement("p");
  summary.className = "fnd-summary";
  summary.textContent = result.summary;

  card.append(header, scoreRow, domain, summary);
  if (result.headline) card.appendChild(quoted("fnd-headline", result.headline));
  card.appendChild(flagBlock(result.flags));
  if (result.factors?.length) card.appendChild(factorBlock(result.factors));
  if (result.sources?.length) card.appendChild(sourceBlock(result.sources));

  const hide = document.createElement("button");
  hide.type = "button";
  hide.className = "fnd-text-btn fnd-hide";
  hide.textContent = "Hide on this site";
  hide.addEventListener("click", handlers.onHide);

  const note = document.createElement("p");
  note.className = "fnd-note";
  note.textContent = "Automated estimate from the site and the headline. Not a fact-check.";

  card.append(hide, note);
  card.addEventListener("keydown", (event) => {
    if (event.key === "Escape") handlers.onToggle();
  });
  return card;
}

function flagBlock(flags) {
  const block = document.createElement("div");
  block.appendChild(heading("Risk flags"));
  const list = document.createElement("ul");
  list.className = "fnd-list";
  if (!flags?.length) {
    list.appendChild(item("No major risk flags."));
  } else {
    flags.forEach((flag) => list.appendChild(item(flag.label)));
  }
  block.appendChild(list);
  return block;
}

function factorBlock(factors) {
  const block = document.createElement("div");
  block.appendChild(heading("Why this score"));
  const list = document.createElement("ul");
  list.className = "fnd-list";
  const base = document.createElement("li");
  base.textContent = "Starts at 50";
  list.appendChild(base);
  factors.forEach((factor) => {
    const row = document.createElement("li");
    const impact = document.createElement("span");
    impact.className = factor.impact > 0 ? "fnd-up" : "fnd-down";
    impact.textContent = formatImpact(factor.impact);
    row.append(impact, document.createTextNode(` ${factor.label}`));
    list.appendChild(row);
  });
  block.appendChild(list);
  return block;
}

function sourceBlock(sources) {
  const block = document.createElement("div");
  block.appendChild(heading("Check the story"));
  const list = document.createElement("ul");
  list.className = "fnd-links";
  sources.forEach((source) => {
    if (!isSafeSource(source.url)) return;
    const row = document.createElement("li");
    const link = document.createElement("a");
    link.href = source.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = source.name;
    row.appendChild(link);
    list.appendChild(row);
  });
  block.appendChild(list);
  return block;
}

function shouldShow(result) {
  return Boolean(result) && result.kind !== "neutral" && result.kind !== "platform";
}

function pillLabel(result) {
  if (result.score == null || result.kind === "platform") return result.label;
  if (result.kind === "satire") return `Satire · ${result.score}%`;
  return `${result.score}% Credibility`;
}

function badge(result) {
  const node = document.createElement("span");
  node.className = `fnd-badge fnd-${result.status}`;
  node.append(dot(result.status), document.createTextNode(result.label));
  return node;
}

function dot(status) {
  const node = document.createElement("span");
  node.className = `fnd-dot fnd-${status}`;
  node.setAttribute("aria-hidden", "true");
  return node;
}

function heading(label) {
  const node = document.createElement("h2");
  node.textContent = label;
  return node;
}

function item(label) {
  const node = document.createElement("li");
  node.textContent = label;
  return node;
}

function textSpan(className, value) {
  const node = document.createElement("span");
  node.className = className;
  node.textContent = value;
  return node;
}

function quoted(className, value) {
  const node = document.createElement("p");
  node.className = className;
  node.textContent = `“${value}”`;
  return node;
}

function formatImpact(impact) {
  return impact > 0 ? `+${impact}` : String(impact);
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

async function loadCss() {
  try {
    const response = await fetch(chrome.runtime.getURL("content.css"));
    if (!response.ok) throw new Error("CSS request failed");
    return await response.text();
  } catch (_error) {
    return fallbackCss();
  }
}

function fallbackCss() {
  return `
    .fnd-pill, .fnd-card { font: 16px/1.4 Segoe UI, Arial, sans-serif; background: #fff; color: #14202b; border: 2px solid #64748b; border-radius: 16px; }
    .fnd-pill { min-height: 48px; padding: 10px 14px; }
    .fnd-card { width: min(340px, calc(100vw - 32px)); padding: 14px; }
    a { color: #0b4f6c; }
  `;
}
