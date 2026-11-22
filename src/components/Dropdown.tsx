/**
 * Our own dropdown, in place of the browser's native <select> (which looks like
 * the system menu, not the app). A button showing the current choice opens a
 * list: a small panel under the button on desktop, a bottom sheet on phones (so
 * it isn't clipped by rows that scroll sideways, like Explore's filters). Matches
 * the Cost filter's look. Keyboard: ↑/↓, Home/End, Enter or Space to pick, Esc to
 * close, and typing a letter jumps to the first option starting with it.
 * Used by Explore's filter pills and Make a trail ("Getting here", "About how long").
 */

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export type DropdownOption = { value: string; label: string }

type DropdownProps = {
  value: string
  options: DropdownOption[]
  onChange: (value: string) => void
  /** Accessible name, e.g. "Category". Shown as the sheet's title on phones. */
  label: string
  /** Classes for the button (each place styles its own trigger). */
  buttonClassName?: string
  /** Panel width on desktop (default: at least the button's width). */
  panelClassName?: string
  /** Classes for the wrapper, e.g. "w-full" to let the button fill its column. */
  className?: string
  id?: string
}

export function Dropdown({ value, options, onChange, label, buttonClassName, panelClassName, className, id }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listId = useId()
  const selectedIndex = Math.max(
    options.findIndex((o) => o.value === value),
    0,
  )
  const current = options.find((o) => o.value === value) ?? options[0]

  // Close on a click outside.
  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // Focus the list when it opens, and keep the active option in view.
  useEffect(() => {
    if (!open) return
    listRef.current?.focus({ preventScroll: true })
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  function openList() {
    setActive(selectedIndex)
    setOpen(true)
  }

  function close(refocus = true) {
    setOpen(false)
    if (refocus) buttonRef.current?.focus()
  }

  function choose(index: number) {
    const option = options[index]
    if (option) onChange(option.value)
    close()
  }

  function onButtonKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      openList()
    }
  }

  function onListKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    const last = options.length - 1
    if (event.key === 'ArrowDown') setActive((i) => Math.min(i + 1, last))
    else if (event.key === 'ArrowUp') setActive((i) => Math.max(i - 1, 0))
    else if (event.key === 'Home') setActive(0)
    else if (event.key === 'End') setActive(last)
    else if (event.key === 'Enter' || event.key === ' ') choose(active)
    else if (event.key === 'Escape') close()
    else if (event.key === 'Tab') close(false)
    else if (event.key.length === 1 && /\S/.test(event.key)) {
      // Type-to-jump: the next option starting with that letter.
      const letter = event.key.toLowerCase()
      const order = [...options.slice(active + 1), ...options.slice(0, active + 1)]
      const hit = order.find((o) => o.label.toLowerCase().startsWith(letter))
      if (hit) setActive(options.indexOf(hit))
      return
    } else return
    event.preventDefault()
  }

  return (
    <div ref={rootRef} className={cn('relative inline-flex', className)}>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${label}: ${current?.label ?? ''}`}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onButtonKeyDown}
        className={cn('inline-flex cursor-pointer items-center justify-between gap-1.5 text-left', buttonClassName)}
      >
        <span className="min-w-0 truncate">{current?.label}</span>
        <ChevronDown aria-hidden className={cn('size-3.5 flex-none text-ink-2 transition-transform', open && 'rotate-180')} />
      </button>

      {open ? (
        <>
          {/* Phones: dim the page behind the sheet; tapping it closes. */}
          <div aria-hidden className="fixed inset-0 z-30 bg-ink/30 md:hidden" onClick={() => close(false)} />
          <div
            className={cn(
              'fixed inset-x-0 bottom-0 z-40 rounded-t-[var(--radius-sheet)] border-t border-line bg-white pt-3 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] shadow-[var(--shadow-sheet)]',
              'animate-in slide-in-from-bottom-4 fade-in duration-200 motion-reduce:animate-none',
              'md:absolute md:inset-x-auto md:top-full md:bottom-auto md:left-0 md:mt-1.5 md:min-w-full md:rounded-card md:border md:py-1 md:shadow-[var(--shadow-float)] md:slide-in-from-top-1',
              panelClassName,
            )}
          >
            <p className="m-0 px-4 pb-2 text-base font-bold text-ink md:hidden">{label}</p>
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              tabIndex={-1}
              aria-label={label}
              aria-activedescendant={`${listId}-${active}`}
              onKeyDown={onListKeyDown}
              className="m-0 max-h-[50dvh] list-none overflow-y-auto p-0 outline-none md:max-h-72"
            >
              {options.map((option, i) => {
                const selected = option.value === value
                return (
                  <li
                    key={option.value}
                    id={`${listId}-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(i)}
                    className={cn(
                      'flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-base whitespace-nowrap text-ink md:py-2 md:text-sm',
                      i === active && 'bg-paper',
                      selected && 'font-semibold',
                    )}
                  >
                    {option.label}
                    {selected ? <Check aria-hidden className="size-4 flex-none text-crumb-strong" /> : null}
                  </li>
                )
              })}
            </ul>
          </div>
        </>
      ) : null}
    </div>
  )
}
