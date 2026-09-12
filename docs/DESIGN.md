# The London Hub — Design System

The single source of truth for the visual language. Every component and page follows this
document. Where this document and personal taste disagree, this document wins.

## Identity

A **modern city news magazine** — image-led, card-forward, confident colour, generous
scale. The energy of a contemporary editorial site (big hero, card grids, chip rails,
scroll rails, newsletter band) translated into a **flat, square, bordered** visual
language. It must look nothing like Birmingham Wave (broadsheet: warm paper, hairline
rules, serif body, red accent, no cards). London is the opposite on every axis:

| Axis | Birmingham Wave | The London Hub |
|---|---|---|
| Chrome | warm off-white | **near-black `#0A0A0A`** masthead + footer |
| Content ground | warm paper | **pure white** well |
| Structure | hairline rules, no cards | **1px-bordered cards** |
| Body type | serif (Newsreader) | **sans (Inter)** |
| Display type | serif | **Anton (condensed) + Archivo** |
| Accent | red `#BB1919` | **green `#047857` / `#34D399`** |
| Sections | one accent everywhere | **each section owns a colour** |
| Imagery | text-first (~25% coverage) | **image-led (99% coverage — recon-verified)** |

## Hard rules (non-negotiable, from the project spec)

1. **Square corners everywhere.** `border-radius: 0` on every element. No exceptions —
   not on buttons, chips, inputs, images or avatars.
2. **No box-shadows. No gradients. No blur/glass.** Depth comes from 1px borders, colour
   planes and scale contrast only.
3. Cards are `1px solid var(--border)` on the content well.
4. Colour-coded sections: a section's colour appears on its **kicker text, its section
   rule, its active nav state and its chip** — never as a background behind body copy.
5. Image-led where images exist; the no-image fallback is the **colour-block card**
   (section-colour plane, oversized Anton headline in white) — designed, never an empty
   grey frame.
6. No carousel library. Sliders are native CSS scroll-snap; arrows are the only scripted
   part.
7. No UI kit, no Framer Motion. Server components by default.

## Tokens — `app/globals.css` `:root`

All values below are WCAG-verified (script-checked 2026-09-10; every text colour ≥4.5:1
on its stated ground).

```css
:root {
  --paper:        #FFFFFF;  /* content well */
  --chrome:       #0A0A0A;  /* masthead, footer, topbar */
  --chrome-2:     #161616;  /* raised panels on chrome */
  --chrome-rule:  #2A2A2A;  /* rules on chrome */
  --ink:          #111111;  /* headlines, body on paper */
  --ink-2:        #454545;  /* standfirst, secondary */
  --ink-3:        #6E6E6E;  /* meta, captions — 5.10:1 on white */
  --ink-inverse:  #FFFFFF;  /* text on chrome + on colour blocks */
  --ink-inverse-2:#B3B3B3;  /* secondary text on chrome — 9.44:1 */
  --rule:         #E0E0E0;  /* light separators inside cards */
  --border:       #111111;  /* card borders on paper */
  --accent:       #047857;  /* brand green on white — 5.48:1 */
  --accent-hover: #065F46;  /* 7.68:1 */
  --accent-bright:#34D399;  /* brand green ON CHROME ONLY — 10.30:1 on #0A0A0A */
  --focus:        #0F62FE;  /* focus ring — deliberately not the accent */
  --live:         #B91C1C;  /* breaking-ticker label red, on white 6.47:1 */
}
:root[data-theme='dark'] { /* and the prefers-color-scheme block, same values */
  --paper:        #121212;
  --chrome:       #0A0A0A;
  --chrome-2:     #161616;
  --chrome-rule:  #2A2A2A;
  --ink:          #F2F2F2;
  --ink-2:        #C9C9C9;
  --ink-3:        #9A9A9A;  /* 6.66:1 on #121212 */
  --ink-inverse:  #FFFFFF;
  --ink-inverse-2:#B3B3B3;
  --rule:         #2E2E2E;
  --border:       #3D3D3D;  /* softer border in the dark — full white borders glare */
  --accent:       #34D399;  /* 9.74:1 on #121212 */
  --accent-hover: #6EE7B7;
  --accent-bright:#34D399;
  --focus:        #4589FF;
  --live:         #F87171;
}
```

