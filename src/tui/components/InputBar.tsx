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
}

export function InputBar({ value, onChange, onSubmit, disabled, placeholder }: InputBarProps) {
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
          {disabled ? (
            <Text color={C.overlay0} dimColor>
              {placeholder ?? "Waiting for response…"}
            </Text>
          ) : (
            <TextInput
              value={value}
              onChange={onChange}
              onSubmit={onSubmit}
              placeholder={placeholder ?? "Message HeraldStew…"}
              focus={!disabled}
            />
          )}
        </Box>
      </Box>

      <Box paddingX={3} gap={3}>
        <Text color={C.surface2} dimColor>
          <Text color={C.overlay0}>Enter</Text> send
        </Text>
        <Text color={C.surface2} dimColor>
          <Text color={C.overlay0}>Ctrl+C</Text> quit
        </Text>
        <Text color={C.surface2} dimColor>
          <Text color={C.overlay0}>/doctor</Text> check env
        </Text>
      </Box>
    </Box>
  )
}
