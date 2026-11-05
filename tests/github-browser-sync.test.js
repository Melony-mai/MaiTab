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
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-gh-sync-test-'));
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

test('Direct GitHub Synchronization Through Browser Suite', async (t) => {
  await t.test('1. Updater.syncFromGitHubDirect retrieves and applies latest commits directly via GitHub REST API', async () => {
    const mockStorage = createMockStorage();

    const mockGitHubCommits = [
      {
        sha: '9f8e7d6c5b4a3928170162534488592019283746',
        commit: {
          message: 'feat: direct browser sync integration',
          author: { name: 'MaiTab Developer', date: '2026-11-05T12:00:00Z' }
        }
      },
      {
        sha: '224a2cf91ae2aef2df307ceabe07f45b9d83d1ea',
        commit: {
          message: 'feat: fix cross-browser compatibility between Chrome and Edge in popup settings',
          author: { name: 'MaiTab Developer', date: '2026-11-04T20:14:14Z' }
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

    const API_PORT = 8211;
    await new Promise(r => apiServer.listen(API_PORT, r));
    t.after(() => apiServer.close());

    // Execute direct GitHub synchronization
    const result = await Updater.syncFromGitHubDirect({
      apiUrl: `http://127.0.0.1:${API_PORT}`,
      localCommit: '224a2cf'
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.source, 'github-direct');
    assert.strictEqual(result.status, 'UP_TO_DATE');
    assert.strictEqual(result.commit, '9f8e7d6');
    assert.strictEqual(result.fullCommit, '9f8e7d6c5b4a3928170162534488592019283746');
    assert.ok(result.latestCommit.includes('9f8e7d6'));
    assert.ok(result.latestCommit.includes('direct browser sync integration'));

    // Verify runtime commit update
    assert.strictEqual(VersionInfo.commit, '9f8e7d6');
    assert.strictEqual(Updater.lastSyncCommit, '9f8e7d6');

    // Verify subsequent update check reports UP_TO_DATE
    const checkAfterSync = await Updater.checkForUpdates({
      localEndpoint: null,
      apiUrl: `http://127.0.0.1:${API_PORT}`
    });

    assert.strictEqual(checkAfterSync.upToDate, true);
    assert.strictEqual(checkAfterSync.status, 'UP_TO_DATE');
    assert.strictEqual(checkAfterSync.behindCount, 0);
  });

  await t.test('2. Updater.performSync automatically falls back to GitHub sync when local bridge service is offline', async () => {
    const mockGitHubCommits = [
      {
        sha: 'abc1234567890abcdef1234567890abcdef12345',
        commit: {
          message: 'fix: optimize link evaluation speed',
          author: { name: 'MaiTab Developer', date: '2026-11-05T13:00:00Z' }
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

    const API_PORT = 8212;
    await new Promise(r => apiServer.listen(API_PORT, r));
    t.after(() => apiServer.close());

    // Point localEndpoint to an unreachable port to simulate real browser extension environment
    const result = await Updater.performSync({
      localEndpoint: 'http://127.0.0.1:54321', // Offline/unreachable endpoint
      apiUrl: `http://127.0.0.1:${API_PORT}`,
      localCommit: '224a2cf'
    });

    assert.strictEqual(result.success, true, 'performSync must succeed via direct GitHub fallback');
    assert.strictEqual(result.source, 'github-direct');
    assert.strictEqual(result.commit, 'abc1234');
    assert.strictEqual(result.fullCommit, 'abc1234567890abcdef1234567890abcdef12345');
    assert.ok(result.latestCommit.includes('optimize link evaluation speed'));
  });

  await t.test('3. End-to-End Browser UI: Direct GitHub update retrieval and one-click synchronization through browser', async () => {
    const SERVER_PORT = 8213;
    const API_PORT = 8214;
    const DEBUG_PORT = 9245;

    let mockGitHubCommits = [
      {
        sha: 'e5f6a7b8c9d0e1f2a3b4c5d6e7f8091a2b3c4d5e',
        commit: {
          message: 'feat: new enhanced popup animations',
          author: { name: 'MaiTab Developer', date: '2026-11-05T14:00:00Z' }
        }
      },
      {
        sha: '224a2cf91ae2aef2df307ceabe07f45b9d83d1ea',
        commit: {
          message: 'feat: fix cross-browser compatibility between Chrome and Edge in popup settings',
          author: { name: 'MaiTab Developer', date: '2026-11-04T20:14:14Z' }
        }
      }
    ];

    // Mock GitHub API Server
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

    // Static Server for extension popup
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

      // Configure Updater in browser session to check from mock GitHub API with offline local endpoint
      await session.evaluate(`(() => {
        Updater.localEndpoint = 'http://127.0.0.1:54322'; // Unreachable local bridge
        VersionInfo.apiUrl = 'http://127.0.0.1:${API_PORT}';
        VersionInfo.commit = '224a2cf';
      })()`);

      // 1. Click Check for Updates in popup
      await session.evaluate(`document.getElementById('checkUpdateBtn').click()`);
      await new Promise(r => setTimeout(r, 300));

      const checkState = await session.evaluate(`{
        badgeText: document.getElementById('syncStatusBadge').textContent.trim(),
        badgeClass: document.getElementById('syncStatusBadge').className,
        hasUpdateClass: document.getElementById('checkUpdateBtn').classList.contains('has-update'),
        syncNowVisible: !document.getElementById('syncNowBtn').classList.contains('hidden'),
        incomingItems: Array.from(document.querySelectorAll('#syncCommitsList li')).map(li => li.textContent.trim())
      }`);

      assert.ok(checkState.badgeClass.includes('badge-update'), 'Status badge must indicate update available');
      assert.strictEqual(checkState.hasUpdateClass, true, 'Check button must have has-update class');
      assert.strictEqual(checkState.syncNowVisible, true, 'Update & Sync button must be visible');
      assert.strictEqual(checkState.incomingItems.length, 1);
      assert.ok(checkState.incomingItems[0].includes('e5f6a7b'));
      assert.ok(checkState.incomingItems[0].includes('new enhanced popup animations'));

      // 2. Click "Update & Sync" button to trigger direct browser synchronization from GitHub
      await session.evaluate(`document.getElementById('syncNowBtn').click()`);
      await new Promise(r => setTimeout(r, 400));

      const syncResultState = await session.evaluate(`{
        badgeText: document.getElementById('syncStatusBadge').textContent.trim(),
        badgeClass: document.getElementById('syncStatusBadge').className,
        hasUpdateClass: document.getElementById('checkUpdateBtn').classList.contains('has-update'),
        actionAreaHidden: document.getElementById('syncActionArea').classList.contains('hidden'),
        detailsHidden: document.getElementById('syncDetailsBox').classList.contains('hidden')
      }`);

      assert.ok(syncResultState.badgeClass.includes('badge-success'), 'Badge must switch to success after browser sync');
      assert.strictEqual(syncResultState.hasUpdateClass, false, 'has-update class must be cleared');
      assert.strictEqual(syncResultState.actionAreaHidden, true, 'Action area must be hidden after sync');

      // Verify that sync state was persisted in browser storage
      const persisted = await session.evaluate(`StorageManager.getSyncState()`);
      assert.strictEqual(persisted.lastSyncCommit, 'e5f6a7b');
      assert.strictEqual(persisted.updateStatus, 'UP_TO_DATE');

      // 3. Click Check for Updates button AGAIN
      await session.evaluate(`document.getElementById('checkUpdateBtn').click()`);
      await new Promise(r => setTimeout(r, 300));

      const repeatCheckState = await session.evaluate(`{
        badgeText: document.getElementById('syncStatusBadge').textContent.trim(),
        badgeClass: document.getElementById('syncStatusBadge').className,
        hasUpdateClass: document.getElementById('checkUpdateBtn').classList.contains('has-update'),
        actionAreaHidden: document.getElementById('syncActionArea').classList.contains('hidden')
      }`);

      assert.ok(repeatCheckState.badgeClass.includes('badge-success'), 'Repeat check must confirm Up to Date');
      assert.strictEqual(repeatCheckState.hasUpdateClass, false);
      assert.strictEqual(repeatCheckState.actionAreaHidden, true);

      // Verify zero console errors
      assert.deepStrictEqual(session.consoleErrors, []);
    } finally {
      session.close();
    }
  });
});
