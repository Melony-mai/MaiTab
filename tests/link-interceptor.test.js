const test = require('node:test');
const assert = require('node:assert/strict');
const LinkEvaluator = require('../common/link-evaluator.js');

function createMockAnchor({ href, rawHref, hasDownload = false, isButton = false }) {
  return {
    href: href,
    getAttribute: (attr) => (attr === 'href' ? (rawHref !== undefined ? rawHref : href) : null),
    hasAttribute: (attr) => (attr === 'download' ? hasDownload : false)
  };
}

function createMockEvent({
  button = 0,
  ctrlKey = false,
  shiftKey = false,
  altKey = false,
  metaKey = false,
  anchor = null,
  interactive = null
}) {
  return {
    button,
    ctrlKey,
    shiftKey,
    altKey,
    metaKey,
    target: {
      closest: (selector) => {
        if (selector.includes('input') || selector.includes('button') || selector.includes('select') || selector.includes('textarea')) {
          return interactive;
        }
        if (selector.includes('a[href]')) {
          return anchor;
        }
        return null;
      }
    }
  };
}

test('LinkEvaluator.isEligibleAnchor', async (t) => {
  const currentUrl = 'https://news.ycombinator.com/item?id=12345';

  await t.test('accepts valid http/https links', () => {
    const anchor = createMockAnchor({ href: 'https://github.com/trending' });
    const result = LinkEvaluator.isEligibleAnchor(anchor, currentUrl);
    assert.strictEqual(result.eligible, true);
    assert.strictEqual(result.url, 'https://github.com/trending');
  });

  await t.test('resolves relative URLs to absolute', () => {
    const anchor = createMockAnchor({ href: 'item?id=99999' });
    const result = LinkEvaluator.isEligibleAnchor(anchor, currentUrl);
    assert.strictEqual(result.eligible, true);
    assert.strictEqual(result.url, 'https://news.ycombinator.com/item?id=99999');
  });

  await t.test('rejects placeholder and empty hrefs', () => {
    const emptyAnchor = createMockAnchor({ href: '', rawHref: '' });
    assert.strictEqual(LinkEvaluator.isEligibleAnchor(emptyAnchor, currentUrl).eligible, false);

    const hashAnchor = createMockAnchor({ href: '#', rawHref: '#' });
    assert.strictEqual(LinkEvaluator.isEligibleAnchor(hashAnchor, currentUrl).eligible, false);
  });

  await t.test('rejects javascript, mailto, tel protocols', () => {
    const jsAnchor = createMockAnchor({ href: 'javascript:void(0)' });
    assert.strictEqual(LinkEvaluator.isEligibleAnchor(jsAnchor, currentUrl).eligible, false);

    const mailAnchor = createMockAnchor({ href: 'mailto:test@example.com' });
    assert.strictEqual(LinkEvaluator.isEligibleAnchor(mailAnchor, currentUrl).eligible, false);

    const telAnchor = createMockAnchor({ href: 'tel:+1234567890' });
    assert.strictEqual(LinkEvaluator.isEligibleAnchor(telAnchor, currentUrl).eligible, false);
  });

  await t.test('rejects anchors with download attribute', () => {
    const dlAnchor = createMockAnchor({ href: 'https://example.com/file.pdf', hasDownload: true });
    const res = LinkEvaluator.isEligibleAnchor(dlAnchor, currentUrl);
    assert.strictEqual(res.eligible, false);
    assert.strictEqual(res.reason, 'download_attribute');
  });

  await t.test('rejects same-page hash section jumps', () => {
    const hashAnchor = createMockAnchor({
      href: 'https://news.ycombinator.com/item?id=12345#comments',
      rawHref: '#comments'
    });
    const res = LinkEvaluator.isEligibleAnchor(hashAnchor, currentUrl);
    assert.strictEqual(res.eligible, false);
    assert.strictEqual(res.reason, 'same_page_hash');
  });
});

test('LinkEvaluator.shouldInterceptClick', async (t) => {
  const currentUrl = 'https://news.ycombinator.com/';
  const mockAnchor = createMockAnchor({ href: 'https://example.com/article' });

  await t.test('intercepts clean left click on valid anchor', () => {
    const event = createMockEvent({ anchor: mockAnchor });
    const res = LinkEvaluator.shouldInterceptClick(event, {
      enabled: true,
      currentLocation: currentUrl
    });
    assert.strictEqual(res.intercept, true);
    assert.strictEqual(res.url, 'https://example.com/article');
  });

  await t.test('ignores non-left clicks (middle click, right click)', () => {
    const middleClickEvent = createMockEvent({ button: 1, anchor: mockAnchor });
    assert.strictEqual(
      LinkEvaluator.shouldInterceptClick(middleClickEvent, { currentLocation: currentUrl }).intercept,
      false
    );

    const rightClickEvent = createMockEvent({ button: 2, anchor: mockAnchor });
    assert.strictEqual(
      LinkEvaluator.shouldInterceptClick(rightClickEvent, { currentLocation: currentUrl }).intercept,
      false
    );
  });

  await t.test('ignores modifier keys (Ctrl, Shift, Alt, Meta)', () => {
    for (const key of ['ctrlKey', 'shiftKey', 'altKey', 'metaKey']) {
      const event = createMockEvent({ [key]: true, anchor: mockAnchor });
      const res = LinkEvaluator.shouldInterceptClick(event, { currentLocation: currentUrl });
      assert.strictEqual(res.intercept, false, `Failed for ${key}`);
      assert.strictEqual(res.reason, 'modifier_key_pressed');
    }
  });

  await t.test('ignores click when drag or text selection occurred', () => {
    const dragEvent = createMockEvent({ anchor: mockAnchor });
    const dragRes = LinkEvaluator.shouldInterceptClick(dragEvent, {
      currentLocation: currentUrl,
      isDrag: true
    });
    assert.strictEqual(dragRes.intercept, false);
    assert.strictEqual(dragRes.reason, 'drag_selection');

    const selectRes = LinkEvaluator.shouldInterceptClick(dragEvent, {
      currentLocation: currentUrl,
      hasTextSelection: true
    });
    assert.strictEqual(selectRes.intercept, false);
    assert.strictEqual(selectRes.reason, 'active_text_selection');
  });

  await t.test('ignores when extension is disabled', () => {
    const event = createMockEvent({ anchor: mockAnchor });
    const res = LinkEvaluator.shouldInterceptClick(event, {
      enabled: false,
      currentLocation: currentUrl
    });
    assert.strictEqual(res.intercept, false);
    assert.strictEqual(res.reason, 'extension_disabled');
  });

  await t.test('ignores interactive form elements', () => {
    const inputEvent = createMockEvent({
      anchor: mockAnchor,
      interactive: { tagName: 'INPUT' }
    });
    const res = LinkEvaluator.shouldInterceptClick(inputEvent, { currentLocation: currentUrl });
    assert.strictEqual(res.intercept, false);
    assert.strictEqual(res.reason, 'interactive_form_control');
  });
});
