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

test('DomainMatcher.getMatchedRule', async (t) => {
  const whitelist = [
    { domain: 'github.com', autoFocus: true },
    { domain: 'reddit.com', autoFocus: false },
    'docs.python.org' // legacy string format
  ];

  await t.test('finds exact domain rule with configured autoFocus', () => {
    const gh = DomainMatcher.getMatchedRule('github.com', whitelist);
    assert.deepStrictEqual(gh, { domain: 'github.com', autoFocus: true });

    const reddit = DomainMatcher.getMatchedRule('reddit.com', whitelist);
    assert.deepStrictEqual(reddit, { domain: 'reddit.com', autoFocus: false });
  });

  await t.test('finds subdomain rule with parent focus settings', () => {
    const gist = DomainMatcher.getMatchedRule('gist.github.com', whitelist);
    assert.deepStrictEqual(gist, { domain: 'github.com', autoFocus: true });

    const subReddit = DomainMatcher.getMatchedRule('old.reddit.com', whitelist);
    assert.deepStrictEqual(subReddit, { domain: 'reddit.com', autoFocus: false });
  });

  await t.test('defaults legacy string entry to autoFocus: true', () => {
    const py = DomainMatcher.getMatchedRule('docs.python.org', whitelist);
    assert.deepStrictEqual(py, { domain: 'docs.python.org', autoFocus: true });
  });

  await t.test('returns null when no rule matches', () => {
    assert.strictEqual(DomainMatcher.getMatchedRule('wikipedia.org', whitelist), null);
    assert.strictEqual(DomainMatcher.getMatchedRule('evilgithub.com', whitelist), null);
    assert.strictEqual(DomainMatcher.getMatchedRule('', whitelist), null);
  });
});

test('DomainMatcher.shouldSwitchTab decision logic and precedence', async (t) => {
  const whitelist = [
    { domain: 'focus-on-site.com', autoFocus: true },
    { domain: 'focus-off-site.com', autoFocus: false },
    'legacy-site.org' // defaults to autoFocus: true
  ];

  await t.test('Matrix 1: Whitelist entry with focus enabled (autoFocus: true)', () => {
    // When global toggle is OFF:
    assert.strictEqual(
      DomainMatcher.shouldSwitchTab({
        enabled: true,
        autoSwitch: false,
        whitelist,
        currentHostname: 'focus-on-site.com'
      }),
      true,
      'Global OFF + Site Focus ON -> switches focus'
    );

    // When global toggle is ON:
    assert.strictEqual(
      DomainMatcher.shouldSwitchTab({
        enabled: true,
        autoSwitch: true,
        whitelist,
        currentHostname: 'focus-on-site.com'
      }),
      true,
      'Global ON + Site Focus ON -> switches focus'
    );
  });

  await t.test('Matrix 2: Whitelist entry with focus disabled (autoFocus: false) strictly overrides global toggle', () => {
    // When global toggle is ON: MUST STAY IN BACKGROUND!
    assert.strictEqual(
      DomainMatcher.shouldSwitchTab({
        enabled: true,
        autoSwitch: true,
        whitelist,
        currentHostname: 'focus-off-site.com'
      }),
      false,
      'Global ON + Site Focus OFF -> MUST open in background (whitelist overrides global)'
    );

    // When global toggle is OFF:
    assert.strictEqual(
      DomainMatcher.shouldSwitchTab({
        enabled: true,
        autoSwitch: false,
        whitelist,
        currentHostname: 'focus-off-site.com'
      }),
      false,
      'Global OFF + Site Focus OFF -> opens in background'
    );

    // Subdomain check:
    assert.strictEqual(
      DomainMatcher.shouldSwitchTab({
        enabled: true,
        autoSwitch: true,
        whitelist,
        currentHostname: 'sub.focus-off-site.com'
      }),
      false,
      'Subdomain of focus-disabled site must also stay in background even when global is ON'
    );
  });

  await t.test('Matrix 3: Non-whitelisted site follows global toggle', () => {
    // When global toggle is ON:
    assert.strictEqual(
      DomainMatcher.shouldSwitchTab({
        enabled: true,
        autoSwitch: true,
        whitelist,
        currentHostname: 'random-unlisted-blog.com'
      }),
      true,
      'Global ON + Unlisted site -> switches focus'
    );

    // When global toggle is OFF:
    assert.strictEqual(
      DomainMatcher.shouldSwitchTab({
        enabled: true,
        autoSwitch: false,
        whitelist,
        currentHostname: 'random-unlisted-blog.com'
      }),
      false,
      'Global OFF + Unlisted site -> opens in background'
    );
  });

  await t.test('Matrix 4: Legacy string entries behave as autoFocus: true', () => {
    assert.strictEqual(
      DomainMatcher.shouldSwitchTab({
        enabled: true,
        autoSwitch: false,
        whitelist,
        currentHostname: 'legacy-site.org'
      }),
      true,
      'Legacy string entry switches focus when global is OFF'
    );
  });

  await t.test('Matrix 5: Extension master disabled', () => {
    assert.strictEqual(
      DomainMatcher.shouldSwitchTab({
        enabled: false,
        autoSwitch: true,
        whitelist,
        currentHostname: 'focus-on-site.com'
      }),
      false,
      'Disabled extension returns false regardless of other settings'
    );
  });
});
