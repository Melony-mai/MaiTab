const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');

// Helper to launch isolated Chrome session with CDP
async function launchChromeSession(port, debugPort) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-oneclick-test-'));
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

  const setViewport = async (width, height, deviceScaleFactor = 1) => {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor,
      mobile: width < 600
    });
  };

  const close = () => {
    try { ws.close(); } catch {}
    try { chrome.kill(); } catch {}
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  };

  return { navigate, evaluate, setViewport, close, consoleErrors };
}

test('Direct One-Click Synchronization and Popup Layout Optimization Suite', async (t) => {
  const SERVER_PORT = 8198;
  const DEBUG_PORT = 9239;

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
    latestCommit: '3fbfd37 feat: direct iteration',
    stashedChangesRestored: false
  });

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
      res.writeHead(result.success ? 200 : (result.conflict ? 409 : 500), { 'Content-Type': 'application/json' });
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

  await t.test('1. Manual "npm run sync" workflow and copy button are completely removed', async () => {
    await session.navigate('/popup/popup.html');

    const domCheck = await session.evaluate(`{
      hasCopySyncBtn: Boolean(document.getElementById('copySyncCmdBtn')),
      hasSyncNowBtn: Boolean(document.getElementById('syncNowBtn')),
      hasCheckUpdateBtn: Boolean(document.getElementById('checkUpdateBtn'))
    }`);

    assert.strictEqual(domCheck.hasCopySyncBtn, false, 'copySyncCmdBtn must not exist in DOM');
    assert.strictEqual(domCheck.hasSyncNowBtn, true, 'syncNowBtn must exist in DOM');
    assert.strictEqual(domCheck.hasCheckUpdateBtn, true, 'checkUpdateBtn must exist in DOM');
  });

  await t.test('2. One-click update: clicking update button initiates synchronization directly without manual commands', async () => {
    mockSyncStatus = {
      success: true,
      upToDate: false,
      behindCount: 3,
      incomingCommits: [
        'c0ffee1 feat: awesome feature 1',
        'c0ffee2 feat: awesome feature 2',
        'c0ffee3 feat: awesome feature 3'
      ],
      hasLocalChanges: true
    };

    let syncPerformCalled = false;
    mockSyncPerformHandler = () => {
      syncPerformCalled = true;
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
        latestCommit: 'c0ffee1 feat: awesome feature 1',
        stashedChangesRestored: true
      };
    };

    // Point Updater to test server
    await session.evaluate(`Updater.localEndpoint = 'http://127.0.0.1:${SERVER_PORT}'`);

    // Trigger update check
    await session.evaluate(`document.getElementById('checkUpdateBtn').click()`);
    await new Promise(r => setTimeout(r, 250));

    // Verify update available display
    const checkState = await session.evaluate(`{
      syncNowBtnVisible: !document.getElementById('syncNowBtn').classList.contains('hidden'),
      hasUpdateClass: document.getElementById('checkUpdateBtn').classList.contains('has-update'),
      badgeText: document.getElementById('syncStatusBadge').textContent.trim()
    }`);

    assert.strictEqual(checkState.syncNowBtnVisible, true, 'Sync Now button must be visible');
    assert.strictEqual(checkState.hasUpdateClass, true, 'Check button should indicate update ready');

    // Click Update & Sync button directly
    await session.evaluate(`document.getElementById('syncNowBtn').click()`);
    await new Promise(r => setTimeout(r, 300));

    assert.strictEqual(syncPerformCalled, true, 'Direct synchronization must be called on click without terminal commands');

    const syncedState = await session.evaluate(`{
      badgeText: document.getElementById('syncStatusBadge').textContent.trim(),
      badgeClass: document.getElementById('syncStatusBadge').className,
      actionHidden: document.getElementById('syncActionArea').classList.contains('hidden'),
      messageText: document.getElementById('syncStatusMessage').textContent.trim()
    }`);

    assert.ok(syncedState.badgeClass.includes('badge-success'), 'Must transition to badge-success');
    assert.ok(syncedState.actionHidden, 'Action area must hide after successful sync');
    assert.ok(!syncedState.messageText.includes('npm run sync'), 'Must not ask user to run npm run sync');
  });

  await t.test('3. Synchronization conflicts safely protect local changes without data loss', async () => {
    mockSyncStatus = {
      success: true,
      upToDate: false,
      behindCount: 1,
      incomingCommits: ['d00d1e5 chore: remote update'],
      hasLocalChanges: true
    };

    mockSyncPerformHandler = () => ({
      success: false,
      conflict: true,
      conflictedFiles: ['manifest.json', 'popup/popup.js'],
      error: 'Git conflict during remote synchronization',
      feedback: 'Git conflict during remote synchronization\nConflicted file(s):\n  • manifest.json\n  • popup/popup.js\nYour uncommitted changes remain safely stashed.'
    });

    await session.evaluate(`document.getElementById('checkUpdateBtn').click()`);
    await new Promise(r => setTimeout(r, 250));

    await session.evaluate(`document.getElementById('syncNowBtn').click()`);
    await new Promise(r => setTimeout(r, 300));

    const conflictState = await session.evaluate(`{
      badgeClass: document.getElementById('syncStatusBadge').className,
      conflictBoxVisible: !document.getElementById('syncConflictBox').classList.contains('hidden'),
      conflictText: document.getElementById('syncConflictBox').textContent,
      syncNowBtnDisabled: document.getElementById('syncNowBtn').disabled
    }`);

    assert.ok(conflictState.badgeClass.includes('badge-danger'), 'Conflict must show danger badge');
    assert.strictEqual(conflictState.conflictBoxVisible, true, 'Conflict details box must be visible');
    assert.ok(conflictState.conflictText.includes('manifest.json'), 'Must list conflicted files');
    assert.ok(conflictState.conflictText.includes('popup/popup.js'), 'Must list all conflicted files');
    assert.strictEqual(conflictState.syncNowBtnDisabled, false, 'Sync button should be re-enabled for retry');
  });

  await t.test('4. Network failures show clear error message with retry capability', async () => {
    mockSyncPerformHandler = () => ({
      success: false,
      conflict: false,
      error: 'Remote repository unreachable (getaddrinfo ENOTFOUND github.com)'
    });

    await session.evaluate(`document.getElementById('syncNowBtn').click()`);
    await new Promise(r => setTimeout(r, 300));

    const netErrState = await session.evaluate(`{
      badgeClass: document.getElementById('syncStatusBadge').className,
      messageText: document.getElementById('syncStatusMessage').textContent,
      syncNowBtnDisabled: document.getElementById('syncNowBtn').disabled
    }`);

    assert.ok(netErrState.badgeClass.includes('badge-danger'));
    assert.ok(netErrState.messageText.includes('unreachable') || netErrState.messageText.includes('failed') || netErrState.messageText.includes('失败'));
    assert.strictEqual(netErrState.syncNowBtnDisabled, false, 'Button must remain enabled for retry');
  });

  await t.test('5. Layout optimization: all settings and options are fully visible on open without unnecessary scrolling', async () => {
    await session.navigate('/popup/popup.html');

    const layoutCheck = await session.evaluate(`{
      clientWidth: document.body.clientWidth,
      scrollWidth: document.body.scrollWidth,
      clientHeight: document.body.clientHeight,
      scrollHeight: document.body.scrollHeight,
      hasVerticalScroll: document.body.scrollHeight > 580,
      headerVisible: Boolean(document.querySelector('.header')),
      currentSiteVisible: Boolean(document.getElementById('currentSiteSection')),
      generalVisible: Boolean(document.querySelector('.theme-setting-row')),
      listsVisible: Boolean(document.querySelector('.lists-section')),
      footerVisible: Boolean(document.querySelector('.footer'))
    }`);

    assert.strictEqual(layoutCheck.scrollWidth <= layoutCheck.clientWidth + 1, true, 'Zero horizontal overflow');
    assert.strictEqual(layoutCheck.hasVerticalScroll, false, `Default popup scrollHeight (${layoutCheck.scrollHeight}px) must be <= 580px to prevent unnecessary scrolling`);
    assert.strictEqual(layoutCheck.headerVisible, true);
    assert.strictEqual(layoutCheck.currentSiteVisible, true);
    assert.strictEqual(layoutCheck.generalVisible, true);
    assert.strictEqual(layoutCheck.listsVisible, true);
    assert.strictEqual(layoutCheck.footerVisible, true);
  });

  await t.test('6. Responsive display scaling and multi-language alignment conformity', async () => {
    for (const lang of ['en', 'zh-CN', 'ja']) {
      for (const scale of [1.0, 1.25, 1.5, 2.0]) {
        await session.setViewport(368, 600, scale);
        await session.evaluate(`(function(l) {
          const sel = document.getElementById('langSelect');
          sel.value = l;
          sel.dispatchEvent(new Event('change'));
        })('${lang}')`);
        await new Promise(r => setTimeout(r, 100));

        const resCheck = await session.evaluate(`{
          clientWidth: document.body.clientWidth,
          scrollWidth: document.body.scrollWidth,
          headerSpaceGap: document.querySelector('.header-right').getBoundingClientRect().left - document.querySelector('.brand').getBoundingClientRect().right
        }`);

        assert.strictEqual(
          resCheck.scrollWidth <= resCheck.clientWidth + 1,
          true,
          `Scale ${scale} in ${lang} must not produce horizontal overflow`
        );
        assert.ok(
          resCheck.headerSpaceGap >= 0,
          `Header controls must not collide (space gap: ${resCheck.headerSpaceGap}px in ${lang} at ${scale}x)`
        );
      }
    }
  });

  await t.test('7. Console errors check across all interactions', async () => {
    assert.deepStrictEqual(session.consoleErrors, [], 'There must be zero console errors');
  });
});
