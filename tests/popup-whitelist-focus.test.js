const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');

// Helper to start an isolated static server
function startStaticServer(port = 8197) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const parsedUrl = new URL(req.url, `http://localhost:${port}`);
      let pathname = parsedUrl.pathname;
      if (pathname === '/') pathname = '/popup/popup.html';

      const filePath = path.join(rootDir, pathname);
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

    server.listen(port, () => resolve(server));
  });
}

// Helper to launch isolated Chrome session
async function launchChromeSession(port, debugPort) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-popup-whitelist-test-'));
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

  return { navigate, evaluate, setViewport, consoleErrors, close, send };
}

test('Whitelist Management and Focus Mode Control Suite', async (t) => {
  const SERVER_PORT = 8198;
  const DEBUG_PORT = 9230;
  const server = await startStaticServer(SERVER_PORT);
  const session = await launchChromeSession(SERVER_PORT, DEBUG_PORT);

  t.after(() => {
    session.close();
    server.close();
  });

  await t.test('Red-circled elements are cleanly removed from popup.html', () => {
    const popupHtml = fs.readFileSync(path.join(rootDir, 'popup/popup.html'), 'utf8');

    // Form elements from red circle must be absent
    assert.strictEqual(popupHtml.includes('id="addDomainForm"'), false, 'addDomainForm must be removed');
    assert.strictEqual(popupHtml.includes('id="domainInput"'), false, 'domainInput must be removed');
    assert.strictEqual(popupHtml.includes('id="popupNewDomainFocus"'), false, 'popupNewDomainFocus must be removed');
    assert.strictEqual(popupHtml.includes('id="addDomainBtn"'), false, 'addDomainBtn must be removed');
    assert.strictEqual(popupHtml.includes('data-i18n="whitelistDesc"'), false, 'whitelistDesc text must be removed');

    // Whitelist list container and empty state must remain
    assert.ok(popupHtml.includes('id="panelWhitelist"'), 'panelWhitelist container must exist');
    assert.ok(popupHtml.includes('id="whitelistUl"'), 'whitelistUl list must exist');
    assert.ok(popupHtml.includes('id="emptyWhitelist"'), 'emptyWhitelist empty state must exist');

    // Current Website section must have quick whitelist button and focus mode controls
    assert.ok(popupHtml.includes('id="quickWhitelistBtn"'), 'quickWhitelistBtn must exist');
    assert.ok(popupHtml.includes('id="currentSiteFocusRow"'), 'currentSiteFocusRow must exist');
    assert.ok(popupHtml.includes('id="currentSiteFocusToggle"'), 'currentSiteFocusToggle must exist');
    assert.ok(popupHtml.includes('id="currentSiteFocusText"'), 'currentSiteFocusText must exist');
  });

  await t.test('Current Website section provides direct Whitelist adding and Focus Mode toggle', async () => {
    await session.setViewport(368, 600, 1.0);

    // Mock chrome.tabs.query and chrome.storage on the page before script loads
    await session.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        (function() {
          function getStore() {
            try {
              const raw = localStorage.getItem('__mock_storage__');
              if (raw) return JSON.parse(raw);
            } catch (e) {}
            return {
              enabled: true,
              autoSwitch: false,
              whitelist: [],
              bypassList: [],
              openNextToCurrent: true,
              language: 'en',
              theme: 'dark'
            };
          }

          function setStore(items) {
            try {
              const cur = getStore();
              localStorage.setItem('__mock_storage__', JSON.stringify({ ...cur, ...items }));
            } catch (e) {}
          }

          const listeners = [];

          window.chrome = {
            tabs: {
              query: (queryInfo, cb) => {
                const tabs = [{ id: 101, url: 'https://github.com/trending', active: true }];
                if (typeof cb === 'function') cb(tabs);
                return Promise.resolve(tabs);
              }
            },
            storage: {
              sync: {
                get: (keys, cb) => {
                  const res = {};
                  const defaults = typeof keys === 'object' ? keys : {};
                  const stored = getStore();
                  Object.assign(res, defaults, stored);
                  if (typeof cb === 'function') cb(res);
                  return Promise.resolve(res);
                },
                set: (items, cb) => {
                  setStore(items);
                  listeners.forEach(l => l({ maitab_settings: { newValue: getStore() } }));
                  if (typeof cb === 'function') cb();
                  return Promise.resolve();
                }
              },
              local: {
                get: (keys, cb) => window.chrome.storage.sync.get(keys, cb),
                set: (items, cb) => window.chrome.storage.sync.set(items, cb)
              },
              onChanged: {
                addListener: (fn) => { listeners.push(fn); }
              }
            },
            runtime: {
              lastError: null
            }
          };
        })();
      `
    });

    await session.navigate('/popup/popup.html');

    // 1. Initial State: github.com detected, not whitelisted
    const initialCheck = await session.evaluate(`{
      domainText: document.getElementById('currentDomainText').textContent,
      whitelistBtnText: document.getElementById('quickWhitelistBtn').textContent.trim(),
      focusRowHidden: document.getElementById('currentSiteFocusRow').classList.contains('hidden'),
      whitelistCount: document.getElementById('whitelistCount').textContent.trim()
    }`);

    assert.strictEqual(initialCheck.domainText, 'github.com', 'Current domain text should display github.com');
    assert.strictEqual(initialCheck.whitelistBtnText, '+ Whitelist', 'Button should display "+ Whitelist" when not whitelisted');
    assert.strictEqual(initialCheck.focusRowHidden, true, 'Focus Mode row must be hidden when site is not whitelisted');
    assert.strictEqual(initialCheck.whitelistCount, '0', 'Initial whitelist count must be 0');

    // 2. Click "+ Whitelist" in the Current Website section
    await session.evaluate(`document.getElementById('quickWhitelistBtn').click()`);
    await new Promise(r => setTimeout(r, 150));

    // 3. Verify Added to Whitelist and Focus Mode switch appears
    const afterWhitelisted = await session.evaluate(`{
      whitelistBtnText: document.getElementById('quickWhitelistBtn').textContent.trim(),
      focusRowHidden: document.getElementById('currentSiteFocusRow').classList.contains('hidden'),
      focusChecked: document.getElementById('currentSiteFocusToggle').checked,
      focusModeText: document.getElementById('currentSiteFocusText').textContent.trim(),
      whitelistCount: document.getElementById('whitelistCount').textContent.trim(),
      firstItemDomain: document.querySelector('#whitelistUl .item-domain')?.textContent.trim(),
      firstItemBadge: document.querySelector('#whitelistUl .item-focus-badge')?.textContent.trim()
    }`);

    assert.strictEqual(afterWhitelisted.whitelistBtnText, '✓ Whitelisted', 'Button should now display "✓ Whitelisted"');
    assert.strictEqual(afterWhitelisted.focusRowHidden, false, 'Focus Mode row should now be visible');
    assert.strictEqual(afterWhitelisted.focusChecked, true, 'Default focus mode should be checked (Focused Mode)');
    assert.strictEqual(afterWhitelisted.focusModeText, 'Focused Mode', 'Focus mode text should read "Focused Mode"');
    assert.strictEqual(afterWhitelisted.whitelistCount, '1', 'Whitelist count should update to 1');
    assert.strictEqual(afterWhitelisted.firstItemDomain, 'github.com', 'Item domain should be github.com in whitelist list');
    assert.strictEqual(afterWhitelisted.firstItemBadge, 'Focus', 'Item in whitelist list should display "Focus" badge');

    // 4. Toggle Focus Mode switch to Background Mode (unchecked)
    await session.evaluate(`(function() {
      const toggle = document.getElementById('currentSiteFocusToggle');
      toggle.checked = false;
      toggle.dispatchEvent(new Event('change'));
    })()`);
    await new Promise(r => setTimeout(r, 150));

    // 5. Verify UI and List updated to Background Mode
    const afterBackgroundMode = await session.evaluate(`{
      focusChecked: document.getElementById('currentSiteFocusToggle').checked,
      focusModeText: document.getElementById('currentSiteFocusText').textContent.trim(),
      firstItemBadge: document.querySelector('#whitelistUl .item-focus-badge')?.textContent.trim()
    }`);

    assert.strictEqual(afterBackgroundMode.focusChecked, false, 'Focus toggle should be unchecked');
    assert.strictEqual(afterBackgroundMode.focusModeText, 'Background Mode', 'Focus mode text should read "Background Mode"');
    assert.strictEqual(afterBackgroundMode.firstItemBadge, 'Background', 'Whitelist list badge should now display "Background"');

    // 6. Reload the popup (simulating reopening popup or restarting browser)
    await session.navigate('/popup/popup.html');

    // 7. Verify configured Background Mode persisted across popup reopen
    const afterReopen = await session.evaluate(`{
      domainText: document.getElementById('currentDomainText').textContent,
      whitelistBtnText: document.getElementById('quickWhitelistBtn').textContent.trim(),
      focusRowHidden: document.getElementById('currentSiteFocusRow').classList.contains('hidden'),
      focusChecked: document.getElementById('currentSiteFocusToggle').checked,
      focusModeText: document.getElementById('currentSiteFocusText').textContent.trim(),
      whitelistCount: document.getElementById('whitelistCount').textContent.trim()
    }`);

    assert.strictEqual(afterReopen.domainText, 'github.com');
    assert.strictEqual(afterReopen.whitelistBtnText, '✓ Whitelisted');
    assert.strictEqual(afterReopen.focusRowHidden, false);
    assert.strictEqual(afterReopen.focusChecked, false, 'Background Mode should persist after reload');
    assert.strictEqual(afterReopen.focusModeText, 'Background Mode', 'Label should remain "Background Mode"');
    assert.strictEqual(afterReopen.whitelistCount, '1');

    // 8. Toggle back to Focused Mode
    await session.evaluate(`(function() {
      const toggle = document.getElementById('currentSiteFocusToggle');
      toggle.checked = true;
      toggle.dispatchEvent(new Event('change'));
    })()`);
    await new Promise(r => setTimeout(r, 150));

    const afterSwitchBack = await session.evaluate(`{
      focusChecked: document.getElementById('currentSiteFocusToggle').checked,
      focusModeText: document.getElementById('currentSiteFocusText').textContent.trim()
    }`);
    assert.strictEqual(afterSwitchBack.focusChecked, true);
    assert.strictEqual(afterSwitchBack.focusModeText, 'Focused Mode');

    // 9. Click "✓ Whitelisted" to remove from whitelist
    await session.evaluate(`document.getElementById('quickWhitelistBtn').click()`);
    await new Promise(r => setTimeout(r, 150));

    const afterRemoved = await session.evaluate(`{
      whitelistBtnText: document.getElementById('quickWhitelistBtn').textContent.trim(),
      focusRowHidden: document.getElementById('currentSiteFocusRow').classList.contains('hidden'),
      whitelistCount: document.getElementById('whitelistCount').textContent.trim(),
      emptyWhitelistVisible: !document.getElementById('emptyWhitelist').classList.contains('hidden')
    }`);

    assert.strictEqual(afterRemoved.whitelistBtnText, '+ Whitelist', 'Button should return to "+ Whitelist"');
    assert.strictEqual(afterRemoved.focusRowHidden, true, 'Focus row should be hidden after removal');
    assert.strictEqual(afterRemoved.whitelistCount, '0');
    assert.strictEqual(afterRemoved.emptyWhitelistVisible, true, 'Empty whitelist state should be visible');
  });

  await t.test('No console errors occurred during whitelist management interactions', () => {
    assert.deepStrictEqual(session.consoleErrors, []);
  });
});
