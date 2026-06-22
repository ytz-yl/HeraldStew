import React from "react"
import { Box, Text } from "ink"
import TextInput from "ink-text-input"
import { C } from "../theme.js"

interface InputBarProps {
  value: string
  onChange: (v: string) => void
  onSubmit: (v: string) => void
  disabled: boolean
  placeholder?: string
  showDashboard?: boolean
}

export function InputBar({ value, onChange, onSubmit, disabled, placeholder, showDashboard }: InputBarProps) {
  const textInputFocus = !disabled && !showDashboard

  return (
    <Box flexDirection="column">
      <Box
        borderStyle="round"
        borderColor={disabled ? C.surface1 : C.brandDim}
        paddingX={1}
        marginX={1}
      >
        <Box gap={1} width="100%">
          <Text color={disabled ? C.surface2 : C.brand} bold>
            {disabled ? "⌛" : "❯"}
          </Text>
          {disabled || showDashboard ? (
            <Text color={C.overlay0} dimColor>
              {showDashboard ? "Dashboard mode — Ctrl+D to switch to chat" : (placeholder ?? "Waiting for response…")}
            </Text>
          ) : (
            <TextInput
              value={value}
              onChange={onChange}
              onSubmit={onSubmit}
              placeholder={placeholder ?? "Message HeraldStew…"}
              focus={textInputFocus}
            />
          )}
        </Box>
      </Box>

      <Box paddingX={3} gap={3}>
        <Text color={C.surface2} dimColor>
          <Text color={C.overlay0}>Ctrl+D</Text> {showDashboard ? "chat" : "dashboard"}
        </Text>
        {!showDashboard && (
          <>
            <Text color={C.surface2} dimColor>
              <Text color={C.overlay0}>Enter</Text> send
            </Text>
            <Text color={C.surface2} dimColor>
              <Text color={C.overlay0}>Ctrl+C</Text> quit
            </Text>
            <Text color={C.surface2} dimColor>
              <Text color={C.overlay0}>/doctor</Text> env
            </Text>
          </>
        )}
      </Box>
    </Box>
  )
}