Dark mode: `data-theme` on `<html>`, set by a **blocking inline `<script>` in `<head>`
before first paint** (port ThemeScript mechanics from bwave). Follows OS until the user
chooses via the sun/moon segmented control in the topbar; choice persists in
`localStorage`. The chrome (`--chrome`) is near-black in BOTH themes — that is the brand.

## Section colours — `config/sections.ts`

One colour per curated section. Light value used on white; dark value used on `#121212`.
All verified ≥4.5:1. Colours are assigned to CATEGORY SLUGS (recon-real, never invented):

| slug | name | light | dark |
|---|---|---|---|
| uk-news | UK News | `#047857` | `#34D399` |
| world-news | World | `#1D4ED8` | `#60A5FA` |
| football | Football | `#6D28D9` | `#A78BFA` |
| sports | Sport | `#C2410C` | `#FB923C` |
| technology | Tech | `#0E7490` | `#22D3EE` |
| entertainment | Entertainment | `#BE185D` | `#F472B6` |
| lifestyle | Lifestyle | `#B45309` | `#FBBF24` |
| business | Business | `#4338CA` | `#818CF8` |
| politics | Politics | `#B91C1C` | `#F87171` |

Fallback for any other category: `--accent`. Expose as CSS vars per block
(`style={{'--section': …}}`) so components stay generic.

## Typography — `next/font/google`, self-hosted at build

| Role | Font | Usage |
|---|---|---|
| Display | **Anton** (400 only) | hero headlines, colour-block cards, section headers ≥28px, the wordmark. ALL-CAPS or Title Case, `letter-spacing: 0.01em` (Anton is already condensed — never negative-track it) |
| Headline | **Archivo** 500–800 | card headlines, article H1/H2, nav. `letter-spacing: -0.03em` above 40px, `-0.01em` below |
| Body/UI | **Inter** 400/500/600 | body `1.0625rem/1.65`, max measure `66ch`; kickers + meta: 600, uppercase, `letter-spacing: 0.08em`, `0.75rem` |

Fluid scale (`clamp()`):
- `--fs-hero:   clamp(2.25rem, 5.5vw, 4.5rem)`   (Anton)
- `--fs-h1:     clamp(1.75rem, 3.5vw, 2.75rem)`  (Archivo 800)
- `--fs-card-l: clamp(1.375rem, 2.2vw, 1.75rem)`
- `--fs-card:   clamp(1.0625rem, 1.6vw, 1.25rem)`
- `--fs-card-s: 0.9375rem`
- `--fs-meta:   0.75rem`

Font loading: three families via `next/font/google` with `display: 'swap'`, subsets
`['latin']`, each with a real fallback stack (`Anton` → `Impact, 'Arial Narrow', sans-serif`;
`Archivo`/`Inter` → system-ui stack). Export from `lib/fonts.ts`, attach variables on
`<html>` (`--font-display`, `--font-headline`, `--font-body`).

## Layout

- Container: `1200px` max, `24px` side padding (16px under 640px).
- Grid: CSS grid, 12-col mental model; gaps `24px` desktop / `16px` mobile.
- Vertical rhythm: sections separated by `56px` desktop / `40px` mobile. No decorative
  horizontal rules between sections — the section header carries the boundary.
- Breakpoints: 640 / 900 / 1200.

## Chrome (masthead + topbar + footer)

**Topbar** (on `--chrome`, 40px): left — `BREAKING` label (white text on `--live` block,
square) + one-line ticker of the latest headline (CSS marquee-free: truncate with
ellipsis; it is a link); right — date (request-time dateline, `Europe/London`), theme
segmented control (sun/moon, visible active state, square buttons).

