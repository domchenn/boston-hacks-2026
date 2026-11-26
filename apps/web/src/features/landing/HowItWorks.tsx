/**
 * "How it works" (#how): four numbered steps joined by a dotted line, each with a
 * static app snippet (example trails, not live data). Steps zigzag left/right from
 * 900 px up. Snippets are drawn at 440 px and scale down as a whole on narrow
 * screens with container query units (.lp-snippet, --u). The trail draws in dot by
 * dot as you scroll, numbers pop and steps rise in (useTrailScrollReveal). Used by LandingPage.
 */

import { useRef, type ReactNode } from 'react'
import { Camera, ChevronDown, Footprints, MapPin, Share2, Shuffle, Star, TramFront } from 'lucide-react'
import coffeePhoto from './assets/coffee.jpg'
import ducksPhoto from './assets/ducks.jpg'
import libraryPhoto from './assets/library.jpg'
import { useTrailScrollReveal } from './useTrailScrollReveal'

type StepProps = {
  n: number
  title: string
  children: ReactNode
  snippet: ReactNode
  alt?: boolean
  last?: boolean
}

function Step({ n, title, children, snippet, alt, last }: StepProps) {
  return (
    <li className={['lp-step', alt && 'lp-step--alt', last && 'lp-step--last'].filter(Boolean).join(' ')}>
      <div className="lp-step__text">
        <h3 className="m-0 text-[clamp(26px,3vw,34px)] leading-[1.1] font-extrabold tracking-[-0.035em]">{title}</h3>
        <p className="m-0 max-w-[38ch] text-[17px] leading-[1.6] text-ink-2">{children}</p>
      </div>
      <div className="lp-step__ring">
        <span
          aria-hidden
          className="lp-step__num inline-flex size-14 flex-none items-center justify-center rounded-full border-[2.5px] border-crumb bg-white text-[20px] font-extrabold"
        >
          {n}
        </span>
        {last ? null : <span className="lp-step__line" aria-hidden />}
      </div>
      <div className="lp-step__snippet-cell">
        <div className="lp-snippet">
          {snippet}
        </div>
      </div>
    </li>
  )
}

const FilledStar = ({ size }: { size: 'sm' | 'lg' }) => (
  <Star
    aria-hidden
    strokeWidth={0}
    className={`fill-ink ${size === 'sm' ? 'size-[calc(13*var(--u))]' : 'size-[calc(20*var(--u))]'}`}
  />
)

/** Eyebrow line used in every snippet: orange (or green) category, then muted details. */
function Eyebrow({ label, rest, done }: { label: string; rest: string; done?: boolean }) {
  return (
    <>
      <span className={`font-semibold ${done ? 'text-done' : 'text-crumb-strong'}`}>{label}</span>
      <span className="text-muted-foreground"> · {rest}</span>
    </>
  )
}

const DISCOVER_ROWS = [
  { label: 'Cafés', rest: 'Back Bay · @breadcrumb', title: 'Finals Week Study Sesh', end: '4.6', rated: true },
  { label: 'Arts', rest: 'Fenway · @dom', title: 'Matcha, the Fens and Free Thursday', end: '4.8', rated: true },
  { label: 'Parks', rest: 'Jamaica Plain · @maya', title: 'Arboretum golden hour', end: '0.8 mi', rated: false },
]

function DiscoverSnippet() {
  return (
    <>
      <div className="flex flex-wrap gap-[calc(6*var(--u))]">
        {['For you', 'Trending', 'Nearby', 'Friends'].map((tab) => (
          <span key={tab} className={`lp-snippet__chip ${tab === 'Trending' ? 'lp-snippet__chip--on' : ''}`}>
            {tab}
          </span>
        ))}
      </div>
      <div>
        {DISCOVER_ROWS.map((row) => (
          <div key={row.title} className="lp-snippet__row">
            <div className="flex min-w-0 flex-col gap-[calc(4*var(--u))]">
              <span className="text-[calc(12*var(--u))]">
                <Eyebrow label={row.label} rest={row.rest} />
              </span>
              <span className="truncate text-[calc(16*var(--u))] font-bold tracking-[-0.01em]">{row.title}</span>
            </div>
            <span className="inline-flex flex-none items-center gap-[calc(4*var(--u))] text-[calc(13*var(--u))] font-semibold text-ink-2">
              {row.rated ? <FilledStar size="sm" /> : null}
              {row.end}
            </span>
          </div>
        ))}
      </div>
    </>
  )
}

function PickPathSnippet() {
  return (
    <>
      <div className="flex flex-wrap gap-[calc(8*var(--u))]">
        {['Late night', 'North End', 'Under $15', 'Any length'].map((filter) => (
          <span
            key={filter}
            className={`lp-snippet__chip lp-snippet__chip--filter ${filter === 'North End' ? 'lp-snippet__chip--on' : ''}`}
          >
            {filter}
            <ChevronDown aria-hidden className="size-[calc(14*var(--u))]" />
          </span>
        ))}
      </div>
      <div className="lp-snippet__mini-card">
        <span className="text-[calc(13*var(--u))]">
          <Eyebrow label="Cafés" rest="Back Bay" />
        </span>
        <span className="text-[calc(18*var(--u))] font-bold tracking-[-0.02em]">Finals Week Study Sesh</span>
        <span className="inline-flex items-center gap-[calc(6*var(--u))] text-[calc(14*var(--u))] text-muted-foreground">
          <MapPin aria-hidden className="size-[calc(14*var(--u))]" />
          Tatte
        </span>
        <span className="text-[calc(14*var(--u))] font-semibold">~$8 · 2 hr</span>
      </div>
    </>
  )
}

