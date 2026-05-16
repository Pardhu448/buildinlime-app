import { View, TextInput, TouchableOpacity, StyleSheet, Text, Alert } from "react-native"
import { useState } from "react"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import * as DocumentPicker from "expo-document-picker"
import * as Crypto from "expo-crypto"
import { useSession } from "@/src/infrastructure/auth/client"
import { colors } from "@/src/presentation/shared/colors"
import { createMessageAction } from "@/src/application/actions/messages"
import { usePendingUploads } from "@/src/presentation/resources/hooks/usePendingUploads"

interface MessageInputProps {
  channelId: string
  buildUnitId: string
  projectId: string
}

export function MessageInput({ channelId, buildUnitId, projectId }: MessageInputProps) {
  const [text, setText] = useState("")
  // Generated lazily on the first attachment so files can be enqueued against
  // the message id BEFORE the message itself is sent. Passed to
  // createMessageAction on send so the message and its resources agree on the id.
  const [draftMessageId, setDraftMessageId] = useState<string | null>(null)
  const { bottom } = useSafeAreaInsets()
  const { data: session } = useSession()

  const { pendingUploads, enqueue, start, cancel } = usePendingUploads({
    messageId: draftMessageId ?? undefined,
  })

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
      })
      // Release the attachments now that the message transaction exists.
      pendingUploads.forEach((u) => start(u.id))
      setText("")
      setDraftMessageId(null)
    } catch (err) {
      console.error("Failed to send message:", err)
    }
  }

  const canSend = !!text.trim() || pendingUploads.length > 0

  return (
    <View style={[styles.outer, { paddingBottom: 10 + bottom }]}>
      {pendingUploads.length > 0 && (
        <View style={styles.chips}>
          {pendingUploads.map((u) => (
            <View key={u.id} style={styles.chip}>
              <Text style={styles.chipText} numberOfLines={1}>
                📎 {u.name}
              </Text>
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
    </View>
  )
}

const styles = StyleSheet.create({
  outer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
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
  chipText: {
    flexShrink: 1,
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