**Masthead** (on `--chrome`): wordmark `THE LONDON HUB` in Anton, white, with a
`--accent-bright` green square block or full stop as the brand mark (pure CSS, no image).
Height ~72px desktop. Right: search icon-button (opens `/search/`).

**Nav** (on `--chrome`, 48px, sticky top): Archivo 600 uppercase 0.8125rem links, white;
hover — `--accent-bright` underline (3px, square); **active section — 3px underline in
that section's colour** plus the label in white. Overflowing nav scroll-snaps
horizontally on mobile (no hamburger-only dead-end; MobileNav panel also exists, ported
mechanics). `aria-current="page"` on the active item.

**Footer** (on `--chrome`): 4 columns — brand + tagline; Sections (nav links); Company
(the five real WP pages: About Us, Contact Us, Privacy Policy, Terms & Conditions,
Disclaimer); Network (site name; RSS `/feed.xml`; sitemap link). Bottom bar:
`© {year} {site.name}` + publisher email. All text white/`--ink-inverse-2`; links get
`--accent-bright` hover. A 3px `--accent-bright` top border separates footer from the well.

## Homepage composition (order matters)

1. **Hero band** — full-bleed `--chrome` background continuing from the masthead so the
   top of the page is one dark plane. Inside the container: lead story as a large
   image card (16:9, `priority`, `sizes="(max-width: 900px) 100vw, 66vw"`) with an
   Anton headline (white, up to `--fs-hero`) over a **solid** caption panel (no overlay
   tint on the image itself: caption block sits BELOW the image, `--chrome-2` ground,
   1px `--chrome-rule` border) + two stacked secondary image cards to the right, white
   Archivo headlines on `--chrome-2` caption blocks, section kicker in each story's
   section colour (bright variant).
2. **Chip rail** — horizontal scroll-snap rail of section chips on the white well:
   1px-bordered square chips, label + post count, chip text/border in the section
   colour; hover fills the chip with the colour, text white.
3. **Latest News** — section header (Anton, `Latest` + green square) with a `View more →`
   bordered button (→ `/all-post/`); grid: 1 large image card (left, 7 cols) + 4 compact
   horizontal cards (right, image-thumb left/text right).
4. **Section blocks** — for each entry in `homepageSections` (recon-curated): section
   header in the section colour (colour swatch square + Anton title + thin 2px rule in
   the colour + "More {name} →" link); then a 4-card row: first card large, three
   standard. Global `Set<number>` dedup across the entire page (ported invariant); a
   section renders only if it still has ≥3 undeduped stories — **render nothing rather
   than filler**.
5. **Scroll rail** — "More from the Hub": scroll-snap slider of compact cards
   (see Slider spec).
6. **Closing band + colour wall** — `--chrome` full-bleed. Head is two columns above
   900px: the Anton statement left (the largest type on the page, `clamp(2.25rem, 6vw,
   4.25rem)` — bigger than the hero, deliberately), copy + `Explore all stories` button
   + newsdesk `mailto:` right, so the band fills its width.

   Below it, the **section wall**: a grid of tiles, one per curated section, each on its
   section colour with the story count above an Anton name. This is the only place the
   palette appears at full scale — everywhere else it is a 12px kicker or a 2px rule —
   and it closes the page on the brand. Hover **inverts** the tile to white with the
   section colour on the type, and reveals a `→`; nothing else moves.

   Rules learned building it: tiles take `--section-light` directly, never `var(--section)`
   (the band is chrome in both themes, and the dark values fail as a ground); the hover
   white is a literal, not `--paper` (which is `#121212` in dark mode); the count carries
   **no opacity** (fading white to 85% drops lifestyle `#B45309` under 4.5:1); and the
   column counts are explicit with the 2-column rule upper-bounded at 899.98px —
   `auto-fit` stranded the ninth tile beside dead space, and an unbounded
   `:last-child:nth-child(odd)` span outranks any reset by specificity.

   `[TODO — no provider wired]`: there is still no newsletter provider. Nothing here
   pretends to submit, there are no fake success states, and the `mailto:` to the
   publisher's verified newsdesk address is the real contact path.

