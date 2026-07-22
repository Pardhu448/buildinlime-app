import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Camera, Video, Image as ImageIcon, Mic, Paperclip } from "lucide-react-native"
import { colors } from "@/src/presentation/shared/colors"

// The composer's "+" opens this sheet. Picture/audio/video are first-class
// capture actions; a generic "File" keeps the old document-attach path for
// pdfs and docs.

export type AttachmentAction = "photo" | "video" | "library" | "audio" | "file"

interface AttachmentMenuProps {
  visible: boolean
  onSelect: (action: AttachmentAction) => void
  onClose: () => void
}

const OPTIONS: { action: AttachmentAction; label: string; Icon: typeof Camera }[] = [
  { action: "photo", label: "Take photo", Icon: Camera },
  { action: "video", label: "Record video", Icon: Video },
  { action: "library", label: "Photo & video library", Icon: ImageIcon },
  { action: "audio", label: "Record audio", Icon: Mic },
  { action: "file", label: "File", Icon: Paperclip },
]

export function AttachmentMenu({ visible, onSelect, onClose }: AttachmentMenuProps) {
  const { bottom } = useSafeAreaInsets()
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        {/* Stop propagation so a tap on the sheet itself doesn't dismiss it. */}
        <TouchableOpacity activeOpacity={1} style={[styles.sheet, { paddingBottom: 12 + bottom }]}>
          <View style={styles.handle} />
          {OPTIONS.map(({ action, label, Icon }) => (
            <TouchableOpacity
              key={action}
              style={styles.row}
              onPress={() => onSelect(action)}
              activeOpacity={0.6}
            >
              <View style={styles.iconWrap}>
                <Icon size={20} color={colors.primary} strokeWidth={2} />
              </View>
              <Text style={styles.label}>{label}</Text>
            </TouchableOpacity>
          ))}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.cardBorder,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.iconChip,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 15,
    fontFamily: "InstrumentSans_500Medium",
    color: colors.foreground,
  },
})
