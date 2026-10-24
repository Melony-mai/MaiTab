const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');

test('Manifest V3 validation', async (t) => {
  const manifestPath = path.join(rootDir, 'manifest.json');

  await t.test('manifest.json exists and is valid JSON', () => {
    assert.strictEqual(fs.existsSync(manifestPath), true, 'manifest.json must exist in root directory');
    const content = fs.readFileSync(manifestPath, 'utf8');
    assert.doesNotThrow(() => JSON.parse(content), 'manifest.json must be valid JSON');
  });

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  await t.test('conforms to Manifest V3 structure', () => {
    assert.strictEqual(manifest.manifest_version, 3, 'manifest_version must be 3');
    assert.ok(manifest.name, 'manifest must have a name');
    assert.ok(manifest.version, 'manifest must have a version');
    assert.ok(manifest.description, 'manifest must have a description');
    assert.strictEqual(manifest.default_locale, 'en', 'manifest default_locale must be en');
  });

  await t.test('locale files exist and contain required manifest messages', () => {
    const locales = ['en', 'zh_CN', 'ja'];
    for (const locale of locales) {
      const locPath = path.join(rootDir, '_locales', locale, 'messages.json');
      assert.strictEqual(fs.existsSync(locPath), true, `_locales/${locale}/messages.json must exist`);
      const locData = JSON.parse(fs.readFileSync(locPath, 'utf8'));
      assert.ok(locData.extName?.message, `extName message required in ${locale}`);
      assert.ok(locData.extDesc?.message, `extDesc message required in ${locale}`);
      assert.ok(locData.defaultTitle?.message, `defaultTitle message required in ${locale}`);
    }
  });

  await t.test('all referenced icon files exist', () => {
    assert.ok(manifest.icons, 'icons object must exist');
    for (const [size, iconPath] of Object.entries(manifest.icons)) {
      const fullPath = path.join(rootDir, iconPath);
      assert.strictEqual(fs.existsSync(fullPath), true, `Icon ${size} (${iconPath}) must exist`);
      const stat = fs.statSync(fullPath);
      assert.ok(stat.size > 0, `Icon ${size} must not be empty`);
    }
  });

  await t.test('background service worker file exists', () => {
    assert.ok(manifest.background?.service_worker, 'background.service_worker must be defined');
    const swPath = path.join(rootDir, manifest.background.service_worker);
    assert.strictEqual(fs.existsSync(swPath), true, 'service worker file must exist');
  });

  await t.test('content scripts and dependencies exist', () => {
    assert.ok(Array.isArray(manifest.content_scripts), 'content_scripts must be an array');
    assert.ok(manifest.content_scripts.length > 0, 'content_scripts must have at least one entry');

    for (const cs of manifest.content_scripts) {
      assert.ok(Array.isArray(cs.matches), 'matches must be an array');
      assert.ok(Array.isArray(cs.js), 'js must be an array');
      for (const script of cs.js) {
        const fullPath = path.join(rootDir, script);
        assert.strictEqual(fs.existsSync(fullPath), true, `Content script ${script} must exist`);
      }
    }
  });

  await t.test('popup and options pages exist', () => {
    assert.ok(manifest.action?.default_popup, 'action.default_popup must be defined');
    const popupPath = path.join(rootDir, manifest.action.default_popup);
    assert.strictEqual(fs.existsSync(popupPath), true, 'popup.html must exist');

    assert.ok(manifest.options_ui?.page, 'options_ui.page must be defined');
    const optionsPath = path.join(rootDir, manifest.options_ui.page);
    assert.strictEqual(fs.existsSync(optionsPath), true, 'options.html must exist');
  });

  await t.test('permissions are minimal and correct', () => {
    assert.deepStrictEqual(
      manifest.permissions.sort(),
      ['storage', 'tabs'].sort(),
      'Should only request storage and tabs permissions'
    );
  });
});

