import React, { useState, useEffect, useCallback, useRef } from "react"
import { Box, Text, useApp, useStdout } from "ink"
import { Header } from "./components/Header.js"
import { MessageList, type Message, type MessagePart } from "./components/MessageList.js"
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
  const { exit: _exit } = useApp()
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

      // Restore UI messages from history, reconstructing ordered parts
      const restored: Message[] = []
      const toolResultsMap = new Map<string, string>()
      for (const msg of session.messages) {
        if (msg.role === "tool") {
          for (const r of msg.results) toolResultsMap.set(r.toolCallId, r.content)
        }
      }

      // One UI assistant message per user turn, parts in order
      let assistantParts: MessagePart[] = []
      let assistantId: string | null = null

      const flushAssistant = () => {
        if (assistantId && assistantParts.length > 0) {
          restored.push({ id: assistantId, role: "assistant", parts: assistantParts })
        }
        assistantParts = []
        assistantId = null
      }

      for (const msg of session.messages) {
        if (msg.role === "user") {
          flushAssistant()
          restored.push({ id: nextId(), role: "user", parts: [{ type: "text", text: msg.content }] })
        } else if (msg.role === "assistant") {
          if (!assistantId) assistantId = nextId()
          if (msg.content) {
            assistantParts.push({ type: "text", text: msg.content })
          }
          for (const tc of msg.toolCalls ?? []) {
            assistantParts.push({
              type: "tool",
              call: {
                id: tc.id,
                name: tc.name,
                input: tc.input as Record<string, unknown>,
                status: "done",
                output: toolResultsMap.get(tc.id),
              },
            })
          }
        }
        // role === "tool": consumed into toolResultsMap
      }
      flushAssistant()

      if (restored.length > 0) setMessages(restored)
    })
  }, [])

  // Spinner ticker
  useEffect(() => {
    if (!busy) return
    const id = setInterval(() => setTick((t) => t + 1), 80)
    return () => clearInterval(id)
  }, [busy])

  const handleSubmit = useCallback(
    async (text: string) => {
      if (!text.trim() || busy) return
      setInput("")

      // Built-in /doctor command
      if (text.trim() === "/doctor") {
        setMessages((prev) => [...prev, { id: nextId(), role: "user", parts: [{ type: "text", text: text.trim() }] }])
        setBusy(true)
        const result = await detectEnvironment()
        setMessages((prev) => [...prev, { id: nextId(), role: "assistant", parts: [{ type: "text", text: result }] }])
        setBusy(false)
        return
      }

      setMessages((prev) => [...prev, { id: nextId(), role: "user", parts: [{ type: "text", text: text.trim() }] }])
      historyRef.current.push({ role: "user", content: text.trim() })

      const assistantId = nextId()
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", streaming: true, parts: [] }])
      setBusy(true)

      let toolSeq = 0

      // Helper: append a part to the assistant message
      const appendPart = (part: MessagePart) => {
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, parts: [...m.parts, part] } : m)
        )
      }

      // Helper: update the last tool part in the assistant message
      const updateLastTool = (tcId: string, updater: (tc: ToolCallData) => ToolCallData) => {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId) return m
            const parts = [...m.parts]
            for (let i = parts.length - 1; i >= 0; i--) {
              const p = parts[i]
              if (p.type === "tool" && p.call.id === tcId) {
                parts[i] = { type: "tool", call: updater(p.call) }
                break
              }
            }
            return { ...m, parts }
          })
        )
      }

      try {
        const wrappedExecutor = async (name: string, input: unknown) => {
          const tcId = `tc-${toolSeq++}`
          const tc: ToolCallData = { id: tcId, name, input: input as Record<string, unknown>, status: "running" }
          appendPart({ type: "tool", call: tc })

          const result = await executor(name, input, (chunk) => {
            updateLastTool(tcId, (t) => ({ ...t, output: ((t.output ?? "") + chunk).slice(-2000) }))
          })

          updateLastTool(tcId, (t) => ({ ...t, status: "done", output: result }))

          // Persist after every tool call so partial progress survives errors
          if (sessionRef.current) {
            sessionRef.current.messages = historyRef.current
            await saveSession(sessionRef.current)
          }

          return result
        }

        const session = sessionRef.current
        const loopResult = await runAgentLoop(
          provider,
          historyRef.current,
          wrappedExecutor,
          (chunk) => {
            // Append to last text part, or create a new one
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantId) return m
                const parts = [...m.parts]
                const last = parts[parts.length - 1]
                if (last?.type === "text") {
                  parts[parts.length - 1] = { type: "text", text: last.text + chunk }
                } else {
                  parts.push({ type: "text", text: chunk })
                }
                return { ...m, parts }
              })
            )
          },
          (_toolName, _toolInput) => {},
          session
            ? { summary: session.summary, summaryRecent: session.summaryRecent }
            : undefined
        )

        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, streaming: false } : m)
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
          prev.map((m) => {
            if (m.id !== assistantId) return m
            const parts = [...m.parts]
            const last = parts[parts.length - 1]
            if (last?.type === "text") {
              parts[parts.length - 1] = { type: "text", text: last.text + `\n\nError: ${errText}` }
            } else {
              parts.push({ type: "text", text: `Error: ${errText}` })
            }
            return { ...m, parts, streaming: false }
          })
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
