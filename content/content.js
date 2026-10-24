/**
 * MaiTab - Content Script
 * Captures left-clicks on web links and requests the background service worker
 * to open them in new tabs without interrupting the current page.
 * Strictly respects the Complete Bypass List (Silent List) with highest priority.
 */

(function () {
  'use strict';

  // Prevent multiple injections
  if (window.__MAITAB_INITIALIZED__) {
    return;
  }
  window.__MAITAB_INITIALIZED__ = true;

  let settings = {
    enabled: true,
    autoSwitch: false,
    whitelist: [],
    bypassList: [],
    openNextToCurrent: true
  };

  let listenersAttached = false;

  // Mouse drag tracking to avoid opening links during text selection / dragging
  let startX = 0;
  let startY = 0;
  let isMouseDown = false;
  let isDrag = false;

  /**
   * Checks whether the current website is in the Complete Bypass List.
   * On bypassed websites, MaiTab must be completely inactive.
   */
  function isCurrentSiteBypassed() {
    if (!settings.enabled) {
      return true;
    }

    const host = window.location.hostname;
    if (!host) {
      return false;
    }

    const matcher = window.DomainMatcher;
    if (matcher && typeof matcher.isDomainBypassed === 'function') {
      return matcher.isDomainBypassed(host, settings.bypassList);
    }

    // Fallback if DomainMatcher is not yet available
    if (Array.isArray(settings.bypassList)) {
      return settings.bypassList.some(item => {
        const d = (typeof item === 'string' ? item : item?.domain || '').trim().toLowerCase();
        return d && (host.toLowerCase() === d || host.toLowerCase().endsWith('.' + d));
      });
    }

    return false;
  }

  function onMouseDown(e) {
    if (e.button === 0) {
      startX = e.clientX;
      startY = e.clientY;
      isMouseDown = true;
      isDrag = false;
    }
  }

  function onMouseMove(e) {
    if (isMouseDown && !isDrag) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.hypot(dx, dy) > 6) {
        isDrag = true;
      }
    }
  }

  function onMouseUp() {
    isMouseDown = false;
  }

  /**
   * Captures left clicks in the capture phase before page scripts / SPA routers intervene.
   */
  function onClick(e) {
    // If the current site is in the Complete Bypass List or extension is disabled,
    // immediately detach listeners and leave the event completely untouched.
    if (isCurrentSiteBypassed()) {
      detachListeners();
      return;
    }

    // Check for active text selection
    let hasTextSelection = false;
    try {
      const selection = window.getSelection ? window.getSelection() : null;
      hasTextSelection = Boolean(selection && selection.toString().trim().length > 0);
    } catch {
      hasTextSelection = false;
    }

    const evaluator = window.LinkEvaluator;
    if (!evaluator) {
      return;
    }

    const evaluation = evaluator.shouldInterceptClick(e, {
      enabled: settings.enabled,
      currentLocation: window.location,
      isDrag,
      hasTextSelection,
      isBypassed: false,
      bypassList: settings.bypassList
    });

    // Reset drag flag for subsequent clicks
    isDrag = false;

    if (!evaluation.intercept || !evaluation.url) {
      return;
    }

    // Stop default browser navigation and page event handlers
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    // Dispatch command to background service worker to open the tab
    try {
      chrome.runtime.sendMessage({
        action: 'openTab',
        url: evaluation.url,
        currentHost: window.location.hostname
      });
    } catch (err) {
      console.warn('[MaiTab] Could not dispatch openTab message:', err);
    }
  }

  /**
   * Attaches interaction listeners to document.
   */
  function attachListeners() {
    if (listenersAttached) {
      return;
    }
    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('mouseup', onMouseUp, true);
    document.addEventListener('click', onClick, true);
    listenersAttached = true;
  }

  /**
   * Detaches interaction listeners from document to ensure zero interference on bypassed sites.
   */
  function detachListeners() {
    if (!listenersAttached) {
      return;
    }
    document.removeEventListener('mousedown', onMouseDown, true);
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('mouseup', onMouseUp, true);
    document.removeEventListener('click', onClick, true);
    listenersAttached = false;
  }

  /**
   * Evaluates current site state and manages listener lifecycle.
   */
  function updateListenerState() {
    if (!settings.enabled || isCurrentSiteBypassed()) {
      detachListeners();
    } else {
      attachListeners();
    }
  }

  /**
   * Refreshes in-memory settings from the background service worker or storage.
   */
  function syncSettings() {
    if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
      try {
        chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
          if (chrome.runtime.lastError) {
            return;
          }
          if (response && response.success && response.settings) {
            settings = response.settings;
            updateListenerState();
          }
        });
      } catch {
        // Extension context might be invalidating during update
      }
    }
  }

  // Fast direct read from storage before message roundtrip
  if (typeof chrome !== 'undefined' && chrome.storage) {
    const storageArea = chrome.storage.sync || chrome.storage.local;
    if (storageArea) {
      storageArea.get(['enabled', 'autoSwitch', 'whitelist', 'bypassList', 'openNextToCurrent'], (items) => {
        if (!chrome.runtime.lastError && items) {
          if (items.enabled !== undefined) settings.enabled = items.enabled;
          if (items.autoSwitch !== undefined) settings.autoSwitch = items.autoSwitch;
          if (items.whitelist) settings.whitelist = items.whitelist;
          if (items.bypassList) settings.bypassList = items.bypassList;
          if (items.openNextToCurrent !== undefined) settings.openNextToCurrent = items.openNextToCurrent;
          updateListenerState();
        }
      });
    }
  }

  // Initial sync with background
  syncSettings();

  // React immediately to settings changes without requiring page reload
  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'sync' || areaName === 'local') {
        syncSettings();
      }
    });
  }
})();
