import React, { useRef, useEffect } from "react"
import { Box, Text, useStdout, useBoxMetrics } from "ink"
import { C } from "../theme.js"
import type { AgentStatus, ProjectGroup, SessionInfo, SubAgentInfo } from "../../agents/observer.js"

interface DashboardProps {
  statuses: AgentStatus[]
  projects: ProjectGroup[]
  cursorIndex: number
  expandedSet: Set<string>
  onHeaderHeight?: (rows: number) => void
}

function formatTokenCount(n?: number): string {
  if (n === undefined) return ""
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function shortenPath(p: string, maxLen: number): string {
  if (p.length <= maxLen) return p
  const home = process.env.HOME ?? ""
  if (home && p.startsWith(home)) return "~" + p.slice(home.length)
  if (p.length > maxLen) return "…" + p.slice(-(maxLen - 1))
  return p
}

function AgentBadge({ status }: { status: AgentStatus }) {
  const color = status.installed
    ? status.activeSessionCount > 0 ? C.green : C.overlay1
    : C.surface2

  return (
    <Box gap={1}>
      <Text color={color}>{status.installed ? (status.activeSessionCount > 0 ? "●" : "○") : "✗"}</Text>
      <Text color={status.installed ? C.text : C.overlay0} bold={status.installed}>
        {status.name}
      </Text>
      {status.version && (
        <Text color={C.surface2} dimColor>{status.version.split(" ").pop()}</Text>
      )}
    </Box>
  )
}

function SessionLine({ session, cols }: { session: SessionInfo; cols: number }) {
  const maxTitle = Math.max(20, cols - 40)
  const title = session.title
    ? shortenPath(session.title, maxTitle)
    : "(no title)"
  const statusIcon = session.active ? "●" : "○"
  const statusColor = session.active ? C.green : C.overlay0
  const tokens = session.tokenUsage
  const tokenStr = tokens
    ? `${formatTokenCount(tokens.input)}↓ ${formatTokenCount(tokens.output)}↑`
    : ""

  return (
    <Box marginLeft={4} gap={1}>
      <Text color={statusColor}>{statusIcon}</Text>
      <Text color={C.subtext0} wrap="truncate-end">
        {title}
      </Text>
      {tokenStr && <Text color={C.surface2} dimColor>{tokenStr}</Text>}
      {session.messageCount !== undefined && (
        <Text color={C.surface2} dimColor>{session.messageCount}msg</Text>
      )}
    </Box>
  )
}

function SubAgentLine({ sub }: { sub: SubAgentInfo }) {
  const icon = sub.active ? "◆" : "◇"
  const color = sub.active ? C.peach : C.overlay0
  return (
    <Box marginLeft={6} gap={1}>
      <Text color={color}>{icon}</Text>
      <Text color={C.peach} dimColor>{sub.type}</Text>
      {sub.description && (
        <Text color={C.surface2} dimColor wrap="truncate-end">
          {sub.description.slice(0, 50)}
        </Text>
      )}
    </Box>
  )
}

function ProjectBlock({ group, cols, isCursor, isExpanded }: {
  group: ProjectGroup
  cols: number
  isCursor: boolean
  isExpanded: boolean
}) {
  const hasActive = group.agents.some((a) => a.sessions.some((s) => s.active))
  const maxPath = Math.max(30, cols - 14)
  const displayPath = shortenPath(group.project, maxPath)

  const totalSessions = group.agents.reduce((sum, a) => sum + a.sessions.length, 0)
  const totalActive = group.agents.reduce((sum, a) => sum + a.sessions.filter((s) => s.active).length, 0)

  const cursorMarker = isCursor ? "›" : " "
  const cursorColor = isCursor ? C.brand : C.surface2
  const expandIcon = isExpanded ? "▾" : "▸"
  const dirColor = hasActive ? C.sky : C.overlay1

  return (
    <Box flexDirection="column" marginBottom={isExpanded ? 1 : 0}>
      <Box gap={1}>
        <Text color={cursorColor} bold>{cursorMarker}</Text>
        <Text color={cursorColor}>{expandIcon}</Text>
        <Text color={dirColor} bold={isCursor}>{displayPath}</Text>
        <Text color={C.surface2} dimColor>
          {totalSessions} session{totalSessions !== 1 ? "s" : ""}
          {totalActive > 0 ? ` · ${totalActive} active` : ""}
        </Text>
      </Box>

      {isExpanded && group.agents.map((ag) => {
        const activeCount = ag.sessions.filter((s) => s.active).length
        const totalCount = ag.sessions.length
        const statusIcon = activeCount > 0 ? "●" : "○"
        const statusColor = activeCount > 0 ? C.green : C.overlay0

        return (
          <Box flexDirection="column" key={ag.agentName} marginLeft={2} marginTop={0}>
            <Box gap={1}>
              <Text color={statusColor}>{statusIcon}</Text>
              <Text color={C.brand} bold>{ag.agentName}</Text>
              <Text color={C.surface2} dimColor>
                {totalCount} session{totalCount !== 1 ? "s" : ""}
                {activeCount > 0 ? ` (${activeCount} active)` : ""}
              </Text>
            </Box>

            {ag.sessions.slice(0, 5).map((s) => (
              <Box flexDirection="column" key={s.id}>
                <SessionLine session={s} cols={cols} />
                {s.subAgents?.map((sub) => (
                  <SubAgentLine key={sub.id} sub={sub} />
                ))}
              </Box>
            ))}
            {ag.sessions.length > 5 && (
              <Box marginLeft={4}>
                <Text color={C.surface2} dimColor>  … +{ag.sessions.length - 5} more</Text>
              </Box>
            )}
          </Box>
        )
      })}
    </Box>
  )
}

function UninstalledAgents({ statuses }: { statuses: AgentStatus[] }) {
  const uninstalled = statuses.filter((s) => !s.installed)
  if (uninstalled.length === 0) return null

  return (
    <Box flexDirection="column" marginTop={1}>
      {uninstalled.map((s) => (
        <Box key={s.name} gap={1}>
          <Text color={C.surface2}>✗</Text>
          <Text color={C.overlay0} dimColor>{s.name} — not installed</Text>
        </Box>
      ))}
    </Box>
  )
}

export function Dashboard({ statuses, projects, cursorIndex, expandedSet, onHeaderHeight }: DashboardProps) {
  const { stdout } = useStdout()
  const cols = stdout?.columns ?? 80
  const headerRef = useRef(null)
  const contentRef = useRef(null)
  const { height: headerHeight, hasMeasured } = useBoxMetrics(headerRef)

  useEffect(() => {
    if (hasMeasured && onHeaderHeight) {
      onHeaderHeight(headerHeight)
    }
  }, [headerHeight, hasMeasured, onHeaderHeight])

  const installedCount = statuses.filter((s) => s.installed).length
  const totalActive = statuses.reduce((sum, s) => sum + s.activeSessionCount, 0)
  const totalSessions = statuses.reduce((sum, s) => sum + s.totalSessionCount, 0)

  return (
    <Box flexDirection="column" paddingX={2}>
      <Box ref={headerRef} borderStyle="round" borderColor={C.surface1} paddingX={1} marginBottom={1}>
        <Box flexDirection="column">
          <Box gap={2}>
            <Text color={C.brand} bold>⬡ Agent Dashboard</Text>
            <Text color={C.surface2}>│</Text>
            <Text color={C.overlay1}>{installedCount}/{statuses.length} installed</Text>
            <Text color={C.surface2}>│</Text>
            <Text color={C.green}>{totalActive} active</Text>
            <Text color={C.surface2}>│</Text>
            <Text color={C.overlay1}>{totalSessions} sessions</Text>
          </Box>

          <Box gap={2} marginTop={0}>
            {statuses.filter((s) => s.installed).map((s) => (
              <AgentBadge key={s.name} status={s} />
            ))}
          </Box>
        </Box>
      </Box>

      {projects.length > 0 ? (
        projects.map((group, idx) => (
          <ProjectBlock
            key={group.project}
            group={group}
            cols={cols}
            isCursor={idx === cursorIndex}
            isExpanded={expandedSet.has(group.project)}
          />
        ))
      ) : (
        <Box paddingY={1}>
          <Text color={C.overlay0} dimColor>No sessions found</Text>
        </Box>
      )}

      <UninstalledAgents statuses={statuses} />
    </Box>
  )
}