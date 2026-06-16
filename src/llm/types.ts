export interface ToolCall {
  id: string
  name: string
  input: unknown
}

export interface AssistantMessage {
  text: string
  toolCalls: ToolCall[]
}

export type ToolResult = {
  toolCallId: string
  content: string
}

export type ChatMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: ToolCall[] }
  | { role: "tool"; results: ToolResult[] }

export interface ToolDef {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export type ToolExecutor = (name: string, input: unknown) => Promise<string>

export interface LLMProvider {
  chat(
    system: string,
    messages: ChatMessage[],
    tools: ToolDef[],
    onText: (text: string) => void,
    onToolCall: (name: string, input: unknown) => void
  ): Promise<AssistantMessage>
}

// ── Config shapes ────────────────────────────────────────────────────────────

export interface AnthropicProviderConfig {
  type: "anthropic"
  apiKey?: string
  model?: string
  baseURL?: string
}

export interface OpenAICompatibleProviderConfig {
  type: "openai-compatible"
  baseURL: string
  apiKey?: string
  model: string
  headers?: Record<string, string>
}

export type ProviderConfig = AnthropicProviderConfig | OpenAICompatibleProviderConfig

export interface HeraldConfig {
  provider: ProviderConfig
}
