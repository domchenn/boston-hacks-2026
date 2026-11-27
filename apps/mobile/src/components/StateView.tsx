/**
 * The full-screen states every list screen needs: loading (a spinner), and a message
 * with an optional button (errors, empty lists, "log in to see this"). One component,
 * so these look the same everywhere.
 */
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { colors } from '@/theme/tokens'
import { AppText } from './AppText'
import { Button } from './Button'

type Props =
  | { kind: 'loading' }
  | { kind: 'message'; title: string; body?: string; action?: { label: string; onPress: () => void } }

export function StateView(props: Props) {
  if (props.kind === 'loading') {
    return (
      <View style={styles.center} accessibilityLabel="Loading">
        <ActivityIndicator color={colors.crumbStrong} />
      </View>
    )
  }
  return (
    <View style={styles.center}>
      <AppText variant="heading" style={styles.centerText}>
        {props.title}
      </AppText>
      {props.body ? (
        <AppText variant="secondary" style={styles.centerText}>
          {props.body}
        </AppText>
      ) : null}
      {props.action ? <Button label={props.action.label} onPress={props.action.onPress} style={styles.action} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10, backgroundColor: colors.paper },
  centerText: { textAlign: 'center' },
  action: { marginTop: 10, alignSelf: 'stretch' },
})
