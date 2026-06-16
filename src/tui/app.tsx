import React, { useState, useEffect, useCallback, useRef } from "react"
import { Box, Text, useApp, useStdout } from "ink"
import { Header } from "./components/Header.js"
import { MessageList, type Message } from "./components/MessageList.js"
import { InputBar } from "./components/InputBar.js"
import { C, SPINNER_FRAMES } from "./theme.js"
import type { LLMProvider } from "../llm/types.js"
import type { ProviderConfig } from "../llm/types.js"
import { runAgentLoop, type ChatMessage } from "../llm/client.js"
import { createToolExecutor } from "../capabilities/index.js"
import { detectEnvironment } from "../utils/detect.js"
import type { ToolCall as ToolCallData } from "./components/ToolCard.js"

interface AppProps {
  provider: LLMProvider
  providerConfig: ProviderConfig
}

function modelLabel(config: ProviderConfig): string {
  if (config.type === "anthropic") return config.model ?? "claude-opus-4-8"
  return config.model
}

let _msgId = 0
const nextId = () => String(++_msgId)

export function App({ provider, providerConfig }: AppProps) {
  const { exit } = useApp()
  const { stdout } = useStdout()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [tick, setTick] = useState(0)
  const historyRef = useRef<ChatMessage[]>([])
  const executor = createToolExecutor()

  // Spinner ticker
  useEffect(() => {
    if (!busy) return
    const id = setInterval(() => setTick((t) => t + 1), 80)
    return () => clearInterval(id)
  }, [busy])

  const addUserMessage = (text: string) => {
    const msg: Message = { id: nextId(), role: "user", content: text }
    setMessages((prev) => [...prev, msg])
    return msg
  }

  const handleSubmit = useCallback(
    async (text: string) => {
      if (!text.trim() || busy) return
      setInput("")

      // Built-in command
      if (text.trim() === "/doctor") {
        addUserMessage(text.trim())
        setBusy(true)
        const result = await detectEnvironment()
        const id = nextId()
        setMessages((prev) => [...prev, { id, role: "assistant", content: result }])
        setBusy(false)
        return
      }

      addUserMessage(text.trim())
      historyRef.current.push({ role: "user", content: text.trim() })

      // Create assistant message placeholder
      const assistantId = nextId()
      const assistantMsg: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        streaming: true,
        toolCalls: [],
      }
      setMessages((prev) => [...prev, assistantMsg])
      setBusy(true)

      const toolCallMap = new Map<string, ToolCallData>()
      let toolSeq = 0

      try {
        // Wrapped executor: show card before, update after
        const wrappedExecutor = async (name: string, input: unknown) => {
          const id = `tc-${toolSeq++}`
          const tc: ToolCallData = {
            id,
            name,
            input: input as Record<string, unknown>,
            status: "running",
          }
          toolCallMap.set(id, tc)
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, toolCalls: [...(m.toolCalls ?? []), tc] }
                : m
            )
          )

          const result = await executor(name, input)

          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== assistantId) return m
              const updated = (m.toolCalls ?? []).map((t) =>
                t.id === id ? { ...t, status: "done" as const, output: result } : t
              )
              return { ...m, toolCalls: updated }
            })
          )
          return result
        }

        const reply = await runAgentLoop(
          provider,
          historyRef.current,
          wrappedExecutor,
          (text) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + text } : m
              )
            )
          },
          (_toolName, _toolInput) => {
            // onToolUse fires before execution; we handle display in wrappedExecutor instead
          }
        )

        historyRef.current.push({ role: "assistant", content: reply })
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, streaming: false } : m
          )
        )
      } catch (err) {
        const errText = err instanceof Error ? err.message : String(err)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `Error: ${errText}`, streaming: false }
              : m
          )
        )
      } finally {
        setBusy(false)
      }
    },
    [busy, provider]
  )

  const cols = stdout?.columns ?? 80
  const spinnerChar = SPINNER_FRAMES[tick % SPINNER_FRAMES.length]

  return (
    <Box flexDirection="column" width={cols}>
      <Header model={modelLabel(providerConfig)} providerType={providerConfig.type} />

      <Box flexDirection="column" flexGrow={1} overflowY="hidden">
        <MessageList messages={messages} tick={tick} />
      </Box>

      {busy && (
        <Box paddingX={3} marginBottom={0}>
          <Text color={C.yellow}>{spinnerChar} </Text>
          <Text color={C.overlay0} dimColor>Herald is working…</Text>
        </Box>
      )}

      <InputBar
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        disabled={busy}
      />
    </Box>
  )
}
