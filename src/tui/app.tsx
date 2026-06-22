import React, { useState, useEffect, useCallback, useRef } from "react"
import { Box, Text, useApp, useStdout, useInput } from "ink"
import { Header } from "./components/Header.js"
import { MessageList, type Message, type MessagePart } from "./components/MessageList.js"
import { InputBar } from "./components/InputBar.js"
import { Dashboard } from "./components/Dashboard.js"
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
import { getDashboardData, getDashboardLiveData, getStaticInfoCached } from "../agents/dashboard.js"
import type { AgentStatus, AgentStaticInfo, ProjectGroup } from "../agents/observer.js"

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
  // scrollOffset: lines scrolled up from the bottom (0 = pinned to newest, positive = scrolled up)
  const [scrollOffset, setScrollOffset] = useState(0)
  const manualScrollRef = useRef(false)
  // Max scrollable rows, reported by MessageList from its measured content height.
  const maxScrollRef = useRef(0)
  const [showDashboard, setShowDashboard] = useState(false)
  const [dashboardData, setDashboardData] = useState<{ statuses: AgentStatus[]; projects: ProjectGroup[] } | null>(null)
  const [dashCursor, setDashCursor] = useState(0)
  const [dashExpanded, setDashExpanded] = useState<Set<string>>(new Set())
  const staticsRef = useRef<AgentStaticInfo[] | null>(null)
  const historyRef = useRef<ChatMessage[]>([])
  const sessionRef = useRef<HeraldSession | null>(null)
  const executor = createToolExecutor()

  useEffect(() => {
    if (showDashboard) {
      setInput("")
    }
  }, [showDashboard])

  // 30s live 轮询，只在 dashboard 可见时运行
  useEffect(() => {
    if (!showDashboard) return
    const statics = staticsRef.current
    if (!statics) return

    const refresh = () => {
      getDashboardLiveData(statics).then(setDashboardData).catch(() => {})
    }

    const id = setInterval(refresh, 30_000)
    return () => clearInterval(id)
  }, [showDashboard])

  const toggleDashboard = useCallback(async () => {
    if (busy) return
    if (showDashboard) {
      setShowDashboard(false)
      setDashCursor(0)
      setDashExpanded(new Set())
    } else {
      // 先立即显示（用缓存数据或 loading）
      setShowDashboard(true)
      setDashCursor(0)
      setDashExpanded(new Set())
      try {
        // 如果有缓存直接用；没有就触发完整加载
        if (staticsRef.current && dashboardData) {
          getDashboardLiveData(staticsRef.current).then(setDashboardData).catch(() => {})
        } else {
          const data = await getDashboardData()
          staticsRef.current = await getStaticInfoCached()
          setDashboardData(data)
        }
      } catch { /* ignore */ }
    }
  }, [showDashboard, busy, dashboardData])

  useEffect(() => {
    loadSession().then((session) => {
      sessionRef.current = session
      historyRef.current = session.messages

      const restored: Message[] = []
      const toolResultsMap = new Map<string, string>()
      for (const msg of session.messages) {
        if (msg.role === "tool") {
          for (const r of msg.results) toolResultsMap.set(r.toolCallId, r.content)
        }
      }

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
      }
      flushAssistant()

      if (restored.length > 0) setMessages(restored)
    })
  }, [])

  useEffect(() => {
    if (!busy) return
    const id = setInterval(() => setTick((t) => t + 1), 80)
    return () => clearInterval(id)
  }, [busy])

  useInput((inputChar, key) => {
    if (key.ctrl && inputChar === "d") {
      toggleDashboard()
      return
    }

    if (showDashboard && dashboardData) {
      const projectCount = dashboardData.projects.length
      if (projectCount === 0) return

      if (key.upArrow) {
        setDashCursor((c) => Math.max(0, c - 1))
      } else if (key.downArrow) {
        setDashCursor((c) => Math.min(projectCount - 1, c + 1))
      } else if (key.return || key.rightArrow) {
        const project = dashboardData.projects[dashCursor]?.project
        if (project) {
          setDashExpanded((prev) => {
            const next = new Set(prev)
            if (next.has(project)) next.delete(project)
            else next.add(project)
            return next
          })
        }
      } else if (key.leftArrow) {
        const project = dashboardData.projects[dashCursor]?.project
        if (project) {
          setDashExpanded((prev) => {
            const next = new Set(prev)
            next.delete(project)
            return next
          })
        }
      }
    } else {
      if (key.upArrow) {
        // scroll up = see older content = increase offset from bottom (clamped to measured max)
        manualScrollRef.current = true
        setScrollOffset((o) => Math.min(maxScrollRef.current, (isFinite(o) ? o : 0) + 3))
      } else if (key.downArrow) {
        // scroll down = return to newer content = decrease offset toward 0 (bottom)
        setScrollOffset((o) => {
          const newO = Math.max(0, (isFinite(o) ? o : 0) - 3)
          if (newO === 0) manualScrollRef.current = false
          return newO
        })
      }
    }
  })

  const handleSubmit = useCallback(
    async (text: string) => {
      if (!text.trim() || busy) return
      setInput("")
      manualScrollRef.current = false
      setScrollOffset(0) // 0 = pinned to bottom in new semantics

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

      const appendPart = (part: MessagePart) => {
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, parts: [...m.parts, part] } : m)
        )
      }

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

      let pendingText = ""
      let lastTextFlush = 0
      const flushText = (force = false) => {
        if (!pendingText) return
        const now = Date.now()
        if (!force && now - lastTextFlush < 50) return
        lastTextFlush = now
        const s = pendingText
        pendingText = ""
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId) return m
            const parts = [...m.parts]
            const last = parts[parts.length - 1]
            if (last?.type === "text") {
              parts[parts.length - 1] = { type: "text", text: last.text + s }
            } else {
              parts.push({ type: "text", text: s })
            }
            return { ...m, parts }
          })
        )
      }

      const pendingToolOutput = new Map<string, string>()
      let lastToolFlush = 0
      const flushToolOutput = (tcId: string, force = false) => {
        const pending = pendingToolOutput.get(tcId)
        if (!pending) return
        const now = Date.now()
        if (!force && now - lastToolFlush < 50) return
        lastToolFlush = now
        pendingToolOutput.delete(tcId)
        updateLastTool(tcId, (t) => ({ ...t, output: ((t.output ?? "") + pending).slice(-2000) }))
      }

      try {
        const wrappedExecutor = async (name: string, execInput: unknown) => {
          flushText(true)
          const tcId = `tc-${toolSeq++}`
          const tc: ToolCallData = { id: tcId, name, input: execInput as Record<string, unknown>, status: "running" }
          appendPart({ type: "tool", call: tc })

          const result = await executor(name, execInput, (chunk) => {
            pendingToolOutput.set(tcId, (pendingToolOutput.get(tcId) ?? "") + chunk)
            flushToolOutput(tcId)
          })

          flushToolOutput(tcId, true)
          updateLastTool(tcId, (t) => ({ ...t, status: "done", output: result }))

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
            pendingText += chunk
            flushText()
          },
          (_toolName, _toolInput) => {},
          session
            ? { summary: session.summary }
            : undefined
        )

        flushText(true)

        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, streaming: false } : m)
        )

        if (sessionRef.current) {
          sessionRef.current.messages = historyRef.current
          sessionRef.current.lastTokenCount =
            loopResult.inputTokens > 0
              ? loopResult.inputTokens
              : estimateTokens(historyRef.current)
          await saveSession(sessionRef.current)

          if (shouldCompact(sessionRef.current, maxContextTokens)) {
            await compactHistory(provider, sessionRef.current)
            historyRef.current = sessionRef.current.messages
            await saveSession(sessionRef.current)
          }
        }
      } catch (err) {
        const errText = err instanceof Error ? err.message : String(err)
        flushText(true)
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
  const rows = stdout?.rows ?? 24
  const spinnerChar = SPINNER_FRAMES[tick % SPINNER_FRAMES.length]

  // Header: 3 rows (border-top + content + border-bottom)
  // InputBar: 4 rows (border-top + input + border-bottom + hints)
  // Spinner: 1 row when busy
  const viewportRows = Math.max(4, rows - (busy ? 8 : 7))

  // scrollOffset: lines scrolled up from bottom (0 = pinned to newest content)
  // When streaming without manual scroll, keep pinned to bottom (pass 0)
  const effectiveScrollOffset =
    busy && !manualScrollRef.current ? 0 : (isFinite(scrollOffset) ? scrollOffset : 0)

  const handleMaxScrollChange = useCallback((maxScroll: number) => {
    maxScrollRef.current = maxScroll
    // Clamp current offset if content shrank below it.
    setScrollOffset((o) => (o > maxScroll ? maxScroll : o))
  }, [])

  return (
    <Box flexDirection="column" width={cols}>
      <Box>
        <Header model={modelLabel(providerConfig)} providerType={providerConfig.type} />
      </Box>

      {showDashboard && dashboardData ? (
        <Box flexDirection="column" flexGrow={1}>
          <Dashboard
            statuses={dashboardData.statuses}
            projects={dashboardData.projects}
            cursorIndex={dashCursor}
            expandedSet={dashExpanded}
          />
          <Box paddingX={3} gap={3} marginTop={1}>
            <Text color={C.surface2} dimColor>
              <Text color={C.overlay0}>↑↓</Text> nav
            </Text>
            <Text color={C.surface2} dimColor>
              <Text color={C.overlay0}>Enter/→</Text> expand
            </Text>
            <Text color={C.surface2} dimColor>
              <Text color={C.overlay0}>←</Text> collapse
            </Text>
            <Text color={C.surface2} dimColor>
              <Text color={C.overlay0}>Ctrl+D</Text> chat
            </Text>
          </Box>
        </Box>
      ) : (
        <MessageList
          messages={messages}
          tick={tick}
          scrollOffset={effectiveScrollOffset}
          viewportRows={viewportRows}
          onMaxScrollChange={handleMaxScrollChange}
        />
      )}

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
        showDashboard={showDashboard}
      />
    </Box>
  )
}