const test = require('node:test');
const assert = require('node:assert/strict');
const I18n = require('../common/i18n.js');

test('I18n normalization and defaults', async (t) => {
  await t.test('normalizes language codes accurately', () => {
    assert.strictEqual(I18n.normalizeLanguageCode('en'), 'en');
    assert.strictEqual(I18n.normalizeLanguageCode('en-US'), 'en');
    assert.strictEqual(I18n.normalizeLanguageCode('zh'), 'zh-CN');
    assert.strictEqual(I18n.normalizeLanguageCode('zh-CN'), 'zh-CN');
    assert.strictEqual(I18n.normalizeLanguageCode('zh-TW'), 'zh-CN');
    assert.strictEqual(I18n.normalizeLanguageCode('ja'), 'ja');
    assert.strictEqual(I18n.normalizeLanguageCode('ja-JP'), 'ja');
    assert.strictEqual(I18n.normalizeLanguageCode('fr'), 'en'); // Fallback
    assert.strictEqual(I18n.normalizeLanguageCode(''), 'en');
    assert.strictEqual(I18n.normalizeLanguageCode(null), 'en');
  });
});

test('I18n dictionary completeness across English, Chinese, and Japanese', async (t) => {
  const enKeys = Object.keys(I18n._TRANSLATIONS.en);
  const zhKeys = Object.keys(I18n._TRANSLATIONS['zh-CN']);
  const jaKeys = Object.keys(I18n._TRANSLATIONS.ja);

  await t.test('English has comprehensive translation keys', () => {
    assert.ok(enKeys.length > 50, `Expected > 50 keys, got ${enKeys.length}`);
  });

  await t.test('Chinese (Simplified) has all keys defined in English', () => {
    const missingInZh = enKeys.filter(k => !(k in I18n._TRANSLATIONS['zh-CN']));
    assert.deepStrictEqual(missingInZh, [], `Missing Chinese keys: ${missingInZh.join(', ')}`);
  });

  await t.test('Japanese has all keys defined in English', () => {
    const missingInJa = enKeys.filter(k => !(k in I18n._TRANSLATIONS.ja));
    assert.deepStrictEqual(missingInJa, [], `Missing Japanese keys: ${missingInJa.join(', ')}`);
  });
});

test('I18n translation rendering and formatting', async (t) => {
  I18n.setLanguage('en');

  await t.test('translates English strings', () => {
    assert.strictEqual(I18n.t('extName'), 'MaiTab - Open Links in New Tabs');
    assert.strictEqual(I18n.t('btnAdd'), 'Add');
  });

  await t.test('translates Chinese Simplified strings', () => {
    I18n.setLanguage('zh-CN');
    assert.strictEqual(I18n.t('extName'), 'MaiTab - 在新标签页打开链接');
    assert.strictEqual(I18n.t('btnAdd'), '添加');
    assert.strictEqual(I18n.t('badgeForegroundWhitelisted'), '前台切换 (白名单)');
  });

  await t.test('translates Japanese strings', () => {
    I18n.setLanguage('ja');
    assert.strictEqual(I18n.t('extName'), 'MaiTab - リンクを新しいタブで開く');
    assert.strictEqual(I18n.t('btnAdd'), '追加');
    assert.strictEqual(I18n.t('badgeForegroundWhitelisted'), 'フォアグラウンド (登録済み)');
  });

  await t.test('formats positional parameters', () => {
    I18n.setLanguage('en');
    assert.strictEqual(I18n.t('toastAdded', 'github.com'), 'Added "github.com" to whitelist');

    I18n.setLanguage('zh-CN');
    assert.strictEqual(I18n.t('toastAdded', 'github.com'), '已将 "github.com" 添加至白名单');

    I18n.setLanguage('ja');
    assert.strictEqual(I18n.t('toastAdded', 'github.com'), '「github.com」をホワイトリストに追加しました');
  });

  await t.test('notifies change listeners when language switches', () => {
    let notified = '';
    I18n.onLanguageChanged((lang) => {
      notified = lang;
    });

    I18n.setLanguage('zh-CN');
    assert.strictEqual(notified, 'zh-CN');

    I18n.setLanguage('en');
    assert.strictEqual(notified, 'en');
  });
});

test('I18n.applyToDOM simulation', async (t) => {
  I18n.setLanguage('en');

  // Create a minimal mock DOM
  const mockElements = [
    {
      attr: { 'data-i18n': 'btnAdd' },
      getAttribute: function (a) { return this.attr[a]; },
      setAttribute: function (a, v) { this.attr[a] = v; },
      textContent: ''
    },
    {
      attr: { 'data-i18n-placeholder': 'inputPlaceholderDomain' },
      getAttribute: function (a) { return this.attr[a]; },
      setAttribute: function (a, v) { this.attr[a] = v; },
      placeholder: ''
    }
  ];

  const mockDoc = {
    querySelectorAll: (selector) => {
      if (selector.includes('data-i18n-placeholder')) {
        return [mockElements[1]];
      }
      if (selector.includes('data-i18n')) {
        return [mockElements[0]];
      }
      return [];
    }
  };

  I18n.applyToDOM(mockDoc);
  assert.strictEqual(mockElements[0].textContent, 'Add');
  assert.strictEqual(mockElements[1].attr.placeholder, 'e.g. github.com or news.ycombinator.com');

  I18n.setLanguage('zh-CN');
  I18n.applyToDOM(mockDoc);
  assert.strictEqual(mockElements[0].textContent, '添加');
  assert.strictEqual(mockElements[1].attr.placeholder, '例如 github.com 或 news.ycombinator.com');
});
