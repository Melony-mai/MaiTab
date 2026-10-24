const test = require('node:test');
const assert = require('node:assert/strict');
const StorageManager = require('../common/storage.js');

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

test('StorageManager', async (t) => {
  await t.test('returns defaults when storage is empty', async () => {
    const mock = createMockStorage();
    const settings = await StorageManager.getSettings(mock);
    assert.deepStrictEqual(settings, {
      enabled: true,
      autoSwitch: false,
      whitelist: [],
      bypassList: [],
      openNextToCurrent: true,
      language: 'auto'
    });
  });

  await t.test('saves and retrieves updated settings', async () => {
    const mock = createMockStorage();
    await StorageManager.saveSettings({ autoSwitch: true }, mock);
    const settings = await StorageManager.getSettings(mock);
    assert.strictEqual(settings.autoSwitch, true);
    assert.strictEqual(settings.enabled, true); // default preserved
  });

  await t.test('adds valid domain to whitelist with normalization and sorting', async () => {
    const mock = createMockStorage();
    const res1 = await StorageManager.addWhitelistDomain('https://github.com/trending', mock);
    assert.strictEqual(res1.success, true);
    assert.strictEqual(res1.domain, 'github.com');
    assert.strictEqual(res1.autoFocus, true);
    assert.deepStrictEqual(res1.whitelist, [{ domain: 'github.com', autoFocus: true }]);

    const res2 = await StorageManager.addWhitelistDomain('*.archlinux.org', mock);
    assert.strictEqual(res2.success, true);
    assert.strictEqual(res2.domain, 'archlinux.org');
    assert.strictEqual(res2.autoFocus, true);
    // alphabetical sort
    assert.deepStrictEqual(res2.whitelist, [
      { domain: 'archlinux.org', autoFocus: true },
      { domain: 'github.com', autoFocus: true }
    ]);
  });

  await t.test('adds domain with custom per-website focus option (autoFocus: false)', async () => {
    const mock = createMockStorage();
    const res = await StorageManager.addWhitelistDomain('reddit.com', false, mock);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.domain, 'reddit.com');
    assert.strictEqual(res.autoFocus, false);
    assert.deepStrictEqual(res.whitelist, [{ domain: 'reddit.com', autoFocus: false }]);

    const retrieved = await StorageManager.getSettings(mock);
    assert.deepStrictEqual(retrieved.whitelist, [{ domain: 'reddit.com', autoFocus: false }]);
  });

  await t.test('updates focus preference of an existing whitelist entry', async () => {
    const mock = createMockStorage();
    await StorageManager.addWhitelistDomain('example.com', true, mock);

    // Toggle focus to false (background)
    const updateRes = await StorageManager.updateWhitelistDomainFocus('example.com', false, mock);
    assert.strictEqual(updateRes.success, true);
    assert.strictEqual(updateRes.autoFocus, false);
    assert.deepStrictEqual(updateRes.whitelist, [{ domain: 'example.com', autoFocus: false }]);

    let settings = await StorageManager.getSettings(mock);
    assert.strictEqual(settings.whitelist[0].autoFocus, false);

    // Toggle focus back to true
    await StorageManager.updateWhitelistDomainFocus('example.com', true, mock);
    settings = await StorageManager.getSettings(mock);
    assert.strictEqual(settings.whitelist[0].autoFocus, true);
  });

  await t.test('normalizes legacy string array into object array with default autoFocus: true', async () => {
    const mock = createMockStorage({
      whitelist: ['legacy1.com', 'legacy2.org']
    });

    const settings = await StorageManager.getSettings(mock);
    assert.deepStrictEqual(settings.whitelist, [
      { domain: 'legacy1.com', autoFocus: true },
      { domain: 'legacy2.org', autoFocus: true }
    ]);
  });

  await t.test('rejects duplicate domains in whitelist', async () => {
    const mock = createMockStorage();
    await StorageManager.addWhitelistDomain('example.com', mock);
    const res = await StorageManager.addWhitelistDomain('EXAMPLE.COM', mock);
    assert.strictEqual(res.success, false);
    assert.match(res.error, /already in your whitelist/);
  });

  await t.test('rejects invalid domain format in whitelist', async () => {
    const mock = createMockStorage();
    const res = await StorageManager.addWhitelistDomain('invalid domain name!!', mock);
    assert.strictEqual(res.success, false);
    assert.match(res.error, /Invalid domain format/);
  });

  await t.test('removes domain from whitelist', async () => {
    const mock = createMockStorage();
    await StorageManager.addWhitelistDomain('a.com', mock);
    await StorageManager.addWhitelistDomain('b.com', false, mock);

    const res = await StorageManager.removeWhitelistDomain('a.com', mock);
    assert.strictEqual(res.success, true);
    assert.deepStrictEqual(res.whitelist, [{ domain: 'b.com', autoFocus: false }]);
  });

  await t.test('clears whitelist and resets to defaults', async () => {
    const mock = createMockStorage();
    await StorageManager.saveSettings({ autoSwitch: true, whitelist: ['foo.com'] }, mock);

    await StorageManager.clearWhitelist(mock);
    let settings = await StorageManager.getSettings(mock);
    assert.deepStrictEqual(settings.whitelist, []);
    assert.strictEqual(settings.autoSwitch, true);

    await StorageManager.resetToDefaults(mock);
    settings = await StorageManager.getSettings(mock);
    assert.deepStrictEqual(settings, StorageManager.DEFAULT_SETTINGS);
  });

  // Complete Bypass List (Silent List) tests
  await t.test('adds valid domain to Complete Bypass List with normalization and sorting', async () => {
    const mock = createMockStorage();
    const res1 = await StorageManager.addBypassDomain('https://google.com/search?q=test', mock);
    assert.strictEqual(res1.success, true);
    assert.strictEqual(res1.domain, 'google.com');
    assert.deepStrictEqual(res1.bypassList, [{ domain: 'google.com' }]);

    const res2 = await StorageManager.addBypassDomain('*.apple.com', mock);
    assert.strictEqual(res2.success, true);
    assert.strictEqual(res2.domain, 'apple.com');
    // alphabetical sort
    assert.deepStrictEqual(res2.bypassList, [
      { domain: 'apple.com' },
      { domain: 'google.com' }
    ]);

    const retrieved = await StorageManager.getSettings(mock);
    assert.deepStrictEqual(retrieved.bypassList, [
      { domain: 'apple.com' },
      { domain: 'google.com' }
    ]);
  });

  await t.test('rejects duplicate domains in Complete Bypass List', async () => {
    const mock = createMockStorage();
    await StorageManager.addBypassDomain('google.com', mock);
    const res = await StorageManager.addBypassDomain('GOOGLE.COM', mock);
    assert.strictEqual(res.success, false);
    assert.match(res.error, /already in your Complete Bypass List/);
  });

  await t.test('rejects invalid domain format in Complete Bypass List', async () => {
    const mock = createMockStorage();
    const res = await StorageManager.addBypassDomain('not a domain!!', mock);
    assert.strictEqual(res.success, false);
    assert.match(res.error, /Invalid domain format/);
  });

  await t.test('removes domain from Complete Bypass List', async () => {
    const mock = createMockStorage();
    await StorageManager.addBypassDomain('google.com', mock);
    await StorageManager.addBypassDomain('bing.com', mock);

    const res = await StorageManager.removeBypassDomain('google.com', mock);
    assert.strictEqual(res.success, true);
    assert.deepStrictEqual(res.bypassList, [{ domain: 'bing.com' }]);

    const settings = await StorageManager.getSettings(mock);
    assert.deepStrictEqual(settings.bypassList, [{ domain: 'bing.com' }]);
  });

  await t.test('clears Complete Bypass List', async () => {
    const mock = createMockStorage();
    await StorageManager.addBypassDomain('google.com', mock);
    await StorageManager.addBypassDomain('yahoo.com', mock);

    const res = await StorageManager.clearBypassList(mock);
    assert.strictEqual(res.success, true);
    assert.deepStrictEqual(res.bypassList, []);

    const settings = await StorageManager.getSettings(mock);
    assert.deepStrictEqual(settings.bypassList, []);
  });
});
