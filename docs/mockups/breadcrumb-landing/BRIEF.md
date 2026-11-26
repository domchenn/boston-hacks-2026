# Breadcrumb landing page: build brief

Build the Breadcrumb marketing landing page from the design in this folder.

## Source of truth

- `index.html`: the finished design (landing page v6). It is a single static page with inline styles. Match it closely: layout, spacing, type sizes, colors and copy.
- `docs/STYLE_GUIDE.md`: the design system (colors, type, radii, the dotted trail, component rules). Use it for anything the design doesn't show, and map the design's raw hex values to these tokens.
- `assets/`: the photos, the crumb logo (`logo-mark.svg`) and the favicons.

## Fill these in

- **Stack:** [e.g. Next.js + Tailwind / React + Vite / plain HTML]
- **Where it goes in the repo:** [e.g. `app/page.tsx` or `src/pages/Landing.tsx`]
- **Sign up link:** [e.g. `/signup`] (currently `#signup`)
- **Log in link:** [e.g. `/login`] (currently `#login`)
- **"Start a trail" and "Start trail" links:** [e.g. `/explore`] (currently `#start`)

## Build notes

- Turn the inline styles into the project's styling approach (Tailwind classes or CSS modules) using the tokens from the style guide. Don't keep the inline `style=""` attributes.
- Split the page into components: Header, Hero (with the phone mockup), Category strip, How it works (4 steps), Trail map section, Closing CTA, Footer.
- The phone in the hero is built from HTML, not an image. Keep it as a component; the screen inside is a mock of the app's "Trails for you" feed.
- **How it works:** the dotted line is a repeating radial-gradient background so it stays round at any height. Each step's app snippet scales down as a whole on narrow screens using container query units (`cqw`). Keep that behavior.
- **Trail map section:** the map is an SVG laid back with CSS 3D transforms (`perspective`, `rotateX`, `rotateZ`). The stop markers and labels sit on top in percentages of the map box, so they line up at any width. Keep the map box's aspect ratio fixed.
- Use Inter from Google Fonts (or `next/font`), weights 400–800.
- Keep the alt text on the three photos and the `aria-label`s on the map and phone.
- Lucide icons are drawn inline in the design. Swap them for `lucide-react` if the project uses it.

## Polish to fix while building

- **Mobile header:** at phone width the nav wraps and "Sign up" drops to a second line. Collapse "How it works" and "Trails" into a menu, or hide them, below ~600px.
- **Mobile hero:** the tilted phone runs slightly past the right edge at 390px wide. Scale it down or reduce the tilt on small screens.
- **Not affiliated with the MBTA:** keep the footer line.

## Done when

- The page matches `index.html` at 1440px, 1024px and 390px wide.
- All buttons go to the real routes above.
- Lighthouse accessibility score is 95 or higher; every interactive element shows the style guide's blue focus ring.