test('HTML files reference existing resources', async (t) => {
  const checkHtmlReferences = (htmlRelPath) => {
    const fullHtmlPath = path.join(rootDir, htmlRelPath);
    const htmlDir = path.dirname(fullHtmlPath);
    const content = fs.readFileSync(fullHtmlPath, 'utf8');

    // Check <link rel="stylesheet" href="...">
    const cssMatches = content.matchAll(/<link\s+[^>]*href=["']([^"']+)["']/g);
    for (const match of cssMatches) {
      const refPath = path.resolve(htmlDir, match[1]);
      assert.strictEqual(fs.existsSync(refPath), true, `${match[1]} in ${htmlRelPath} must exist`);
    }

    // Check <script src="...">
    const scriptMatches = content.matchAll(/<script\s+[^>]*src=["']([^"']+)["']/g);
    for (const match of scriptMatches) {
      const refPath = path.resolve(htmlDir, match[1]);
      assert.strictEqual(fs.existsSync(refPath), true, `${match[1]} in ${htmlRelPath} must exist`);
    }

    // Check <img src="...">
    const imgMatches = content.matchAll(/<img\s+[^>]*src=["']([^"']+)["']/g);
    for (const match of imgMatches) {
      const refPath = path.resolve(htmlDir, match[1]);
      assert.strictEqual(fs.existsSync(refPath), true, `${match[1]} in ${htmlRelPath} must exist`);
    }
  };

  await t.test('popup.html references are all valid', () => {
    checkHtmlReferences('popup/popup.html');
  });

  await t.test('options.html references are all valid', () => {
    checkHtmlReferences('options/options.html');
  });
});

test('End-to-End Decision Flow Simulation', async (t) => {
  const DomainMatcher = require('../common/domain-matcher.js');
  const LinkEvaluator = require('../common/link-evaluator.js');

  await t.test('Simulated browsing session: Hacker News (whitelisted) vs Tech Blog (non-whitelisted)', () => {
    const settings = {
      enabled: true,
      autoSwitch: false, // Global toggle disabled: default background tabs
      whitelist: ['news.ycombinator.com', 'github.com']
    };

    // 1. User clicks a link on Hacker News (currentHost: 'news.ycombinator.com')
    const hnLink = {
      href: 'https://news.ycombinator.com/item?id=3000',
      getAttribute: (a) => (a === 'href' ? 'item?id=3000' : null)
    };
    const hnEval = LinkEvaluator.isEligibleAnchor(hnLink, 'https://news.ycombinator.com/');
    assert.strictEqual(hnEval.eligible, true);

    const hnSwitch = DomainMatcher.shouldSwitchTab({
      enabled: settings.enabled,
      autoSwitch: settings.autoSwitch,
      whitelist: settings.whitelist,
      currentHostname: 'news.ycombinator.com'
    });
    // Because news.ycombinator.com is in whitelist, it MUST switch to foreground!
    assert.strictEqual(hnSwitch, true, 'Whitelisted website must switch to foreground even when autoSwitch is OFF');

    // 2. User clicks a link on a non-whitelisted site (currentHost: 'randomblog.dev')
    const blogLink = {
      href: 'https://randomblog.dev/post/1',
      getAttribute: (a) => (a === 'href' ? '/post/1' : null)
    };
    const blogEval = LinkEvaluator.isEligibleAnchor(blogLink, 'https://randomblog.dev/');
    assert.strictEqual(blogEval.eligible, true);

    const blogSwitch = DomainMatcher.shouldSwitchTab({
      enabled: settings.enabled,
      autoSwitch: settings.autoSwitch,
      whitelist: settings.whitelist,
      currentHostname: 'randomblog.dev'
    });
    // Non-whitelisted site must remain in background!
    assert.strictEqual(blogSwitch, false, 'Non-whitelisted website must open in background when autoSwitch is OFF');

    // 3. Subdomain test: gist.github.com clicks a link (github.com is in whitelist)
    const gistSwitch = DomainMatcher.shouldSwitchTab({
      enabled: settings.enabled,
      autoSwitch: settings.autoSwitch,
      whitelist: settings.whitelist,
      currentHostname: 'gist.github.com'
    });
    assert.strictEqual(gistSwitch, true, 'Subdomain of whitelisted domain must switch to foreground');

    // 4. Now user toggles autoSwitch to true (Global switch enabled)
    settings.autoSwitch = true;

    const blogSwitchWhenGlobalOn = DomainMatcher.shouldSwitchTab({
      enabled: settings.enabled,
      autoSwitch: settings.autoSwitch,
      whitelist: settings.whitelist,
      currentHostname: 'randomblog.dev'
    });
    assert.strictEqual(blogSwitchWhenGlobalOn, true, 'When autoSwitch is ON, all sites must switch to foreground');

    const hnSwitchWhenGlobalOn = DomainMatcher.shouldSwitchTab({
      enabled: settings.enabled,
      autoSwitch: settings.autoSwitch,
      whitelist: settings.whitelist,
      currentHostname: 'news.ycombinator.com'
    });
    assert.strictEqual(hnSwitchWhenGlobalOn, true, 'When autoSwitch is ON, whitelisted sites also switch to foreground');
  });
});
