import React from "react"
import { Box, Text } from "ink"
import { C, SPINNER_FRAMES } from "../theme.js"

export type ToolStatus = "running" | "done" | "error"

export interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
  output?: string
  status: ToolStatus
}

interface ToolCardProps {
  tool: ToolCall
  tick: number
}

const TOOL_ICONS: Record<string, string> = {
  run_command:         "❯",
  read_file:           "○",
  write_file:          "◉",
  fetch_url:           "⌁",
  detect_environment:  "◎",
}

function truncate(s: string, max: number) {
  if (s.length <= max) return s
  return s.slice(0, max - 1) + "…"
}

function formatInput(input: Record<string, unknown>): string {
  const entries = Object.entries(input)
  if (entries.length === 0) return ""
  const [key, val] = entries[0]
  const str = typeof val === "string" ? val : JSON.stringify(val)
  return truncate(str, 60)
}

export function ToolCard({ tool, tick }: ToolCardProps) {
  const icon = TOOL_ICONS[tool.name] ?? "·"
  const spinner = SPINNER_FRAMES[tick % SPINNER_FRAMES.length]

  const statusIcon =
    tool.status === "running" ? (
      <Text color={C.yellow}>{spinner} </Text>
    ) : tool.status === "done" ? (
      <Text color={C.green}>✓ </Text>
    ) : (
      <Text color={C.red}>✗ </Text>
    )

  const detail = formatInput(tool.input)

  return (
    <Box flexDirection="column" marginLeft={2} marginBottom={0}>
      <Box flexDirection="row" gap={1}>
        {statusIcon}
        <Text color={C.brandDim}>{icon}</Text>
        <Text color={C.brand} bold>{tool.name}</Text>
        {detail ? <Text color={C.overlay1} dimColor>{detail}</Text> : null}
      </Box>
      {tool.status !== "running" && tool.output && (
        <Box marginLeft={4}>
          <Text color={C.surface2} wrap="truncate-end">
            {truncate(tool.output.trim().split("\n")[0] ?? "", 72)}
          </Text>
        </Box>
      )}
    </Box>
  )
}
