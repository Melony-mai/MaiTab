/**
 * MaiTab - Popup Script
 * Manages extension toggles, multilingual support, whitelist administration,
 * Complete Bypass List (Silent List) management, and current page state.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements - General & Header
  const langSelect = document.getElementById('langSelect');
  const masterToggle = document.getElementById('masterEnabledToggle');
  const disabledBanner = document.getElementById('disabledBanner');
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const themeIconSun = document.getElementById('themeIconSun');
  const themeIconMoon = document.getElementById('themeIconMoon');
  const popupThemeSelect = document.getElementById('popupThemeSelect');

  // DOM Elements - Check Updates & Sync Card
  const checkUpdateBtn = document.getElementById('checkUpdateBtn');
  const syncStatusBanner = document.getElementById('syncStatusBanner');
  const syncStatusBadge = document.getElementById('syncStatusBadge');
  const syncStatusMessage = document.getElementById('syncStatusMessage');
  const dismissSyncBtn = document.getElementById('dismissSyncBtn');
  const syncDetailsBox = document.getElementById('syncDetailsBox');
  const syncCommitsList = document.getElementById('syncCommitsList');
  const syncConflictBox = document.getElementById('syncConflictBox');
  const syncActionArea = document.getElementById('syncActionArea');
  const syncNowBtn = document.getElementById('syncNowBtn');

  // DOM Elements - Current Tab Status Card
  const siteStatusBadge = document.getElementById('siteStatusBadge');
  const currentDomainText = document.getElementById('currentDomainText');
  const quickWhitelistBtn = document.getElementById('quickWhitelistBtn');
  const quickBypassBtn = document.getElementById('quickBypassBtn');
  const currentSiteFocusRow = document.getElementById('currentSiteFocusRow');
  const currentSiteFocusToggle = document.getElementById('currentSiteFocusToggle');
  const currentSiteFocusText = document.getElementById('currentSiteFocusText');
  const siteBehaviorHint = document.getElementById('siteBehaviorHint');

  // DOM Elements - Global Auto-Switch Toggle
  const autoSwitchToggle = document.getElementById('autoSwitchToggle');
  const autoSwitchDescription = document.getElementById('autoSwitchDescription');
  const globalToggleStateBadge = document.getElementById('globalToggleStateBadge');

  // DOM Elements - Lists Navigation Tabs
  const tabBtnWhitelist = document.getElementById('tabBtnWhitelist');
  const tabBtnBypass = document.getElementById('tabBtnBypass');
  const panelWhitelist = document.getElementById('panelWhitelist');
  const panelBypass = document.getElementById('panelBypass');
  const whitelistCount = document.getElementById('whitelistCount');
  const bypassCount = document.getElementById('bypassCount');

  // DOM Elements - Whitelist Form & List
  const addDomainForm = document.getElementById('addDomainForm');
  const domainInput = document.getElementById('domainInput');
  const popupNewDomainFocus = document.getElementById('popupNewDomainFocus');
  const inputError = document.getElementById('inputError');
  const whitelistUl = document.getElementById('whitelistUl');
  const emptyWhitelist = document.getElementById('emptyWhitelist');

  // DOM Elements - Complete Bypass Form & List
  const addBypassForm = document.getElementById('addBypassForm');
  const bypassInput = document.getElementById('bypassInput');
  const bypassInputError = document.getElementById('bypassInputError');
  const bypassUl = document.getElementById('bypassUl');
  const emptyBypass = document.getElementById('emptyBypass');

  let currentSettings = null;
  let activeTabHostname = '';
  let activeTabName = 'whitelist'; // 'whitelist' or 'bypass'

  /**
   * Sets up language from stored preferences or browser default.
   */
  function setupLanguage(langPreference) {
    const targetLang = (langPreference && langPreference !== 'auto')
      ? I18n.normalizeLanguageCode(langPreference)
      : I18n.detectBrowserLanguage();

    I18n.setLanguage(targetLang);
    if (langSelect) {
      langSelect.value = targetLang;
    }
    I18n.applyToDOM();
  }

  function getSystemTheme() {
    return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
      ? 'dark'
      : 'light';
  }

  function resolveEffectiveTheme(prefTheme) {
    if (prefTheme === 'system') {
      return getSystemTheme();
    }
    return prefTheme === 'light' ? 'light' : 'dark';
  }

  /**
   * Identifies the hostname of the currently active browser tab.
   */
  async function resolveCurrentTabHostname() {
    try {
      if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.url) {
          const parsed = new URL(tab.url);
          if (['http:', 'https:'].includes(parsed.protocol)) {
            activeTabHostname = parsed.hostname;
            return;
          }
        }
      }
    } catch {
      // Fallback
    }
    activeTabHostname = '';
  }

  /**
   * Refreshes the complete UI state based on settings and active tab.
   */
  async function renderUI() {
    currentSettings = await StorageManager.getSettings();

    // 0. Theme synchronization
    const savedTheme = currentSettings.theme || 'dark';
    const activeTheme = resolveEffectiveTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', activeTheme);
    try {
      localStorage.setItem('maitab_theme', savedTheme);
    } catch (e) {}

    if (popupThemeSelect) {
      popupThemeSelect.value = savedTheme;
    }

    if (themeToggleBtn && themeIconSun && themeIconMoon) {
      if (activeTheme === 'light') {
        themeIconMoon.classList.remove('hidden');
        themeIconSun.classList.add('hidden');
        themeToggleBtn.title = savedTheme === 'system'
          ? I18n.t('themeSystemTitle', I18n.t('themeLight'))
          : I18n.t('themeSwitchToDark');
        themeToggleBtn.setAttribute('aria-label', themeToggleBtn.title);
      } else {
        themeIconSun.classList.remove('hidden');
        themeIconMoon.classList.add('hidden');
        themeToggleBtn.title = savedTheme === 'system'
          ? I18n.t('themeSystemTitle', I18n.t('themeDark'))
          : I18n.t('themeSwitchToLight');
        themeToggleBtn.setAttribute('aria-label', themeToggleBtn.title);
      }
    }

    // 1. Language sync
    setupLanguage(currentSettings.language);

    // 2. Master toggle state
    masterToggle.checked = currentSettings.enabled;
    if (currentSettings.enabled) {
      disabledBanner.classList.add('hidden');
    } else {
      disabledBanner.classList.remove('hidden');
    }

    // 3. Global Tab Switching toggle
    autoSwitchToggle.checked = currentSettings.autoSwitch;
    if (currentSettings.autoSwitch) {
      autoSwitchDescription.textContent = I18n.t('autoSwitchDescOn');
      globalToggleStateBadge.className = 'behavior-callout active-callout';
      globalToggleStateBadge.innerHTML = I18n.t('calloutGlobalOn');
    } else {
      autoSwitchDescription.textContent = I18n.t('autoSwitchDescOff');
      globalToggleStateBadge.className = 'behavior-callout background-callout';
      globalToggleStateBadge.innerHTML = I18n.t('calloutGlobalOff');
    }

    // 4. Current Website Card
    if (!activeTabHostname) {
      currentDomainText.textContent = I18n.t('internalPage');
      siteStatusBadge.className = 'badge badge-gray';
      siteStatusBadge.textContent = I18n.t('badgeInactive');
      quickWhitelistBtn.disabled = true;
      quickWhitelistBtn.textContent = I18n.t('btnWhitelist');
      quickBypassBtn.disabled = true;
      quickBypassBtn.textContent = I18n.t('btnBypass');
      currentSiteFocusRow.classList.add('hidden');
      siteBehaviorHint.textContent = I18n.t('hintInternal');
    } else {
      currentDomainText.textContent = activeTabHostname;
      quickWhitelistBtn.disabled = false;
      quickBypassBtn.disabled = false;

      const matchedBypass = DomainMatcher.getMatchedBypassRule(activeTabHostname, currentSettings.bypassList);
      const isBypassed = Boolean(matchedBypass);

      const matchedRule = DomainMatcher.getMatchedRule(activeTabHostname, currentSettings.whitelist);
      const isWhitelisted = Boolean(matchedRule);

      // Bypass button state
      if (isBypassed) {
        quickBypassBtn.textContent = I18n.t('btnBypassed');
        quickBypassBtn.className = 'btn btn-sm btn-bypassed-active';
        quickBypassBtn.title = I18n.t('titleRemoveBypassCurrent');
      } else {
        quickBypassBtn.textContent = I18n.t('btnBypass');
        quickBypassBtn.className = 'btn btn-sm btn-secondary';
        quickBypassBtn.title = I18n.t('titleBypassCurrent');
      }

      // Whitelist button state
      if (isWhitelisted) {
        quickWhitelistBtn.textContent = I18n.t('btnWhitelisted');
        quickWhitelistBtn.className = 'btn btn-sm btn-secondary';
        quickWhitelistBtn.title = I18n.t('titleRemoveCurrent');

        if (!isBypassed) {
          currentSiteFocusRow.classList.remove('hidden');
          currentSiteFocusToggle.checked = matchedRule.autoFocus;
          currentSiteFocusText.textContent = matchedRule.autoFocus
            ? I18n.t('focusModeFocused')
            : I18n.t('focusModeBackground');
          currentSiteFocusToggle.title = matchedRule.autoFocus
            ? I18n.t('focusModeFocused')
            : I18n.t('focusModeBackground');
        } else {
          currentSiteFocusRow.classList.add('hidden');
        }
      } else {
        quickWhitelistBtn.textContent = I18n.t('btnWhitelist');
        quickWhitelistBtn.className = 'btn btn-sm btn-primary';
        quickWhitelistBtn.title = I18n.t('titleWhitelistCurrent');
        currentSiteFocusRow.classList.add('hidden');
      }

      // Precedence: 1. Disabled -> 2. Bypassed -> 3. Whitelisted -> 4. Global
      if (!currentSettings.enabled) {
        siteStatusBadge.className = 'badge badge-gray';
        siteStatusBadge.textContent = I18n.t('badgePaused');
        siteBehaviorHint.textContent = I18n.t('hintPaused');
      } else if (isBypassed) {
        // Complete Bypass List has HIGHEST PRECEDENCE!
        siteStatusBadge.className = 'badge badge-bypassed';
        siteStatusBadge.textContent = I18n.t('badgeBypassed');
        siteBehaviorHint.textContent = I18n.t('hintBypassed');
      } else if (isWhitelisted) {
        if (matchedRule.autoFocus) {
          siteStatusBadge.className = 'badge badge-success';
          siteStatusBadge.textContent = I18n.t('badgeForegroundWhitelisted');
          siteBehaviorHint.textContent = I18n.t('hintForegroundWhitelisted');
        } else {
          siteStatusBadge.className = 'badge badge-warning';
          siteStatusBadge.textContent = I18n.t('badgeBackgroundWhitelisted');
          siteBehaviorHint.textContent = I18n.t('hintBackgroundWhitelisted');
        }
      } else if (currentSettings.autoSwitch) {
        siteStatusBadge.className = 'badge badge-info';
        siteStatusBadge.textContent = I18n.t('badgeForeground');
        siteBehaviorHint.textContent = I18n.t('hintForegroundGlobal');
      } else {
        siteStatusBadge.className = 'badge badge-gray';
        siteStatusBadge.textContent = I18n.t('badgeBackground');
        siteBehaviorHint.textContent = I18n.t('hintBackground');
      }
    }

    // 5. Render Lists
    renderWhitelistItems(currentSettings.whitelist);
    renderBypassItems(currentSettings.bypassList);
  }

  /**
   * Renders the list of whitelisted domains with per-entry focus options.
   */
  function renderWhitelistItems(whitelist) {
    whitelistUl.innerHTML = '';
    whitelistCount.textContent = String(whitelist.length);

    if (whitelist.length === 0) {
      emptyWhitelist.classList.remove('hidden');
      whitelistUl.classList.add('hidden');
      return;
    }

    emptyWhitelist.classList.add('hidden');
    whitelistUl.classList.remove('hidden');

    whitelist.forEach((entry) => {
      const domain = typeof entry === 'string' ? entry : entry.domain;
      const autoFocus = typeof entry === 'object' && entry !== null && 'autoFocus' in entry
        ? Boolean(entry.autoFocus)
        : true;

      const li = document.createElement('li');
      li.className = 'whitelist-item';

      const wrap = document.createElement('div');
      wrap.className = 'item-domain-wrap';

      const domainSpan = document.createElement('span');
      domainSpan.className = 'item-domain';
      domainSpan.textContent = domain;
      domainSpan.title = domain;

      const tagSpan = document.createElement('span');
      tagSpan.className = 'subdomain-tag';
      tagSpan.textContent = I18n.t('subdomainsTag');

      wrap.appendChild(domainSpan);
      wrap.appendChild(tagSpan);

      // Actions container: Focus toggle + Remove button
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'item-controls';

      // Focus Toggle
      const focusToggleLabel = document.createElement('label');
      focusToggleLabel.className = 'item-focus-toggle-wrap';
      focusToggleLabel.title = I18n.t('focusToggleAria', domain);

      const focusBadge = document.createElement('span');
      focusBadge.className = `item-focus-badge ${autoFocus ? 'focus-on' : 'focus-off'}`;
      focusBadge.textContent = autoFocus ? I18n.t('whitelistFocusOn') : I18n.t('whitelistFocusOff');

      const switchLabel = document.createElement('label');
      switchLabel.className = 'switch switch-xs';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'whitelist-item-focus-checkbox';
      checkbox.checked = autoFocus;
      checkbox.setAttribute('aria-label', I18n.t('focusToggleAria', domain));

      checkbox.addEventListener('change', async (e) => {
        e.stopPropagation();
        await StorageManager.updateWhitelistDomainFocus(domain, checkbox.checked);
        await renderUI();
      });

      const slider = document.createElement('span');
      slider.className = 'slider round';

      switchLabel.appendChild(checkbox);
      switchLabel.appendChild(slider);

      focusToggleLabel.appendChild(focusBadge);
      focusToggleLabel.appendChild(switchLabel);

      // Remove button
      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn-remove';
      removeBtn.innerHTML = '&times;';
      removeBtn.title = I18n.t('removeAria', domain);
      removeBtn.setAttribute('aria-label', I18n.t('removeAria', domain));

      removeBtn.addEventListener('click', async () => {
        await StorageManager.removeWhitelistDomain(domain);
        await renderUI();
      });

      actionsDiv.appendChild(focusToggleLabel);
      actionsDiv.appendChild(removeBtn);

      li.appendChild(wrap);
      li.appendChild(actionsDiv);
      whitelistUl.appendChild(li);
    });
  }

  /**
   * Renders the list of bypassed domains (Silent List).
   */
  function renderBypassItems(bypassList) {
    bypassUl.innerHTML = '';
    const list = bypassList || [];
    bypassCount.textContent = String(list.length);

    if (list.length === 0) {
      emptyBypass.classList.remove('hidden');
      bypassUl.classList.add('hidden');
      return;
    }

    emptyBypass.classList.add('hidden');
    bypassUl.classList.remove('hidden');

    list.forEach((entry) => {
      const domain = typeof entry === 'string' ? entry : entry.domain;

      const li = document.createElement('li');
      li.className = 'whitelist-item';

      const wrap = document.createElement('div');
      wrap.className = 'item-domain-wrap';

      const domainSpan = document.createElement('span');
      domainSpan.className = 'item-domain';
      domainSpan.textContent = domain;
      domainSpan.title = domain;

      const tagSpan = document.createElement('span');
      tagSpan.className = 'subdomain-tag';
      tagSpan.textContent = I18n.t('subdomainsTag');

      wrap.appendChild(domainSpan);
      wrap.appendChild(tagSpan);

      // Actions container: Remove button
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'item-controls';

      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn-remove';
      removeBtn.innerHTML = '&times;';
      removeBtn.title = I18n.t('removeBypassAria', domain);
      removeBtn.setAttribute('aria-label', I18n.t('removeBypassAria', domain));

      removeBtn.addEventListener('click', async () => {
        await StorageManager.removeBypassDomain(domain);
        await renderUI();
      });

      actionsDiv.appendChild(removeBtn);

      li.appendChild(wrap);
      li.appendChild(actionsDiv);
      bypassUl.appendChild(li);
    });
  }

  function showWhitelistError(msg) {
    inputError.textContent = msg;
    inputError.classList.remove('hidden');
  }

  function hideWhitelistError() {
    inputError.textContent = '';
    inputError.classList.add('hidden');
  }

  function showBypassError(msg) {
    bypassInputError.textContent = msg;
    bypassInputError.classList.remove('hidden');
  }

  function hideBypassError() {
    bypassInputError.textContent = '';
    bypassInputError.classList.add('hidden');
  }

  /**
   * Switches active list panel in popup.
   */
  function switchTab(tab) {
    activeTabName = tab;
    if (tab === 'whitelist') {
      tabBtnWhitelist.classList.add('active');
      tabBtnBypass.classList.remove('active');
      panelWhitelist.classList.remove('hidden');
      panelBypass.classList.add('hidden');
    } else {
      tabBtnWhitelist.classList.remove('active');
      tabBtnBypass.classList.add('active');
      panelWhitelist.classList.add('hidden');
      panelBypass.classList.remove('hidden');
    }
  }

  // Event Listeners

  tabBtnWhitelist.addEventListener('click', () => switchTab('whitelist'));
  tabBtnBypass.addEventListener('click', () => switchTab('bypass'));

  // Language Selector
  langSelect.addEventListener('change', async () => {
    const chosenLang = langSelect.value;
    I18n.setLanguage(chosenLang);
    await StorageManager.saveSettings({ language: chosenLang });
    I18n.applyToDOM();
    await renderUI();
  });

  // Master Enable Toggle
  masterToggle.addEventListener('change', async () => {
    await StorageManager.saveSettings({ enabled: masterToggle.checked });
    await renderUI();
  });

  // Global Auto-Switch Toggle
  autoSwitchToggle.addEventListener('change', async () => {
    await StorageManager.saveSettings({ autoSwitch: autoSwitchToggle.checked });
    await renderUI();
  });

  // Current Site Focus Toggle
  currentSiteFocusToggle.addEventListener('change', async () => {
    if (!activeTabHostname) return;
    const rule = DomainMatcher.getMatchedRule(activeTabHostname, currentSettings.whitelist);
    if (rule) {
      await StorageManager.updateWhitelistDomainFocus(rule.domain, currentSiteFocusToggle.checked);
      await renderUI();
    }
  });

  // Quick Whitelist button for active tab
  quickWhitelistBtn.addEventListener('click', async () => {
    if (!activeTabHostname) return;

    const matchedRule = DomainMatcher.getMatchedRule(activeTabHostname, currentSettings.whitelist);
    if (matchedRule) {
      await StorageManager.removeWhitelistDomain(matchedRule.domain);
    } else {
      const matchedBypass = DomainMatcher.getMatchedBypassRule(activeTabHostname, currentSettings.bypassList);
      if (matchedBypass) {
        await StorageManager.removeBypassDomain(matchedBypass.domain);
      }
      await StorageManager.addWhitelistDomain(activeTabHostname, true);
    }
    await renderUI();
  });

  // Quick Bypass button for active tab
  quickBypassBtn.addEventListener('click', async () => {
    if (!activeTabHostname) return;

    const matchedBypass = DomainMatcher.getMatchedBypassRule(activeTabHostname, currentSettings.bypassList);
    if (matchedBypass) {
      await StorageManager.removeBypassDomain(matchedBypass.domain);
    } else {
      const matchedRule = DomainMatcher.getMatchedRule(activeTabHostname, currentSettings.whitelist);
      if (matchedRule) {
        await StorageManager.removeWhitelistDomain(matchedRule.domain);
      }
      await StorageManager.addBypassDomain(activeTabHostname);
    }
    await renderUI();
  });

  // Add Domain Form (Whitelist) - if present
  if (addDomainForm) {
    addDomainForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideWhitelistError();

      const rawInput = domainInput ? domainInput.value.trim() : '';
      if (!rawInput) {
        showWhitelistError(I18n.t('errEnterDomain'));
        return;
      }

      const normalized = DomainMatcher.normalizeDomain(rawInput);
      if (!normalized || !DomainMatcher.isValidDomain(normalized)) {
        showWhitelistError(I18n.t('errInvalidDomain'));
        return;
      }

      const exists = currentSettings.whitelist.some(entry => {
        const d = typeof entry === 'string' ? entry : entry.domain;
        return d === normalized;
      });

      if (exists) {
        showWhitelistError(I18n.t('errDomainExists', normalized));
        return;
      }

      const autoFocus = popupNewDomainFocus ? popupNewDomainFocus.value === 'true' : true;
      const result = await StorageManager.addWhitelistDomain(rawInput, autoFocus);
      if (!result.success) {
        showWhitelistError(result.error || I18n.t('errInvalidDomain'));
        return;
      }

      if (domainInput) domainInput.value = '';
      hideWhitelistError();
      await renderUI();
    });
  }

  // Add Bypass Form
  addBypassForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideBypassError();

    const rawInput = bypassInput.value.trim();
    if (!rawInput) {
      showBypassError(I18n.t('errEnterDomain'));
      return;
    }

    const normalized = DomainMatcher.normalizeDomain(rawInput);
    if (!normalized || !DomainMatcher.isValidDomain(normalized)) {
      showBypassError(I18n.t('errInvalidDomain'));
      return;
    }

    const exists = (currentSettings.bypassList || []).some(entry => {
      const d = typeof entry === 'string' ? entry : entry.domain;
      return d === normalized;
    });

    if (exists) {
      showBypassError(I18n.t('errBypassDomainExists', normalized));
      return;
    }

    const result = await StorageManager.addBypassDomain(rawInput);
    if (!result.success) {
      showBypassError(result.error || I18n.t('errInvalidDomain'));
      return;
    }

    bypassInput.value = '';
    hideBypassError();
    await renderUI();
  });

  // Theme Toggle Button
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', async () => {
      const activeTheme = resolveEffectiveTheme(currentSettings?.theme || 'dark');
      const nextTheme = activeTheme === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', nextTheme);
      try {
        localStorage.setItem('maitab_theme', nextTheme);
      } catch (e) {}

      if (currentSettings) {
        currentSettings.theme = nextTheme;
      }
      await StorageManager.saveSettings({ theme: nextTheme });
      await renderUI();
    });
  }

  // Theme Select Dropdown
  if (popupThemeSelect) {
    popupThemeSelect.addEventListener('change', async () => {
      const val = popupThemeSelect.value;
      const selectedTheme = ['system', 'light', 'dark'].includes(val) ? val : 'dark';
      const effectiveTheme = resolveEffectiveTheme(selectedTheme);
      document.documentElement.setAttribute('data-theme', effectiveTheme);
      try {
        localStorage.setItem('maitab_theme', selectedTheme);
      } catch (e) {}

      if (currentSettings) {
        currentSettings.theme = selectedTheme;
      }
      await StorageManager.saveSettings({ theme: selectedTheme });
      await renderUI();
    });
  }

  // Real-time OS System theme change listener
  if (window.matchMedia) {
    const colorSchemeMedia = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = async () => {
      const settings = await StorageManager.getSettings();
      if (settings.theme === 'system') {
        await renderUI();
      }
    };
    if (typeof colorSchemeMedia.addEventListener === 'function') {
      colorSchemeMedia.addEventListener('change', handleMediaChange);
    } else if (typeof colorSchemeMedia.addListener === 'function') {
      colorSchemeMedia.addListener(handleMediaChange);
    }
  }

  // Check for Updates & Synchronization
  async function triggerUpdateCheck() {
    if (!checkUpdateBtn) return;
    checkUpdateBtn.classList.add('is-checking');
    if (syncStatusBanner) {
      syncStatusBanner.classList.remove('hidden');
    }
    if (syncStatusBadge) {
      syncStatusBadge.className = 'badge badge-info';
      syncStatusBadge.textContent = I18n.t('badgeCheckingUpdates');
    }
    if (syncStatusMessage) {
      syncStatusMessage.textContent = I18n.t('statusChecking');
    }
    if (syncDetailsBox) syncDetailsBox.classList.add('hidden');
    if (syncActionArea) syncActionArea.classList.add('hidden');

    try {
      const result = typeof Updater !== 'undefined'
        ? await Updater.checkForUpdates()
        : { success: false, error: 'Updater module not available' };

      checkUpdateBtn.classList.remove('is-checking');

      if (!result.success || result.status === 'UPDATE_FAILED') {
        if (syncStatusBadge) {
          syncStatusBadge.className = 'badge badge-danger';
          syncStatusBadge.textContent = I18n.t('badgeUpdateFailed');
        }
        if (syncStatusMessage) {
          syncStatusMessage.textContent = result.error || I18n.t('statusUpdateFailed');
        }
        return;
      }

      if (result.upToDate || result.status === 'UP_TO_DATE') {
        if (syncStatusBadge) {
          syncStatusBadge.className = 'badge badge-success';
          syncStatusBadge.textContent = I18n.t('badgeUpToDate');
        }
        if (syncStatusMessage) {
          syncStatusMessage.textContent = I18n.t('statusUpToDate');
        }
        if (checkUpdateBtn) checkUpdateBtn.classList.remove('has-update');
        if (syncDetailsBox) syncDetailsBox.classList.add('hidden');
        if (syncActionArea) syncActionArea.classList.add('hidden');
      } else {
        // Update Available
        if (checkUpdateBtn) checkUpdateBtn.classList.add('has-update');
        if (syncStatusBadge) {
          syncStatusBadge.className = 'badge badge-update';
          syncStatusBadge.textContent = I18n.t('badgeUpdateAvailable');
        }
        if (syncStatusMessage) {
          syncStatusMessage.textContent = I18n.t('statusUpdateAvailable', result.behindCount || 1);
        }

        if (syncCommitsList && Array.isArray(result.incomingCommits) && result.incomingCommits.length > 0) {
          syncCommitsList.innerHTML = '';
          result.incomingCommits.slice(0, 5).forEach(c => {
            const li = document.createElement('li');
            li.textContent = `• ${c}`;
            syncCommitsList.appendChild(li);
          });
          if (syncDetailsBox) syncDetailsBox.classList.remove('hidden');
          if (syncConflictBox) syncConflictBox.classList.add('hidden');
        }

        if (syncActionArea) syncActionArea.classList.remove('hidden');
        if (syncNowBtn) {
          syncNowBtn.classList.remove('hidden');
          syncNowBtn.disabled = false;
        }
      }
    } catch (err) {
      checkUpdateBtn.classList.remove('is-checking');
      if (syncStatusBadge) {
        syncStatusBadge.className = 'badge badge-danger';
        syncStatusBadge.textContent = I18n.t('badgeUpdateFailed');
      }
      if (syncStatusMessage) {
        syncStatusMessage.textContent = err.message || I18n.t('statusUpdateFailed');
      }
    }
  }

  async function triggerManualSync() {
    if (!syncNowBtn) return;
    syncNowBtn.disabled = true;
    if (syncStatusBadge) {
      syncStatusBadge.className = 'badge badge-info';
      syncStatusBadge.textContent = I18n.t('badgeSynchronizing');
    }
    if (syncStatusMessage) {
      syncStatusMessage.textContent = I18n.t('statusSynchronizing');
    }

    try {
      const result = typeof Updater !== 'undefined'
        ? await Updater.performSync()
        : { success: false, error: 'Updater module not available' };

      syncNowBtn.disabled = false;

      if (result.success) {
        if (checkUpdateBtn) checkUpdateBtn.classList.remove('has-update');
        if (syncStatusBadge) {
          syncStatusBadge.className = 'badge badge-success';
          syncStatusBadge.textContent = I18n.t('badgeUpToDate');
        }
        if (syncStatusMessage) {
          syncStatusMessage.textContent = I18n.t('statusSyncSuccess');
        }
        if (syncDetailsBox) syncDetailsBox.classList.add('hidden');
        if (syncActionArea) syncActionArea.classList.add('hidden');

        // Re-check update status after short delay to refresh all state
        setTimeout(() => triggerUpdateCheck(), 1200);
      } else {
        if (syncStatusBadge) {
          syncStatusBadge.className = 'badge badge-danger';
          syncStatusBadge.textContent = I18n.t('badgeUpdateFailed');
        }
        if (syncStatusMessage) {
          syncStatusMessage.textContent = result.error || I18n.t('statusUpdateFailed');
        }
        if (result.conflict && syncConflictBox) {
          syncConflictBox.textContent = result.feedback || result.error || 'Conflict detected during synchronization.';
          syncConflictBox.classList.remove('hidden');
          if (syncDetailsBox) syncDetailsBox.classList.remove('hidden');
        }
      }
    } catch (err) {
      syncNowBtn.disabled = false;
      if (syncStatusBadge) {
        syncStatusBadge.className = 'badge badge-danger';
        syncStatusBadge.textContent = I18n.t('badgeUpdateFailed');
      }
      if (syncStatusMessage) {
        syncStatusMessage.textContent = err.message || I18n.t('statusUpdateFailed');
      }
    }
  }

  if (checkUpdateBtn) {
    checkUpdateBtn.addEventListener('click', () => {
      triggerUpdateCheck();
    });
  }

  if (syncNowBtn) {
    syncNowBtn.addEventListener('click', triggerManualSync);
  }

  if (dismissSyncBtn) {
    dismissSyncBtn.addEventListener('click', () => {
      if (syncStatusBanner) syncStatusBanner.classList.add('hidden');
    });
  }

  // Real-time storage updates
  StorageManager.onSettingsChanged(() => {
    renderUI();
  });

  // Initial boot
  await resolveCurrentTabHostname();
  await renderUI();
});
