# Chrome Extension Popup UI Design Specification

A comprehensive, pixel-accurate design and implementation reference for Chrome extension popup interfaces built with the **macOS Dark Aqua / Apple System Settings (Sonoma/Ventura)** design system.

---

## 1. Overall Design & Philosophy

### Design Archetype
The interface implements an authentic native macOS desktop aesthetic adapted for Chrome extension popups:

- **Inset Grouped Architecture:** Options are grouped into distinct, rounded translucent cards against a dark neutral window background, matching macOS System Settings.
- **Translucent Layering:** Surfaces utilize layered semi-transparent white fills (`rgba(255, 255, 255, alpha)`) rather than flat opaque colors, creating depth over the dark backdrop.
- **Hairline Dividers:** Rows and card borders rely on ultra-subtle 1px hairline strokes (`rgba(255, 255, 255, 0.06)` to `0.08`).
- **Apple Micro-Interactions:** Custom controls replicate native Apple behavior, including the signature `cubic-bezier(0.4, 0, 0.2, 1)` bounce for toggle switches, active push-button compression (`scale(0.985)`), and neon-blue focus rings.
- **High-Contrast Dark Mode:** Primary text uses crisp near-white (`#f5f5f7`), secondary descriptions use soft subdued opacity (`0.55`), and switches use Apple system green (`#34c759`).

---

## 2. Design Tokens & Color Palette

All design variables are declared in the `:root` scope to provide a single source of truth:

```css
:root {
  /* macOS Dark Aqua System Palette */
  --mac-window-bg:       #1c1c1e;
  --mac-card-bg:         rgba(255, 255, 255, 0.05);
  --mac-card-border:     rgba(255, 255, 255, 0.08);
  --mac-row-border:      rgba(255, 255, 255, 0.06);
  --mac-text-primary:    #f5f5f7;
  --mac-text-secondary:  rgba(235, 235, 245, 0.55);
  --mac-text-muted:      rgba(235, 235, 245, 0.38);
  --mac-accent:          #0A84FF;
  --mac-accent-hover:    #0077ED;
  --mac-success:         #34c759;
  --mac-switch-off:      rgba(120, 120, 128, 0.36);
  --mac-input-bg:        rgba(0, 0, 0, 0.28);
  --mac-input-border:    rgba(255, 255, 255, 0.14);
  --mac-btn-bg:          rgba(255, 255, 255, 0.08);
  --mac-btn-border:      rgba(255, 255, 255, 0.12);
  --mac-btn-hover:       rgba(255, 255, 255, 0.13);
  --mac-btn-active:      rgba(255, 255, 255, 0.05);
  --mac-focus-ring:      0 0 0 3px rgba(10, 132, 255, 0.35);
  --mac-shadow:          0 1px 3px rgba(0, 0, 0, 0.24);
}
```

### Color Palette Reference Table

| Token | CSS Value | Usage / Semantic Role |
| :--- | :--- | :--- |
| `--mac-window-bg` | `#1c1c1e` | Main popup viewport background. |
| `--mac-card-bg` | `rgba(255, 255, 255, 0.05)` | Surface fill for inset setting cards. |
| `--mac-card-border` | `rgba(255, 255, 255, 0.08)` | 1px border enclosing cards. |
| `--mac-row-border` | `rgba(255, 255, 255, 0.06)` | 1px horizontal dividing stroke between list rows. |
| `--mac-text-primary`| `#f5f5f7` | High-emphasis text, headers, and setting row labels. |
| `--mac-text-secondary`| `rgba(235, 235, 245, 0.55)`| Category titles, footnotes, units, badge text. |
| `--mac-text-muted` | `rgba(235, 235, 245, 0.38)`| Status indicators, timestamps, subtle captions. |
| `--mac-accent` | `#0A84FF` | Apple blue for focused inputs, active dropdown borders. |
| `--mac-accent-hover`| `#0077ED` | Hover state for accent highlights. |
| `--mac-success` | `#34c759` | Apple green for active/checked toggle switches. |
| `--mac-switch-off` | `rgba(120, 120, 128, 0.36)`| Neutral gray track for switches in the OFF state. |
| `--mac-input-bg` | `rgba(0, 0, 0, 0.28)` | Sunken background for text boxes and number fields. |
| `--mac-input-border`| `rgba(255, 255, 255, 0.14)`| Hairline border on inputs. |
| `--mac-btn-bg` | `rgba(255, 255, 255, 0.08)` | Default push button and dropdown fill. |
| `--mac-btn-border` | `rgba(255, 255, 255, 0.12)` | Push button and dropdown border stroke. |
| `--mac-btn-hover` | `rgba(255, 255, 255, 0.13)` | Push button and dropdown hover fill. |
| `--mac-btn-active` | `rgba(255, 255, 255, 0.05)` | Push button pressed / active fill. |
| `--mac-focus-ring` | `0 0 0 3px rgba(10,132,255,0.35)` | Keyboard focus ring (`:focus-visible`). |
| `--mac-shadow` | `0 1px 3px rgba(0, 0, 0, 0.24)`| Subtle card elevation shadow. |

