const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');

// Helper to launch isolated Chrome session
async function launchChromeSession(port, debugPort) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-update-theme-test-'));
  const chrome = spawn('/usr/bin/google-chrome-stable', [
    '--headless=new',
    `--remote-debugging-port=${debugPort}`,
    '--no-sandbox',
    `--user-data-dir=${tmpDir}`,
    'about:blank'
  ]);

  let targetPage = null;
  for (let i = 0; i < 20; i++) {
    try {
      const listRes = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      const pages = await listRes.json();
      targetPage = pages.find(p => p.type === 'page' && p.webSocketDebuggerUrl);
      if (targetPage) break;
    } catch {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  if (!targetPage) {
    chrome.kill();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    throw new Error('Failed to connect to headless Chrome page');
  }

  const ws = new WebSocket(targetPage.webSocketDebuggerUrl);

  let id = 1;
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const curId = id++;
    const handler = (evt) => {
      const msg = JSON.parse(evt.data);
      if (msg.id === curId) {
        ws.removeEventListener('message', handler);
        if (msg.error) {
          reject(new Error(msg.error.message));
        } else {
          resolve(msg.result);
        }
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: curId, method, params }));
  });

  await new Promise(r => ws.onopen = r);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 368,
    height: 600,
    deviceScaleFactor: 1,
    mobile: false
  });

  const consoleErrors = [];
  ws.addEventListener('message', (evt) => {
    const msg = JSON.parse(evt.data);
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      consoleErrors.push(msg.params.args.map(a => a.value || a.description).join(' '));
    }
  });

  const navigate = async (urlPath) => {
    const loadedPromise = new Promise(resolve => {
      const handler = (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.method === 'Page.loadEventFired') {
          ws.removeEventListener('message', handler);
          resolve();
        }
      };
      ws.addEventListener('message', handler);
    });

    await send('Page.navigate', { url: `http://127.0.0.1:${port}${urlPath}` });
    await loadedPromise;
    await new Promise(r => setTimeout(r, 200));
  };

  const evaluate = async (expr) => {
    const res = await send('Runtime.evaluate', {
      expression: `(async function() {
        const val = await (${expr.trim().startsWith('{') ? '(' + expr + ')' : expr});
        return val === undefined ? null : JSON.stringify(val);
      })()`,
      awaitPromise: true,
      returnByValue: true
    });
    return res.result.value ? JSON.parse(res.result.value) : null;
  };

  const setEmulatedMedia = async (features) => {
    await send('Emulation.setEmulatedMedia', {
      media: 'screen',
      features
    });
  };

  const close = () => {
    try { ws.close(); } catch {}
    try { chrome.kill(); } catch {}
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  };

  return { navigate, evaluate, setEmulatedMedia, close, consoleErrors };
}

