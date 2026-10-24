/**
 * MaiTab - Background Service Worker
 * Manages tab creation, tab switching decisions, and inter-script messaging.
 */

try {
  importScripts('../common/domain-matcher.js', '../common/storage.js');
} catch (err) {
  console.error('[MaiTab] Failed to import scripts in service worker:', err);
}

/**
 * Validates target URL scheme to prevent javascript: or unsupported schemes.
 */
function isValidTargetUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') {
    return false;
  }
  try {
    const parsed = new URL(urlString);
    return ['http:', 'https:', 'ftp:', 'file:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Listens for extension installation/updates to initialize default settings.
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  try {
    const settings = await StorageManager.getSettings();
    await StorageManager.saveSettings(settings);
    console.log('[MaiTab] Extension installed/updated with settings:', settings);
  } catch (err) {
    console.error('[MaiTab] Error during onInstalled initialization:', err);
  }
});

/**
 * Handles incoming messages from content scripts, popup, and options pages.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!request || !request.action) {
    return false;
  }

  // Asynchronous message handling
  handleMessage(request, sender)
    .then(sendResponse)
    .catch((err) => {
      console.error('[MaiTab] Error handling message:', err);
      sendResponse({ success: false, error: err.message || String(err) });
    });

  // Keep the message channel open for async response
  return true;
});

/**
 * Dispatches and processes message requests.
 */
async function handleMessage(request, sender) {
  switch (request.action) {
    case 'openTab':
      return handleOpenTab(request, sender);

    case 'getSettings': {
      const settings = await StorageManager.getSettings();
      return { success: true, settings };
    }

    case 'checkSiteStatus': {
      const settings = await StorageManager.getSettings();
      const currentHost = request.currentHost || (sender.tab?.url ? new URL(sender.tab.url).hostname : '');
      const isBypassed = DomainMatcher.isDomainBypassed(currentHost, settings.bypassList);
      const matchedBypassRule = DomainMatcher.getMatchedBypassRule(currentHost, settings.bypassList);
      const isWhitelisted = DomainMatcher.isDomainWhitelisted(currentHost, settings.whitelist);
      const matchedRule = DomainMatcher.getMatchedRule(currentHost, settings.whitelist);
      const willSwitch = DomainMatcher.shouldSwitchTab({
        enabled: settings.enabled,
        autoSwitch: settings.autoSwitch,
        whitelist: settings.whitelist,
        bypassList: settings.bypassList,
        currentHostname: currentHost
      });

      return {
        success: true,
        enabled: settings.enabled,
        autoSwitch: settings.autoSwitch,
        currentHost,
        isBypassed,
        matchedBypassRule,
        isWhitelisted,
        matchedRule,
        willSwitch
      };
    }

    default:
      return { success: false, error: `Unknown action: ${request.action}` };
  }
}

/**
 * Creates a new tab according to user settings and whitelist matching.
 */
async function handleOpenTab(request, sender) {
  const targetUrl = request.url;

  if (!isValidTargetUrl(targetUrl)) {
    return { success: false, error: 'Invalid or unsupported target URL' };
  }

  const settings = await StorageManager.getSettings();

  // If extension is globally disabled, do not create tab via extension
  if (!settings.enabled) {
    return { success: false, disabled: true };
  }

  // Determine current host from content script message or sender tab
  let currentHost = request.currentHost;
  if (!currentHost && sender?.tab?.url) {
    try {
      currentHost = new URL(sender.tab.url).hostname;
    } catch {
      currentHost = '';
    }
  }

  // Complete Bypass List takes absolute priority: do not intercept or create tab
  if (DomainMatcher.isDomainBypassed(currentHost, settings.bypassList)) {
    return { success: false, bypassed: true };
  }

  // Determine if new tab should be active (foreground) or background
  const shouldSwitch = DomainMatcher.shouldSwitchTab({
    enabled: settings.enabled,
    autoSwitch: settings.autoSwitch,
    whitelist: settings.whitelist,
    bypassList: settings.bypassList,
    currentHostname: currentHost
  });

  // Prepare tab creation options
  const createProps = {
    url: targetUrl,
    active: shouldSwitch
  };

  // If sender tab is available, place new tab next to current tab and set openerTabId
  if (sender?.tab) {
    if (settings.openNextToCurrent && typeof sender.tab.index === 'number') {
      createProps.index = sender.tab.index + 1;
    }
    if (typeof sender.tab.id === 'number') {
      createProps.openerTabId = sender.tab.id;
    }
  }

  try {
    const createdTab = await chrome.tabs.create(createProps);
    return {
      success: true,
      tabId: createdTab.id,
      active: shouldSwitch,
      url: targetUrl
    };
  } catch (err) {
    // If opening next to active tab or setting openerTabId failed (e.g. sender tab closed),
    // retry with basic properties
    console.warn('[MaiTab] Tab creation with openerTabId failed, retrying with fallback:', err);
    const fallbackTab = await chrome.tabs.create({
      url: targetUrl,
      active: shouldSwitch
    });
    return {
      success: true,
      tabId: fallbackTab.id,
      active: shouldSwitch,
      url: targetUrl
    };
  }
}
