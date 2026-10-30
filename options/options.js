/**
 * MaiTab - Options Page Script
 * Provides complete multilingual settings configuration, whitelist management,
 * Complete Bypass List (Silent List) management, bulk import/export,
 * and an interactive domain match tester.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements - General & Preferences
  const optLangSelect = document.getElementById('optLangSelect');
  const optMasterEnabled = document.getElementById('optMasterEnabled');
  const optAutoSwitch = document.getElementById('optAutoSwitch');
  const optOpenNext = document.getElementById('optOpenNext');
  const resetDefaultsBtn = document.getElementById('resetDefaultsBtn');
  const toast = document.getElementById('toast');

  // DOM Elements - Whitelist
  const optWhitelistCount = document.getElementById('optWhitelistCount');
  const optAddDomainForm = document.getElementById('optAddDomainForm');
  const optDomainInput = document.getElementById('optDomainInput');
  const optNewDomainFocus = document.getElementById('optNewDomainFocus');
  const optInputError = document.getElementById('optInputError');
  const optSearchInput = document.getElementById('optSearchInput');
  const optWhitelistTableBody = document.getElementById('optWhitelistTableBody');
  const optEmptyState = document.getElementById('optEmptyState');
  const exportWhitelistBtn = document.getElementById('exportWhitelistBtn');
  const importWhitelistBtn = document.getElementById('importWhitelistBtn');
  const clearWhitelistBtn = document.getElementById('clearWhitelistBtn');
  const importFileInput = document.getElementById('importFileInput');

  // DOM Elements - Complete Bypass List
  const optBypassCount = document.getElementById('optBypassCount');
  const optAddBypassForm = document.getElementById('optAddBypassForm');
  const optBypassDomainInput = document.getElementById('optBypassDomainInput');
  const optBypassInputError = document.getElementById('optBypassInputError');
  const optBypassSearchInput = document.getElementById('optBypassSearchInput');
  const optBypassTableBody = document.getElementById('optBypassTableBody');
  const optEmptyBypassState = document.getElementById('optEmptyBypassState');
  const exportBypassBtn = document.getElementById('exportBypassBtn');
  const importBypassBtn = document.getElementById('importBypassBtn');
  const clearBypassBtn = document.getElementById('clearBypassBtn');
  const importBypassFileInput = document.getElementById('importBypassFileInput');

  // DOM Elements - Tester
  const testerInput = document.getElementById('testerInput');
  const testerResult = document.getElementById('testerResult');
  const testerNormalizedHost = document.getElementById('testerNormalizedHost');
  const testerBypassBadge = document.getElementById('testerBypassBadge');
  const testerMatchedBadge = document.getElementById('testerMatchedBadge');
  const testerBehaviorBadge = document.getElementById('testerBehaviorBadge');
  const testerExplanation = document.getElementById('testerExplanation');

  let currentSettings = null;
  let toastTimer = null;

  function showToast(message) {
    if (toastTimer) clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.remove('hidden');
    toastTimer = setTimeout(() => {
      toast.classList.add('hidden');
    }, 2800);
  }

  function showWhitelistError(msg) {
    optInputError.textContent = msg;
    optInputError.classList.remove('hidden');
  }

  function hideWhitelistError() {
    optInputError.textContent = '';
    optInputError.classList.add('hidden');
  }

  function showBypassError(msg) {
    optBypassInputError.textContent = msg;
    optBypassInputError.classList.remove('hidden');
  }

  function hideBypassError() {
    optBypassInputError.textContent = '';
    optBypassInputError.classList.add('hidden');
  }

  /**
   * Sets up language from stored preferences or browser default.
   */
  function setupLanguage(langPreference) {
    const targetLang = (langPreference && langPreference !== 'auto')
      ? I18n.normalizeLanguageCode(langPreference)
      : I18n.detectBrowserLanguage();

    I18n.setLanguage(targetLang);
    if (optLangSelect) {
      optLangSelect.value = targetLang;
    }
    I18n.applyToDOM();
  }

  /**
   * Refreshes the options UI.
   */
  async function loadSettings() {
    currentSettings = await StorageManager.getSettings();

    setupLanguage(currentSettings.language);

    optMasterEnabled.checked = currentSettings.enabled;
    optAutoSwitch.checked = currentSettings.autoSwitch;
    optOpenNext.checked = currentSettings.openNextToCurrent;

    renderWhitelist();
    renderBypassList();
    runTester();
  }

  /**
   * Renders the whitelist table with optional filter query.
   */
  function renderWhitelist() {
    const filter = optSearchInput.value.trim().toLowerCase();
    const list = currentSettings.whitelist || [];

    optWhitelistCount.textContent = I18n.t('domainCountBadge', list.length, list.length === 1 ? '' : 's');

    const filtered = filter
      ? list.filter((item) => {
          const d = typeof item === 'string' ? item : item.domain;
          return d.toLowerCase().includes(filter);
        })
      : list;

    optWhitelistTableBody.innerHTML = '';

    if (filtered.length === 0) {
      optEmptyState.classList.remove('hidden');
      return;
    }

    optEmptyState.classList.add('hidden');

    filtered.forEach((entry) => {
      const domain = typeof entry === 'string' ? entry : entry.domain;
      const autoFocus = typeof entry === 'object' && entry !== null && 'autoFocus' in entry
        ? Boolean(entry.autoFocus)
        : true;

      const tr = document.createElement('tr');

      // Domain Pattern Cell
      const tdDomain = document.createElement('td');
      const code = document.createElement('code');
      code.className = 'domain-code';
      code.textContent = domain;
      tdDomain.appendChild(code);

      // Scope Cell
      const tdScope = document.createElement('td');
      tdScope.className = 'scope-desc';
      tdScope.textContent = I18n.t('scopeDescription', domain);

      // Tab Focus Option Cell
      const tdFocus = document.createElement('td');
      const focusWrap = document.createElement('div');
      focusWrap.className = 'table-focus-control';

      const switchLabel = document.createElement('label');
      switchLabel.className = 'switch switch-sm';

      const switchInput = document.createElement('input');
      switchInput.type = 'checkbox';
      switchInput.checked = autoFocus;
      switchInput.setAttribute('aria-label', I18n.t('focusToggleAria', domain));

      const slider = document.createElement('span');
      slider.className = 'slider round';

      switchLabel.appendChild(switchInput);
      switchLabel.appendChild(slider);

      const statusLabel = document.createElement('span');
      statusLabel.className = `table-focus-label ${autoFocus ? 'label-focus-on' : 'label-focus-off'}`;
      statusLabel.textContent = autoFocus
        ? I18n.t('focusOptionForegroundShort')
        : I18n.t('focusOptionBackgroundShort');

      switchInput.addEventListener('change', async () => {
        await StorageManager.updateWhitelistDomainFocus(domain, switchInput.checked);
        showToast(
          I18n.t(
            'toastFocusUpdated',
            domain,
            switchInput.checked
              ? I18n.t('focusOptionForegroundShort')
              : I18n.t('focusOptionBackgroundShort')
          )
        );
        await loadSettings();
      });

      focusWrap.appendChild(switchLabel);
      focusWrap.appendChild(statusLabel);
      tdFocus.appendChild(focusWrap);

      // Action Cell
      const tdAction = document.createElement('td');
      tdAction.style.textAlign = 'right';

      const delBtn = document.createElement('button');
      delBtn.className = 'btn-icon-danger';
      delBtn.title = I18n.t('removeAria', domain);
      delBtn.setAttribute('aria-label', I18n.t('removeAria', domain));
      delBtn.innerHTML = '&#10005;';
      delBtn.addEventListener('click', async () => {
        await StorageManager.removeWhitelistDomain(domain);
        showToast(I18n.t('toastRemoved', domain));
        await loadSettings();
      });

      tdAction.appendChild(delBtn);

      tr.appendChild(tdDomain);
      tr.appendChild(tdScope);
      tr.appendChild(tdFocus);
      tr.appendChild(tdAction);

      optWhitelistTableBody.appendChild(tr);
    });
  }

  /**
   * Renders the Complete Bypass List table with optional filter query.
   */
  function renderBypassList() {
    const filter = optBypassSearchInput.value.trim().toLowerCase();
    const list = currentSettings.bypassList || [];

    optBypassCount.textContent = I18n.t('domainBypassCountBadge', list.length, list.length === 1 ? '' : 's');

    const filtered = filter
      ? list.filter((item) => {
          const d = typeof item === 'string' ? item : item.domain;
          return d.toLowerCase().includes(filter);
        })
      : list;

    optBypassTableBody.innerHTML = '';

    if (filtered.length === 0) {
      optEmptyBypassState.classList.remove('hidden');
      return;
    }

    optEmptyBypassState.classList.add('hidden');

    filtered.forEach((entry) => {
      const domain = typeof entry === 'string' ? entry : entry.domain;

      const tr = document.createElement('tr');

      // Domain Pattern Cell
      const tdDomain = document.createElement('td');
      const code = document.createElement('code');
      code.className = 'domain-code';
      code.textContent = domain;
      tdDomain.appendChild(code);

      // Scope Cell
      const tdScope = document.createElement('td');
      tdScope.className = 'scope-desc';
      tdScope.textContent = I18n.t('scopeDescription', domain);

      // Status Cell
      const tdStatus = document.createElement('td');
      const statusBadge = document.createElement('span');
      statusBadge.className = 'badge badge-bypassed';
      statusBadge.textContent = I18n.t('statusBypassed');
      tdStatus.appendChild(statusBadge);

      // Action Cell
      const tdAction = document.createElement('td');
      tdAction.style.textAlign = 'right';

      const delBtn = document.createElement('button');
      delBtn.className = 'btn-icon-danger';
      delBtn.title = I18n.t('removeBypassAria', domain);
      delBtn.setAttribute('aria-label', I18n.t('removeBypassAria', domain));
      delBtn.innerHTML = '&#10005;';
      delBtn.addEventListener('click', async () => {
        await StorageManager.removeBypassDomain(domain);
        showToast(I18n.t('toastBypassRemoved', domain));
        await loadSettings();
      });

      tdAction.appendChild(delBtn);

      tr.appendChild(tdDomain);
      tr.appendChild(tdScope);
      tr.appendChild(tdStatus);
      tr.appendChild(tdAction);

      optBypassTableBody.appendChild(tr);
    });
  }

  /**
   * Updates the interactive domain matching simulation.
   * Tests Complete Bypass List (highest priority) -> Whitelist -> Global toggle.
   */
  function runTester() {
    const raw = testerInput.value.trim();
    if (!raw) {
      testerResult.classList.add('hidden');
      return;
    }

    testerResult.classList.remove('hidden');

    const normalized = DomainMatcher.normalizeDomain(raw);
    testerNormalizedHost.textContent = normalized || '(none / invalid)';

    if (!normalized) {
      testerBypassBadge.className = 'badge badge-gray';
      testerBypassBadge.textContent = I18n.t('testerInvalidInput');
      testerMatchedBadge.className = 'badge badge-gray';
      testerMatchedBadge.textContent = I18n.t('testerInvalidInput');
      testerBehaviorBadge.className = 'badge badge-gray';
      testerBehaviorBadge.textContent = I18n.t('testerInvalidInput');
      testerExplanation.textContent = I18n.t('testerEnterValidPrompt');
      return;
    }

    // 1. Check Complete Bypass List (Highest Priority)
    const matchedBypass = DomainMatcher.getMatchedBypassRule(normalized, currentSettings.bypassList);
    const isBypassed = Boolean(matchedBypass);

    if (isBypassed) {
      testerBypassBadge.className = 'badge badge-bypassed';
      testerBypassBadge.textContent = I18n.t('testerBypassBadge', matchedBypass.domain);
    } else {
      testerBypassBadge.className = 'badge badge-gray';
      testerBypassBadge.textContent = I18n.t('testerNotMatchedBadge');
    }

    // 2. Check Whitelist
    const matchedRule = DomainMatcher.getMatchedRule(normalized, currentSettings.whitelist);
    const isWhitelisted = Boolean(matchedRule);

    if (isWhitelisted) {
      testerMatchedBadge.className = 'badge badge-success';
      testerMatchedBadge.textContent = I18n.t('testerMatchedBadge', matchedRule.domain);
    } else {
      testerMatchedBadge.className = 'badge badge-gray';
      testerMatchedBadge.textContent = I18n.t('testerNotMatchedBadge');
    }

    // Determine resulting behavior with strict precedence
    if (!currentSettings.enabled) {
      testerBehaviorBadge.className = 'badge badge-gray';
      testerBehaviorBadge.textContent = I18n.t('testerPausedBadge');
      testerExplanation.textContent = I18n.t('testerExplainPaused');
      return;
    }

    if (isBypassed) {
      // Complete Bypass strictly overrides whitelist and global settings!
      testerBehaviorBadge.className = 'badge badge-bypassed';
      testerBehaviorBadge.textContent = I18n.t('testerNativeBadge');
      testerExplanation.textContent = I18n.t('testerExplainBypassed', normalized, matchedBypass.domain);
      return;
    }

    const willSwitch = DomainMatcher.shouldSwitchTab({
      enabled: currentSettings.enabled,
      autoSwitch: currentSettings.autoSwitch,
      whitelist: currentSettings.whitelist,
      bypassList: currentSettings.bypassList,
      currentHostname: normalized
    });

    if (willSwitch) {
      testerBehaviorBadge.className = 'badge badge-info';
      testerBehaviorBadge.textContent = I18n.t('testerForegroundBadge');
      if (isWhitelisted) {
        testerExplanation.textContent = I18n.t('testerExplainWhitelistedFocusOn', normalized, matchedRule.domain);
      } else {
        testerExplanation.textContent = I18n.t('testerExplainGlobalOn', normalized);
      }
    } else {
      testerBehaviorBadge.className = 'badge badge-gray';
      testerBehaviorBadge.textContent = I18n.t('testerBackgroundBadge');
      if (isWhitelisted) {
        testerExplanation.textContent = I18n.t('testerExplainWhitelistedFocusOff', normalized, matchedRule.domain);
      } else {
        testerExplanation.textContent = I18n.t('testerExplainBackground', normalized);
      }
    }
  }

  // Event Handlers

  // Language Selector
  optLangSelect.addEventListener('change', async () => {
    const chosenLang = optLangSelect.value;
    I18n.setLanguage(chosenLang);
    await StorageManager.saveSettings({ language: chosenLang });
    I18n.applyToDOM();
    await loadSettings();
  });

  // Preferences
  optMasterEnabled.addEventListener('change', async () => {
    await StorageManager.saveSettings({ enabled: optMasterEnabled.checked });
    showToast(optMasterEnabled.checked ? I18n.t('toastEnabled') : I18n.t('toastPaused'));
    runTester();
  });

  optAutoSwitch.addEventListener('change', async () => {
    await StorageManager.saveSettings({ autoSwitch: optAutoSwitch.checked });
    showToast(optAutoSwitch.checked ? I18n.t('toastGlobalOn') : I18n.t('toastGlobalOff'));
    runTester();
  });

  optOpenNext.addEventListener('change', async () => {
    await StorageManager.saveSettings({ openNextToCurrent: optOpenNext.checked });
    showToast(optOpenNext.checked ? I18n.t('toastOpenNextOn') : I18n.t('toastOpenNextOff'));
  });

  // Whitelist Add Form
  optAddDomainForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideWhitelistError();

    const domain = optDomainInput.value.trim();
    if (!domain) {
      showWhitelistError(I18n.t('errEnterDomain'));
      return;
    }

    const normalized = DomainMatcher.normalizeDomain(domain);
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

    const autoFocus = optNewDomainFocus ? optNewDomainFocus.value === 'true' : true;
    const result = await StorageManager.addWhitelistDomain(domain, autoFocus);
    if (!result.success) {
      showWhitelistError(result.error || I18n.t('errInvalidDomain'));
      return;
    }

    optDomainInput.value = '';
    showToast(I18n.t('toastAdded', result.domain));
    await loadSettings();
  });

  // Bypass List Add Form
  optAddBypassForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideBypassError();

    const domain = optBypassDomainInput.value.trim();
    if (!domain) {
      showBypassError(I18n.t('errEnterDomain'));
      return;
    }

    const normalized = DomainMatcher.normalizeDomain(domain);
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

    const result = await StorageManager.addBypassDomain(domain);
    if (!result.success) {
      showBypassError(result.error || I18n.t('errInvalidDomain'));
      return;
    }

    optBypassDomainInput.value = '';
    showToast(I18n.t('toastBypassAdded', result.domain));
    await loadSettings();
  });

  // Whitelist Search
  optSearchInput.addEventListener('input', () => {
    renderWhitelist();
  });

  // Bypass Search
  optBypassSearchInput.addEventListener('input', () => {
    renderBypassList();
  });

  // Interactive Tester Input
  testerInput.addEventListener('input', () => {
    runTester();
  });

  // Export Whitelist
  exportWhitelistBtn.addEventListener('click', () => {
    const list = currentSettings.whitelist || [];
    const exportData = {
      app: 'MaiTab',
      version: '1.2',
      exportedAt: new Date().toISOString(),
      whitelist: list
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maitab-whitelist-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(I18n.t('toastExported'));
  });

  // Export Bypass List
  exportBypassBtn.addEventListener('click', () => {
    const list = currentSettings.bypassList || [];
    const exportData = {
      app: 'MaiTab',
      version: '1.2',
      exportedAt: new Date().toISOString(),
      bypassList: list
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maitab-bypass-list-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(I18n.t('toastBypassExported'));
  });

  // Import Whitelist
  importWhitelistBtn.addEventListener('click', () => {
    importFileInput.click();
  });

  importFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target.result;
        let domainsToAdd = [];

        if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            domainsToAdd = parsed;
          } else if (parsed && Array.isArray(parsed.whitelist)) {
            domainsToAdd = parsed.whitelist;
          }
        } else {
          domainsToAdd = text.split('\n').map(l => l.trim()).filter(Boolean);
        }

        let addedCount = 0;
        for (const item of domainsToAdd) {
          const domainStr = typeof item === 'object' && item !== null ? item.domain : String(item);
          const autoFocus = typeof item === 'object' && item !== null && 'autoFocus' in item ? Boolean(item.autoFocus) : true;
          const res = await StorageManager.addWhitelistDomain(domainStr, autoFocus);
          if (res.success) addedCount++;
        }

        showToast(I18n.t('toastImported', addedCount, addedCount === 1 ? '' : 's'));
        await loadSettings();
      } catch (err) {
        alert(I18n.t('errFileParse', err.message));
      } finally {
        importFileInput.value = '';
      }
    };
    reader.readAsText(file);
  });

  // Import Bypass List
  importBypassBtn.addEventListener('click', () => {
    importBypassFileInput.click();
  });

  importBypassFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target.result;
        let domainsToAdd = [];

        if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            domainsToAdd = parsed;
          } else if (parsed && Array.isArray(parsed.bypassList)) {
            domainsToAdd = parsed.bypassList;
          }
        } else {
          domainsToAdd = text.split('\n').map(l => l.trim()).filter(Boolean);
        }

        let addedCount = 0;
        for (const item of domainsToAdd) {
          const domainStr = typeof item === 'object' && item !== null ? item.domain : String(item);
          const res = await StorageManager.addBypassDomain(domainStr);
          if (res.success) addedCount++;
        }

        showToast(I18n.t('toastBypassImported', addedCount, addedCount === 1 ? '' : 's'));
        await loadSettings();
      } catch (err) {
        alert(I18n.t('errFileParse', err.message));
      } finally {
        importBypassFileInput.value = '';
      }
    };
    reader.readAsText(file);
  });

  // Clear Whitelist
  clearWhitelistBtn.addEventListener('click', async () => {
    if (confirm(I18n.t('confirmClear'))) {
      await StorageManager.clearWhitelist();
      showToast(I18n.t('toastCleared'));
      await loadSettings();
    }
  });

  // Clear Bypass List
  clearBypassBtn.addEventListener('click', async () => {
    if (confirm(I18n.t('confirmClearBypass'))) {
      await StorageManager.clearBypassList();
      showToast(I18n.t('toastBypassCleared'));
      await loadSettings();
    }
  });

  // Reset to Defaults
  resetDefaultsBtn.addEventListener('click', async () => {
    if (confirm(I18n.t('confirmReset'))) {
      await StorageManager.resetToDefaults();
      showToast(I18n.t('toastReset'));
      await loadSettings();
    }
  });

  // Storage listener for background updates
  StorageManager.onSettingsChanged(() => {
    loadSettings();
  });

  // Initial load
  await loadSettings();
});
