/**
 * The white band of trail kinds under the landing hero ("Cafés / Arts / …").
 * Purely descriptive copy; the slashes are hidden from screen readers. Used by LandingPage.
 */

const KINDS = ['Cafés', 'Arts', 'Late-night food', 'Parks', 'Free stuff', 'Hidden corners', 'Bookstores', 'Harbor views']

export function CategoryStrip() {
  return (
    <section aria-label="Kinds of trails" className="overflow-hidden border-y border-line bg-white">
      <ul className="mx-auto flex max-w-[1264px] list-none flex-wrap items-center justify-center gap-x-7 gap-y-3.5 px-5 py-12 text-[clamp(26px,3.4vw,40px)] font-extrabold tracking-[-0.035em] sm:px-8">
        {KINDS.map((kind, i) => (
          <li key={kind} className="contents">
            {i > 0 ? (
              <span aria-hidden className="font-normal text-line-strong">
                /
              </span>
            ) : null}
            <span>{kind}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
