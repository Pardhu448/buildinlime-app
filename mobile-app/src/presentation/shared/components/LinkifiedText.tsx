import { Text, Linking, type StyleProp, type TextStyle } from "react-native"
import { colors } from "@/src/presentation/shared/colors"

// Renders a string with any URLs turned into tappable spans — so a pasted map
// link (Google/Apple Maps, or a bare `geo:` link) opens the maps app, and any
// other link opens the browser. Message text was previously a plain <Text>, so
// links were dead. Nested <Text> keeps everything on one flowing paragraph.

// One capturing group, so String.split keeps the URLs as their own array slots.
// Matches http(s), a bare `www.` host, and `geo:` (lat,long) links.
const URL_SPLIT = /((?:https?:\/\/|geo:|www\.)[^\s]+)/gi
const URL_HEAD = /^(?:https?:\/\/|geo:|www\.)/i

function openUrl(raw: string): void {
  // Trailing sentence punctuation is almost never part of the URL — "…maps.app/x)."
  const cleaned = raw.replace(/[.,;:!?)\]]+$/, "")
  const url = /^www\./i.test(cleaned) ? `https://${cleaned}` : cleaned
  void Linking.openURL(url).catch(() => {})
}

interface LinkifiedTextProps {
  children: string
  style?: StyleProp<TextStyle>
  /** Overrides the default link appearance (primary + underline). */
  linkStyle?: StyleProp<TextStyle>
}

export function LinkifiedText({ children, style, linkStyle }: LinkifiedTextProps) {
  const parts = children.split(URL_SPLIT)
  return (
    <Text style={style}>
      {parts.map((part, i) =>
        part && URL_HEAD.test(part) ? (
          <Text
            key={i}
            style={[{ color: colors.primary, textDecorationLine: "underline" }, linkStyle]}
            onPress={() => openUrl(part)}
            suppressHighlighting
          >
            {part}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  )
}
