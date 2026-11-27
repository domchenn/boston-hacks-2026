/**
 * Text tabs with an ink underline under the selected one, over a hairline (the
 * mockups' "For you · By day · Friends" and "In progress · Saved · Done"). Controlled:
 * the screen keeps which tab is selected.
 */
import { Pressable, StyleSheet, View } from 'react-native'
import { colors, fonts, text } from '@/theme/tokens'
import { AppText } from './AppText'

export function TopTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const selected = tab.value === value
        return (
          <Pressable
            key={tab.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(tab.value)}
            style={[styles.tab, selected && styles.selected]}
          >
            <AppText style={[styles.label, selected && styles.labelSelected]}>{tab.label}</AppText>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 24, borderBottomWidth: 1, borderBottomColor: colors.line },
  tab: { paddingVertical: 10, borderBottomWidth: 2.5, borderBottomColor: 'transparent', marginBottom: -1 },
  selected: { borderBottomColor: colors.ink },
  label: { fontFamily: fonts.semibold, fontSize: text.lg, color: colors.muted },
  labelSelected: { color: colors.ink },
})
