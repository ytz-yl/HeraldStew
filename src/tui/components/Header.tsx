import React from "react"
import { Box, Text } from "ink"
import { C } from "../theme.js"

interface HeaderProps {
  model: string
  providerType: string
}

export function Header({ model, providerType }: HeaderProps) {
  return (
    <Box
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      paddingX={2}
      paddingY={0}
      borderStyle="single"
      borderColor={C.surface1}
    >
      <Box gap={1}>
        <Text bold color={C.brand}>⬡ HeraldStew</Text>
        <Text color={C.surface2}>·</Text>
        <Text color={C.overlay0} dimColor>AI agent configuration assistant</Text>
      </Box>
      <Box gap={1}>
        <Text color={C.surface2}>model</Text>
        <Text color={C.sky}>{model}</Text>
        <Text color={C.surface2}>via</Text>
        <Text color={C.subtext0}>{providerType}</Text>
      </Box>
    </Box>
  )
}
