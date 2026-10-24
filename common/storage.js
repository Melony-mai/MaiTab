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
    autoSwitch: false,         // Global toggle: automatically switch focus to new tab
    whitelist: [],             // Whitelisted domains that always switch focus even when autoSwitch is false
    openNextToCurrent: true,   // Place new tab immediately adjacent to current tab
    language: 'auto'           // Language preference: 'auto', 'en', 'zh-CN', 'ja'
  };

  /**
   * Resolves the appropriate Chrome storage area (sync with local fallback).
   */
  function getStorageArea() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      return chrome.storage.sync || chrome.storage.local;
    }
    return null;
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
      // Normalize and deduplicate whitelist domains
      const set = new Set();
      normalized.whitelist.forEach(item => {
        const norm = DomainMatcher ? DomainMatcher.normalizeDomain(item) : item.trim().toLowerCase();
        if (norm) set.add(norm);
      });
      normalized.whitelist = Array.from(set);
    }

    normalized.enabled = Boolean(normalized.enabled);
    normalized.autoSwitch = Boolean(normalized.autoSwitch);
    normalized.openNextToCurrent = Boolean(normalized.openNextToCurrent);
    if (typeof normalized.language !== 'string') {
      normalized.language = 'auto';
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
   * Adds a domain to the whitelist.
   * Normalizes the domain and validates it before persisting.
   *
   * @param {string} domainInput - Domain or URL to add
   * @param {Object} [customStorage]
   * @returns {Promise<{ success: boolean, domain?: string, whitelist?: string[], error?: string }>}
   */
  async function addWhitelistDomain(domainInput, customStorage) {
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
    const existing = settings.whitelist;

    if (existing.includes(normalized)) {
      return {
        success: false,
        error: `"${normalized}" is already in your whitelist.`,
        domain: normalized,
        whitelist: existing
      };
    }

    const updatedWhitelist = [...existing, normalized].sort();
    await saveSettings({ whitelist: updatedWhitelist }, customStorage);

    return {
      success: true,
      domain: normalized,
      whitelist: updatedWhitelist
    };
  }

  /**
   * Removes a domain from the whitelist.
   *
   * @param {string} domainInput - Domain to remove
   * @param {Object} [customStorage]
   * @returns {Promise<{ success: boolean, whitelist: string[] }>}
   */
  async function removeWhitelistDomain(domainInput, customStorage) {
    const normalized = DomainMatcher ? DomainMatcher.normalizeDomain(domainInput) : domainInput.trim().toLowerCase();
    const settings = await getSettings(customStorage);

    const updatedWhitelist = settings.whitelist.filter(d => d !== normalized);
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
    }
  }

  return {
    DEFAULT_SETTINGS,
    getSettings,
    saveSettings,
    addWhitelistDomain,
    removeWhitelistDomain,
    clearWhitelist,
    resetToDefaults,
    onSettingsChanged
  };
});
