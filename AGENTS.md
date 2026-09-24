# Project Guide

## Project harness

Use the repository documents as the source of truth for planned work:

1. Read `docs/product-specs/index.md` for product scope and acceptance criteria.
2. Read `ARCHITECTURE.md` before changing module boundaries, persistence, EPUB loading, exports, or release artifacts.
3. Read `docs/design-docs/systems/reader-selection-navigation.md` before changing selection, touch/pointer handling, page turns, Foliate navigation, or LTR/RTL behavior.
4. Record multi-step implementation work in `docs/exec-plans/active/` and keep `progress.md` current while the work is active.
5. Put durable implementation decisions in `docs/design-docs/`; do not leave important rationale only in chat, commits, or code comments.
6. Run `npm run verify:quick` during implementation and `npm run verify:full` before declaring a change complete.
7. Move finished execution plans to `docs/exec-plans/completed/` and record known compromises in `docs/exec-plans/tech-debt.md`.

Generated facts should be produced from code whenever practical. If generated documentation is added later, place it under `docs/generated/` and document the generator command beside it.

## User interface guidelines

Apply these guidelines whenever adding, removing, or changing any user-facing interface, including settings, reader controls, panels, dialogs, empty states, and responsive layouts. The plugin should look and behave like a native part of Obsidian: plain, functional, and consistent with the user's active theme.

### 1. Inspect before changing

1. Identify the affected view, its responsive behaviour, existing CSS custom properties, class naming, and nearby UI patterns.
2. Reuse or extend existing components and selectors before creating one-off styling. Keep changes focused.
3. For a large visual change, state a short implementation plan before coding.

### 2. Visual style

- Use Obsidian's theme variables for all interface colors: `--background-primary`, `--background-secondary`, `--background-modifier-border`, `--background-modifier-hover`, `--text-normal`, `--text-muted`, `--interactive-accent`, and related variables. Do not introduce a custom palette or hardcoded interface colors; the user's light/dark theme must apply automatically. (Highlight annotation colors and the explicit Light/Dark/Sepia reading themes are content choices, not interface styling.)
- Use `--font-interface` for interface text. Do not add decorative or display fonts, and never override the reader's chosen book font.
- Use Obsidian's standard radii (`--radius-s`, `--radius-m`) and shadows (`--shadow-s`, `--shadow-l`) only where elevation is functional (popovers, drawers, modals). Cards and list items stay flat.
- Avoid decorative effects: no gradients, textures or noise overlays, frosted-glass blur, hover lifts, staggered layouts, uppercase wide-tracked labels, or decorative italics.
- Prefer Obsidian's native controls (`Setting`, `Modal`, `Menu`, `setIcon`, `mod-cta`, `mod-warning`) over custom-styled equivalents.

### 3. Interaction and motion

- Maintain at least 44px touch targets on mobile.
- Keep transitions short and functional (showing/hiding controls, opening panels). Respect `prefers-reduced-motion`; avoid continuous or decorative animations in the reader.
- Never remove focus indication.

### 4. Responsive and accessible completion checks

- Start mobile-first. Collapse multi-column groups cleanly, remove desktop-only stagger offsets on small screens, and prevent horizontal overflow.
- Keep reader text comfortable: preserve user font and reading settings, adequate line height, contrast, selection behaviour, and zoom/reflow compatibility.
- Use semantic controls, keyboard access, visible focus states, labels for icon-only buttons, and appropriate ARIA attributes when native semantics are insufficient.
- Test the affected view at narrow and wide widths, with keyboard navigation, and with `prefers-reduced-motion` enabled. Run relevant existing tests or build checks after UI changes.

### 5. Maintainability rules

- Take colors, radii, and shadows from Obsidian's theme variables; centralize any recurring plugin-specific spacing or timings as CSS custom properties.
- Match the repository's TypeScript, DOM, and CSS conventions. Do not add React, Tailwind, external fonts, or a UI library.
- Keep changes responsive, accessible, and performant. Avoid filters, extra layers, and animation work in the reader.
