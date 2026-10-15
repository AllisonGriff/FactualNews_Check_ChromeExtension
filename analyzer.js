/**
 * Rule-based credibility estimate.
 * This is an educational heuristic, not a professional fact-check.
 * Lists are a small starter set so the extension works offline.
 */
(function initAnalyzer(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.FNDAnalyzer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createAnalyzer() {
  "use strict";

  const TIER1 = [
    "reuters.com",
    "apnews.com",
    "ap.org",
    "afp.com",
    "bbc.com",
    "bbc.co.uk",
    "npr.org",
    "pbs.org",
    "c-span.org",
    "factcheck.org",
    "politifact.com",
    "snopes.com",
    "fullfact.org",
    "leadstories.com",
    "who.int",
    "cdc.gov",
    "nih.gov",
    "nasa.gov",
    "nature.com",
    "science.org",
    "nejm.org",
    "thelancet.com",
  ];

  const TIER2 = [
    "nytimes.com",
    "washingtonpost.com",
    "wsj.com",
    "theguardian.com",
    "economist.com",
    "bloomberg.com",
    "ft.com",
    "axios.com",
    "csmonitor.com",
    "propublica.org",
    "theatlantic.com",
    "newyorker.com",
    "time.com",
    "usatoday.com",
    "latimes.com",
    "chicagotribune.com",
    "bostonglobe.com",
    "texastribune.org",
    "cnn.com",
    "foxnews.com",
    "msnbc.com",
    "abcnews.go.com",
    "cbsnews.com",
    "nbcnews.com",
    "aljazeera.com",
    "dw.com",
    "france24.com",
    "politico.com",
    "thehill.com",
    "scientificamerican.com",
    "newscientist.com",
    "vox.com",
    "huffpost.com",
    "usnews.com",
    "theglobeandmail.com",
    "cbc.ca",
    "abc.net.au",
    "nhk.or.jp",
  ];

  const TIER3 = [
    "nypost.com",
    "dailymail.co.uk",
    "thesun.co.uk",
    "the-sun.com",
    "newsweek.com",
    "nydailynews.com",
    "buzzfeed.com",
  ];

  const LOW = [
    "infowars.com",
    "naturalnews.com",
    "beforeitsnews.com",
    "worldnewsdailyreport.com",
    "empirenews.net",
    "nationalreport.net",
    "huzlers.com",
    "dailybuzzlive.com",
    "react365.com",
    "now8news.com",
    "thebostontribune.com",
    "newspunch.com",
    "yournewswire.com",
    "prntly.com",
    "neonnettle.com",
    "awarenessact.com",
    "walkingonion.com",
  ];

  const SATIRE = [
    "theonion.com",
    "babylonbee.com",
    "clickhole.com",
    "reductress.com",
    "thebeaverton.com",
    "waterfordwhispersnews.com",
    "thedailymash.co.uk",
    "newsthump.com",
    "thehardtimes.net",
  ];

  const PLATFORM = [
    "google.com",
    "bing.com",
    "duckduckgo.com",
    "yahoo.com",
    "facebook.com",
    "instagram.com",
    "twitter.com",
    "x.com",
    "youtube.com",
    "tiktok.com",
    "reddit.com",
    "linkedin.com",
    "pinterest.com",
    "snapchat.com",
    "whatsapp.com",
    "threads.net",
  ];

  const WIKI = ["wikipedia.org", "wikimedia.org"];

  const DOMAIN_IMPACT = {
    tier1: ["Wire service, public broadcaster, or fact-checker", 30],
    tier2: ["Well-known news organization", 24],
    tier3: ["Publisher known for sensational headlines", 8],
    gov: ["Official government domain", 26],
    edu: ["School or university domain", 6],
    wiki: ["Reference encyclopedia", 16],
    low: ["Domain linked to misleading stories", -32],
    satire: ["Satire or humor site", -28],
  };

  const SENSATION_PATTERNS = [
    [/you won'?t believe/i, 14],
    [/what happened next/i, 12],
    [/doctors hate/i, 14],
    [/one weird trick/i, 14],
    [/they don'?t want you to know/i, 14],
    [/mainstream media (?:won'?t|is lying|is hiding)/i, 12],
    [/miracle cure/i, 12],
    [/wake up(?: sheeple| america| people)/i, 10],
    [/100%\s+(?:proven|guaranteed|real|true)/i, 10],
    [/bombshell/i, 8],
    [/shock(?:ing|ed|ingly)\b/i, 8],
    [/cover[- ]?up/i, 6],
    [/^\s*\d+\s+(?:weird |shocking |simple |secret )?(?:reasons|ways|facts|things|secrets|signs)\b/i, 8],
  ];

  const sets = {
    tier1: new Set(TIER1),
    tier2: new Set(TIER2),
    tier3: new Set(TIER3),
    low: new Set(LOW),
    satire: new Set(SATIRE),
    platform: new Set(PLATFORM),
    wiki: new Set(WIKI),
  };

  function normalizeDomain(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "")
      .replace(/:\d+$/, "")
      .replace(/\.$/, "");
  }

  function matches(domain, set) {
    if (!domain) return false;
    if (set.has(domain)) return true;
    const parts = domain.split(".");
    for (let index = 1; index < parts.length - 1; index += 1) {
      if (set.has(parts.slice(index).join("."))) return true;
    }
    return false;
  }

  function isGovernment(domain) {
    return (
      domain.endsWith(".gov") ||
      domain.endsWith(".gov.uk") ||
      domain.endsWith(".gov.au") ||
      domain.endsWith(".gc.ca") ||
      domain.endsWith(".govt.nz")
    );
  }

  function isEducation(domain) {
    return domain.endsWith(".edu") || domain.endsWith(".ac.uk") || domain.endsWith(".edu.au");
  }

  function classify(domain) {
    if (matches(domain, sets.satire)) return "satire";
    if (matches(domain, sets.low)) return "low";
    if (matches(domain, sets.platform)) return "platform";
    if (matches(domain, sets.wiki)) return "wiki";
    if (matches(domain, sets.tier1)) return "tier1";
    if (matches(domain, sets.tier2)) return "tier2";
    if (matches(domain, sets.tier3)) return "tier3";
    if (isGovernment(domain)) return "gov";
    if (isEducation(domain)) return "edu";
    return "unknown";
  }

  function asText(value, max) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max);
  }

  function sensationalPenalty(headline) {
    if (!headline) return 0;
    let penalty = 0;
    SENSATION_PATTERNS.forEach(([pattern, weight]) => {
      if (pattern.test(headline)) penalty += weight;
    });
    const letters = headline.replace(/[^A-Za-z]/g, "");
    if (letters.length >= 16 && letters === letters.toUpperCase()) penalty += 10;
    const bangs = (headline.match(/!/g) || []).length;
    if (bangs >= 2) penalty += 8;
    return Math.min(30, penalty);
  }

  function statusFor(kind, score) {
    if (kind === "neutral") {
      return { status: "neutral", label: "No news article detected" };
    }
    if (kind === "satire") {
      return { status: "satire", label: "Satire source" };
    }
    if (kind === "low") {
      return { status: "risk", label: "High misinformation risk" };
    }
    if (kind === "platform") {
      return { status: "caution", label: "Not a news article" };
    }
    if (score >= 76) return { status: "high", label: "High confidence" };
    if (score >= 48) return { status: "caution", label: "Caution" };
    return { status: "risk", label: "High misinformation risk" };
  }

  function buildSummary(kind, sensational) {
    if (kind === "neutral") {
      return "This page does not look like a news story. Open an article to see a credibility score.";
    }
    if (kind === "satire") {
      return "This website publishes jokes and made-up stories for humor. It is not a news report. Do not share it as fact.";
    }
    if (kind === "platform") {
      return "This looks like a search, social, or video site, not a single news article. Open the original story to judge it.";
    }
    if (kind === "wiki") {
      return sensational
        ? "Wikipedia is an encyclopedia, not a news report. This headline uses sensational wording. Check the citations at the bottom of the page."
        : "Wikipedia is an encyclopedia, not a news report. Check the citations at the bottom of the page before you rely on it.";
    }
    if (kind === "low") {
      return sensational
        ? "This website is often tied to false or misleading stories, and the headline uses alarmist wording. Check a trusted newsroom before you share it."
        : "This website is often tied to false or misleading stories. Read the claims somewhere else before you trust or share them.";
    }
    if (kind === "tier1") {
      return sensational
        ? "This site has a strong record of checking facts, but the headline uses sensational wording. Read the full story, not just the headline."
        : "This is a wire service, public broadcaster, or fact-checker with a strong record of checking facts. The headline looks straightforward.";
    }
    if (kind === "tier2") {
      return sensational
        ? "This is a well-known news organization, but the headline uses sensational wording. Compare the claim with another source."
        : "This is a well-known news organization, and the headline does not show strong warning signs. Major claims are still worth comparing with a second source.";
    }
    if (kind === "tier3") {
      return "This site is a known publisher, but it often mixes reporting with sensational headlines. Double-check surprising claims before you share them.";
    }
    if (kind === "gov") {
      return sensational
        ? "This is an official government site, but the headline uses sensational wording. Read the full page, not just the title."
        : "This address belongs to a government site. It can be a useful official source. It is not a neutral fact-check of every claim.";
    }
    if (kind === "edu") {
      return "This address belongs to a school or university. Treat it as an institutional page, and look for the original study or article behind any big claim.";
    }
    if (sensational) {
      return "We do not have a track record for this website, and the headline uses sensational wording. Treat it as unverified until a trusted source confirms it.";
    }
    return "We do not have a track record for this website. That does not mean the story is false. Compare it with a trusted source before you share it.";
  }

  function sourceLinks(headline, domain) {
    const query = encodeURIComponent((headline || domain || "news").slice(0, 160));
    return [
      { name: "FactCheck.org", url: `https://www.factcheck.org/?s=${query}` },
      { name: "PolitiFact", url: `https://www.politifact.com/search/?q=${query}` },
      { name: "Snopes", url: `https://www.snopes.com/search/?q=${query}` },
    ];
  }

  function analyze(page) {
    const input = page || {};
    const domain = normalizeDomain(input.domain || input.url);
    const headline = asText(input.headline, 300);
    const author = asText(input.author, 120);
    const published = asText(input.published, 80);
    let kind = classify(domain);

    if ((kind === "unknown" || kind === "gov" || kind === "edu") && input.looksLikeArticle === false) {
      kind = "neutral";
    }

    if (kind === "neutral") {
      return {
        score: null,
        kind: "neutral",
        status: "neutral",
        label: "No news article detected",
        summary: buildSummary("neutral", false),
        flags: [],
        factors: [],
        sources: [],
        domain,
        headline,
        analyzedAt: new Date().toISOString(),
      };
    }

    const factors = [];
    const flags = [];
    let score = 50;

    function add(label, impact) {
      if (!impact) return;
      score += impact;
      factors.push({ label, impact });
    }

    const domainImpact = DOMAIN_IMPACT[kind];
    if (domainImpact) add(domainImpact[0], domainImpact[1]);

    if (kind === "unknown") {
      flags.push({ id: "unverified", label: "Unverified Domain History" });
    }
    if (kind === "satire") {
      flags.push({ id: "satire", label: "Satire Source" });
    }
    if (kind === "low") {
      flags.push({ id: "low-domain", label: "Domain linked to misleading stories" });
    }
    if (kind === "platform") {
      flags.push({ id: "not-article", label: "Not a news article" });
    }

    const skipWritingSignals = kind === "satire" || kind === "platform";
    let sensational = false;

    if (!skipWritingSignals) {
      const penalty = sensationalPenalty(headline);
      if (penalty) {
        add("Sensational headline wording", -penalty);
        sensational = penalty >= 8;
        if (sensational) {
          flags.push({ id: "sensational", label: "Sensationalist Headline Detected" });
        }
      }
      if (!headline) add("No headline found", -5);
      if (kind !== "low") {
        if (author.length >= 2) add("Author name found", 4);
        if (published.length >= 4) add("Publication date found", 3);
      }
      if (input.isHttps === false) {
        add("Page is not encrypted", -10);
        flags.push({ id: "insecure", label: "Insecure connection" });
      } else if (input.isHttps === true && kind !== "low") {
        add("Secure connection (https)", 2);
      }
    }

    score = Math.max(0, Math.min(100, Math.round(score)));
    const status = statusFor(kind, score);

    return {
      score,
      kind,
      status: status.status,
      label: status.label,
      summary: buildSummary(kind, sensational),
      flags,
      factors,
      sources: sourceLinks(headline, domain),
      domain,
      headline,
      analyzedAt: new Date().toISOString(),
    };
  }

  return { analyze, normalizeDomain };
});
