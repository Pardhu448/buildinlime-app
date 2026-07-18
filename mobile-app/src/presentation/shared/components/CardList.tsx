import { View, FlatList, StyleSheet } from "react-native"
import type { ReactElement } from "react"
import { useSafeAreaInsets } from "react-native-safe-area-context"

interface CardListProps<T> {
  data: T[]
  keyExtractor: (item: T) => string
  renderItem: (item: T) => ReactElement
}

/**
 * The card list shared by the Inbox and My Tasks screens: 16px padding, 8px
 * between cards, and a bottom pad that clears the home indicator.
 *
 * The safe-area inset lives here rather than at each call site because forgetting
 * it puts the last card under the system gesture bar — the kind of thing that is
 * invisible on a simulator and obvious on a device.
 *
 * Scoped to these two screens: the other list screens use a 12px gap and their
 * own padding — see ScreenStates for the same note.
 */
export function CardList<T>({ data, keyExtractor, renderItem }: CardListProps<T>) {
  const insets = useSafeAreaInsets()

  return (
    <FlatList
      data={data}
      keyExtractor={keyExtractor}
      contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
      ItemSeparatorComponent={() => <View style={styles.gap} />}
      renderItem={({ item }) => renderItem(item)}
      showsVerticalScrollIndicator={false}
    />
  )
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  gap: {
    height: 8,
  },
})