## Cards (`StoryCard` variants)

Every card: square, on white `1px solid var(--border)`, no shadow; image top (16:9,
`next/image`, exact `sizes`); **kicker** (section colour, 600 caps 0.75rem) →
**headline** (Archivo, 2-line clamp) → **meta row** (`--ink-3`: author · date ·
`{n} min read`). Hover: headline gets a 2px underline in the section colour; the image
does NOT zoom (no transforms beyond a border-colour change); the whole card is one link
(stretched-link pattern) with the headline as the accessible name. Never render the
headline twice (regression-guarded).

- `hero` — chrome-ground variant used in the hero band (borders `--chrome-rule`).
- `feature` — large: image + kicker + `--fs-card-l` headline + standfirst (2-line
  excerpt, `--ink-2`) + meta.
- `standard` — image + kicker + `--fs-card` headline + meta.
- `compact` — horizontal: 96px square thumb left, kicker + `--fs-card-s` headline right.
- `text` — **colour-block card**: whole card ground = section colour (light value),
  white Anton headline at oversized scale, white kicker, meta in white at 80% size.
  Used whenever `getFeaturedImage()` returns null, and deliberately as a rhythm-breaker
  (~every 5th card in long grids even when an image exists is NOT done — only for
  missing images; rhythm comes from size variation).

## Slider — native scroll-snap (`StorySlider`)

`div.rail` with `overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none`;
children `scroll-snap-align: start`. Works with JS disabled (it simply scrolls). Arrow
buttons (square, 1px border, ‹ ›) are the ONLY scripted part (a small client component):
they `scrollBy` one card width, hide entirely when content does not overflow, disable at
ends, and are `aria-hidden` from keyboard users (the rail itself is Tab-focusable with
`tabindex="0"`, `role="region"`, `aria-label="{title} stories"`, arrow-key scrollable via
native behaviour). `scroll-behavior: smooth` guarded by
`@media (prefers-reduced-motion: no-preference)`.

## Article page

Breadcrumb (Home / {Section} / title, `--ink-3`, section link in section colour) →
kicker (section colour) → H1 (Archivo 800, `--fs-h1`, max 18 words before truncation
is a content problem, never CSS-clamped) → standfirst (`--ink-2`, 1.25rem, 66ch) →
meta card (1px border strip: author 600, date + updated date, reading time, ShareRow
right-aligned) → featured image full column width with caption (`--ink-3`, 0.8125rem,
1px `--rule` top border) → body (66ch, sanitised): `h2` Archivo 700 1.5rem with a 24px
2px section-colour rule above; links `--accent` underlined; `ul` square bullets;
`blockquote` 4px section-colour left border, Archivo 500 1.25rem — all square, no fills.
→ tags row (bordered chips) → RelatedStories (3 standard cards, same section; render
nothing over filler) → MoreStories.

## Category page

Colour-owned: an H1 band with a big Anton title in the section colour + description +
post count; first page: 1 feature + grid of standards; pagination (bordered square
buttons, current = filled section colour).

## Accessibility

- Focus: every interactive element `outline: 2px solid var(--focus); outline-offset: 2px`
  — never removed, never colour-only.
- Skip link to `#content` (visually hidden until focused, then a white-on-chrome block).
- All text ≥4.5:1 (token table is pre-verified; do not introduce new colour pairs
  without checking).
- Kickers/colour are never the only carrier of meaning (section name is always text).
- `prefers-reduced-motion`: no smooth scroll, no transitions beyond color/border-color.
- Ticker pauses nothing (it does not animate — it is a static latest-headline link).
- Images: real `alt` from WP (`alt_text` → title fallback, ported helper); decorative
  squares `aria-hidden`.

## Interaction budget

Client components: theme toggle, slider arrows, mobile nav toggle, search form,
nav progress bar. Everything else server. Transitions: `color .15s, border-color .15s,
background-color .15s` only. No JS animation library.
