import React, { useLayoutEffect, useRef, useState } from "react"
import { Box, Text, useStdout, measureElement, type DOMElement } from "ink"
import { C } from "../theme.js"
import { ToolCard, type ToolCall } from "./ToolCard.js"
import { renderMarkdownInk } from "../markdown.js"

export type MessagePart =
  | { type: "text"; text: string }
  | { type: "tool"; call: ToolCall }

export type MessageRole = "user" | "assistant" | "system"

export interface Message {
  id: string
  role: MessageRole
  streaming?: boolean
  parts: MessagePart[]
}

interface MessageListProps {
  messages: Message[]
  tick: number
  // Lines scrolled up from the bottom: 0 = pinned to newest, positive = scrolled up
  scrollOffset?: number
  viewportRows: number
  // Reports the max scrollable rows (contentHeight - viewportRows) to the parent for clamping.
  onMaxScrollChange?: (maxScroll: number) => void
}

const UserMessage = React.memo(function UserMessage({ msg }: { msg: Message }) {
  const text = msg.parts
    .filter((p): p is Extract<MessagePart, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("")
  return (
    <Box flexShrink={0} flexDirection="column" marginBottom={1} paddingX={2}>
      <Box gap={1}>
        <Text color={C.blue} bold>▸ You</Text>
      </Box>
      <Box marginLeft={2}>
        <Text color={C.text} wrap="wrap">{text}</Text>
      </Box>
    </Box>
  )
})

const AssistantMessage = React.memo(function AssistantMessage({ msg, tick }: { msg: Message; tick: number }) {
  return (
    <Box flexShrink={0} flexDirection="column" marginBottom={1} paddingX={2}>
      <Box gap={1}>
        <Text color={C.brand} bold>⬡ Herald</Text>
        {msg.streaming && <Text color={C.surface2} dimColor>thinking…</Text>}
      </Box>
      {msg.parts.map((part, i) => {
        if (part.type === "tool") {
          return <ToolCard key={i} tool={part.call} tick={tick} />
        }
        if (!part.text) return null
        const lines = renderMarkdownInk(part.text)
        return (
          <Box key={i} flexDirection="column" marginLeft={2} marginBottom={1}>
            {lines.map((line, j) => <Box key={j}>{line}</Box>)}
          </Box>
        )
      })}
    </Box>
  )
})

function Divider() {
  const { stdout } = useStdout()
  const width = stdout?.columns ?? 80
  return (
    <Box flexShrink={0} paddingX={2} marginBottom={1}>
      <Text color={C.surface1}>{"─".repeat(Math.max(0, width - 4))}</Text>
    </Box>
  )
}

// A cheap signature that changes whenever rendered content changes,
// so the measure effect re-runs and we recompute the real content height.
function contentSignature(messages: Message[]): string {
  let sig = ""
  for (const m of messages) {
    sig += m.id + ":"
    for (const p of m.parts) {
      sig += p.type === "text" ? p.text.length : `t${p.call.output?.length ?? 0}`
      sig += ","
    }
    sig += "|"
  }
  return sig
}

export function MessageList({ messages, tick, scrollOffset = 0, viewportRows, onMaxScrollChange }: MessageListProps) {
  const innerRef = useRef<DOMElement>(null)
  const [contentHeight, setContentHeight] = useState(0)

  const sig = contentSignature(messages)

  // Measure the real rendered height of the content after layout.
  useLayoutEffect(() => {
    if (innerRef.current) {
      const { height } = measureElement(innerRef.current)
      setContentHeight(height)
      onMaxScrollChange?.(Math.max(0, height - viewportRows))
    }
  }, [sig, viewportRows, onMaxScrollChange])

  if (messages.length === 0) {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" height={viewportRows} paddingY={2}>
        <Text color={C.surface2}>Ask me to install, configure, or manage your AI agent tools.</Text>
        <Text color={C.surface1} dimColor>
          Try: "install claude code" · "add a daily standup cron" · "list my skills"
        </Text>
      </Box>
    )
  }

  // scrollOffset=0 → bottom pinned → push content up by (contentHeight - viewportRows)
  // scrollOffset=N → scrolled up N rows → push up by (contentHeight - viewportRows - N)
  const maxScroll = Math.max(0, contentHeight - viewportRows)
  const clamped = Math.min(Math.max(0, scrollOffset), maxScroll)
  const marginTop = -(maxScroll - clamped)

  return (
    // Fixed-height window; overflowY="hidden" clips whatever marginTop pushes out the top.
    // flexShrink={0} everywhere stops the fixed-height parent from squashing tall content.
    <Box height={viewportRows} overflowY="hidden" flexDirection="column">
      <Box ref={innerRef} flexShrink={0} flexDirection="column" marginTop={marginTop}>
        {messages.map((msg, i) => (
          <Box key={msg.id} flexShrink={0} flexDirection="column">
            {i > 0 && <Divider />}
            {msg.role === "user"
              ? <UserMessage msg={msg} />
              : <AssistantMessage msg={msg} tick={msg.streaming ? tick : 0} />
            }
          </Box>
        ))}
      </Box>
    </Box>
  )
}