test('Manual Update Checking, Synchronization, and System Theme Suite', async (t) => {
  const SERVER_PORT = 8199;
  const DEBUG_PORT = 9235;

  let mockSyncStatus = {
    success: true,
    upToDate: true,
    behindCount: 0,
    aheadCount: 0,
    incomingCommits: [],
    hasLocalChanges: false
  };

  let mockSyncPerformHandler = () => ({
    success: true,
    latestCommit: '3fbfd37 feat: latest sync',
    stashedChangesRestored: false
  });

  // Configurable server capable of serving static files and mock sync endpoints
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url, `http://localhost:${SERVER_PORT}`);
    const pathname = parsedUrl.pathname;

    if (pathname === '/api/sync/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(mockSyncStatus));
      return;
    }

    if (pathname === '/api/sync/perform' && req.method === 'POST') {
      const result = mockSyncPerformHandler();
      res.writeHead(result.success ? 200 : 409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    let filePath = path.join(rootDir, pathname === '/' ? '/popup/popup.html' : pathname);
    if (!fs.existsSync(filePath)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath);
    const mimes = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.png': 'image/png',
      '.json': 'application/json'
    };

    res.writeHead(200, { 'Content-Type': mimes[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });

  await new Promise(r => server.listen(SERVER_PORT, r));
  const session = await launchChromeSession(SERVER_PORT, DEBUG_PORT);

  t.after(() => {
    session.close();
    server.close();
  });

  await t.test('1. Check for Updates button is clearly accessible next to version badge', async () => {
    await session.navigate('/popup/popup.html');

    const uiCheck = await session.evaluate(`{
      hasVersionBadge: Boolean(document.querySelector('.brand-text .badge')),
      versionText: document.querySelector('.brand-text .badge').textContent.trim(),
      hasCheckBtn: Boolean(document.getElementById('checkUpdateBtn')),
      checkBtnText: document.getElementById('checkUpdateBtn').textContent.trim(),
      checkBtnTitle: document.getElementById('checkUpdateBtn').title,
      isNextToBadge: document.querySelector('.version-wrap') !== null,
      initialBannerHidden: document.getElementById('syncStatusBanner').classList.contains('hidden')
    }`);

    assert.ok(uiCheck.hasVersionBadge, 'Version badge must exist');
    assert.strictEqual(uiCheck.versionText, 'v1.31', 'Version must be v1.31');
    assert.ok(uiCheck.hasCheckBtn, 'Check for Updates button must exist');
    assert.ok(uiCheck.isNextToBadge, 'Check for Updates button must be grouped next to version badge');
    assert.ok(uiCheck.initialBannerHidden, 'Sync status banner is cleanly hidden until checked');
  });

  await t.test('2. Checking status and Up to Date display when local repo is current', async () => {
    mockSyncStatus = {
      success: true,
      upToDate: true,
      behindCount: 0,
      aheadCount: 0,
      incomingCommits: [],
      hasLocalChanges: false
    };

    // Override Updater endpoint to point to test server
    await session.evaluate(`(function() {
      if (typeof Updater !== 'undefined') {
        Updater.localEndpoint = 'http://127.0.0.1:${SERVER_PORT}';
      }
    })()`);

    // Click check for updates
    await session.evaluate(`document.getElementById('checkUpdateBtn').click()`);
    await new Promise(r => setTimeout(r, 250));

    const checkResult = await session.evaluate(`{
      bannerVisible: !document.getElementById('syncStatusBanner').classList.contains('hidden'),
      badgeText: document.getElementById('syncStatusBadge').textContent.trim(),
      badgeClass: document.getElementById('syncStatusBadge').className,
      messageText: document.getElementById('syncStatusMessage').textContent.trim(),
      actionAreaHidden: document.getElementById('syncActionArea').classList.contains('hidden'),
      detailsHidden: document.getElementById('syncDetailsBox').classList.contains('hidden')
    }`);

    assert.ok(checkResult.bannerVisible, 'Banner must become visible after clicking check');
    assert.ok(checkResult.badgeText.includes('Up to Date') || checkResult.badgeText.includes('已是最新') || checkResult.badgeText.includes('最新です'), `Expected Up to Date badge, got: ${checkResult.badgeText}`);
    assert.ok(checkResult.badgeClass.includes('badge-success'), 'Must have success badge styling');
    assert.ok(checkResult.actionAreaHidden, 'Sync Now action area should be hidden when already up to date');
  });

  await t.test('3. Update Available display with incoming commit count and list', async () => {
    mockSyncStatus = {
      success: true,
      upToDate: false,
      behindCount: 2,
      aheadCount: 0,
      incomingCommits: [
        '3fbfd37 feat: add feature B',
        'e5515ab feat: add feature A'
      ],
      hasLocalChanges: true
    };

    // Click check for updates
    await session.evaluate(`document.getElementById('checkUpdateBtn').click()`);
    await new Promise(r => setTimeout(r, 250));

    const updateCheckResult = await session.evaluate(`{
      bannerVisible: !document.getElementById('syncStatusBanner').classList.contains('hidden'),
      badgeText: document.getElementById('syncStatusBadge').textContent.trim(),
      badgeClass: document.getElementById('syncStatusBadge').className,
      messageText: document.getElementById('syncStatusMessage').textContent.trim(),
      detailsVisible: !document.getElementById('syncDetailsBox').classList.contains('hidden'),
      commitItems: Array.from(document.querySelectorAll('#syncCommitsList li')).map(li => li.textContent.trim()),
      syncNowBtnVisible: !document.getElementById('syncNowBtn').classList.contains('hidden')
    }`);

    assert.ok(updateCheckResult.bannerVisible);
    assert.ok(updateCheckResult.badgeText.includes('Update Available') || updateCheckResult.badgeText.includes('有可用更新') || updateCheckResult.badgeText.includes('更新あり'));
    assert.ok(updateCheckResult.badgeClass.includes('badge-update'));
    assert.ok(updateCheckResult.messageText.includes('2'));
    assert.ok(updateCheckResult.detailsVisible, 'Commit details list must be visible');
    assert.strictEqual(updateCheckResult.commitItems.length, 2, 'Must display exactly 2 incoming commits');
    assert.ok(updateCheckResult.commitItems[0].includes('3fbfd37'));
    assert.ok(updateCheckResult.syncNowBtnVisible, 'Sync Now button must be visible');
  });

  await t.test('4. Manual synchronization execution and refreshed status', async () => {
    let syncCalled = false;
    mockSyncPerformHandler = () => {
      syncCalled = true;
      mockSyncStatus = {
        success: true,
        upToDate: true,
        behindCount: 0,
        aheadCount: 0,
        incomingCommits: [],
        hasLocalChanges: false
      };
      return {
        success: true,
        latestCommit: '3fbfd37 feat: add feature B',
        stashedChangesRestored: true
      };
    };

    // Click Sync Now button
    await session.evaluate(`document.getElementById('syncNowBtn').click()`);
    await new Promise(r => setTimeout(r, 300));

    assert.ok(syncCalled, 'Server performSync endpoint must have been called');

    const postSyncState = await session.evaluate(`{
      badgeText: document.getElementById('syncStatusBadge').textContent.trim(),
      badgeClass: document.getElementById('syncStatusBadge').className,
      messageText: document.getElementById('syncStatusMessage').textContent.trim()
    }`);

    assert.ok(postSyncState.badgeClass.includes('badge-success'), 'Must show success badge after sync');
    assert.ok(postSyncState.badgeText.includes('Up to Date') || postSyncState.badgeText.includes('已是最新') || postSyncState.badgeText.includes('最新です'));
  });

  await t.test('5. Safe preservation of uncommitted changes and conflict reporting', async () => {
    // Simulate conflict during synchronization
    mockSyncPerformHandler = () => ({
      success: false,
      conflict: true,
      conflictedFiles: ['README.md'],
      error: 'Git conflict during remote synchronization',
      feedback: 'Conflict occurred while integrating remote commits via rebase.\nConflicted file(s):\n  • README.md\nYour uncommitted changes remain safely stashed.'
    });

    // Reset status to update available
    mockSyncStatus = {
      success: true,
      upToDate: false,
      behindCount: 1,
      incomingCommits: ['a90b93c update readme from remote']
    };

    await session.evaluate(`document.getElementById('checkUpdateBtn').click()`);
    await new Promise(r => setTimeout(r, 250));

    // Click Sync Now
    await session.evaluate(`document.getElementById('syncNowBtn').click()`);
    await new Promise(r => setTimeout(r, 300));

    const conflictState = await session.evaluate(`{
      badgeText: document.getElementById('syncStatusBadge').textContent.trim(),
      badgeClass: document.getElementById('syncStatusBadge').className,
      conflictBoxVisible: !document.getElementById('syncConflictBox').classList.contains('hidden'),
      conflictFeedback: document.getElementById('syncConflictBox').textContent.trim()
    }`);

    assert.ok(conflictState.badgeClass.includes('badge-danger'), 'Failed sync must show danger badge');
    assert.ok(conflictState.badgeText.includes('Update Failed') || conflictState.badgeText.includes('更新失败') || conflictState.badgeText.includes('更新失敗'));
    assert.ok(conflictState.conflictBoxVisible, 'Conflict feedback box must be visible');
    assert.ok(conflictState.conflictFeedback.includes('README.md'), 'Conflicted files must be identified');
    assert.ok(conflictState.conflictFeedback.includes('stashed') || conflictState.conflictFeedback.includes('Conflict'));
  });

  await t.test('6. Network error handling shows Update Failed with descriptive message', async () => {
    mockSyncStatus = {
      success: false,
      error: 'Network connection error or remote repository unreachable'
    };

    await session.evaluate(`document.getElementById('checkUpdateBtn').click()`);
    await new Promise(r => setTimeout(r, 250));

    const errState = await session.evaluate(`{
      badgeText: document.getElementById('syncStatusBadge').textContent.trim(),
      badgeClass: document.getElementById('syncStatusBadge').className,
      messageText: document.getElementById('syncStatusMessage').textContent.trim()
    }`);

    assert.ok(errState.badgeClass.includes('badge-danger'), 'Network error must display danger badge');
    assert.ok(errState.badgeText.includes('Update Failed') || errState.badgeText.includes('更新失败') || errState.badgeText.includes('更新失敗'));
    assert.ok(errState.messageText.length > 0, 'Error message must not be empty');
  });

  await t.test('7. System theme option automatically follows OS appearance settings', async () => {
    // Reset Updater endpoint back
    await session.evaluate(`(function() {
      Updater.localEndpoint = 'http://127.0.0.1:${SERVER_PORT}';
    })()`);

    // Verify System option exists in Popup
    const optionsList = await session.evaluate(`
      Array.from(document.getElementById('popupThemeSelect').options).map(o => o.value)
    `);
    assert.deepStrictEqual(optionsList, ['system', 'dark', 'light'], 'Popup theme select must have system, dark, and light options');

    // Emulate OS dark mode
    await session.setEmulatedMedia([{ name: 'prefers-color-scheme', value: 'dark' }]);

    // Select System theme
    await session.evaluate(`(function() {
      const select = document.getElementById('popupThemeSelect');
      select.value = 'system';
      select.dispatchEvent(new Event('change'));
    })()`);
    await new Promise(r => setTimeout(r, 150));

    const darkSysTheme = await session.evaluate(`{
      themeAttr: document.documentElement.getAttribute('data-theme'),
      bg: getComputedStyle(document.body).backgroundColor,
      color: getComputedStyle(document.body).color
    }`);

    assert.strictEqual(darkSysTheme.themeAttr, 'dark', 'In OS dark mode, System theme must resolve to dark');
    assert.strictEqual(darkSysTheme.bg, 'rgb(28, 28, 30)', 'Dark mode background must be #1c1c1e');

    // Emulate OS light mode in real time
    await session.setEmulatedMedia([{ name: 'prefers-color-scheme', value: 'light' }]);
    // Dispatch media query change event
    await session.evaluate(`(function() {
      window.dispatchEvent(new Event('resize'));
    })()`);
    await new Promise(r => setTimeout(r, 150));

    const lightSysTheme = await session.evaluate(`{
      themeAttr: document.documentElement.getAttribute('data-theme'),
      bg: getComputedStyle(document.body).backgroundColor,
      color: getComputedStyle(document.body).color
    }`);

    assert.strictEqual(lightSysTheme.themeAttr, 'light', 'When OS changes to light, System mode must automatically follow in real time');
    assert.strictEqual(lightSysTheme.bg, 'rgb(245, 245, 247)', 'Light mode background must be #f5f5f7');
  });

  await t.test('8. Manual theme selections (Light/Dark) override System and remain active', async () => {
    // While OS is emulating light mode, manually select Dark Mode
    await session.evaluate(`(function() {
      const select = document.getElementById('popupThemeSelect');
      select.value = 'dark';
      select.dispatchEvent(new Event('change'));
    })()`);
    await new Promise(r => setTimeout(r, 150));

    const manualDark = await session.evaluate(`{
      themeAttr: document.documentElement.getAttribute('data-theme'),
      bg: getComputedStyle(document.body).backgroundColor
    }`);

    assert.strictEqual(manualDark.themeAttr, 'dark', 'Manual selection must force dark theme');
    assert.strictEqual(manualDark.bg, 'rgb(28, 28, 30)');

    // Now change OS appearance to light or dark - manual dark must NOT change
    await session.setEmulatedMedia([{ name: 'prefers-color-scheme', value: 'light' }]);
    await new Promise(r => setTimeout(r, 150));

    const stillDark = await session.evaluate(`{
      themeAttr: document.documentElement.getAttribute('data-theme'),
      bg: getComputedStyle(document.body).backgroundColor
    }`);

    assert.strictEqual(stillDark.themeAttr, 'dark', 'Manual dark selection must remain active and not follow OS changes');
    assert.strictEqual(stillDark.bg, 'rgb(28, 28, 30)');

    // Reopen popup / reload page - manual selection persists
    await session.navigate('/popup/popup.html');
    const reloadedManual = await session.evaluate(`{
      themeAttr: document.documentElement.getAttribute('data-theme'),
      selectVal: document.getElementById('popupThemeSelect').value
    }`);
    assert.strictEqual(reloadedManual.themeAttr, 'dark');
    assert.strictEqual(reloadedManual.selectVal, 'dark');
  });

  await t.test('9. Options page supports System theme and stays consistent with Popup', async () => {
    await session.navigate('/options/options.html');

    const optThemeOptions = await session.evaluate(`
      Array.from(document.getElementById('optThemeSelect').options).map(o => o.value)
    `);
    assert.deepStrictEqual(optThemeOptions, ['system', 'dark', 'light']);

    // Emulate OS light mode
    await session.setEmulatedMedia([{ name: 'prefers-color-scheme', value: 'light' }]);

    // Select System theme in options
    await session.evaluate(`(function() {
      const select = document.getElementById('optThemeSelect');
      select.value = 'system';
      select.dispatchEvent(new Event('change'));
    })()`);
    await new Promise(r => setTimeout(r, 150));

    const optThemeApplied = await session.evaluate(`{
      themeAttr: document.documentElement.getAttribute('data-theme'),
      bg: getComputedStyle(document.body).backgroundColor
    }`);
    assert.strictEqual(optThemeApplied.themeAttr, 'light');
    assert.strictEqual(optThemeApplied.bg, 'rgb(245, 245, 247)');
  });

  await t.test('10. Zero console errors throughout all interactions', () => {
    assert.deepStrictEqual(session.consoleErrors, []);
  });
});
