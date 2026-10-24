const test = require('node:test');
const assert = require('node:assert/strict');
const DomainMatcher = require('../common/domain-matcher.js');

test('DomainMatcher.normalizeDomain', async (t) => {
  await t.test('handles standard domains', () => {
    assert.strictEqual(DomainMatcher.normalizeDomain('example.com'), 'example.com');
    assert.strictEqual(DomainMatcher.normalizeDomain('EXAMPLE.COM'), 'example.com');
    assert.strictEqual(DomainMatcher.normalizeDomain('  sub.example.com  '), 'sub.example.com');
  });

  await t.test('strips protocols, paths, ports, query and hashes', () => {
    assert.strictEqual(DomainMatcher.normalizeDomain('https://example.com/some/path?query=1#hash'), 'example.com');
    assert.strictEqual(DomainMatcher.normalizeDomain('http://localhost:8080/app'), 'localhost');
    assert.strictEqual(DomainMatcher.normalizeDomain('ftp://files.example.org:21/'), 'files.example.org');
  });

  await t.test('strips wildcards and leading dots', () => {
    assert.strictEqual(DomainMatcher.normalizeDomain('*.example.com'), 'example.com');
    assert.strictEqual(DomainMatcher.normalizeDomain('.example.com'), 'example.com');
  });

  await t.test('handles invalid inputs gracefully', () => {
    assert.strictEqual(DomainMatcher.normalizeDomain(''), '');
    assert.strictEqual(DomainMatcher.normalizeDomain(null), '');
    assert.strictEqual(DomainMatcher.normalizeDomain(undefined), '');
  });
});

test('DomainMatcher.isValidDomain', async (t) => {
  await t.test('accepts valid domains and subdomains', () => {
    assert.strictEqual(DomainMatcher.isValidDomain('example.com'), true);
    assert.strictEqual(DomainMatcher.isValidDomain('sub.example.co.uk'), true);
    assert.strictEqual(DomainMatcher.isValidDomain('my-site-123.org'), true);
    assert.strictEqual(DomainMatcher.isValidDomain('localhost'), true);
    assert.strictEqual(DomainMatcher.isValidDomain('127.0.0.1'), true);
  });

  await t.test('rejects invalid domains', () => {
    assert.strictEqual(DomainMatcher.isValidDomain(''), false);
    assert.strictEqual(DomainMatcher.isValidDomain('no_dots_except_localhost'), false);
    assert.strictEqual(DomainMatcher.isValidDomain('-starts-with-hyphen.com'), false);
    assert.strictEqual(DomainMatcher.isValidDomain('ends-with-hyphen-.com'), false);
    assert.strictEqual(DomainMatcher.isValidDomain('contains spaces.com'), false);
    assert.strictEqual(DomainMatcher.isValidDomain('double..dots.com'), false);
    assert.strictEqual(DomainMatcher.isValidDomain('999.999.999.999'), false);
  });
});

test('DomainMatcher.isDomainMatch', async (t) => {
  await t.test('matches exact domains', () => {
    assert.strictEqual(DomainMatcher.isDomainMatch('example.com', 'example.com'), true);
    assert.strictEqual(DomainMatcher.isDomainMatch('EXAMPLE.COM', 'example.com'), true);
  });

  await t.test('matches subdomains appropriately', () => {
    assert.strictEqual(DomainMatcher.isDomainMatch('sub.example.com', 'example.com'), true);
    assert.strictEqual(DomainMatcher.isDomainMatch('deep.sub.example.com', 'example.com'), true);
    assert.strictEqual(DomainMatcher.isDomainMatch('api.sub.example.com', 'sub.example.com'), true);
  });

  await t.test('avoids unintended matches (false positives)', () => {
    // "notexample.com" should NOT match "example.com"
    assert.strictEqual(DomainMatcher.isDomainMatch('notexample.com', 'example.com'), false);
    assert.strictEqual(DomainMatcher.isDomainMatch('evil-example.com', 'example.com'), false);
    assert.strictEqual(DomainMatcher.isDomainMatch('example.com.evil.org', 'example.com'), false);
    // Parent domain should NOT match if rule is for a specific subdomain
    assert.strictEqual(DomainMatcher.isDomainMatch('example.com', 'sub.example.com'), false);
    assert.strictEqual(DomainMatcher.isDomainMatch('other.example.com', 'sub.example.com'), false);
  });
});

test('DomainMatcher.isDomainWhitelisted', async (t) => {
  const whitelist = ['github.com', 'news.ycombinator.com', 'localhost'];

  assert.strictEqual(DomainMatcher.isDomainWhitelisted('github.com', whitelist), true);
  assert.strictEqual(DomainMatcher.isDomainWhitelisted('gist.github.com', whitelist), true);
  assert.strictEqual(DomainMatcher.isDomainWhitelisted('news.ycombinator.com', whitelist), true);
  assert.strictEqual(DomainMatcher.isDomainWhitelisted('localhost', whitelist), true);

  assert.strictEqual(DomainMatcher.isDomainWhitelisted('fakegithub.com', whitelist), false);
  assert.strictEqual(DomainMatcher.isDomainWhitelisted('wikipedia.org', whitelist), false);
  assert.strictEqual(DomainMatcher.isDomainWhitelisted('ycombinator.com', whitelist), false);
});

test('DomainMatcher.shouldSwitchTab decision logic', async (t) => {
  const whitelist = ['important.org', 'docs.python.org'];

  // 1. When global toggle is enabled (autoSwitch = true):
  // All websites switch to foreground, whether whitelisted or not!
  assert.strictEqual(
    DomainMatcher.shouldSwitchTab({
      enabled: true,
      autoSwitch: true,
      whitelist,
      currentHostname: 'random-blog.com'
    }),
    true,
    'Global toggle ON: non-whitelisted site should switch'
  );

  assert.strictEqual(
    DomainMatcher.shouldSwitchTab({
      enabled: true,
      autoSwitch: true,
      whitelist,
      currentHostname: 'important.org'
    }),
    true,
    'Global toggle ON: whitelisted site should switch'
  );

  // 2. When global toggle is disabled (autoSwitch = false):
  // Whitelisted websites MUST switch to foreground!
  assert.strictEqual(
    DomainMatcher.shouldSwitchTab({
      enabled: true,
      autoSwitch: false,
      whitelist,
      currentHostname: 'important.org'
    }),
    true,
    'Global toggle OFF: whitelisted site must switch'
  );

  assert.strictEqual(
    DomainMatcher.shouldSwitchTab({
      enabled: true,
      autoSwitch: false,
      whitelist,
      currentHostname: 'sub.important.org'
    }),
    true,
    'Global toggle OFF: whitelisted subdomain must switch'
  );

  // Non-whitelisted websites MUST NOT switch (stay in background)!
  assert.strictEqual(
    DomainMatcher.shouldSwitchTab({
      enabled: true,
      autoSwitch: false,
      whitelist,
      currentHostname: 'random-blog.com'
    }),
    false,
    'Global toggle OFF: non-whitelisted site must stay in background'
  );

  assert.strictEqual(
    DomainMatcher.shouldSwitchTab({
      enabled: true,
      autoSwitch: false,
      whitelist,
      currentHostname: 'fakeimportant.org'
    }),
    false,
    'Global toggle OFF: fake prefix site must stay in background'
  );

  // 3. When extension is disabled:
  assert.strictEqual(
    DomainMatcher.shouldSwitchTab({
      enabled: false,
      autoSwitch: true,
      whitelist,
      currentHostname: 'important.org'
    }),
    false
  );
});