---

## 3. Typography & Text Hierarchy

### Font Families
```css
/* Primary UI Font Stack (macOS native + universal CJK & system fallbacks) */
font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display",
             "PingFang SC", "Hiragino Sans", "Hiragino Kaku Gothic ProN",
             "Microsoft YaHei", system-ui, sans-serif;

/* Monospace Font Stack (for API keys, hashes, code) */
font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
```

### Font Smoothing
Applied globally across all elements:
```css
* {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

### Typographic Hierarchy Matrix

| Role | Selector | Size | Weight | Line Height | Letter Spacing | Color Token | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Window / Page Title** | `h1` | `15px` | `600` | Normal | `-0.2px` | `--mac-text-primary` | Main header & subpage title |
| **Category Header** | `.section-title` | `11px` | `600` | Normal | `+0.6px` | `--mac-text-secondary` | Uppercase section heading |
| **Setting Item Label**| `.setting-label` | `13px` | `400` | `1.4` | `-0.1px` | `--mac-text-primary` | Standard row title |
| **Push Button** | `.btn` | `13px` | `500` | Normal | `0px` | `--mac-text-primary` | Action buttons |
| **Nav Back Button** | `.mac-back-btn` | `12px` | `500` | Normal | `0px` | `--mac-text-primary` | Header back navigation |
| **Select Menu** | `select.lang-select`| `12.5px` | `400` | Normal | `0px` | `--mac-text-primary` | Dropdown control |
| **Version Badge** | `.badge` | `11px` | `500` | Normal | `+0.2px` | `--mac-text-secondary` | Pill badge next to title |
| **Input (Number)** | `input[type="number"]`| `13px` | `400` | Normal | `0px` | `--mac-text-primary` | Tabular numbers |
| **Input (Monospace)** | `.mac-input` | `13px` | `400` | Normal | `0px` | `--mac-text-primary` | Key / secret inputs |
| **Input Unit Label** | `.unit-box small` | `12px` | `400` | Normal | `0px` | `--mac-text-secondary` | e.g., "ms" indicator |
| **Section Footer / Help**| `.section-footer`| `11.5px`| `400` | `1.45` | `0px` | `--mac-text-secondary` | Informational footnotes |
| **Status Message** | `.status-message`| `11.5px`| `400` | `1.4` | `0px` | `--mac-text-muted` | Operational feedback |

---

## 4. Layout Architecture & Sizing Rules

### Viewport Dimensions
```css
html, body {
  margin: 0;
  padding: 0;
  width: 368px;
  background-color: var(--mac-window-bg);
  color: var(--mac-text-primary);
  font-size: 13px;
  line-height: 1.4;
  overflow-x: hidden;
}

