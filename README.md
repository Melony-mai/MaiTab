# MaiTab - Smart Tab Manager for Google Chrome (v1.1)

**MaiTab** is a lightweight, zero-dependency Google Chrome extension built strictly on **Manifest V3**. It enhances link-clicking behavior by opening left-clicked links in new tabs without interrupting your browsing flow on the current page. It features a **Complete Bypass List (Silent List)** with top precedence, a configurable **Global Focus Toggle**, a subdomain-aware **Website Whitelist with Independent Per-Website Focus Options**, and comprehensive multilingual support for **English**, **Chinese (Simplified)**, and **Japanese**.

---

## Key Features

1. **Complete Bypass List (Silent List) [New in v1.1]**
   - Allows you to specify websites on which MaiTab must be **completely inactive**.
   - **Absolute Precedence:** The Complete Bypass List takes priority over all other extension settings. If a website matches an entry in this list, the extension leaves its link behavior entirely unchanged, regardless of the global focus toggle or any whitelist configuration.
   - **Native Browser Behavior:** All links and interactive elements behave exactly as they would in Chrome without this extension installed (following native site routing, same-tab navigation, or site-defined `target="_blank"`).
   - **Zero Interference & Clean Event Handling:** Event listeners (`mousedown`, `mousemove`, `mouseup`, `click`) are detached on bypassed websites to ensure no unnecessary event handlers or performance overhead interfere with web applications.
   - **Independent Management:** Managed completely independently from the regular whitelist, with dedicated controls in both the popup and options page.
   - **Persistent & Subdomain-Aware:** Entries persist reliably across browser restarts via `chrome.storage.sync` (with local fallback) and automatically cover subdomains (e.g. bypassing `google.com` also covers `mail.google.com` and `docs.google.com`).

2. **Open Links in New Tabs by Default**
   - Left-clicking webpage links on active sites automatically opens the destination in a new tab without navigating away from your active page.
   - Mimics middle-click behavior, enabling continuous, uninterrupted reading on news feeds, social media, articles, search engines, and technical documentation.
   - Sets tab ancestry via `openerTabId` and positions new tabs immediately adjacent to the current tab (`index: activeIndex + 1`), ensuring Chrome returns focus to your original page when the new tab is closed.
   - Intelligently ignores non-navigation interactions:
     - Modifier keys (`Ctrl`, `Cmd`, `Shift`, `Alt`) trigger standard browser shortcuts unmodified.
     - Right-clicks and middle-clicks are left to native browser handling.
     - In-page anchor jumps (`href="#comments"`) scroll smoothly within the same document without opening new tabs.
     - Interactive form controls (`<button>`, `<input>`, `<textarea>`, `<select>`), `contenteditable` elements, and `download` links continue functioning normally.
     - Mouse drag and text selection are tracked to prevent accidental tab openings when highlighting text inside links.

3. **Global Focus Toggle**
   - Centrally controls whether a newly opened tab automatically receives focus when left-clicking a link across unlisted websites.
   - **Enabled (ON):** Left-clicking a link opens the destination in a new tab and immediately switches focus to that tab.
   - **Disabled (OFF, Default):** Left-clicking a link opens the destination in a new background tab, keeping the current tab active.
   - Clearly labeled and integrated into both the popup and options interfaces.
   - Persists reliably across browser restarts via `chrome.storage.sync` (with automatic `chrome.storage.local` fallback).

4. **Per-Website Whitelist Focus Options & Overrides**
   - Each whitelisted website features an **independent focus option** to control whether its newly opened tabs receive focus.
   - **Independent of Global Toggle:** The per-website setting works independently of the global focus toggle, allowing full customization for specific domains.
     - **Focus Enabled (Foreground):** Links clicked on that website open in a new tab and immediately receive focus, even when the Global Focus Toggle is OFF.
     - **Focus Disabled (Background):** Links clicked on that website open in a new background tab without switching away, even when the Global Focus Toggle is ON.
   - **Subdomain-Aware Domain Matching:** Whitelisting `example.com` automatically covers `news.example.com` and `sub.example.com`, while avoiding false positives like `fakeexample.com` or `example.com.evil.org`.
   - **Instant Persistence & Application:** Changes apply immediately without requiring page reloads and persist across browser restarts.
   - **One-Click Whitelisting & In-Popup Toggle:** The popup detects the current website's domain, provides a "+ Whitelist" / "✓ Whitelisted" button, and displays an inline focus toggle for instant adjustment.

