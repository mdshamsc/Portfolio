# heyshams.com v3: terminal portfolio

90s terminal / ASCII portfolio. No framework, no build step, no dependencies.

## Files
```
index.html     all content + meta, JSON-LD, Clarity snippet
styles.css     theme tokens at the top (colors, the one font size --fs)
main.js        line-by-line decrypt, background character noise, sound, routing
robots.txt     allows search engines and AI agents
llms.txt       plain-text summary for AI agents
sitemap.xml
404.html       GitHub Pages not-found page
CNAME          custom domain for GitHub Pages
assets/fonts   IBM Plex Mono 400/600 (SIL Open Font License), self-hosted
assets/img     two images per project (workN-bg, workN-sm) + portrait
assets/audio   decrypts.m4a: 3.85 s of the reference decryption effect (voice cut out)
```

The big block titles (`.bigtext`) are plain text in `index.html`, built from `██` pixels. JS only scales them to fit.
Single-key shortcuts ([1] [C] [I] ...) can be turned off with the HOTKEYS toggle (WCAG 2.1.4).

## Run locally
Any static server works, for example:
```bash
npx -y http-server -p 5173 -c-1
```

## Edit
- Copy: edit the text in `index.html` (each screen is a `<section>`). Update `llms.txt` too.
- Add a project: copy a project `<section>`, give it an id, point the previous project's Next button at it, and add the id to `SCREENS`, `PROJECTS` and `TITLES` at the top of `main.js`.
- Timing: the `T` object at the top of `main.js` (first load ~1.85 s, screen change ~1 s).
- Only buttons, links and their keys move between sections. Clicking empty space does nothing.
- Colors: white for copy, grey for meta, orange for accents and actions. Teal is only the status dot.

## Microsoft Clarity
Paste your project ID into `window.CLARITY_ID` in `index.html`. Nothing loads while it's empty.
Custom events sent: `screen_<id>`, `view_image_<id>`, `sound_on`, `sound_off`.

## Accessibility
- Works without JS (stacked, readable document).
- `prefers-reduced-motion`: no character noise, no scrambling, instant screen changes.
- Every screen change moves focus to its heading and updates the page title.
- Block-letter titles are decorative (`aria-hidden`) with real heading text for screen readers; each image button has a text label and the viewer shows real alt text.
- Native `<dialog>` for the image viewer (focus trap, Esc to close, focus returns).
- Sound toggle (`aria-pressed`) remembers the choice. The load sound plays if the browser allows autoplay; otherwise the rest of it plays on the first tap or key press.
- Text contrast is 7:1 or higher on black.

## Deploy (GitHub Pages)
Push to a repo, then Settings → Pages → Deploy from branch → `main` / root. Keep `CNAME` if the domain is heyshams.com.