body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: 580px;
  overflow-y: auto;
}
```

- **Fixed Width:** `368px` ensures optimal readability, fits cleanly within browser limits, and prevents horizontal wrapping issues across localized labels.
- **Max Height:** `580px` avoids vertical viewport clipping on smaller desktop resolutions (such as 768p displays with UI scaling).
- **Body Padding:** `16px` on all sides creates a standard macOS window margin.
- **Stack Gap:** `14px` flex gap between all top-level sections (`header`, `settings-group`).

### View Routing Architecture (SPA Pattern)
The popup uses a single HTML file with view switching implemented via hidden classes:

```
Popup Root
├── #page_main (Main Settings View)
├── #page_reports (Subpage View 1) [class="hidden"]
└── #page_timeouts (Subpage View 2) [class="hidden"]
```

View toggling is controlled by a utility class:
```css
.hidden {
  display: none !important;
}
```

Each page container inherits the exact same vertical flex layout:
```css
#page_main,
#page_reports,
#page_timeouts {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
```

---

## 5. UI Component Specifications

### 5.1. Branding Header (Main View)

```html
<header class="header">
  <div class="brand">
    <img src="icon/32.png" alt="App" class="brand-icon" width="22" height="22">
    <h1>AppName</h1>
    <span class="badge">v1.31</span>
  </div>
</header>
```

```css
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2px 2px;
  margin-bottom: 6px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 9px;
}

.brand-icon {
  width: 22px;
  height: 22px;
  border-radius: 5px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
  flex-shrink: 0;
}

.badge {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 7px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--mac-text-secondary);
  border: 1px solid rgba(255, 255, 255, 0.08);
  letter-spacing: 0.2px;
}
```

---

### 5.2. Submenu Navigation Header (Subpages)

Replaces the branding header when drilling down into subpages. It uses a **balanced 3-column flex layout** with a spacer to ensure the title is centered.

```html
<header class="header-nav">
  <button id="back_btn" class="mac-back-btn">← Back</button>
  <h1>Subpage Title</h1>
  <div class="header-nav-spacer"></div>
</header>
```

```css
.header-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2px 2px;
}

.mac-back-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--mac-btn-bg);
  color: var(--mac-text-primary);
  border: 1px solid var(--mac-btn-border);
  border-radius: 6px;
  padding: 5px 11px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}

.mac-back-btn:hover {
  background: var(--mac-btn-hover);
  border-color: rgba(255, 255, 255, 0.2);
}

.mac-back-btn:active {
  background: var(--mac-btn-active);
  transform: scale(0.98);
}

.mac-back-btn:focus-visible {
  box-shadow: var(--mac-focus-ring);
  outline: none;
}

.header-nav h1 {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  text-align: center;
}

.header-nav-spacer {
  width: 65px; /* Matches the approximate width of the back button for centering */
}
```

---

### 5.3. Inset Grouped Settings Cards

Sections contain an uppercase title, a rounded card containing rows, and an optional footnote.

```html
<section class="settings-group">
  <div class="section-title">Section Title</div>
  <div class="card">
    <div class="setting-row">...</div>
    <div class="setting-row">...</div>
  </div>
  <p class="section-footer">Optional footnote or explanation.</p>
</section>
```

```css
.settings-group {
  display: flex;
  flex-direction: column;
}

.section-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--mac-text-secondary);
  margin: 0 0 7px 10px; /* 10px left indentation aligns with card inner padding */
}

.card {
  background: var(--mac-card-bg);
  border: 1px solid var(--mac-card-border);
  border-radius: 10px;
  box-shadow: var(--mac-shadow);
  overflow: hidden;
}

.section-footer {
  font-size: 11.5px;
  line-height: 1.45;
  color: var(--mac-text-secondary);
  margin: 7px 10px 0;
}
```

---

### 5.4. Setting Rows

Rows are stacked inside `.card` containers and separated by hairline bottom borders.

```html
<div class="setting-row">
  <span class="setting-label">Setting Name</span>
  <!-- Control element (switch, select, etc.) -->
</div>
```

```css
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  min-height: 40px;
  border-bottom: 1px solid var(--mac-row-border);
  transition: background-color 0.12s ease;
}

.setting-row:last-child {
  border-bottom: none;
}

