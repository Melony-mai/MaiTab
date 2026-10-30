const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, execSync } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');

// Helper to start an isolated static server
function startStaticServer(port = 8193) {
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
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-theme-test-'));
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
      expression: `(function() {
        const val = ${expr.trim().startsWith('{') ? '(' + expr + ')' : expr};
        return val === undefined ? null : JSON.stringify(val);
      })()`,
      returnByValue: true
    });
    return res.result.value ? JSON.parse(res.result.value) : null;
  };

  const close = async () => {
    try { ws.close(); } catch {}
    chrome.kill();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  };

  return { navigate, evaluate, close, consoleErrors };
}

test('Theme Support and Repository Synchronization Suite', async (t) => {
  const port = 8193;
  const debugPort = 9223;

  const server = await startStaticServer(port);
  const session = await launchChromeSession(port, debugPort);

  t.after(async () => {
    await session.close();
    server.close();
  });

  await t.test('Popup Light & Dark Theme Toggle and Instant UI Adaptation', async () => {
    await session.navigate('/popup/popup.html');

    // Initial state: Dark Mode
    const darkThemeData = await session.evaluate(`{
      themeAttr: document.documentElement.getAttribute('data-theme') || 'dark',
      bodyBg: getComputedStyle(document.body).backgroundColor,
      bodyColor: getComputedStyle(document.body).color,
      cardBg: getComputedStyle(document.querySelector('.card')).backgroundColor,
      cardBorder: getComputedStyle(document.querySelector('.card')).borderColor,
      sunVisible: !document.getElementById('themeIconSun').classList.contains('hidden'),
      moonVisible: !document.getElementById('themeIconMoon').classList.contains('hidden')
    }`);

    assert.strictEqual(darkThemeData.bodyBg, 'rgb(28, 28, 30)', 'Dark mode body background must be #1c1c1e');
    assert.strictEqual(darkThemeData.bodyColor, 'rgb(245, 245, 247)', 'Dark mode text color must be #f5f5f7');
    assert.ok(darkThemeData.sunVisible, 'In Dark mode, sun icon must be visible');
    assert.ok(!darkThemeData.moonVisible, 'In Dark mode, moon icon must be hidden');

    // Click theme toggle button to switch to Light Mode
    await session.evaluate(`document.getElementById('themeToggleBtn').click()`);
    await new Promise(r => setTimeout(r, 100));

    // Verify Light Mode styles immediately applied without reload
    const lightThemeData = await session.evaluate(`{
      themeAttr: document.documentElement.getAttribute('data-theme'),
      bodyBg: getComputedStyle(document.body).backgroundColor,
      bodyColor: getComputedStyle(document.body).color,
      cardBg: getComputedStyle(document.querySelector('.card')).backgroundColor,
      sunVisible: !document.getElementById('themeIconSun').classList.contains('hidden'),
      moonVisible: !document.getElementById('themeIconMoon').classList.contains('hidden'),
      cachedTheme: localStorage.getItem('maitab_theme')
    }`);

    assert.strictEqual(lightThemeData.themeAttr, 'light', 'Theme attribute must be set to light');
    assert.strictEqual(lightThemeData.bodyBg, 'rgb(245, 245, 247)', 'Light mode body background must be #f5f5f7');
    assert.strictEqual(lightThemeData.bodyColor, 'rgb(29, 29, 31)', 'Light mode body color must be #1d1d1f');
    assert.strictEqual(lightThemeData.cardBg, 'rgb(255, 255, 255)', 'Light mode card background must be pure white');
    assert.ok(lightThemeData.moonVisible, 'In Light mode, moon icon must be visible');
    assert.ok(!lightThemeData.sunVisible, 'In Light mode, sun icon must be hidden');
    assert.strictEqual(lightThemeData.cachedTheme, 'light', 'Theme preference must be stored in localStorage');

    // Click again to toggle back to Dark Mode
    await session.evaluate(`document.getElementById('themeToggleBtn').click()`);
    await new Promise(r => setTimeout(r, 100));

    const toggledBackData = await session.evaluate(`{
      themeAttr: document.documentElement.getAttribute('data-theme'),
      bodyBg: getComputedStyle(document.body).backgroundColor,
      sunVisible: !document.getElementById('themeIconSun').classList.contains('hidden')
    }`);

    assert.strictEqual(toggledBackData.themeAttr, 'dark');
    assert.strictEqual(toggledBackData.bodyBg, 'rgb(28, 28, 30)');
    assert.ok(toggledBackData.sunVisible);
  });

  await t.test('Theme preference persists across page reopen and reload', async () => {
    // Switch to Light Mode
    await session.evaluate(`document.getElementById('themeToggleBtn').click()`);
    await new Promise(r => setTimeout(r, 100));

    // Reload the popup page (simulating reopening popup)
    await session.navigate('/popup/popup.html');

    const persistentThemeData = await session.evaluate(`{
      themeAttr: document.documentElement.getAttribute('data-theme'),
      bodyBg: getComputedStyle(document.body).backgroundColor,
      bodyColor: getComputedStyle(document.body).color
    }`);

    assert.strictEqual(persistentThemeData.themeAttr, 'light', 'Theme must persist as light upon reopen');
    assert.strictEqual(persistentThemeData.bodyBg, 'rgb(245, 245, 247)');

    // Reset back to dark
    await session.evaluate(`document.getElementById('themeToggleBtn').click()`);
    await new Promise(r => setTimeout(r, 100));
  });

  await t.test('Options Page Light & Dark Mode Dual Controls and UI Elements Adaptation', async () => {
    await session.navigate('/options/options.html');

    // Verify dark mode default elements
    const optDarkData = await session.evaluate(`{
      themeAttr: document.documentElement.getAttribute('data-theme') || 'dark',
      bg: getComputedStyle(document.body).backgroundColor,
      selectValue: document.getElementById('optThemeSelect').value,
      tableWrapBg: getComputedStyle(document.querySelector('.whitelist-table-wrap')).backgroundColor,
      cardBg: getComputedStyle(document.querySelector('.card')).backgroundColor
    }`);

    assert.strictEqual(optDarkData.bg, 'rgb(28, 28, 30)');
    assert.strictEqual(optDarkData.selectValue, 'dark');

    // Use Quick Toggle Button to switch to Light Mode
    await session.evaluate(`document.getElementById('optThemeToggleBtn').click()`);
    await new Promise(r => setTimeout(r, 100));

    const optLightData = await session.evaluate(`{
      themeAttr: document.documentElement.getAttribute('data-theme'),
      bg: getComputedStyle(document.body).backgroundColor,
      color: getComputedStyle(document.body).color,
      selectValue: document.getElementById('optThemeSelect').value,
      cardBg: getComputedStyle(document.querySelector('.card')).backgroundColor,
      tableWrapBg: getComputedStyle(document.querySelector('.whitelist-table-wrap')).backgroundColor
    }`);

    assert.strictEqual(optLightData.themeAttr, 'light');
    assert.strictEqual(optLightData.bg, 'rgb(245, 245, 247)');
    assert.strictEqual(optLightData.color, 'rgb(29, 29, 31)');
    assert.strictEqual(optLightData.selectValue, 'light', 'Select dropdown must sync with toggle button');
    assert.strictEqual(optLightData.cardBg, 'rgb(255, 255, 255)');

    // Use Select dropdown to switch back to Dark Mode
    await session.evaluate(`(function() {
      const select = document.getElementById('optThemeSelect');
      select.value = 'dark';
      select.dispatchEvent(new Event('change'));
    })()`);
    await new Promise(r => setTimeout(r, 100));

    const optSwitchedBack = await session.evaluate(`{
      themeAttr: document.documentElement.getAttribute('data-theme'),
      bg: getComputedStyle(document.body).backgroundColor,
      sunVisible: !document.getElementById('optThemeIconSun').classList.contains('hidden')
    }`);

    assert.strictEqual(optSwitchedBack.themeAttr, 'dark');
    assert.strictEqual(optSwitchedBack.bg, 'rgb(28, 28, 30)');
    assert.ok(optSwitchedBack.sunVisible);
  });

  await t.test('Repository direct iteration capability (scripts/sync-repo.js)', async () => {
    const syncScriptPath = path.join(rootDir, 'scripts/sync-repo.js');
    assert.strictEqual(fs.existsSync(syncScriptPath), true, 'scripts/sync-repo.js must exist');

    // Create an isolated test git repo to verify sync capability without touching working tree
    const tmpRemote = fs.mkdtempSync(path.join(os.tmpdir(), 'git-remote-'));
    const tmpLocal = fs.mkdtempSync(path.join(os.tmpdir(), 'git-local-'));

    try {
      execSync('git init --bare', { cwd: tmpRemote });
      execSync('git init', { cwd: tmpLocal });
      execSync('git config user.email "test@example.com"', { cwd: tmpLocal });
      execSync('git config user.name "Test User"', { cwd: tmpLocal });
      execSync(`git remote add origin "${tmpRemote}"`, { cwd: tmpLocal });
      execSync('git checkout -b main', { cwd: tmpLocal });

      fs.writeFileSync(path.join(tmpLocal, 'README.md'), '# Initial');
      execSync('git add . && git commit -m "initial commit"', { cwd: tmpLocal });
      execSync('git push -u origin main', { cwd: tmpLocal });

      // Add uncommitted change to test safe stashing and sync
      fs.writeFileSync(path.join(tmpLocal, 'local-change.txt'), 'uncommitted work');

      const { syncRepository } = require('../scripts/sync-repo.js');
      const res = await syncRepository({ cwd: tmpLocal, runTests: false });
      assert.strictEqual(res.success, true);
      assert.strictEqual(
        fs.readFileSync(path.join(tmpLocal, 'local-change.txt'), 'utf8'),
        'uncommitted work',
        'Uncommitted work must be safely preserved'
      );
    } finally {
      fs.rmSync(tmpRemote, { recursive: true, force: true });
      fs.rmSync(tmpLocal, { recursive: true, force: true });
    }
  });

  await t.test('No console errors across theme interactions', () => {
    assert.deepStrictEqual(session.consoleErrors, [], `No console errors allowed: ${session.consoleErrors.join(', ')}`);
  });
});
