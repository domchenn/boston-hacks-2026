/**
 * The line under "Trails for you" on Explore: a short greeting that changes with
 * the time of day (and weekends), so the page feels a little different each
 * visit. Each time slot has a few lines; which one shows rotates by day, so it's
 * stable while you browse but changes tomorrow. Adds your first name when known.
 * No facts or numbers in here, just encouragement. Used by ExplorePage.
 */

type Slot = { from: number; to: number; lines: string[]; weekend?: string[] }

// Hours are local time, [from, to).
const SLOTS: Slot[] = [
  {
    from: 5,
    to: 10,
    lines: ['Early start. Coffee first, then somewhere new?', 'Morning! Fresh day, fresh corner of the city.', 'Up early? The city’s yours.'],
    weekend: ['Slow weekend-morning energy. Where to?', 'Weekend morning. No plans is a plan.'],
  },
  {
    from: 10,
    to: 12,
    lines: ['Good morning. Where to today?', 'Late morning, wide open day.', 'Ready to wander?'],
    weekend: ['Brunch, then a trail?', 'A whole weekend day ahead. Make it count.'],
  },
  {
    from: 12,
    to: 14,
    lines: ['Long lunch? There’s a trail for that.', 'Midday break. Go somewhere you haven’t been.', 'Lunch hour, explorer hour.'],
  },
  {
    from: 14,
    to: 17,
    lines: ['Afternoon free? Find a new favorite spot.', 'Done with class? Go get a little lost.', 'Golden hour’s coming. Head out.'],
    weekend: ['Lazy afternoon? Turn it into a trail.', 'Weekend afternoon. Pick a line and ride it.'],
  },
  {
    from: 17,
    to: 21,
    lines: ['Good evening. Somewhere new before dinner?', 'Evening plans? We’ve got ideas.', 'Sun’s going down. Your trail’s just starting.'],
    weekend: ['Big night ahead? Start it with a trail.', 'Weekend evening. Round up your friends.'],
  },
  {
    from: 21,
    to: 24,
    lines: ['Still out? Some trails go late.', 'Evening’s young. Where next?', 'Late plans? Find a spot that’s still open.'],
  },
  {
    from: 0,
    to: 5,
    lines: ['Up late? Plan tomorrow’s trail.', 'Can’t sleep? Pick your next adventure.', 'Burning the midnight oil? Save a trail for later.'],
  },
]

/** Day number since the epoch in local time, so the pick changes at midnight. */
function dayNumber(now: Date) {
  return Math.floor((now.getTime() - now.getTimezoneOffset() * 60_000) / 86_400_000)
}

export function exploreGreeting(now: Date = new Date(), firstName?: string | null): string {
  const hour = now.getHours()
  const weekend = now.getDay() === 0 || now.getDay() === 6
  const slot = SLOTS.find((s) => hour >= s.from && hour < s.to) ?? SLOTS[1]
  const lines = weekend && slot.weekend ? [...slot.weekend, ...slot.lines] : slot.lines
  const line = lines[dayNumber(now) % lines.length]
  if (!firstName) return line
  // "Good morning. Where to today?" → "Good morning, Dom. Where to today?"
  const firstStop = line.search(/[.!?]/)
  return firstStop > 0 && firstStop < 24 ? `${line.slice(0, firstStop)}, ${firstName}${line.slice(firstStop)}` : line
}