.setting-row:hover {
  background-color: rgba(255, 255, 255, 0.02);
}

.setting-label {
  font-size: 13px;
  font-weight: 400;
  color: var(--mac-text-primary);
  letter-spacing: -0.1px;
  flex: 1;
  padding-right: 12px;
  user-select: none;
}
```

#### Adaptive Row Pattern (Conditional Visibility)
When a feature is conditionally available (e.g., requires a license or key), use the `:has()` selector so the entire row container automatically collapses if the child is hidden:
```css
.ws-row:has(#ws_mode_label.hidden) {
  display: none !important;
}
```

---

### 5.5. macOS Toggle Switch

The toggle switch replicates Apple's exact dimensions, knob travel, and easing curves.

```html
<label class="switch">
  <input type="checkbox" id="my_switch">
  <span class="slider"></span>
</label>
```

```css
.switch {
  position: relative;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
  flex-shrink: 0;
}

.switch input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  margin: 0;
}

.slider {
  width: 38px;
  height: 22px;
  background-color: var(--mac-switch-off);
  border-radius: 22px;
  position: relative;
  transition: background-color 0.22s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s ease;
}

.slider::before {
  content: "";
  position: absolute;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  left: 2px;
  top: 2px;
  background-color: #ffffff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.25), 0 0 1px rgba(0, 0, 0, 0.2);
  transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Checked State */
input:checked + .slider {
  background-color: var(--mac-success); /* #34c759 */
}

input:checked + .slider::before {
  /* 38px width - 18px knob - 2px left - 2px right = 16px translation */
  transform: translateX(16px);
}

/* Focus and Disabled States */
input:focus-visible + .slider {
  box-shadow: var(--mac-focus-ring);
}

input:disabled + .slider {
  opacity: 0.35;
  cursor: not-allowed;
}
```

---

### 5.6. Pop-up Selector / Dropdown Menu

Replaces default browser dropdowns with a dark-styled select box with an embedded SVG chevron.

```html
<select id="lang_select" class="lang-select" aria-label="Language">
  <option value="en">English</option>
  <option value="ja">日本語 (Japanese)</option>
  <option value="zh">简体中文 (Simplified Chinese)</option>
</select>
```

```css
select.lang-select {
  appearance: none;
  -webkit-appearance: none;
  background-color: var(--mac-btn-bg);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath fill='none' stroke='rgba(255,255,255,0.6)' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' d='m2.5 3.5 2.5 2.5 2.5-2.5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  border: 1px solid var(--mac-btn-border);
  border-radius: 6px;
  color: var(--mac-text-primary);
  padding: 5px 26px 5px 10px;
  font-size: 12.5px;
  font-weight: 400;
  cursor: pointer;
  outline: none;
  transition: all 0.15s ease;
  width: 154px;
}

select.lang-select:hover {
  background-color: var(--mac-btn-hover);
  border-color: rgba(255, 255, 255, 0.18);
}

select.lang-select:focus {
  border-color: var(--mac-accent);
  box-shadow: var(--mac-focus-ring);
}

select.lang-select option {
  background-color: #252528;
  color: #f5f5f7;
}
```

---

### 5.7. Push Buttons

```html
<!-- In card action bar -->
<div class="card-action-bar">
  <button id="btn_1" class="btn btn-secondary">Action 1</button>
  <button id="btn_2" class="btn btn-secondary">Action 2</button>
</div>

<!-- Full width in action row -->
<button class="btn btn-secondary btn-full">Submit</button>
```

```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 7px 14px;
  font-size: 13px;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
  outline: none;
  white-space: nowrap;
}

.btn-secondary {
  background: var(--mac-btn-bg);
  color: var(--mac-text-primary);
  border: 1px solid var(--mac-btn-border);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}

.btn-secondary:hover {
  background: var(--mac-btn-hover);
  border-color: rgba(255, 255, 255, 0.2);
}

.btn-secondary:active {
  background: var(--mac-btn-active);
  transform: scale(0.985); /* Tactile press micro-interaction */
}

