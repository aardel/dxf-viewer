## Unified CAD Viewer: Findings and Status

### Information
- **Files reviewed**: `unified-viewer.html`, `main.js`, `style.css`, `CFF2Viewer.html`, `dds-viewer.html`
- **Unified flow** (`unified-viewer.html`):
  - Detects file type by extension (`.dds`, `.cf2`, `.cff2`).
  - Toggles controls: `#dds-controls` vs `#cff2-controls` and adjusts `#code-section-title`.
  - Single canvas `#mainCanvas` with `draw()` delegating to `drawDDS()` or `drawCFF2()`.
  - Code panel shows raw file lines; clicking a line highlights corresponding geometry and the line-type row.
  - Zoom/pan per-format: `view` for CFF2, `ddsView` for DDS; mouse wheel zooms to cursor; panning with LMB; Reset View button and key `0` to fit.
  - Pane layout: draggable dividers with minimum widths; code panel sticks to the right and expands; canvas resizes via `ResizeObserver`.
- **DDS parsing**:
  - Parses `LINE` and `ARC` records; ignores empty, comment (leading `\`, `*`), and `SUB` lines.
  - Buckets grouped by `color|kerfRounded` (4 decimals). LINE and ARC combined; “Type” shows LINE/ARC/MIXED.
  - Per-bucket data: count, totalLength, totalBridge, kerf, displayColor, visibility.
  - Hover, selection, and bucket-hover affect stroke; tooltip shows type/color.
  - Bounds computed from entities; fit-to-bounds + pan/zoom applied.
- **CFF2 parsing**:
  - Supports records `LL` (lower-left), `UR` (upper-right), `L` (line), `A` (arc).
  - Groups by key `${pen}-${layer}` with per-type visibility and color (random default).
  - Keeps `boundingBox` from `LL`/`UR` for fit-to-bounds; per-entity click/hover detection implemented.
  - Rendering parity with DDS: selected (red), hovered (yellow), line-type hover (green) plus tooltip.
- **DDS LINE record format (as implemented)**:
  - Example: `LINE 0.000000 0.000000 6.000000 0.000000 100 0.0280 3 0.0440`
  - Syntax: `LINE <startX> <startY> <endX> <endY> <color> <kerfWidth> <bridgeCount> <bridgeWidth>`
  - Fields:
    - 0: `LINE` — command type
    - 1: `startX` — inches
    - 2: `startY` — inches
    - 3: `endX` — inches
    - 4: `endY` — inches
    - 5: `color` — color/layer code (implementation mapping)
    - 6: `kerfWidth` — inches
    - 7: `bridgeCount` — integer
    - 8: `bridgeWidth` — inches
  - Behavior: If `bridgeCount` > 0 and `bridgeWidth` > 0, the line is drawn as `bridgeCount+1` cut segments separated by `bridgeCount` gaps of `bridgeWidth` each, distributed along true line length.

- **DDS ARC record format (as implemented)**:
  - Example: `ARC 1.767639 5.094461 1.830132 5.156965 1.767629 5.156965 0.062503 163 0.0140 0 0.0000`
  - Syntax:
    - `ARC <startX> <startY> <endX> <endY> <centerX> <centerY> <radius> <color> <kerfWidth> <bridgeCount> <bridgeWidth>`
  - Fields:
    - 0: `ARC` — command type
    - 1: `startX` — inches
    - 2: `startY` — inches
    - 3: `endX` — inches
    - 4: `endY` — inches
    - 5: `centerX` — arc center X (inches)
    - 6: `centerY` — arc center Y (inches)
    - 7: `radius` — signed radius; negative indicates counterclockwise sweep
    - 8: `color` — color/layer code (implementation mapping)
    - 9: `kerfWidth` — inches (used also as visual stroke width proxy)
    - 10: `bridgeCount` — integer
    - 11: `bridgeWidth` — inches
  - Behavior:
    - The arc path is drawn at the given radius from `(centerX, centerY)` between the angles defined by the start/end points.
    - If `bridgeCount` > 0 and `bridgeWidth` > 0, the arc is rendered as a continuous stroke and then bridge gaps are overlaid (punched out) along the arc length at evenly distributed positions, mirroring the line logic.
    - Negative `radius` encodes counterclockwise direction.

#### Confirmed fields (laser cutting context)
- Confirmed: fields 0 (command), 1 (startX), 2 (startY), 3 (endX), 4 (endY), 5 (color code), 6 (kerfWidth in inches), 7 (bridgeCount), 8 (bridgeWidth in inches).
- Bridges are present and meaningful; applied when 7>0 and 8>0.

### DDS Metrics, display and persistence
- Table columns: Color, Type, Count, Kerf (units or % of 2pt), Length (units), Bridge %.
- Sorting supported on Kerf, Length, Bridge %.
- CSV export for current buckets.
- Persistence (localStorage): units, Show % of 2pt, Render bridges, per-bucket visibility and display color.

### Completed
- Sorting for both formats (`th.sortable` headers with asc/desc indicators).
- CFF2 selection/hover highlighting and tooltip parity with DDS.
- Canvas resize on pane resize via `ResizeObserver`.
- Draggable separators with minimum widths; right-sticky expanding code panel.
- Reset view control (button + key `0`).
- Code filter for both formats; entity inspectors; tooltips.
- DDS bridges overlay for LINE and ARC, with toggle.
- Kerf display (units toggle, % of 2pt); color|kerf grouping.
- Metrics (Length, Bridge %) and CSV export.
- Persisted units/%/bridges + per-bucket visibility/display color.

### New (since last update)
- Measurement tool:
  - Units-aware readout (in/mm based on format’s units selector).
  - Snaps to nearest entity endpoints for precise picking.
  - Visual toggle state on the Measure button; Esc exits measurement mode and clears overlay.
  - Hover/selection suppressed while measuring to avoid conflicts.
- UI: Hide/show code panel now safely adjusts layout using already-initialized controls refs, preventing TDZ errors.

### TODO (prioritized)
- **High**
  - Persist CFF2 preferences and add a CFF2 export if needed.
  - Wire error log to show malformed record diagnostics with line numbers.
  - Measurement: optional snapping to midpoints/intersections and angle/arc length readouts.
  - UI modernization phase 1 (see plan below): shared toolbar + theming + icons + keyboard map overlay.
- **Medium**
  - Improve code panel (syntax highlighting, keep scroll on redraw).
  - Performance on large files (batch drawing, offscreen canvas).
  - Visual kerf hint overlay on hover/selection (optional).
  - Scene graph abstraction (entities, layers, styles) to prep for editing tools.
- **Low**
  - Remove unused `.resize-handle` CSS or implement actual handles.
  - Tame verbose console logging (especially bridged lines) behind a debug flag.
  - Expand color mapping tables and/or make them configurable.
  - Document more record types if encountered (`SUB`, others) and their intended handling.

## UI modernization plan

Goal: make the viewer feel like a modern CAD app while keeping a single-file option initially. Implement in phases to avoid breaking existing workflows.

Phase 1 (visual/UX polish)
- Global toolbar: file open, reset view, measure (toggle), pan/zoom tools, grid toggle, show/hide code.
- Iconography: simple inline SVG icons (no external deps) with accessible labels.
- Theming: light/dark theme with CSS variables; persist choice; high-contrast focus outlines.
- Keyboard map overlay: `?` shows a modal with shortcuts (0 fit, M measure, G grid, H code panel, Esc cancel, etc.).
- Status bar: add active tool, unit, and grid/snap status; keep existing coords/scale/measure.
- Layout polish: smoother divider handles, hover affordances, and minimum sizes tuned.

Multi-pane/windowing (design)
- Panels: Code and Line Types become detachable panels that can be docked left/right/bottom or popped out to separate windows.
- In-page docked/floating panels (default): draggable headers, resize, snap-to-dock zones. Persist layout in `localStorage` (sizes, dock area, order, visibility).
- Pop-out windows (optional advanced): `window.open()` child windows for Code and Line Types; bi-directional `postMessage` sync for selection/highlight, visibility toggles, colors, filters, and sort state. Fallback to in-page floating if blockers or single-display.
- PanelManager module: centralizes panel state, docking, pop-in/out, persistence, and event routing. Provides API: open/close/toggle/dock/undock for `code`, `lineTypes`.
- Menu actions: View → Panels → Show/Hide Code, Show/Hide Line Types, Pop out/In. Window → Reset Layout, Save Layout.

Menu bar (design)
- File: Open…, Open sample…, Export → CSV (DDS/CFF2), Export canvas PNG, Preferences…
- Edit: Undo, Redo, Select All, Clear Selection
- View: Fit to View (0), Zoom In/Out, Grid On/Off, Snapping On/Off, Panels → Code, Line Types, Code panel pop out/in
- Tools: Measure, Pan, Selection, Creation tools (when editor enabled)
- Help: Keyboard Shortcuts, About

Phase 2 (structural)
- Extract JS into modules while keeping a single buildless flow (type="module").
- Shared canvas controller (pan/zoom, transforms) across formats.
- Componentize tables (render + behaviors) for DDS/CFF2 reuse.
- Settings modal: persist all preferences; import/export settings JSON.

Phase 3 (performance + quality)
- OffscreenCanvas or layered canvases (base geometry + overlays) to minimize redraw cost.
- Virtualized code panel for very large files.
- Diagnostics console panel for parse warnings/errors.

## Basic CAD editor plan

Scope: lightweight drafting and property editing focused on laser-cut workflows. Prioritize correctness and snapping.

Phase 1 (selection + creation)
- Selection tool: click/drag select; multi-select with Shift; bounding box.
- Geometry create: Line, Circle, Arc (center-start-end); Rectangle (axis-aligned); Polyline.
- Snapping: endpoints, midpoints, grid; optional perpendicular/parallel inference; toggle in toolbar; status bar shows acquired snap.
- Grid: configurable spacing (in/mm), show/hide; optional subdivisions.
- Property inspector: editable fields for color/pen-layer, kerfWidth, bridgeCount/bridgeWidth, process name (CFF2), visibility.
- Undo/redo stack.

Phase 2 (transform + edit)
- Move, Rotate (by angle or 2-point), Scale (uniform); keyboard nudging with arrow keys.
- Edit vertices: drag endpoints; arc radius/center adjustment handles.
- Join/split polylines; reverse direction for arcs/lines if needed.
- Bridge tooling: set count/width per entity; preview overlay live.

Phase 3 (I/O + advanced)
- Export edited scene back to DDS and CFF2 (round-trip preserving untouched lines where possible).
- Import HPGL for reference; export CSV of metrics with process names/colors.
- Optional kerf-offset preview as separate overlay layer (do not destructively modify geometry).
- Optional intersections snap + angle/distance constraints.

Dependencies/constraints
- Keep zero-dependency where possible; use inline SVG for icons, vanilla JS modules.
- Maintain current single-file runnable mode; module split can be progressive.
- All edits must respect current units and persist preferences.

## Risks and mitigations (multi-window)
- Popup blockers: detect failure to open child window; fallback to in-page floating. Provide user hint to allow pop-ups.
- State sync drift: route all state changes through a single source (main window) and broadcast to children via `postMessage`; children send intents back.
- Performance: batch high-frequency updates (hover highlights) or throttle to ~30 Hz; avoid heavy DOM ops in child.


### Might be wrong / assumptions
- **DDS ARC direction**: Negative `radius` = counterclockwise; full-circle detection relies on start≈end not at center. May vary by writer.
- **Units**: Inches for DDS positions and kerf/bridges; display can switch to mm.
- **CFF2 color semantics**: Random color mapping for visualization; actual pen/layer palettes may be required.
- **Bridge distribution**: Even distribution across total length; process might prefer centered/offset patterns.

### Further analysis needed
- Gather diverse DDS and CFF2 samples to validate:
  - Field positions for DDS `LINE`/`ARC` across different producers.
  - Presence and meaning of `lineType`, `weight`, or other attributes.
  - Arc direction and full-circle encoding across formats.
- UX: refine selection feedback, keyboard shortcuts, screen-reader hints.
- Extract shared math (bounds, hit testing, transforms) into reusable helpers.
