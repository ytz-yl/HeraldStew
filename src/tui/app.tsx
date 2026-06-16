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
import { loadSession, saveSession } from "../memory/store.js"
import { shouldCompact, compactHistory, estimateTokens } from "../memory/compaction.js"
import type { HeraldSession } from "../memory/types.js"

interface AppProps {
  provider: LLMProvider
  providerConfig: ProviderConfig
  maxContextTokens: number
}

function modelLabel(config: ProviderConfig): string {
  if (config.type === "anthropic") return config.model ?? "claude-opus-4-8"
  return config.model
}

let _msgId = 0
const nextId = () => String(++_msgId)

export function App({ provider, providerConfig, maxContextTokens }: AppProps) {
  const { exit } = useApp()
  const { stdout } = useStdout()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [tick, setTick] = useState(0)
  const historyRef = useRef<ChatMessage[]>([])
  const sessionRef = useRef<HeraldSession | null>(null)
  const executor = createToolExecutor()

  // Load persisted session on mount
  useEffect(() => {
    loadSession().then((session) => {
      sessionRef.current = session
      historyRef.current = session.messages

      // Restore UI messages from history, including tool calls
      const restored: Message[] = []

      // Collect all tool results by id for quick lookup
      const toolResultsMap = new Map<string, string>()
      for (const msg of session.messages) {
        if (msg.role === "tool") {
          for (const r of msg.results) toolResultsMap.set(r.toolCallId, r.content)
        }
      }

      // Group messages by turn: (assistant+tool)* rounds → one UI message
      let pendingToolCalls: ToolCallData[] = []
      for (const msg of session.messages) {
        if (msg.role === "user") {
          restored.push({ id: nextId(), role: "user", content: msg.content })
          pendingToolCalls = []
        } else if (msg.role === "assistant") {
          if (msg.toolCalls && msg.toolCalls.length > 0) {
            // Intermediate round: accumulate tool calls with their outputs
            for (const tc of msg.toolCalls) {
              pendingToolCalls.push({
                id: tc.id,
                name: tc.name,
                input: tc.input as Record<string, unknown>,
                status: "done",
                output: toolResultsMap.get(tc.id),
              })
            }
          } else if (msg.content) {
            // Final round: emit one assistant UI message with all accumulated tool calls
            restored.push({
              id: nextId(),
              role: "assistant",
              content: msg.content,
              toolCalls: pendingToolCalls,
            })
            pendingToolCalls = []
          }
        }
        // role === "tool": already consumed into toolResultsMap
      }
      if (restored.length > 0) setMessages(restored)
    })
  }, [])

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

      // Built-in /doctor command
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

      let toolSeq = 0

      try {
        const wrappedExecutor = async (name: string, input: unknown) => {
          const id = `tc-${toolSeq++}`
          const tc: ToolCallData = {
            id,
            name,
            input: input as Record<string, unknown>,
            status: "running",
          }
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

        const session = sessionRef.current
        const loopResult = await runAgentLoop(
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
          (_toolName, _toolInput) => {},
          session
            ? { summary: session.summary, summaryRecent: session.summaryRecent }
            : undefined
        )

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, streaming: false } : m
          )
        )

        // Persist session
        if (sessionRef.current) {
          sessionRef.current.messages = historyRef.current
          sessionRef.current.lastTokenCount =
            loopResult.inputTokens > 0
              ? loopResult.inputTokens
              : estimateTokens(historyRef.current)
          await saveSession(sessionRef.current)

          // Compact if needed
          if (shouldCompact(sessionRef.current, maxContextTokens)) {
            await compactHistory(provider, sessionRef.current)
            historyRef.current = sessionRef.current.messages
            await saveSession(sessionRef.current)
          }
        }
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
    [busy, provider, maxContextTokens]
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
