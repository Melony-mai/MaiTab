/**
 * MaiTab - Domain Matching Utilities
 * Handles normalization, validation, and domain-based matching for whitelist entries.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DomainMatcher = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /**
   * Normalizes a domain or URL string into a clean hostname.
   * Strips protocols, wildcards, ports, paths, query parameters, and hashes.
   *
   * @param {string} input - User input or URL string
   * @returns {string} Normalized domain/hostname, or empty string if invalid
   */
  function normalizeDomain(input) {
    if (!input || typeof input !== 'string') {
      return '';
    }

    let raw = input.trim().toLowerCase();

    // Remove leading wildcard prefix if present (e.g., "*.example.com" -> "example.com")
    if (raw.startsWith('*.')) {
      raw = raw.slice(2);
    } else if (raw.startsWith('.')) {
      raw = raw.slice(1);
    }

    // Attempt URL parsing to strip protocol, path, port, query, and hash
    let hostname = '';
    try {
      const urlCandidate = raw.includes('://') ? raw : `http://${raw}`;
      const parsed = new URL(urlCandidate);
      hostname = parsed.hostname;
    } catch {
      // Manual fallback if URL constructor fails
      hostname = raw.split('/')[0].split('?')[0].split('#')[0].split(':')[0];
    }

    // Remove trailing dot if present (FQDN)
    if (hostname.endsWith('.')) {
      hostname = hostname.slice(0, -1);
    }

    return hostname;
  }

  /**
   * Validates whether a normalized domain string is structurally valid.
   * Supports standard domain names, subdomains, IPv4, and localhost.
   *
   * @param {string} domain - Domain string to validate
   * @returns {boolean} True if domain is valid
   */
  function isValidDomain(domain) {
    if (!domain || typeof domain !== 'string') {
      return false;
    }

    const normalized = normalizeDomain(domain);
    if (!normalized || normalized.length > 253) {
      return false;
    }

    // Special cases
    if (normalized === 'localhost') {
      return true;
    }

    // IPv4 check: e.g., 127.0.0.1
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipv4Regex.test(normalized)) {
      const parts = normalized.split('.').map(Number);
      return parts.every(part => part >= 0 && part <= 255);
    }

    // Domain name rules (RFC 1035):
    // Must contain at least one dot (e.g. "example.com") unless localhost
    if (!normalized.includes('.')) {
      return false;
    }

    // Must not have consecutive dots or start/end with dot
    if (normalized.startsWith('.') || normalized.endsWith('.') || normalized.includes('..')) {
      return false;
    }

    const labels = normalized.split('.');
    // Standard domain label regex: letters, digits, hyphens (cannot start or end with hyphen)
    const labelRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

    return labels.every(label => {
      return label.length >= 1 && label.length <= 63 && labelRegex.test(label);
    });
  }

  /**
   * Tests if a current page hostname matches a whitelist rule.
   *
   * Matching rules:
   * 1. Exact match: "example.com" matches "example.com"
   * 2. Subdomain match: "example.com" matches "sub.example.com", "deep.sub.example.com"
   * 3. Avoids unintended matches: "example.com" DOES NOT match "myexample.com" or "evil-example.com"
   *
   * @param {string} currentHost - Current webpage hostname (e.g. "github.com", "gist.github.com")
   * @param {string} ruleDomain - Normalized domain from whitelist
   * @returns {boolean}
   */
  function isDomainMatch(currentHost, ruleDomain) {
    const host = normalizeDomain(currentHost);
    const rule = normalizeDomain(ruleDomain);

    if (!host || !rule) {
      return false;
    }

    // Exact match
    if (host === rule) {
      return true;
    }

    // Subdomain match: currentHost must end with `.${rule}`
    // e.g. "docs.google.com".endsWith(".google.com") is true
    // "evilgoogle.com".endsWith(".google.com") is false
    return host.endsWith('.' + rule);
  }

  /**
   * Helper to extract the domain string from a whitelist entry (either string or object).
   *
   * @param {string|{domain: string}} rule
   * @returns {string}
   */
  function getRuleDomain(rule) {
    if (!rule) return '';
    if (typeof rule === 'string') return rule;
    if (typeof rule === 'object' && typeof rule.domain === 'string') return rule.domain;
    return '';
  }

  /**
   * Checks if currentHost matches any entry in the whitelist array.
   * Supports both legacy string arrays and modern object arrays ({ domain, autoFocus }).
   *
   * @param {string} currentHost - Current webpage hostname
   * @param {Array<string|{domain: string, autoFocus?: boolean}>} whitelist - Array of whitelisted domain entries
   * @returns {boolean}
   */
  function isDomainWhitelisted(currentHost, whitelist) {
    if (!Array.isArray(whitelist) || whitelist.length === 0) {
      return false;
    }

    const host = normalizeDomain(currentHost);
    if (!host) {
      return false;
    }

    return whitelist.some(rule => {
      const ruleDomain = getRuleDomain(rule);
      return isDomainMatch(host, ruleDomain);
    });
  }

  /**
   * Finds the specific matching whitelist rule for the given hostname.
   * Returns a normalized rule object with domain and autoFocus status, or null if no match.
   *
   * @param {string} currentHost - Current webpage hostname
   * @param {Array<string|{domain: string, autoFocus?: boolean}>} whitelist
   * @returns {{ domain: string, autoFocus: boolean } | null}
   */
  function getMatchedRule(currentHost, whitelist) {
    if (!Array.isArray(whitelist) || whitelist.length === 0) {
      return null;
    }

    const host = normalizeDomain(currentHost);
    if (!host) {
      return null;
    }

    for (const rule of whitelist) {
      const ruleDomain = getRuleDomain(rule);
      if (isDomainMatch(host, ruleDomain)) {
        const autoFocus = typeof rule === 'object' && rule !== null && 'autoFocus' in rule
          ? Boolean(rule.autoFocus)
          : true; // Default autoFocus is true for legacy string or unspecified entries
        return {
          domain: ruleDomain,
          autoFocus
        };
      }
    }

    return null;
  }

  /**
   * Evaluates whether a newly opened tab should receive focus (active: true) or remain in background (active: false).
   *
   * Decision Precedence:
   * 1. Extension Master Toggle (`enabled`):
   *    If disabled (false), returns false (link interception not handled).
   * 2. Per-Website Whitelist Setting:
   *    If currentHostname matches a whitelist entry, that website's individual focus setting
   *    takes precedence, working independently of the global focus toggle:
   *    - When enabled (autoFocus: true), returns true (immediately focuses the new tab).
   *    - When disabled (autoFocus: false), returns false (opens in background, keeping current tab active).
   * 3. Global Focus Toggle (`autoSwitch`):
   *    If the website is NOT in the whitelist, the global focus toggle controls the behavior:
   *    - When enabled (true), returns true (focuses the new tab).
   *    - When disabled (false), returns false (opens in background).
   *
   * @param {Object} params
   * @param {boolean} [params.enabled=true] - Master extension toggle
   * @param {boolean} [params.autoSwitch=false] - Global focus toggle (switch to new tab)
   * @param {Array<string|{domain: string, autoFocus?: boolean}>} [params.whitelist=[]] - Whitelisted domain entries
   * @param {string} [params.currentHostname=''] - Hostname of the current page where click occurred
   * @returns {boolean} True if tab should be active/focused, false if tab should remain in background
   */
  function shouldSwitchTab(params = {}) {
    const {
      enabled = true,
      autoSwitch = false,
      whitelist = [],
      currentHostname = ''
    } = params;

    // If extension is disabled, fallback
    if (!enabled) {
      return false;
    }

    // Check if the current website matches any entry in the whitelist
    const matchedRule = getMatchedRule(currentHostname, whitelist);
    if (matchedRule) {
      // Individual per-website focus setting overrides the global focus toggle
      return Boolean(matchedRule.autoFocus);
    }

    // Fallback to global focus toggle
    return Boolean(autoSwitch);
  }

  return {
    normalizeDomain,
    isValidDomain,
    isDomainMatch,
    isDomainWhitelisted,
    getMatchedRule,
    shouldSwitchTab
  };
});