5. **Full Multilingual Support (i18n)**
   - Complete localization across **English (en)**, **Chinese Simplified (zh-CN)**, and **Japanese (ja)**.
   - Covers all user-facing interfaces: popup tabs, options page, buttons, badges, descriptions, tooltips, error messages, dialogs, and toasts.
   - Built-in language selector in the popup and options page allows switching languages instantly without requiring a page reload or extension restart.
   - Language preferences persist across browser restarts.
   - Fully compliant with Chrome Extension MV3 localization standards (`_locales/en`, `_locales/zh_CN`, `_locales/ja`).

6. **Interactive Domain Match Tester & Import/Export**
   - Dedicated options page includes an interactive tester to simulate how any URL or domain will behave under your current settings, displaying whether a site is Bypassed, Whitelisted, or Unlisted, and its resulting behavior.
   - Export and import both your Whitelist and Complete Bypass List in JSON format for easy backups and synchronization across devices.

---

## Behavior Decision Matrix & Setting Precedence

The extension determines link-clicking and tab behavior using a strict, predictable 4-tier precedence hierarchy:

```
[ Tier 1: Extension Master Switch ]
               │
      Is extension enabled?
       ├── NO  ──> Normal browser link navigation (extension paused)
       └── YES
            │
[ Tier 2: Complete Bypass List (Silent List) ]
            │
   Does website match Bypass List?
    ├── YES ──> Native Browser Behavior (Extension completely inactive; listeners detached)
    └── NO
         │
[ Tier 3: Website Whitelist Overrides ]
         │
Does website match Whitelist?
 ├── YES ──> Follow Per-Website Focus Setting (Overrides Global Toggle)
 │            ├── Focus ON  ──> New Foreground Tab (switches focus)
 │            └── Focus OFF ──> New Background Tab (keeps current page)
 └── NO
      │
[ Tier 4: Global Focus Toggle ]
      ├── ON  ──> New Foreground Tab (switches focus)
      └── OFF ──> New Background Tab (keeps current page)
```

### Precedence Decision Table

| Bypass List Match | Whitelist Match | Per-Website Focus Setting | Global Focus Toggle | Resulting Link Behavior |
| :---: | :---: | :---: | :---: | :--- |
| **MATCH** | Any | Any | Any | **Native Browser Behavior (Extension Completely Inactive)** |
| No Match | **MATCH** | **Focus ON** | Any (ON or OFF) | **New Foreground Tab** (immediate focus; whitelist override) |
| No Match | **MATCH** | **Focus OFF** | Any (ON or OFF) | **New Background Tab** (keeps current tab active; whitelist override) |
| No Match | No Match | N/A | **ON** | **New Foreground Tab** (global focus ON) |
| No Match | No Match | N/A | **OFF** | **New Background Tab** (global focus OFF, default) |

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
- **Current Website Card:**
  - View the active tab's hostname and status badge (`Bypassed (Silent)`, `Foreground`, `Foreground (Whitelisted)`, `Background (Whitelisted)`, or `Background`).
  - **+ Whitelist / ✓ Whitelisted:** Quickly add or remove the active site from the tab-switching whitelist.
  - **+ Bypass / ✓ Bypassed:** Quickly add or remove the active site from the Complete Bypass List.
  - When whitelisted and not bypassed, an inline **Tab Focus** switch allows toggling foreground vs. background opening directly for that site.
- **Global Tab Focus Toggle:** Toggle global foreground vs. background tab opening for unlisted websites.
- **Lists Segmented Navigation:**
  - **Whitelist Tab:** View and manage whitelisted domains, toggle per-domain auto-focus, and add new whitelist rules.
  - **Complete Bypass Tab:** View and manage domains where MaiTab is completely inactive, with add and remove controls.

