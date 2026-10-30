const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');

// Helper to start a local static file server
function startStaticServer(port = 8192) {
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

// Helper to launch isolated Chrome with CDP
async function launchChromeSession(port, debugPort) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-ui-test-'));
  const chrome = spawn('/usr/bin/google-chrome-stable', [
    '--headless=new',
    `--remote-debugging-port=${debugPort}`,
    '--no-sandbox',
    `--user-data-dir=${tmpDir}`,
    'about:blank'
  ]);

  // Wait for remote debugging to be ready
  let targetPage = null;
  for (let i = 0; i < 20; i++) {
    try {
      const listRes = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      const pages = await listRes.json();
      targetPage = pages.find(p => p.type === 'page' && p.webSocketDebuggerUrl);
      if (targetPage) {
        break;
      }
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
      expression: `(function() {
        const val = ${expr.trim().startsWith('{') ? '(' + expr + ')' : expr};
        return val === undefined ? null : JSON.stringify(val);
      })()`,
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

  return { navigate, evaluate, setViewport, consoleErrors, close };
}

test('UI Specification and Responsive Compatibility', async (t) => {
  const SERVER_PORT = 8196;
  const DEBUG_PORT = 9228;
  const server = await startStaticServer(SERVER_PORT);
  const session = await launchChromeSession(SERVER_PORT, DEBUG_PORT);

  t.after(() => {
    session.close();
    server.close();
  });

  await t.test('Popup UI specification and layout conformity', async () => {
    await session.setViewport(368, 600, 1.0);
    await session.navigate('/popup/popup.html');

    const metrics = await session.evaluate(`{
      clientWidth: document.body.clientWidth,
      scrollWidth: document.body.scrollWidth,
      scrollHeight: document.body.scrollHeight,
      bg: getComputedStyle(document.body).backgroundColor,
      color: getComputedStyle(document.body).color,
      fontFamily: getComputedStyle(document.body).fontFamily,
      brandTitle: document.querySelector('.brand-title').textContent,
      brandTitleSize: getComputedStyle(document.querySelector('.brand-title')).fontSize,
      brandTitleWeight: getComputedStyle(document.querySelector('.brand-title')).fontWeight,
      brandIconWidth: document.querySelector('.brand-icon').clientWidth,
      brandIconHeight: document.querySelector('.brand-icon').clientHeight,
      badgeText: document.querySelector('.badge').textContent,
      badgeSize: getComputedStyle(document.querySelector('.badge')).fontSize,
      switchWidth: document.querySelector('.slider').clientWidth,
      switchHeight: document.querySelector('.slider').clientHeight,
      switchBg: getComputedStyle(document.querySelector('.slider')).backgroundColor,
      cardBg: getComputedStyle(document.querySelector('.card')).backgroundColor,
      cardRadius: getComputedStyle(document.querySelector('.card')).borderRadius
    }`);

    // Verify zero horizontal scroll / no clipping
    assert.ok(
      metrics.scrollWidth <= metrics.clientWidth + 1,
      `Popup scrollWidth (${metrics.scrollWidth}) must not exceed clientWidth (${metrics.clientWidth})`
    );

    // Verify macOS Dark Aqua palette
    assert.strictEqual(metrics.bg, 'rgb(28, 28, 30)', 'Window background must be #1c1c1e');
    assert.strictEqual(metrics.color, 'rgb(245, 245, 247)', 'Primary text color must be #f5f5f7');
    assert.ok(metrics.fontFamily.includes('SF Pro') || metrics.fontFamily.includes('system-ui') || metrics.fontFamily.includes('-apple-system'));

    // Verify typography hierarchy
    assert.strictEqual(metrics.brandTitle, 'MaiTab');
    assert.strictEqual(metrics.brandTitleSize, '15px');
    assert.strictEqual(metrics.brandTitleWeight, '600');

    // Verify icon sizing (22px squircle)
    assert.strictEqual(metrics.brandIconWidth, 22);
    assert.strictEqual(metrics.brandIconHeight, 22);

    // Verify version badge v1.31
    assert.strictEqual(metrics.badgeText, 'v1.31');
    assert.strictEqual(metrics.badgeSize, '11px');

    // Verify switch slider dimensions (38px x 22px)
    assert.strictEqual(metrics.switchWidth, 38);
    assert.strictEqual(metrics.switchHeight, 22);

    // Verify Inset Grouped Card
    assert.strictEqual(metrics.cardRadius, '10px');
    assert.ok(metrics.cardBg.includes('rgba(255, 255, 255, 0.05)'));
  });

  await t.test('Popup UI display scaling compatibility (100%, 125%, 150%, 200%)', async () => {
    const scaleFactors = [1.0, 1.25, 1.5, 2.0];

    for (const scale of scaleFactors) {
      await session.setViewport(368, 600, scale);
      await session.navigate('/popup/popup.html');

      const overflowCheck = await session.evaluate(`{
        clientWidth: document.body.clientWidth,
        scrollWidth: document.body.scrollWidth
      }`);

      assert.ok(
        overflowCheck.scrollWidth <= overflowCheck.clientWidth + 1,
        `Scale factor ${scale * 100}% must not cause horizontal overflow (clientWidth: ${overflowCheck.clientWidth}, scrollWidth: ${overflowCheck.scrollWidth})`
      );
    }
  });

  await t.test('Popup tab switching between Whitelist and Complete Bypass lists', async () => {
    await session.setViewport(368, 600, 1.0);
    await session.navigate('/popup/popup.html');

    // Click Complete Bypass tab
    await session.evaluate(`document.getElementById('tabBtnBypass').click()`);
    const bypassActive = await session.evaluate(`{
      whitelistHidden: document.getElementById('panelWhitelist').classList.contains('hidden'),
      bypassHidden: document.getElementById('panelBypass').classList.contains('hidden'),
      bypassBtnActive: document.getElementById('tabBtnBypass').classList.contains('active'),
      whitelistBtnActive: document.getElementById('tabBtnWhitelist').classList.contains('active')
    }`);

    assert.strictEqual(bypassActive.whitelistHidden, true, 'Whitelist panel should be hidden');
    assert.strictEqual(bypassActive.bypassHidden, false, 'Bypass panel should be visible');
    assert.strictEqual(bypassActive.bypassBtnActive, true, 'Bypass tab button should have active class');
    assert.strictEqual(bypassActive.whitelistBtnActive, false, 'Whitelist tab button should not have active class');

    // Click back to Whitelist tab
    await session.evaluate(`document.getElementById('tabBtnWhitelist').click()`);
    const whitelistActive = await session.evaluate(`{
      whitelistHidden: document.getElementById('panelWhitelist').classList.contains('hidden'),
      bypassHidden: document.getElementById('panelBypass').classList.contains('hidden'),
      whitelistBtnActive: document.getElementById('tabBtnWhitelist').classList.contains('active')
    }`);

    assert.strictEqual(whitelistActive.whitelistHidden, false, 'Whitelist panel should be visible');
    assert.strictEqual(whitelistActive.bypassHidden, true, 'Bypass panel should be hidden');
    assert.strictEqual(whitelistActive.whitelistBtnActive, true, 'Whitelist tab button should be active');
  });

  await t.test('Options page responsive layout and cross-viewport compatibility', async () => {
    const viewports = [
      { name: '1080p Desktop', width: 1920, height: 1080 },
      { name: '125% Scaled Desktop', width: 1536, height: 864 },
      { name: '150% Scaled / 720p', width: 1280, height: 720 },
      { name: 'Tablet / Half-Screen', width: 768, height: 1024 },
      { name: 'Narrow Viewport / Mobile', width: 375, height: 667 }
    ];

    for (const vp of viewports) {
      await session.setViewport(vp.width, vp.height, 1.0);
      await session.navigate('/options/options.html');

      const data = await session.evaluate(`{
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        bg: getComputedStyle(document.body).backgroundColor,
        color: getComputedStyle(document.body).color,
        cardBg: getComputedStyle(document.querySelector('.card')).backgroundColor,
        cardRadius: getComputedStyle(document.querySelector('.card')).borderRadius,
        brandTitle: document.querySelector('.brand-title').textContent,
        versionBadge: document.querySelector('.brand-title-wrap .badge').textContent
      }`);

      assert.ok(
        data.scrollWidth <= data.clientWidth + 1,
        `Viewport ${vp.name} (${vp.width}x${vp.height}) must not have horizontal overflow`
      );

      assert.strictEqual(data.bg, 'rgb(28, 28, 30)', 'Options background must match macOS Dark Aqua');
      assert.strictEqual(data.color, 'rgb(245, 245, 247)', 'Options text must be #f5f5f7');
      assert.strictEqual(data.cardRadius, '10px');
      assert.strictEqual(data.versionBadge, 'v1.31');
    }
  });

  await t.test('Options page domain tester interactivity', async () => {
    await session.setViewport(1280, 800, 1.0);
    await session.navigate('/options/options.html');

    // Type a domain into the tester
    await session.evaluate(`(function() {
      const input = document.getElementById('testerInput');
      input.value = 'github.com';
      input.dispatchEvent(new Event('input'));
    })()`);

    const testerState = await session.evaluate(`{
      resultHidden: document.getElementById('testerResult').classList.contains('hidden'),
      normalizedHost: document.getElementById('testerNormalizedHost').textContent,
      behaviorBadge: document.getElementById('testerBehaviorBadge').textContent
    }`);

    assert.strictEqual(testerState.resultHidden, false, 'Tester result should become visible');
    assert.strictEqual(testerState.normalizedHost, 'github.com', 'Hostname should be normalized');
  });

  await t.test('Console errors check across both interfaces', () => {
    assert.deepStrictEqual(session.consoleErrors, [], `No console errors allowed: ${session.consoleErrors.join(', ')}`);
  });
});
