# breadcrumb style guide (v1.0 · "Dotted trail")

The visual system for our BostonHacks 2026 app (track: *Bos(tons) of Eats and Streets*). Open **`style-guide.html`** to see everything live, including both core screens built from the real classes. The trail renderer is an ES module, so serve the folder instead of double-clicking the file:

```powershell
python -m http.server 5178 --directory docs
```

Then open http://localhost:5178/style-guide.html.

| File | What it is |
|---|---|
| `styles/tokens.css` | Every color, type size, radius, shadow and trail measurement as a CSS variable |
| `styles/components.css` | Component classes (cards, trail, tabs, tab bar, sheet, stop list, buttons) |
| `styles/tailwind.config.snippet.js` | The same tokens for Tailwind v4 (`@config`) or v3 |
| `styles/map-style.json` | Warm, quiet Google Maps style |
| `tools/trail.js` | Draws the dotted trail on cards (`trailSVG`, `mountTrails`) |
| `tools/build_assets.py` | Regenerates `assets/svg/` |
| `mockups/` | Mobile and web screen mockups in this style (see `mockups/README.md`) |
| `archive/boston-bound/` | The previous system (T vehicles, Bluebikes, line pills), kept for reference. `mockup.html` still uses it |

> **Naming.** The app is **Breadcrumb**. These mockups call an outing a **trail** and a checklist item a **crumb**. The PRD still calls them a *sidequest* and a *checkpoint*. They map one to one: trail = sidequest, stop = `sidequest_stops`, crumb = `checklist_items`, Start trail = Start quest.

## Direction

Every outing is a **trail**: stops joined by a dotted line, with small tasks called **crumbs** along the way. The look is calm and editorial:

- Warm paper background, white cards with hairline borders, near-black type.
- **One accent, crumb orange,** for trails, the primary action and orange labels.
- Blue and green appear only as **status**: scheduled and finished.
- Soft radii and low, warm shadows. Nothing tilted, outlined thick or hard-shadowed.
- One type family (Inter). Hierarchy comes from size and weight, not color.

## 1. Color

### Core

| Token | Hex | Use | Text on it |
|---|---|---|---|
| `--color-paper` | `#F7F6F2` | App background, bottom sheets | Ink 16:1 |
| `--color-white` | `#FFFFFF` | Cards, tabs, buttons, tab bar | Ink 17.5:1 |
| `--color-ink` | `#1B1916` | Type, the selected filter tab, active tab bar item | White 17.5:1 |
| `--color-crumb-strong` | `#C2410C` | Orange text (eyebrows), primary button, + button | White 5.2:1 |
| `--color-crumb` | `#E8552D` | **Trail dots and rings only.** Never text (3.6:1) | — |
| `--color-blue` | `#1D4ED8` | Scheduled trails: "Sat 2:00 PM", "Going", "Join" | White 6.7:1 |
| `--color-green` | `#15803D` | Finished trails, done crumbs, done stops | White 5.0:1 |

### Text, lines, surfaces

| Token | Hex | Use |
|---|---|---|
| `--color-ink-2` | `#57534C` | Secondary text: stats on the sheet, subtitles (7.1:1 on paper) |
| `--color-muted` | `#736E66` | Meta: distance, head count, addresses, stop labels (4.7:1 on paper) |
| `--color-line` | `#E7E4DD` | Card borders, dividers, tab bar top edge |
| `--color-line-strong` | `#D6D2C8` | Unselected filter tab outline, inputs, secondary button |
| `--color-sand` | `#EFEDE6` | Map land, skeleton loaders, sunken fills |
| `--color-crumb-deep` | `#9A3412` | Hover and pressed state of orange buttons |

Tints (`--color-crumb-tint`, `--color-blue-tint`, `--color-green-tint`) are soft backgrounds for badges and selected rows, always with ink or the matching strong color as text. `--color-crumb-pale` and `--color-crumb-soft` were the first two dots of the old logo. The current logo is a single crumb orange (section 9), so don't use them for the brand. Map colors: `--map-land`, `--map-park`, `--map-water`, `--map-road`, `--map-label`.

MBTA line colors (`--line-red`, `--line-orange`, `--line-green`, `--line-blue`, `--line-silver`) appear **only** as a 9 px dot beside a transit step (`.line-dot`), like "● Green Line, Arlington → Copley". Cards are never colored by line or category.


### Transit colors on trails

Trail dots and stop circles take the color of how you travel (source: `src/lib/transitColors.ts`):

