import type { ChatMessage, LLMProvider } from "../llm/types.js"
import type { HeraldSession } from "./types.js"

const CHARS_PER_TOKEN = 4
const KEEP_TOKENS = 8_000
const COMPACTION_BUFFER = 20_000
const TOOL_OUTPUT_MAX_CHARS = 2_000

const SUMMARY_PROMPT = `Output exactly the Markdown structure shown inside <template> and keep the section order unchanged. Do not include the <template> tags in your response.
<template>
## Goal
- [single-sentence task summary]

## Constraints & Preferences
- [user constraints, preferences, or "(none)"]

## Progress
### Done
- [completed work or "(none)"]

### In Progress
- [current work or "(none)"]

### Blocked
- [blockers or "(none)"]

## Key Decisions
- [decision and why, or "(none)"]

## Next Steps
- [ordered next actions or "(none)"]

## Critical Context
- [important technical facts, errors, open questions, or "(none)"]

## Relevant Files
- [file or directory path: why it matters, or "(none)"]
</template>

Rules:
- Keep every section, even when empty.
- Use terse bullets, not prose paragraphs.
- Preserve exact file paths, commands, error strings, and identifiers when known.
- Do not mention the summary process or that context was compacted.`

export function estimateTokens(messages: ChatMessage[]): number {
  return Math.round(JSON.stringify(messages).length / CHARS_PER_TOKEN)
}

export function shouldCompact(session: HeraldSession, maxContextTokens: number): boolean {
  const tokens = session.lastTokenCount > 0
    ? session.lastTokenCount
    : estimateTokens(session.messages)
  return tokens > maxContextTokens - COMPACTION_BUFFER
}

function truncate(s: string): string {
  return s.length <= TOOL_OUTPUT_MAX_CHARS ? s : `${s.slice(0, TOOL_OUTPUT_MAX_CHARS)}\n[truncated]`
}

function serializeMessage(msg: ChatMessage): string {
  if (msg.role === "user") return `[User]: ${msg.content}`
  if (msg.role === "assistant") {
    const parts: string[] = []
    if (msg.content) parts.push(`[Assistant]: ${msg.content}`)
    for (const tc of msg.toolCalls ?? []) {
      parts.push(`[Tool call]: ${tc.name}(${JSON.stringify(tc.input)})`)
    }
    return parts.join("\n")
  }
  if (msg.role === "tool") {
    return msg.results.map((r) => `[Tool result ${r.toolCallId}]: ${truncate(r.content)}`).join("\n")
  }
  return ""
}

// 返回：head 序列化文本（待压缩）+ recent 原始 messages（保留进 session）
function splitMessages(messages: ChatMessage[]): { headText: string; recentMessages: ChatMessage[] } {
  let recentTokens = 0
  let splitIdx = messages.length

  for (let i = messages.length - 1; i >= 0; i--) {
    const t = Math.round(JSON.stringify(messages[i]).length / CHARS_PER_TOKEN)
    if (recentTokens + t > KEEP_TOKENS) break
    recentTokens += t
    splitIdx = i
  }

  const headMessages = messages.slice(0, splitIdx)
  const recentMessages = messages.slice(splitIdx)
  const headText = headMessages.map(serializeMessage).filter(Boolean).join("\n\n")

  return { headText, recentMessages }
}

export async function compactHistory(
  provider: LLMProvider,
  session: HeraldSession
): Promise<void> {
  if (session.messages.length === 0) return

  const { headText, recentMessages } = splitMessages(session.messages)
  if (!headText) return

  const promptParts: string[] = []

  if (session.summary) {
    promptParts.push(
      `Below is an existing summary followed by new conversation history.\nUpdate the summary: preserve still-true details, remove stale ones, merge in new facts.\n\n<previous-summary>\n${session.summary}\n</previous-summary>\n\nNew conversation history to merge:\n${headText}`
    )
  } else {
    promptParts.push(
      `Create a summary from the conversation history below.\n\n${headText}`
    )
  }

  promptParts.push(SUMMARY_PROMPT)

  let summary = ""
  try {
    await provider.chat(
      "You are a precise summarizer. Follow the template exactly.",
      [{ role: "user", content: promptParts.join("\n\n") }],
      [],
      (text) => { summary += text },
      () => {}
    )
  } catch {
    return
  }

  if (!summary.trim()) return

  session.summary = summary
  session.messages = recentMessages
  session.lastTokenCount = 0
}
