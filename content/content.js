/**
 * MaiTab - Content Script
 * Captures left-clicks on web links and requests the background service worker
 * to open them in new tabs without interrupting the current page.
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
    openNextToCurrent: true
  };

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
          }
        });
      } catch {
        // Extension context might be invalidating during update
      }
    }
  }

  // Initial sync
  syncSettings();

  // React immediately to settings changes without requiring page reload
  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'sync' || areaName === 'local') {
        syncSettings();
      }
    });
  }

  // Mouse drag tracking to avoid opening links during text selection / dragging
  let startX = 0;
  let startY = 0;
  let isMouseDown = false;
  let isDrag = false;

  document.addEventListener(
    'mousedown',
    (e) => {
      if (e.button === 0) {
        startX = e.clientX;
        startY = e.clientY;
        isMouseDown = true;
        isDrag = false;
      }
    },
    true
  );

  document.addEventListener(
    'mousemove',
    (e) => {
      if (isMouseDown && !isDrag) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (Math.hypot(dx, dy) > 6) {
          isDrag = true;
        }
      }
    },
    true
  );

  document.addEventListener(
    'mouseup',
    () => {
      isMouseDown = false;
    },
    true
  );

  /**
   * Captures left clicks in the capture phase before page scripts / SPA routers intervene.
   */
  document.addEventListener(
    'click',
    (e) => {
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
        hasTextSelection
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
    },
    true
  );
})();
