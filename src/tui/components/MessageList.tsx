import React from "react"
import { Box, Text, useStdout } from "ink"
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
}

function UserMessage({ msg }: { msg: Message }) {
  const text = msg.parts.filter((p): p is Extract<MessagePart, { type: "text" }> => p.type === "text").map(p => p.text).join("")
  return (
    <Box flexDirection="column" marginBottom={1} paddingX={2}>
      <Box gap={1} marginBottom={0}>
        <Text color={C.blue} bold>▸ You</Text>
      </Box>
      <Box marginLeft={2}>
        <Text color={C.text} wrap="wrap">{text}</Text>
      </Box>
    </Box>
  )
}

function AssistantMessage({ msg, tick }: { msg: Message; tick: number }) {
  return (
    <Box flexDirection="column" marginBottom={1} paddingX={2}>
      <Box gap={1} marginBottom={0}>
        <Text color={C.brand} bold>⬡ Herald</Text>
        {msg.streaming && (
          <Text color={C.surface2} dimColor>thinking…</Text>
        )}
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
}

function Divider() {
  const { stdout } = useStdout()
  const width = stdout?.columns ?? 80
  return (
    <Box paddingX={2} marginBottom={1}>
      <Text color={C.surface1}>{"─".repeat(Math.max(0, width - 4))}</Text>
    </Box>
  )
}

export function MessageList({ messages, tick }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1} paddingY={2}>
        <Text color={C.surface2}>Ask me to install, configure, or manage your AI agent tools.</Text>
        <Text color={C.surface1} dimColor>Try: "install claude code" · "add a daily standup cron" · "list my skills"</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      {messages.map((msg, i) => (
        <Box key={msg.id} flexDirection="column">
          {i > 0 && <Divider />}
          {msg.role === "user"
            ? <UserMessage msg={msg} />
            : <AssistantMessage msg={msg} tick={tick} />
          }
        </Box>
      ))}
    </Box>
  )
}
