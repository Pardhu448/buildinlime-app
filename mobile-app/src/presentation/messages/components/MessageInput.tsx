import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Text,
  Alert,
  Keyboard,
} from "react-native"
import { useEffect, useState } from "react"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import * as DocumentPicker from "expo-document-picker"
import * as Crypto from "expo-crypto"
import { useSession } from "@/src/infrastructure/auth/client"
import { colors } from "@/src/presentation/shared/colors"
import { createMessageAction } from "@/src/application/actions/messages"
import { usePendingUploads } from "@/src/presentation/resources/hooks/usePendingUploads"
import { RenameFileModal } from "@/src/presentation/resources/components/RenameFileModal"
import type { Message } from "@buildinlime/domain-types"

interface MessageInputProps {
  channelId: string
  buildUnitId: string
  projectId: string
  /** Message being replied to, or null. Long-press a bubble to set it. */
  replyTo?: Message | null
  replyToName?: string
  onCancelReply?: () => void
}

export function MessageInput({
  channelId,
  buildUnitId,
  projectId,
  replyTo,
  replyToName,
  onCancelReply,
}: MessageInputProps) {
  const [text, setText] = useState("")
  // Generated lazily on the first attachment so files can be enqueued against
  // the message id BEFORE the message itself is sent. Passed to
  // createMessageAction on send so the message and its resources agree on the id.
  const [draftMessageId, setDraftMessageId] = useState<string | null>(null)
  const { bottom } = useSafeAreaInsets()
  const { data: session } = useSession()

  // The nav-bar inset must not be applied while the keyboard is up. The
  // KeyboardAvoidingView already lifts the composer clear of the keyboard, and
  // the nav bar is behind the keyboard at that point — adding its height on top
  // pushes the composer a nav-bar's worth too high. It only looks right on entry
  // because the keyboard is closed then.
  const [keyboardUp, setKeyboardUp] = useState(false)
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardUp(true))
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardUp(false))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])
  const bottomInset = keyboardUp ? 0 : bottom

  const { pendingUploads, enqueue, start, cancel, rename } = usePendingUploads({
    messageId: draftMessageId ?? undefined,
  })

  // Attachment queued for renaming. Composer attachments have no schedule step
  // (they start on send), so the chip itself is where they get named.
  const [renameTarget, setRenameTarget] = useState<{
    id: string
    name: string
  } | null>(null)

  async function handleAttach() {
    const userId = session?.user?.id
    if (!userId) {
      Alert.alert("Cannot attach", "Your session is still loading — try again.")
      return
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
      })
      if (result.canceled) return
      const asset = result.assets[0]
      if (!asset) return

      let messageId = draftMessageId
      if (!messageId) {
        messageId = Crypto.randomUUID()
        setDraftMessageId(messageId)
      }
      // autoStart: false — the upload waits in `awaiting_schedule` until the
      // message is sent (handleSend → start), so the server's 15s parent-poll
      // finds the message row.
      await enqueue(
        asset.uri,
        {
          name: asset.name,
          mimeType: asset.mimeType ?? "application/octet-stream",
          channelId,
          buildUnitId,
          projectId,
          createdById: userId,
          messageId,
        },
        { autoStart: false },
      )
    } catch (err) {
      Alert.alert("Attach failed", String(err))
    }
  }

  function handleSend() {
    const trimmed = text.trim()
    const userId = session?.user?.id
    if ((!trimmed && pendingUploads.length === 0) || !userId) return

    const messageId = draftMessageId ?? Crypto.randomUUID()
    try {
      createMessageAction({
        id: messageId,
        text: trimmed,
        channel_id: channelId,
        buildunit_id: buildUnitId,
        project_id: projectId,
        createdby_id: userId,
        parent_id: replyTo?.id ?? null,
      })
      // Release the attachments now that the message transaction exists.
      pendingUploads.forEach((u) => start(u.id))
      setText("")
      setDraftMessageId(null)
      onCancelReply?.()
    } catch (err) {
      console.error("Failed to send message:", err)
    }
  }

  const canSend = !!text.trim() || pendingUploads.length > 0

  return (
    <View style={[styles.outer, { paddingBottom: 10 + bottomInset }]}>
      {/* Reply banner — what this message will be a reply to. */}
      {replyTo && (
        <View style={styles.replyBar}>
          <View style={styles.replyAccent} />
          <View style={styles.replyBody}>
            <Text style={styles.replyName} numberOfLines={1}>
              Replying to {replyToName ?? "Unknown"}
            </Text>
            <Text style={styles.replyText} numberOfLines={1}>
              {replyTo.text?.trim() || "Attachment"}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onCancelReply}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.6}
          >
            <Text style={styles.chipRemove}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
      {pendingUploads.length > 0 && (
        <View style={styles.chips}>
          {pendingUploads.map((u) => (
            <View key={u.id} style={styles.chip}>
              {/* Tap the name to rename before it uploads. */}
              <TouchableOpacity
                style={styles.chipNameBtn}
                onPress={() => setRenameTarget({ id: u.id, name: u.name })}
                activeOpacity={0.6}
              >
                <Text style={styles.chipText} numberOfLines={1}>
                  📎 {u.name}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => cancel(u.id)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                activeOpacity={0.6}
              >
                <Text style={styles.chipRemove}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.attachButton}
          onPress={handleAttach}
          activeOpacity={0.7}
        >
          <Text style={styles.attachIcon}>＋</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Type a message…"
          placeholderTextColor={colors.mutedForeground}
          multiline
          returnKeyType="default"
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!canSend}
          activeOpacity={0.7}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>

      {/* Rendered conditionally so it remounts per target and picks up that
          file's name as its initial value. */}
      {renameTarget && (
        <RenameFileModal
          visible
          fileName={renameTarget.name}
          onSave={async (name) => {
            const { id } = renameTarget
            setRenameTarget(null)
            await rename(id, name)
          }}
          onCancel={() => setRenameTarget(null)}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  outer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 12,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.muted,
    borderRadius: 8,
  },
  replyAccent: {
    width: 3,
    alignSelf: "stretch",
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  replyBody: {
    flex: 1,
    gap: 1,
  },
  replyName: {
    fontSize: 11,
    fontFamily: "InstrumentSans_600SemiBold",
    color: colors.primary,
  },
  replyText: {
    fontSize: 12,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.mutedForeground,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: 200,
    backgroundColor: colors.muted,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipNameBtn: {
    flexShrink: 1,
  },
  chipText: {
    fontSize: 12,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.foreground,
  },
  chipRemove: {
    fontSize: 12,
    color: colors.mutedForeground,
    fontFamily: "InstrumentSans_600SemiBold",
  },
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  attachIcon: {
    fontSize: 20,
    color: colors.mutedForeground,
    lineHeight: 22,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: colors.muted,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.foreground,
    lineHeight: 20,
  },
  sendButton: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendButtonText: {
    color: colors.primaryForeground,
    fontSize: 14,
    fontFamily: "InstrumentSans_600SemiBold",
  },
})
