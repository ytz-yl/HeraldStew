import React, { useEffect, useRef } from "react"
import { Box, Text, useStdout } from "ink"
import TextInput from "ink-text-input"
import { C } from "../theme.js"

// CJK 全角字符占 2 个终端列，ASCII 占 1 列
function visualWidth(s: string): number {
  let w = 0
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0
    w += (
      (cp >= 0x1100 && cp <= 0x115f) ||
      cp === 0x2329 || cp === 0x232a ||
      (cp >= 0x2e80 && cp <= 0x303e) ||
      (cp >= 0x3040 && cp <= 0xa4ff) ||
      (cp >= 0xa960 && cp <= 0xa97f) ||
      (cp >= 0xac00 && cp <= 0xd7ff) ||
      (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0xfe10 && cp <= 0xfe6f) ||
      (cp >= 0xff01 && cp <= 0xff60) ||
      (cp >= 0xffe0 && cp <= 0xffe6) ||
      (cp >= 0x20000 && cp <= 0x3fffd)
    ) ? 2 : 1
  }
  return w
}

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
  const { stdout } = useStdout()
  const valueRef = useRef(value)
  valueRef.current = value

  // 用 setInterval 持续把终端物理光标维持在 TextInput 位置，
  // 防止 ink 每次 render 后把光标留在 hint bar 末尾导致输入法候选框错位。
  // InputBar 固定在屏幕底部 4 行：border-top / input-row / border-bottom / hint-bar
  // input-row 在倒数第 3 行（rows-2），列偏移 = margin(1)+border(1)+padding(1)+prompt(1)+gap(1) = 5
  useEffect(() => {
    if (!textInputFocus || !stdout) return
    const reposition = () => {
      const rows = stdout.rows ?? 24
      stdout.write(`\x1b[${rows - 2};${5 + visualWidth(valueRef.current)}H`)
    }
    reposition()
    const id = setInterval(reposition, 50)
    return () => clearInterval(id)
  }, [textInputFocus, stdout])

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