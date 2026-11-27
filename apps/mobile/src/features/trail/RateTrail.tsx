/**
 * Rate a finished trail (Mobile-Finished mockup): "Trail finished", the title, stops and
 * crumbs done, "How was it?" with four 1–5 star questions (same words as the website's
 * ratingQuestions.ts), an optional note, then Post review or Skip for now. An existing
 * rating pre-fills it. Used at the end of the active trail and by /trail/:id/rate.
 */
import { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Star } from 'lucide-react-native'
import { MAX_REVIEW_LENGTH, type RatingBody, type TrailDetail } from '@breadcrumb/contracts'
import { AppText } from '@/components/AppText'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { api } from '@/lib/api'
import { tapLight, tapSuccess } from '@/lib/haptics'
import { stopCount } from '@/lib/trailFormat'
import { colors, fonts, radius, text } from '@/theme/tokens'

type Key = 'enjoyment' | 'memorability' | 'price' | 'time'

const QUESTIONS: { key: Key; label: string }[] = [
  { key: 'enjoyment', label: 'Fun' },
  { key: 'memorability', label: 'Memorable' },
  { key: 'price', label: 'Worth the money' },
  { key: 'time', label: 'Worth the time' },
]

type Scores = Record<Key, number>

export function RateTrail({
  trail,
  crumbsDone,
  onDone,
}: {
  trail: TrailDetail
  /** Crumbs ticked on this trail, for the summary; null when unknown. */
  crumbsDone: number | null
  /** Called after posting or skipping. */
  onDone: () => void
}) {
  const insets = useSafeAreaInsets()
  const [scores, setScores] = useState<Scores>({ enjoyment: 0, memorability: 0, price: 0, time: 0 })
  const [note, setNote] = useState('')
  const [editing, setEditing] = useState(false)
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pre-fill an earlier rating, so this edits it.
  useEffect(() => {
    if (!api) return
    let cancelled = false
    api.getMyRating(trail.id).then(
      (rating) => {
        if (cancelled || !rating) return
        setScores({ enjoyment: rating.enjoyment, memorability: rating.memorability, price: rating.price, time: rating.time })
        setNote(rating.review ?? '')
        setEditing(true)
      },
      () => undefined,
    )
    return () => {
      cancelled = true
    }
  }, [trail.id])

  const complete = QUESTIONS.every((q) => scores[q.key] > 0)
  const totalCrumbs = trail.stops.reduce((n, s) => n + s.crumbs.length, 0) + trail.betweenStopCrumbs.length
  const summary = [
    stopCount(trail.stops.length),
    crumbsDone !== null && totalCrumbs > 0 ? `${crumbsDone} of ${totalCrumbs} crumbs` : null,
  ].filter(Boolean)

  async function post() {
    if (!api || !complete) return
    setPosting(true)
    setError(null)
    const body: RatingBody = { ...scores, review: note.trim() || null }
    try {
      await api.rateTrail(trail.id, body)
      tapSuccess()
      onDone()
    } catch {
      setError('Your review didn’t post. Check your connection and try again.')
      setPosting(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 32 + insets.bottom }]} keyboardShouldPersistTaps="handled">
        <AppText style={styles.eyebrow}>Trail finished</AppText>
        <AppText style={styles.title}>{trail.title}</AppText>
        <AppText style={styles.summary}>{summary.join(' · ')}</AppText>

        <AppText style={styles.section}>How was it?</AppText>
        {QUESTIONS.map((q) => (
          <View key={q.key} style={styles.question}>
            <AppText style={styles.questionLabel}>{q.label}</AppText>
            <View style={styles.stars} accessibilityRole="adjustable" accessibilityLabel={q.label}>
              {[1, 2, 3, 4, 5].map((n) => {
                const on = n <= scores[q.key]
                return (
                  <Pressable
                    key={n}
                    accessibilityRole="button"
                    accessibilityLabel={`${q.label}: ${n} of 5`}
                    accessibilityState={{ selected: scores[q.key] === n }}
                    hitSlop={4}
                    onPress={() => {
                      tapLight()
                      setScores((s) => ({ ...s, [q.key]: n }))
                    }}
                  >
                    <Star size={30} strokeWidth={1.75} color={on ? colors.crumbStrong : colors.lineStrong} fill={on ? colors.crumbStrong : 'none'} />
                  </Pressable>
                )
              })}
            </View>
          </View>
        ))}

        <View style={styles.note}>
          <TextField
            label="Add a note (optional)"
            value={note}
            onChangeText={setNote}
            placeholder="What should the next person know?"
            multiline
            maxLength={MAX_REVIEW_LENGTH}
            style={styles.noteInput}
          />
        </View>

        {error ? <AppText style={styles.error}>{error}</AppText> : null}
        <View style={styles.actions}>
          <Button
            label={editing ? 'Update review' : 'Post review'}
            busy={posting}
            disabled={!complete}
            onPress={() => void post()}
          />
          {!complete ? <AppText style={styles.hint}>Rate all four to post.</AppText> : null}
          <Button variant="ghost" label="Skip for now" disabled={posting} onPress={onDone} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8 },
  eyebrow: { fontFamily: fonts.semibold, fontSize: text.base, color: colors.green },
  title: { fontFamily: fonts.extrabold, fontSize: text.xxl, color: colors.ink, letterSpacing: -0.8, marginTop: 4 },
  summary: { fontFamily: fonts.regular, fontSize: text.md, color: colors.muted, marginTop: 4 },
  section: { fontFamily: fonts.bold, fontSize: text.xl, color: colors.ink, marginTop: 28, marginBottom: 4, letterSpacing: -0.2 },
  question: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.lineStrong,
  },
  questionLabel: { fontFamily: fonts.semibold, fontSize: text.md, color: colors.ink },
  stars: { flexDirection: 'row', gap: 6 },
  note: { marginTop: 24 },
  noteInput: { minHeight: 96, textAlignVertical: 'top', paddingTop: 12, borderRadius: radius.md },
  error: { color: colors.crumbDeep, fontSize: text.sm, marginTop: 16 },
  actions: { marginTop: 24, gap: 8 },
  hint: { fontFamily: fonts.regular, fontSize: text.sm, color: colors.muted, textAlign: 'center' },
})
