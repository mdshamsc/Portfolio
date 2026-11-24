# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Scope warning
This directory (`version-3`) is the **terminal/ASCII portfolio** for heyshams.com. The `CLAUDE.md` one level up (`personal-portfolio/`) describes a different, older project (the 3D "A letter for You" site with three.js/GSAP, `src/`, `content.js`). None of that applies here. Ignore it when working in `version-3`.

## Stack
No framework, bundler, npm, or tests. Plain `index.html` + `styles.css` + one IIFE in `main.js`. Zero dependencies; fonts and audio are self-hosted. There is no build or lint step.

## Run
```bash
npx -y http-server -p 5173 -c-1     # same as .claude/launch.json "dev"
```
Any static server works. Deploys as-is to GitHub Pages (`CNAME`, `.nojekyll`; `404.html` is the Pages not-found page).

## Architecture
- **All content lives in `index.html`.** Each screen is a `<section class="screen" id="...">`; only `.is-active` is shown. Screens: `intro`, `shifl`, `pathao`, `boost`, `contact`. Routing is hash-based (`idFromHash` → `show`).
- Adding or renaming a screen touches several places that must stay in sync: the section in `index.html`, the previous project's "Next" link, and `SCREENS` / `PROJECTS` / `TITLES` at the top of `main.js`. Also update `llms.txt` and `sitemap.xml` when copy or pages change.
- **No entry gate**: the page boots straight into the first-load decrypt on the hash screen (default `intro`). Audio stays blocked until the first key/click, then the rest of the sound plays. `ART` in `main.js` is the ASCII SHAMS shown on the intro; size caps come from `data-max` on `.bigtext`.
- **Option lists**: `.menu` > `.opt` rows look like Claude Code prompts (`❯` pointer + accent on the selected row, via `::before`). One row per menu is `.is-sel`; hover, focus and ↑/↓ move it, Enter clicks it. `data-key` is a space-separated list (`enter 1`, `c 2`), matched with `~=`.
- **Command input**: one `#cmd` element in `index.html`; `Cmd.mount()` moves it to the end of the active screen. Typing `/` (or pressing `/` anywhere) lists `COMMANDS` in `main.js`; ↑/↓ select, Tab/Enter/click navigate. Add a page → add it to `COMMANDS` too.
- **Transitions** (`show()` in `main.js`): old screen text scrambles out (`decryptOut`), new screen is activated, then each visual line locks in top to bottom (`decryptIn`). Text is animated by mutating text-node `data` directly, so don't wrap or replace text nodes inside screens while animating. `lineMap` measures per-character line position with Ranges. Background noise is a separate `<canvas id="grid">` (`Grid`) that skips cells under the HUD and the active screen (`holes()`).
- `busy` blocks input during a transition. A hash change mid-animation is re-checked at the end of `show()`.
- **Timing constants** are the `T` object at the top of `main.js`. Visual tokens (colors, the single font size `--fs`) are at the top of `styles.css`.
- **Layout helpers**: `.rule` elements are filled with a repeated character to the measured monospace width (`fillRules`); `.bigtext` titles are plain `██` text in the HTML that JS scales to fit (`fitBig`). Both run on `layout()` per activate and on resize.
- **Input**: single-key shortcuts use `data-key` attributes (`enter` = the screen's primary button), resolved on the active screen first, then `.topnav`. A HOTKEYS toggle disables them (WCAG 2.1.4). Keep this working when adding buttons.
- **Sound**: `assets/audio/decrypts.m4a` through WebAudio with a synth fallback; handles autoplay blocking by playing the remainder after the first user gesture. State persists in `localStorage` via the `store` wrapper (try/catch for private mode).
- **Image viewer**: `.img-btn` buttons with `data-full` open a native `<dialog id="viewer">`.
- **Analytics**: Microsoft Clarity loads only if `window.CLARITY_ID` in `index.html` is non-empty. Events go through `track()`.

## Constraints to preserve
- Works without JS (stacked readable document; `<html>` gets class `js` only when JS runs).
- `prefers-reduced-motion`: no noise, no scrambling, instant switches (`reduced()` branches).
- Each screen change moves focus to the heading and updates `document.title`.
- Color roles: white copy, grey meta, orange accents/actions, teal only for the status dot. Text contrast must stay 7:1+ on black.
- Footer shows the current location path (`PATHS` in `main.js`) and the email.
