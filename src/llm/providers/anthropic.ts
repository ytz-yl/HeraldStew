import Anthropic from "@anthropic-ai/sdk"
import type { LLMProvider, ChatMessage, ToolDef, AssistantMessage, ToolCall } from "../types.js"
import type { AnthropicProviderConfig } from "../types.js"

export const DEFAULT_MODEL = "claude-opus-4-8"

function toAnthropicMessages(messages: ChatMessage[]): Anthropic.MessageParam[] {
  const result: Anthropic.MessageParam[] = []

  for (const msg of messages) {
    if (msg.role === "user") {
      result.push({ role: "user", content: msg.content })
    } else if (msg.role === "assistant") {
      const content: Anthropic.ContentBlockParam[] = []
      if (msg.content) content.push({ type: "text", text: msg.content })
      for (const tc of msg.toolCalls ?? []) {
        content.push({
          type: "tool_use",
          id: tc.id,
          name: tc.name,
          input: tc.input as Record<string, unknown>,
        })
      }
      if (content.length > 0) result.push({ role: "assistant", content })
    } else if (msg.role === "tool") {
      result.push({
        role: "user",
        content: msg.results.map((r) => ({
          type: "tool_result" as const,
          tool_use_id: r.toolCallId,
          content: r.content,
        })),
      })
    }
  }

  return result
}

function toAnthropicTools(tools: ToolDef[]): Anthropic.Tool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as Anthropic.Tool["input_schema"],
  }))
}

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic
  private model: string

  constructor(config: AnthropicProviderConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey ?? process.env.ANTHROPIC_API_KEY,
      ...(config.baseURL ? { baseURL: config.baseURL } : {}),
    })
    this.model = config.model ?? DEFAULT_MODEL
  }

  async chat(
    system: string,
    messages: ChatMessage[],
    tools: ToolDef[],
    onText: (text: string) => void,
    onToolCall: (name: string, input: unknown) => void
  ): Promise<AssistantMessage> {
    const anthropicMessages = toAnthropicMessages(messages)
    const anthropicTools = toAnthropicTools(tools)

    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      system,
      tools: anthropicTools,
      messages: anthropicMessages,
    })

    const response = await stream.finalMessage()

    const textBlocks = response.content.filter(
      (b): b is Anthropic.TextBlock => b.type === "text"
    )
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    )

    const text = textBlocks.map((b) => b.text).join("")
    if (text) onText(text)

    const toolCalls: ToolCall[] = toolUseBlocks.map((b) => {
      onToolCall(b.name, b.input)
      return { id: b.id, name: b.name, input: b.input }
    })

    return { text, toolCalls }
  }
}
