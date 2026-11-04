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

// Helper to launch isolated Chrome session with CDP
async function launchChromeSession(port, debugPort) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-sync-state-test-'));
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

  const close = () => {
    try { ws.close(); } catch {}
    try { chrome.kill(); } catch {}
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  };

  return { navigate, evaluate, close, consoleErrors };
}

test('Manual Update Synchronization State & Persistence Suite', async (t) => {

  await t.test('1. StorageManager maintains and normalizes synchronization state', async () => {
    const mockStorage = createMockStorage();

    // Initial state is default
    const initialSync = await StorageManager.getSyncState(mockStorage);
    assert.deepStrictEqual(initialSync, StorageManager.DEFAULT_SYNC_STATE);
    assert.strictEqual(initialSync.lastSyncCommit, '');
    assert.strictEqual(initialSync.updateStatus, 'UP_TO_DATE');

    // Record successful sync
    const record1 = await StorageManager.recordSuccessfulSync({
      commit: 'a1b2c3d',
      fullCommit: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
      latestCommit: 'a1b2c3d feat: initial sync test'
    }, mockStorage);

    assert.strictEqual(record1.lastSyncCommit, 'a1b2c3d');
    assert.strictEqual(record1.lastSyncFullCommit, 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678');
    assert.ok(record1.lastSyncTime !== null);
    assert.ok(record1.syncedCommits.includes('a1b2c3d'));
    assert.strictEqual(record1.updateStatus, 'UP_TO_DATE');

    // Retrieve again and verify persistence
    const retrieved = await StorageManager.getSyncState(mockStorage);
    assert.strictEqual(retrieved.lastSyncCommit, 'a1b2c3d');
    assert.strictEqual(retrieved.syncedCommits.length, 1);

    // Record a second sync
    const record2 = await StorageManager.recordSuccessfulSync({
      commit: 'f9e8d7c',
      incomingCommits: ['f9e8d7c feat: second sync test', 'b2c3d4e fix: bug fix']
    }, mockStorage);

    assert.strictEqual(record2.lastSyncCommit, 'f9e8d7c');
    assert.ok(record2.syncedCommits.includes('f9e8d7c'));
    assert.ok(record2.syncedCommits.includes('b2c3d4e'));
    assert.ok(record2.syncedCommits.includes('a1b2c3d'));
  });

  await t.test('2. VersionInfo dynamically accepts updated commits via setCommit', () => {
    const originalCommit = VersionInfo.commit;
    const originalFull = VersionInfo.fullCommit;

    VersionInfo.setCommit('9876543 feat: update commit test', '9876543210abcdef9876543210abcdef98765432');
    assert.strictEqual(VersionInfo.commit, '9876543');
    assert.strictEqual(VersionInfo.fullCommit, '9876543210abcdef9876543210abcdef98765432');

    // Restore original commit
    VersionInfo.setCommit(originalCommit, originalFull);
  });

  await t.test('3. Updater checks compare against recorded state and prevent re-reporting synced updates', async () => {
    const mockStorage = createMockStorage();

    // Mock GitHub API server
    let mockRemoteCommits = [
      {
        sha: '2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e',
        commit: {
          message: 'feat: remote commit B',
          author: { date: '2026-10-31T10:00:00Z' }
        }
      },
      {
        sha: '1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d',
        commit: {
          message: 'feat: remote commit A',
          author: { date: '2026-10-31T09:00:00Z' }
        }
      },
      {
        sha: 'c24fcf0882ac7a24833133d03ddefcd6f08739e5',
        commit: {
          message: 'chore: release v1.5 base',
          author: { date: '2026-10-31T08:00:00Z' }
        }
      }
    ];

    const mockApiServer = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json');
      if (req.url.startsWith('/commits')) {
        res.writeHead(200);
        res.end(JSON.stringify(mockRemoteCommits));
      } else {
        res.writeHead(404);
        res.end('{}');
      }
    });

    const API_PORT = 8192;
    await new Promise(r => mockApiServer.listen(API_PORT, r));

    try {
      // Step A: Check updates starting at base commit c24fcf0
      const check1 = await Updater.checkForUpdates({
        localEndpoint: null, // Force GitHub REST API check
        apiUrl: `http://127.0.0.1:${API_PORT}`,
        localCommit: 'c24fcf0'
      });

      assert.strictEqual(check1.upToDate, false);
      assert.strictEqual(check1.status, 'UPDATE_AVAILABLE');
      assert.strictEqual(check1.behindCount, 2);
      assert.strictEqual(check1.incomingCommits.length, 2);
      assert.ok(check1.incomingCommits[0].includes('2b3c4d5'));
      assert.ok(check1.incomingCommits[1].includes('1a2b3c4'));

      // Step B: Record successful synchronization of the latest commit (2b3c4d5)
      await StorageManager.recordSuccessfulSync({
        commit: '2b3c4d5',
        fullCommit: '2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e',
        incomingCommits: check1.incomingCommits
      }, mockStorage);

      // Verify effective commit resolution
      Updater.lastSyncCommit = '2b3c4d5';
      const resolvedCommit = await Updater.resolveLocalCommit({ localCommit: null });
      assert.strictEqual(resolvedCommit, '2b3c4d5');

      // Step C: Subsequent update check against the SAME remote commits
      const check2 = await Updater.checkForUpdates({
        localEndpoint: null,
        apiUrl: `http://127.0.0.1:${API_PORT}`,
        localCommit: '2b3c4d5'
      });

      assert.strictEqual(check2.upToDate, true, 'Subsequent check MUST report up to date');
      assert.strictEqual(check2.status, 'UP_TO_DATE');
      assert.strictEqual(check2.behindCount, 0, 'Behind count must be 0');
      assert.deepStrictEqual(check2.incomingCommits, [], 'No incoming commits may be reported');

      // Step D: Genuinely new commit arrives on remote
      mockRemoteCommits.unshift({
        sha: '3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f',
        commit: {
          message: 'feat: brand new remote commit C',
          author: { date: '2026-10-31T11:00:00Z' }
        }
      });

      const check3 = await Updater.checkForUpdates({
        localEndpoint: null,
        apiUrl: `http://127.0.0.1:${API_PORT}`,
        localCommit: '2b3c4d5'
      });

      assert.strictEqual(check3.upToDate, false);
      assert.strictEqual(check3.status, 'UPDATE_AVAILABLE');
      assert.strictEqual(check3.behindCount, 1, 'Only the genuinely new commit C must be detected');
      assert.strictEqual(check3.incomingCommits.length, 1);
      assert.ok(check3.incomingCommits[0].includes('3c4d5e6'));
      assert.ok(!check3.incomingCommits[0].includes('2b3c4d5'), 'Previously synced commit must not be in incoming list');
    } finally {
      mockApiServer.close();
    }
  });

  await t.test('4. End-to-End browser UI: Manual update, instant refresh, and repeat click up-to-date verification', async () => {
    const SERVER_PORT = 8191;
    const DEBUG_PORT = 9241;

    let serverSyncState = {
      upToDate: false,
      behindCount: 2,
      incomingCommits: [
        '7a8b9c0 feat: new feature 2',
        '6a7b8c9 feat: new feature 1'
      ],
      latestCommit: '7a8b9c0 feat: new feature 2'
    };

    let syncPerformCount = 0;

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
        res.end(JSON.stringify({
          success: true,
          upToDate: serverSyncState.upToDate,
          behindCount: serverSyncState.behindCount,
          aheadCount: 0,
          incomingCommits: serverSyncState.incomingCommits,
          hasLocalChanges: false
        }));
        return;
      }

      if (pathname === '/api/sync/perform' && req.method === 'POST') {
        syncPerformCount++;
        // Simulate remote changes synced to working tree
        serverSyncState.upToDate = true;
        serverSyncState.behindCount = 0;
        serverSyncState.incomingCommits = [];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          latestCommit: serverSyncState.latestCommit,
          commit: '7a8b9c0',
          stashedChangesRestored: false
        }));
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

    try {
      await session.navigate('/popup/popup.html');

      // Point Updater to test server
      await session.evaluate(`Updater.localEndpoint = 'http://127.0.0.1:${SERVER_PORT}'`);

      // 1. Initial check: detects updates
      await session.evaluate(`document.getElementById('checkUpdateBtn').click()`);
      await new Promise(r => setTimeout(r, 250));

      const state1 = await session.evaluate(`{
        badgeText: document.getElementById('syncStatusBadge').textContent.trim(),
        badgeClass: document.getElementById('syncStatusBadge').className,
        syncBtnVisible: !document.getElementById('syncNowBtn').classList.contains('hidden'),
        incomingCount: document.querySelectorAll('#syncCommitsList li').length
      }`);

      assert.ok(state1.badgeClass.includes('badge-update'));
      assert.strictEqual(state1.syncBtnVisible, true);
      assert.strictEqual(state1.incomingCount, 2);

      // 2. Click Update & Sync button
      await session.evaluate(`document.getElementById('syncNowBtn').click()`);
      await new Promise(r => setTimeout(r, 300));

      assert.strictEqual(syncPerformCount, 1, 'Sync perform must be executed');

      const state2 = await session.evaluate(`{
        badgeText: document.getElementById('syncStatusBadge').textContent.trim(),
        badgeClass: document.getElementById('syncStatusBadge').className,
        hasUpdateClass: document.getElementById('checkUpdateBtn').classList.contains('has-update'),
        actionAreaHidden: document.getElementById('syncActionArea').classList.contains('hidden')
      }`);

      assert.ok(state2.badgeClass.includes('badge-success'), 'Must transition immediately to success badge');
      assert.strictEqual(state2.hasUpdateClass, false, 'has-update class must be removed immediately');
      assert.strictEqual(state2.actionAreaHidden, true, 'Action area must be hidden immediately');

      // Verify that sync state was persisted into storage
      const persistedSync = await session.evaluate(`StorageManager.getSyncState()`);
      assert.strictEqual(persistedSync.lastSyncCommit, '7a8b9c0');
      assert.strictEqual(persistedSync.updateStatus, 'UP_TO_DATE');

      // 3. Click Check for Updates button AGAIN!
      // Requirement: "After synchronization succeeds, click the update button again and verify that no previously synchronized updates are reported."
      await session.evaluate(`document.getElementById('checkUpdateBtn').click()`);
      await new Promise(r => setTimeout(r, 250));

      const state3 = await session.evaluate(`{
        badgeText: document.getElementById('syncStatusBadge').textContent.trim(),
        badgeClass: document.getElementById('syncStatusBadge').className,
        hasUpdateClass: document.getElementById('checkUpdateBtn').classList.contains('has-update'),
        actionAreaHidden: document.getElementById('syncActionArea').classList.contains('hidden'),
        detailsHidden: document.getElementById('syncDetailsBox').classList.contains('hidden')
      }`);

      assert.ok(state3.badgeClass.includes('badge-success'), 'Repeat click must report Up to Date');
      assert.ok(state3.badgeText.includes('Up to Date') || state3.badgeText.includes('已是最新') || state3.badgeText.includes('最新です'));
      assert.strictEqual(state3.hasUpdateClass, false);
      assert.strictEqual(state3.actionAreaHidden, true);
      assert.strictEqual(state3.detailsHidden, true);

      // 4. Reload / reopen popup to verify persisted state after session restart
      // Requirement: "Verify that the update status remains accurate after restarting the browser or reopening the extension."
      await session.navigate('/popup/popup.html');
      await session.evaluate(`Updater.localEndpoint = 'http://127.0.0.1:${SERVER_PORT}'`);

      const reopenedSyncState = await session.evaluate(`StorageManager.getSyncState()`);
      assert.strictEqual(reopenedSyncState.lastSyncCommit, '7a8b9c0', 'Persisted sync commit must survive page reload');

      // Click update button in reopened popup
      await session.evaluate(`document.getElementById('checkUpdateBtn').click()`);
      await new Promise(r => setTimeout(r, 250));

      const stateReopened = await session.evaluate(`{
        badgeText: document.getElementById('syncStatusBadge').textContent.trim(),
        badgeClass: document.getElementById('syncStatusBadge').className,
        hasUpdateClass: document.getElementById('checkUpdateBtn').classList.contains('has-update')
      }`);

      assert.ok(stateReopened.badgeClass.includes('badge-success'), 'Reopened popup must report Up to Date');
      assert.strictEqual(stateReopened.hasUpdateClass, false);

      // 5. Genuinely new commit arrives on server
      // Requirement: "Confirm that genuinely new GitHub commits are still detected correctly."
      serverSyncState = {
        upToDate: false,
        behindCount: 1,
        incomingCommits: ['8b9c0d1 feat: brand new feature 3'],
        latestCommit: '8b9c0d1 feat: brand new feature 3'
      };

      await session.evaluate(`document.getElementById('checkUpdateBtn').click()`);
      await new Promise(r => setTimeout(r, 250));

      const stateNewCommit = await session.evaluate(`{
        badgeText: document.getElementById('syncStatusBadge').textContent.trim(),
        badgeClass: document.getElementById('syncStatusBadge').className,
        hasUpdateClass: document.getElementById('checkUpdateBtn').classList.contains('has-update'),
        incomingItems: Array.from(document.querySelectorAll('#syncCommitsList li')).map(li => li.textContent.trim())
      }`);

      assert.ok(stateNewCommit.badgeClass.includes('badge-update'), 'Genuinely new commit must trigger Update Available');
      assert.strictEqual(stateNewCommit.hasUpdateClass, true);
      assert.strictEqual(stateNewCommit.incomingItems.length, 1);
      assert.ok(stateNewCommit.incomingItems[0].includes('8b9c0d1'));

      // 6. Verify zero console errors
      assert.deepStrictEqual(session.consoleErrors, [], 'Must have zero console errors');
    } finally {
      session.close();
      server.close();
    }
  });
});
