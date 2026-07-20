# FlowOS — Figma Screen Generator Plugin

Generates the 4 core FlowOS screens plus the system architecture diagram directly onto a Figma canvas, in a 2×2 grid with the diagram below.

---

## Screens Generated

| Row | Col 0 | Col 1 |
|-----|-------|-------|
| 0 | 01 · Setup — Builder Canvas | 02 · Setup — Page Builder |
| 1 | 03 · Application — Launcher | 04 · Application — Composed App Page |

Plus **05 · System Architecture** below the screens — Client → API modules → Java Runtime + Data, the same shape as the [architecture reference](https://claude.ai/code/artifact/a27858c6-c5cb-4a91-9da1-d5ca149ddc67).

Each screen frame is 1440 × 900 px (desktop), with a 120px gap between frames.

---

## How to Load and Run

1. Open **Figma Desktop** (the plugin API does not work in the browser for local plugins).
2. In any file, go to the menu: **Plugins → Development → Import plugin from manifest...**
3. Navigate to this folder and select **`manifest.json`**.
4. Run it: **Plugins → Development → FlowOS Screen Generator**.

The plugin generates all 4 screens + the architecture diagram in a few seconds, then auto-zooms the viewport to show them all.

---

## What You Get

- **Screen 1 (Builder Canvas)** — toolbar (Run/Save/Publish), prompt bar, a sample 6-node flow (`SOURCE → SELECT → CONDITION → RULE`/`CALL_JAVA → DISPLAY`) showing all four node layers with real connectors, right-hand config panel showing a RULE node's JSON.
- **Screen 2 (Page Builder)** — left component library (the three bundles from your sketch), grid canvas with those components placed and shown with dashed selection outlines + corner resize handles, exactly like an active drag-and-drop editing state.
- **Screen 3 (Launcher)** — top bar + search, a 3×2 grid of app tiles (Loan Processing, Customer Onboarding, Expense Approval, etc.).
- **Screen 4 (Composed App Page)** — recreates your hand sketch: "Start Process" button top-right (Bundle 2), a single seamless card containing Name/Email (Bundle 1) and Address+Edit (Bundle 3) with no visible divider between them.
- **Architecture diagram** — Client tier (Setup/Application) → API tier (all 6 NestJS modules) → Java Runtime + Data tiers, connected with real lines, native Figma frames (not an image).

---

## Design Tokens Used

| Token | Value | Use |
|---|---|---|
| Background | `#0a0a0f` | Screen/page background |
| Surface | `#13131a` | Cards, panels, toolbars |
| Elevated | `#1c1c26` | Canvas background, input fields |
| Border | `#2a2a3a` | Default borders/dividers |
| A1 (Data) | `#22d3ee` cyan | Data-layer nodes and accents |
| B1 (Logic) | `#a78bfa` violet | Logic-layer nodes and accents |
| D1 (Rules) | `#34d399` green | Rules-layer nodes, Publish/success actions |
| U1 (UI) | `#f59e0b` amber | UI-layer nodes, primary business-facing actions |

Matches the palette used across the planning docs and the architecture reference artifact — nothing invented fresh for this plugin.

---

## Notes

- All text uses **Inter** (built into Figma by default — no install needed).
- The plugin is headless (no UI panel) — it runs immediately on launch and closes when done.
- Re-run at any time; it creates new frames (does not overwrite existing ones).
- The sample flow, app tiles, and form field values are illustrative placeholders — swap them for real flows once they exist.
