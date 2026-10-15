/**
 * Pulls the few page signals the analyzer needs.
 * Runs in the extension's isolated world, not as a page script.
 */
(function initExtract(root) {
  "use strict";

  function meta(selector) {
    return document.querySelector(selector)?.getAttribute("content")?.trim() || "";
  }

  function clean(value, max) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max);
  }

  function looksLikeArticle() {
    const ogType = meta('meta[property="og:type"]').toLowerCase();
    if (ogType.includes("article")) return true;
    if (meta('meta[property="article:published_time"]')) return true;
    if (document.querySelector('article h1, [itemtype*="NewsArticle" i], [itemtype*="Article" i]')) {
      return true;
    }

    const blocks = document.querySelectorAll('script[type="application/ld+json"]');
    for (const block of blocks) {
      const text = block.textContent || "";
      if (/NewsArticle|ReportageNewsArticle|"@type"\s*:\s*"Article"/i.test(text)) return true;
    }
    return false;
  }

  function fndExtractPage() {
    const headline =
      meta('meta[property="og:title"]') ||
      meta('meta[name="twitter:title"]') ||
      document.querySelector("article h1, h1")?.innerText ||
      document.title ||
      "";

    const author =
      meta('meta[name="author"]') ||
      meta('meta[property="article:author"]') ||
      document.querySelector('[rel="author"], [itemprop="author"]')?.innerText ||
      "";

    return {
      url: location.href,
      domain: location.hostname,
      headline: clean(headline, 300),
      description: clean(
        meta('meta[name="description"]') || meta('meta[property="og:description"]'),
        500
      ),
      author: clean(author, 120),
      published: clean(
        meta('meta[property="article:published_time"]') ||
          document.querySelector("time[datetime]")?.getAttribute("datetime") ||
          "",
        80
      ),
      isHttps: location.protocol === "https:",
      looksLikeArticle: looksLikeArticle(),
    };
  }

  root.fndExtractPage = fndExtractPage;
})(typeof globalThis !== "undefined" ? globalThis : this);
