# AGENTS.md — implementation contract

This is a dependency-free static HTML/CSS/JS site published from the repository
root (GitHub Pages user site). There is no build step, bundler, package manager,
or server-side code. Keep it that way — do not add one.

## Directory map

```
index.html              root redirect to /bc/
template.html           copy-paste starting point for a new top-level page
AGENTS.md               this file
README.md               short human-facing overview (do not duplicate this file)

global/                 shared chrome, styles, behavior — used by every page
  elements/              HTML fragments fetched at runtime (navbar.html, footer.html)
  scripts/navbar.js      fetches the fragments into #navbar/#footer, nav dropdown
  styles/style.css       design tokens (--paper/--ink/...), shared primitives
                         (.page-header, .post, .link-list, #navbar, footer, etc.)

<page>/                 one folder per route, e.g. bc/, cinema/, tabletennis/
  index.html             the page (title, head links, #navbar/#footer mounts)
  styles/style.css       page-only CSS (page may use a more specific file name,
                         e.g. cinema/styles/posts.css, if one file serves several
                         sub-concerns)
  scripts/*.js           page-only JS, ES modules, loaded with <script type="module">
  data/*.json            page-only static catalogs/content, fetched at runtime
  imgs/                  page-only images

<page>/<sub-route>/      nested page, e.g. apps/todopet/, tabletennis/matcher/
                         same internal shape as a top-level page (its own
                         index.html, styles/, scripts/, data/) — never reuses a
                         parent page's styles/scripts/data folder directly

handmade/                FROZEN. A preserved, pre-existing alternate copy of the
                         site. Do not edit, extend, or mirror new work into it.
                         Treat it as read-only archive; if a change here seems
                         necessary, stop and flag it instead of editing.
```

## Routing and page wiring

- One folder per route; `folder/index.html` serves `/folder/`. Nested routes
  (`apps/todopet/`, `tabletennis/matcher/`) follow the exact same shape one
  level deeper.
- Every page `<head>` must include, in this order: `<meta charset="UTF-8">`,
  `<meta name="viewport" content="width=device-width, initial-scale=1">`,
  `<title>`, the shared navbar script, this page's scripts, the shared
  stylesheet, then this page's stylesheet(s).
- Shared assets (`global/scripts/navbar.js`, `global/styles/style.css`,
  `global/elements/*.html`) are always referenced with a root-absolute path
  (`/global/...`), never a relative `../global/...`. This is required because
  nested routes sit at different depths and a single absolute form works at
  every depth without special-casing.
- A page's own scripts/styles/data/images are always referenced with a
  page-relative path (`scripts/x.js`, `styles/style.css`, `data/x.json`,
  `imgs/x.png`) from that page's own `index.html`. The only exception is a
  page that has nested sub-routes sharing one page-level stylesheet (e.g.
  `apps/` and `apps/todopet/*` both use `/apps/styles/style.css`) — there,
  use a root-absolute path rooted at that page's own folder, since relative
  depth would otherwise differ per sub-route.
- `<body>` mounts shared chrome as `<div id="navbar"></div>` and
  `<div id="footer"></div>`; `global/scripts/navbar.js` fetches
  `/global/elements/navbar.html` / `footer.html` into them. Content lives in
  `<div id="content-area">`, headed by an `<h1 class="page-header">`.
- Adding a page: copy `template.html` into `<page>/index.html`, set the
  `<title>` and `<h1 class="page-header">`, add page-only `styles/`,
  `scripts/`, `data/` as needed, then add a `<li><a href="/page">Label</a></li>`
  to **both** `global/elements/navbar.html` and the "Pages" list in
  `global/elements/footer.html` (keep them in sync — this is the one piece of
  navigation duplicated by necessity, since the footer repeats the nav for
  users who scroll past it). A nested sub-route (not a top-level section) is
  linked only from its parent page's content, not from the global nav —
  see `apps/index.html` → `apps/todopet/` or `tabletennis/index.html` →
  `tabletennis/matcher/`.

## Styling rules

