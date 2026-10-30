/**
 * MaiTab - Storage Management Utilities
 * Handles persistence, retrieval, and change notification for extension settings.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const DomainMatcher = require('./domain-matcher.js');
    module.exports = factory(DomainMatcher);
  } else {
    root.StorageManager = factory(root.DomainMatcher);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (DomainMatcher) {
  'use strict';

  const DEFAULT_SETTINGS = {
    enabled: true,             // Master toggle: enable/disable link interception
    autoSwitch: false,         // Global focus toggle: automatically switch focus to new tab
    whitelist: [],             // Whitelisted domains with per-entry focus options: [{ domain: string, autoFocus: boolean }]
    bypassList: [],            // Complete Bypass List (Silent List): [{ domain: string }]
    openNextToCurrent: true,   // Place new tab immediately adjacent to current tab
    language: 'auto',          // Language preference: 'auto', 'en', 'zh-CN', 'ja'
    theme: 'dark'              // Theme preference: 'dark' or 'light'
  };

  /**
   * Browser localStorage fallback when chrome.storage is unavailable (e.g. during standalone testing).
   */
  const webStorageFallback = (typeof localStorage !== 'undefined') ? {
    get: (defaults, callback) => {
      try {
        const raw = localStorage.getItem('maitab_settings');
        const parsed = raw ? JSON.parse(raw) : {};
        callback({ ...defaults, ...parsed });
      } catch (e) {
        callback({ ...defaults });
      }
    },
    set: (items, callback) => {
      try {
        const raw = localStorage.getItem('maitab_settings');
        const current = raw ? JSON.parse(raw) : {};
        localStorage.setItem('maitab_settings', JSON.stringify({ ...current, ...items }));
      } catch (e) {}
      if (typeof callback === 'function') callback();
    }
  } : null;

  /**
   * Resolves the appropriate Chrome storage area (sync with local fallback).
   */
  function getStorageArea() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      return chrome.storage.sync || chrome.storage.local;
    }
    return webStorageFallback;
  }

  /**
   * Retrieves all settings merged with default values.
   *
   * @param {Object} [customStorage] - Optional storage adapter for testing
   * @returns {Promise<typeof DEFAULT_SETTINGS>}
   */
  async function getSettings(customStorage) {
    const storage = customStorage || getStorageArea();

    if (!storage) {
      return { ...DEFAULT_SETTINGS };
    }

    return new Promise((resolve) => {
      storage.get(DEFAULT_SETTINGS, (items) => {
        if (typeof chrome !== 'undefined' && chrome.runtime?.lastError) {
          // If sync fails, try local fallback
          if (chrome.storage?.local && storage !== chrome.storage.local) {
            chrome.storage.local.get(DEFAULT_SETTINGS, (fallbackItems) => {
              resolve(normalizeSettings(fallbackItems));
            });
            return;
          }
        }
        resolve(normalizeSettings(items));
      });
    });
  }

  /**
   * Sanitizes and normalizes settings object.
   */
  function normalizeSettings(items) {
    const normalized = { ...DEFAULT_SETTINGS, ...(items || {}) };

    if (!Array.isArray(normalized.whitelist)) {
      normalized.whitelist = [];
    } else {
      // Normalize and deduplicate whitelist entries
      const map = new Map();
      normalized.whitelist.forEach(item => {
        let rawDomain = '';
        let autoFocus = true;

        if (typeof item === 'string') {
          rawDomain = item;
          autoFocus = true;
        } else if (item && typeof item === 'object') {
          rawDomain = item.domain || '';
          autoFocus = item.autoFocus !== false; // defaults to true
        }

        const norm = DomainMatcher ? DomainMatcher.normalizeDomain(rawDomain) : rawDomain.trim().toLowerCase();
        if (norm) {
          if (!map.has(norm)) {
            map.set(norm, {
              domain: norm,
              autoFocus: Boolean(autoFocus)
            });
          }
        }
      });
      normalized.whitelist = Array.from(map.values()).sort((a, b) =>
        a.domain.localeCompare(b.domain)
      );
    }

    if (!Array.isArray(normalized.bypassList)) {
      normalized.bypassList = [];
    } else {
      // Normalize and deduplicate bypassList entries
      const bypassMap = new Map();
      normalized.bypassList.forEach(item => {
        let rawDomain = '';
        if (typeof item === 'string') {
          rawDomain = item;
        } else if (item && typeof item === 'object') {
          rawDomain = item.domain || '';
        }

        const norm = DomainMatcher ? DomainMatcher.normalizeDomain(rawDomain) : rawDomain.trim().toLowerCase();
        if (norm) {
          if (!bypassMap.has(norm)) {
            bypassMap.set(norm, {
              domain: norm
            });
          }
        }
      });
      normalized.bypassList = Array.from(bypassMap.values()).sort((a, b) =>
        a.domain.localeCompare(b.domain)
      );
    }

    normalized.enabled = Boolean(normalized.enabled);
    normalized.autoSwitch = Boolean(normalized.autoSwitch);
    normalized.openNextToCurrent = Boolean(normalized.openNextToCurrent);
    if (typeof normalized.language !== 'string') {
      normalized.language = 'auto';
    }
    if (normalized.theme !== 'light' && normalized.theme !== 'dark') {
      normalized.theme = 'dark';
    }

    return normalized;
  }

  /**
   * Saves partial or complete settings to storage.
   *
   * @param {Partial<typeof DEFAULT_SETTINGS>} partialSettings
   * @param {Object} [customStorage] - Optional storage adapter for testing
   * @returns {Promise<typeof DEFAULT_SETTINGS>}
   */
  async function saveSettings(partialSettings, customStorage) {
    const storage = customStorage || getStorageArea();

    if (!storage) {
      return { ...DEFAULT_SETTINGS, ...partialSettings };
    }

    const current = await getSettings(storage);
    const updated = normalizeSettings({ ...current, ...partialSettings });

    return new Promise((resolve, reject) => {
      storage.set(updated, () => {
        if (typeof chrome !== 'undefined' && chrome.runtime?.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(updated);
        }
      });
    });
  }

  /**
   * Adds a domain to the whitelist with an optional per-website focus preference.
   * Normalizes the domain and validates it before persisting.
   *
   * @param {string} domainInput - Domain or URL to add
   * @param {boolean|Object} [autoFocusOrStorage=true] - Focus preference (default: true) or custom storage adapter
   * @param {Object} [maybeStorage] - Storage adapter if second param was focus boolean
   * @returns {Promise<{ success: boolean, domain?: string, autoFocus?: boolean, whitelist?: Array<{domain: string, autoFocus: boolean}>, error?: string }>}
   */
  async function addWhitelistDomain(domainInput, autoFocusOrStorage, maybeStorage) {
    if (!DomainMatcher) {
      return { success: false, error: 'DomainMatcher module is unavailable.' };
    }

    let autoFocus = true;
    let customStorage = null;

    if (typeof autoFocusOrStorage === 'boolean') {
      autoFocus = autoFocusOrStorage;
      customStorage = maybeStorage;
    } else if (autoFocusOrStorage && typeof autoFocusOrStorage === 'object') {
      if (typeof autoFocusOrStorage.get === 'function' || typeof autoFocusOrStorage.set === 'function') {
        customStorage = autoFocusOrStorage;
      } else {
        if ('autoFocus' in autoFocusOrStorage) {
          autoFocus = Boolean(autoFocusOrStorage.autoFocus);
        }
        customStorage = maybeStorage;
      }
    }

    const normalized = DomainMatcher.normalizeDomain(domainInput);
    if (!normalized || !DomainMatcher.isValidDomain(normalized)) {
      return {
        success: false,
        error: 'Invalid domain format. Enter a valid domain such as "example.com" or "sub.domain.org".'
      };
    }

    const settings = await getSettings(customStorage);
    const existing = settings.whitelist;

    const exists = existing.some(entry => {
      const d = typeof entry === 'string' ? entry : entry.domain;
      return d === normalized;
    });

    if (exists) {
      return {
        success: false,
        error: `"${normalized}" is already in your whitelist.`,
        domain: normalized,
        whitelist: existing
      };
    }

    const newEntry = {
      domain: normalized,
      autoFocus: Boolean(autoFocus)
    };

    const updatedWhitelist = [...existing, newEntry].sort((a, b) =>
      a.domain.localeCompare(b.domain)
    );
    await saveSettings({ whitelist: updatedWhitelist }, customStorage);

    return {
      success: true,
      domain: normalized,
      autoFocus: Boolean(autoFocus),
      whitelist: updatedWhitelist
    };
  }

  /**
   * Updates the individual focus setting for an existing whitelist entry.
   *
   * @param {string} domainInput - Domain to update
   * @param {boolean} autoFocus - Whether newly opened tabs for this domain receive focus
   * @param {Object} [customStorage]
   * @returns {Promise<{ success: boolean, domain?: string, autoFocus?: boolean, whitelist?: Array<{domain: string, autoFocus: boolean}>, error?: string }>}
   */
  async function updateWhitelistDomainFocus(domainInput, autoFocus, customStorage) {
    const normalized = DomainMatcher ? DomainMatcher.normalizeDomain(domainInput) : domainInput.trim().toLowerCase();
    const settings = await getSettings(customStorage);

    const index = settings.whitelist.findIndex(entry => {
      const d = typeof entry === 'string' ? entry : entry.domain;
      return d === normalized;
    });

    if (index === -1) {
      return {
        success: false,
        error: `"${normalized}" is not in your whitelist.`
      };
    }

    const updatedWhitelist = [...settings.whitelist];
    updatedWhitelist[index] = {
      domain: normalized,
      autoFocus: Boolean(autoFocus)
    };

    await saveSettings({ whitelist: updatedWhitelist }, customStorage);

    return {
      success: true,
      domain: normalized,
      autoFocus: Boolean(autoFocus),
      whitelist: updatedWhitelist
    };
  }

  /**
   * Removes a domain from the whitelist.
   *
   * @param {string} domainInput - Domain to remove
   * @param {Object} [customStorage]
   * @returns {Promise<{ success: boolean, whitelist: Array<{domain: string, autoFocus: boolean}> }>}
   */
  async function removeWhitelistDomain(domainInput, customStorage) {
    const normalized = DomainMatcher ? DomainMatcher.normalizeDomain(domainInput) : domainInput.trim().toLowerCase();
    const settings = await getSettings(customStorage);

    const updatedWhitelist = settings.whitelist.filter(entry => {
      const d = typeof entry === 'string' ? entry : entry.domain;
      return d !== normalized;
    });
    await saveSettings({ whitelist: updatedWhitelist }, customStorage);

    return {
      success: true,
      whitelist: updatedWhitelist
    };
  }

  /**
   * Clears all entries from the whitelist.
   */
  async function clearWhitelist(customStorage) {
    await saveSettings({ whitelist: [] }, customStorage);
    return { success: true, whitelist: [] };
  }

  /**
   * Adds a domain to the Complete Bypass List (Silent List).
   * Normalizes the domain and validates it before persisting.
   *
   * @param {string} domainInput - Domain or URL to bypass
   * @param {Object} [customStorage] - Optional storage adapter for testing
   * @returns {Promise<{ success: boolean, domain?: string, bypassList?: Array<{domain: string}>, error?: string }>}
   */
  async function addBypassDomain(domainInput, customStorage) {
    if (!DomainMatcher) {
      return { success: false, error: 'DomainMatcher module is unavailable.' };
    }

    const normalized = DomainMatcher.normalizeDomain(domainInput);
    if (!normalized || !DomainMatcher.isValidDomain(normalized)) {
      return {
        success: false,
        error: 'Invalid domain format. Enter a valid domain such as "example.com" or "sub.domain.org".'
      };
    }

    const settings = await getSettings(customStorage);
    const existing = settings.bypassList || [];

    const exists = existing.some(entry => {
      const d = typeof entry === 'string' ? entry : entry.domain;
      return d === normalized;
    });

    if (exists) {
      return {
        success: false,
        error: `"${normalized}" is already in your Complete Bypass List.`,
        domain: normalized,
        bypassList: existing
      };
    }

    const newEntry = { domain: normalized };
    const updatedBypassList = [...existing, newEntry].sort((a, b) =>
      a.domain.localeCompare(b.domain)
    );

    await saveSettings({ bypassList: updatedBypassList }, customStorage);

    return {
      success: true,
      domain: normalized,
      bypassList: updatedBypassList
    };
  }

  /**
   * Removes a domain from the Complete Bypass List.
   *
   * @param {string} domainInput - Domain to remove
   * @param {Object} [customStorage]
   * @returns {Promise<{ success: boolean, bypassList: Array<{domain: string}> }>}
   */
  async function removeBypassDomain(domainInput, customStorage) {
    const normalized = DomainMatcher ? DomainMatcher.normalizeDomain(domainInput) : domainInput.trim().toLowerCase();
    const settings = await getSettings(customStorage);

    const updatedBypassList = (settings.bypassList || []).filter(entry => {
      const d = typeof entry === 'string' ? entry : entry.domain;
      return d !== normalized;
    });

    await saveSettings({ bypassList: updatedBypassList }, customStorage);

    return {
      success: true,
      bypassList: updatedBypassList
    };
  }

  /**
   * Clears all entries from the Complete Bypass List.
   */
  async function clearBypassList(customStorage) {
    await saveSettings({ bypassList: [] }, customStorage);
    return { success: true, bypassList: [] };
  }

  /**
   * Resets all settings to factory defaults.
   */
  async function resetToDefaults(customStorage) {
    await saveSettings(DEFAULT_SETTINGS, customStorage);
    return { ...DEFAULT_SETTINGS };
  }

  /**
   * Listens for changes in Chrome storage and notifies callback.
   *
   * @param {function(typeof DEFAULT_SETTINGS): void} callback
   */
  function onSettingsChanged(callback) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'sync' || areaName === 'local') {
          getSettings().then(callback);
        }
      });
    } else if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('storage', (evt) => {
        if (evt.key === 'maitab_settings') {
          getSettings().then(callback);
        }
      });
    }
  }

  return {
    DEFAULT_SETTINGS,
    getSettings,
    saveSettings,
    addWhitelistDomain,
    updateWhitelistDomainFocus,
    removeWhitelistDomain,
    clearWhitelist,
    addBypassDomain,
    removeBypassDomain,
    clearBypassList,
    resetToDefaults,
    onSettingsChanged
  };
});
