/**
 * MaiTab - Centralized Multilingual Localization Module
 * Supports English (en), Chinese Simplified (zh-CN), and Japanese (ja).
 * Provides dynamic runtime language switching without requiring page reload.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.I18n = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SUPPORTED_LANGUAGES = ['en', 'zh-CN', 'ja'];
  const DEFAULT_LANGUAGE = 'en';

  const TRANSLATIONS = {
    en: {
      // General & Brand
      extName: 'MaiTab - Open Links in New Tabs',
      extDesc: 'Opens links in new tabs on left-click without interrupting your session, with automatic switching toggle and domain whitelist overrides.',
      defaultTitle: 'MaiTab',
      brandVersion: 'v1.5',
      masterToggleTitle: 'Enable or disable MaiTab link interception',
      themeToggleTitle: 'Toggle Light / Dark mode',
      themeLight: 'Light Mode',
      themeDark: 'Dark Mode',
      themeSystem: 'System',
      themeSwitchToLight: 'Switch to Light Mode',
      themeSwitchToDark: 'Switch to Dark Mode',
      themeSystemTitle: 'System Theme ({0})',
      themeSettingLabel: 'Theme Appearance',
      themeSettingDesc: 'Choose between System automatic theme, Light Mode, or Dark Mode.',
      btnCheckUpdate: 'Check',
      checkUpdateTitle: 'Check remote GitHub repository for new commits and updates',
      badgeCheckingUpdates: 'Checking',
      badgeUpToDate: 'Up to Date',
      badgeUpdateAvailable: 'Update Available',
      badgeUpdateFailed: 'Update Failed',
      badgeSynchronizing: 'Synchronizing',
      statusChecking: 'Checking GitHub repository for latest commits...',
      statusUpToDate: 'Local project is up to date with remote repository.',
      statusUpdateAvailable: '{0} new commit(s) available on GitHub.',
      statusUpdateFailed: 'Update check or synchronization failed.',
      statusSynchronizing: 'Synchronizing latest changes from GitHub...',
      statusSyncSuccess: 'Successfully synchronized with remote repository.',
      btnSyncNow: 'Update & Sync',
      btnSyncRetry: 'Retry',
      syncIncomingCommits: 'Latest incoming commit(s):',
      statusConflictDetected: 'Conflict detected during synchronization. Local modifications remain safely stashed.',
      dismissSync: 'Dismiss',
      language: 'Language',
      optionsLink: 'Options ↗',
      advancedSettings: 'Advanced Settings',
      footerHint: 'Left-click links open in new tabs',
      resetToDefaults: 'Reset to Defaults',

      // Disabled State
      disabledBanner: 'Extension is currently paused. Links will behave normally.',

      // Current Site Card
      currentWebsite: 'Current Website',
      internalPage: 'Internal / Special Page',
      badgeChecking: 'Checking...',
      badgeInactive: 'Inactive',
      badgePaused: 'Paused',
      badgeBypassed: 'Bypassed (Silent)',
      badgeForeground: 'Foreground',
      badgeForegroundWhitelisted: 'Foreground (Whitelisted)',
      badgeBackgroundWhitelisted: 'Background (Whitelisted)',
      badgeBackground: 'Background',
      btnWhitelist: '+ Whitelist',
      btnWhitelisted: '✓ Whitelisted',
      btnBypass: '+ Bypass',
      btnBypassed: '✓ Bypassed',
      titleWhitelistCurrent: 'Click to force foreground tabs for this website',
      titleRemoveCurrent: 'Click to remove this site from whitelist',
      titleBypassCurrent: 'Click to completely bypass MaiTab on this website',
      titleRemoveBypassCurrent: 'Click to remove this site from Complete Bypass List',
      hintInternal: 'MaiTab does not run on browser internal or extension pages.',
      hintPaused: 'Extension is disabled. Normal browser navigation occurs.',
      hintBypassed: 'MaiTab is completely inactive on this site. Native browser link behavior is preserved.',
      hintForegroundGlobal: 'Will switch to new tab (Global switch toggle is ON).',
      hintForegroundWhitelisted: 'Will switch to new tab because this website is in your whitelist with focus enabled.',
      hintBackgroundWhitelisted: 'Will open in background tab because this website is in your whitelist with focus disabled.',
      hintBackground: 'Will open in background tab, preserving your current page.',

      // Global Tab Switching Toggle
      autoSwitchTitle: 'Switch to New Tab Automatically',
      autoSwitchDescOn: 'Links on ALL websites switch to the newly opened tab immediately.',
      autoSwitchDescOff: 'Links open in background tabs, preserving your reading session without interruption.',
      calloutGlobalOn: '<strong>Global Switch ON:</strong> Left-clicking a link opens a new tab and focuses it immediately.',
      calloutGlobalOff: '<strong>Global Switch OFF:</strong> Links open in background tabs (whitelisted websites switch to foreground).',

      // List Tabs
      tabWhitelist: 'Whitelist',
      tabBypass: 'Complete Bypass',

      // Whitelist Section
      whitelistTitle: 'Automatic Switching Whitelist',
      whitelistDesc: 'Websites with independent focus preferences that override the global focus toggle. Subdomains are automatically included.',
      inputPlaceholderDomain: 'e.g. github.com or news.ycombinator.com',
      btnAdd: 'Add',
      btnAddWebsite: 'Add Website',
      subdomainsTag: '+subdomains',
      emptyWhitelistTitle: 'No whitelisted domains yet.',
      emptyWhitelistDesc: 'Add websites from the Current Website section above to customize their automatic tab focus behavior.',
      removeAria: 'Remove {0} from whitelist',
      filterPlaceholder: 'Filter whitelist domains...',
      whitelistFocusOn: 'Focus',
      whitelistFocusOff: 'Background',
      thFocusOption: 'Auto-Focus Tab',
      focusToggleAria: 'Toggle auto-focus for {0}',
      toastFocusUpdated: 'Updated focus preference for "{0}": {1}',
      focusOptionForeground: 'Focus: Foreground (Active)',
      focusOptionBackground: 'Focus: Background',
      focusOptionForegroundShort: 'Foreground',
      focusOptionBackgroundShort: 'Background',
      currentSiteFocusLabel: 'Focus Mode:',
      focusModeFocused: 'Focused Mode',
      focusModeBackground: 'Background Mode',
      testerExplainWhitelistedFocusOn: 'Links from "{0}" will open and immediately receive focus because whitelist rule "{1}" has auto-focus enabled (overrides global toggle).',
      testerExplainWhitelistedFocusOff: 'Links from "{0}" will open in a new background tab without switching away because whitelist rule "{1}" has auto-focus disabled (overrides global toggle).',
      docPrecedenceTitle: 'Setting Precedence & Independence:',
      docPrecedenceDesc: '<strong>Precedence:</strong> Per-website focus options in the whitelist strictly override the Global Focus Toggle. If a website is whitelisted with focus disabled, links will always open in the background even if Global Focus is enabled. If a website is whitelisted with focus enabled, links will always receive focus even if Global Focus is disabled. For non-whitelisted websites, the Global Focus Toggle applies.',

      // Complete Bypass Section
      bypassTitle: 'Complete Bypass List (Silent List)',
      bypassDesc: 'Websites where MaiTab is completely inactive. Link clicking and tab handling follow native browser behavior. Overrides all other settings.',
      inputPlaceholderBypass: 'e.g. google.com or internal.corp',
      btnAddBypass: 'Add',
      btnAddBypassWebsite: 'Add to Bypass List',
      emptyBypassTitle: 'No bypassed websites yet.',
      emptyBypassDesc: 'Add domains above to completely disable MaiTab on them.',
      removeBypassAria: 'Remove {0} from Complete Bypass List',
      filterBypassPlaceholder: 'Filter bypass domains...',
      optBypassHeading: 'Complete Bypass List (Silent List)',
      optBypassSubheading: 'Websites listed here will be <strong>completely bypassed</strong> by MaiTab. All link clicks and page interactions behave natively as if the extension were not installed. <strong>Takes highest precedence over all whitelist rules and the global toggle.</strong> Subdomains are automatically included.',
      domainBypassCountBadge: '{0} domain{1}',
      optEmptyBypassTitle: 'No bypassed websites found.',
      optEmptyBypassDesc: 'Add domains above to completely bypass MaiTab on them.',
      thBypassStatus: 'Extension Status',
      statusBypassed: 'Completely Inactive (Native)',
      btnExportBypass: 'Export',
      btnImportBypass: 'Import',
      btnClearBypass: 'Clear All',
      toastBypassAdded: 'Added "{0}" to Complete Bypass List',
      toastBypassRemoved: 'Removed "{0}" from Complete Bypass List',
      toastBypassCleared: 'All bypassed domains cleared',
      toastBypassExported: 'Complete Bypass List exported successfully',
      toastBypassImported: 'Imported {0} bypass domain{1}',
      confirmClearBypass: 'Are you sure you want to clear all websites from the Complete Bypass List?',
      errBypassDomainExists: '"{0}" is already in your Complete Bypass List.',
      testerBypassBadge: 'Bypassed (Matched: {0})',
      testerNativeBadge: 'Native Chrome Navigation',
      testerExplainBypassed: 'Links from "{0}" will follow native browser behavior without any interference from MaiTab because it matches Complete Bypass rule "{1}". This strictly overrides the whitelist and global focus settings.',
      docBypassTitle: 'Complete Bypass List (Silent List):',
      docBypassDesc: '<strong>Highest Priority:</strong> If a website matches an entry in the Complete Bypass List, MaiTab is completely inactive. Link clicks, tab opening, and interactive elements follow native browser and website behavior. Event listeners are detached on bypassed sites to prevent any interference. This list strictly overrides all whitelist rules and the Global Focus Toggle.',

      // Options Page - General Preferences
      optTitle: 'MaiTab Settings',
      optSubtitle: 'Configure link opening and tab switching behaviors',
      generalPreferences: 'General Preferences',
      optEnableLabel: 'Enable MaiTab',
      optEnableDesc: 'When enabled, left-clicking webpage links will open them in new tabs instead of navigating the current tab.',
      optGlobalSwitchLabel: 'Global Tab Switching',
      optGlobalSwitchDesc: 'Controls whether Chrome automatically focuses newly opened tabs.',
      optBulletOn: '<strong>Enabled:</strong> Clicking any link opens in a new tab and immediately switches focus to it.',
      optBulletOff: '<strong>Disabled (Default):</strong> Links open in background tabs so you can continue reading without interruption (unless whitelisted).',
      optOpenNextLabel: 'Open Next to Current Tab',
      optOpenNextDesc: "Position newly opened tabs immediately to the right of your current tab, mimicking Chrome's native middle-click behavior.",
      optThemeLabel: 'Interface Theme',
      optThemeDesc: 'Select your preferred visual appearance (macOS Dark Aqua or Light Aqua).',

      // Options Page - Whitelist Management
      optWhitelistHeading: 'Website Switching Whitelist',
      optWhitelistSubheading: 'Websites listed here will <strong>always switch focus</strong> to the new tab, even when Global Tab Switching is turned off. Subdomains are automatically included.',
      domainCountBadge: '{0} domain{1}',
      btnExport: 'Export',
      btnImport: 'Import',
      btnClearAll: 'Clear All',
      thDomainPattern: 'Domain Pattern',
      thMatchingScope: 'Matching Scope',
      thAction: 'Action',
      scopeDescription: 'Matches {0} and *.{0}',
      optEmptyStateTitle: 'No whitelisted websites found.',
      optEmptyStateDesc: 'Add domains above to force automatic tab switching for them.',

      // Interactive Tester
      testerTitle: 'Interactive Domain Match Tester',
      testerSubtitle: 'Test any URL or domain against your current whitelist and settings to verify whether links will open in the foreground or background.',
      testerPlaceholder: 'Type a URL or domain to test, e.g. https://gist.github.com/my-gist',
      testerNormalizedHost: 'Normalized Hostname:',
      testerWhitelistMatch: 'Whitelist Match:',
      testerResultingBehavior: 'Resulting Tab Behavior:',
      testerInvalidInput: 'Invalid Input',
      testerEnterValidPrompt: 'Please enter a valid URL or hostname to test.',
      testerMatchedBadge: 'Whitelisted (Matched: {0})',
      testerNotMatchedBadge: 'Not Whitelisted',
      testerForegroundBadge: 'Foreground Tab (Active)',
      testerBackgroundBadge: 'Background Tab',
      testerPausedBadge: 'Extension Paused',
      testerExplainPaused: 'The extension is currently turned off. Standard browser link navigation will occur.',
      testerExplainGlobalOn: 'Links from "{0}" will open and immediately focus the new tab because Global Tab Switching is ON.',
      testerExplainWhitelisted: 'Links from "{0}" will open and focus the new tab because it matches whitelist rule "{1}", overriding the global switch off setting.',
      testerExplainBackground: 'Links from "{0}" will open in a new background tab without interrupting your current reading session (Global switch is OFF and site is not whitelisted).',

      // Technical Documentation Section
      docHeading: 'How Domain Matching & Interception Works',
      docDomainRulesTitle: 'Domain Matching Rules:',
      docRuleExact: '<strong>Exact Match:</strong> <code>example.com</code> matches visits on <code>example.com</code>.',
      docRuleSubdomains: '<strong>Subdomain Matching:</strong> <code>example.com</code> also automatically matches <code>news.example.com</code>, <code>blog.example.com</code>, and any deep subdomains.',
      docRuleSafety: '<strong>Protection Against False Positives:</strong> <code>example.com</code> will <em>never</em> match <code>fakeexample.com</code> or <code>example.com.phishing.org</code>.',
      docLinkSafetyTitle: 'Link Click Safety:',
      docSafetyModifiers: '<strong>Modifier Keys:</strong> Standard browser shortcuts (Ctrl+Click, Shift+Click, Alt+Click, Cmd+Click) are preserved without interference.',
      docSafetyClicks: '<strong>Right & Middle Clicks:</strong> Only standard left-clicks are handled. Context menus and middle-clicks are left to the browser.',
      docSafetyHash: '<strong>In-page Anchors:</strong> Same-page fragment links (e.g. <code>#comments</code>, <code>#section2</code>) scroll smoothly and do not open blank tabs.',
      docSafetyControls: '<strong>Interactive Elements:</strong> Buttons, dropdown menus, text inputs, text selections, and <code>download</code> links continue functioning normally.',

      // Errors & Validation
      errEnterDomain: 'Please enter a domain or URL.',
      errInvalidDomain: 'Invalid domain format. Enter a valid domain such as "example.com" or "sub.domain.org".',
      errDomainExists: '"{0}" is already in your whitelist.',
      errFileParse: 'Failed to parse import file: {0}',

      // Toasts & Confirmations
      toastAdded: 'Added "{0}" to whitelist',
      toastRemoved: 'Removed "{0}" from whitelist',
      toastCleared: 'All whitelisted domains cleared',
      toastReset: 'Reset all settings to defaults',
      toastExported: 'Whitelist exported successfully',
      toastImported: 'Imported {0} domain{1}',
      toastEnabled: 'MaiTab enabled',
      toastPaused: 'MaiTab paused',
      toastGlobalOn: 'Global tab switching turned ON',
      toastGlobalOff: 'Global tab switching turned OFF',
      toastOpenNextOn: 'Opening tabs next to current tab',
      toastOpenNextOff: 'Opening tabs at end of strip',
      confirmClear: 'Are you sure you want to clear all whitelisted websites?',
      confirmReset: 'Reset all MaiTab settings and whitelist to defaults?'
    },

    'zh-CN': {
      // General & Brand
      extName: 'MaiTab - 在新标签页打开链接',
      extDesc: '左键点击链接时在新标签页打开，不打断当前浏览会话；支持自动切换开关与网站白名单覆盖。',
      defaultTitle: 'MaiTab',
      brandVersion: 'v1.5',
      masterToggleTitle: '启用或暂停 MaiTab 链接拦截',
      themeToggleTitle: '切换明亮 / 暗色模式',
      themeLight: '明亮模式',
      themeDark: '暗色模式',
      themeSystem: '跟随系统',
      themeSwitchToLight: '切换为明亮模式',
      themeSwitchToDark: '切换为暗色模式',
      themeSystemTitle: '系统主题（{0}）',
      themeSettingLabel: '界面外观主题',
      themeSettingDesc: '在跟随系统自动切换、浅色模式与暗色模式之间选择。',
      btnCheckUpdate: '检查',
      checkUpdateTitle: '检查远程 GitHub 仓库是否有最新提交和更新',
      badgeCheckingUpdates: '检查中',
      badgeUpToDate: '已是最新',
      badgeUpdateAvailable: '有可用更新',
      badgeUpdateFailed: '更新失败',
      badgeSynchronizing: '同步中',
      statusChecking: '正在检查 GitHub 仓库最新提交...',
      statusUpToDate: '本地项目与远程仓库已保持同步，当前已是最新版本。',
      statusUpdateAvailable: 'GitHub 仓库有 {0} 个新提交可用。',
      statusUpdateFailed: '检查更新或同步失败。',
      statusSynchronizing: '正在从 GitHub 同步最新更改...',
      statusSyncSuccess: '已成功与远程仓库同步最新更改。',
      btnSyncNow: '立即更新',
      btnSyncRetry: '重试',
      syncIncomingCommits: '最新提交变更：',
      statusConflictDetected: '同步时检测到冲突。本地更改已安全暂存。',
      dismissSync: '关闭',
      language: '语言',
      optionsLink: '设置 ↗',
      advancedSettings: '高级设置',
      footerHint: '左键点击链接在新标签页打开',
      resetToDefaults: '恢复默认设置',

      // Disabled State
      disabledBanner: '扩展目前已暂停，链接将按浏览器默认方式打开。',

      // Current Site Card
      currentWebsite: '当前网站',
      internalPage: '浏览器内置 / 特殊页面',
      badgeChecking: '检查中...',
      badgeInactive: '未生效',
      badgePaused: '已暂停',
      badgeBypassed: '已跳过 (静默)',
      badgeForeground: '前台切换',
      badgeForegroundWhitelisted: '前台切换 (白名单)',
      badgeBackgroundWhitelisted: '后台打开 (白名单)',
      badgeBackground: '后台打开',
      btnWhitelist: '+ 白名单',
      btnWhitelisted: '✓ 已在白名单',
      btnBypass: '+ 跳过',
      btnBypassed: '✓ 已跳过',
      titleWhitelistCurrent: '点击将当前网站加入白名单，强制前台打开',
      titleRemoveCurrent: '点击将当前网站从白名单移除',
      titleBypassCurrent: '点击在此网站上完全停用 MaiTab',
      titleRemoveBypassCurrent: '点击将当前网站从完整跳过列表中移除',
      hintInternal: 'MaiTab 不会在浏览器内置页面或扩展管理页面中运行。',
      hintPaused: '扩展已暂停，点击链接将按浏览器默认方式导航。',
      hintBypassed: 'MaiTab 在此网站上完全停用，所有链接保持浏览器原生行为。',
      hintForegroundGlobal: '将自动切换至新标签页（全局自动切换已开启）。',
      hintForegroundWhitelisted: '将自动切换至新标签页，因为当前网站已列入白名单且开启了焦点。',
      hintBackgroundWhitelisted: '将在后台静默打开，因为当前网站已列入白名单且关闭了自动焦点。',
      hintBackground: '将在后台静默打开新标签页，保持当前页面阅读不被打断。',

      // Global Tab Switching Toggle
      autoSwitchTitle: '自动切换至新标签页',
      autoSwitchDescOn: '开启时，点击所有网站的链接都会在新标签页打开并立即切换焦点。',
      autoSwitchDescOff: '关闭时，链接将在后台静默打开，保持当前页面阅读不被打断。',
      calloutGlobalOn: '<strong>全局切换开启：</strong>左键点击链接将在新标签页打开并立即获得焦点。',
      calloutGlobalOff: '<strong>全局切换关闭：</strong>链接在后台打开（白名单网站仍将自动切换到前台）。',

      // List Tabs
      tabWhitelist: '白名单',
      tabBypass: '完整跳过',

      // Whitelist Section
      whitelistTitle: '自动切换白名单',
      whitelistDesc: '在此为各个网站配置独立的焦点设置，优先于全局焦点开关。自动包含子域名。',
      inputPlaceholderDomain: '例如 github.com 或 news.ycombinator.com',
      btnAdd: '添加',
      btnAddWebsite: '添加网站',
      subdomainsTag: '+子域名',
      emptyWhitelistTitle: '暂无白名单网站',
      emptyWhitelistDesc: '在上方“当前网站”卡片中添加，即可自定义其新标签页焦点行为。',
      removeAria: '从白名单移除 {0}',
      filterPlaceholder: '搜索过滤白名单域名...',
      whitelistFocusOn: '聚焦',
      whitelistFocusOff: '后台',
      thFocusOption: '自动聚焦选项',
      focusToggleAria: '切换 {0} 的自动聚焦设置',
      toastFocusUpdated: '已更新 "{0}" 的焦点偏好：{1}',
      focusOptionForeground: '焦点：前台切换 (获取焦点)',
      focusOptionBackground: '焦点：后台打开 (静默)',
      focusOptionForegroundShort: '前台 (开启焦点)',
      focusOptionBackgroundShort: '后台 (关闭焦点)',
      currentSiteFocusLabel: '焦点模式：',
      focusModeFocused: '聚焦模式',
      focusModeBackground: '后台模式',
      testerExplainWhitelistedFocusOn: '来自 "{0}" 的链接将打开并立即获得焦点，因为白名单规则 "{1}" 已开启自动聚焦（优先于全局开关）。',
      testerExplainWhitelistedFocusOff: '来自 "{0}" 的链接将在后台打开且不离开当前页面，因为白名单规则 "{1}" 已关闭自动聚焦（优先于全局开关）。',
      docPrecedenceTitle: '设置优先级与独立性：',
      docPrecedenceDesc: '<strong>优先级规则：</strong>白名单中的单网站焦点选项严格优先于全局焦点开关。若某网站在白名单中关闭了自动聚焦，即使全局焦点已开启，其链接仍会在后台打开；若某网站在白名单中开启了自动聚焦，即使全局焦点已关闭，其链接仍会立即获得焦点。对于未在白名单中的网站，则遵从全局焦点开关设置。',

      // Complete Bypass Section
      bypassTitle: '完整跳过列表 (静默列表)',
      bypassDesc: 'MaiTab 在这些网站上完全停用，链接与标签行为保持浏览器原生状态。优先于所有其他设置。',
      inputPlaceholderBypass: '例如 google.com 或 internal.corp',
      btnAddBypass: '添加',
      btnAddBypassWebsite: '添加至跳过列表',
      emptyBypassTitle: '暂无完整跳过网站',
      emptyBypassDesc: '在上方添加域名即可在此类网站上完全停用 MaiTab。',
      removeBypassAria: '从完整跳过列表移除 {0}',
      filterBypassPlaceholder: '搜索过滤跳过域名...',
      optBypassHeading: '完整跳过列表 (静默列表)',
      optBypassSubheading: '此处列出的网站将<strong>完全跳过</strong> MaiTab。所有链接点击与页面交互均遵循浏览器原生行为，如同未安装扩展。<strong>最高优先级，严格优先于白名单与全局开关。</strong>自动匹配所有子域名。',
      domainBypassCountBadge: '{0} 个域名',
      optEmptyBypassTitle: '未找到跳过网站',
      optEmptyBypassDesc: '在上方添加域名，即可在访问此类网站时完全停用 MaiTab。',
      thBypassStatus: '扩展状态',
      statusBypassed: '完全停用 (原生)',
      btnExportBypass: '导出',
      btnImportBypass: '导入',
      btnClearBypass: '清空全部',
      toastBypassAdded: '已将 "{0}" 添加至完整跳过列表',
      toastBypassRemoved: '已将 "{0}" 从完整跳过列表移除',
      toastBypassCleared: '已清空所有跳过域名',
      toastBypassExported: '完整跳过列表已成功导出',
      toastBypassImported: '成功导入 {0} 个跳过域名',
      confirmClearBypass: '确定要清空完整跳过列表中的所有网站吗？',
      errBypassDomainExists: '"{0}" 已在您的完整跳过列表中。',
      testerBypassBadge: '已跳过 (匹配规则: {0})',
      testerNativeBadge: '浏览器原生导航',
      testerExplainBypassed: '来自 "{0}" 的链接将按浏览器原生方式打开，完全不受 MaiTab 干预，因为命中了完整跳过规则 "{1}"。此规则严格优先于白名单与全局自动切换设置。',
      docBypassTitle: '完整跳过列表 (静默列表)：',
      docBypassDesc: '<strong>最高优先级：</strong>若网站命中完整跳过列表，MaiTab 完全不介入。链接点击、标签打开与交互元素均遵循浏览器与网站原生行为。在跳过网站上解绑事件监听，确保零干扰。本列表严格优先于所有白名单规则与全局自动切换开关。',

      // Options Page - General Preferences
      optTitle: 'MaiTab 设置',
      optSubtitle: '配置链接打开与标签页焦点切换行为',
      generalPreferences: '通用偏好设置',
      optEnableLabel: '启用 MaiTab',
      optEnableDesc: '启用后，左键点击网页链接将在新标签页中打开，而不是离开当前页面。',
      optGlobalSwitchLabel: '全局自动切换标签页',
      optGlobalSwitchDesc: '控制 Chrome 是否在打开新标签页时自动将焦点切换至该标签页。',
      optBulletOn: '<strong>已开启：</strong>点击任何链接都会在新标签页打开并立即切换焦点。',
      optBulletOff: '<strong>已关闭（默认）：</strong>链接在后台标签页打开，不会中断当前的阅读会话（白名单网站除外）。',
      optOpenNextLabel: '在当前标签页右侧打开',
      optOpenNextDesc: '将新打开的标签页放置在当前标签页右侧，还原 Chrome 原生中键点击行为。',
      optThemeLabel: '界面外观主题',
      optThemeDesc: '选择您偏好的视觉外观（macOS 深色 Aqua 或浅色 Aqua）。',

      // Options Page - Whitelist Management
      optWhitelistHeading: '网站自动切换白名单',
      optWhitelistSubheading: '此处列出的网站在点击链接时将<strong>始终自动切换焦点</strong>至新标签页（即使全局自动切换已关闭）。自动匹配所有子域名。',
      domainCountBadge: '{0} 个域名',
      btnExport: '导出',
      btnImport: '导入',
      btnClearAll: '清空全部',
      thDomainPattern: '域名规则',
      thMatchingScope: '匹配范围',
      thAction: '操作',
      scopeDescription: '匹配 {0} 及其所有子域名 (*.{0})',
      optEmptyStateTitle: '未找到白名单网站',
      optEmptyStateDesc: '在上方添加域名，即可在点击其链接时始终自动切换到新标签页。',

      // Interactive Tester
      testerTitle: '交互式域名匹配测试器',
      testerSubtitle: '输入任意网址或域名，即可模拟当前白名单与全局设置下的标签页打开与切换效果。',
      testerPlaceholder: '输入要测试的网址或域名，例如 https://gist.github.com/my-gist',
      testerNormalizedHost: '标准化主机名：',
      testerWhitelistMatch: '白名单匹配状态：',
      testerResultingBehavior: '最终标签页行为：',
      testerInvalidInput: '无效输入',
      testerEnterValidPrompt: '请输入有效的网址或主机名进行测试。',
      testerMatchedBadge: '已命中白名单 (匹配规则: {0})',
      testerNotMatchedBadge: '未在白名单中',
      testerForegroundBadge: '前台标签页（自动切换）',
      testerBackgroundBadge: '后台标签页（静默打开）',
      testerPausedBadge: '扩展已暂停',
      testerExplainPaused: '扩展目前已暂停。点击链接将按浏览器默认方式打开。',
      testerExplainGlobalOn: '来自 "{0}" 的链接将打开并立即聚焦新标签页，因为全局自动切换已开启。',
      testerExplainWhitelisted: '来自 "{0}" 的链接将打开并聚焦新标签页，因为命中了白名单规则 "{1}"，覆盖了全局关闭设置。',
      testerExplainBackground: '来自 "{0}" 的链接将在后台打开，不打扰当前阅读（全局切换关闭且该网站未列入白名单）。',

      // Technical Documentation Section
      docHeading: '域名匹配与链接拦截原理',
      docDomainRulesTitle: '域名匹配规则：',
      docRuleExact: '<strong>完全匹配：</strong><code>example.com</code> 精确匹配访问 <code>example.com</code>。',
      docRuleSubdomains: '<strong>子域名匹配：</strong><code>example.com</code> 还会自动匹配 <code>news.example.com</code>、<code>blog.example.com</code> 等任意级子域名。',
      docRuleSafety: '<strong>防止误匹配：</strong><code>example.com</code> 绝不会误匹配 <code>fakeexample.com</code> 或 <code>example.com.phishing.org</code>。',
      docLinkSafetyTitle: '链接点击安全保障：',
      docSafetyModifiers: '<strong>修饰键支持：</strong>完美保留原生快捷键（Ctrl+点击、Shift+点击、Alt+点击、Cmd+点击），不受干扰。',
      docSafetyClicks: '<strong>右键与中键：</strong>仅拦截常规左键点击。右键菜单与原生中键功能完全保留。',
      docSafetyHash: '<strong>页内锚点：</strong>同页锚点跳转（如 <code>#comments</code>）正常平滑滚动，不打开多余标签页。',
      docSafetyControls: '<strong>交互式控件：</strong>按钮、输入框、下拉框、文本选中文本及 <code>download</code> 下载链接均正常运作。',

      // Errors & Validation
      errEnterDomain: '请输入域名或网址。',
      errInvalidDomain: '域名格式无效。请输入有效域名，如 "example.com" 或 "sub.domain.org"。',
      errDomainExists: '"{0}" 已在您的白名单中。',
      errFileParse: '解析导入文件失败：{0}',

      // Toasts & Confirmations
      toastAdded: '已将 "{0}" 添加至白名单',
      toastRemoved: '已将 "{0}" 从白名单移除',
      toastCleared: '已清空所有白名单域名',
      toastReset: '已恢复所有设置至默认值',
      toastExported: '白名单已成功导出',
      toastImported: '成功导入 {0} 个域名',
      toastEnabled: 'MaiTab 已启用',
      toastPaused: 'MaiTab 已暂停',
      toastGlobalOn: '全局自动切换已开启',
      toastGlobalOff: '全局自动切换已关闭',
      toastOpenNextOn: '新标签页将在当前标签页右侧打开',
      toastOpenNextOff: '新标签页将在标签栏末尾打开',
      confirmClear: '确定要清空所有白名单网站吗？',
      confirmReset: '确定要将所有 MaiTab 设置和白名单重置为默认值吗？'
    },

    ja: {
      // General & Brand
      extName: 'MaiTab - リンクを新しいタブで開く',
      extDesc: '左クリックしたリンクを現在の閲覧を妨げずに新しいタブで開き、自動タブ切り替えとドメインホワイトリスト機能を提供します。',
      defaultTitle: 'MaiTab',
      brandVersion: 'v1.5',
      masterToggleTitle: 'MaiTabのリンク捕捉を有効化/一時停止',
      themeToggleTitle: 'ライト / ダークモードの切り替え',
      themeLight: 'ライトモード',
      themeDark: 'ダークモード',
      themeSystem: 'システム',
      themeSwitchToLight: 'ライトモードに切り替え',
      themeSwitchToDark: 'ダークモードに切り替え',
      themeSystemTitle: 'システムテーマ（{0}）',
      themeSettingLabel: '外観テーマ',
      themeSettingDesc: 'システム自動追従、ライトモード、ダークモードから選択します。',
      btnCheckUpdate: '確認',
      checkUpdateTitle: 'GitHub リポジトリの最新コミットと更新を確認',
      badgeCheckingUpdates: '確認中',
      badgeUpToDate: '最新です',
      badgeUpdateAvailable: '更新あり',
      badgeUpdateFailed: '更新失敗',
      badgeSynchronizing: '同期中',
      statusChecking: 'GitHub リポジトリの最新更新を確認しています...',
      statusUpToDate: 'ローカルプロジェクトはリモートリポジトリと同期しており、最新です。',
      statusUpdateAvailable: 'GitHub に {0} 件の新しいコミットがあります。',
      statusUpdateFailed: '更新確認または同期に失敗しました。',
      statusSynchronizing: 'GitHub から最新の変更を同期中...',
      statusSyncSuccess: 'リモートリポジトリとの同期が完了しました。',
      btnSyncNow: '今すぐ更新',
      btnSyncRetry: '再試行',
      syncIncomingCommits: '最新のコミット:',
      statusConflictDetected: '同期中に競合が検出されました。ローカルの変更は安全に退避されました。',
      dismissSync: '閉じる',
      language: '言語',
      optionsLink: '設定 ↗',
      advancedSettings: '高度な設定',
      footerHint: '左クリックでリンクを新規タブで開く',
      resetToDefaults: 'デフォルトに戻す',

      // Disabled State
      disabledBanner: '拡張機能は現在一時停止中です。リンクは通常どおり開きます。',

      // Current Site Card
      currentWebsite: '現在のウェブサイト',
      internalPage: 'ブラウザ内蔵 / 特殊ページ',
      badgeChecking: '確認中...',
      badgeInactive: '無効',
      badgePaused: '一時停止',
      badgeBypassed: 'バイパス (無効化)',
      badgeForeground: 'フォアグラウンド',
      badgeForegroundWhitelisted: 'フォアグラウンド (登録済み)',
      badgeBackgroundWhitelisted: 'バックグラウンド (登録済み)',
      badgeBackground: 'バックグラウンド',
      btnWhitelist: '+ ホワイトリスト',
      btnWhitelisted: '✓ 登録済み',
      btnBypass: '+ バイパス',
      btnBypassed: '✓ バイパス中',
      titleWhitelistCurrent: 'このサイトをホワイトリストに追加し、フォアグラウンドで開く',
      titleRemoveCurrent: 'このサイトをホワイトリストから削除する',
      titleBypassCurrent: 'クリックしてこのサイトでMaiTabを完全に無効化',
      titleRemoveBypassCurrent: 'クリックしてこのサイトを完全バイパスリストから削除',
      hintInternal: 'MaiTabはブラウザの内蔵ページや拡張機能ページでは動作しません。',
      hintPaused: '拡張機能が無効です。通常のリンク遷移が行われます。',
      hintBypassed: 'このサイトではMaiTabは完全に動作しません。通常のリンク動作を維持します。',
      hintForegroundGlobal: '新しいタブに自動で切り替わります（全体自動切り替えON）。',
      hintForegroundWhitelisted: 'ホワイトリストでフォーカス有効に設定されているため、新しいタブに自動で切り替わります。',
      hintBackgroundWhitelisted: 'ホワイトリストでフォーカス無効に設定されているため、バックグラウンドの新規タブで開きます。',
      hintBackground: '現在の閲覧を妨げず、バックグラウンドの新規タブで開きます。',

      // Global Tab Switching Toggle
      autoSwitchTitle: '新しいタブに自動で切り替える',
      autoSwitchDescOn: 'すべてのウェブサイトでリンクが新しいタブで開き、直ちにタブがフォーカスされます。',
      autoSwitchDescOff: 'リンクはバックグラウンドで開かれ、現在の閲覧セッションが中断されません。',
      calloutGlobalOn: '<strong>全体切り替えON：</strong>リンクをクリックすると新しいタブが開き、直ちにフォーカスされます。',
      calloutGlobalOff: '<strong>全体切り替えOFF：</strong>リンクはバックグラウンドで開きます（ホワイトリスト登録サイトはフォアグラウンドに切り替わります）。',

      // List Tabs
      tabWhitelist: 'ホワイトリスト',
      tabBypass: '完全バイパス',

      // Whitelist Section
      whitelistTitle: '自動切り替えホワイトリスト',
      whitelistDesc: 'ウェブサイトごとにフォーカス動作を個別設定し、全体設定を上書きします（サブドメイン自動対象）。',
      inputPlaceholderDomain: '例: github.com や news.ycombinator.com',
      btnAdd: '追加',
      btnAddWebsite: 'ウェブサイトを追加',
      subdomainsTag: '+サブドメイン',
      emptyWhitelistTitle: 'ホワイトリスト登録がありません',
      emptyWhitelistDesc: '上部の「現在のウェブサイト」セクションから追加すると、新規タブのフォーカス動作を個別に設定できます。',
      removeAria: '{0} をホワイトリストから削除',
      filterPlaceholder: 'ホワイトリストを検索...',
      whitelistFocusOn: 'フォーカス',
      whitelistFocusOff: '背景',
      thFocusOption: '自動フォーカス設定',
      focusToggleAria: '{0} の自動フォーカスを切り替え',
      toastFocusUpdated: '「{0}」のフォーカス設定を更新しました: {1}',
      focusOptionForeground: 'フォーカス: フォアグラウンド (アクティブ)',
      focusOptionBackground: 'フォーカス: バックグラウンド',
      focusOptionForegroundShort: 'フォアグラウンド',
      focusOptionBackgroundShort: 'バックグラウンド',
      currentSiteFocusLabel: 'フォーカス設定：',
      focusModeFocused: 'フォーカスモード',
      focusModeBackground: 'バックグラウンドモード',
      testerExplainWhitelistedFocusOn: '「{0}」からのリンクはホワイトリスト規則「{1}」で自動フォーカスが有効なため、直ちにフォーカスを受け取ります（全体設定より優先）。',
      testerExplainWhitelistedFocusOff: '「{0}」からのリンクはホワイトリスト規則「{1}」で自動フォーカスが無効なため、バックグラウンドで開きます（全体設定より優先）。',
      docPrecedenceTitle: '設定の優先順位と独立性:',
      docPrecedenceDesc: '<strong>優先順位ルール:</strong> ホワイトリストのサイト別フォーカス設定は、グローバルフォーカス設定より厳格に優先されます。ホワイトリストでフォーカス無効に設定されたサイトは、全体フォーカスがONの場合でも必ずバックグラウンドで開きます。フォーカス有効に設定されたサイトは、全体設定がOFFの場合でも必ず新しいタブに切り替わります。ホワイトリスト未登録のサイトにはグローバルフォーカス設定が適用されます。',

      // Complete Bypass Section
      bypassTitle: '完全バイパスリスト (サイレントリスト)',
      bypassDesc: 'MaiTabが完全に無効化されるウェブサイトです。リンククリックやタブ動作は通常のブラウザ挙動に従い、他のすべての設定より優先されます。',
      inputPlaceholderBypass: '例: google.com や internal.corp',
      btnAddBypass: '追加',
      btnAddBypassWebsite: 'バイパスリストに追加',
      emptyBypassTitle: 'バイパス登録サイトはありません',
      emptyBypassDesc: '上記でドメインを追加すると、そのサイトでMaiTabを完全に無効化します。',
      removeBypassAria: '{0} を完全バイパスリストから削除',
      filterBypassPlaceholder: 'バイパスドメインを検索...',
      optBypassHeading: '完全バイパスリスト (サイレントリスト)',
      optBypassSubheading: 'ここに登録されたウェブサイトではMaiTabが<strong>完全に無効化</strong>されます。すべてのリンククリックと対話的要素は拡張機能が存在しないかのように通常通り動作します。<strong>ホワイトリストや全体設定より最優先されます。</strong>サブドメインも自動的に対象となります。',
      domainBypassCountBadge: '{0} ドメイン',
      optEmptyBypassTitle: 'バイパス登録サイトがありません',
      optEmptyBypassDesc: '上記でドメインを追加すると、そのサイトでMaiTabを完全に無効化します。',
      thBypassStatus: '拡張機能状態',
      statusBypassed: '完全無効 (通常)',
      btnExportBypass: 'エクスポート',
      btnImportBypass: 'インポート',
      btnClearBypass: 'すべて削除',
      toastBypassAdded: '「{0}」を完全バイパスリストに追加しました',
      toastBypassRemoved: '「{0}」を完全バイパスリストから削除しました',
      toastBypassCleared: 'すべての完全バイパスドメインをクリアしました',
      toastBypassExported: '完全バイパスリストを正常にエクスポートしました',
      toastBypassImported: '{0} 件のバイパスドメインをインポートしました',
      confirmClearBypass: '完全バイパスリストのすべての登録サイトを削除してもよろしいですか？',
      errBypassDomainExists: '「{0}」は既に完全バイパスリストに存在します。',
      testerBypassBadge: 'バイパス対象 (一致規則: {0})',
      testerNativeBadge: 'ブラウザ通常ナビゲーション',
      testerExplainBypassed: '「{0}」のリンクは完全バイパス規則「{1}」に一致するため、MaiTabの干渉を一切受けず通常のブラウザ動作に従います。ホワイトリストおよび全体設定より厳格に優先されます。',
      docBypassTitle: '完全バイパスリスト (サイレントリスト):',
      docBypassDesc: '<strong>最優先順位:</strong> 完全バイパスリストに登録されたウェブサイトではMaiTabが完全に無効化されます。リンククリック、タブ生成、対話的要素はブラウザおよびサイト本来の挙動に従います。干渉を防ぐためイベントリスナーも解除されます。このリストはホワイトリストや全体設定より厳格に優先されます。',

      // Options Page - General Preferences
      optTitle: 'MaiTab 設定',
      optSubtitle: 'リンクオープンとタブ切り替え動作の設定',
      generalPreferences: '一般設定',
      optEnableLabel: 'MaiTab を有効化',
      optEnableDesc: '有効にすると、ウェブリンクを左クリックした際に現在のタブを移動せず、新しいタブで開きます。',
      optGlobalSwitchLabel: '全体タブ自動切り替え',
      optGlobalSwitchDesc: '新規作成されたタブにChromeが自動でフォーカスを移動するかどうかを制御します。',
      optBulletOn: '<strong>有効:</strong> すべてのリンクが新規タブで開き、直ちにタブに切り替わります。',
      optBulletOff: '<strong>無効（デフォルト）:</strong> リンクはバックグラウンドで開かれ、現在の読書を妨げません（ホワイトリスト対象を除く）。',
      optOpenNextLabel: '現在のタブの隣に開く',
      optOpenNextDesc: '新しく開いたタブを現在のタブのすぐ右側に配置し、Chrome標準の中クリック動作を再現します。',
      optThemeLabel: '外観テーマ',
      optThemeDesc: 'お好みの外観を選択します（macOS ダーク Aqua またはライト Aqua）。',

      // Options Page - Whitelist Management
      optWhitelistHeading: 'ウェブサイト自動切り替えホワイトリスト',
      optWhitelistSubheading: 'ここに登録されたウェブサイトは、全体タブ自動切り替えが無効の場合でも<strong>常に新しいタブへ切り替わります</strong>。サブドメインも自動的に対象となります。',
      domainCountBadge: '{0} ドメイン',
      btnExport: 'エクスポート',
      btnImport: 'インポート',
      btnClearAll: 'すべて削除',
      thDomainPattern: 'ドメイン規則',
      thMatchingScope: '対象範囲',
      thAction: '操作',
      scopeDescription: '{0} およびそのサブドメイン (*.{0}) に一致',
      optEmptyStateTitle: 'ホワイトリスト登録サイトがありません',
      optEmptyStateDesc: '上記でドメインを追加すると、常に新しいタブにフォーカスします。',

      // Interactive Tester
      testerTitle: 'インタラクティブなドメイン照合テスター',
      testerSubtitle: '任意のURLまたはドメインを入力して、現在の設定とホワイトリストでフォアグラウンドまたはバックグラウンドのどちらで開くかをテストします。',
      testerPlaceholder: 'テストするURLまたはドメインを入力 (例: https://gist.github.com/my-gist)',
      testerNormalizedHost: '正規化ホスト名:',
      testerWhitelistMatch: 'ホワイトリスト照合:',
      testerResultingBehavior: '最終タブ動作:',
      testerInvalidInput: '無効な入力',
      testerEnterValidPrompt: '有効なURLまたはホスト名を入力してテストしてください。',
      testerMatchedBadge: 'ホワイトリスト登録済み (一致規則: {0})',
      testerNotMatchedBadge: 'ホワイトリスト未登録',
      testerForegroundBadge: 'フォアグラウンドタブ（アクティブ）',
      testerBackgroundBadge: 'バックグラウンドタブ',
      testerPausedBadge: '拡張機能一時停止中',
      testerExplainPaused: '拡張機能は現在一時停止中です。通常のブラウザリンク遷移が行われます。',
      testerExplainGlobalOn: '全体タブ自動切り替えがONのため、「{0}」のリンクは直ちに新しいタブにフォーカスします。',
      testerExplainWhitelisted: 'ホワイトリスト規則「{1}」に一致するため、「{0}」のリンクは全体設定を上書きして新しいタブにフォーカスします。',
      testerExplainBackground: '全体切り替えがOFFかつ未登録のため、「{0}」のリンクはバックグラウンドで静かに開かれます。',

      // Technical Documentation Section
      docHeading: 'ドメイン照合とリンク捕捉の仕組み',
      docDomainRulesTitle: 'ドメイン照合規則:',
      docRuleExact: '<strong>完全一致:</strong> <code>example.com</code> は <code>example.com</code> へのアクセスと完全一致します。',
      docRuleSubdomains: '<strong>サブドメイン照合:</strong> <code>example.com</code> は <code>news.example.com</code> や <code>blog.example.com</code> などの配下サブドメインも自動対象とします。',
      docRuleSafety: '<strong>誤照合の防止:</strong> <code>example.com</code> が <code>fakeexample.com</code> や <code>example.com.phishing.org</code> に誤って一致することはありません。',
      docLinkSafetyTitle: '安全なリンク捕捉:',
      docSafetyModifiers: '<strong>修飾キー保持:</strong> ブラウザ標準のショートカット（Ctrl+クリック、Shift+クリック、Alt+クリック、Cmd+クリック）は干渉せずそのまま動作します。',
      docSafetyClicks: '<strong>右クリック・中クリック:</strong> 通常の左クリックのみを対象とします。右クリックメニューや中クリックはブラウザに任せます。',
      docSafetyHash: '<strong>ページ内アンカー:</strong> 同一ページ内のアンカーリンク（<code>#comments</code> など）は新規タブを開かず、スムーズにスクロールします。',
      docSafetyControls: '<strong>対話的UI:</strong> ボタン、入力フィールド、セレクトボックス、テキスト選択、<code>download</code> 属性リンクは通常通り機能します。',

      // Errors & Validation
      errEnterDomain: 'ドメインまたはURLを入力してください。',
      errInvalidDomain: 'ドメイン形式が無効です。「example.com」や「sub.domain.org」のような有効なドメインを入力してください。',
      errDomainExists: '「{0}」は既にホワイトリストに存在します。',
      errFileParse: 'インポートファイルの解析に失敗しました: {0}',

      // Toasts & Confirmations
      toastAdded: '「{0}」をホワイトリストに追加しました',
      toastRemoved: '「{0}」をホワイトリストから削除しました',
      toastCleared: 'すべてのホワイトリストドメインをクリアしました',
      toastReset: 'すべての設定をデフォルトに戻しました',
      toastExported: 'ホワイトリストを正常にエクスポートしました',
      toastImported: '{0} 件のドメインをインポートしました',
      toastEnabled: 'MaiTab を有効にしました',
      toastPaused: 'MaiTab を一時停止しました',
      toastGlobalOn: '全体自動切り替えをONにしました',
      toastGlobalOff: '全体自動切り替えをOFFにしました',
      toastOpenNextOn: 'タブを現在のタブの隣に開きます',
      toastOpenNextOff: 'タブをタブバーの末尾に開きます',
      confirmClear: 'すべてのホワイトリスト登録サイトを削除してもよろしいですか？',
      confirmReset: 'すべての MaiTab 設定とホワイトリストをデフォルトに戻してもよろしいですか？'
    }
  };

  let currentLanguage = DEFAULT_LANGUAGE;
  const changeListeners = new Set();

  /**
   * Normalizes language tag to one of supported codes ('en', 'zh-CN', 'ja').
   */
  function normalizeLanguageCode(code) {
    if (!code || typeof code !== 'string') {
      return DEFAULT_LANGUAGE;
    }

    const lower = code.toLowerCase().trim();
    if (lower.startsWith('zh')) {
      return 'zh-CN';
    }
    if (lower.startsWith('ja')) {
      return 'ja';
    }
    return 'en';
  }

  /**
   * Detects the browser UI language.
   */
  function detectBrowserLanguage() {
    if (typeof navigator !== 'undefined' && navigator.language) {
      return normalizeLanguageCode(navigator.language);
    }
    return DEFAULT_LANGUAGE;
  }

  /**
   * Retrieves the currently active language.
   */
  function getLanguage() {
    return currentLanguage;
  }

  /**
   * Sets the active language and notifies all registered listeners.
   */
  function setLanguage(lang) {
    const normalized = normalizeLanguageCode(lang);
    if (currentLanguage !== normalized) {
      currentLanguage = normalized;
      changeListeners.forEach(listener => {
        try {
          listener(currentLanguage);
        } catch (err) {
          console.error('[MaiTab i18n] Error in change listener:', err);
        }
      });
    }
    return currentLanguage;
  }

  /**
   * Translates a message key into the active language, with parameter substitution.
   *
   * @param {string} key - Translation key
   * @param {...any} args - Positional parameters ({0}, {1}, ...) or named object
   * @returns {string} Translated string or key fallback
   */
  function t(key, ...args) {
    const dict = TRANSLATIONS[currentLanguage] || TRANSLATIONS[DEFAULT_LANGUAGE];
    const fallbackDict = TRANSLATIONS[DEFAULT_LANGUAGE];

    let message = dict[key] !== undefined ? dict[key] : fallbackDict[key];
    if (message === undefined) {
      return key;
    }

    // Object parameters: t('key', { name: 'value' })
    if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
      const params = args[0];
      return message.replace(/\{(\w+)\}/g, (match, paramName) => {
        return params[paramName] !== undefined ? String(params[paramName]) : match;
      });
    }

    // Positional parameters: t('key', 'arg0', 'arg1')
    if (args.length > 0) {
      return message.replace(/\{(\d+)\}/g, (match, index) => {
        const idx = Number(index);
        return args[idx] !== undefined ? String(args[idx]) : match;
      });
    }

    return message;
  }

  /**
   * Traverses DOM and translates elements with data-i18n attributes.
   *
   * @param {Document|HTMLElement} [rootNode=document]
   */
  function applyToDOM(rootNode) {
    const doc = rootNode || (typeof document !== 'undefined' ? document : null);
    if (!doc || typeof doc.querySelectorAll !== 'function') {
      return;
    }

    // Translate text content or innerHTML
    const textElements = doc.querySelectorAll('[data-i18n]');
    textElements.forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key) {
        if (el.getAttribute('data-i18n-html') === 'true') {
          el.innerHTML = t(key);
        } else {
          el.textContent = t(key);
        }
      }
    });

    // Translate placeholder attribute
    const placeholderElements = doc.querySelectorAll('[data-i18n-placeholder]');
    placeholderElements.forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) {
        el.setAttribute('placeholder', t(key));
      }
    });

    // Translate title attribute
    const titleElements = doc.querySelectorAll('[data-i18n-title]');
    titleElements.forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (key) {
        el.setAttribute('title', t(key));
      }
    });

    // Translate aria-label attribute
    const ariaElements = doc.querySelectorAll('[data-i18n-aria]');
    ariaElements.forEach(el => {
      const key = el.getAttribute('data-i18n-aria');
      if (key) {
        el.setAttribute('aria-label', t(key));
      }
    });
  }

  /**
   * Registers a listener for language changes.
   *
   * @param {function(string): void} callback
   */
  function onLanguageChanged(callback) {
    if (typeof callback === 'function') {
      changeListeners.add(callback);
    }
  }

  return {
    SUPPORTED_LANGUAGES,
    DEFAULT_LANGUAGE,
    detectBrowserLanguage,
    normalizeLanguageCode,
    getLanguage,
    setLanguage,
    t,
    applyToDOM,
    onLanguageChanged,
    _TRANSLATIONS: TRANSLATIONS
  };
});
