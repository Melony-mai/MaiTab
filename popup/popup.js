/**
 * MaiTab - Popup Script
 * Manages extension toggles, multilingual support, whitelist administration,
 * and current page state.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const langSelect = document.getElementById('langSelect');
  const masterToggle = document.getElementById('masterEnabledToggle');
  const disabledBanner = document.getElementById('disabledBanner');
  const siteStatusBadge = document.getElementById('siteStatusBadge');
  const currentDomainText = document.getElementById('currentDomainText');
  const quickWhitelistBtn = document.getElementById('quickWhitelistBtn');
  const currentSiteFocusRow = document.getElementById('currentSiteFocusRow');
  const currentSiteFocusToggle = document.getElementById('currentSiteFocusToggle');
  const currentSiteFocusText = document.getElementById('currentSiteFocusText');
  const siteBehaviorHint = document.getElementById('siteBehaviorHint');
  const autoSwitchToggle = document.getElementById('autoSwitchToggle');
  const autoSwitchDescription = document.getElementById('autoSwitchDescription');
  const globalToggleStateBadge = document.getElementById('globalToggleStateBadge');
  const whitelistCount = document.getElementById('whitelistCount');
  const addDomainForm = document.getElementById('addDomainForm');
  const domainInput = document.getElementById('domainInput');
  const popupNewDomainFocus = document.getElementById('popupNewDomainFocus');
  const inputError = document.getElementById('inputError');
  const whitelistUl = document.getElementById('whitelistUl');
  const emptyWhitelist = document.getElementById('emptyWhitelist');

  let currentSettings = null;
  let activeTabHostname = '';

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
      currentSiteFocusRow.classList.add('hidden');
      siteBehaviorHint.textContent = I18n.t('hintInternal');
    } else {
      currentDomainText.textContent = activeTabHostname;
      quickWhitelistBtn.disabled = false;

      const matchedRule = DomainMatcher.getMatchedRule(activeTabHostname, currentSettings.whitelist);
      const isWhitelisted = Boolean(matchedRule);

      if (isWhitelisted) {
        quickWhitelistBtn.textContent = I18n.t('btnWhitelisted');
        quickWhitelistBtn.className = 'btn btn-sm btn-secondary';
        quickWhitelistBtn.title = I18n.t('titleRemoveCurrent');

        currentSiteFocusRow.classList.remove('hidden');
        currentSiteFocusToggle.checked = matchedRule.autoFocus;
        currentSiteFocusText.textContent = matchedRule.autoFocus
          ? I18n.t('focusOptionForegroundShort')
          : I18n.t('focusOptionBackgroundShort');
      } else {
        quickWhitelistBtn.textContent = I18n.t('btnWhitelist');
        quickWhitelistBtn.className = 'btn btn-sm btn-primary';
        quickWhitelistBtn.title = I18n.t('titleWhitelistCurrent');
        currentSiteFocusRow.classList.add('hidden');
      }

      if (!currentSettings.enabled) {
        siteStatusBadge.className = 'badge badge-gray';
        siteStatusBadge.textContent = I18n.t('badgePaused');
        siteBehaviorHint.textContent = I18n.t('hintPaused');
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

    // 5. Whitelist List
    renderWhitelistItems(currentSettings.whitelist);
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

  function showError(msg) {
    inputError.textContent = msg;
    inputError.classList.remove('hidden');
  }

  function hideError() {
    inputError.textContent = '';
    inputError.classList.add('hidden');
  }

  // Event Listeners

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
      await StorageManager.addWhitelistDomain(activeTabHostname, true);
    }
    await renderUI();
  });

  // Add Domain Form
  addDomainForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const rawInput = domainInput.value.trim();
    if (!rawInput) {
      showError(I18n.t('errEnterDomain'));
      return;
    }

    const normalized = DomainMatcher.normalizeDomain(rawInput);
    if (!normalized || !DomainMatcher.isValidDomain(normalized)) {
      showError(I18n.t('errInvalidDomain'));
      return;
    }

    const exists = currentSettings.whitelist.some(entry => {
      const d = typeof entry === 'string' ? entry : entry.domain;
      return d === normalized;
    });

    if (exists) {
      showError(I18n.t('errDomainExists', normalized));
      return;
    }

    const autoFocus = popupNewDomainFocus ? popupNewDomainFocus.value === 'true' : true;
    const result = await StorageManager.addWhitelistDomain(rawInput, autoFocus);
    if (!result.success) {
      showError(result.error || I18n.t('errInvalidDomain'));
      return;
    }

    domainInput.value = '';
    hideError();
    await renderUI();
  });

  // Real-time storage updates
  StorageManager.onSettingsChanged(() => {
    renderUI();
  });

  // Initial boot
  await resolveCurrentTabHostname();
  await renderUI();
});