| Leg | Color |
|---|---|
| Walking | crumb orange `#E8552D` (the default trail color) |
| T | the line's MBTA color: Red `#DA291C`, Orange `#ED8B00`, Blue `#003DA5`, Green `#00843D`, Silver `#7C878E`, Commuter Rail `#80276C` |
| Bus | MBTA bus yellow, darkened for contrast `#E5A800` (not orange, so it isn't mistaken for the Orange Line) |
| Bike (Bluebikes) | Bluebikes blue `#1E88E5` (lighter than the Blue Line) |

- **Cards:** feed cards no longer draw a dotted line (see the trail card in section 5). `primary_line` sets Map tab pin colors and train-leg colors on routes and stop lists. It also feeds the detail page's good-to-know section and badges.
- **Stop lists:** set `--leg-color` on a `.stop`; its ring and the dots down to the next stop use that leg's color. Finished stops still turn green.
- **Maps:** each part of a route is drawn in its own color (walk, the actual T line from Google, bus, bike), and each stop circle in the color of the leg that arrives there.
## 2. Typography

**Inter** (Google Fonts, variable weight 400–800). Sizes are CSS px on a 390 px-wide phone.

| Role | Token | Size / weight | Tracking |
|---|---|---|---|
| Page title ("Trails for you") | `--text-3xl` | 32 / 800 | −0.035em |
| Detail title | `--text-2xl` | 28 / 800 | −0.035em |
| Card title, wordmark | `--text-xl` | 21 / 700 | −0.02em |
| Stop name | `--text-lg` | 17 / 700 | 0 |
| Subtitle, button label | `--text-md` | 16 / 400, 700 | 0 |
| Body, stats, tabs, crumbs | `--text-base` | 15 / 400–600 | 0 |
| Eyebrow, meta, address | `--text-sm` | 13 / 600, 400 | 0 |
| Stop labels under a trail | `--text-xs` | 12 / 400 | 0 |
| Tab bar labels | `--text-2xs` | 11 / 500 (700 when active) | 0 |

- The **eyebrow** ("Cafés · Anytime") is the only colored text. Its color comes from the trail's status.
- Stats are written short and plain: `~$20 · 2 hr · 2 crumbs · ★ 4.6`. Use `~` for estimates, and "Free" when it costs nothing.

## 3. Shape, space, depth

- **Spacing:** 4 px base (`--space-1` … `--space-16`). Screen gutter is 16 px, cards are 12 px apart, and trail cards have 20 px padding on every side (`p-5`).
- **Radii:** `--radius-sm` 10 · `--radius-md` 14 · `--radius-card` 20 · `--radius-sheet` 24 (top corners) · `--radius-pill` for tabs, buttons and icon buttons.
- **Shadows:** `--shadow-card` (barely there, always with a hairline border) · `--shadow-float` (buttons over the map) · `--shadow-sheet` (bottom sheet) · `--shadow-fab` (the + button, the only raised element).
- **Focus:** a 3 px blue ring (`--focus-ring`) on every interactive element.

## 4. The dotted trail

The signature element. It's the same drawing everywhere a route appears: cards, the map, the stop list and dividers.

| Part | Spec |
|---|---|
| Dots | 3 px round dots every 8.5 px: `stroke-width: 3; stroke-linecap: round; stroke-dasharray: 0 8.5` in `--color-crumb` |
| Stop ring (cards) | r 7.5, white fill, 2.5 px `--color-crumb` stroke |
| Numbered ring (lists, map) | 28 px circle, 2.5 px orange border, number in 13 / 700 ink (`.num-ring`) |
| Path | Gentle alternating humps and dips between evenly spaced stops, ±9 px |
| Finished | Green path, filled green end points only, no middle rings |
| Vertical (stop list) | Dots between numbered rings, drawn with a radial-gradient background so they're round in every browser |

**On cards**, `tools/trail.js` draws the SVG at the container's real width, so dots and rings never stretch:

```html
<div class="trail" style="--stops:3">
  <div class="trail__line" data-trail data-stops="3" data-seed="0"></div>
  <div class="trail__labels"><span>Tatte</span><span>Public Garden</span><span>Newbury St</span></div>
</div>
<script type="module">import { mountTrails } from "./tools/trail.js"; mountTrails();</script>
```

`data-state="done"` gives the finished style. `data-seed` varies the wave so neighboring cards don't look identical. In React, copy `trailSVG` into `src/lib/trail.ts` and render it at a measured width:

```tsx
function Trail({ stops, state = "open", seed = 0 }: { stops: number; state?: "open" | "done"; seed?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(ref.current!);
    return () => ro.disconnect();
  }, []);
  return <div ref={ref} className="trail__line"
    dangerouslySetInnerHTML={{ __html: width ? trailSVG({ width, stops, state, seed }) : "" }} />;
}
```

**On Google Maps**, draw the route as a dotted polyline: an invisible stroke plus a repeated circle symbol.

```js
new google.maps.Polyline({
  map, path,
  strokeOpacity: 0,
  icons: [{
    icon: { path: google.maps.SymbolPath.CIRCLE, scale: 1.6, fillColor: "#E8552D", fillOpacity: 1, strokeOpacity: 0 },
    offset: "0", repeat: "9px",
  }],
});
```

## 5. Components (`styles/components.css`)

| Class | What it is |
|---|---|
| `.app` | Screen base: Inter, paper background, ink text |
| `.brand` + `.brand__mark` | Logo mark (`logo-mark.svg`) + "breadcrumb" in 21 / 800 |
| `.app-bar` | Brand on the left, `.icon-btn` (search) on the right |
| `.icon-btn` | 44 px round white button with a hairline border. `--float` (no border, float shadow) goes over the map. `.is-on` fills a saved bookmark |
| `.page-head`, `.page-title`, `.page-sub` | "Trails for you" / "You've lived here. Have you explored it?" |
| `.tabs` > `.tab` | Filter pills. Selected (`.is-active` or `aria-selected="true"`) is solid ink. The row scrolls sideways |
| `.feed` | The card list: 12 px gaps, gutter padding |
| `.trail-card` | White card with a minimal layout, built by `src/components/TrailCard.tsx`. See "Trail card" below |
| `.trail-card--done` | Green eyebrow that reads "… · Finished". (`--scheduled` remains in the CSS, but the app no longer shows dates) |
| `.trail`, `.trail__line`, `.trail__labels` | The dotted trail (section 4). `--stops` sets the label columns |
| `.rating` | Filled Lucide `star` + number, e.g. `★ 4.6 (12)` |
| `.tabbar`, `__item`, `__fab` | Explore · Map · **+** · Saved · You. Active item is ink and bold. The + is a 54 px orange circle, raised 20 px |
| `.map-hero` + `__bar` | Top of the detail screen: the map, with floating back and save buttons |
| `.sheet`, `__title`, `__stats` | Paper bottom sheet that overlaps the map by 24 px |
| `.stops` > `.stop` | Numbered ring + `__name`, `__place`, `.crumb-item`, `__leg` (walk or transit step), with dots down to the next stop |
| `.num-ring` | Numbered stop. `--current` (orange fill, next stop during a run), `--done` (green with a check), `--map` (adds a float shadow for map markers) |
| `.crumb-item` | Orange bullet + "**Crumb:** find the Make Way for Ducklings statues". `.is-done` turns it green and muted |
| `.line-dot` | 9 px MBTA line-color dot. Set `--line: var(--line-green)` |
| `.btn` | 52 px orange pill (`--lg` 56, `--sm` 38, `--block` full width). Variants: `--secondary` (white, outlined), `--ink`, `--ghost`. Disabled is flat gray |
| `.action-bar` | Sticky bottom area for "Start trail", fading into paper |

**Rules for components**

- **One orange button per screen** ("Start trail", "Join"). Everything else is secondary, ink or ghost.
### Trail card (minimal)

The feed card is kept minimal so the list is quick to scan. It has no dotted trail, dates or line colors. From top to bottom:

| Row | Content |
|---|---|
| Head | Eyebrow: the category (or the creator's own name for "other") in status color, then ` · ` and the neighborhood (or "0.4 mi away" on Nearby) in muted text. `@username` sits on the right in muted text, truncated to at most 45% of the width |
| Title | 21 / 700, at most 2 lines (`line-clamp-2`), 12 px below the head |
| Start | Map-pin icon + the first stop's name in muted 14 px, on one truncated line, 12 px below the title |
| Bottom | Cost · time in 14 / 600, a **"N stops ▾"** toggle, and on the right either ★ average or "In progress". Unrated trails show nothing on the right (no "New"). The row is pinned to the bottom of the card (`mt-auto`) so the stats line up across a grid row |
| Path (opens from the toggle) | A hairline divider, then the numbered stop list (`.stops` with 22 px `.num-ring`s). It's closed by default. It shows at most 160 px of stops, then scrolls with a hidden scrollbar and a fade at the bottom while more stops are below |

- **States:** Default (orange eyebrow) · In progress (blue "In progress" on the right) · Finished (green eyebrow "Cafés · Finished", `.trail-card--done`).
- **Clicking:** the title link stretches over the whole card, so a click anywhere opens `/trails/:id`. The stops toggle sits above it (`relative z-10`) and only opens or closes the path.
- **Hover:** the card shadow gets a little deeper. Focus shows `--focus-ring` around the card. **Selected** (its pin is highlighted on the Map tab): ink border plus a 1 px ink ring.
- The stop names come from the feed when it has them. Otherwise the card loads them with `getTrail()` the first time the toggle is opened.

## 6. Screens

**For You (Explore tab):** status bar → app bar → page title + subtitle → filter tabs (For you · Nearby · Friends) → feed of trail cards → tab bar.

**Trail detail:** map hero (300 px, dotted route with numbered rings, floating back and save) → sheet: eyebrow ("Cafés · Anytime · Curated") → title → stats → stop list with crumbs and the walk or transit step between stops → sticky **Start trail**.

During a run, reuse the stop list: finished stops get `.is-done` + `.num-ring--done`, and the next stop gets `.num-ring--current`.

## 7. Google Maps (`styles/map-style.json`)

- Warm and quiet: sand land, pale green parks, pale blue water, off-white roads without outlines, muted labels. POIs, bus stops and road icons are hidden, and transit lines are a faint gray, so our orange trail is the only strong color.
- Usage: `new google.maps.Map(el, { styles: mapStyle, disableDefaultUI: true, zoomControl: true })`.
- JSON `styles` only apply **without** a `mapId`. Advanced Markers need a `mapId`, so if you use them, paste this JSON into the Cloud Console style editor instead. Marker content: `<span class="num-ring num-ring--map">1</span>`.
- Directions: `TRANSIT` (subway, train, tram, bus), `WALKING` and `BICYCLING` legs. Never `DRIVING`.

## 8. Icons

- **[Lucide](https://lucide.dev)** (ISC). Use `lucide-react` in the app. The style guide loads `lucide@0.460.0`.
- 2 px stroke, `currentColor`, 20 px in buttons, 22 px in the tab bar, 15 px inline.
- Core set: `compass` `map` `plus` `bookmark` `user` · `search` `chevron-left` `star` (filled) · `footprints` `train-front` `bike` · `check` `x` `user-plus` `share-2`.

## 9. Assets (`assets/svg/`)

| File | Use |
|---|---|
| `logo-mark.svg` | Three hand-cut crumbs in different sizes: a large one at the bottom left, a medium one at the top right and a small one at the bottom right. Solid crumb orange (`#E8552D`), with soft, uneven edges. In the app bar it sits 25 px wide next to the "breadcrumb" wordmark (`BrandLogo`) |
| `public/favicon.svg` | The browser-tab favicon: the same three crumbs in white on a crumb-orange rounded square (corner radius about 23% of the width) |
| `app-icon.svg` | Older home-screen icon (three round dots on dark orange). It still uses the previous mark, so match it to the favicon before using it |
| `stop-ring.svg`, `stop-done.svg`, `stop-number.svg` | Static stop markers (use `.num-ring` for live numbers) |
| `trail-divider.svg` | Section breaks and onboarding |
| `empty-trail.svg` | Empty states: a trail waiting for its next stop. Pair it with one heading, one sentence and one button |

**Logo rules:** use the crumbs exactly as drawn, without stretching, re-coloring them per line, or adding outlines or shadows. Use crumb orange on white or paper, and white on crumb orange.

Regenerate them from the repo root with `python docs/tools/build_assets.py docs/assets/svg`.

## 10. Do and don't

| Do | Don't |
|---|---|
| Draw every route as dots between rings | Draw solid lines or arrows for routes |
| Keep orange as the only accent | Color cards by category or T line |
| Use `--color-crumb-strong` for orange text | Set text in `--color-crumb` (dots and rings only) |
| Use blue only for scheduled and green only for finished | Use blue or green as decoration |
| Use soft shadows and hairline borders | Use hard offset shadows, tilts or thick outlines (the old Boston Bound look) |
| Keep one orange button per screen | Stack several orange buttons |
| Write plain, warm copy: "Start trail", "2 crumbs", "You rated 5" | Use gamer or quest jargon in the UI |
| Show transit with a small line-color dot | Use the MBTA "T" logo or official map art |

## 11. Attribution and licensing

- **Artwork:** every file in `assets/svg/` was drawn for this project.
- **Font:** Inter, from Google Fonts, under the SIL Open Font License 1.1.
- **Icons:** Lucide, ISC license (keep its notice if you bundle it).
- **Trademarks:** MBTA line names and colors only identify transit lines. We aren't affiliated with or endorsed by the MBTA. Place names (Tatte, Public Garden) are used descriptively.
- **Map data:** Google Maps requires its own attribution. Keep the default logo and copyright.