### 2. Options Page
Right-click the extension icon and select **Options**, or click **Options ↗** inside the popup:
- **General Preferences:** Configure Master switch, Global tab focus, and Adjacent tab positioning.
- **Website Switching Whitelist:** Manage whitelisted domains with per-domain auto-focus switches, search filter, and bulk import/export.
- **Complete Bypass List (Silent List):** Manage websites on which MaiTab is completely inactive, with search filter and bulk import/export.
- **Interactive Domain Match Tester:** Test any URL or domain against both the Complete Bypass List and Whitelist to verify which rule matches and the exact resulting tab behavior.
- **Technical Documentation:** Review comprehensive domain matching rules, safety safeguards, and precedence logic.

---

## Project Structure

```text
MaiTab/
├── manifest.json                     # Chrome Manifest V3 configuration (v1.1)
├── _locales/                         # Standard Chrome extension locale messages
│   ├── en/messages.json              # English extension metadata
│   ├── zh_CN/messages.json           # Chinese (Simplified) metadata
│   └── ja/messages.json              # Japanese metadata
├── background/
│   └── service-worker.js             # Background service worker for tab creation
├── content/
│   └── content.js                    # Content script for link click interception & listener lifecycle
├── common/
│   ├── i18n.js                       # Centralized multilingual localization engine
│   ├── domain-matcher.js             # Domain normalization, whitelist & bypass matching logic
│   ├── link-evaluator.js             # Click qualification, anchor safety, and bypass checks
│   └── storage.js                    # Storage persistence for settings, whitelist & bypass list
├── popup/
│   ├── popup.html                    # Extension popup layout with tabbed list views
│   ├── popup.css                     # Modern, responsive popup styling
│   └── popup.js                      # Popup controller with whitelist & bypass management
├── options/
│   ├── options.html                  # Full-page options with dedicated bypass list & domain tester
│   ├── options.css                   # Options page styles
│   └── options.js                    # Options page controller with import/export & simulation
├── icons/
│   ├── icon16.png                    # Extension icon (16x16)
│   ├── icon32.png                    # Extension icon (32x32)
│   ├── icon48.png                    # Extension icon (48x48)
│   ├── icon128.png                   # Extension icon (128x128)
│   └── icon512.png                   # Extension icon (512x512)
├── tests/
│   ├── i18n.test.js                  # Multilingual translation & completeness tests
│   ├── domain-matcher.test.js        # Domain normalization, whitelist, bypass & precedence tests
│   ├── link-interceptor.test.js      # Click interception, safety edge cases & bypass tests
│   ├── storage.test.js               # Storage persistence, CRUD & bypass list tests
│   └── manifest-and-integration.test.js # Manifest V3, 6-scenario verification & E2E simulation
├── MaiTab.png                        # Master brand icon asset (512x512)
├── package.json                      # Project metadata (v1.1.0) and test runner script
└── README.md                         # Technical documentation
```

---

## Automated Testing & Verification

MaiTab includes an automated test suite executed with Node.js built-in test runner.

To run all tests:

```bash
npm test
```

The test suite validates:
1. **Complete Bypass List (Silent List):** Websites on the Complete Bypass List follow their native link-clicking behavior without interference, with listeners detached.
2. **Whitelist Focus Behavior:** Websites on the regular whitelist continue to follow their configured automatic-focus behavior.
3. **Global Settings Fallback:** Websites not included in either list follow the global settings.
4. **Precedence Hierarchy:** Complete Bypass List strictly takes precedence when a website matches both lists.
5. **Persistence Across Restarts:** Settings, whitelist, and bypass list persist across simulated browser restarts.
6. **Manifest V3 Structure:** Schema compliance, version 1.1 consistency, permissions, icon files, and localization.

---

## Technical Details & Permissions

- **Manifest V3:** Adheres strictly to Google Chrome's Manifest V3 specifications.
- **Minimal Permissions:**
  - `storage`: Required to persist user preferences, language selection, whitelist domains, and bypass list across browser restarts.
  - `tabs`: Required to inspect the current active tab hostname in the popup and to create new tabs with focus control, positioning (`index`), and ancestry (`openerTabId`).
- **Zero Remote Dependencies:** 100% self-contained vanilla JavaScript and CSS without external frameworks, CDNs, or telemetry.

---

## License

MIT License.