.btn-secondary:focus-visible {
  box-shadow: var(--mac-focus-ring);
}

.btn-full {
  width: 100%;
}

.card-action-bar {
  padding: 11px 14px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.setting-row + .card-action-bar {
  border-top: 1px solid var(--mac-row-border);
}
```

---

### 5.8. Numeric Input with Unit Badge

Used for milliseconds, intervals, timeouts, and numeric settings.

```html
<div class="setting-row">
  <span class="setting-label">Click Delay</span>
  <div class="unit-box">
    <input type="number" id="click_delay" min="0" max="5000" step="10" placeholder="300">
    <small>ms</small>
  </div>
</div>
```

```css
.unit-box {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.unit-box input[type="number"] {
  width: 78px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  background: var(--mac-input-bg);
  border: 1px solid var(--mac-input-border);
  border-radius: 6px;
  color: var(--mac-text-primary);
  padding: 5px 8px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.unit-box input[type="number"]:focus {
  border-color: var(--mac-accent);
  box-shadow: var(--mac-focus-ring);
}

.unit-box small {
  color: var(--mac-text-secondary);
  font-size: 12px;
  min-width: 20px;
}
```

---

### 5.9. Monospace Input Block

Used for API keys, license codes, or URLs where the label sits above a full-width input.

```html
<div class="setting-row-block">
  <label class="setting-label">API Key</label>
  <input type="text" class="mac-input" maxlength="32" placeholder="secretkey0123456" spellcheck="false" autocomplete="off">
</div>
```

```css
.setting-row-block {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-bottom: 1px solid var(--mac-row-border);
}

.mac-input {
  width: 100%;
  background: var(--mac-input-bg);
  border: 1px solid var(--mac-input-border);
  border-radius: 6px;
  color: var(--mac-text-primary);
  padding: 7px 10px;
  font-size: 13px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.mac-input:focus {
  border-color: var(--mac-accent);
  box-shadow: var(--mac-focus-ring);
}
```

---

### 5.10. Action & Status Display Block

Used at the bottom of forms for submitting actions and displaying real-time feedback or timestamps.

```html
<div class="setting-row-action">
  <button id="send_action" class="btn btn-secondary btn-full">Run Action</button>
  <div id="status_message" class="status-message">Last sync: 2026-10-31 05:46</div>
</div>
```

```css
.setting-row-action {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.status-message {
  min-height: 16px;
  font-size: 11.5px;
  line-height: 1.4;
  color: var(--mac-text-muted);
  word-break: break-all;
  text-align: center;
}
```

---

### 5.11. Custom macOS Overlay Scrollbar

Ensures scrollbars stay unobtrusive on dark backgrounds across Windows, macOS, and Linux:

```css
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 10px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.35);
}
```

---

## 6. Visual Details: Radii, Shadows, Transitions & State Matrix

### Border Radius Hierarchy
| Element | Radius | Purpose |
| :--- | :--- | :--- |
| **Card (`.card`)** | `10px` | Matches macOS inset grouped list corners. |
| **Pill Badge (`.badge`)** | `10px` | Pill-shaped container for versions/tags. |
| **Scrollbar Thumb** | `10px` | Rounded pill overlay thumb. |
| **Switch Slider (`.slider`)** | `22px` | Pill-shaped toggle track. |
| **Switch Knob (`.slider::before`)** | `50%` | Circular toggle button. |
| **Buttons (`.btn`, `.mac-back-btn`)** | `6px` | Standard macOS control radius. |
| **Inputs (`.mac-input`, `select`)** | `6px` | Standard macOS text field radius. |
| **App Icon (`.brand-icon`)** | `5px` | Squircle icon shape. |

### Box Shadows
- **Card container:** `0 1px 3px rgba(0, 0, 0, 0.24)`
- **Secondary button:** `0 1px 2px rgba(0, 0, 0, 0.15)`
- **Toggle switch knob:** `0 2px 4px rgba(0, 0, 0, 0.25), 0 0 1px rgba(0, 0, 0, 0.2)`
- **Brand icon:** `0 1px 3px rgba(0, 0, 0, 0.35)`
- **Focus ring:** `0 0 0 3px rgba(10, 132, 255, 0.35)`

### Interactive States & Micro-Interactions Matrix

| Element | Idle State | Hover State (`:hover`) | Active / Pressed (`:active`) | Focus (`:focus-visible` / `:focus`) |
| :--- | :--- | :--- | :--- | :--- |
| **Row** | `transparent` | `rgba(255,255,255, 0.02)` | N/A | N/A |
| **Push Button** | `bg: 0.08`, `border: 0.12` | `bg: 0.13`, `border: 0.20` | `bg: 0.05`, `scale(0.985)` | `box-shadow: var(--mac-focus-ring)` |
| **Back Button** | `bg: 0.08`, `border: 0.12` | `bg: 0.13`, `border: 0.20` | `bg: 0.05`, `scale(0.98)` | `box-shadow: var(--mac-focus-ring)` |
| **Toggle Switch**| `bg: rgba(120,120,128,0.36)`| Subtle brightness | Checked: `#34c759` + `translateX(16px)` | `box-shadow: var(--mac-focus-ring)` |
| **Select Menu** | `bg: 0.08`, `border: 0.12` | `bg: 0.13`, `border: 0.18` | N/A | `border-color: #0A84FF` + focus ring |
| **Text/Num Input**| `bg: rgba(0,0,0,0.28)`, `border: 0.14` | N/A | N/A | `border-color: #0A84FF` + focus ring |

---

## 7. Responsiveness, Resolution Scaling & Multilingual Safety

The layout has been verified across display scaling factors and international languages:

1. **Resolution & DPI Scaling:**
   - **Tested Displays:** 100% (1080p), 125% (Windows scaling), 150% (Windows scaling), 200% (macOS Retina), 300% (HiDPI 4K).
   - **Zero Horizontal Overflow:** `document.body.scrollWidth === document.body.clientWidth` is strictly preserved.
   - **Vertical Constraint:** Content heights range from ~220px (subpages) to ~420px (main view), remaining safely beneath the 580px threshold to eliminate unexpected scrollbars.

2. **Internationalization & Label Width Handling:**
   - Setting labels use `flex: 1; padding-right: 12px;` to allow multi-line wrapping when rendered in languages with longer strings (English, Japanese, Simplified Chinese).
   - Right-side controls (`.switch`, `.unit-box`, `.lang-select`) declare `flex-shrink: 0;` so labels cannot compress or deform controls.

---

## 8. Complete Reusable Boilerplate Implementation

To build another Chrome extension with this exact UI, copy the template below.

### `popup.html`
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>My Extension</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>

  <!-- ==================== MAIN VIEW ==================== -->
  <div id="page_main">
    <header class="header">
      <div class="brand">
        <img src="icon/32.png" alt="Logo" class="brand-icon" width="22" height="22">
        <h1>My Extension</h1>
        <span class="badge">v1.0</span>
      </div>
    </header>

    <!-- General Settings -->
    <section class="settings-group">
      <div class="section-title">General Settings</div>
      <div class="card">
        <div class="setting-row">
          <span class="setting-label">Language</span>
          <select id="lang_select" class="lang-select">
            <option value="en">English</option>
            <option value="ja">日本語</option>
            <option value="zh">简体中文</option>
          </select>
        </div>

        <div class="setting-row">
          <span class="setting-label">Enable Extension</span>
          <label class="switch">
            <input type="checkbox" id="feature_enabled" checked>
            <span class="slider"></span>
          </label>
        </div>

        <div class="setting-row">
          <span class="setting-label">Automated Actions</span>
          <label class="switch">
            <input type="checkbox" id="auto_actions" checked>
            <span class="slider"></span>
          </label>
        </div>
      </div>
      <p class="section-footer">All computations run locally on your device.</p>
    </section>

    <!-- Navigation & Submenus -->
    <section class="settings-group">
      <div class="section-title">Advanced / Configuration</div>
      <div class="card">
        <div class="card-action-bar">
          <button id="open_config" class="btn btn-secondary">Delays</button>
          <button id="open_account" class="btn btn-secondary">Account</button>
        </div>
      </div>
    </section>
  </div>

  <!-- ==================== SUBPAGE 1: CONFIG ==================== -->
  <div id="page_config" class="hidden">
    <header class="header-nav">
      <button id="back_from_config" class="mac-back-btn">← Back</button>
      <h1>Delays</h1>
      <div class="header-nav-spacer"></div>
    </header>

    <section class="settings-group">
      <div class="card">
        <div class="setting-row">
          <span class="setting-label">Execution Delay</span>
          <div class="unit-box">
            <input type="number" id="exec_delay" min="0" max="5000" step="50" value="300">
            <small>ms</small>
          </div>
        </div>

        <div class="setting-row">
          <span class="setting-label">Verify Delay</span>
          <div class="unit-box">
            <input type="number" id="verify_delay" min="0" max="5000" step="50" value="850">
            <small>ms</small>
          </div>
        </div>
      </div>
      <p class="section-footer">A jitter of 0–200 ms is added to prevent detection.</p>
    </section>
  </div>

  <!-- ==================== SUBPAGE 2: ACCOUNT ==================== -->
  <div id="page_account" class="hidden">
    <header class="header-nav">
      <button id="back_from_account" class="mac-back-btn">← Back</button>
      <h1>Account</h1>
      <div class="header-nav-spacer"></div>
    </header>

    <section class="settings-group">
      <div class="card">
        <div class="setting-row-block">
          <label class="setting-label">API Key</label>
          <input type="text" id="api_key" class="mac-input" maxlength="32" placeholder="paste-api-key-here" spellcheck="false">
        </div>

        <div class="setting-row-action">
          <button id="btn_sync" class="btn btn-secondary btn-full">Sync Now</button>
          <div id="sync_status" class="status-message">Ready</div>
        </div>
      </div>
    </section>
  </div>

  <script type="module" src="popup.js"></script>
</body>
</html>
```

### `popup.js` (Minimal Controller Pattern)
```javascript
const $ = (id) => document.getElementById(id);

// SPA Navigation Router
function navigateTo(page) {
  $('page_main').classList.toggle('hidden', page !== 'main');
  $('page_config').classList.toggle('hidden', page !== 'config');
  $('page_account').classList.toggle('hidden', page !== 'account');
}

$('open_config')?.addEventListener('click', () => navigateTo('config'));
$('open_account')?.addEventListener('click', () => navigateTo('account'));
$('back_from_config')?.addEventListener('click', () => navigateTo('main'));
$('back_from_account')?.addEventListener('click', () => navigateTo('main'));

// State Persistence Example
$('feature_enabled')?.addEventListener('change', (e) => {
  chrome.storage?.local.set({ enabled: e.target.checked });
});
```

---

## 9. Key Implementation Takeaways for Developers & AI Agents

When replicating this interface in another extension, observe these critical rules:

1. **Always set `box-sizing: border-box;` globally.** This ensures row padding (`10px 14px`) and input borders never push the total width beyond the `368px` container.
2. **Never hardcode pixel widths on setting labels.** Always use `flex: 1; padding-right: 12px;` so titles automatically reflow across languages and font sizes.
3. **Keep controls `flex-shrink: 0`.** This ensures switches, selects, and number inputs never shrink or clip when a label wraps.
4. **Use `translateX(16px)` for the switch knob.** Given a 38px track and an 18px knob with 2px margins, 16px translation centers the knob with 2px right padding in the active state.
5. **Use the symmetrical 65px spacer pattern for subpages.** In `.header-nav`, placing an empty `<div class="header-nav-spacer"></div>` with the same width as the back button ensures the page `<h1>` is centered without absolute positioning.
6. **Use `:has()` for conditional feature rows.** Stacking `.ws-row:has(#label.hidden) { display: none !important; }` avoids awkward empty boxes or double dividers.
