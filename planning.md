# NewsFacts Chrome Extension — Next Steps Checklist

## 1. Core functionality hardening
- [ ] Verify the extension works reliably on a range of news sites, not just a few test pages
- [ ] Confirm the badge appears only on actual article pages and not on homepages, search results, or social media pages
- [ ] Improve extraction logic for pages that do not use standard Open Graph or article metadata
- [ ] Add fallback headline/summary extraction for sites with unusual DOM structures

## 2. Scoring and credibility logic
- [ ] Expand the domain trust list beyond the current starter set
- [ ] Add more signal types such as author reputation, publication history, and content style analysis
- [ ] Tune scoring thresholds to reduce false positives and false negatives
- [ ] Add a clearer explanation for why a score was assigned
- [ ] Separate article-level risk signals from domain-level trust signals more explicitly

## 3. UX and interface improvements
- [ ] Refine the popup layout so it is clearer and more readable on smaller screens
- [ ] Improve the inline credibility badge design for visibility without being intrusive
- [ ] Add support for collapsed/expanded details with better visual hierarchy
- [ ] Add a lightweight “learn more” or “why this result?” explanation flow
- [ ] Ensure the Hide on this site feature is easy to understand and discover

## 4. Data quality and reliability
- [ ] Add test cases for core article extraction scenarios
- [ ] Add test cases for domain classification and risk scoring logic
- [ ] Validate behavior when a page is blocked, unavailable, or rendered in a non-standard way
- [ ] Handle empty or malformed metadata safely without crashing the extension
- [ ] Audit caching logic to avoid stale results across page updates and site changes

## 5. Privacy and security review
- [ ] Confirm the extension does not collect or transmit page data beyond the local browser session
- [ ] Review permissions to ensure only required APIs are requested
- [ ] Validate that content scripts do only minimal reads and no unsafe operations
- [ ] Check for potential issues around URL stripping, storage, and message handling

## 6. Launch readiness
- [ ] Add clear extension descriptions and user-facing copy that explain the tool is heuristic and educational
- [ ] Review legal/ethical wording so the tool is not presented as definitive fact-checking
- [ ] Prepare a simple setup guide for local testing and debugging
- [ ] Gather sample screenshots and examples for documentation and demos
- [ ] Decide whether to support additional browser targets beyond Chrome

## 7. Optional future enhancements
- [ ] Add real source verification from trusted fact-checking organizations
- [ ] Integrate a larger knowledge base or external API when appropriate
- [ ] Support a “compare article to source” workflow
- [ ] Add per-site user controls for more granular trust settings
- [ ] Explore a browser-action or side-panel experience for richer article analysis

## Suggested short-term milestone
- [ ] Validate the current extension manually on 10–20 representative news sites
- [ ] Fix the top extraction/scoring issues discovered during testing
- [ ] Improve visual clarity and confidence in badge behavior
- [ ] Add automated tests for the scoring engine and extract logic
- [ ] Prepare a beta release candidate with documented limitations
