# MaiTab - Smart Tab Manager for Google Chrome (v1.31)

<p align="center">
  <strong>English</strong> | <a href="README_zh-CN.md">简体中文</a> | <a href="README_ja.md">日本語</a>
</p>

---

**MaiTab** is a lightweight, zero-dependency Google Chrome extension built strictly on **Manifest V3**. It enhances link-clicking behavior by opening left-clicked links in new tabs without interrupting your browsing flow on the current page. It features an authentic **macOS Aqua / Apple System Settings** UI with **Light Mode & Dark Mode** support, real-time **System Theme Tracking**, a **Complete Bypass List (Silent List)** with top precedence, a configurable **Global Focus Toggle**, a subdomain-aware **Website Whitelist with Independent Per-Website Focus Options**, built-in **GitHub Repository Direct Iteration and In-Popup Synchronization**, and comprehensive multilingual support for **English**, **Simplified Chinese**, and **Japanese**.

---

## Table of Contents

- [What's New in v1.31](#whats-new-in-v131)
- [What's New in v1.3](#whats-new-in-v131)
- [What's New in v1.2](#whats-new-in-v12)
- [Key Features](#key-features)
- [Behavior Decision Matrix & Setting Precedence](#behavior-decision-matrix-setting-precedence)
- [Installation (Load Unpacked)](#installation-load-unpacked)
- [Configuration & Usage](#configuration-usage)
  - [1. Extension Popup](#1-extension-popup)
  - [2. Options Page (Advanced Settings)](#2-options-page-advanced-settings)
- [Dependencies & Environment Requirements](#dependencies-environment-requirements)
- [Troubleshooting & FAQ](#troubleshooting-faq)
- [Manual Update Checking & Synchronization](#manual-update-checking-synchronization)
- [Theme Modes: System, Light, and Dark](#theme-modes-system-light-and-dark)
- [Direct GitHub Repository Iteration & CLI Scripts](#direct-github-repository-iteration-cli-scripts)
- [Automated Testing & Verification](#automated-testing-verification)
- [Project Structure](#project-structure)
- [Technical Details & Permissions](#technical-details-permissions)
- [License](#license)

---

## What's New in v1.31

- **Public GitHub Repository & Open Access:**
  - The repository is fully public and accessible on GitHub at [https://github.com/Melony-mai/MaiTab](https://github.com/Melony-mai/MaiTab), allowing transparent collaboration and updates.
- **Manual Update Checking & In-Popup Synchronization:**
  - **Accessible "Check for Updates" Button:** Positioned directly adjacent to the displayed extension version badge (`v1.31`) in the popup header.
  - **Live Synchronization Status Feedback:**
    - **Up to Date:** Local project is verified to be up to date with the remote repository on `origin/main`.
    - **Update Available:** Displays the number of incoming commits along with a commit summary list.
    - **Checking:** Active inspection in progress with spinning indicator.
    - **Update Failed:** Descriptive failure messaging and diagnostics for network errors or conflicts.
  - **One-Click Synchronization:** Initiates and completes repository synchronization directly by clicking the update button in the popup settings interface without copying terminal commands or executing manual scripts.
  - **Automatic Background Bridge:** Automatically interfaces with the local synchronization service (`maitab-sync.service` / `scripts/sync-server.js`) to apply remote GitHub updates directly to the local project in-place.
  - **Local Work Protection:** Automatically protects uncommitted local modifications and untracked files via Git stashing throughout the synchronization lifecycle, safely restoring work after merge.
  - **Conflict Safety:** Detects any merge or rebase conflicts, listing conflicted files with diagnostic resolution instructions without silently discarding work or corrupting git state.
- **Automatic System Theme Switching:**
  - **System Theme Option:** Added alongside the existing Light Mode and Dark Mode options in both the popup settings and advanced options interfaces.
  - **Real-Time OS Detection:** Automatically tracks the operating system's dark/light appearance settings via `prefers-color-scheme` in real time without requiring an extension or browser restart.
  - **Manual Override Preservation:** Manual selections (Light Mode or Dark Mode) remain strictly active and are preserved across reopens until the user switches back to System mode.
  - **Cross-Interface Consistency:** Full visual harmony and state synchronization across popup settings and advanced settings pages.
- **Optimized Popup Settings Interface:**
  - Streamlined spacing, hierarchy, and component alignment to accommodate update checking and theme switching without crowding, horizontal overflow, or excessive scrolling.
- **Direct GitHub Repository Iteration & Synchronization:**
  - **In-Place Codebase Updates:** Retrieve and synchronize the latest commits directly from the remote GitHub repository without requiring manual re-cloning or re-downloading.
  - **Preserves Local Modifications:** Automatically detects uncommitted work (modified files, staged changes, and untracked files) and preserves them safely using stashing throughout the synchronization cycle.
  - **Conflict Detection & Safe Diagnostics:** Detects Git merge/rebase conflicts and stash-pop conflicts safely, providing clear, actionable step-by-step diagnostic feedback when manual resolution is needed.
  - **Non-Destructive Status Inspection:** New `npm run sync:check` (or `--check` / `--dry-run`) command inspects incoming commits and divergence from remote without touching working files.
  - **Post-Synchronization Verification:** Automatically executes the complete test suite (`npm test`) post-synchronization to guarantee project functionality and prevent regressions.
  - **Enhanced CLI & Scripts:** Added `npm run sync`, `npm run iterate`, `npm run sync:check`, and `npm run sync:server` with support for `--check`, `--merge`, `--no-tests`, and `--abort-on-conflict`.
- **Project Version Update to v1.31:**
  - Updated project version to **v1.31** consistently across `manifest.json`, `package.json`, localization dictionaries (`en`, `zh-CN`, `ja`), interface badges, export metadata, and automated verification suites.

---

## What's New in v1.3

- **Light Mode and Dark Mode Support:**
  - **Easily Accessible Quick Toggle:** Added a 1-click theme switch button with Sun and Moon icons directly in the header of both the popup settings interface and the advanced settings interface.
  - **Interface Theme Preference Selector:** Added a dedicated Appearance Theme dropdown in Options > General Preferences.
  - **Immediate Theme Application:** Switching themes instantly updates the entire UI via dynamic CSS variables without requiring a page reload or browser restart.
  - **Comprehensive Component Adaptation:** Perfectly adapts all window backgrounds, cards, text hierarchy, buttons, inputs, segmented controls, badges, tables, testers, scrollbars, and toast notifications across both macOS Dark Aqua and macOS Light Aqua palettes.
  - **Persistent Theme Preference:** Selected theme persists reliably across popup reopens and browser restarts via `chrome.storage` and local caching.
- **Direct Iteration from GitHub Repository:**
  - Added `scripts/sync-repo.js` (executable via `npm run sync`) to safely fetch, rebase, and synchronize development against the latest remote GitHub repository.
  - Automatically protects uncommitted or untracked local modifications using safe temporary stashing.
  - Verifies project integrity by executing the full automated test suite post-synchronization.
- **Version bump to v1.3** across `manifest.json`, `package.json`, localization dictionaries, and interface headers.

---

## What's New in v1.2

- **macOS Dark Aqua / Apple System Settings UI Design:**
  - Complete redesign of both the **Popup Settings Interface** and **Advanced Settings Interface (Options)** following `POPUP_UI_SPEC.md`.
  - **Inset Grouped Architecture:** Options are cleanly categorized into rounded, translucent cards (`rgba(255, 255, 255, 0.05)`) over a deep neutral window background (`#1c1c1e`).
  - **Apple System Controls:** Custom controls with native Apple bounce easing (`cubic-bezier(0.4, 0, 0.2, 1)`), tactile push-button compression (`scale(0.985)`), hairline dividing strokes, and neon-blue focus rings.
  - **Native Dark Select Menus:** Embedded SVG chevron dropdowns with dark option styling.
  - **Custom macOS Overlay Scrollbar:** Non-intrusive 6px overlay scrollbars across Windows, macOS, and Linux.
- **Responsive Layout & Resolution Scaling:**
  - Pixel-perfect, zero horizontal overflow across 100% (1080p), 125%, 150%, 200% (macOS Retina), and 4K HiDPI displays.
  - Fluid responsive layout in Advanced Settings for viewports ranging from 375px mobile to full-width desktop monitors.
- **Version bump to v1.2** across `manifest.json`, `package.json`, localization dictionaries, and interface headers.

---

## Key Features

1. **Complete Bypass List (Silent List)**
   - Allows you to specify websites on which MaiTab must be **completely inactive**.
   - **Absolute Precedence:** The Complete Bypass List takes priority over all other extension settings. If a website matches an entry in this list, the extension leaves its link behavior entirely unchanged, regardless of the global focus toggle or any whitelist configuration.
   - **Native Browser Behavior:** All links and interactive elements behave exactly as they would in Chrome without this extension installed (following native site routing, same-tab navigation, or site-defined `target="_blank"`).
   - **Zero Interference & Clean Event Handling:** Event listeners (`mousedown`, `mousemove`, `mouseup`, `click`) are detached on bypassed websites to ensure no unnecessary event handlers or performance overhead interfere with web applications.
   - **Independent Management:** Managed completely independently from the regular whitelist, with dedicated controls in both the popup and options page.
   - **Persistent & Subdomain-Aware:** Entries persist reliably across browser restarts via `chrome.storage.sync` (with local fallback) and automatically cover subdomains (e.g., bypassing `google.com` also covers `mail.google.com` and `docs.google.com`).

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
   - **One-Click Whitelisting & In-Popup Toggle:** The popup detects the current website's domain, provides a "+ Whitelist" / "Whitelisted" button, and displays an inline focus toggle for instant adjustment.

5. **Full Multilingual Support (i18n)**
   - Complete localization across **English (en)**, **Simplified Chinese (zh-CN)**, and **Japanese (ja)**.
   - Covers all user-facing interfaces: popup tabs, options page, buttons, badges, descriptions, tooltips, error messages, dialogs, and toasts.
   - Built-in language selector in the popup and options page allows switching languages instantly without requiring a page reload or extension restart.
   - Language preferences persist across browser restarts.
   - Fully compliant with Chrome Extension MV3 localization standards (`_locales/en`, `_locales/zh_CN`, `_locales/ja`).

6. **Interactive Domain Match Tester & Import/Export**
   - Dedicated options page includes an interactive tester to simulate how any URL or domain will behave under your current settings, displaying whether a site is Bypassed, Whitelisted, or Unlisted, and its resulting behavior.
   - Export and import both your Whitelist and Complete Bypass List in JSON format for easy backups and synchronization across devices.

7. **Manual Update Checking and Synchronization**
   - **Accessible Check Button:** Conveniently located next to the version badge in the popup header for instant access.
   - **Real-Time Status Detection:** Compares local commit and version info against the remote GitHub repository, accurately reporting whether you are **Up to Date**, have an **Update Available**, are currently **Checking**, or if an **Update Failed**.
   - **Manual Synchronization:** When updates are detected, users can trigger synchronization directly from the popup.
   - **Safe Stashing & Conflict Handling:** Preserves uncommitted work and local changes, detecting conflicts cleanly without overwriting local modifications.
   - **Direct One-Click Synchronization:** Seamlessly applies remote updates in-place directly from the popup settings interface with safe git stashing and conflict resolution.

8. **Automatic System Theme Switching with Light & Dark Modes**
   - **Three Distinct Modes:** Supports **System (Automatic)**, **Light Mode**, and **Dark Mode**.
   - **Real-Time OS Synchronization:** In System mode, instantly listens and adapts to operating system appearance changes (`prefers-color-scheme`) without requiring an extension or browser reload.
   - **Strict Manual Precedence:** Manual selections (Light or Dark) remain firmly locked and persist across sessions until you explicitly re-select System mode.
   - **Full Interface Consistency:** Applies themes uniformly across the popup settings interface and the advanced settings interface.

---

## Behavior Decision Matrix & Setting Precedence

The extension determines link-clicking and tab behavior using a strict, predictable 4-tier precedence hierarchy:

```text
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
- **Theme Quick Toggle (Sun / Moon):** Toggle between Light and Dark mode with a single click.
- **Version Badge & Check for Updates:** View extension version (`v1.31`) and click **Check** to inspect GitHub for updates.
- **Synchronization Card:** View real-time status (`Up to Date`, `Update Available`, `Checking`, `Update Failed`). When updates are available, click **Update & Sync** to update in-place.
- **Current Website Card:**
  - View the active tab's hostname and status badge (`Bypassed`, `Foreground`, `Foreground (Whitelisted)`, `Background (Whitelisted)`, or `Background`).
  - **+ Whitelist / Whitelisted:** Quickly add or remove the active site from the tab-switching whitelist.
  - **+ Bypass / Bypassed:** Quickly add or remove the active site from the Complete Bypass List.
  - When whitelisted and not bypassed, an inline **Tab Focus** switch allows toggling foreground vs. background opening directly for that site.
- **Global Tab Focus Toggle:** Toggle global foreground vs. background tab opening for unlisted websites.
- **Lists Segmented Navigation:**
  - **Whitelist Tab:** View and manage whitelisted domains, toggle per-domain auto-focus, and add new whitelist rules.
  - **Complete Bypass Tab:** View and manage domains where MaiTab is completely inactive, with add and remove controls.

### 2. Options Page (Advanced Settings)
Right-click the extension icon and select **Options**, or click **Options ↗** inside the popup:
- **General Preferences:** Configure Master switch, Global tab focus, Adjacent tab positioning (`Open Next to Current Tab`), and Interface Theme appearance (`System`, `Dark Mode`, `Light Mode`).
- **Website Switching Whitelist:** Manage whitelisted domains with per-domain auto-focus switches, search filter, and bulk JSON import/export.
- **Complete Bypass List (Silent List):** Manage websites on which MaiTab is completely inactive, with search filter and bulk JSON import/export.
- **Interactive Domain Match Tester:** Test any URL or domain against both the Complete Bypass List and Whitelist to verify which rule matches and the exact resulting tab behavior.
- **Technical Documentation:** Review comprehensive domain matching rules, safety safeguards, and precedence logic.

---

## Dependencies & Environment Requirements

### Runtime Environment
- **Browser:** Google Chrome v88+ (or any Chromium-based browser supporting Manifest V3, such as Microsoft Edge, Brave, Opera, Vivaldi).
- **Runtime Dependencies:** **Zero external dependencies.** Built entirely with native vanilla JavaScript (ES6+) and standard CSS3. No external JavaScript frameworks (React, Vue, etc.), no CSS libraries, no runtime npm packages, no third-party CDNs, and no telemetry or tracking scripts.

### Development & Synchronization Prerequisites
- **Node.js:** v18.0.0 or later (required only for running the native automated test suite `npm test` via Node's built-in test runner, or running local synchronization scripts).
- **Git:** v2.20 or later (required for local repository iteration, synchronization via `scripts/sync-repo.js`, and conflict resolution).
- **Optional Local Sync Server:** Node.js HTTP bridge (`scripts/sync-server.js` or systemd service `maitab-sync.service` on port `8765`) if utilizing in-popup one-click repository synchronization.

---

## Troubleshooting & FAQ

### 1. Links are not opening in a new tab
- **Check Master Switch:** Ensure the master toggle in the extension popup (top-right) or Options page is turned ON. When paused, the status badge shows `Paused` and links navigate natively.
- **Internal / Restricted Pages:** Chrome strictly prohibits extensions from injecting content scripts into special pages, including `chrome://`, `chrome-extension://`, `edge://`, `about:blank`, Chrome Web Store, and DevTools pages. On these pages, links follow default browser behavior.
- **Complete Bypass List (Silent List):** Verify if the active domain is listed in the Complete Bypass List. On bypassed domains, MaiTab completely unregisters event listeners and lets Chrome handle all navigation natively.
- **In-Page Anchor Links:** Fragment links (e.g., `<a href="#section">`) are intentionally ignored by MaiTab to ensure smooth on-page scrolling without opening redundant tabs.
- **Modifier Keys & Alternate Clicks:** If `Ctrl`, `Cmd`, `Shift`, or `Alt` is held, or if you right-click or middle-click, native Chrome shortcut handling takes over.
- **Interactive Elements & Form Controls:** Buttons, inputs, `<select>` dropdowns, `contenteditable` fields, and links with `download` attributes are preserved for normal interaction.
- **Text Selection Dragging:** If you drag your cursor to select text inside a hyperlink, MaiTab suppresses tab opening to prevent accidental navigation while copying text.

### 2. Tab opens in the background instead of switching to the foreground (or vice versa)
- **Check Setting Precedence Hierarchy:**
  1. If the domain is in the **Website Whitelist**, its **per-site focus setting** strictly overrides the global switch. Check the domain's toggle in the Whitelist tab or Options page (`Focus ON` for foreground, `Focus OFF` for background).
  2. If the domain is **not whitelisted**, verify the **Global Tab Focus Toggle** in the popup or options page. When OFF (default), links open in background tabs; when ON, links immediately receive focus.
- **Use the Interactive Domain Match Tester:** Open the Options page and paste the destination URL into the **Interactive Domain Match Tester** to view the exact rule match and resulting tab focus behavior in real time.

### 3. Update check displays "Update Failed" in the popup
- **GitHub API Connectivity / Rate Limiting:** Checking remote updates queries the public GitHub REST API (`https://api.github.com/repos/Melony-mai/MaiTab`). Ensure your device has an active internet connection. Unauthenticated requests to GitHub are subject to IP rate limits (60 requests/hour).
- **Local Synchronization Service Status:** For one-click in-popup synchronization, ensure the local synchronization bridge is running (`npm run sync:server` or `systemctl --user status maitab-sync.service`). If the server is offline, you can run `npm run sync` directly from the terminal.

### 4. Git conflict detected during synchronization
- **Local Work Protection:** MaiTab automatically stashes uncommitted modifications and untracked files before pulling updates, so no work is ever lost.
- **Resolving Conflicts:** If remote changes conflict with local commits during rebase:
  1. Open the conflicted files indicated in the error message.
  2. Resolve the standard conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`).
  3. Stage the resolved files: `git add <file>`.
  4. Continue rebase: `git rebase --continue`.
  5. To abort the update and return cleanly to your pre-sync state: `git rebase --abort`.

### 5. Extension fails to load in Chrome ("Load Unpacked")
- **Developer Mode:** Ensure the **Developer mode** toggle in `chrome://extensions/` (top right) is switched ON.
- **Correct Root Directory:** In the file picker, select the project root folder containing `manifest.json` (not a subfolder like `popup` or `content`).
- **File Permissions:** Verify that the files have read permissions for your user account.

### 6. Theme appearance does not match system theme
- **Manual Theme Override:** If you previously manually toggled Light Mode or Dark Mode, your manual preference remains locked across sessions. To re-enable automatic detection, select **System** from the Theme Appearance dropdown in Popup or Options.

---

## Manual Update Checking & Synchronization

MaiTab features an integrated update-check and synchronization workflow directly accessible inside the popup interface, designed specifically for rapid development and real-time synchronization with its remote GitHub repository.

### How to Check for Updates
1. Open the MaiTab extension popup by clicking the extension icon in Chrome's toolbar.
2. In the header next to the version badge (`v1.31`), click the **"Check"** / **"Check for Updates"** button.
3. MaiTab will inspect the remote GitHub repository (`main` branch) and local project state.
4. The synchronization card displays the current status:
   - **Up to Date:** Your local project matches the latest remote commit on GitHub.
   - **Update Available:** New incoming commits were found on GitHub. The card displays the number of incoming commits and lists their summary titles and short commit hashes.
   - **Checking:** An update check is currently contacting GitHub and local services.
   - **Update Failed:** Displays specific error diagnostics (e.g., network reachability, rate limiting, or sync conflicts).

### How to Synchronize Updates
1. When updates are available, click the **"Update & Sync"** button directly in the popup settings interface.
2. The synchronization system safely handles the update completely in-place:
   - **Safe Stashing:** Any uncommitted modifications, staged files, or untracked work in your local repository are automatically stashed so no work is ever lost or discarded.
   - **In-Place Integration:** Remote commits are fetched and merged/rebased cleanly without requiring manual commands or terminal re-cloning.
   - **Automatic Restoration:** Local uncommitted changes are restored back cleanly.
   - **Integrity Verification:** Post-sync tests verify that extension functionality remains intact.
3. Upon completion, the popup status refreshes automatically to **Up to Date**.
4. **Zero Manual Steps:** No terminal commands or `npm run sync` script execution required—simply click to synchronize.

### Handling Conflicts Safely
If conflicting changes exist between local work and remote commits:
- Synchronization safely pauses and protects your work.
- Conflicted files are clearly listed with diagnostic resolution instructions.
- Stashed changes remain safely preserved in `git stash list`.
- No files are ever silently overwritten.

---

## Theme Modes: System, Light, and Dark

MaiTab provides three distinct visual themes crafted according to Apple's macOS Aqua / System Settings design language:

| Theme Mode | Description & Behavior |
| :--- | :--- |
| **System (Automatic)** | **Follows Operating System Appearance in Real Time.** Automatically switches between macOS Dark Aqua and macOS Light Aqua based on your operating system's theme (`prefers-color-scheme`). Changes take effect immediately without requiring a browser or extension restart. |
| **Dark Mode** | **macOS Dark Aqua Palette.** Features a deep `#1c1c1e` window background, translucent grouped cards (`rgba(255, 255, 255, 0.05)`), neon-blue focus rings (`#0A84FF`), and light high-legibility typography (`#f5f5f7`). Remains active regardless of OS settings. |
| **Light Mode** | **macOS Light Aqua Palette.** Features a crisp `#f5f5f7` window background, pure white cards (`#ffffff`), subtle borders (`rgba(0, 0, 0, 0.08)`), Apple blue accents (`#0071e3`), and deep dark typography (`#1d1d1f`). Remains active regardless of OS settings. |

### Switching Themes
- **In Popup Settings:**
  - **Quick Toggle Button:** Click the Sun/Moon icon in the popup header to quickly toggle between Light Mode and Dark Mode.
  - **Theme Appearance Selector:** In Popup > General Settings, select **System**, **Dark Mode**, or **Light Mode** from the dropdown menu.
- **In Advanced Settings (Options Page):**
  - Use the Sun/Moon quick toggle button in the header, or select your preference from the **Interface Theme** dropdown under **General Preferences**.
- **Persistence:** Your theme selection is automatically saved in `chrome.storage` (and cached locally) and synchronized across all extension views in real time. Manual selections remain locked until you choose System mode again.

---

## Direct GitHub Repository Iteration & CLI Scripts

MaiTab provides a direct iteration capability that allows you to safely synchronize the project with the latest commits from its remote GitHub repository and use the updated codebase as the basis for subsequent development without manual re-cloning or re-downloading.

### 1. Synchronize and Iterate
To synchronize the project with the latest remote version:

```bash
npm run sync
# or
npm run iterate
```

This automated workflow:
1. **Preserves Uncommitted Work:** Automatically checks for local modifications, staged changes, and untracked files, safely preserving them via Git stash before any sync operations.
2. **Retrieves Remote Updates:** Fetches and prunes tracking branches from GitHub (`origin`), inspecting commit divergence (ahead / behind).
3. **Applies In-Place Updates:**
   - If local has no unpushed commits (`aheadCount === 0`), applies a clean, atomic fast-forward (`git merge --ff-only`).
   - If local has unpushed commits, rebases local commits cleanly on top of the latest remote changes (`git rebase`).
4. **Detects & Diagnoses Merge Conflicts:** Safely detects merge, rebase, and stash-pop conflicts, presenting clear step-by-step diagnostic feedback with file paths and commands rather than leaving broken states.
5. **Restores Stashed Work:** Restores all uncommitted changes back to the working directory cleanly via `git stash pop`.
6. **Verifies Integrity:** Automatically executes the complete test suite (`npm test`) post-synchronization to guarantee zero regressions.

### 2. Inspect Remote Status (Dry-Run Check)
To check whether the local branch is behind or ahead of remote without modifying your working tree:

```bash
npm run sync:check
```

### 3. Advanced CLI Options
The utility can also be invoked with customized flags:

```bash
# Check remote status without modifying the working tree
node scripts/sync-repo.js --check

# Synchronize without running post-sync tests
node scripts/sync-repo.js --no-tests

# Use merge commit strategy instead of rebase for diverged branches
node scripts/sync-repo.js --merge

# Automatically abort rebase/merge and restore previous state if conflict arises
node scripts/sync-repo.js --abort-on-conflict

# Display full help manual
node scripts/sync-repo.js --help
```

---

## Automated Testing & Verification

MaiTab includes an automated test suite executed with Node.js built-in test runner.

To run all tests:

```bash
npm test
```

The test suite validates:
1. **Light & Dark Theme Support:** Seamless toggle interactivity, immediate DOM application, persistence across restarts, and full visual adaptation across both themes.
2. **Complete Bypass List (Silent List):** Websites on the Complete Bypass List follow their native link-clicking behavior without interference, with listeners detached.
3. **Whitelist Focus Behavior:** Websites on the regular whitelist continue to follow their configured automatic-focus behavior.
4. **Global Settings Fallback:** Websites not included in either list follow the global settings.
5. **Precedence Hierarchy:** Complete Bypass List strictly takes precedence when a website matches both lists.
6. **Persistence Across Restarts:** Settings, whitelist, bypass list, and theme preferences persist across simulated browser restarts.
7. **Manifest V3 Structure:** Schema compliance, version 1.31 consistency, permissions, icon files, and localization.
8. **UI Layout & Responsiveness:** Verified via real headless Chrome DevTools Protocol (CDP) across multiple viewports and display scale factors (100%, 125%, 150%, 200%).
9. **GitHub Repository Synchronization:** Verified safe stashing, fetch, rebase, and restoration workflow.
10. **Direct Repository Iteration Suite:** Validates remote fetching, in-place fast-forward and rebase synchronization, local uncommitted modifications protection, conflict detection and actionable diagnostics, dry-run checks, and project-wide version consistency.

---

## Project Structure

```text
MaiTab/
├── manifest.json                     # Chrome Manifest V3 configuration (v1.31)
├── _locales/                         # Standard Chrome extension locale messages
│   ├── en/messages.json              # English extension metadata
│   ├── zh_CN/messages.json           # Chinese (Simplified) metadata
│   └── ja/messages.json              # Japanese metadata
├── background/
│   └── service-worker.js             # Background service worker for tab creation
├── content/
│   └── content.js                    # Content script for link click interception & listener lifecycle
├── common/
│   ├── version-info.js               # Central version and commit info (v1.31)
│   ├── updater.js                    # Manual update checker & synchronization client
│   ├── i18n.js                       # Centralized multilingual localization engine (v1.31)
│   ├── domain-matcher.js             # Domain normalization, whitelist & bypass matching logic
│   ├── link-evaluator.js             # Click qualification, anchor safety, and bypass checks
│   └── storage.js                    # Storage persistence for settings, whitelist, bypass & theme
├── popup/
│   ├── popup.html                    # Extension popup layout with Light & Dark macOS Aqua themes (v1.31)
│   ├── popup.css                     # macOS Aqua System Settings styling with theme tokens
│   └── popup.js                      # Popup controller with theme, whitelist, bypass & update check
├── options/
│   ├── options.html                  # Options page with responsive macOS Light & Dark layout (v1.31)
│   ├── options.css                   # Options page styles matching macOS design tokens
│   └── options.js                    # Options page controller with theme, import/export & simulation (v1.31)
├── scripts/
│   ├── sync-repo.js                  # Direct iteration and GitHub synchronization utility (v1.31)
│   └── sync-server.js                # Local HTTP synchronization bridge server
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
│   ├── storage.test.js               # Storage persistence, CRUD, theme & bypass list tests
│   ├── manifest-and-integration.test.js # Manifest V3, 6-scenario verification & E2E simulation (v1.31)
│   ├── ui-layout-and-responsiveness.test.js # Real headless Chrome CDP layout & viewport tests (v1.31)
│   ├── theme-and-sync.test.js        # Light/Dark mode toggle, persistence & sync workflow tests
│   ├── direct-iteration.test.js      # Direct repository iteration, conflict detection & version tests
│   ├── popup-whitelist-focus.test.js # Whitelist management & focus mode suite
│   └── update-and-theme-system.test.js # Update checking, sync & real-time system theme suite
├── MaiTab.png                        # Master brand icon asset (512x512)
├── package.json                      # Project metadata (v1.31.0) and test/sync scripts
├── POPUP_UI_SPEC.md                  # Primary UI design specification reference (v1.31)
├── README.md                         # English technical documentation (v1.31)
├── README_zh-CN.md                   # Simplified Chinese technical documentation (v1.31)
└── README_ja.md                      # Japanese technical documentation (v1.31)
```

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
