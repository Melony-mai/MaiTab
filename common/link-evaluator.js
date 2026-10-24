/**
 * MaiTab - Link Evaluation Utilities
 * Inspects click events and anchor elements to determine whether a link
 * should be intercepted and opened in a new tab.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LinkEvaluator = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SUPPORTED_PROTOCOLS = new Set(['http:', 'https:', 'ftp:', 'file:']);
  const IGNORED_PROTOCOLS = new Set(['javascript:', 'mailto:', 'tel:', 'sms:', 'data:', 'blob:']);

  /**
   * Evaluates if an anchor/area element is an eligible navigation link.
   *
   * @param {HTMLAnchorElement|HTMLAreaElement} anchor
   * @param {Location|URL|string} currentLocation - Current page URL or window.location
   * @returns {{ eligible: boolean, url?: string, reason?: string }}
   */
  function isEligibleAnchor(anchor, currentLocation) {
    if (!anchor || typeof anchor !== 'object') {
      return { eligible: false, reason: 'no_anchor' };
    }

    const rawHref = anchor.getAttribute ? anchor.getAttribute('href') : anchor.href;
    if (!rawHref || typeof rawHref !== 'string') {
      return { eligible: false, reason: 'empty_href' };
    }

    const trimmedHref = rawHref.trim();
    if (!trimmedHref || trimmedHref === '#' || trimmedHref.startsWith('javascript:')) {
      return { eligible: false, reason: 'placeholder_or_javascript' };
    }

    // Elements with download attribute should trigger native download
    if (anchor.hasAttribute && anchor.hasAttribute('download')) {
      return { eligible: false, reason: 'download_attribute' };
    }

    // Resolve absolute URL
    let parsedUrl;
    let base;
    try {
      base = typeof currentLocation === 'string' ? currentLocation : (currentLocation?.href || 'https://example.com');
      parsedUrl = new URL(anchor.href || trimmedHref, base);
    } catch {
      return { eligible: false, reason: 'invalid_url' };
    }

    // Protocol check
    if (IGNORED_PROTOCOLS.has(parsedUrl.protocol)) {
      return { eligible: false, reason: 'ignored_protocol' };
    }

    if (!SUPPORTED_PROTOCOLS.has(parsedUrl.protocol)) {
      return { eligible: false, reason: 'unsupported_protocol' };
    }

    // In-page hash jump check: e.g. <a href="#heading"> or same document URL with #hash
    try {
      const currentParsed = new URL(base);
      const isSameDocument =
        parsedUrl.origin === currentParsed.origin &&
        parsedUrl.pathname === currentParsed.pathname &&
        parsedUrl.search === currentParsed.search;

      if (isSameDocument && parsedUrl.hash) {
        // Internal section jump within current page
        return { eligible: false, reason: 'same_page_hash' };
      }
    } catch {
      // If parsing fails, proceed
    }

    return {
      eligible: true,
      url: parsedUrl.href
    };
  }

  /**
   * Determines if a click event should be intercepted.
   *
   * @param {MouseEvent} event
   * @param {Object} options
   * @param {boolean} [options.enabled=true] - Master toggle
   * @param {Location|string} [options.currentLocation] - Current page location
   * @param {boolean} [options.isDrag=false] - True if user dragged mouse before click
   * @param {boolean} [options.hasTextSelection=false] - True if text is selected
   * @returns {{ intercept: boolean, url?: string, reason?: string }}
   */
  function shouldInterceptClick(event, options = {}) {
    const {
      enabled = true,
      currentLocation = typeof window !== 'undefined' ? window.location : 'https://example.com',
      isDrag = false,
      hasTextSelection = false
    } = options;

    if (!enabled) {
      return { intercept: false, reason: 'extension_disabled' };
    }

    if (!event) {
      return { intercept: false, reason: 'no_event' };
    }

    // Only left clicks (button === 0)
    if (typeof event.button === 'number' && event.button !== 0) {
      return { intercept: false, reason: 'not_left_click' };
    }

    // Ignore if user is holding modifier keys (preserve native browser shortcuts)
    if (event.ctrlKey || event.shiftKey || event.altKey || event.metaKey) {
      return { intercept: false, reason: 'modifier_key_pressed' };
    }

    // Ignore if mouse was dragged (e.g. selecting text)
    if (isDrag) {
      return { intercept: false, reason: 'drag_selection' };
    }

    // Ignore if user has active text selected
    if (hasTextSelection) {
      return { intercept: false, reason: 'active_text_selection' };
    }

    // Don't intercept clicks inside interactive form elements unless strictly an anchor
    const target = event.target;
    if (target && typeof target.closest === 'function') {
      const interactiveControl = target.closest('input, textarea, select, button');
      if (interactiveControl) {
        return { intercept: false, reason: 'interactive_form_control' };
      }

      // Check if target or parent is contenteditable
      if (target.isContentEditable || target.closest('[contenteditable="true"]')) {
        return { intercept: false, reason: 'contenteditable' };
      }
    }

    // Find the enclosing anchor element
    const anchor = target && typeof target.closest === 'function'
      ? target.closest('a[href], area[href]')
      : null;

    if (!anchor) {
      return { intercept: false, reason: 'no_anchor_found' };
    }

    const anchorEvaluation = isEligibleAnchor(anchor, currentLocation);
    if (!anchorEvaluation.eligible) {
      return { intercept: false, reason: anchorEvaluation.reason };
    }

    return {
      intercept: true,
      url: anchorEvaluation.url
    };
  }

  return {
    isEligibleAnchor,
    shouldInterceptClick
  };
});
