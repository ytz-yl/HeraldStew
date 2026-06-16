// Converts markdown text to an array of <Box><Text> React elements for ink rendering.
// Must be called on the full final string, NOT on streaming chunks.
import React, { type ReactElement } from "react"
import { Box, Text } from "ink"
import { C } from "./theme.js"

export function renderMarkdownInk(md: string): ReactElement[] {
  if (!md.trim()) return []
  const lines = md.split("\n")
  const result: ReactElement[] = []
  let codeLines: string[] = []
  let codeLang = ""
  let inCode = false
  let key = 0
  const k = () => String(key++)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith("```")) {
      if (!inCode) {
        inCode = true
        codeLang = line.slice(3).trim()
        codeLines = []
      } else {
        inCode = false
        result.push(
          <Box key={k()} flexDirection="column" marginY={0}>
            <Box>
              <Text backgroundColor={C.surface0} color={C.subtext0}> {codeLang || "code"} </Text>
            </Box>
            {codeLines.map((cl, ci) => (
              <Box key={ci}>
                <Text backgroundColor={C.mantle} color={C.text}> {cl} </Text>
              </Box>
            ))}
          </Box>
        )
      }
      continue
    }

    if (inCode) {
      codeLines.push(line)
      continue
    }

    if (!line.trim()) {
      result.push(<Box key={k()} />)
      continue
    }

    const h1 = line.match(/^# (.+)$/)
    const h2 = line.match(/^## (.+)$/)
    const h3 = line.match(/^### (.+)$/)
    if (h1) { result.push(<Text key={k()} bold underline color={C.text}>{h1[1]}</Text>); continue }
    if (h2) { result.push(<Text key={k()} bold color={C.brand}>{h2[1]}</Text>); continue }
    if (h3) { result.push(<Text key={k()} bold color={C.sky}>{h3[1]}</Text>); continue }

    if (line.match(/^[-*_]{3,}$/)) {
      result.push(<Text key={k()} color={C.surface2}>{"─".repeat(60)}</Text>)
      continue
    }

    const ul = line.match(/^(\s*)([-*+]) (.+)$/)
    if (ul) {
      result.push(
        <Box key={k()} flexDirection="row">
          <Text>{ul[1]}</Text>
          <Text color={C.brandDim}>• </Text>
          <Text color={C.text} wrap="wrap">{inlineText(ul[3])}</Text>
        </Box>
      )
      continue
    }

    const ol = line.match(/^(\s*)(\d+)\. (.+)$/)
    if (ol) {
      result.push(
        <Box key={k()} flexDirection="row">
          <Text>{ol[1]}</Text>
          <Text color={C.brand}>{ol[2]}. </Text>
          <Text color={C.text} wrap="wrap">{inlineText(ol[3])}</Text>
        </Box>
      )
      continue
    }

    if (line.startsWith("> ")) {
      result.push(
        <Box key={k()} flexDirection="row">
          <Text color={C.surface2}>│ </Text>
          <Text color={C.subtext0} italic>{inlineText(line.slice(2))}</Text>
        </Box>
      )
      continue
    }

    result.push(
      <Text key={k()} color={C.text} wrap="wrap">{inlineText(line)}</Text>
    )
  }

  return result
}

// Inline markdown: returns plain string with bold/italic replaced by unicode approximations
// (ink's <Text bold> only applies to the whole element; for mixed-style inline, we use plain text)
function inlineText(s: string): string {
  return s
    .replace(/`([^`]+)`/g, (_, m) => `[${m}]`)
    .replace(/\*\*\*(.+?)\*\*\*/g, (_, m) => m)
    .replace(/\*\*(.+?)\*\*/g, (_, m) => m)
    .replace(/__(.+?)__/g, (_, m) => m)
    .replace(/\*(.+?)\*/g, (_, m) => m)
    .replace(/_(.+?)_/g, (_, m) => m)
    .replace(/~~(.+?)~~/g, (_, m) => m)
    .replace(/\[(.+?)\]\(.+?\)/g, (_, label) => label)
}
