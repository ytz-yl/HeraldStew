import type { LLMProvider, ChatMessage, ToolExecutor, ToolDef, ToolCall } from "./types.js"
import { SYSTEM_PROMPT } from "./prompts.js"
import { HERALD_TOOLS } from "./tools.js"

export type { ChatMessage }

export async function runAgentLoop(
  provider: LLMProvider,
  messages: ChatMessage[],
  executor: ToolExecutor,
  onText: (text: string) => void,
  onToolUse: (name: string, input: unknown) => void
): Promise<string> {
  const history: ChatMessage[] = [...messages]

  while (true) {
    const response = await provider.chat(
      SYSTEM_PROMPT,
      history,
      HERALD_TOOLS as ToolDef[],
      onText,
      onToolUse
    )

    if (response.toolCalls.length === 0) {
      history.push({ role: "assistant", content: response.text })
      return response.text
    }

    // append assistant turn with tool calls
    history.push({
      role: "assistant",
      content: response.text,
      toolCalls: response.toolCalls,
    })

    // execute all tool calls and collect results
    const results = await Promise.all(
      response.toolCalls.map(async (tc: ToolCall) => {
        const content = await executor(tc.name, tc.input)
        return { toolCallId: tc.id, content }
      })
    )

    history.push({ role: "tool", results })
  }
}
