import { View, TextInput, TouchableOpacity, StyleSheet, Text } from "react-native"
import { useState } from "react"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useSession } from "@/src/infrastructure/auth/client"
import { colors } from "@/src/presentation/shared/colors"
import { useProjectContext } from "@/src/application/context/ProjectContext"

interface MessageInputProps {
  channelId: string
  buildUnitId: string
  projectId: string
}

export function MessageInput({ channelId, buildUnitId, projectId }: MessageInputProps) {
  const [text, setText] = useState("")
  const { bottom } = useSafeAreaInsets()
  const { data: session } = useSession()
  const { collections } = useProjectContext()

  async function handleSend() {
    const trimmed = text.trim()
    if (!trimmed || !session?.user?.id || !collections) return

    const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    try {
      await collections.messagesCollection.insert({
        id,
        text: trimmed,
        channel_id: channelId,
        buildunit_id: buildUnitId,
        project_id: projectId,
        createdby_id: session.user.id,
        mention_ids: [],
        resource_ids: [],
        parent_id: null,
        created_at: new Date(),
      })
      setText("")
    } catch (err) {
      console.error("Failed to send message:", err)
    }
  }

  return (
    <View style={[styles.container, { paddingBottom: 10 + bottom }]}>
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
        style={[styles.sendButton, !text.trim() && styles.sendButtonDisabled]}
        onPress={handleSend}
        disabled={!text.trim()}
        activeOpacity={0.7}
      >
        <Text style={styles.sendButtonText}>Send</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    gap: 8,
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
