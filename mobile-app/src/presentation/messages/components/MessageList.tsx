import { FlatList, View, StyleSheet } from "react-native"
import { MessageBubble } from "./MessageBubble"
import type { Message } from "@buildinlime/domain-types"

interface MessageListProps {
  messages: Message[]
  currentUserId: string
  usersMap: Record<string, string>
}

export function MessageList({ messages, currentUserId, usersMap }: MessageListProps) {
  // Reverse for inverted FlatList (newest at bottom)
  const reversed = [...messages].reverse()

  return (
    <FlatList
      data={reversed}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <MessageBubble
          message={item}
          senderName={usersMap[item.createdby_id] ?? "Unknown"}
          isOwn={item.createdby_id === currentUserId}
        />
      )}
      inverted
      style={styles.list}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    />
  )
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  content: {
    paddingVertical: 12,
  },
})