- Design tokens, resets, and shared primitives (`--paper`, `--ink`,
  `.page-header`, `.post`, `.link-list`, `#navbar`, `footer`, reduced-motion
  overrides) live only in `global/styles/style.css`. Never redefine a shared
  token or primitive in a page stylesheet; add a new primitive there only if
  it is genuinely reusable across pages, otherwise keep it page-scoped.
  A page stylesheet may give `.post`/`#content-area` a page-specific layout
  (grid vs. flex, column count) — that is overriding layout, not duplicating
  the primitive.
- Responsive breakpoint convention: `@media (max-width: 100vh)` for the
  portrait/mobile layout switch (matches the viewport-meta-driven square
  masthead breakpoint already used sitewide); add a narrower breakpoint only
  if content genuinely needs it.
- `prefers-reduced-motion` is handled once, globally, in
  `global/styles/style.css`. Do not add per-page reduced-motion overrides;
  keep any page-level transitions short enough that the global override
  (forcing ~0 duration) is sufficient.

## Scripts and data

- Page scripts are ES modules (`<script type="module">`), loaded from that
  page's `scripts/` folder, and do not import across pages (a page may import
  `global/scripts/navbar.js` implicitly via its own `<script>` tag, but never
  reaches into another page's `scripts/` or `data/` folder).
- Static catalogs/content live in that page's `data/*.json`, fetched at
  runtime with `fetch('data/....json')` (relative to the page). Keep catalogs
  small and local — this site has no backend, so "add data" means "add a JSON
  file," never a database, API, or scraper.
- Render fetched/catalog data with DOM APIs (`createElement`, `textContent`)
  rather than interpolating it into `innerHTML`, even for trusted local JSON —
  see `tabletennis/matcher/scripts/matcher.js` for the pattern.
- A script with non-trivial logic (anything beyond straightforward DOM
  wiring) belongs in its own DOM-free module so it can be unit-tested — see
  `tabletennis/matcher/scripts/matchLogic.js` next to its
  `matchLogic.test.mjs`. Keep the test colocated with the module it tests.

## Boundaries (do not)

- Do not duplicate `#navbar`/`footer` markup, design tokens, or shared
  primitives into a page stylesheet — reuse `global/`.
- Do not scatter inline `<style>` blocks or large inline `style="..."`
  attributes for anything reusable; page-specific one-offs in markup are
  tolerated where the existing pages already do this, but new reusable rules
  go in that page's `styles/style.css`.
- Do not hardcode content/catalog data inside a script or inline in HTML —
  put it in `data/*.json` and fetch it.
- Do not add images, previews, or OS metadata (`.DS_Store`, `Thumbs.db`)
  anywhere outside the owning page's own asset folder; never commit generated
  previews or OS metadata at all (see `.gitignore`).
- Do not add a package manager, bundler, framework, backend, database,
  analytics, accounts/checkout, or admin UI. If a task seems to need one,
  it is out of scope for this repo as-is — flag it instead.
- Do not edit `handmade/`. It is a frozen archive copy, not a second place to
  mirror new work.

## Validation (no build/lint step exists — these are the real checks)

Run from the repository root:

- Syntax-check every tracked JS/module file:
  `git ls-files -- '*.js' '*.mjs' | ForEach-Object { node --check $_ }`
  (exclude nothing under `.claude`; there is none tracked there)
- Parse every tracked JSON file:
  `git ls-files -- '*.json' | ForEach-Object { python -c "import json,sys; json.load(open(sys.argv[1], encoding='utf-8'))" $_ }`
- Run any colocated logic self-check: `node --test <folder>/scripts/*.test.mjs`
  (e.g. `node --test tabletennis/matcher/scripts/matchLogic.test.mjs`)
- Smoke-check pages over HTTP with a local static server run from the
  repository root, e.g. `python -m http.server 8000`, then load
  `http://localhost:8000/<page>/` for each touched route.
- Before finishing: `git status --short` and `git diff` to confirm only the
  intended files changed, and `git diff --cached` to confirm nothing is
  staged unless explicitly asked to stage it.

## Known, intentionally unresolved

- `handmade/` mirrors an older version of several pages (including an older
  `tabletennis/` without the matcher). It is explicitly out of scope per its
  frozen/archive status above — do not add a matching `handmade/tabletennis/matcher/`.
