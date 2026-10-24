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
    assert.deepStrictEqual(res1.whitelist, ['github.com']);

    const res2 = await StorageManager.addWhitelistDomain('*.archlinux.org', mock);
    assert.strictEqual(res2.success, true);
    assert.strictEqual(res2.domain, 'archlinux.org');
    // alphabetical sort
    assert.deepStrictEqual(res2.whitelist, ['archlinux.org', 'github.com']);
  });

  await t.test('rejects duplicate domains', async () => {
    const mock = createMockStorage();
    await StorageManager.addWhitelistDomain('example.com', mock);
    const res = await StorageManager.addWhitelistDomain('EXAMPLE.COM', mock);
    assert.strictEqual(res.success, false);
    assert.match(res.error, /already in your whitelist/);
  });

  await t.test('rejects invalid domain format', async () => {
    const mock = createMockStorage();
    const res = await StorageManager.addWhitelistDomain('invalid domain name!!', mock);
    assert.strictEqual(res.success, false);
    assert.match(res.error, /Invalid domain format/);
  });

  await t.test('removes domain from whitelist', async () => {
    const mock = createMockStorage();
    await StorageManager.addWhitelistDomain('a.com', mock);
    await StorageManager.addWhitelistDomain('b.com', mock);

    const res = await StorageManager.removeWhitelistDomain('a.com', mock);
    assert.strictEqual(res.success, true);
    assert.deepStrictEqual(res.whitelist, ['b.com']);
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
});
