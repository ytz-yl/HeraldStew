export interface SessionInfo {
  id: string
  project: string
  title?: string
  active: boolean
  startedAt?: string
  subAgents?: SubAgentInfo[]
  messageCount?: number
  tokenUsage?: TokenUsage
}

export interface SubAgentInfo {
  id: string
  type: string
  description?: string
  active: boolean
}

export interface TokenUsage {
  input?: number
  output?: number
}

export interface AgentStatus {
  name: string
  installed: boolean
  version?: string
  sessions: SessionInfo[]
  activeSessionCount: number
  totalSessionCount: number
}

export interface AgentStaticInfo {
  name: string
  installed: boolean
  version?: string
}

export interface AgentObserver {
  getStaticInfo(): Promise<AgentStaticInfo>
  getLiveSessions(): Promise<SessionInfo[]>
}

export interface ProjectGroup {
  project: string
  agents: {
    agentName: string
    sessions: SessionInfo[]
  }[]
}

export function groupByProject(statuses: AgentStatus[]): ProjectGroup[] {
  const map = new Map<string, Map<string, SessionInfo[]>>()

  for (const status of statuses) {
    for (const session of status.sessions) {
      const proj = session.project || "(unknown)"
      if (!map.has(proj)) map.set(proj, new Map())
      const agentMap = map.get(proj)!
      if (!agentMap.has(status.name)) agentMap.set(status.name, [])
      agentMap.get(status.name)!.push(session)
    }
  }

  const groups: ProjectGroup[] = []
  for (const [project, agentMap] of map) {
    const agents: ProjectGroup["agents"] = []
    for (const [agentName, sessions] of agentMap) {
      agents.push({ agentName, sessions })
    }
    groups.push({ project, agents })
  }

  groups.sort((a, b) => {
    const aActive = a.agents.some((ag) => ag.sessions.some((s) => s.active))
    const bActive = b.agents.some((ag) => ag.sessions.some((s) => s.active))
    if (aActive !== bActive) return aActive ? -1 : 1
    return a.project.localeCompare(b.project)
  })

  return groups
}