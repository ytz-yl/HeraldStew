import OpenAI from "openai"
import type { LLMProvider, ChatMessage, ToolDef, AssistantMessage, ToolCall } from "../types.js"
import type { OpenAICompatibleProviderConfig } from "../types.js"

function toOpenAIMessages(
  system: string,
  messages: ChatMessage[]
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const result: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: system },
  ]

  for (const msg of messages) {
    if (msg.role === "user") {
      result.push({ role: "user", content: msg.content })
    } else if (msg.role === "assistant") {
      const toolCalls = msg.toolCalls?.map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.input),
        },
      }))
      result.push({
        role: "assistant",
        content: msg.content || null,
        ...(toolCalls?.length ? { tool_calls: toolCalls } : {}),
      })
    } else if (msg.role === "tool") {
      for (const r of msg.results) {
        result.push({
          role: "tool",
          tool_call_id: r.toolCallId,
          content: r.content,
        })
      }
    }
  }

  return result
}

function toOpenAITools(tools: ToolDef[]): OpenAI.Chat.ChatCompletionTool[] {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }))
}

export class OpenAICompatibleProvider implements LLMProvider {
  private client: OpenAI
  private model: string

  constructor(config: OpenAICompatibleProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey ?? "no-key",
      baseURL: config.baseURL,
      defaultHeaders: config.headers,
    })
    this.model = config.model
  }

  async chat(
    system: string,
    messages: ChatMessage[],
    tools: ToolDef[],
    onText: (text: string) => void,
    onToolCall: (name: string, input: unknown) => void
  ): Promise<AssistantMessage> {
    const oaiMessages = toOpenAIMessages(system, messages)
    const oaiTools = tools.length > 0 ? toOpenAITools(tools) : undefined

    // streaming response
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: oaiMessages,
      ...(oaiTools ? { tools: oaiTools, tool_choice: "auto" } : {}),
      stream: true,
      stream_options: { include_usage: true },
    })

    let fullText = ""
    let usageInputTokens = 0
    let usageOutputTokens = 0
    const toolCallAccumulators: Map<
      number,
      { id: string; name: string; argsRaw: string }
    > = new Map()

    for await (const chunk of stream) {
      if (chunk.usage) {
        usageInputTokens = chunk.usage.prompt_tokens ?? 0
        usageOutputTokens = chunk.usage.completion_tokens ?? 0
      }
      const delta = chunk.choices[0]?.delta
      if (!delta) continue

      if (delta.content) {
        fullText += delta.content
        onText(delta.content)
      }

      for (const tc of delta.tool_calls ?? []) {
        const idx = tc.index
        if (!toolCallAccumulators.has(idx)) {
          toolCallAccumulators.set(idx, {
            id: tc.id ?? "",
            name: tc.function?.name ?? "",
            argsRaw: "",
          })
        }
        const acc = toolCallAccumulators.get(idx)!
        if (tc.id) acc.id = tc.id
        if (tc.function?.name) acc.name = tc.function.name
        if (tc.function?.arguments) acc.argsRaw += tc.function.arguments
      }
    }

    const toolCalls: ToolCall[] = []
    for (const [, acc] of toolCallAccumulators) {
      let input: unknown = {}
      try {
        input = JSON.parse(acc.argsRaw)
      } catch {
        input = acc.argsRaw
      }
      onToolCall(acc.name, input)
      toolCalls.push({ id: acc.id, name: acc.name, input })
    }

    return {
      text: fullText,
      toolCalls,
      ...(usageInputTokens > 0
        ? { usage: { inputTokens: usageInputTokens, outputTokens: usageOutputTokens } }
        : {}),
    }
  }
}
