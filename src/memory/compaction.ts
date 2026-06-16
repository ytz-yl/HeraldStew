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

function splitRecent(messages: ChatMessage[]): { head: string; recent: string } {
  const serialized = messages.map(serializeMessage).filter(Boolean)
  let recentTokens = 0
  let splitIdx = serialized.length
  for (let i = serialized.length - 1; i >= 0; i--) {
    const t = Math.round(serialized[i].length / CHARS_PER_TOKEN)
    if (recentTokens + t > KEEP_TOKENS) break
    recentTokens += t
    splitIdx = i
  }
  return {
    head: serialized.slice(0, splitIdx).join("\n\n"),
    recent: serialized.slice(splitIdx).join("\n\n"),
  }
}

export async function compactHistory(
  provider: LLMProvider,
  session: HeraldSession
): Promise<void> {
  if (session.messages.length === 0) return

  const { head, recent } = splitRecent(session.messages)
  if (!head) return

  const promptParts: string[] = []
  if (session.summary) {
    promptParts.push(
      `Update the anchored summary below using the conversation history above.\nPreserve still-true details, remove stale details, and merge in the new facts.\n<previous-summary>\n${session.summary}\n</previous-summary>`
    )
  } else {
    promptParts.push("Create a new anchored summary from the conversation history.")
  }
  promptParts.push(SUMMARY_PROMPT)
  if (session.summaryRecent) promptParts.push(session.summaryRecent)
  promptParts.push(head)

  const summaryUserMsg = promptParts.join("\n\n")

  let summary = ""
  try {
    await provider.chat(
      "You are a precise summarizer. Follow the template exactly.",
      [{ role: "user", content: summaryUserMsg }],
      [],
      (text) => { summary += text },
      () => {}
    )
  } catch {
    return
  }

  if (!summary.trim()) return

  session.summary = summary
  session.summaryRecent = recent
  session.messages = []
  session.lastTokenCount = 0
}
