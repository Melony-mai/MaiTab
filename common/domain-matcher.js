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
   * Checks if currentHost matches any entry in the whitelist array.
   *
   * @param {string} currentHost - Current webpage hostname
   * @param {string[]} whitelist - Array of whitelisted domain strings
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

    return whitelist.some(rule => isDomainMatch(host, rule));
  }

  /**
   * Evaluates whether a newly opened tab should be focused (active: true) or kept in background (active: false).
   *
   * Core logic:
   * - If global toggle `autoSwitch` is enabled (true), links switch to foreground tab for ALL websites.
   * - If global toggle `autoSwitch` is disabled (false), links clicked on whitelisted websites still switch to foreground,
   *   while links on non-whitelisted websites open in the background.
   *
   * @param {Object} params
   * @param {boolean} [params.enabled=true] - Master extension toggle
   * @param {boolean} [params.autoSwitch=false] - Global tab switching toggle
   * @param {string[]} [params.whitelist=[]] - Whitelisted domains array
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

    // If extension is disabled, fallback (though content script wouldn't trigger)
    if (!enabled) {
      return false;
    }

    // Global toggle enabled: all sites automatically switch focus to new tab
    if (autoSwitch === true) {
      return true;
    }

    // Global toggle disabled: whitelist acts as an override
    return isDomainWhitelisted(currentHostname, whitelist);
  }

  return {
    normalizeDomain,
    isValidDomain,
    isDomainMatch,
    isDomainWhitelisted,
    shouldSwitchTab
  };
});
