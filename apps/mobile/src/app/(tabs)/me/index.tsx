/**
 * You (Mobile-Profile mockup): avatar initial, your name, @username and follow counts,
 * a stats row (trails done · made · ratings on your trails) and Trails you made
 * (Published / Draft). The gear opens Settings. Signed out, it offers Log in. The
 * mockup's "Your Boston" neighborhood map needs location history we don't keep, so it's left out.
 */
import { useCallback, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { Settings } from 'lucide-react-native'
import type { FollowCounts, ProfileStats, ProfileTrail } from '@breadcrumb/contracts'
import { AppText } from '@/components/AppText'
import { StateView } from '@/components/StateView'
import { api } from '@/lib/api'
import { useSession } from '@/lib/session'
import { formatCost } from '@/lib/trailFormat'
import { colors, fonts, text } from '@/theme/tokens'

type Data = { stats: ProfileStats; follows: FollowCounts; made: ProfileTrail[] }

export default function YouScreen() {
  const { session, profile, loading } = useSession()
  const router = useRouter()
  const userId = session?.user.id ?? null
  const [data, setData] = useState<{ userId: string; value: Data | null } | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    if (!api || !userId) return
    try {
      const [stats, follows, made] = await Promise.all([
        api.getProfileStats(userId),
        api.getFollowCounts(userId),
        api.getMadeTrails(userId),
      ])
      setData({ userId, value: { stats, follows, made } })
    } catch {
      setData((prev) => (prev?.userId === userId ? prev : { userId, value: null }))
    }
  }, [userId])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  if (loading) return <StateView kind="loading" />
  if (!session) {
    return (
      <StateView
        kind="message"
        title="Your Breadcrumb"
        body="Log in to see your trails, friends and stats."
        action={{ label: 'Log in', onPress: () => router.push('/sign-in') }}
      />
    )
  }

  const current = data?.userId === userId ? data.value : null
  const name = profile?.displayName || profile?.username || 'You'
  const follows = current ? `${current.follows.followers} followers · ${current.follows.following} following` : null
  const subline = [profile?.username ? `@${profile.username}` : null, follows].filter(Boolean).join(' · ')

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true)
            await load()
            setRefreshing(false)
          }}
          tintColor={colors.crumbStrong}
        />
      }
    >
      <View style={styles.gearRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Settings" hitSlop={10} onPress={() => router.push('/me/settings')}>
          <Settings size={24} strokeWidth={2} color={colors.ink} />
        </Pressable>
      </View>

      <View style={styles.head}>
        <View style={styles.avatar}>
          <AppText style={styles.initial}>{name.charAt(0).toUpperCase()}</AppText>
        </View>
        <View style={styles.who}>
          <AppText style={styles.name} numberOfLines={1}>
            {name}
          </AppText>
          {subline ? <AppText style={styles.sub}>{subline}</AppText> : null}
        </View>
      </View>

      <View style={styles.stats}>
        <Stat value={current?.stats.finishedCount ?? null} label="trails done" />
        <Stat value={current?.stats.madeCount ?? null} label="made" />
        <Stat value={current ? (current.stats.questgiverRating?.count ?? 0) : null} label="ratings" />
      </View>

      <AppText style={styles.section}>Trails you made</AppText>
      {current && current.made.length === 0 ? (
        <AppText style={styles.empty}>Trails you make show up here.</AppText>
      ) : null}
      {current?.made.map((trail) => {
        const draft = trail.trailStatus === 'draft'
        const facts = [trail.neighborhood, trail.estimatedCost !== null ? formatCost(trail.estimatedCost) : null].filter(Boolean).join(' · ')
        return (
          <Pressable
            key={trail.id}
            accessibilityRole="button"
            onPress={() => router.push(`/trail/${trail.id}`)}
            style={({ pressed }) => [styles.made, pressed && styles.pressed]}
          >
            <View style={styles.madeBody}>
              <AppText style={styles.madeTitle}>{trail.title}</AppText>
              {facts ? <AppText style={styles.sub}>{facts}</AppText> : null}
            </View>
            <AppText style={[styles.madeStatus, draft && styles.draft]}>{draft ? 'Draft' : 'Published'}</AppText>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

function Stat({ value, label }: { value: number | null; label: string }) {
  return (
    <View style={styles.stat}>
      <AppText style={styles.statValue}>{value ?? '–'}</AppText>
      <AppText style={styles.statLabel}>{label}</AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 },
  gearRow: { alignItems: 'flex-end' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.crumbTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { fontFamily: fonts.bold, fontSize: 28, color: colors.crumbStrong },
  who: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.extrabold, fontSize: text.xxl, color: colors.ink, letterSpacing: -0.8 },
  sub: { fontFamily: fonts.regular, fontSize: text.base, color: colors.muted },
  stats: {
    flexDirection: 'row',
    marginTop: 24,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
  stat: { flex: 1 },
  statValue: { fontFamily: fonts.extrabold, fontSize: text.xxl, color: colors.ink },
  statLabel: { fontFamily: fonts.regular, fontSize: text.base, color: colors.muted },
  section: { fontFamily: fonts.bold, fontSize: text.xl, color: colors.ink, marginTop: 28, marginBottom: 4, letterSpacing: -0.2 },
  empty: { fontFamily: fonts.regular, fontSize: text.base, color: colors.muted, marginTop: 8 },
  made: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.lineStrong,
  },
  pressed: { opacity: 0.6 },
  madeBody: { flex: 1, gap: 2 },
  madeTitle: { fontFamily: fonts.bold, fontSize: text.lg, color: colors.ink },
  madeStatus: { fontFamily: fonts.medium, fontSize: text.base, color: colors.muted },
  draft: { fontFamily: fonts.bold, color: colors.crumbStrong },
})
