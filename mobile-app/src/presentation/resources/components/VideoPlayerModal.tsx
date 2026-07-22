import { Modal, View, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from "react-native"
import { useVideoPlayer, VideoView } from "expo-video"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { colors } from "@/src/presentation/shared/colors"
import { useAuthHeaders } from "@/src/presentation/resources/lib/media-source"

// The ONE place a live expo-video player is mounted. Rendered only while a video
// is actually being watched (tapped from its poster), so the list never holds
// multiple players open — which is what churned expo-video's shared objects
// ("Cannot use shared object that was already released") and exhausted the
// device's video decoders. On close the modal unmounts and the player releases
// cleanly, with no other VideoView still referencing it.

interface VideoPlayerModalProps {
  remoteUrl?: string
  localUri?: string
  onClose: () => void
}

export function VideoPlayerModal({ remoteUrl, localUri, onClose }: VideoPlayerModalProps) {
  const headers = useAuthHeaders()
  const { top } = useSafeAreaInsets()

  const uri = localUri ?? remoteUrl ?? null
  const needsAuth = !localUri && !!remoteUrl
  const source =
    uri && (!needsAuth || headers) ? { uri, headers: needsAuth ? headers! : undefined } : null

  const player = useVideoPlayer(source, (p) => {
    p.loop = false
    p.play()
  })

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {source ? (
          <VideoView player={player} style={styles.video} contentFit="contain" nativeControls />
        ) : (
          <ActivityIndicator size="large" color={colors.primary} />
        )}
        <TouchableOpacity
          style={[styles.close, { top: top + 8 }]}
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.6}
        >
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.94)",
    alignItems: "center",
    justifyContent: "center",
  },
  video: {
    width: "100%",
    height: "100%",
  },
  close: {
    position: "absolute",
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "InstrumentSans_600SemiBold",
    lineHeight: 20,
  },
})
