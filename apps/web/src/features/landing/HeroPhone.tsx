/**
 * The tilted iPhone in the landing hero, built from HTML (not an image). Its screen
 * is a static mock of the app's "Trails for you" feed: example trails, not live data.
 * Styled by .lp-phone in landing.css; the phone shrinks and tilts less on phones.
 * Used by LandingHero.
 */

import { Bookmark, ChevronDown, Compass, MapIcon, MapPin, Plus, Search } from 'lucide-react'
import { CrumbMark } from './CrumbMark'

const FEED_TABS = ['For you', 'Trending', 'Nearby', 'Friends']
const FILTERS = ['Any category', 'Any neighborhood', 'Any cost']
const EXAMPLE_TRAILS = [
  { category: 'Arts', where: 'Fenway', by: 'dom', title: 'Matcha, the Fens and Free Thursday at the Gardner', start: 'James P. Kelleher Rose Garden', stats: '~$8 · 3.5 hr', stops: 4 },
  { category: 'Food', where: 'North End', by: 'breadcrumb', title: 'Finals Week Midnight Run', start: 'Haymarket', stats: '~$12 · 2 hr', stops: 3 },
]

/** One example card, the app's minimal trail card at 80% scale. */
function PhoneTrailCard({ trail }: { trail: (typeof EXAMPLE_TRAILS)[number] }) {
  return (
    <div className="flex flex-col rounded-[16px] border border-line bg-white p-4 text-left shadow-[0_1px_2px_rgba(27,25,22,0.04)]">
      <div className="flex justify-between gap-2.5 text-[10.4px]">
        <span>
          <span className="font-semibold text-crumb-strong">{trail.category}</span>
          <span className="text-muted-foreground"> · {trail.where}</span>
        </span>
        <span className="max-w-[45%] truncate text-muted-foreground">@{trail.by}</span>
      </div>
      <div className="mt-[9.6px] text-[16.8px] leading-[1.2] font-bold tracking-[-0.02em]">{trail.title}</div>
      <div className="mt-[9.6px] flex items-center gap-1.5 overflow-hidden text-[11.2px] whitespace-nowrap text-muted-foreground">
        <MapPin aria-hidden className="size-3 shrink-0" />
        <span className="truncate">{trail.start}</span>
      </div>
      <div className="mt-[12.8px] flex items-center gap-[14.4px] text-[11.2px]">
        <span className="font-semibold">{trail.stats}</span>
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          {trail.stops} stops <ChevronDown aria-hidden className="size-3" />
        </span>
      </div>
    </div>
  )
}

function PhoneTab({ icon: Icon, label, active }: { icon: typeof Compass; label: string; active?: boolean }) {
  return (
    <span className={`flex w-[52px] flex-col items-center gap-[3px] text-[10px] ${active ? 'font-bold text-ink' : 'font-medium text-muted-foreground'}`}>
      <Icon aria-hidden className="size-[21px]" />
      {label}
    </span>
  )
}

export function HeroPhone() {
  return (
    <div className="lp-phone-scale">
      <div className="lp-phone">
        <span className="lp-phone__button lp-phone__button--left top-[150px] h-[34px]" />
        <span className="lp-phone__button lp-phone__button--left top-[200px] h-[58px]" />
        <span className="lp-phone__button lp-phone__button--left top-[270px] h-[58px]" />
        <span className="lp-phone__button lp-phone__button--right top-[220px] h-[88px]" />
        <div role="img" aria-label="The Breadcrumb app on an iPhone, showing the Trails for you feed" className="lp-phone__body">
          <div className="lp-phone__screen">
            <span aria-hidden className="lp-phone__glare" />
            <span className="lp-phone__island" />

            <div className="flex items-center justify-between border-b border-line bg-white px-4 pt-[52px] pb-3">
              <span className="inline-flex items-center gap-2">
                <CrumbMark size={22} />
                <span className="text-[19px] font-extrabold tracking-[-0.03em]">breadcrumb</span>
              </span>
              <span className="inline-flex size-[38px] items-center justify-center rounded-full border border-line">
                <Search aria-hidden className="size-[18px]" />
              </span>
            </div>

            <div className="px-4 pt-[18px]">
              <div className="text-[27px] font-extrabold tracking-[-0.035em]">Trails for you</div>
              <div className="mt-1 text-[14px] text-ink-2">Can't sleep? Pick your next adventure.</div>
            </div>
            <div className="flex gap-1.5 overflow-hidden px-4 pt-3.5">
              {FEED_TABS.map((tab, i) => (
                <span
                  key={tab}
                  className={`inline-flex h-[38px] flex-none items-center rounded-full px-4 text-[15px] font-semibold ${i === 0 ? 'bg-ink text-white' : 'border border-line-strong bg-white'}`}
                >
                  {tab}
                </span>
              ))}
            </div>
            <div className="flex gap-1.5 overflow-hidden px-4 pt-2.5">
              {FILTERS.map((filter) => (
                <span
                  key={filter}
                  className="inline-flex h-[34px] flex-none items-center gap-1.5 rounded-full border border-line-strong bg-white pr-3 pl-3.5 text-[13px] text-ink-2"
                >
                  {filter}
                  <ChevronDown aria-hidden className="size-3.5" />
                </span>
              ))}
            </div>
            <div className="flex flex-col gap-2.5 px-4 pt-4">
              {EXAMPLE_TRAILS.map((trail) => (
                <PhoneTrailCard key={trail.title} trail={trail} />
              ))}
            </div>

            <div className="absolute inset-x-0 bottom-0 flex h-[74px] items-start justify-around border-t border-line bg-white pt-[9px]">
              <PhoneTab icon={Compass} label="Explore" active />
              <PhoneTab icon={MapIcon} label="Map" />
              <span className="flex w-[52px] justify-center">
                <span className="-mt-[26px] inline-flex size-12 items-center justify-center rounded-full bg-crumb-strong text-white shadow-[0_6px_16px_rgba(194,65,12,0.35)]">
                  <Plus aria-hidden className="size-[22px]" />
                </span>
              </span>
              <PhoneTab icon={Bookmark} label="Saved" />
              <span className="flex w-[52px] flex-col items-center gap-[3px] text-[10px] font-medium text-muted-foreground">
                <span className="inline-flex size-[21px] items-center justify-center rounded-full bg-done text-[11px] font-semibold text-white">G</span>
                You
              </span>
              <span className="absolute bottom-[7px] left-1/2 -ml-[58px] h-1 w-[116px] rounded bg-ink" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
