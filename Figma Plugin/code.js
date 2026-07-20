// ─────────────────────────────────────────────────────────────────────────────
// FlowOS — Figma Screen Generator Plugin
// Generates the 4 core screens + the system architecture diagram directly
// onto the Figma canvas, from the same design tokens used across the app
// (planning docs, architecture reference, canvas UI).
//
// Screens generated (2 × 2 grid):
//   Row 0: Setup — Builder Canvas   |   Setup — Page Builder
//   Row 1: Application — Launcher   |   Application — Composed App Page
// Plus: System Architecture diagram, placed below the screens.
// ─────────────────────────────────────────────────────────────────────────────

const SW = 1440;  // desktop frame width
const SH = 900;   // desktop frame height
const GAP = 120;  // gap between frames on the Figma canvas

// ─── Design Tokens (same palette used throughout the FlowOS planning docs) ────
const C = {
  bg:        { r: 0.039, g: 0.039, b: 0.059 }, // #0a0a0f
  surface:   { r: 0.074, g: 0.074, b: 0.102 }, // #13131a
  elevated:  { r: 0.109, g: 0.109, b: 0.149 }, // #1c1c26
  border:    { r: 0.165, g: 0.165, b: 0.227 }, // #2a2a3a
  borderStr: { r: 0.227, g: 0.227, b: 0.290 }, // #3a3a4a
  text:      { r: 0.945, g: 0.961, b: 0.976 }, // #f1f5f9
  textSub:   { r: 0.580, g: 0.639, b: 0.722 }, // #94a3b8
  textMuted: { r: 0.392, g: 0.455, b: 0.545 }, // #64748b
  white:     { r: 1.000, g: 1.000, b: 1.000 },
  red:       { r: 0.973, g: 0.443, b: 0.443 }, // #f87171

  // Layer accents — A1 data / B1 logic / D1 rules / U1 UI (new)
  a1: { r: 0.133, g: 0.827, b: 0.933 }, a1Bg: { r: 0.031, g: 0.200, b: 0.267 }, a1Dim: { r: 0.055, g: 0.455, b: 0.565 },
  b1: { r: 0.655, g: 0.545, b: 0.980 }, b1Bg: { r: 0.180, g: 0.063, b: 0.396 }, b1Dim: { r: 0.486, g: 0.227, b: 0.929 },
  d1: { r: 0.204, g: 0.827, b: 0.600 }, d1Bg: { r: 0.024, g: 0.306, b: 0.231 }, d1Dim: { r: 0.020, g: 0.588, b: 0.412 },
  u1: { r: 0.961, g: 0.620, b: 0.043 }, u1Bg: { r: 0.110, g: 0.071, b: 0.000 }, u1Dim: { r: 0.706, g: 0.325, b: 0.035 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function solid(color) {
  return [{ type: 'SOLID', color: color }];
}

function screenPos(col, row) {
  return { x: col * (SW + GAP), y: row * (SH + GAP) };
}

function mkScreen(name, col, row) {
  const pos = screenPos(col, row);
  const f = figma.createFrame();
  f.name = name;
  f.resize(SW, SH);
  f.x = pos.x; f.y = pos.y;
  f.fills = solid(C.bg);
  f.clipsContent = true;
  return f;
}

function mkRect(w, h, color, radius) {
  const r = figma.createRectangle();
  r.resize(w, h);
  r.fills = color ? solid(color) : [];
  if (radius) r.cornerRadius = radius;
  return r;
}

function mkFrame(w, h, bg, border, radius) {
  const f = figma.createFrame();
  f.resize(w, h);
  f.fills = bg ? solid(bg) : [];
  if (border) { f.strokes = solid(border); f.strokeWeight = 1; }
  if (radius) f.cornerRadius = radius;
  return f;
}

function mkText(str, size, weight, color, maxW) {
  const t = figma.createText();
  const style = weight >= 700 ? 'Bold' : weight >= 600 ? 'Semi Bold' : weight >= 500 ? 'Medium' : 'Regular';
  t.fontName = { family: 'Inter', style: style };
  t.fontSize = size;
  t.fills = solid(color);
  t.characters = String(str);
  if (maxW != null) {
    t.textAutoResize = 'HEIGHT';
    t.resize(maxW, t.height);
  }
  return t;
}

// Small filled/outlined pill badge
function mkBadge(label, bg, textColor, borderColor) {
  const box = figma.createFrame();
  box.layoutMode = 'HORIZONTAL';
  box.primaryAxisSizingMode = 'AUTO';
  box.counterAxisSizingMode = 'AUTO';
  box.paddingTop = 3; box.paddingBottom = 3; box.paddingLeft = 8; box.paddingRight = 8;
  box.cornerRadius = 20;
  box.fills = solid(bg);
  if (borderColor) { box.strokes = solid(borderColor); box.strokeWeight = 1; }
  const t = mkText(label, 10, 700, textColor);
  box.appendChild(t);
  return box;
}

function mkDivider(w, x, y, parent, color) {
  const d = mkRect(w, 1, color || C.border);
  d.x = x; d.y = y;
  parent.appendChild(d);
}

// Straight connector line between two absolute points (any angle)
function mkConnector(x1, y1, x2, y2, color) {
  const dx = x2 - x1, dy = y2 - y1;
  const v = figma.createVector();
  v.vectorPaths = [{ windingRule: 'NONE', data: `M 0 0 L ${dx} ${dy}` }];
  v.x = x1; v.y = y1;
  v.strokes = solid(color || C.border);
  v.strokeWeight = 1.5;
  return v;
}

// Labeled section container — used in the architecture diagram
function mkTier(w, h, label, bg, border) {
  const t = mkFrame(w, h, bg, border, 10);
  const lbl = mkText(label, 10, 700, C.textMuted);
  lbl.letterSpacing = { value: 6, unit: 'PERCENT' };
  lbl.x = 14; lbl.y = 10;
  t.appendChild(lbl);
  return t;
}

// A canvas node card — the core visual unit of the Setup builder screens
function mkNodeCard(x, y, w, layerColor, layerBg, layerDim, layerLabel, nodeType, configSummary, parent) {
  const h = 58;
  const card = mkFrame(w, h, layerBg, layerDim, 8);
  card.x = x; card.y = y;
  parent.appendChild(card);

  const badge = mkText(layerLabel, 8, 700, layerColor);
  badge.x = 10; badge.y = 8;
  badge.letterSpacing = { value: 4, unit: 'PERCENT' };
  card.appendChild(badge);

  const typeLbl = mkText(nodeType, 13, 700, C.text);
  typeLbl.fontName = { family: 'Inter', style: 'Bold' };
  typeLbl.x = 10; typeLbl.y = 21; card.appendChild(typeLbl);

  const cfg = mkText(configSummary, 9, 400, C.textMuted, w - 20);
  cfg.x = 10; cfg.y = 39; card.appendChild(cfg);

  return card;
}

// Primary/secondary button
function mkButton(label, w, h, filled, accentColor, accentBg) {
  const btn = mkFrame(w, h, filled ? accentColor : accentBg, filled ? null : accentColor, 8);
  const t = mkText(label, 12, 600, filled ? C.bg : accentColor);
  t.x = (w - t.width) / 2; t.y = (h - t.height) / 2 - 1;
  btn.appendChild(t);
  return btn;
}

// A single-line labeled input field
function mkField(label, placeholder, x, y, w, parent) {
  const lbl = mkText(label, 11, 600, C.textSub);
  lbl.x = x; lbl.y = y; parent.appendChild(lbl);

  const box = mkFrame(w, 38, C.elevated, C.border, 8);
  box.x = x; box.y = y + 20; parent.appendChild(box);
  const ph = mkText(placeholder, 12, 400, C.textMuted);
  ph.x = 12; ph.y = 11; box.appendChild(ph);

  return y + 20 + 38;
}

// Dashed selection outline + corner resize handles (page-builder mode only)
function mkSelectionOutline(x, y, w, h, parent) {
  const outline = figma.createRectangle();
  outline.resize(w, h);
  outline.x = x; outline.y = y;
  outline.fills = [];
  outline.strokes = solid(C.b1);
  outline.strokeWeight = 1.5;
  outline.dashPattern = [6, 4];
  parent.appendChild(outline);

  [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].forEach(function (p) {
    const handle = mkRect(8, 8, C.b1, 2);
    handle.x = p[0] - 4; handle.y = p[1] - 4;
    parent.appendChild(handle);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 1 — Setup: Builder Canvas
// ─────────────────────────────────────────────────────────────────────────────
function buildSetupCanvasScreen(col, row) {
  const s = mkScreen('01 · Setup — Builder Canvas', col, row);

  // Top toolbar
  const toolbar = mkFrame(SW, 64, C.surface, C.border, 0);
  mkDivider(SW, 0, 63, toolbar); // self-appends to toolbar, don't wrap in appendChild
  s.appendChild(toolbar);
  const flowName = mkText('Loan Processing', 15, 700, C.text);
  flowName.x = 24; flowName.y = 12; toolbar.appendChild(flowName);
  const flowDesc = mkText('Auto-approve applications with credit score above 700', 11, 400, C.textMuted);
  flowDesc.x = 24; flowDesc.y = 34; toolbar.appendChild(flowDesc);

  var bx = SW - 24 - 84;
  const publishBtn = mkButton('Publish', 84, 32, true, C.d1, C.d1Bg);
  publishBtn.x = bx; publishBtn.y = 16; toolbar.appendChild(publishBtn);
  bx -= 84 + 8;
  const saveBtn = mkButton('Save', 76, 32, false, C.text, C.elevated);
  saveBtn.x = bx; saveBtn.y = 16; toolbar.appendChild(saveBtn);
  bx -= 76 + 8;
  const runBtn = mkButton('▶ Run', 76, 32, false, C.a1, C.a1Bg);
  runBtn.x = bx; runBtn.y = 16; toolbar.appendChild(runBtn);

  // Prompt bar
  const promptBar = mkFrame(SW, 56, C.bg, C.border, 0);
  promptBar.y = 64; s.appendChild(promptBar);
  const promptField = mkFrame(SW - 48 - 120, 36, C.surface, C.border, 8);
  promptField.x = 24; promptField.y = 10; promptBar.appendChild(promptField);
  const promptPh = mkText('Describe what to build...', 12, 400, C.textMuted);
  promptPh.x = 12; promptPh.y = 9; promptField.appendChild(promptPh);
  const genBtn = mkButton('Generate', 110, 36, true, C.b1, C.b1Bg);
  genBtn.x = SW - 24 - 110; genBtn.y = 10; promptBar.appendChild(genBtn);

  // Canvas area
  const canvas = mkFrame(SW - 320, SH - 120, C.elevated, null, 0);
  canvas.x = 0; canvas.y = 120; s.appendChild(canvas);

  // Sample flow: SOURCE -> SELECT -> CONDITION -> RULE -> CALL_JAVA -> DISPLAY
  const nodes = [
    { x: 60, y: 80, layer: 'a1', label: 'A1 · DATA', type: 'SOURCE', cfg: 'connector: supabase_main' },
    { x: 300, y: 80, layer: 'a1', label: 'A1 · DATA', type: 'SELECT', cfg: 'loan_applications WHERE date=today' },
    { x: 540, y: 80, layer: 'b1', label: 'B1 · LOGIC', type: 'CONDITION', cfg: 'credit_score > 700' },
    { x: 780, y: 40, layer: 'd1', label: 'D1 · RULES', type: 'RULE', cfg: 'AND employment > 2yrs → APPROVE' },
    { x: 780, y: 160, layer: 'b1', label: 'B1 · LOGIC', type: 'CALL_JAVA', cfg: 'CreditBureau.getScore(appId)' },
    { x: 1020, y: 100, layer: 'u1', label: 'U1 · UI', type: 'DISPLAY', cfg: 'Show decision summary to reviewer' },
  ];
  const cardW = 210;
  nodes.forEach(function (n) {
    mkNodeCard(n.x, n.y, cardW, C[n.layer], C[n.layer + 'Bg'], C[n.layer + 'Dim'], n.label, n.type, n.cfg, canvas);
  });
  // Connectors (approximate node-card centers) — each must be appended to
  // `canvas`, the same coordinate space its x/y were computed against.
  canvas.appendChild(mkConnector(60 + cardW, 80 + 29, 300, 80 + 29, C.borderStr));
  canvas.appendChild(mkConnector(300 + cardW, 80 + 29, 540, 80 + 29, C.borderStr));
  canvas.appendChild(mkConnector(540 + cardW, 80 + 29, 780, 40 + 29, C.borderStr));
  canvas.appendChild(mkConnector(540 + cardW, 80 + 29, 780, 160 + 29, C.borderStr));
  canvas.appendChild(mkConnector(780 + cardW, 40 + 29, 1020, 100 + 29, C.borderStr));
  canvas.appendChild(mkConnector(780 + cardW, 160 + 29, 1020, 100 + 29, C.borderStr));

  // Right config panel
  const panel = mkFrame(320, SH - 120, C.surface, C.border, 0);
  panel.x = SW - 320; panel.y = 120; s.appendChild(panel);
  const panelEyebrow = mkText('D1 · RULE', 10, 700, C.d1);
  panelEyebrow.x = 20; panelEyebrow.y = 20; panel.appendChild(panelEyebrow);
  const panelTitle = mkText('Auto-approve threshold', 14, 700, C.text);
  panelTitle.x = 20; panelTitle.y = 36; panel.appendChild(panelTitle);

  const cfgLbl = mkText('CONFIG', 9, 700, C.textMuted);
  cfgLbl.x = 20; cfgLbl.y = 76; panel.appendChild(cfgLbl);
  const cfgBox = mkFrame(280, 108, C.bg, C.border, 6);
  cfgBox.x = 20; cfgBox.y = 92; panel.appendChild(cfgBox);
  const cfgJson = mkText('{\n  "conditions": [\n    { "field": "credit_score",\n      "op": ">", "value": 700 }\n  ],\n  "logic": "AND"\n}', 10, 400, C.d1, 260);
  cfgJson.fontName = { family: 'Inter', style: 'Regular' };
  cfgJson.x = 12; cfgJson.y = 10; cfgBox.appendChild(cfgJson);

  const ioLbl = mkText('INPUTS / OUTPUTS', 9, 700, C.textMuted);
  ioLbl.x = 20; ioLbl.y = 216; panel.appendChild(ioLbl);
  const ioIn = mkText('in:  application, score', 11, 400, C.textSub);
  ioIn.x = 20; ioIn.y = 232; panel.appendChild(ioIn);
  const ioOut = mkText('out:  decision', 11, 400, C.textSub);
  ioOut.x = 20; ioOut.y = 248; panel.appendChild(ioOut);

  figma.currentPage.appendChild(s);
  return s;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 2 — Setup: Page Builder Mode
// ─────────────────────────────────────────────────────────────────────────────
function buildPageBuilderScreen(col, row) {
  const s = mkScreen('02 · Setup — Page Builder', col, row);

  const toolbar = mkFrame(SW, 64, C.surface, C.border, 0);
  s.appendChild(toolbar);
  const title = mkText('App — Page Builder', 15, 700, C.text);
  title.x = 24; title.y = 12; toolbar.appendChild(title);
  const sub = mkText('Drag components from the library onto the grid', 11, 400, C.textMuted);
  sub.x = 24; sub.y = 34; toolbar.appendChild(sub);
  const publishBtn2 = mkButton('Publish', 84, 32, true, C.d1, C.d1Bg);
  publishBtn2.x = SW - 24 - 84; publishBtn2.y = 16; toolbar.appendChild(publishBtn2);

  // Left component library
  const lib = mkFrame(280, SH - 64, C.surface, C.border, 0);
  lib.x = 0; lib.y = 64; s.appendChild(lib);
  const libLbl = mkText('COMPONENT LIBRARY', 10, 700, C.textMuted);
  libLbl.x = 20; libLbl.y = 20; libLbl.letterSpacing = { value: 6, unit: 'PERCENT' };
  lib.appendChild(libLbl);

  const bundles = [
    { name: 'Name + Email Form', desc: 'Flow Bundle 1', color: C.a1, bg: C.a1Bg },
    { name: 'Start Process Button', desc: 'Flow Bundle 2', color: C.u1, bg: C.u1Bg },
    { name: 'Address + Edit', desc: 'Flow Bundle 3', color: C.a1, bg: C.a1Bg },
  ];
  bundles.forEach(function (b, i) {
    const card = mkFrame(240, 64, C.elevated, C.border, 8);
    card.x = 20; card.y = 48 + i * 76; lib.appendChild(card);
    const dot = mkRect(8, 8, b.color, 4);
    dot.x = 14; dot.y = 14; card.appendChild(dot);
    const bn = mkText(b.name, 12, 600, C.text);
    bn.x = 30; bn.y = 11; card.appendChild(bn);
    const bd = mkText(b.desc, 10, 400, C.textMuted);
    bd.x = 14; bd.y = 34; card.appendChild(bd);
  });

  // Grid canvas
  const grid = mkFrame(SW - 280, SH - 64, C.elevated, null, 0);
  grid.x = 280; grid.y = 64; s.appendChild(grid);

  // Placed components matching the sketch, with selection outlines + tags
  const btnW = 180, btnH = 44;
  const btnX = SW - 280 - 60 - btnW, btnY = 40;
  const startBtn = mkButton('Start Process', btnW, btnH, true, C.u1, C.u1Bg);
  startBtn.x = btnX; startBtn.y = btnY; grid.appendChild(startBtn);
  mkSelectionOutline(btnX, btnY, btnW, btnH, grid);
  const btnTag = mkText('← Flow Bundle 2', 10, 600, C.u1);
  btnTag.x = btnX + btnW + 16; btnTag.y = btnY + 14; grid.appendChild(btnTag);

  const cardX = 60, cardY = 140, cardW = 640, cardH = 420;
  const formCard = mkFrame(cardW, cardH, C.surface, C.border, 12);
  formCard.x = cardX; formCard.y = cardY; grid.appendChild(formCard);

  var fy = mkField('Name', 'Enter name...', 32, 32, 260, formCard);
  fy = mkField('Email', 'Enter email...', 32, fy + 24, 260, formCard);
  mkSelectionOutline(cardX + 20, cardY + 20, 300, 220, grid);
  const b1Tag = mkText('Flow Bundle 1', 10, 600, C.a1);
  b1Tag.x = cardX + 20; b1Tag.y = cardY - 18; grid.appendChild(b1Tag);

  const editPill = mkButton('Edit', 56, 26, false, C.a1, C.a1Bg);
  editPill.cornerRadius = 20;
  // Relative to formCard's own origin (formCard.appendChild below) — not cardX/cardY,
  // those offsets are already baked into formCard.x/formCard.y itself.
  editPill.x = 340; editPill.y = 24; formCard.appendChild(editPill);
  mkField('Address', 'Enter address...', 340, 62, 260, formCard);
  mkSelectionOutline(cardX + 330, cardY + 20, 300, 220, grid);
  const b3Tag = mkText('Flow Bundle 3', 10, 600, C.a1);
  b3Tag.x = cardX + 330; b3Tag.y = cardY - 18; grid.appendChild(b3Tag);

  figma.currentPage.appendChild(s);
  return s;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 3 — Application: Launcher
// ─────────────────────────────────────────────────────────────────────────────
function buildLauncherScreen(col, row) {
  const s = mkScreen('03 · Application — Launcher', col, row);

  const topBar = mkFrame(SW, 72, C.surface, C.border, 0);
  s.appendChild(topBar);
  const wordmark = mkText('FlowOS', 18, 800, C.text);
  wordmark.x = 32; wordmark.y = 24; topBar.appendChild(wordmark);
  const search = mkFrame(360, 36, C.elevated, C.border, 8);
  search.x = SW / 2 - 180; search.y = 18; topBar.appendChild(search);
  const searchPh = mkText('🔍  Search apps...', 12, 400, C.textMuted);
  searchPh.x = 12; searchPh.y = 9; search.appendChild(searchPh);
  const avatar = mkRect(36, 36, C.b1, 18);
  avatar.x = SW - 32 - 36; avatar.y = 18; topBar.appendChild(avatar);

  const heading = mkText('Your apps', 20, 700, C.text);
  heading.x = 32; heading.y = 100; s.appendChild(heading);

  var apps = [
    { icon: '🏦', name: 'Loan Processing', desc: 'Auto-approve applications over 700 credit score' },
    { icon: '👤', name: 'Customer Onboarding', desc: 'Guided KYC and account setup' },
    { icon: '💰', name: 'Expense Approval', desc: 'Route expense claims through manager sign-off' },
    { icon: '📋', name: 'Employee Update', desc: 'Update HR records with manager review' },
    { icon: '📦', name: 'Order Fulfillment', desc: 'Pick, pack, and ship from a single queue' },
    { icon: '🧾', name: 'Invoice Reconciliation', desc: 'Match invoices against purchase orders' },
  ];
  var tileW = 420, tileH = 140, gapX = 24, gapY = 24;
  apps.forEach(function (app, i) {
    var col2 = i % 3, row2 = Math.floor(i / 3);
    const tile = mkFrame(tileW, tileH, C.surface, C.border, 12);
    tile.x = 32 + col2 * (tileW + gapX);
    tile.y = 150 + row2 * (tileH + gapY);
    s.appendChild(tile);

    const iconBox = mkRect(48, 48, C.elevated, 10);
    iconBox.x = 20; iconBox.y = 20; tile.appendChild(iconBox);
    const icon = mkText(app.icon, 22, 400, C.text);
    icon.x = 20 + (48 - icon.width) / 2; icon.y = 20 + (48 - icon.height) / 2; tile.appendChild(icon);

    const name = mkText(app.name, 14, 700, C.text);
    name.x = 84; name.y = 24; tile.appendChild(name);
    const desc = mkText(app.desc, 11, 400, C.textMuted, tileW - 104);
    desc.x = 84; desc.y = 46; tile.appendChild(desc);
  });

  figma.currentPage.appendChild(s);
  return s;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 4 — Application: Composed App Page (recreates the hand sketch)
// ─────────────────────────────────────────────────────────────────────────────
function buildComposedAppScreen(col, row) {
  const s = mkScreen('04 · Application — Composed App Page', col, row);

  const topBar = mkFrame(SW, 72, C.surface, C.border, 0);
  s.appendChild(topBar);
  const back = mkText('←  Apps', 13, 500, C.textSub);
  back.x = 32; back.y = 26; topBar.appendChild(back);

  const title = mkText('App', 22, 700, C.text);
  title.x = 32; title.y = 104; s.appendChild(title);

  // Flow Bundle 2 — standalone button, top right
  const btnW = 190, btnH = 46;
  const startBtn = mkButton('Start Process', btnW, btnH, true, C.u1, C.u1Bg);
  startBtn.x = SW - 32 - btnW; startBtn.y = 96; s.appendChild(startBtn);

  // One seamless card containing Flow Bundle 1 (left) + Flow Bundle 3 (right) —
  // no visible divider between them, matching "should read as one page"
  const cardW = 620, cardH = 300;
  const card = mkFrame(cardW, cardH, C.surface, C.border, 14);
  card.x = 32; card.y = 168; s.appendChild(card);

  mkField('Name', 'Jordan Reyes', 32, 32, 250, card);
  mkField('Email', 'jordan@example.com', 32, 100, 250, card);

  const editPill2 = mkButton('Edit', 60, 28, false, C.a1, C.a1Bg);
  editPill2.cornerRadius = 20;
  editPill2.x = 340; editPill2.y = 24; card.appendChild(editPill2);
  mkField('Address', '221 Market St, Suite 400', 340, 60, 250, card);

  figma.currentPage.appendChild(s);
  return s;
}

// ─────────────────────────────────────────────────────────────────────────────
// ARCHITECTURE DIAGRAM — native Figma frame, placed below the 4 screens
// ─────────────────────────────────────────────────────────────────────────────
function buildArchitectureDiagram() {
  const DIAG_W = 1200;
  const PAD = 24;
  const d = figma.createFrame();
  d.name = '05 · System Architecture';
  d.x = 0; d.y = 2 * (SH + GAP);
  d.fills = solid(C.bg);

  var y = PAD;
  const h1 = mkText('FlowOS — System Architecture', 18, 700, C.text);
  h1.x = PAD; h1.y = y; d.appendChild(h1);
  y += 40;

  const innerW = DIAG_W - PAD * 2;

  // Client tier
  const clientTier = mkTier(innerW, 100, 'CLIENT — NEXT.JS', C.surface, C.border);
  clientTier.x = PAD; clientTier.y = y; d.appendChild(clientTier);
  var clientBoxes = [
    { name: 'Setup', desc: 'builder canvas', color: C.b1, bg: C.b1Bg },
    { name: 'Application', desc: 'launcher + composed pages', color: C.u1, bg: C.u1Bg },
  ];
  clientBoxes.forEach(function (box, i) {
    const bw = (innerW - 32 - 16) / 2;
    const bx = mkFrame(bw, 56, box.bg, box.color, 8);
    bx.x = 16 + i * (bw + 16); bx.y = 30; clientTier.appendChild(bx);
    const bn = mkText(box.name, 13, 700, box.color);
    bn.x = 12; bn.y = 10; bx.appendChild(bn);
    const bd = mkText(box.desc, 10, 400, C.textMuted);
    bd.x = 12; bd.y = 30; bx.appendChild(bd);
  });
  y += 100 + 40;
  d.appendChild(mkConnector(DIAG_W / 2, y - 40, DIAG_W / 2, y, C.borderStr));

  // API tier
  const apiTier = mkTier(innerW, 130, 'API — NESTJS', C.surface, C.border);
  apiTier.x = PAD; apiTier.y = y; d.appendChild(apiTier);
  var apiModules = ['FlowsModule', 'LLMModule', 'ExecutionModule\n(pausable engine)', 'ArtifactsModule\n(bundle storage)', 'ConnectorsModule', 'SocketModule'];
  var modW = (innerW - 32 - 5 * 12) / 6;
  apiModules.forEach(function (name, i) {
    const box = mkFrame(modW, 70, C.elevated, C.borderStr, 8);
    box.x = 16 + i * (modW + 12); box.y = 40; apiTier.appendChild(box);
    const nt = mkText(name, 10, 600, C.text, modW - 16);
    nt.x = 8; nt.y = 10; box.appendChild(nt);
  });
  y += 130 + 40;
  d.appendChild(mkConnector(DIAG_W / 2 - 100, y - 40, DIAG_W / 2 - 100, y, C.borderStr));
  d.appendChild(mkConnector(DIAG_W / 2 + 100, y - 40, DIAG_W / 2 + 100, y, C.borderStr));

  // Java Runtime + Data tier (side by side)
  const javaW = innerW * 0.42, dataW = innerW - javaW - 24;
  const javaTier = mkTier(javaW, 100, 'JAVA RUNTIME — SPRING BOOT', C.d1Bg, C.d1Dim);
  javaTier.x = PAD; javaTier.y = y; d.appendChild(javaTier);
  const compilerBox = mkFrame(javaW - 32, 26, C.bg, C.d1Dim, 6);
  compilerBox.x = 16; compilerBox.y = 34; javaTier.appendChild(compilerBox);
  const ct = mkText('Dynamic compiler  →  loaded classes', 11, 500, C.d1);
  ct.x = 10; ct.y = 6; compilerBox.appendChild(ct);
  const javaNote = mkText('POST /execute  ·  POST /classes (compile + hot-load)', 10, 400, C.textMuted);
  javaNote.x = 16; javaNote.y = 68; javaTier.appendChild(javaNote);

  const dataTier = mkTier(dataW, 100, 'DATA', C.a1Bg, C.a1Dim);
  dataTier.x = PAD + javaW + 24; dataTier.y = y; d.appendChild(dataTier);
  const pgBox = mkFrame(dataW - 32, 26, C.bg, C.a1Dim, 6);
  pgBox.x = 16; pgBox.y = 34; dataTier.appendChild(pgBox);
  const pgT = mkText('Postgres — Flow · FlowRun · Artifact · Connector', 11, 500, C.a1);
  pgT.x = 10; pgT.y = 6; pgBox.appendChild(pgT);
  const extT = mkText('+ external source (DB · CSV · REST) via Connectors', 10, 400, C.textMuted);
  extT.x = 16; extT.y = 68; dataTier.appendChild(extT);

  y += 100 + 24;
  d.resize(DIAG_W, y + PAD);

  figma.currentPage.appendChild(d);
  return d;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  await Promise.all([
    figma.loadFontAsync({ family: 'Inter', style: 'Regular' }),
    figma.loadFontAsync({ family: 'Inter', style: 'Medium' }),
    figma.loadFontAsync({ family: 'Inter', style: 'Semi Bold' }),
    figma.loadFontAsync({ family: 'Inter', style: 'Bold' }),
  ]);

  var screens = [];
  screens.push(buildSetupCanvasScreen(0, 0));
  screens.push(buildPageBuilderScreen(1, 0));
  screens.push(buildLauncherScreen(0, 1));
  screens.push(buildComposedAppScreen(1, 1));
  screens.push(buildArchitectureDiagram());

  figma.viewport.scrollAndZoomIntoView(screens);
  figma.closePlugin('FlowOS: 4 screens + architecture diagram generated!');
}

main();
