const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');

// Helper to start a local static file server
function startStaticServer(port = 8205) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

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

// Find available browsers
function getBrowserBinaries() {
  const candidates = [
    // Windows candidates
    { name: 'Google Chrome', path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' },
    { name: 'Google Chrome (x86)', path: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe' },
    process.env.LOCALAPPDATA ? { name: 'Google Chrome (user)', path: path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe') } : null,
    { name: 'Microsoft Edge (x86)', path: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' },
    { name: 'Microsoft Edge', path: 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe' },
    process.env.LOCALAPPDATA ? { name: 'Microsoft Edge (user)', path: path.join(process.env.LOCALAPPDATA, 'Microsoft\\Edge\\Application\\msedge.exe') } : null,
    // Linux candidates
    { name: 'Google Chrome', path: '/usr/sbin/google-chrome-stable' },
    { name: 'Google Chrome (bin)', path: '/usr/bin/google-chrome-stable' },
    { name: 'Microsoft Edge', path: path.join(os.homedir(), '.local/bin/microsoft-edge') },
    { name: 'Microsoft Edge (system)', path: '/usr/bin/microsoft-edge' },
    // macOS candidates
    { name: 'Google Chrome', path: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' },
    { name: 'Microsoft Edge', path: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge' }
  ].filter(Boolean);

  const browsers = [];
  const seenPaths = new Set();
  const seenFamilies = new Set();
  for (const c of candidates) {
    if (fs.existsSync(c.path)) {
      const real = fs.realpathSync(c.path);
      const family = c.name.includes('Edge') ? 'Edge' : 'Chrome';
      if (!seenPaths.has(real) && !seenFamilies.has(family)) {
        seenPaths.add(real);
        seenFamilies.add(family);
        browsers.push({ name: family === 'Edge' ? 'Microsoft Edge' : 'Google Chrome', path: c.path });
      }
    }
  }
  return browsers;
}

// Helper to launch browser with CDP
async function launchBrowserSession(binaryPath, port, debugPort) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-test-'));
  const proc = spawn(binaryPath, [
    '--headless=new',
    `--remote-debugging-port=${debugPort}`,
    '--no-sandbox',
    `--user-data-dir=${tmpDir}`,
    'about:blank'
  ]);

  let targetPage = null;
  for (let i = 0; i < 30; i++) {
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
    proc.kill();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    throw new Error(`Failed to connect to browser CDP at ${binaryPath}`);
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
    try { proc.kill(); } catch {}
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  };

  return { navigate, evaluate, setViewport, consoleErrors, close };
}

test('Cross-Browser Compatibility Suite (Chrome & Edge)', async (t) => {
  const SERVER_PORT = 8206;
  const server = await startStaticServer(SERVER_PORT);

  t.after(() => {
    server.close();
  });

  const browsers = getBrowserBinaries();
  assert.ok(browsers.length >= 2, `Both Chrome and Edge must be available for testing (found: ${browsers.map(b => b.name).join(', ')})`);

  let debugPortBase = 9310;

  for (const browser of browsers) {
    await t.test(`Browser: ${browser.name} (${browser.path})`, async (bt) => {
      const debugPort = debugPortBase++;
      const session = await launchBrowserSession(browser.path, SERVER_PORT, debugPort);

      bt.after(() => {
        session.close();
      });

      await bt.test('Popup UI fixed dimensions and zero horizontal scrollbar', async () => {
        await session.setViewport(368, 600, 1.0);
        await session.navigate('/popup/popup.html');

        const metrics = await session.evaluate(`{
          htmlClientWidth: document.documentElement.clientWidth,
          htmlScrollWidth: document.documentElement.scrollWidth,
          htmlOverflowX: getComputedStyle(document.documentElement).overflowX,
          htmlOverflowY: getComputedStyle(document.documentElement).overflowY,
          bodyClientWidth: document.body.clientWidth,
          bodyScrollWidth: document.body.scrollWidth,
          bodyOverflowX: getComputedStyle(document.body).overflowX,
          bodyOverflowY: getComputedStyle(document.body).overflowY,
          brandTitle: document.querySelector('.brand-title').textContent,
          badgeText: document.querySelector('.badge').textContent,
          cardRadius: getComputedStyle(document.querySelector('.card')).borderRadius,
          sliderWidth: document.querySelector('.slider').clientWidth,
          sliderHeight: document.querySelector('.slider').clientHeight
        }`);

        // Verify zero horizontal scrolling or clipping
        assert.ok(
          metrics.bodyScrollWidth <= metrics.bodyClientWidth + 1,
          `Body scrollWidth (${metrics.bodyScrollWidth}) must not exceed clientWidth (${metrics.bodyClientWidth})`
        );
        assert.ok(
          metrics.htmlScrollWidth <= metrics.htmlClientWidth + 1,
          `HTML scrollWidth (${metrics.htmlScrollWidth}) must not exceed clientWidth (${metrics.htmlClientWidth})`
        );

        // Verify root layout properties
        assert.strictEqual(metrics.bodyClientWidth, 368, 'Body width must be exactly 368px');
        assert.strictEqual(metrics.brandTitle, 'MaiTab');
        assert.strictEqual(metrics.badgeText, 'v1.5');
        assert.strictEqual(metrics.cardRadius, '10px');
        assert.strictEqual(metrics.sliderWidth, 38);
        assert.strictEqual(metrics.sliderHeight, 22);
      });

      await bt.test('Display scaling compatibility (100%, 125%, 150%, 200%) without overflow or clipping', async () => {
        const scales = [1.0, 1.25, 1.5, 2.0];
        for (const scale of scales) {
          await session.setViewport(368, 600, scale);
          await session.navigate('/popup/popup.html');

          const check = await session.evaluate(`{
            bodyClientWidth: document.body.clientWidth,
            bodyScrollWidth: document.body.scrollWidth,
            headerScrollWidth: document.querySelector('.header').scrollWidth,
            headerClientWidth: document.querySelector('.header').clientWidth
          }`);

          assert.ok(
            check.bodyScrollWidth <= check.bodyClientWidth + 1,
            `Scale ${scale * 100}% must not cause body overflow (scrollWidth: ${check.bodyScrollWidth}, clientWidth: ${check.bodyClientWidth})`
          );
          assert.ok(
            check.headerScrollWidth <= check.headerClientWidth + 1,
            `Scale ${scale * 100}% must not cause header overflow (scrollWidth: ${check.headerScrollWidth}, clientWidth: ${check.headerClientWidth})`
          );
        }
      });

      await bt.test('Form control font inheritance and Edge reset conformity', async () => {
        await session.setViewport(368, 600, 1.0);
        await session.navigate('/popup/popup.html');

        const fontStyles = await session.evaluate(`{
          bodyFont: getComputedStyle(document.body).fontFamily,
          selectFont: getComputedStyle(document.getElementById('langSelect')).fontFamily,
          themeSelectFont: getComputedStyle(document.getElementById('popupThemeSelect')).fontFamily,
          btnFont: getComputedStyle(document.getElementById('checkUpdateBtn')).fontFamily,
          inputFont: getComputedStyle(document.getElementById('bypassInput')).fontFamily
        }`);

        // Verify font stack includes native Segoe UI for Windows / Edge alongside Apple SF Pro
        assert.ok(
          fontStyles.bodyFont.includes('Segoe UI') || fontStyles.bodyFont.includes('SF Pro') || fontStyles.bodyFont.includes('-apple-system'),
          `Font stack must include platform UI fonts: ${fontStyles.bodyFont}`
        );

        // Verify form controls inherit the font rather than falling back to browser-specific defaults
        assert.strictEqual(fontStyles.selectFont, fontStyles.bodyFont, 'Select menu must inherit body font family');
        assert.strictEqual(fontStyles.themeSelectFont, fontStyles.bodyFont, 'Theme select must inherit body font family');
        assert.strictEqual(fontStyles.btnFont, fontStyles.bodyFont, 'Buttons must inherit body font family');
        assert.strictEqual(fontStyles.inputFont, fontStyles.bodyFont, 'Inputs must inherit body font family');
      });

      await bt.test('Button text rendering and single-line layout across languages (en, ja, zh-CN)', async () => {
        await session.navigate('/popup/popup.html');
        await session.evaluate(`document.getElementById('tabBtnBypass').click()`);

        for (const lang of ['en', 'ja', 'zh-CN']) {
          for (const scale of [1.0, 1.25, 1.5, 2.0]) {
            await session.setViewport(368, 600, scale);
            await session.evaluate(`(function(l) {
              const sel = document.getElementById('langSelect');
              sel.value = l;
              sel.dispatchEvent(new Event('change'));
            })('${lang}')`);
            await new Promise(r => setTimeout(r, 60));

            const btnState = await session.evaluate(`(() => {
              const btn = document.getElementById('addBypassBtn');
              const range = document.createRange();
              range.selectNodeContents(btn);
              const rects = Array.from(range.getClientRects());
              const style = window.getComputedStyle(btn);
              return {
                text: btn.textContent.trim(),
                lineCount: rects.length,
                whiteSpace: style.whiteSpace,
                overflowsVertically: btn.scrollHeight > btn.clientHeight
              };
            })()`);

            assert.strictEqual(btnState.whiteSpace, 'nowrap');
            assert.strictEqual(btnState.lineCount, 1, `Button "${btnState.text}" in ${lang} at ${scale}x must be single line`);
            assert.strictEqual(btnState.overflowsVertically, false);
          }
        }
      });

      await bt.test('Interactive settings and controls function correctly', async () => {
        await session.setViewport(368, 600, 1.0);
        await session.navigate('/popup/popup.html');

        // 1. Toggle master switch
        const masterToggled = await session.evaluate(`(() => {
          const toggle = document.getElementById('masterEnabledToggle');
          toggle.click();
          return toggle.checked;
        })()`);
        assert.strictEqual(masterToggled, false, 'Master toggle should switch to off');

        // 2. Toggle back to on
        await session.evaluate(`document.getElementById('masterEnabledToggle').click()`);

        // 3. Tab switching between Whitelist and Complete Bypass
        await session.evaluate(`document.getElementById('tabBtnBypass').click()`);
        const bypassTab = await session.evaluate(`({
          whitelistHidden: document.getElementById('panelWhitelist').classList.contains('hidden'),
          bypassHidden: document.getElementById('panelBypass').classList.contains('hidden')
        })`);
        assert.strictEqual(bypassTab.whitelistHidden, true);
        assert.strictEqual(bypassTab.bypassHidden, false);

        await session.evaluate(`document.getElementById('tabBtnWhitelist').click()`);
        const whitelistTab = await session.evaluate(`({
          whitelistHidden: document.getElementById('panelWhitelist').classList.contains('hidden'),
          bypassHidden: document.getElementById('panelBypass').classList.contains('hidden')
        })`);
        assert.strictEqual(whitelistTab.whitelistHidden, false);
        assert.strictEqual(whitelistTab.bypassHidden, true);

        // 4. Theme appearance switching (System -> Light -> Dark)
        await session.evaluate(`(() => {
          const themeSel = document.getElementById('popupThemeSelect');
          themeSel.value = 'light';
          themeSel.dispatchEvent(new Event('change'));
        })()`);
        const lightThemeAttr = await session.evaluate(`document.documentElement.getAttribute('data-theme')`);
        assert.strictEqual(lightThemeAttr, 'light', 'Theme should switch to light');

        await session.evaluate(`(() => {
          const themeSel = document.getElementById('popupThemeSelect');
          themeSel.value = 'dark';
          themeSel.dispatchEvent(new Event('change'));
        })()`);
        const darkThemeAttr = await session.evaluate(`document.documentElement.getAttribute('data-theme')`);
        assert.strictEqual(darkThemeAttr, 'dark', 'Theme should switch to dark');

        // 5. Check Update trigger & Banner rendering
        await session.evaluate(`(() => {
          document.getElementById('checkUpdateBtn').click();
        })()`);
        const bannerVisible = await session.evaluate(`!document.getElementById('syncStatusBanner').classList.contains('hidden')`);
        assert.strictEqual(bannerVisible, true, 'Sync status banner should become visible upon checking updates');
      });

      await bt.test('Zero console errors throughout session', () => {
        assert.deepStrictEqual(session.consoleErrors, [], `No console errors allowed in ${browser.name}`);
      });
    });
  }
});
