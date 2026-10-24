# MaiTab - Smart Tab Manager for Google Chrome

**MaiTab** is a lightweight, zero-dependency Google Chrome extension built strictly on **Manifest V3**. It enhances link-clicking behavior by opening left-clicked links in new tabs without interrupting your browsing flow on the current page. It features an automatic tab-switching toggle, a subdomain-aware website whitelist override, and comprehensive multilingual support for **English**, **Chinese (Simplified)**, and **Japanese**.

---

## Key Features

1. **Open Links in New Tabs by Default**
   - Left-clicking webpage links automatically opens the destination in a new tab without navigating away from your active page.
   - Mimics middle-click behavior, enabling continuous, uninterrupted reading on news feeds, social media, articles, search engines, and technical documentation.
   - Sets tab ancestry via `openerTabId` and positions new tabs immediately adjacent to the current tab (`index: activeIndex + 1`), ensuring Chrome returns focus to your original page when the new tab is closed.
   - Intelligently ignores non-navigation interactions:
     - Modifier keys (`Ctrl`, `Cmd`, `Shift`, `Alt`) trigger standard browser shortcuts unmodified.
     - Right-clicks and middle-clicks are left to native browser handling.
     - In-page anchor jumps (`href="#comments"`) scroll smoothly within the same document without opening new tabs.
     - Interactive form controls (`<button>`, `<input>`, `<textarea>`, `<select>`), `contenteditable` elements, and `download` links continue functioning normally.
     - Mouse drag and text selection are tracked to prevent accidental tab openings when highlighting text inside links.

2. **Automatic Tab Switching Toggle**
   - Easily accessible in both the extension popup and options page.
   - **Enabled (ON):** Links clicked on any website open in new tabs and immediately switch focus to them.
   - **Disabled (OFF, Default):** Links open silently in new background tabs, leaving you on your current page.
   - State persists across browser restarts via `chrome.storage.sync` (with automatic `chrome.storage.local` fallback).

3. **Domain Whitelist Override**
   - Configurable list of websites that **always switch focus** to the newly opened tab, even when the global switch toggle is disabled.
   - **Subdomain-Aware Domain Matching:** Whitelisting `example.com` automatically covers `news.example.com` and `sub.example.com`, while avoiding false positives like `fakeexample.com` or `example.com.evil.org`.
   - **One-Click Whitelisting:** The popup automatically detects the current website's domain and provides a "+ Whitelist" / "✓ Whitelisted" button to toggle its whitelist status in a single click.

4. **Full Multilingual Support (i18n)**
   - Complete localization across **English (en)**, **Chinese Simplified (zh-CN)**, and **Japanese (ja)**.
   - Covers all user-facing interfaces: popup, options page, buttons, badges, descriptions, tooltips, error messages, dialogs, and toasts.
   - Built-in language selector in the popup and options page allows switching languages instantly without requiring a page reload or extension restart.
   - Language preferences persist across browser restarts.
   - Fully compliant with Chrome Extension MV3 localization standards (`_locales/en`, `_locales/zh_CN`, `_locales/ja`).

5. **Interactive Domain Match Tester & Whitelist Import/Export**
   - Dedicated options page includes an interactive tester to simulate how any URL or domain will behave under your current settings.
   - Export and import your whitelist in JSON format for easy backups and synchronization across devices.

---

## Behavior Decision Matrix

| Global Auto-Switch Toggle | Is Current Website Whitelisted? | Resulting Link Behavior |
| :--- | :--- | :--- |
| **Enabled (ON)** | Yes | Opens in **Foreground Tab** (switches focus) |
| **Enabled (ON)** | No | Opens in **Foreground Tab** (switches focus) |
| **Disabled (OFF)** | **Yes (Override)** | Opens in **Foreground Tab** (switches focus) |
| **Disabled (OFF)** | No | Opens in **Background Tab** (stays on current page) |

---

## Installation (Load Unpacked)

To install and run MaiTab in Google Chrome:

1. Open Google Chrome.
2. In the address bar, navigate to:
   ```text
   chrome://extensions/
   ```
3. Enable **Developer mode** using the toggle switch located in the upper-right corner.
4. Click the **Load unpacked** button in the upper-left toolbar.
5. In the file picker dialog, select the project root directory:
   ```text
   /home/mai/ProjectsM/MaiTab
   ```
6. The MaiTab extension icon will appear in your Chrome toolbar. Pin it for quick access!

---

## Configuration & Usage

