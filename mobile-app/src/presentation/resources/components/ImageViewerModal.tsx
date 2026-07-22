import { Modal, Image, TouchableOpacity, Text, StyleSheet } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

// Full-screen viewer for a tapped inline image. A plain contained image on a
// black backdrop — tap anywhere (or the ✕) to dismiss. Source carries the same
// { uri, headers } the inline thumbnail used, so no second auth round-trip.

interface ImageViewerModalProps {
  visible: boolean
  uri: string | null
  headers?: Record<string, string>
  onClose: () => void
}

export function ImageViewerModal({ visible, uri, headers, onClose }: ImageViewerModalProps) {
  const { top } = useSafeAreaInsets()
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        {uri ? (
          <Image
            source={headers ? { uri, headers } : { uri }}
            style={styles.image}
            resizeMode="contain"
          />
        ) : null}
        <TouchableOpacity
          style={[styles.close, { top: top + 8 }]}
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.6}
        >
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </TouchableOpacity>
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
  image: {
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
