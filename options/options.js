/**
 * MaiTab - Options Page Script
 * Provides complete multilingual settings configuration, whitelist management,
 * bulk import/export, and an interactive domain match tester.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const optLangSelect = document.getElementById('optLangSelect');
  const optMasterEnabled = document.getElementById('optMasterEnabled');
  const optAutoSwitch = document.getElementById('optAutoSwitch');
  const optOpenNext = document.getElementById('optOpenNext');
  const optWhitelistCount = document.getElementById('optWhitelistCount');
  const optAddDomainForm = document.getElementById('optAddDomainForm');
  const optDomainInput = document.getElementById('optDomainInput');
  const optInputError = document.getElementById('optInputError');
  const optSearchInput = document.getElementById('optSearchInput');
  const optWhitelistTableBody = document.getElementById('optWhitelistTableBody');
  const optEmptyState = document.getElementById('optEmptyState');
  const exportWhitelistBtn = document.getElementById('exportWhitelistBtn');
  const importWhitelistBtn = document.getElementById('importWhitelistBtn');
  const clearWhitelistBtn = document.getElementById('clearWhitelistBtn');
  const resetDefaultsBtn = document.getElementById('resetDefaultsBtn');
  const importFileInput = document.getElementById('importFileInput');
  const toast = document.getElementById('toast');

  // Tester Elements
  const testerInput = document.getElementById('testerInput');
  const testerResult = document.getElementById('testerResult');
  const testerNormalizedHost = document.getElementById('testerNormalizedHost');
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

  function showError(msg) {
    optInputError.textContent = msg;
    optInputError.classList.remove('hidden');
  }

  function hideError() {
    optInputError.textContent = '';
    optInputError.classList.add('hidden');
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
      ? list.filter((domain) => domain.toLowerCase().includes(filter))
      : list;

    optWhitelistTableBody.innerHTML = '';

    if (filtered.length === 0) {
      optEmptyState.classList.remove('hidden');
      return;
    }

    optEmptyState.classList.add('hidden');

    filtered.forEach((domain) => {
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
      tr.appendChild(tdAction);

      optWhitelistTableBody.appendChild(tr);
    });
  }

  /**
   * Updates the interactive domain matching simulation.
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
      testerMatchedBadge.className = 'badge badge-gray';
      testerMatchedBadge.textContent = I18n.t('testerInvalidInput');
      testerBehaviorBadge.className = 'badge badge-gray';
      testerBehaviorBadge.textContent = I18n.t('testerInvalidInput');
      testerExplanation.textContent = I18n.t('testerEnterValidPrompt');
      return;
    }

    const isWhitelisted = DomainMatcher.isDomainWhitelisted(normalized, currentSettings.whitelist);
    const matchingRule = currentSettings.whitelist.find(rule => DomainMatcher.isDomainMatch(normalized, rule));

    if (isWhitelisted) {
      testerMatchedBadge.className = 'badge badge-success';
      testerMatchedBadge.textContent = I18n.t('testerMatchedBadge', matchingRule);
    } else {
      testerMatchedBadge.className = 'badge badge-gray';
      testerMatchedBadge.textContent = I18n.t('testerNotMatchedBadge');
    }

    const willSwitch = DomainMatcher.shouldSwitchTab({
      enabled: currentSettings.enabled,
      autoSwitch: currentSettings.autoSwitch,
      whitelist: currentSettings.whitelist,
      currentHostname: normalized
    });

    if (!currentSettings.enabled) {
      testerBehaviorBadge.className = 'badge badge-gray';
      testerBehaviorBadge.textContent = I18n.t('testerPausedBadge');
      testerExplanation.textContent = I18n.t('testerExplainPaused');
    } else if (willSwitch) {
      testerBehaviorBadge.className = 'badge badge-info';
      testerBehaviorBadge.textContent = I18n.t('testerForegroundBadge');
      if (currentSettings.autoSwitch) {
        testerExplanation.textContent = I18n.t('testerExplainGlobalOn', normalized);
      } else {
        testerExplanation.textContent = I18n.t('testerExplainWhitelisted', normalized, matchingRule);
      }
    } else {
      testerBehaviorBadge.className = 'badge badge-gray';
      testerBehaviorBadge.textContent = I18n.t('testerBackgroundBadge');
      testerExplanation.textContent = I18n.t('testerExplainBackground', normalized);
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

  // Whitelist Add
  optAddDomainForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const domain = optDomainInput.value.trim();
    if (!domain) {
      showError(I18n.t('errEnterDomain'));
      return;
    }

    const normalized = DomainMatcher.normalizeDomain(domain);
    if (!normalized || !DomainMatcher.isValidDomain(normalized)) {
      showError(I18n.t('errInvalidDomain'));
      return;
    }

    if (currentSettings.whitelist.includes(normalized)) {
      showError(I18n.t('errDomainExists', normalized));
      return;
    }

    const result = await StorageManager.addWhitelistDomain(domain);
    if (!result.success) {
      showError(result.error || I18n.t('errInvalidDomain'));
      return;
    }

    optDomainInput.value = '';
    showToast(I18n.t('toastAdded', result.domain));
    await loadSettings();
  });

  // Whitelist Search
  optSearchInput.addEventListener('input', () => {
    renderWhitelist();
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
      version: '1.0',
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

        // Check if JSON
        if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            domainsToAdd = parsed;
          } else if (parsed && Array.isArray(parsed.whitelist)) {
            domainsToAdd = parsed.whitelist;
          }
        } else {
          // Plain text lines
          domainsToAdd = text.split('\n').map(l => l.trim()).filter(Boolean);
        }

        let addedCount = 0;
        for (const item of domainsToAdd) {
          const res = await StorageManager.addWhitelistDomain(String(item));
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

  // Clear Whitelist
  clearWhitelistBtn.addEventListener('click', async () => {
    if (confirm(I18n.t('confirmClear'))) {
      await StorageManager.clearWhitelist();
      showToast(I18n.t('toastCleared'));
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
