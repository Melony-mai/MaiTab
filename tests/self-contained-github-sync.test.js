const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');
const StorageManager = require('../common/storage.js');
const VersionInfo = require('../common/version-info.js');
const Updater = require('../common/updater.js');
const { findChromeBinary } = require('./browser-helper.js');

function createMockStorage(initial = {}) {
  let store = { ...initial };
  return {
    get: (defaults, callback) => {
      const result = { ...defaults };
      for (const key of Object.keys(defaults)) {
        if (key in store) {
          result[key] = store[key];
        }
      }
      callback(result);
    },
    set: (items, callback) => {
      store = { ...store, ...items };
      callback();
    },
    _getStore: () => store
  };
}

async function launchChromeSession(port, debugPort) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-self-contained-sync-'));
  const chromePath = findChromeBinary();
  const chrome = spawn(chromePath, [
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

  const close = () => {
    try { ws.close(); } catch {}
    try { chrome.kill(); } catch {}
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  };

  return { navigate, evaluate, close, consoleErrors };
}

test('Self-Contained GitHub Repository Synchronization Suite (v1.6)', async (t) => {

  await t.test('1. Extension default configuration is fully self-contained without local bridge', () => {
    assert.strictEqual(Updater.DEFAULT_LOCAL_ENDPOINT, null, 'DEFAULT_LOCAL_ENDPOINT must be null');
    assert.strictEqual(Updater.localEndpoint, null, 'Updater.localEndpoint must default to null');
    assert.strictEqual(VersionInfo.version, '1.6', 'VersionInfo.version must report 1.6');
    assert.strictEqual(VersionInfo.fullVersion, '1.6.0', 'VersionInfo.fullVersion must report 1.6.0');
  });

  await t.test('2. Manifest contains host permissions for GitHub APIs', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'manifest.json'), 'utf8'));
    assert.strictEqual(manifest.version, '1.6');
    assert.ok(Array.isArray(manifest.host_permissions), 'manifest must have host_permissions');
    assert.ok(manifest.host_permissions.some(p => p.includes('api.github.com')));
    assert.ok(manifest.host_permissions.some(p => p.includes('raw.githubusercontent.com')));
  });

  await t.test('3. Direct GitHub update check and commit retrieval without any running local server', async () => {
    const mockCommits = [
      {
        sha: '7a8b9c0d1e2f3a4b5c6d7e8f90123456789abcde',
        commit: {
          message: 'feat: add enhanced link preview tooltip',
          author: { name: 'MaiTab Developer', date: '2026-11-05T15:00:00Z' }
        }
      },
      {
        sha: '6b5a4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b',
        commit: {
          message: 'fix: optimize storage persistence latency',
          author: { name: 'MaiTab Developer', date: '2026-11-05T14:30:00Z' }
        }
      },
      {
        sha: '2b778923a4b958864789dfca68ff6636aa712a2a',
        commit: {
          message: 'chore: release v1.6',
          author: { name: 'MaiTab Developer', date: '2026-11-05T14:00:00Z' }
        }
      }
    ];

    const apiServer = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'application/json');
      if (req.url.startsWith('/commits')) {
        res.writeHead(200);
        res.end(JSON.stringify(mockCommits));
      } else if (req.url.startsWith('/contents/manifest.json')) {
        res.writeHead(200);
        res.end(JSON.stringify({ version: '1.6' }));
      } else {
        res.writeHead(404);
        res.end('{}');
      }
    });

    const API_PORT = 8321;
    await new Promise(r => apiServer.listen(API_PORT, r));
    t.after(() => apiServer.close());

    // Check updates with localEndpoint = null (fully self-contained)
    const checkResult = await Updater.checkForUpdates({
      apiUrl: `http://127.0.0.1:${API_PORT}`,
      localCommit: '2b77892'
    });

    assert.strictEqual(checkResult.success, true);
    assert.strictEqual(checkResult.source, 'github-api');
    assert.strictEqual(checkResult.status, 'UPDATE_AVAILABLE');
    assert.strictEqual(checkResult.upToDate, false);
    assert.strictEqual(checkResult.behindCount, 2);
    assert.strictEqual(checkResult.incomingCommits.length, 2);
    assert.ok(checkResult.incomingCommits[0].includes('7a8b9c0'));
    assert.ok(checkResult.incomingCommits[0].includes('add enhanced link preview tooltip'));
    assert.ok(checkResult.incomingCommits[1].includes('6b5a4c3'));
    assert.ok(checkResult.incomingCommits[1].includes('optimize storage persistence latency'));

    // Perform direct GitHub synchronization through browser
    const syncResult = await Updater.performSync({
      apiUrl: `http://127.0.0.1:${API_PORT}`,
      localCommit: '2b77892',
      targetCommit: '7a8b9c0',
      latestCommit: checkResult.latestCommit,
      incomingCommits: checkResult.incomingCommits
    });

    assert.strictEqual(syncResult.success, true);
    assert.strictEqual(syncResult.source, 'github-direct');
    assert.strictEqual(syncResult.status, 'UP_TO_DATE');
    assert.strictEqual(syncResult.commit, '7a8b9c0');
    assert.strictEqual(syncResult.fullCommit, '7a8b9c0d1e2f3a4b5c6d7e8f90123456789abcde');

    // Subsequent check confirms Up to Date
    const checkAfterSync = await Updater.checkForUpdates({
      apiUrl: `http://127.0.0.1:${API_PORT}`
    });
    assert.strictEqual(checkAfterSync.upToDate, true);
    assert.strictEqual(checkAfterSync.status, 'UP_TO_DATE');
    assert.strictEqual(checkAfterSync.behindCount, 0);
  });

  await t.test('4. End-to-End Real Browser: Self-contained manual update check & sync with zero local server', async () => {
    const SERVER_PORT = 8322;
    const API_PORT = 8323;
    const DEBUG_PORT = 9323;

    let mockGitHubCommits = [
      {
        sha: '99887766554433221100aabbccddeeff00112233',
        commit: {
          message: 'feat: add smooth tab animations for macOS style',
          author: { name: 'MaiTab Developer', date: '2026-11-05T16:00:00Z' }
        }
      },
      {
        sha: '2b778923a4b958864789dfca68ff6636aa712a2a',
        commit: {
          message: 'chore: release v1.6',
          author: { name: 'MaiTab Developer', date: '2026-11-05T14:00:00Z' }
        }
      }
    ];

    const apiServer = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'application/json');
      if (req.url.startsWith('/commits')) {
        res.writeHead(200);
        res.end(JSON.stringify(mockGitHubCommits));
      } else {
        res.writeHead(404);
        res.end('{}');
      }
    });

    await new Promise(r => apiServer.listen(API_PORT, r));
    t.after(() => apiServer.close());

    // Static server serving extension files (simulates browser loading extension)
    const staticServer = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      const parsedUrl = new URL(req.url, `http://localhost:${SERVER_PORT}`);
      let filePath = path.join(rootDir, parsedUrl.pathname === '/' ? '/popup/popup.html' : parsedUrl.pathname);

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

    await new Promise(r => staticServer.listen(SERVER_PORT, r));
    t.after(() => staticServer.close());

    const session = await launchChromeSession(SERVER_PORT, DEBUG_PORT);

    try {
      await session.navigate('/popup/popup.html');

      // Verify initial v1.6 version badge
      const initialBadge = await session.evaluate(`document.querySelector('.brand-text .badge').textContent.trim()`);
      assert.strictEqual(initialBadge, 'v1.6', 'Initial version badge must be v1.6');

      // Configure VersionInfo.apiUrl to test server, but leave Updater.localEndpoint = null (self-contained!)
      await session.evaluate(`(() => {
        Updater.localEndpoint = null;
        VersionInfo.apiUrl = 'http://127.0.0.1:${API_PORT}';
        VersionInfo.commit = '2b77892';
      })()`);

      // 1. User clicks "Check" button
      await session.evaluate(`document.getElementById('checkUpdateBtn').click()`);
      await new Promise(r => setTimeout(r, 350));

      const checkUi = await session.evaluate(`{
        badgeText: document.getElementById('syncStatusBadge').textContent.trim(),
        badgeClass: document.getElementById('syncStatusBadge').className,
        hasUpdateClass: document.getElementById('checkUpdateBtn').classList.contains('has-update'),
        syncNowVisible: !document.getElementById('syncNowBtn').classList.contains('hidden'),
        commitList: Array.from(document.querySelectorAll('#syncCommitsList li')).map(li => li.textContent.trim())
      }`);

      assert.ok(checkUi.badgeClass.includes('badge-update'), 'Status badge must show update available');
      assert.strictEqual(checkUi.hasUpdateClass, true, 'Check button must show has-update indicator');
      assert.strictEqual(checkUi.syncNowVisible, true, 'Update & Sync button must be visible');
      assert.strictEqual(checkUi.commitList.length, 1);
      assert.ok(checkUi.commitList[0].includes('9988776'));
      assert.ok(checkUi.commitList[0].includes('add smooth tab animations'));

      // 2. User clicks "Update & Sync" button
      await session.evaluate(`document.getElementById('syncNowBtn').click()`);
      await new Promise(r => setTimeout(r, 400));

      const syncedUi = await session.evaluate(`{
        badgeText: document.getElementById('syncStatusBadge').textContent.trim(),
        badgeClass: document.getElementById('syncStatusBadge').className,
        hasUpdateClass: document.getElementById('checkUpdateBtn').classList.contains('has-update'),
        actionAreaHidden: document.getElementById('syncActionArea').classList.contains('hidden'),
        detailsHidden: document.getElementById('syncDetailsBox').classList.contains('hidden')
      }`);

      assert.ok(syncedUi.badgeClass.includes('badge-success'), 'Status badge must switch to success');
      assert.strictEqual(syncedUi.hasUpdateClass, false, 'has-update indicator must be cleared');
      assert.strictEqual(syncedUi.actionAreaHidden, true, 'Sync action area must hide after sync');
      assert.strictEqual(syncedUi.detailsHidden, true, 'Commit details must hide after sync');

      // 3. Verify sync state was saved in browser storage
      const savedSyncState = await session.evaluate(`StorageManager.getSyncState()`);
      assert.strictEqual(savedSyncState.lastSyncCommit, '9988776');
      assert.strictEqual(savedSyncState.updateStatus, 'UP_TO_DATE');
      assert.ok(savedSyncState.syncedCommits.includes('9988776'));

      // 4. Click Check for Updates again
      await session.evaluate(`document.getElementById('checkUpdateBtn').click()`);
      await new Promise(r => setTimeout(r, 300));

      const repeatCheck = await session.evaluate(`{
        badgeText: document.getElementById('syncStatusBadge').textContent.trim(),
        badgeClass: document.getElementById('syncStatusBadge').className,
        hasUpdateClass: document.getElementById('checkUpdateBtn').classList.contains('has-update'),
        actionAreaHidden: document.getElementById('syncActionArea').classList.contains('hidden')
      }`);

      assert.ok(repeatCheck.badgeClass.includes('badge-success'), 'Repeat check must confirm Up to Date');
      assert.strictEqual(repeatCheck.hasUpdateClass, false);

      // Verify zero console errors throughout session
      assert.deepStrictEqual(session.consoleErrors, [], `No console errors: ${session.consoleErrors.join(', ')}`);
    } finally {
      session.close();
    }
  });
});