function TransitLeg({ icon, dot, name, detail }: { icon: ReactNode; dot: string; name: string; detail: string }) {
  return (
    <div className="flex items-center gap-[calc(12*var(--u))]">
      <span className="lp-snippet__leg-icon">{icon}</span>
      <span className="flex flex-col gap-[calc(2*var(--u))]">
        <span className="inline-flex items-center gap-[calc(8*var(--u))] text-[calc(15*var(--u))] font-semibold">
          <span className={`size-[calc(9*var(--u))] flex-none rounded-full ${dot}`} />
          {name}
        </span>
        <span className="text-[calc(13*var(--u))] text-muted-foreground">{detail}</span>
      </span>
    </div>
  )
}

function GetOutThereSnippet() {
  const legIcon = 'size-[calc(18*var(--u))]'
  return (
    <>
      <div className="flex justify-between text-[calc(13*var(--u))]">
        <span className="font-semibold text-done">2 of 3 crumbs</span>
        <span className="text-muted-foreground">Stop 2 of 3</span>
      </div>
      <div className="lp-snippet__bar">
        <span className="w-[66%]" />
      </div>
      <TransitLeg icon={<Footprints aria-hidden className={legIcon} />} dot="bg-crumb" name="Walk" detail="6 min · to the Public Garden" />
      <TransitLeg
        icon={<TramFront aria-hidden className={legIcon} />}
        dot="bg-[var(--line-green)]"
        name="Green Line"
        detail="4 min · Arlington → Copley"
      />
      <div className="flex items-center gap-[calc(10*var(--u))] border-t border-line pt-[calc(14*var(--u))]">
        <span className="inline-flex items-center gap-[calc(8*var(--u))] text-[calc(15*var(--u))]">
          <span className="size-[calc(10*var(--u))] flex-none rounded-full bg-crumb" />
          <span>
            <strong>Crumb:</strong> count the ducks
          </span>
        </span>
        <span className="ml-auto inline-flex items-center gap-[calc(6*var(--u))] text-[calc(13*var(--u))] text-muted-foreground">
          <Camera aria-hidden className="size-[calc(15*var(--u))]" />
          3 photos
        </span>
      </div>
    </>
  )
}

function LeaveYourMarkSnippet() {
  const actionIcon = 'size-[calc(17*var(--u))]'
  return (
    <>
      <span className="text-[calc(13*var(--u))]">
        <Eyebrow label="Cafés · Finished" rest="Back Bay" done />
      </span>
      <span className="-mt-[calc(8*var(--u))] text-[calc(18*var(--u))] font-bold tracking-[-0.02em]">Finals Week Study Sesh</span>
      <div className="flex items-center gap-[calc(10*var(--u))]">
        <span className="inline-flex gap-[calc(3*var(--u))]">
          {[1, 2, 3, 4, 5].map((i) => (
            <FilledStar key={i} size="lg" />
          ))}
        </span>
        <span className="text-[calc(14*var(--u))] text-ink-2">You rated 5</span>
      </div>
      <div className="flex gap-[calc(8*var(--u))]">
        <img className="lp-snippet__photo" src={coffeePhoto} alt="Iced coffee held up against a brick wall" />
        <img className="lp-snippet__photo" src={ducksPhoto} alt="Two ducks swimming among fallen leaves" />
        <img className="lp-snippet__photo" src={libraryPhoto} alt="Green reading lamps in the Boston Public Library reading room" />
      </div>
      <div className="flex flex-wrap gap-[calc(8*var(--u))]">
        <span className="lp-snippet__action">
          <Share2 aria-hidden className={actionIcon} />
          Share
        </span>
        <span className="lp-snippet__action">
          <Shuffle aria-hidden className={actionIcon} />
          Remix trail
        </span>
      </div>
    </>
  )
}

export function HowItWorks() {
  const stepsRef = useRef<HTMLOListElement>(null)
  useTrailScrollReveal(stepsRef)

  return (
    <section id="how" className="mx-auto flex max-w-[1264px] scroll-mt-4 flex-col gap-24 px-5 py-28 sm:px-8 sm:py-40">
      <h2 className="m-0 text-center text-[clamp(40px,6vw,72px)] leading-none font-extrabold tracking-[-0.05em]">
        Find a trail.
        <br />
        Follow the crumbs.
      </h2>
      <ol ref={stepsRef} className="m-0 list-none p-0">
        <Step n={1} title="Discover" snippet={<DiscoverSnippet />}>
          Find your next adventure through trails created by people who know the city. Explore what's trending, what's nearby,
          or what your friends are up to.
        </Step>
        <Step n={2} title="Pick your path" snippet={<PickPathSnippet />} alt>
          Filter by vibe, neighborhood, budget, or time. Whether it's a spontaneous late-night run or a full afternoon of
          exploring, there's a trail for it.
        </Step>
        <Step n={3} title="Get out there" snippet={<GetOutThereSnippet />}>
          Follow your trail stop by stop. Check transit, explore new places, snap photos, and keep track of every crumb along
          the way.
        </Step>
        <Step n={4} title="Leave your mark" snippet={<LeaveYourMarkSnippet />} alt last>
          Rate your experience, share your photos, or remix a trail into something new. Your next adventure might become
          someone else's favorite.
        </Step>
      </ol>
    </section>
  )
}