### 1. Extension Popup
Click the MaiTab icon in the Chrome toolbar:
- **Language Selector (Top Bar):** Switch dynamically between English, 简体中文, and 日本語.
- **Master Switch (Top Right):** Instantly enable or pause link interception without uninstalling.
- **Current Website Card:** View the active tab's hostname and status badge (`Foreground`, `Foreground (Whitelisted)`, or `Background`). Click **+ Whitelist** to add or remove the current website instantly.
- **Switch to New Tab Automatically:** Toggle global foreground vs. background tab opening.
- **Automatic Switching Whitelist:** View, add, or delete domain rules with live counter and subdomain badges.

### 2. Options Page
Right-click the extension icon and select **Options**, or click **Options ↗** inside the popup:
- Configure general preferences (Master switch, Global tab switching, Adjacent tab positioning).
- Search and filter whitelist domains.
- Bulk export and import whitelist entries in JSON format.
- Test any URL using the **Interactive Domain Match Tester** to verify how your rules apply.

---

## Project Structure

```text
MaiTab/
├── manifest.json                     # Chrome Manifest V3 configuration
├── _locales/                         # Standard Chrome extension locale messages
│   ├── en/messages.json              # English extension metadata
│   ├── zh_CN/messages.json           # Chinese (Simplified) metadata
│   └── ja/messages.json              # Japanese metadata
├── background/
│   └── service-worker.js             # Background service worker for tab creation
├── content/
│   └── content.js                    # Content script for link click interception
├── common/
│   ├── i18n.js                       # Centralized multilingual localization engine
│   ├── domain-matcher.js             # Domain normalization and matching logic
│   ├── link-evaluator.js             # Click qualification and anchor safety checks
│   └── storage.js                    # Storage persistence and change notification
├── popup/
│   ├── popup.html                    # Extension popup layout
│   ├── popup.css                     # Modern, responsive popup styling
│   └── popup.js                      # Popup controller and dynamic state
├── options/
│   ├── options.html                  # Full-page options and domain tester
│   ├── options.css                   # Options page styles
│   └── options.js                    # Options page controller
├── icons/
│   ├── icon16.png                    # Extension icon (16x16)
│   ├── icon32.png                    # Extension icon (32x32)
│   ├── icon48.png                    # Extension icon (48x48)
│   └── icon128.png                   # Extension icon (128x128)
├── tests/
│   ├── i18n.test.js                  # Multilingual translation & formatting tests
│   ├── domain-matcher.test.js        # Domain normalization and matching tests
│   ├── link-interceptor.test.js      # Click interception and safety edge-case tests
│   ├── storage.test.js               # Storage persistence and CRUD tests
│   └── manifest-and-integration.test.js # Manifest V3 and E2E simulation tests
├── package.json                      # Project metadata and test runner script
└── README.md                         # Technical documentation
```

---

## Automated Testing

MaiTab includes an automated test suite executed with Node.js built-in test runner.

To run all tests:

```bash
npm test
```

The test suite validates:
- **Manifest V3 Structure:** Schema compliance, permissions, script paths, icon files, and `_locales` messages.
- **Multilingual Completeness:** Verifies that all translation keys exist across English, Chinese, and Japanese without missing entries.
- **Dynamic Formatting:** Validates language switching, parameter interpolation, and DOM translation.
- **Domain Normalization & Matching:** Tests wildcard stripping, subdomains, RFC domain rules, and false-positive prevention.
- **Click Interception Safety:** Verifies modifier keys, form elements, text dragging, and internal `#hash` jumps.
- **Storage & Synchronization:** Validates settings persistence, deduplication, and defaults.

---

## Technical Details & Permissions

- **Manifest V3:** Adheres to Google Chrome's Manifest V3 specifications.
- **Minimal Permissions:**
  - `storage`: Required to persist user preferences, language selection, and whitelist domains across restarts.
  - `tabs`: Required to inspect the current active tab hostname in the popup and to create new tabs with focus control, positioning (`index`), and ancestry (`openerTabId`).
- **Zero Remote Dependencies:** 100% self-contained vanilla JavaScript and CSS without external frameworks, CDNs, or telemetry.

---

## Limitations & Troubleshooting

- **Chrome Internal Pages:** Content scripts cannot execute on `chrome://`, `chrome-extension://`, `devtools://`, or the Chrome Web Store due to browser security boundaries.
- **Local File URLs:** To use the extension on `file:///` URLs, navigate to `chrome://extensions/?id=<extension-id>` and enable **Allow access to file URLs**.
- **JavaScript-Triggered Buttons:** Links with `href="javascript:void(0)"` or elements without valid destination URLs that rely exclusively on custom script event handlers are intentionally not intercepted to prevent breaking web application UI components (e.g., dropdowns, modals, and tabs).

---

## License

MIT License.
