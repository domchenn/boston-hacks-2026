/**
 * A row of trail photos that scrolls sideways, optionally starting with an Add photo
 * tile (Take photo / Choose from library). Long-pressing one of your own photos asks
 * to delete it. Used on the trail page and on each stop of the active trail.
 */
import { ActionSheetIOS, ActivityIndicator, Alert, Image, Platform, Pressable, ScrollView, StyleSheet } from 'react-native'
import { Camera } from 'lucide-react-native'
import type { TrailPhoto } from '@breadcrumb/contracts'
import { colors, fonts, radius, text } from '@/theme/tokens'
import { AppText } from './AppText'

export type PhotoSource = 'camera' | 'library'

export function PhotoStrip({
  photos,
  isMine,
  onAdd,
  uploading = false,
  onDelete,
}: {
  photos: TrailPhoto[]
  isMine: (photo: TrailPhoto) => boolean
  /** Shows the Add photo tile when set. */
  onAdd?: (source: PhotoSource) => void
  uploading?: boolean
  onDelete: (photo: TrailPhoto) => void
}) {
  function choose() {
    if (!onAdd) return
    const pick = (i: number) => {
      if (i === 0) onAdd('camera')
      if (i === 1) onAdd('library')
    }
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({ options: ['Take photo', 'Choose from library', 'Cancel'], cancelButtonIndex: 2 }, pick)
    } else {
      Alert.alert('Add a photo', undefined, [
        { text: 'Take photo', onPress: () => pick(0) },
        { text: 'Choose from library', onPress: () => pick(1) },
        { text: 'Cancel', style: 'cancel' },
      ])
    }
  }

  function confirmDelete(photo: TrailPhoto) {
    Alert.alert('Delete this photo?', 'It’s removed from the trail.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(photo) },
    ])
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {onAdd ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add a photo"
          disabled={uploading}
          onPress={choose}
          style={({ pressed }) => [styles.add, pressed && styles.pressed]}
        >
          {uploading ? <ActivityIndicator color={colors.crumbStrong} /> : <Camera size={24} strokeWidth={2} color={colors.crumbStrong} />}
          <AppText style={styles.addLabel}>{uploading ? 'Uploading' : 'Add photo'}</AppText>
        </Pressable>
      ) : null}
      {photos.map((photo) => {
        const mine = isMine(photo)
        return (
          <Pressable
            key={photo.id}
            accessibilityRole="image"
            accessibilityLabel={photo.caption ?? 'Trail photo'}
            accessibilityHint={mine ? 'Long-press to delete' : undefined}
            onLongPress={mine ? () => confirmDelete(photo) : undefined}
          >
            <Image source={{ uri: photo.url }} style={styles.photo} />
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: { gap: 10, paddingTop: 10 },
  add: {
    width: 96,
    height: 96,
    borderRadius: radius.small,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  pressed: { opacity: 0.6 },
  addLabel: { fontFamily: fonts.semibold, fontSize: text.xs, color: colors.crumbStrong },
  photo: { width: 96, height: 96, borderRadius: radius.small, backgroundColor: colors.sand },
})
