/**
 * Small taps you feel (iOS haptics) for toggles: ticking a crumb, a filter chip, saving.
 * Never throws; does nothing where haptics aren't available.
 */
import * as Haptics from 'expo-haptics'

/** A light tap, for switching something on or off. */
export function tapLight() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
}

/** A success buzz, for finishing a trail. */
export function tapSuccess() {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
}
