import type { LLMProvider, ChatMessage, ToolExecutor, ToolDef, ToolCall } from "./types.js"
import { buildSystemPrompt } from "./prompts.js"
import { HERALD_TOOLS } from "./tools.js"

export type { ChatMessage }

export interface AgentLoopResult {
  text: string
  inputTokens: number
}

export async function runAgentLoop(
  provider: LLMProvider,
  messages: ChatMessage[],
  executor: ToolExecutor,
  onText: (text: string) => void,
  onToolUse: (name: string, input: unknown) => void,
  context?: { summary?: string; summaryRecent?: string }
): Promise<AgentLoopResult> {
  const history = messages
  const systemPrompt = buildSystemPrompt(context?.summary, context?.summaryRecent)
  let totalInputTokens = 0

  while (true) {
    const response = await provider.chat(
      systemPrompt,
      history,
      HERALD_TOOLS as ToolDef[],
      onText,
      onToolUse
    )

    if (response.usage) {
      totalInputTokens = response.usage.inputTokens
    }

    if (response.toolCalls.length === 0) {
      history.push({ role: "assistant", content: response.text })
      return { text: response.text, inputTokens: totalInputTokens }
    }

    history.push({
      role: "assistant",
      content: response.text,
      toolCalls: response.toolCalls,
    })

    const results = await Promise.all(
      response.toolCalls.map(async (tc: ToolCall) => {
        const content = await executor(tc.name, tc.input)
        return { toolCallId: tc.id, content }
      })
    )

    history.push({ role: "tool", results })
  }
}
