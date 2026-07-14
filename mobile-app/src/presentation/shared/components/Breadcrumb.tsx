import { View, Text, StyleSheet } from "react-native"
import { ChevronRight } from "lucide-react-native"
import { colors } from "../colors"

interface BreadcrumbProps {
  projectName?: string
  buildUnitName?: string
  channelName?: string
}

/** project › build unit › #channel — the row context on Inbox and My Tasks. */
export function Breadcrumb({ projectName, buildUnitName, channelName }: BreadcrumbProps) {
  if (!projectName && !buildUnitName && !channelName) return null

  return (
    <View style={styles.row}>
      {projectName ? (
        <>
          <Text style={styles.crumb}>{projectName}</Text>
          <ChevronRight size={12} color={colors.secondary} strokeWidth={2} />
        </>
      ) : null}
      {buildUnitName ? (
        <>
          <Text style={styles.crumb}>{buildUnitName}</Text>
          <ChevronRight size={12} color={colors.secondary} strokeWidth={2} />
        </>
      ) : null}
      {channelName ? <Text style={styles.crumb}>#{channelName}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 2,
    marginTop: 6,
  },
  crumb: {
    fontSize: 11,
    fontFamily: "InstrumentSans_400Regular",
    color: colors.secondary,
  },
})
